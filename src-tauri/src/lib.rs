use serde::Serialize;
use std::sync::{Mutex, OnceLock};
use tauri::{webview::Url, Manager};
use tauri::WebviewWindow;
use tauri::webview::PageLoadEvent;
#[cfg(not(mobile))]
use tauri::{WebviewUrl, WebviewWindowBuilder};

const LOGIN_URL: &str = "https://linux.do/login";
const BASE_URL: &str = "https://linux.do/";
const MAIN_WINDOW_LABEL: &str = "main";
#[cfg(not(mobile))]
const TOPIC_WINDOW_LABEL_PREFIX: &str = "linuxdo-topic-";
#[cfg(mobile)]
const ERR_UNSUPPORTED_ON_MOBILE: &str = "UNSUPPORTED_ON_MOBILE";

static PRE_LOGIN_URL: OnceLock<Mutex<Option<String>>> = OnceLock::new();
static PENDING_LOGIN_COOKIE: OnceLock<Mutex<Option<String>>> = OnceLock::new();

fn pre_login_url_store() -> &'static Mutex<Option<String>> {
    PRE_LOGIN_URL.get_or_init(|| Mutex::new(None))
}

fn pending_login_cookie_store() -> &'static Mutex<Option<String>> {
    PENDING_LOGIN_COOKIE.get_or_init(|| Mutex::new(None))
}

fn save_pre_login_url(url: &Url) {
    if let Ok(mut guard) = pre_login_url_store().lock() {
        *guard = Some(url.to_string());
    }
}

fn take_pre_login_url() -> Option<Url> {
    let raw = pre_login_url_store()
        .lock()
        .ok()
        .and_then(|mut guard| guard.take());
    raw.and_then(|value| Url::parse(&value).ok())
}

fn clear_pending_login_cookie() {
    if let Ok(mut guard) = pending_login_cookie_store().lock() {
        *guard = None;
    }
}

fn set_pending_login_cookie(cookie_header: String) {
    if let Ok(mut guard) = pending_login_cookie_store().lock() {
        *guard = Some(cookie_header);
    }
}

#[derive(Clone, Serialize)]
struct PlatformCapabilities {
    is_mobile: bool,
    supports_multi_window: bool,
    supports_window_resize: bool,
}

#[tauri::command]
fn platform_capabilities() -> PlatformCapabilities {
    let is_mobile = cfg!(mobile);
    PlatformCapabilities {
        is_mobile,
        supports_multi_window: !is_mobile,
        supports_window_resize: !is_mobile,
    }
}

#[tauri::command]
async fn open_login_webview(
    _app: tauri::AppHandle,
    webview_window: WebviewWindow,
) -> Result<(), String> {
    let login_url = Url::parse(LOGIN_URL).map_err(|error| error.to_string())?;
    clear_pending_login_cookie();
    if let Ok(current_url) = webview_window.url() {
        save_pre_login_url(&current_url);
    }
    webview_window
        .navigate(login_url)
        .map_err(|error| error.to_string())?;
    let _ = webview_window.set_focus();
    Ok(())
}

#[tauri::command]
#[cfg(not(mobile))]
async fn clear_linuxdo_browsing_data(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(main_window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        main_window
            .clear_all_browsing_data()
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

#[tauri::command]
#[cfg(mobile)]
async fn clear_linuxdo_browsing_data(_app: tauri::AppHandle) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
fn take_pending_login_cookie() -> Option<String> {
    pending_login_cookie_store()
        .lock()
        .ok()
        .and_then(|mut guard| guard.take())
}

#[tauri::command]
#[cfg(not(mobile))]
async fn open_topic_window(
    app: tauri::AppHandle,
    topic_id: u64,
    width: Option<f64>,
    height: Option<f64>,
) -> Result<(), String> {
    let label = format!("{TOPIC_WINDOW_LABEL_PREFIX}{topic_id}");
    if let Some(existing) = app.get_webview_window(&label) {
        let _ = existing.set_focus();
        return Ok(());
    }

    let target_hash = format!("/topics?topic={topic_id}&minimal=1");
    let init_script = format!(
        r#"
if (window.location.hash !== "{target_hash}") {{
  window.location.hash = "{target_hash}";
}}
"#
    );

    let window_width = width.unwrap_or(1180.0).round().clamp(420.0, 3000.0);
    let window_height = height.unwrap_or(820.0).round().clamp(540.0, 2200.0);

    WebviewWindowBuilder::new(&app, label, WebviewUrl::App("index.html".into()))
        .title(&format!("Topic #{topic_id}"))
        .inner_size(window_width, window_height)
        .resizable(true)
        .focused(true)
        .initialization_script(&init_script)
        .build()
        .map_err(|error| error.to_string())?;

    Ok(())
}

#[tauri::command]
#[cfg(mobile)]
async fn open_topic_window(
    _app: tauri::AppHandle,
    _topic_id: u64,
    _width: Option<f64>,
    _height: Option<f64>,
) -> Result<(), String> {
    Err(ERR_UNSUPPORTED_ON_MOBILE.to_string())
}

async fn get_linuxdo_cookie_header_from_webview(
    webview: WebviewWindow,
) -> Result<Option<String>, String> {
    let cookie_url = Url::parse(BASE_URL).map_err(|error| error.to_string())?;
    let cookies = tauri::async_runtime::spawn_blocking(move || webview.cookies_for_url(cookie_url))
        .await
        .map_err(|error| error.to_string())?
        .map_err(|error| error.to_string())?;

    let header = cookies
        .into_iter()
        .filter(|cookie| !cookie.value().is_empty())
        .map(|cookie| format!("{}={}", cookie.name(), cookie.value()))
        .collect::<Vec<_>>()
        .join("; ");

    if header.trim().is_empty() || !header.split("; ").any(|entry| entry.starts_with("_t=")) {
        Ok(None)
    } else {
        Ok(Some(header))
    }
}

fn is_linuxdo_non_login_url(url: &Url) -> bool {
    if !matches!(url.scheme(), "http" | "https") {
        return false;
    }
    if url.host_str() != Some("linux.do") {
        return false;
    }
    let path = url.path().trim();
    !(path == "/login" || path.starts_with("/login/"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .on_page_load(|window, payload| {
            if !matches!(payload.event(), PageLoadEvent::Finished) {
                return;
            }
            if window.label() != MAIN_WINDOW_LABEL {
                return;
            }
            if !is_linuxdo_non_login_url(payload.url()) {
                return;
            }

            let app_handle = window.app_handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Some(main_window) = app_handle.get_webview_window(MAIN_WINDOW_LABEL) {
                    if let Ok(Some(cookie_header)) =
                        get_linuxdo_cookie_header_from_webview(main_window.clone()).await
                    {
                        set_pending_login_cookie(cookie_header);
                        let target_url = take_pre_login_url();
                        if let Some(target_url) = target_url {
                            let _ = main_window.navigate(target_url);
                        }
                    }
                }
            });
        })
        .invoke_handler(tauri::generate_handler![
            platform_capabilities,
            open_login_webview,
            clear_linuxdo_browsing_data,
            take_pending_login_cookie,
            open_topic_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


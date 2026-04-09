use serde::Serialize;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use tauri::{
    webview::{PageLoadEvent, Url},
    Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent,
};

const LOGIN_WINDOW_LABEL: &str = "linuxdo-login";
const LOGIN_URL: &str = "https://linux.do/login";
const BASE_URL: &str = "https://linux.do/";
const TOPIC_WINDOW_LABEL_PREFIX: &str = "linuxdo-topic-";

#[derive(Clone, Serialize)]
struct LoginStatusPayload {
    cookie_header: String,
}

#[tauri::command]
async fn open_login_webview(
    app: tauri::AppHandle,
    webview_window: WebviewWindow,
) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window(LOGIN_WINDOW_LABEL) {
        let _ = existing.set_focus();
        return Ok(());
    }

    let main_label = webview_window.label().to_string();
    let close_event_main_label = main_label.clone();
    let login_url = Url::parse(LOGIN_URL).map_err(|error| error.to_string())?;
    let app_handle = app.clone();
    let closed_after_login_success = Arc::new(AtomicBool::new(false));
    let close_event_flag = closed_after_login_success.clone();

    let login_window = WebviewWindowBuilder::new(&app, LOGIN_WINDOW_LABEL, WebviewUrl::External(login_url))
        .title("Linux.do 登录")
        .inner_size(980.0, 720.0)
        .resizable(true)
        .focused(true)
        .on_page_load(move |window, payload| {
            if matches!(payload.event(), PageLoadEvent::Finished) {
                let app_handle = app_handle.clone();
                let main_label = main_label.clone();
                let window = window.clone();
                let closed_after_login_success = closed_after_login_success.clone();

                tauri::async_runtime::spawn(async move {
                    if let Ok(Some(cookie_header)) = get_linuxdo_cookie_header_from_webview(window.clone()).await
                    {
                        let _ = app_handle.emit_to(
                            main_label,
                            "linuxdo-login-status",
                            LoginStatusPayload { cookie_header },
                        );
                        closed_after_login_success.store(true, Ordering::Relaxed);
                        let _ = window.close();
                    }
                });
            }
        })
        .build()
        .map_err(|error| error.to_string())?;

    let close_event_app_handle = app.clone();
    login_window.on_window_event(move |event| {
        let should_emit_empty = matches!(event, WindowEvent::CloseRequested { .. } | WindowEvent::Destroyed)
            && !close_event_flag.load(Ordering::Relaxed);
        if should_emit_empty {
            let _ = close_event_app_handle.emit_to(
                close_event_main_label.clone(),
                "linuxdo-login-status",
                LoginStatusPayload {
                    cookie_header: String::new(),
                },
            );
        }
    });

    Ok(())
}

#[tauri::command]
async fn clear_linuxdo_browsing_data(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(login_window) = app.get_webview_window(LOGIN_WINDOW_LABEL) {
        login_window
            .clear_all_browsing_data()
            .map_err(|error| error.to_string())?;
        let _ = login_window.close();
    }

    if let Some(main_window) = app.get_webview_window("main") {
        main_window
            .clear_all_browsing_data()
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

#[tauri::command]
async fn open_topic_window(app: tauri::AppHandle, topic_id: u64) -> Result<(), String> {
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

    WebviewWindowBuilder::new(&app, label, WebviewUrl::App("index.html".into()))
        .title(&format!("Topic #{topic_id}"))
        .inner_size(1180.0, 820.0)
        .resizable(true)
        .focused(true)
        .initialization_script(&init_script)
        .build()
        .map_err(|error| error.to_string())?;

    Ok(())
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            open_login_webview,
            clear_linuxdo_browsing_data,
            open_topic_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

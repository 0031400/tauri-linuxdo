import { load } from "@tauri-apps/plugin-store";

const LAYOUT_STORE_PATH = "linuxdo.store.json";
let layoutStorePromise: ReturnType<typeof load> | null = null;

function getLayoutStore() {
  if (!layoutStorePromise) {
    layoutStorePromise = load(LAYOUT_STORE_PATH, {
      defaults: {},
      autoSave: true,
    });
  }
  return layoutStorePromise;
}

export async function readLayoutNumber(key: string, fallback: number) {
  const store = await getLayoutStore();
  const value = await store.get<number>(key);
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export async function writeLayoutNumber(key: string, value: number) {
  const store = await getLayoutStore();
  await store.set(key, value);
}

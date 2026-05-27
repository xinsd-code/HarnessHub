import { isDesktop } from "@/lib/transport";

type WindowTheme = "light" | "dark" | null;
type UnlistenFn = () => void;

async function getTauriWindow() {
  if (!isDesktop()) return null;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    return getCurrentWindow();
  } catch (error) {
    console.error("Failed to load Tauri window API:", error);
    return null;
  }
}

export async function startWindowDrag(): Promise<void> {
  const appWindow = await getTauriWindow();
  await appWindow?.startDragging();
}

export async function toggleWindowMaximize(): Promise<void> {
  const appWindow = await getTauriWindow();
  await appWindow?.toggleMaximize();
}

export async function minimizeWindow(): Promise<void> {
  const appWindow = await getTauriWindow();
  await appWindow?.minimize();
}

export async function maximizeWindow(): Promise<void> {
  const appWindow = await getTauriWindow();
  await appWindow?.maximize();
}

export async function closeWindow(): Promise<void> {
  const appWindow = await getTauriWindow();
  await appWindow?.close();
}

export async function setWindowTheme(theme: WindowTheme): Promise<void> {
  const appWindow = await getTauriWindow();
  await appWindow?.setTheme(theme);
}

export async function onWindowFocusChanged(
  callback: (focused: boolean) => void,
): Promise<UnlistenFn> {
  const appWindow = await getTauriWindow();
  return (
    appWindow?.onFocusChanged(({ payload }) => callback(payload)) ?? (() => {})
  );
}

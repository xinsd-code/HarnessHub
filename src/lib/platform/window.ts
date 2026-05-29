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

async function runWindowOperation(
  operationName: string,
  operation: (
    appWindow: NonNullable<Awaited<ReturnType<typeof getTauriWindow>>>,
  ) => Promise<void>,
): Promise<void> {
  const appWindow = await getTauriWindow();
  if (!appWindow) return;
  try {
    await operation(appWindow);
  } catch (error) {
    console.error(`Tauri window operation failed: ${operationName}`, error);
  }
}

export async function startWindowDrag(): Promise<void> {
  await runWindowOperation("start window drag", (appWindow) =>
    appWindow.startDragging(),
  );
}

export async function toggleWindowMaximize(): Promise<void> {
  await runWindowOperation("toggle window maximize", (appWindow) =>
    appWindow.toggleMaximize(),
  );
}

export async function minimizeWindow(): Promise<void> {
  await runWindowOperation("minimize window", (appWindow) =>
    appWindow.minimize(),
  );
}

export async function maximizeWindow(): Promise<void> {
  await runWindowOperation("maximize window", (appWindow) =>
    appWindow.maximize(),
  );
}

export async function closeWindow(): Promise<void> {
  await runWindowOperation("close window", (appWindow) => appWindow.close());
}

export async function setWindowTheme(theme: WindowTheme): Promise<void> {
  await runWindowOperation("set window theme", (appWindow) =>
    appWindow.setTheme(theme),
  );
}

export async function onWindowFocusChanged(
  callback: (focused: boolean) => void,
): Promise<UnlistenFn> {
  const appWindow = await getTauriWindow();
  if (!appWindow) return () => {};
  try {
    return await appWindow.onFocusChanged(({ payload }) => callback(payload));
  } catch (error) {
    console.error("Tauri window listener failed: window focus changed", error);
    return () => {};
  }
}

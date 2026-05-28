import { isDesktop } from "@/lib/transport";

export interface DesktopUpdate {
  version: string;
  body?: string | null;
  downloadAndInstall: () => Promise<void>;
}

export async function checkDesktopUpdate(): Promise<DesktopUpdate | null> {
  if (!isDesktop()) return null;

  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    return (await check()) as DesktopUpdate | null;
  } catch {
    return null;
  }
}

export async function relaunchDesktopApp(): Promise<void> {
  if (!isDesktop()) return;

  try {
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  } catch (error) {
    console.error("Failed to relaunch desktop app:", error);
  }
}

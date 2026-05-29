import { isDesktop } from "@/lib/transport";

export async function listenTauriEvent(
  event: string,
  handler: () => void,
): Promise<() => void> {
  if (!isDesktop()) return () => undefined;

  try {
    const { listen } = await import("@tauri-apps/api/event");
    return await listen(event, handler);
  } catch (error) {
    console.error(`Failed to listen for Tauri event "${event}":`, error);
    return () => undefined;
  }
}

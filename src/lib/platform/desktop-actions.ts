import { isDesktop, transport } from "@/lib/transport";

export async function openPathInSystem(path: string): Promise<void> {
  if (!isDesktop()) return;
  await transport("open_in_system", { path });
}

export async function revealPathInFileManager(path: string): Promise<void> {
  if (!isDesktop()) return;
  await transport("reveal_in_file_manager", { path });
}

export async function setDesktopAppIcon(name: string): Promise<void> {
  if (!isDesktop()) return;
  await transport("set_app_icon", { name });
}

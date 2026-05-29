import { isDesktop } from "@/lib/transport";

interface PickerOptions {
  title?: string;
  multiple?: boolean;
}

export type PickerResult =
  | { status: "selected"; path: string }
  | { status: "cancelled" }
  | { status: "unsupported" };

export const PICKER_UNSUPPORTED_MESSAGE =
  "Local file selection is only available in the desktop app";

type DialogOpenOptions = {
  directory?: boolean;
  multiple?: boolean;
  title?: string;
};

async function openPicker(options: DialogOpenOptions): Promise<PickerResult> {
  if (!isDesktop()) return { status: "unsupported" };

  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open(options);
    if (typeof selected === "string") {
      return { status: "selected", path: selected };
    }
    return { status: "cancelled" };
  } catch (error) {
    console.error("Dialog plugin not available:", error);
    return { status: "unsupported" };
  }
}

export function openFilePicker(options?: PickerOptions): Promise<PickerResult> {
  return openPicker({
    multiple: options?.multiple ?? false,
    title: options?.title,
  });
}

export function openDirectoryPicker(
  options?: PickerOptions,
): Promise<PickerResult> {
  return openPicker({ directory: true, title: options?.title });
}

export function selectedPickerPath(result: PickerResult): string | null {
  return result.status === "selected" ? result.path : null;
}

import { clsx } from "clsx";
import { setDesktopAppIcon } from "@/lib/platform/desktop-actions";
import { toast } from "@/stores/toast-store";
import type { AppIcon, Mode, ThemeName } from "@/stores/ui-store";

const THEME_OPTIONS: {
  value: ThemeName;
  label: string;
  colors: [string, string, string];
}[] = [
  {
    value: "tiesen",
    label: "Tiesen",
    colors: [
      "oklch(0.5144 0.1605 267.4400)",
      "oklch(0.9851 0 0)",
      "oklch(0 0 0)",
    ],
  },
  {
    value: "claude",
    label: "Claude",
    colors: [
      "oklch(0.6171 0.1375 39.0427)",
      "oklch(0.9665 0.0067 97.3521)",
      "oklch(0.2679 0.0036 106.6427)",
    ],
  },
];

const ICON_OPTIONS: { value: AppIcon; label: string; src: string }[] = [
  { value: "icon-1", label: "Tiesen", src: "/icons/app-icon-1.png" },
  { value: "icon-2", label: "Claude", src: "/icons/app-icon-2.png" },
];

const MODE_OPTIONS: Array<{ value: Mode; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function AppearanceSettingsSection({
  appIcon,
  mode,
  onAppIconChange,
  onModeChange,
  onThemeNameChange,
  showDesktopIcon,
  themeName,
}: {
  appIcon: AppIcon;
  mode: Mode;
  onAppIconChange: (icon: AppIcon) => void;
  onModeChange: (mode: Mode) => void;
  onThemeNameChange: (themeName: ThemeName) => void;
  showDesktopIcon: boolean;
  themeName: ThemeName;
}) {
  return (
    <section id="appearance" className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground tracking-tight">
          Appearance Settings
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Personalize theme, color mode, and desktop app icon.
        </p>
      </div>

      <div className="rounded-xl border border-border/40 bg-card/45 p-5 backdrop-blur-xs shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-sm font-semibold text-foreground">
              Color Theme
            </span>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Select a design theme for the dashboard
            </p>
          </div>
          <div className="flex rounded-lg border border-border bg-muted/20 p-1">
            {THEME_OPTIONS.map((theme) => (
              <button
                key={theme.value}
                type="button"
                aria-label={`Theme ${theme.label}`}
                aria-pressed={themeName === theme.value}
                onClick={() => {
                  onThemeNameChange(theme.value);
                  toast.success(`Theme: ${theme.label}`);
                }}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200",
                  themeName === theme.value
                    ? "bg-primary text-primary-foreground shadow-sm animate-scale-in"
                    : "text-muted-foreground hover:bg-card/40 hover:text-foreground",
                )}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full border border-primary-foreground/20 transition-transform duration-300"
                  style={{
                    backgroundColor:
                      themeName === theme.value
                        ? "oklch(1 0 0 / 0.9)"
                        : theme.colors[0],
                  }}
                />
                {theme.label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-border/40" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-sm font-semibold text-foreground">
              Interface Mode
            </span>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Toggle between light, dark, or system preference
            </p>
          </div>
          <div className="flex rounded-lg border border-border bg-muted/20 p-1">
            {MODE_OPTIONS.map((modeOption) => (
              <button
                key={modeOption.value}
                type="button"
                aria-pressed={mode === modeOption.value}
                onClick={() => {
                  onModeChange(modeOption.value);
                  toast.success(`Mode: ${modeOption.label}`);
                }}
                className={clsx(
                  "px-3.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200",
                  mode === modeOption.value
                    ? "bg-primary text-primary-foreground shadow-sm animate-scale-in"
                    : "text-muted-foreground hover:bg-card/40 hover:text-foreground",
                )}
              >
                {modeOption.label}
              </button>
            ))}
          </div>
        </div>

        {showDesktopIcon && (
          <>
            <div className="border-t border-border/40" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-sm font-semibold text-foreground">
                  App Launcher Icon
                </span>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Customize the app icon of your desktop client
                </p>
              </div>
              <div className="flex gap-3">
                {ICON_OPTIONS.map((icon) => (
                  <button
                    key={icon.value}
                    type="button"
                    aria-label={`App icon ${icon.label}`}
                    aria-pressed={appIcon === icon.value}
                    onClick={() => {
                      onAppIconChange(icon.value);
                      setDesktopAppIcon(icon.value)
                        .then(() => {
                          toast.success(`Icon: ${icon.label}`);
                        })
                        .catch(() => {
                          toast.error("Failed to set icon");
                        });
                    }}
                    className={clsx(
                      "rounded-xl p-0.5 transition-all duration-200 active:scale-95",
                      appIcon === icon.value
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-card"
                        : "ring-1 ring-border hover:ring-primary/50",
                    )}
                  >
                    <img
                      src={icon.src}
                      alt={icon.label}
                      className="h-10 w-10 rounded-lg"
                    />
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

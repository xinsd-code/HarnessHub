import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppearanceSettingsSection } from "@/components/settings/appearance-settings-section";

const mocks = vi.hoisted(() => ({
  setDesktopAppIcon: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/platform/desktop-actions", () => ({
  setDesktopAppIcon: mocks.setDesktopAppIcon,
}));

describe("AppearanceSettingsSection", () => {
  it("renders appearance controls and forwards changes", async () => {
    const onThemeNameChange = vi.fn();
    const onModeChange = vi.fn();
    const onAppIconChange = vi.fn();

    render(
      <AppearanceSettingsSection
        appIcon="icon-1"
        mode="system"
        onAppIconChange={onAppIconChange}
        onModeChange={onModeChange}
        onThemeNameChange={onThemeNameChange}
        showDesktopIcon
        themeName="tiesen"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /theme claude/i }));
    expect(onThemeNameChange).toHaveBeenCalledWith("claude");

    fireEvent.click(screen.getByRole("button", { name: /dark/i }));
    expect(onModeChange).toHaveBeenCalledWith("dark");

    fireEvent.click(screen.getByRole("button", { name: /app icon claude/i }));
    expect(onAppIconChange).toHaveBeenCalledWith("icon-2");
    await waitFor(() =>
      expect(mocks.setDesktopAppIcon).toHaveBeenCalledWith("icon-2"),
    );
  });

  it("hides desktop icon controls in web mode", () => {
    render(
      <AppearanceSettingsSection
        appIcon="icon-1"
        mode="system"
        onAppIconChange={vi.fn()}
        onModeChange={vi.fn()}
        onThemeNameChange={vi.fn()}
        showDesktopIcon={false}
        themeName="tiesen"
      />,
    );

    expect(screen.queryByText("App Launcher Icon")).toBeNull();
  });
});

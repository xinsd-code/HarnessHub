const DEFAULT_RELEASES_URL =
  "https://api.github.com/repos/xinsd-code/HarnessHub/releases/latest";
const DEFAULT_UPDATE_INSTRUCTIONS_URL =
  "https://github.com/xinsd-code/HarnessHub#updating";

function envUrl(name: string, fallback: string): string {
  const value = import.meta.env[name];
  return typeof value === "string" && value.trim() ? value : fallback;
}

export const RELEASES_URL = envUrl(
  "VITE_HARNESSKIT_RELEASES_URL",
  DEFAULT_RELEASES_URL,
);

export const UPDATE_INSTRUCTIONS_URL = envUrl(
  "VITE_HARNESSKIT_UPDATE_INSTRUCTIONS_URL",
  DEFAULT_UPDATE_INSTRUCTIONS_URL,
);

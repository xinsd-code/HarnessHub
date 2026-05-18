import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HarnessKitPage from "@/pages/harnesskit";
import type { KitAssetCandidate, KitSummary } from "@/lib/types";

const kits: KitSummary[] = [
  {
    id: "kit-1",
    name: "Data Analyst Kit",
    description: "SQL and data analysis assets",
    skills_count: 2,
    mcp_count: 1,
    cli_count: 1,
    created_at: "2026-05-18T00:00:00Z",
    updated_at: "2026-05-18T00:00:00Z",
  },
];

const candidates: KitAssetCandidate[] = [
  {
    id: "hub:skill-1",
    kind: "skill",
    name: "frontend-design",
    description: "Build polished UI",
    source_status: "in_local_hub",
    hub_extension_id: "skill-1",
    extension_id: null,
  },
  {
    id: "extension:mcp-1",
    kind: "mcp",
    name: "chrome-devtools",
    description: "Browser automation",
    source_status: "will_sync_to_local_hub",
    hub_extension_id: null,
    extension_id: "mcp-1",
  },
  {
    id: "hub:cli-1",
    kind: "cli",
    name: "gh",
    description: "GitHub CLI",
    source_status: "in_local_hub",
    hub_extension_id: "cli-1",
    extension_id: null,
  },
];

const state = {
  kits,
  candidates,
  loading: false,
  candidateLoading: false,
  error: null as string | null,
  fetch: vi.fn(() => Promise.resolve()),
  fetchCandidates: vi.fn(() => Promise.resolve()),
  createKit: vi.fn(() => Promise.resolve()),
  deleteKit: vi.fn(() => Promise.resolve()),
};

vi.mock("@/stores/kit-store", () => ({
  useKitStore: (selector: (s: typeof state) => unknown) => selector(state),
}));

beforeEach(() => {
  state.kits = kits;
  state.candidates = candidates;
  state.loading = false;
  state.candidateLoading = false;
  state.error = null;
  state.fetch.mockClear();
  state.fetchCandidates.mockClear();
  state.createKit.mockClear();
  state.deleteKit.mockClear();
});

describe("HarnessKitPage", () => {
  it("renders submenu, header, and Kit cards with asset counts", async () => {
    render(<HarnessKitPage />);

    expect(screen.getByRole("heading", { name: "HarnessKit" })).toBeInTheDocument();
    expect(screen.getByText("Extensions Kit")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New Kit" })).toBeInTheDocument();

    const card = screen.getByText("Data Analyst Kit").closest("article");
    expect(card).toBeTruthy();
    const scoped = within(card as HTMLElement);
    expect(scoped.getByText("SQL and data analysis assets")).toBeInTheDocument();
    expect(scoped.getByText("Skills 2")).toBeInTheDocument();
    expect(scoped.getByText("MCP 1")).toBeInTheDocument();
    expect(scoped.getByText("CLI 1")).toBeInTheDocument();

    await waitFor(() => expect(state.fetch).toHaveBeenCalled());
  });

  it("validates create form and submits selected candidates", async () => {
    render(<HarnessKitPage />);
    fireEvent.click(screen.getByRole("button", { name: "New Kit" }));

    fireEvent.click(screen.getByRole("button", { name: "Save Kit" }));
    expect(await screen.findByText("Kit name is required")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Kit name"), {
      target: { value: "Frontend Builder Kit" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Kit" }));
    expect(await screen.findByText("Select at least one asset")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: /frontend-design/i }));
    fireEvent.click(screen.getByRole("button", { name: "MCP" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /chrome-devtools/i }));
    fireEvent.click(screen.getByRole("button", { name: "Save Kit" }));

    await waitFor(() =>
      expect(state.createKit).toHaveBeenCalledWith({
        name: "Frontend Builder Kit",
        description: "",
        candidate_ids: ["hub:skill-1", "extension:mcp-1"],
      }),
    );
  });

  it("deletes only the Kit after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValueOnce(true);
    render(<HarnessKitPage />);

    fireEvent.click(screen.getByRole("button", { name: /Delete Data Analyst Kit/i }));

    await waitFor(() => expect(state.deleteKit).toHaveBeenCalledWith("kit-1"));
  });
});

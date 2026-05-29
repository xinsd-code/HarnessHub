import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectPathsSection } from "@/components/settings/project-paths-section";
import type { DiscoveredProject, Project } from "@/lib/types";

const projects: Project[] = [
  {
    id: "alpha",
    name: "alpha",
    path: "/workspace/alpha",
    created_at: "2026-05-01T00:00:00.000Z",
    exists: true,
  },
  {
    id: "missing",
    name: "missing",
    path: "/workspace/missing",
    created_at: "2026-05-01T00:00:00.000Z",
    exists: false,
  },
];

const discoveredProjects: DiscoveredProject[] = [
  { name: "beta", path: "/workspace/beta" },
  { name: "alpha", path: "/workspace/alpha" },
];

describe("ProjectPathsSection", () => {
  it("submits typed project paths and removal through callbacks", () => {
    const onInputChange = vi.fn();
    const onAddPath = vi.fn();
    const onRemoveProject = vi.fn();

    render(
      <ProjectPathsSection
        adding={false}
        discoveredProjects={null}
        discoveredSelected={new Set()}
        existingPaths={new Set()}
        isDesktop={false}
        loading={false}
        onAddDiscovered={vi.fn()}
        onAddPath={onAddPath}
        onBrowseProject={vi.fn()}
        onCancelDiscovered={vi.fn()}
        onInputChange={onInputChange}
        onRemoveProject={onRemoveProject}
        onToggleDiscovered={vi.fn()}
        projectPathInput="/workspace/new"
        projects={projects}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /add project/i }));
    expect(onAddPath).toHaveBeenCalledWith("/workspace/new");

    fireEvent.change(screen.getByPlaceholderText("Paste a project path..."), {
      target: { value: "/workspace/next" },
    });
    expect(onInputChange).toHaveBeenCalledWith("/workspace/next");

    fireEvent.click(screen.getByRole("button", { name: "Remove alpha" }));
    expect(onRemoveProject).toHaveBeenCalledWith("alpha");
    expect(screen.getByText("Missing")).toBeTruthy();
  });

  it("renders discovered project choices and disables already added paths", () => {
    const onToggleDiscovered = vi.fn();

    render(
      <ProjectPathsSection
        adding={false}
        discoveredProjects={discoveredProjects}
        discoveredSelected={new Set(["/workspace/beta"])}
        existingPaths={new Set(["/workspace/alpha"])}
        isDesktop
        loading={false}
        onAddDiscovered={vi.fn()}
        onAddPath={vi.fn()}
        onBrowseProject={vi.fn()}
        onCancelDiscovered={vi.fn()}
        onInputChange={vi.fn()}
        onRemoveProject={vi.fn()}
        onToggleDiscovered={onToggleDiscovered}
        projectPathInput=""
        projects={[]}
      />,
    );

    const beta = screen.getByRole("checkbox", { name: /beta/i });
    const alpha = screen.getByRole("checkbox", { name: /alpha/i });

    expect((beta as HTMLInputElement).checked).toBe(true);
    expect((alpha as HTMLInputElement).disabled).toBe(true);

    fireEvent.click(beta);
    expect(onToggleDiscovered).toHaveBeenCalledWith("/workspace/beta");
  });
});

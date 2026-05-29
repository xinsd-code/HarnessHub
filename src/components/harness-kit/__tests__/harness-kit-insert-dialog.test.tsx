import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HarnessKitInsertDialog } from "@/components/harness-kit/harness-kit-insert-dialog";

describe("HarnessKitInsertDialog", () => {
  it("shows read-only project path and editable config rows", () => {
    render(
      <HarnessKitInsertDialog
        projectName="HarnessKit"
        projectPath="/workspace/hk"
        targetAgent="codex"
        agentConfigs={[{ template_id: "tpl-1", template_name: "Rules" }]}
        preview={null}
        defaultRelPath=".codex/AGENTS.md"
        pending={false}
        onPreview={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText("/workspace/hk")).toBeInTheDocument();
    expect(screen.getByDisplayValue(".codex/AGENTS.md")).toBeInTheDocument();
  });

  it("blocks duplicate config paths", () => {
    const onPreview = vi.fn();
    render(
      <HarnessKitInsertDialog
        projectName="HarnessKit"
        projectPath="/workspace/hk"
        targetAgent="codex"
        agentConfigs={[
          { template_id: "tpl-1", template_name: "Rules A" },
          { template_id: "tpl-2", template_name: "Rules B" },
        ]}
        preview={null}
        defaultRelPath=".codex/AGENTS.md"
        pending={false}
        onPreview={onPreview}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Preview/i }));
    expect(onPreview).not.toHaveBeenCalled();
    expect(screen.getByText(/unique relative paths/i)).toBeInTheDocument();
  });

  it("renders with dialog role and correct aria label", () => {
    render(
      <HarnessKitInsertDialog
        projectName="TestProj"
        projectPath="/tmp/test"
        targetAgent="claude"
        agentConfigs={[{ template_id: "tpl-1", template_name: "Rules" }]}
        preview={null}
        defaultRelPath="CLAUDE.md"
        pending={false}
        onPreview={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog", {
      name: /Insert Harness Kit to Project/i,
    });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("shows project name and agent name", () => {
    render(
      <HarnessKitInsertDialog
        projectName="MyProject"
        projectPath="/projects/my"
        targetAgent="gemini"
        agentConfigs={[{ template_id: "tpl-1", template_name: "Rules" }]}
        preview={null}
        defaultRelPath=".gemini/rules.md"
        pending={false}
        onPreview={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText("MyProject")).toBeInTheDocument();
    expect(screen.getByText("gemini")).toBeInTheDocument();
  });

  it("calls onCancel when close button is clicked", () => {
    const onCancel = vi.fn();
    render(
      <HarnessKitInsertDialog
        projectName="TestProj"
        projectPath="/tmp/test"
        targetAgent="claude"
        agentConfigs={[{ template_id: "tpl-1", template_name: "Rules" }]}
        preview={null}
        defaultRelPath="CLAUDE.md"
        pending={false}
        onPreview={vi.fn()}
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Close/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onPreview with paths when Preview clicked with unique paths", () => {
    const onPreview = vi.fn();
    const configs = [
      { template_id: "tpl-1", template_name: "Rules" },
      { template_id: "tpl-2", template_name: "Memory" },
    ];
    render(
      <HarnessKitInsertDialog
        projectName="TestProj"
        projectPath="/tmp/test"
        targetAgent="claude"
        agentConfigs={configs}
        preview={null}
        defaultRelPath="CLAUDE.md"
        pending={false}
        onPreview={onPreview}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    // Edit the second input to make paths unique
    const inputs = screen.getAllByDisplayValue("CLAUDE.md");
    fireEvent.change(inputs[1], { target: { value: "CUSTOM.md" } });

    fireEvent.click(screen.getByRole("button", { name: /Preview/i }));
    expect(onPreview).toHaveBeenCalledTimes(1);
    expect(onPreview).toHaveBeenCalledWith([
      { template_id: "tpl-1", rel_path: "CLAUDE.md" },
      { template_id: "tpl-2", rel_path: "CUSTOM.md" },
    ]);
  });

  it("disables Preview button when pending", () => {
    render(
      <HarnessKitInsertDialog
        projectName="TestProj"
        projectPath="/tmp/test"
        targetAgent="claude"
        agentConfigs={[{ template_id: "tpl-1", template_name: "Rules" }]}
        preview={null}
        defaultRelPath="CLAUDE.md"
        pending={true}
        onPreview={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Preview/i })).toBeDisabled();
  });

  it("shows conflict checkboxes and summary after preview", () => {
    const preview = {
      asset_conflicts: [
        {
          hub_extension_id: "skill-1",
          kind: "skill" as const,
          asset_name: "frontend-design",
          existing_extension_id: "ext-1",
        },
        {
          hub_extension_id: "mcp-1",
          kind: "mcp" as const,
          asset_name: "chrome-devtools",
          existing_extension_id: "ext-2",
        },
      ],
      config_conflicts: [
        {
          template_id: "tpl-1",
          template_name: "Rules",
          rel_path: "CLAUDE.md",
          target_path: "/tmp/test/CLAUDE.md",
          kind: "config_conflict" as const,
          message: "File already exists",
        },
      ],
      config_targets: [
        {
          template_id: "tpl-1",
          template_name: "Rules",
          rel_path: "CLAUDE.md",
          target_path: "/tmp/test/CLAUDE.md",
        },
      ],
      installable_asset_count: 3,
      writable_config_count: 1,
    };

    render(
      <HarnessKitInsertDialog
        projectName="TestProj"
        projectPath="/tmp/test"
        targetAgent="claude"
        agentConfigs={[{ template_id: "tpl-1", template_name: "Rules" }]}
        preview={preview}
        defaultRelPath="CLAUDE.md"
        pending={false}
        onPreview={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText("frontend-design")).toBeInTheDocument();
    expect(screen.getByText("chrome-devtools")).toBeInTheDocument();
    expect(screen.getByText(/File already exists/i)).toBeInTheDocument();
    expect(screen.getByText(/3 installable assets/i)).toBeInTheDocument();
    expect(screen.getByText(/1 writable config/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Continue/i }),
    ).toBeInTheDocument();
  });

  it("calls onConfirm with force lists when Continue clicked", () => {
    const onConfirm = vi.fn();
    const preview = {
      asset_conflicts: [
        {
          hub_extension_id: "skill-1",
          kind: "skill" as const,
          asset_name: "frontend-design",
          existing_extension_id: "ext-1",
        },
      ],
      config_conflicts: [
        {
          template_id: "tpl-1",
          template_name: "Rules",
          rel_path: "CLAUDE.md",
          target_path: "/tmp/test/CLAUDE.md",
          kind: "config_conflict" as const,
          message: "File already exists",
        },
      ],
      config_targets: [
        {
          template_id: "tpl-1",
          template_name: "Rules",
          rel_path: "CLAUDE.md",
          target_path: "/tmp/test/CLAUDE.md",
        },
      ],
      installable_asset_count: 3,
      writable_config_count: 1,
    };

    render(
      <HarnessKitInsertDialog
        projectName="TestProj"
        projectPath="/tmp/test"
        targetAgent="claude"
        agentConfigs={[{ template_id: "tpl-1", template_name: "Rules" }]}
        preview={preview}
        defaultRelPath="CLAUDE.md"
        pending={false}
        onPreview={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith({
      paths: [{ template_id: "tpl-1", rel_path: "CLAUDE.md" }],
      forceHubExtensionIds: [],
      forceAgentConfigTemplateIds: [],
    });
  });

  it("selects conflict checkboxes and passes them as force lists", () => {
    const onConfirm = vi.fn();
    const preview = {
      asset_conflicts: [
        {
          hub_extension_id: "skill-1",
          kind: "skill" as const,
          asset_name: "frontend-design",
          existing_extension_id: "ext-1",
        },
      ],
      config_conflicts: [
        {
          template_id: "tpl-1",
          template_name: "Rules",
          rel_path: "CLAUDE.md",
          target_path: "/tmp/test/CLAUDE.md",
          kind: "config_conflict" as const,
          message: "File already exists",
        },
      ],
      config_targets: [
        {
          template_id: "tpl-1",
          template_name: "Rules",
          rel_path: "CLAUDE.md",
          target_path: "/tmp/test/CLAUDE.md",
        },
      ],
      installable_asset_count: 3,
      writable_config_count: 1,
    };

    render(
      <HarnessKitInsertDialog
        projectName="TestProj"
        projectPath="/tmp/test"
        targetAgent="claude"
        agentConfigs={[{ template_id: "tpl-1", template_name: "Rules" }]}
        preview={preview}
        defaultRelPath="CLAUDE.md"
        pending={false}
        onPreview={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBe(2);

    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    expect(onConfirm).toHaveBeenCalledWith({
      paths: [{ template_id: "tpl-1", rel_path: "CLAUDE.md" }],
      forceHubExtensionIds: ["skill-1"],
      forceAgentConfigTemplateIds: ["tpl-1"],
    });
  });

  it("disables Continue button when pending", () => {
    const preview = {
      asset_conflicts: [],
      config_conflicts: [],
      config_targets: [
        {
          template_id: "tpl-1",
          template_name: "Rules",
          rel_path: "CLAUDE.md",
          target_path: "/tmp/test/CLAUDE.md",
        },
      ],
      installable_asset_count: 1,
      writable_config_count: 1,
    };

    render(
      <HarnessKitInsertDialog
        projectName="TestProj"
        projectPath="/tmp/test"
        targetAgent="claude"
        agentConfigs={[{ template_id: "tpl-1", template_name: "Rules" }]}
        preview={preview}
        defaultRelPath="CLAUDE.md"
        pending={true}
        onPreview={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Syncing/i })).toBeDisabled();
  });

  it("hides Continue button when no preview", () => {
    render(
      <HarnessKitInsertDialog
        projectName="TestProj"
        projectPath="/tmp/test"
        targetAgent="claude"
        agentConfigs={[{ template_id: "tpl-1", template_name: "Rules" }]}
        preview={null}
        defaultRelPath="CLAUDE.md"
        pending={false}
        onPreview={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /Continue/i }),
    ).not.toBeInTheDocument();
  });

  it("shows preview error from conflict checks", () => {
    const preview = {
      asset_conflicts: [],
      config_conflicts: [],
      config_targets: [
        {
          template_id: "tpl-1",
          template_name: "Rules",
          rel_path: "CLAUDE.md",
          target_path: "/tmp/test/CLAUDE.md",
        },
      ],
      installable_asset_count: 1,
      writable_config_count: 1,
    };

    render(
      <HarnessKitInsertDialog
        projectName="TestProj"
        projectPath="/tmp/test"
        targetAgent="claude"
        agentConfigs={[{ template_id: "tpl-1", template_name: "Rules" }]}
        preview={preview}
        defaultRelPath="CLAUDE.md"
        pending={false}
        onPreview={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    // When there are no conflicts, conflict-related text should not appear
    expect(screen.queryByText("frontend-design")).not.toBeInTheDocument();
    expect(screen.queryByText(/conflict/i)).not.toBeInTheDocument();
  });

  it("calls onCancel when backdrop is clicked", () => {
    const onCancel = vi.fn();
    const { container } = render(
      <HarnessKitInsertDialog
        projectName="TestProj"
        projectPath="/tmp/test"
        targetAgent="claude"
        agentConfigs={[{ template_id: "tpl-1", template_name: "Rules" }]}
        preview={null}
        defaultRelPath="CLAUDE.md"
        pending={false}
        onPreview={vi.fn()}
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />,
    );

    // Click the backdrop (the overlay div)
    const backdrop = container.firstChild as HTMLElement;
    fireEvent.click(backdrop);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

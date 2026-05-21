import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CreateTemplateDialog } from "@/components/agent-config-hub/create-template-dialog";

const templateStore = {
  createTemplate: vi.fn(),
};

vi.mock("@/stores/agent-config-template-store", () => ({
  useAgentConfigTemplateStore: (selector: (state: typeof templateStore) => unknown) =>
    selector(templateStore),
}));

describe("CreateTemplateDialog", () => {
  it("shows only the four manual entry fields", () => {
    render(<CreateTemplateDialog onClose={vi.fn()} />);

    expect(screen.getByLabelText("File name", { selector: "input" })).toBeInTheDocument();
    expect(screen.getByLabelText("Description", { selector: "input" })).toBeInTheDocument();
    expect(screen.getByLabelText("Tag", { selector: "input" })).toBeInTheDocument();
    expect(screen.getByLabelText("File content")).toBeInTheDocument();
    expect(screen.queryByText("Project")).not.toBeInTheDocument();
    expect(screen.queryByText("Target Agent")).not.toBeInTheDocument();
    expect(screen.queryByText("Configuration File")).not.toBeInTheDocument();
  });

  it("submits manual template content", () => {
    render(<CreateTemplateDialog onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("File name", { selector: "input" }), {
      target: { value: "AGENTS.md" },
    });
    fireEvent.change(screen.getByLabelText("Description", { selector: "input" }), {
      target: { value: "my rules" },
    });
    fireEvent.change(screen.getByLabelText("Tag", { selector: "input" }), {
      target: { value: "default" },
    });
    fireEvent.change(screen.getByLabelText("File content"), {
      target: { value: "# content" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Template" }));

    expect(templateStore.createTemplate).toHaveBeenCalledWith({
      sourceProjectPath: "",
      sourceProjectName: "",
      name: "AGENTS.md",
      description: "my rules",
      tag: "default",
      content: "# content",
    });
  });
});

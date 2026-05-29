import { create } from "zustand";
import { humanizeError } from "@/lib/errors";
import { api } from "@/lib/invoke";
import type { AgentConfigTemplate } from "@/lib/types";
import { toast } from "@/stores/toast-store";

interface AgentConfigTemplateState {
  templates: AgentConfigTemplate[];
  selectedId: string | null;
  searchQuery: string;
  tagFilter: string;
  loading: boolean;
  contentCache: Map<string, string>;
  contentLoading: Set<string>;
  contentErrors: Map<string, string>;
  fetch: () => Promise<void>;
  select: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setTagFilter: (tag: string) => void;
  fetchContent: (id: string) => Promise<string>;
  importTemplate: (args: {
    sourcePath: string;
    sourceProjectPath: string;
    sourceProjectName: string;
    name: string;
    description: string;
    tag: string;
  }) => Promise<void>;
  createTemplate: (args: {
    sourceProjectPath: string;
    sourceProjectName: string;
    name: string;
    description: string;
    tag: string;
    content: string;
  }) => Promise<void>;
  updateContent: (id: string, content: string) => Promise<void>;
  updateTag: (id: string, tag: string) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  syncToProject: (
    id: string,
    projectPath: string,
    targetAgent: string,
    force: boolean,
    relPath?: string,
  ) => Promise<string | null>;
}

export const useAgentConfigTemplateStore = create<AgentConfigTemplateState>(
  (set, get) => ({
    templates: [],
    selectedId: null,
    searchQuery: "",
    tagFilter: "all",
    loading: false,
    contentCache: new Map(),
    contentLoading: new Set(),
    contentErrors: new Map(),

    async fetch() {
      set({ loading: true });
      try {
        const templates = await api.listAgentConfigTemplates();
        set({ templates, loading: false });
      } catch (error) {
        console.error("Failed to fetch agent config templates:", error);
        set({ loading: false });
      }
    },

    select(id) {
      set({ selectedId: id });
      if (id) void get().fetchContent(id);
    },

    setSearchQuery(query) {
      set({ searchQuery: query });
    },

    setTagFilter(tag) {
      set({ tagFilter: tag || "all" });
    },

    async fetchContent(id) {
      const cached = get().contentCache.get(id);
      if (cached != null) return cached;
      if (get().contentLoading.has(id)) return "";

      set({ contentLoading: new Set(get().contentLoading).add(id) });
      try {
        const content = await api.getAgentConfigTemplateContent(id);
        const cache = new Map(get().contentCache);
        cache.set(id, content);
        set({ contentCache: cache });
        return content;
      } catch (error) {
        const errors = new Map(get().contentErrors);
        errors.set(id, humanizeError(String(error)));
        set({ contentErrors: errors });
        return "";
      } finally {
        const loading = new Set(get().contentLoading);
        loading.delete(id);
        set({ contentLoading: loading });
      }
    },

    async importTemplate(args) {
      const template = await api.importAgentConfigTemplate(
        args.sourcePath,
        args.sourceProjectPath,
        args.sourceProjectName,
        args.name,
        args.description,
        args.tag,
      );
      toast.success("Agent config imported");
      await get().fetch();
      set({ selectedId: template.id });
    },

    async createTemplate(args) {
      const template = await api.createAgentConfigTemplate(args);
      toast.success("Agent config created");
      await get().fetch();
      set({ selectedId: template.id });
    },

    async updateContent(id, content) {
      const template = await api.updateAgentConfigTemplateContent(id, content);
      const next = new Map(get().contentCache);
      next.set(id, content);
      set({ contentCache: next, selectedId: template.id });
      get().contentErrors.delete(id);
    },

    async updateTag(id, tag) {
      const template = await api.updateAgentConfigTemplateTag(id, tag);
      toast.success("Tag updated");
      await get().fetch();
      set({ selectedId: template.id });
    },

    async deleteTemplate(id) {
      await api.deleteAgentConfigTemplate(id);
      toast.success("Agent config deleted");
      set({ selectedId: null });
      await get().fetch();
    },

    async syncToProject(id, projectPath, targetAgent, force, relPath) {
      try {
        const targetPath = await api.syncAgentConfigTemplateToProject(
          id,
          projectPath,
          targetAgent,
          force,
          relPath,
        );
        toast.success("Agent config synced");
        return targetPath;
      } catch (error) {
        throw error;
      }
    },
  }),
);

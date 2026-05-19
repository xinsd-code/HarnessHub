import { create } from "zustand";
import { humanizeError } from "@/lib/errors";
import { api } from "@/lib/invoke";
import type {
  CreateKitRequest,
  KitAssetCandidate,
  KitSummary,
  KitSyncResult,
  KitSyncPreview,
  NewKitAsset,
  SyncKitToProjectRequest,
  UpdateKitRequest,
} from "@/lib/types";
import { useExtensionStore } from "@/stores/extension-store";
import { useHubStore } from "@/stores/hub-store";
import { toast } from "@/stores/toast-store";

interface KitState {
  kits: KitSummary[];
  candidates: KitAssetCandidate[];
  loading: boolean;
  candidateLoading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  fetchCandidates: () => Promise<void>;
  createKit: (request: CreateKitRequest) => Promise<void>;
  updateKit: (request: UpdateKitRequest) => Promise<void>;
  deleteKit: (id: string) => Promise<void>;
  fetchKitAssets: (kitId: string) => Promise<NewKitAsset[]>;
  previewKitProjectConflicts: (request: SyncKitToProjectRequest) => Promise<KitSyncPreview>;
  syncKitToProject: (request: SyncKitToProjectRequest) => Promise<KitSyncResult>;
  unsyncKitFromProject: (request: SyncKitToProjectRequest) => Promise<void>;
}

export const useKitStore = create<KitState>((set, get) => ({
  kits: [],
  candidates: [],
  loading: false,
  candidateLoading: false,
  error: null,

  async fetch() {
    set({ loading: true, error: null });
    try {
      const kits = await api.listKits();
      set({ kits, loading: false });
    } catch (error) {
      set({ loading: false, error: humanizeError(String(error)) });
    }
  },

  async fetchCandidates() {
    set({ candidateLoading: true, error: null });
    try {
      const candidates = await api.listKitAssetCandidates();
      set({ candidates, candidateLoading: false });
    } catch (error) {
      set({ candidateLoading: false, error: humanizeError(String(error)) });
    }
  },

  async createKit(request) {
    try {
      const kit = await api.createKit(request);
      toast.success("Kit created");
      await get().fetch();
      // Kits may trigger asset sync which updates hub statuses
      await useHubStore.getState().fetch();
      set((state) => ({
        kits: state.kits.some((existing) => existing.id === kit.id)
          ? state.kits
          : [kit, ...state.kits],
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Failed to create kit: ${msg}`);
      throw e;
    }
  },

  async deleteKit(id) {
    try {
      await api.deleteKit(id);
      toast.success("Kit deleted");
      set((state) => ({
        kits: state.kits.filter((kit) => kit.id !== id),
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Failed to delete kit: ${msg}`);
      throw e;
    }
  },

  async fetchKitAssets(kitId) {
    try {
      return await api.listKitAssets(kitId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Failed to load kit assets: ${msg}`);
      throw e;
    }
  },

  async updateKit(request) {
    try {
      await api.updateKit(request);
      toast.success("Kit updated");
      await get().fetch();
      await useHubStore.getState().fetch();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Failed to update kit: ${msg}`);
      throw e;
    }
  },

  async syncKitToProject(request) {
    try {
      const result = await api.syncKitToProject(request);
      await useExtensionStore.getState().fetch();
      toast.success(`Synced ${result.installed_count} asset(s) to project agent`);
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Failed to sync kit: ${msg}`);
      throw e;
    }
  },

  async previewKitProjectConflicts(request) {
    try {
      return await api.previewKitProjectConflicts(request);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Failed to preview kit conflicts: ${msg}`);
      throw e;
    }
  },

  async unsyncKitFromProject(request) {
    try {
      const result = await api.unsyncKitFromProject(request);
      await useExtensionStore.getState().fetch();
      toast.success(`Removed ${result.installed_count} asset(s) from project agent`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Failed to remove kit: ${msg}`);
      throw e;
    }
  },
}));

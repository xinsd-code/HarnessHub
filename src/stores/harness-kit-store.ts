import { create } from "zustand";
import { humanizeError } from "@/lib/errors";
import { api } from "@/lib/invoke";
import type {
  CreateHarnessKitRequest,
  HarnessKitAssetCandidates,
  HarnessKitAssets,
  HarnessKitSummary,
  UpdateHarnessKitRequest,
} from "@/lib/types";
import { useHubStore } from "@/stores/hub-store";
import { toast } from "@/stores/toast-store";

interface HarnessKitState {
  harnessKits: HarnessKitSummary[];
  candidates: HarnessKitAssetCandidates;
  loading: boolean;
  candidateLoading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  fetchCandidates: () => Promise<void>;
  createHarnessKit: (request: CreateHarnessKitRequest) => Promise<void>;
  updateHarnessKit: (request: UpdateHarnessKitRequest) => Promise<void>;
  deleteHarnessKit: (id: string) => Promise<void>;
  fetchHarnessKitAssets: (id: string) => Promise<HarnessKitAssets>;
}

const emptyCandidates: HarnessKitAssetCandidates = {
  agent_configs: [],
  extension_kits: [],
  skills: [],
  mcps: [],
};

export const useHarnessKitStore = create<HarnessKitState>((set, get) => ({
  harnessKits: [],
  candidates: emptyCandidates,
  loading: false,
  candidateLoading: false,
  error: null,

  async fetch() {
    set({ loading: true, error: null });
    try {
      const harnessKits = await api.listHarnessKits();
      set({ harnessKits, loading: false });
    } catch (error) {
      set({ loading: false, error: humanizeError(String(error)) });
    }
  },

  async fetchCandidates() {
    set({ candidateLoading: true, error: null });
    try {
      const candidates = await api.listHarnessKitAssetCandidates();
      set({ candidates, candidateLoading: false });
    } catch (error) {
      set({ candidateLoading: false, error: humanizeError(String(error)) });
    }
  },

  async createHarnessKit(request) {
    try {
      const harnessKit = await api.createHarnessKit(request);
      toast.success("Harness Kit created");
      await get().fetch();
      await useHubStore.getState().fetch();
      set((state) => ({
        harnessKits: state.harnessKits.some((item) => item.id === harnessKit.id)
          ? state.harnessKits
          : [harnessKit, ...state.harnessKits],
      }));
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to create Harness Kit: ${msg}`);
      throw error;
    }
  },

  async updateHarnessKit(request) {
    try {
      await api.updateHarnessKit(request);
      toast.success("Harness Kit updated");
      await get().fetch();
      await useHubStore.getState().fetch();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to update Harness Kit: ${msg}`);
      throw error;
    }
  },

  async deleteHarnessKit(id) {
    try {
      await api.deleteHarnessKit(id);
      toast.success("Harness Kit deleted");
      set((state) => ({
        harnessKits: state.harnessKits.filter((item) => item.id !== id),
      }));
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to delete Harness Kit: ${msg}`);
      throw error;
    }
  },

  async fetchHarnessKitAssets(id) {
    try {
      return await api.listHarnessKitAssets(id);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to load Harness Kit: ${msg}`);
      throw error;
    }
  },
}));

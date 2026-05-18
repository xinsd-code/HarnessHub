import { create } from "zustand";
import { humanizeError } from "@/lib/errors";
import { api } from "@/lib/invoke";
import type { CreateKitRequest, KitAssetCandidate, KitSummary } from "@/lib/types";
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
  deleteKit: (id: string) => Promise<void>;
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
    const kit = await api.createKit(request);
    toast.success("Kit created");
    await get().fetch();
    await useHubStore.getState().fetch();
    set((state) => ({
      kits: state.kits.some((existing) => existing.id === kit.id)
        ? state.kits
        : [kit, ...state.kits],
    }));
  },

  async deleteKit(id) {
    await api.deleteKit(id);
    toast.success("Kit deleted");
    set((state) => ({
      kits: state.kits.filter((kit) => kit.id !== id),
    }));
  },
}));

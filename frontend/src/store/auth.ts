import { create } from "zustand";
import { api } from "@/lib/api";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  household_id: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  setToken: (token: string) => void;
  fetchMe: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  setToken: (token) => {
    sessionStorage.setItem("token", token);
  },
  fetchMe: async () => {
    try {
      const { data } = await api.get("/auth/me");
      set({ user: data, isLoading: false });
    } catch {
      set({ user: null, isLoading: false });
    }
  },
  logout: () => {
    sessionStorage.removeItem("token");
    set({ user: null });
    window.location.href = "/login";
  },
}));

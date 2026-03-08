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
    localStorage.setItem("token", token);
  },
  fetchMe: async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      set({ user: null, isLoading: false });
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      set({ user: data, isLoading: false });
    } catch {
      set({ user: null, isLoading: false });
    }
  },
  logout: () => {
    localStorage.removeItem("token");
    set({ user: null });
    window.location.href = "/login";
  },
}));

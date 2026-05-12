import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UserState {
  user: {
    id: string;
    name: string;
    email: string;
    role: "solicitante" | "chefia" | "admin" | "superadmin";
    campus: string;
  } | null;
  setUser: (user: UserState["user"]) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      logout: () => set({ user: null }),
    }),
    {
      name: "percata-user-storage",
    },
  ),
);

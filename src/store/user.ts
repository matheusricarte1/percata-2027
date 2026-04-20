import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UserState {
  user: {
    id: string
    name: string
    email: string
    role: 'solicitante' | 'chefia' | 'admin'
    campus: string
  } | null
  setUser: (user: UserState['user']) => void
  logout: () => void
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: {
        id: '9bd01064-ae74-4b53-a7c8-984f933cc509', // Mock ID for prototype
        name: 'Mariana Silva Santos',
        email: 'mariana.santos@uva.br',
        role: 'solicitante',
        campus: 'Petrolina'
      },
      setUser: (user) => set({ user }),
      logout: () => set({ user: null }),
    }),
    {
      name: 'percata-user-storage',
    }
  )
)

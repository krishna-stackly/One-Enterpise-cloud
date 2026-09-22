import { create } from 'zustand'

interface UiState {
  sidebarCollapsed: boolean
  searchOpen: boolean
  toggleSidebar: () => void
  setSearchOpen: (open: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  searchOpen: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
}))

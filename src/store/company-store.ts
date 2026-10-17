import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CompanyState {
  /** The user's currently active company (public data, safe to persist). */
  activeCompanyId: string | null;
  setActiveCompanyId: (id: string | null) => void;
  clearCompanyState: () => void;
}

export const useCompanyStore = create<CompanyState>()(
  persist(
    (set) => ({
      activeCompanyId: null,
      setActiveCompanyId: (activeCompanyId) => set({ activeCompanyId }),
      clearCompanyState: () => set({ activeCompanyId: null }),
    }),
    { name: 'startup-starter-company' },
  ),
);


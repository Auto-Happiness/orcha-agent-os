import { create } from "zustand";
import { persist } from "zustand/middleware";

interface MssqlConfig {
  host: string;
  port: string;
  user: string;
  password?: string;
  database: string;
  instanceName?: string;
  authMode: "SQL Server Auth" | "Mixed Mode" | "AD / OAuth";
  encrypt: boolean;
  trustServerCertificate: boolean;
}

interface MssqlStore {
  config: MssqlConfig;
  updateConfig: (updates: Partial<MssqlConfig>) => void;
  reset: () => void;
}

const initialConfig: MssqlConfig = {
  host: "localhost",
  port: "1433",
  user: "sa",
  password: "",
  database: "Northwind",
  instanceName: "",
  authMode: "SQL Server Auth",
  encrypt: true,
  trustServerCertificate: true,
};

export const useMssqlStore = create<MssqlStore>()(
  persist(
    (set) => ({
      config: initialConfig,
      updateConfig: (updates) => set((state) => ({
        config: { ...state.config, ...updates }
      })),
      reset: () => set({ config: initialConfig }),
    }),
    {
      name: "mssql-config-storage",
    }
  )
);

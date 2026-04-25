import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WizardData {
  // Database Configuration
  dbProvider: string;
  dbConfig: Record<string, any>;
  // Model Configuration
  modelProvider: string;
  modelConfig: Record<string, any>;
  // Final Metadata
  name: string;
  description: string;
  image: string | null;
  tags: string[];
  selectedTables: string[];
  isScanning: boolean;
  modelDefinition: any;
  // Integration IDs
  configId: string | null;
  organizationId: string | null;
  businessContext: string;
  memoryProvider: "openai" | "gemini" | "local" | null;
}

interface CreationWizardStore {
  step: number;
  data: WizardData;
  setStep: (step: number) => void;
  updateData: (updates: Partial<WizardData>) => void;
  reset: () => void;
}

const initialData: WizardData = {
  // Start with NO provider selected so the UI always prompts the user,
  // rather than silently pre-selecting the previous session's provider.
  dbProvider: "mysql",
  dbConfig: {
    host: "",
    port: "",
    user: "",
    password: "",
    database: "",
    ssl: false
  },
  modelProvider: "google",
  modelConfig: {},
  name: "",
  description: "",
  image: null,
  tags: [],
  selectedTables: [],
  isScanning: false,
  modelDefinition: null,
  configId: null,
  organizationId: null,
  businessContext: "",
  memoryProvider: null,
};

export const useCreationWizard = create<CreationWizardStore>()(
  persist(
    (set) => ({
      step: 0,
      data: initialData,
      setStep: (step) => set({ step }),
      updateData: (updates) => set((state) => ({
        data: { ...state.data, ...updates }
      })),
      reset: () => {
        // Hard-reset both in-memory state AND the persisted localStorage entry
        // so that the next wizard open always starts with a clean slate.
        set({ step: 0, data: initialData });
        try {
          localStorage.removeItem("creation-wizard-storage");
        } catch (_) {
          // SSR / environments without localStorage
        }
      },
    }),
    {
      name: "creation-wizard-storage",
    }
  )
);


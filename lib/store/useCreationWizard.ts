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
  // Wren AI Modeling Data
  selectedTables: string[];
  isScanning: boolean;
  modelDefinition: any;
  // Integration IDs
  configId: string | null;
  organizationId: string | null;
  businessContext: string;
}

interface CreationWizardStore {
  step: number;
  data: WizardData;
  setStep: (step: number) => void;
  updateData: (updates: Partial<WizardData>) => void;
  reset: () => void;
}

const initialData: WizardData = {
  dbProvider: "postgres",
  dbConfig: {
    host: "",
    port: "5432",
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
      reset: () => set({ step: 0, data: initialData }),
    }),
    {
      name: "creation-wizard-storage",
    }
  )
);


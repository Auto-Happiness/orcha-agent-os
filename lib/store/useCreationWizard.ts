import { create } from "zustand";

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
  dbConfig: {},
  modelProvider: "google",
  modelConfig: {},
  name: "",
  description: "",
  image: null,
  tags: [],
};

export const useCreationWizard = create<CreationWizardStore>((set) => ({
  step: 0,
  data: initialData,
  setStep: (step) => set({ step }),
  updateData: (updates) => set((state) => ({ 
    data: { ...state.data, ...updates } 
  })),
  reset: () => set({ step: 0, data: initialData }),
}));

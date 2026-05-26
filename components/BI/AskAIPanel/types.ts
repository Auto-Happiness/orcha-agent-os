export interface ProposedWidget {
  id: string;
  type: "bar" | "line" | "pie" | "kpi" | "area" | "table" | "counter";
  title: string;
  reason: string;
  sql: string;
  mapping?: {
    labelKey: string;
    valueKeys: string[];
    formatType?: string;
    formatValue?: string;
    numberFormat?: string;
  };
}

export interface DraftPrompt {
  text: string;
  type: string;
  formatType?: string;
  formatValue?: string;
  numberFormat?: string;
}

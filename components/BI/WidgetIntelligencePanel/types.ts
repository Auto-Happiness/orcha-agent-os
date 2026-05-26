export interface MappingConfig {
  labelKey: string;
  valueKeys: string[];
  seriesColors?: Record<string, string>;
  formatType?: string;
  formatValue?: string;
  numberFormat?: string;
}

export interface WidgetModel {
  _id: string;
  configId?: string;
  queryId?: string;
  type: string;
  title: string;
  description?: string;
  mapping?: MappingConfig;
  status?: string;
}

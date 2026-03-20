export interface MetricResult {
  field: string;
  value: number;
  min: number;
  max: number;
  avg: number;
  count: number;
  lastUpdated: Date;
}

export interface IMetricsStrategy {
  readonly fieldName: string;
  process(reading: Record<string, any>, existing?: MetricResult): MetricResult;
}

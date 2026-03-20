import { Injectable } from '@nestjs/common';
import { IMetricsStrategy, MetricResult } from './metrics.strategy.interface';

@Injectable()
export class TemperatureStrategy implements IMetricsStrategy {
  readonly fieldName = 'temperature';

  process(reading: Record<string, any>, existing?: MetricResult): MetricResult {
    const value = parseFloat(reading.temperature);
    if (isNaN(value)) return existing;

    if (!existing) {
      return {
        field: this.fieldName,
        value,
        min: value,
        max: value,
        avg: value,
        count: 1,
        lastUpdated: new Date(),
      };
    }

    const count = existing.count + 1;
    return {
      field: this.fieldName,
      value,
      min: Math.min(existing.min, value),
      max: Math.max(existing.max, value),
      avg: (existing.avg * existing.count + value) / count,
      count,
      lastUpdated: new Date(),
    };
  }
}

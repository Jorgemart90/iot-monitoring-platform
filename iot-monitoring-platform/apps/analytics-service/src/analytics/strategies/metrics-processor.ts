import { Injectable } from '@nestjs/common';
import { IMetricsStrategy, MetricResult } from './metrics.strategy.interface';
import { TemperatureStrategy } from './temperature.strategy';
import { HumidityStrategy } from './humidity.strategy';
import { PressureStrategy } from './pressure.strategy';

@Injectable()
export class MetricsProcessor {
  private readonly strategies: Map<string, IMetricsStrategy>;

  constructor(
    private readonly temperatureStrategy: TemperatureStrategy,
    private readonly humidityStrategy: HumidityStrategy,
    private readonly pressureStrategy: PressureStrategy,
  ) {
    this.strategies = new Map<string, IMetricsStrategy>([
      ['temperature', this.temperatureStrategy],
      ['humidity', this.humidityStrategy],
      ['pressure', this.pressureStrategy],
    ]);
  }

  processReading(
    reading: Record<string, any>,
    existingMetrics: Map<string, MetricResult>,
  ): Map<string, MetricResult> {
    const updated = new Map(existingMetrics);

    for (const [field, strategy] of this.strategies) {
      if (reading[field] !== undefined && reading[field] !== null) {
        const existing = updated.get(field);
        const result = strategy.process(reading, existing);
        if (result) {
          updated.set(field, result);
        }
      }
    }

    return updated;
  }
}

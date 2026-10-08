import { Component, input, computed } from '@angular/core';
import { TemperatureUnit, fromCelsius } from './temperature';
export interface HistoryPoint {
  timestamp: string;
  temperature: number;
  min: number;
  max: number;
  count: number;
}
export interface SensorSeries {
  id: string;
  name: string;
  zone: string;
  color: string;
  dash: string;
  data: HistoryPoint[];
}
@Component({
  selector: 'p-chart',
  template: ` @if (values().length) {
      <svg
        class="chart"
        viewBox="0 0 760 285"
        role="img"
        [attr.aria-label]="'Temperaturas de ' + series().length + ' sensores en grados ' + unit()"
      >
        @for (n of [0, 1, 2, 3, 4]; track n) {
          <line
            class="grid-line"
            x1="65"
            x2="740"
            [attr.y1]="30 + n * 45"
            [attr.y2]="30 + n * 45"
          />
          <text x="5" [attr.y]="34 + n * 45">{{ label(n) }}°</text>
        }
        @for (sensor of series(); track sensor.id) {
          <polyline
            [attr.data-sensor]="sensor.id"
            [attr.points]="line(sensor)"
            fill="none"
            [attr.stroke]="sensor.color"
            [attr.stroke-dasharray]="sensor.dash"
            stroke-width="2.5"
            stroke-linejoin="round"
          />
          @for (point of sensor.data; track point.timestamp) {
            <circle
              [attr.cx]="x(point.timestamp)"
              [attr.cy]="y(point.temperature)"
              r="3"
              [attr.fill]="sensor.color"
            >
              <title>
                {{ sensor.name }} · {{ time(point.timestamp) }} ·
                {{ format(point.temperature) }} °{{ unit() }} · mín {{ format(point.min) }} / máx
                {{ format(point.max) }} · {{ point.count }} lecturas
              </title>
            </circle>
          }
        }
        @for (n of [0, 1, 2, 3]; track n) {
          <text
            [attr.x]="65 + n * 225"
            y="250"
            [attr.text-anchor]="n === 0 ? 'start' : n === 3 ? 'end' : 'middle'"
          >
            {{ tick(n) }}
          </text>
        }
      </svg>
    } @else {
      <div class="empty chart-empty">
        <span class="empty-symbol">∿</span>
        <h3>Sin lecturas en este intervalo</h3>
        <p>Selecciona sensores, amplía el periodo o envía una lectura.</p>
      </div>
    }
    <div class="series-legend">
      @for (sensor of series(); track sensor.id) {
        <div>
          <svg viewBox="0 0 30 8" aria-hidden="true">
            <line
              x1="0"
              x2="30"
              y1="4"
              y2="4"
              [attr.stroke]="sensor.color"
              [attr.stroke-dasharray]="sensor.dash"
              stroke-width="3"
            /></svg
          ><strong>{{ sensor.name }}</strong
          ><span>{{ sensor.zone }} · {{ count(sensor) }} lecturas</span>
        </div>
      }
    </div>`,
})
export class ChartComponent {
  series = input<SensorSeries[]>([]);
  unit = input<TemperatureUnit>('C');
  from = input('');
  to = input('');
  values = computed(() =>
    this.series().flatMap((s) =>
      s.data.map((p) => fromCelsius(Number(p.temperature), this.unit())),
    ),
  );
  low = computed(() => {
    const values = this.values();
    return values.length
      ? Math.floor(
          Math.min(...values) - Math.max(2, (Math.max(...values) - Math.min(...values)) * 0.1),
        )
      : 0;
  });
  high = computed(() => {
    const values = this.values();
    return values.length
      ? Math.ceil(
          Math.max(...values) + Math.max(2, (Math.max(...values) - Math.min(...values)) * 0.1),
        )
      : 50;
  });
  x(timestamp: string) {
    return (
      65 +
      ((Date.parse(timestamp) - Date.parse(this.from())) /
        (Date.parse(this.to()) - Date.parse(this.from()))) *
        675
    );
  }
  y(value: number) {
    return (
      210 -
      ((fromCelsius(Number(value), this.unit()) - this.low()) / (this.high() - this.low())) * 180
    );
  }
  line(sensor: SensorSeries) {
    return sensor.data.map((p) => `${this.x(p.timestamp)},${this.y(p.temperature)}`).join(' ');
  }
  label(n: number) {
    return Math.round(this.high() - ((this.high() - this.low()) * n) / 4);
  }
  format(value: number) {
    return fromCelsius(Number(value), this.unit()).toLocaleString('es-CO', {
      maximumFractionDigits: 2,
    });
  }
  count(sensor: SensorSeries) {
    return sensor.data.reduce((n, p) => n + p.count, 0);
  }
  time(value: string) {
    return new Date(value).toLocaleString('es-CO');
  }
  tick(n: number) {
    const value = new Date(
      Date.parse(this.from()) + ((Date.parse(this.to()) - Date.parse(this.from())) * n) / 3,
    );
    return value.toLocaleString(
      'es-CO',
      Date.parse(this.to()) - Date.parse(this.from()) > 86400000
        ? { month: 'short', day: 'numeric', hour: '2-digit' }
        : { hour: '2-digit', minute: '2-digit' },
    );
  }
}

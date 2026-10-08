import {
  Component,
  inject,
  signal,
  computed,
  effect,
  untracked,
  input,
  DestroyRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PlatformService } from './platform.service';
import { TimeRangeComponent, TimeWindow, timeBounds } from './time-range.component';
import { Alert } from './models';
@Component({
  selector: 'p-alert-browser',
  imports: [FormsModule, TimeRangeComponent],
  templateUrl: './alert-browser.component.html',
})
export class AlertBrowserComponent {
  s = inject(PlatformService);
  compact = input(false);
  range = signal<TimeWindow>({ hours: 24 });
  zone = signal('');
  device = signal('');
  severity = signal('');
  status = signal('');
  kind = signal('');
  groupBy = signal('none');
  page = signal(1);
  total = signal(0);
  pages = signal(0);
  items = signal<Alert[]>([]);
  error = signal('');
  loading = signal(false);
  working = signal(false);
  private generation = 0;
  zones = computed(() =>
    [...new Set(this.s.data().devices.map((d) => d.location?.trim() || 'Sin zona'))].sort(),
  );
  devices = computed(() =>
    this.s
      .data()
      .devices.filter((d) => !this.zone() || (d.location?.trim() || 'Sin zona') === this.zone()),
  );
  groups = computed(() => {
    const groups = new Map<string, Alert[]>();
    for (const a of this.items()) {
      const key =
        this.groupBy() === 'device'
          ? a.deviceId
          : this.groupBy() === 'type'
            ? this.label(a.rule?.metricField || 'Alarma')
            : this.groupBy() === 'zone'
              ? this.zoneName(a.deviceId)
              : 'Alertas';
      groups.set(key, [...(groups.get(key) || []), a]);
    }
    return [...groups].map(([key, items]) => ({
      key,
      name: this.groupBy() === 'device' ? this.deviceName(key) : key,
      items,
    }));
  });
  constructor() {
    inject(DestroyRef).onDestroy(() => this.generation++);
    effect(() => {
      this.s.data();
      const range = this.range(),
        zone = this.zone(),
        deviceId = this.device(),
        severity = this.severity(),
        status = this.status(),
        metricField = this.kind(),
        page = this.page(),
        limit = this.compact() ? 5 : 50;
      untracked(
        () =>
          void this.fetch(range, { zone, deviceId, severity, status, metricField }, page, limit),
      );
    });
  }
  change() {
    this.page.set(1);
  }
  changeZone(value: string) {
    this.zone.set(value);
    this.device.set('');
    this.change();
  }
  date(value: string) {
    return new Date(value).toLocaleString('es-CO');
  }
  deviceName(id: string) {
    return this.s.data().devices.find((d) => d.id === id)?.name || id;
  }
  zoneName(id: string) {
    return (
      this.s
        .data()
        .devices.find((d) => d.id === id)
        ?.location?.trim() || 'Sin zona'
    );
  }
  label(value: string) {
    return (
      (
        {
          temperature: 'Temperatura',
          humidity: 'Humedad',
          pressure: 'Presión',
          TRIGGERED: 'Pendiente',
          ACKNOWLEDGED: 'Reconocida',
          RESOLVED: 'Resuelta',
          HIGH: 'Alta',
          MEDIUM: 'Media',
          LOW: 'Baja',
          CRITICAL: 'Crítica',
        } as Record<string, string>
      )[value] || value
    );
  }
  message(a: Alert) {
    const text = a.message || '';
    // Usar los valores guardados, no los umbrales actuales de una regla editada.
    if (text === a.rule?.customMessage) return text;
    const match =
      /^Rule "[\s\S]*" triggered: (temperature|humidity|pressure) = (-?\d+(?:\.\d+)?) \(condition: (GREATER_THAN|LESS_THAN|EQUALS|BETWEEN|OUTSIDE_RANGE) (-?\d+(?:\.\d+)?)(?:-(-?\d+(?:\.\d+)?))?\)$/.exec(
        text,
      );
    if (!match) return text;
    const [, metric, value, condition, lower, upper] = match;
    const unit = metric === 'temperature' ? ' °C' : metric === 'humidity' ? ' %' : ' hPa';
    const format = (n: string) =>
      Number(n).toLocaleString('es-CO', { maximumFractionDigits: 2 }) + unit;
    const comparison: Record<string, string> = {
      GREATER_THAN: 'Supera el umbral de ' + format(lower),
      LESS_THAN: 'Está por debajo del umbral de ' + format(lower),
      EQUALS: 'Es igual al umbral de ' + format(lower),
      BETWEEN: 'Está dentro del rango de ' + format(lower) + ' a ' + format(upper),
      OUTSIDE_RANGE: 'Está fuera del rango de ' + format(lower) + ' a ' + format(upper),
    };
    if (['BETWEEN', 'OUTSIDE_RANGE'].includes(condition) && upper === undefined) return text;
    return this.label(metric) + ': ' + format(value) + '. ' + comparison[condition] + '.';
  }
  reading(a: Alert) {
    return a.rule?.metricField === 'temperature'
      ? `${this.s.formatTemperature(a.triggeredValue)} °${this.s.unit()}`
      : `${a.triggeredValue} ${a.rule?.metricField === 'humidity' ? '%' : a.rule?.metricField === 'pressure' ? 'hPa' : ''}`;
  }
  async fetch(range: TimeWindow, filters: Record<string, string>, page: number, limit: number) {
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set('');
    const params = new URLSearchParams({
      ...timeBounds(range),
      page: String(page),
      limit: String(limit),
    });
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, key === 'zone' && value === 'Sin zona' ? '__none__' : value);
    }
    try {
      const result = await this.s.request<{
        data: Alert[];
        meta: { total: number; totalPages: number };
      }>(`alerts?${params}`);
      if (generation === this.generation) {
        this.items.set(result.data);
        this.total.set(result.meta.total);
        this.pages.set(result.meta.totalPages);
      }
    } catch (e) {
      if (generation === this.generation) {
        this.items.set([]);
        this.error.set(this.s.message(e));
      }
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
  async act(alert: Alert) {
    this.working.set(true);
    try {
      await this.s.request(
        `alerts/${alert.id}/${alert.status === 'TRIGGERED' ? 'acknowledge' : 'resolve'}`,
        'PATCH',
        {},
      );
      await this.s.load();
    } catch (e) {
      this.error.set(this.s.message(e));
    } finally {
      this.working.set(false);
    }
  }
}

import { Component, inject, signal, computed, effect, untracked, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PlatformService } from './platform.service';
import { ChartComponent, SensorSeries, HistoryPoint } from './chart.component';
import { TimeRangeComponent, TimeWindow, timeBounds } from './time-range.component';
const colors = ['#db6a32', '#3073b7', '#7f55b3', '#24806c', '#b8436b', '#967020'];
@Component({
  selector: 'p-sensor-history',
  imports: [FormsModule, ChartComponent, TimeRangeComponent],
  templateUrl: './sensor-history.component.html',
})
export class SensorHistoryComponent {
  s = inject(PlatformService);
  range = signal<TimeWindow>({ hours: 1 });
  zone = signal('');
  selection = signal<string[] | null>(null);
  series = signal<SensorSeries[]>([]);
  loading = signal(false);
  error = signal('');
  from = signal('');
  to = signal('');
  private generation = 0;
  private destroyed = false;
  zones = computed(() =>
    [...new Set(this.s.data().devices.map((d) => d.location?.trim() || 'Sin zona'))].sort(),
  );
  chosen = computed(
    () =>
      this.selection() ??
      this.s
        .data()
        .devices.slice(0, 3)
        .map((d) => d.id),
  );
  devices = computed(() =>
    this.s
      .data()
      .devices.filter((d) => !this.zone() || (d.location?.trim() || 'Sin zona') === this.zone()),
  );
  groups = computed(() =>
    this.zones()
      .filter((z) => !this.zone() || z === this.zone())
      .map((zone) => ({
        zone,
        devices: this.devices().filter((d) => (d.location?.trim() || 'Sin zona') === zone),
      })),
  );
  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.generation++;
    });
    effect(() => {
      const devices = this.devices().filter((d) => this.chosen().includes(d.id));
      const range = this.range();
      untracked(() => void this.fetch(devices, range));
    });
  }
  toggle(id: string, checked: boolean) {
    this.selection.set(checked ? [...this.chosen(), id] : this.chosen().filter((d) => d !== id));
  }
  selectZone() {
    this.selection.set(this.devices().map((d) => d.id));
  }
  async fetch(devices: ReturnType<SensorHistoryComponent['devices']>, range: TimeWindow) {
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set('');
    const bounds = timeBounds(range);
    try {
      const series = await Promise.all(
        devices.map(async (device) => {
          const q = new URLSearchParams({ ...bounds, points: '240' });
          const result = await this.s.request<{ data: HistoryPoint[] }>(
            `analytics/devices/${device.id}/history?${q}`,
          );
          const index = this.s.data().devices.findIndex((d) => d.id === device.id);
          return {
            id: device.id,
            name: device.name,
            zone: device.location?.trim() || 'Sin zona',
            color: colors[index % colors.length],
            dash: index < colors.length ? '' : index % 2 ? '6 4' : '2 3',
            data: result.data,
          };
        }),
      );
      if (generation === this.generation && !this.destroyed) {
        this.series.set(series);
        this.from.set(bounds.from);
        this.to.set(bounds.to);
      }
    } catch (e) {
      if (generation === this.generation) {
        this.series.set([]);
        this.error.set(this.s.message(e));
      }
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
}

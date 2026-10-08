import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
export interface TimeWindow {
  hours: number;
  from?: string;
  to?: string;
}
export function timeBounds(window: TimeWindow) {
  const end = window.to ? Date.parse(window.to) : Date.now();
  return {
    from: window.from || new Date(end - window.hours * 3600000).toISOString(),
    to: new Date(end).toISOString(),
  };
}
@Component({
  selector: 'p-time-range',
  imports: [FormsModule],
  template: ` <div class="time-controls" role="group" aria-label="Intervalo de tiempo">
      <label
        >Periodo<select
          aria-label="Periodo"
          [ngModel]="value().from || ![1, 24, 168, 720].includes(value().hours) ? 0 : value().hours"
          (ngModelChange)="preset(+$event)"
        >
          <option [ngValue]="1">Última hora</option>
          <option [ngValue]="24">Último día</option>
          <option [ngValue]="168">Última semana</option>
          <option [ngValue]="720">Últimos 30 días</option>
          <option [ngValue]="0" disabled>Personalizado</option>
        </select></label
      >
      <div class="time-actions">
        <button class="button secondary" (click)="shift(-1)" aria-label="Periodo anterior">←</button
        ><button class="button secondary" (click)="shift(1)" aria-label="Periodo siguiente">
          →</button
        ><button
          class="button secondary"
          (click)="zoom(0.5)"
          [disabled]="value().hours <= 1 / 12"
          aria-label="Acercar gráfica"
        >
          ＋</button
        ><button
          class="button secondary"
          (click)="zoom(2)"
          [disabled]="value().hours >= 8784"
          aria-label="Alejar gráfica"
        >
          −</button
        ><button class="text-button" (click)="preset(1)">Ahora</button>
      </div>
      <button class="text-button" (click)="custom.set(!custom())">Elegir fechas</button>
    </div>
    @if (custom()) {
      <form class="custom-range" (ngSubmit)="apply()">
        <label
          >Desde<input
            aria-label="Desde"
            name="from"
            type="datetime-local"
            [(ngModel)]="from"
            required /></label
        ><label
          >Hasta<input
            aria-label="Hasta"
            name="to"
            type="datetime-local"
            [(ngModel)]="to"
            required /></label
        ><button class="button secondary" type="submit">Aplicar fechas</button>
      </form>
    }
    @if (error()) {
      <p class="form-error" role="alert">{{ error() }}</p>
    }
    <p class="range-caption">{{ caption() }} · hora local</p>`,
})
export class TimeRangeComponent {
  value = input<TimeWindow>({ hours: 1 });
  changed = output<TimeWindow>();
  custom = signal(false);
  error = signal('');
  local(d: Date) {
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  from = this.local(new Date(Date.now() - 86400000));
  to = this.local(new Date());
  caption() {
    const b = timeBounds(this.value());
    return (
      new Date(b.from).toLocaleString('es-CO') + ' — ' + new Date(b.to).toLocaleString('es-CO')
    );
  }
  preset(hours: number) {
    this.error.set('');
    this.changed.emit({ hours });
  }
  shift(direction: number) {
    const b = timeBounds(this.value()),
      delta = this.value().hours * 3600000 * direction;
    this.changed.emit({
      hours: this.value().hours,
      from: new Date(Date.parse(b.from) + delta).toISOString(),
      to: new Date(Date.parse(b.to) + delta).toISOString(),
    });
  }
  zoom(factor: number) {
    const hours = Math.min(8784, Math.max(1 / 12, this.value().hours * factor));
    if (!this.value().from) {
      this.preset(hours);
      return;
    }
    const b = timeBounds(this.value()),
      center = (Date.parse(b.from) + Date.parse(b.to)) / 2;
    this.changed.emit({
      hours,
      from: new Date(center - hours * 1800000).toISOString(),
      to: new Date(center + hours * 1800000).toISOString(),
    });
  }
  apply() {
    const start = new Date(this.from).getTime(),
      end = new Date(this.to).getTime();
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      end <= start ||
      end - start > 366 * 86400000
    ) {
      this.error.set('Elige un inicio anterior al fin y un intervalo de hasta 366 días.');
      return;
    }
    this.error.set('');
    this.changed.emit({
      hours: (end - start) / 3600000,
      from: new Date(start).toISOString(),
      to: new Date(end).toISOString(),
    });
  }
}

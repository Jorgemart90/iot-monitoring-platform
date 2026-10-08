import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PlatformService } from './platform.service';
import { IconComponent } from './icon.component';
import { fromCelsius, toCelsius, validTemperature } from './temperature';
@Component({
  selector: 'p-simulator',
  imports: [FormsModule, IconComponent],
  template: ` <article class="panel simulator">
    <div class="panel-heading">
      <div>
        <span class="eyebrow">PRUÉBALO EN VIVO</span>
        <h2>Un cambio. Una señal.</h2>
      </div>
      <p-icon name="pulse" />
    </div>
    <p>Elige una métrica, escribe su valor y envíalo al sensor.</p>
    <form class="reading-form" (ngSubmit)="send()" novalidate>
      <label
        >Sensor de destino<select
          aria-label="Sensor de destino"
          [ngModel]="s.selected()"
          (ngModelChange)="s.select($event)"
          name="device"
        >
          @for (d of s.data().devices; track d.id) {
            <option [value]="d.id">{{ d.name }} · {{ d.location || 'Sin zona' }}</option>
          } @empty {
            <option value="">Sin sensores</option>
          }
        </select></label
      >
      <label
        >Métrica a enviar<select
          name="metric"
          aria-label="Métrica a enviar"
          [ngModel]="metric()"
          (ngModelChange)="setMetric($event)"
        >
          <option value="temperature">Temperatura</option>
          <option value="humidity">Humedad</option>
          <option value="pressure">Presión</option>
        </select></label
      >
      @if (metric() === 'temperature') {
        <label
          >Unidad<select
            aria-label="Unidad de temperatura"
            [ngModel]="s.unit()"
            (ngModelChange)="s.unit.set($event)"
            name="unit"
          >
            <option value="C">Celsius / centígrados (°C)</option>
            <option value="F">Fahrenheit (°F)</option>
          </select></label
        >
      }
      <label
        >{{ metricLabel() }} ({{ unitLabel() }})<input
          [attr.aria-label]="metricLabel() + ' a enviar'"
          name="temperature"
          type="number"
          [ngModel]="display()"
          (ngModelChange)="change($event)"
          [min]="minimum()"
          [max]="maximum()"
          step="0.01"
          required
          aria-describedby="temperature-help temperature-error"
      /></label>
      <p id="temperature-help" class="fine-print">
        Entre {{ minimum() }} y {{ maximum() }} {{ unitLabel() }}. Hasta dos decimales.
      </p>
      <p id="temperature-error" class="form-error" role="alert">
        {{
          error() ||
            (edited() && !valid() ? 'Introduce un número dentro del intervalo permitido.' : '')
        }}
      </p>
      <button
        class="button primary full"
        type="submit"
        [disabled]="!valid() || !s.selected() || sending()"
      >
        {{ sending() ? 'Enviando…' : 'Enviar lectura personalizada' }} <p-icon name="arrow" />
      </button>
    </form>
    <div class="sim-buttons">
      <button
        class="button secondary"
        (click)="preset(normal())"
        [disabled]="!s.selected() || sending()"
      >
        Enviar {{ presetLabel(normal()) }}</button
      ><button
        class="button secondary"
        (click)="preset(high())"
        [disabled]="!s.selected() || sending()"
      >
        Enviar {{ presetLabel(high()) }}
      </button>
    </div>
    <button class="text-button full" (click)="s.toggleSimulation()" [disabled]="!s.selected()">
      <p-icon [name]="s.simulating() ? 'close' : 'play'" />{{
        s.simulating() ? 'Detener simulación' : 'Iniciar lecturas continuas'
      }}
    </button>
    <p class="fine-print">
      {{
        s.simulating()
          ? 'La simulación automática envía temperatura, humedad y presión cada 5 segundos.'
          : 'Las lecturas son simuladas. El procesamiento y las alertas son reales.'
      }}
    </p>
  </article>`,
})
export class SimulatorComponent {
  s = inject(PlatformService);
  metric = signal<'temperature' | 'humidity' | 'pressure'>('temperature');
  otherValue = signal<number | null>(55);
  metricLabel = computed(
    () => ({ temperature: 'Temperatura', humidity: 'Humedad', pressure: 'Presión' })[this.metric()],
  );
  unitLabel = computed(() =>
    this.metric() === 'temperature'
      ? '°' + this.s.unit()
      : this.metric() === 'humidity'
        ? '%'
        : 'hPa',
  );
  normal = computed(() =>
    this.metric() === 'temperature' ? 28 : this.metric() === 'humidity' ? 55 : 1013,
  );
  high = computed(() =>
    this.metric() === 'temperature' ? 42 : this.metric() === 'humidity' ? 85 : 1080,
  );
  setMetric(metric: 'temperature' | 'humidity' | 'pressure') {
    this.metric.set(metric);
    this.otherValue.set(this.normal());
    this.edited.set(false);
    this.error.set('');
  }
  presetLabel(value: number) {
    return (
      (this.metric() === 'temperature' ? this.s.formatTemperature(value) : String(value)) +
      ' ' +
      this.unitLabel()
    );
  }

  celsius = signal<number | null>(28);
  edited = signal(false);
  error = signal('');
  sending = signal(false);
  display = computed(() =>
    this.metric() !== 'temperature'
      ? this.otherValue()
      : this.celsius() === null
        ? null
        : Number(fromCelsius(this.celsius()!, this.s.unit()).toFixed(2)),
  );
  minimum = computed(() =>
    this.metric() !== 'temperature' ? 0 : this.s.unit() === 'C' ? -273.15 : -459.67,
  );
  maximum = computed(() =>
    this.metric() === 'humidity'
      ? 100
      : this.metric() === 'pressure'
        ? 2000
        : this.s.unit() === 'C'
          ? 500
          : 932,
  );
  valid = computed(() =>
    this.metric() === 'temperature'
      ? validTemperature(this.celsius())
      : this.otherValue() != null &&
        Number.isFinite(this.otherValue()) &&
        this.otherValue()! >= 0 &&
        this.otherValue()! <= this.maximum(),
  );
  change(value: unknown) {
    this.edited.set(true);
    this.error.set('');
    if (this.metric() !== 'temperature') {
      this.otherValue.set(typeof value === 'number' && Number.isFinite(value) ? value : null);
      return;
    }
    this.celsius.set(
      typeof value === 'number' && Number.isFinite(value)
        ? Math.round(toCelsius(value, this.s.unit()) * 1e8) / 1e8
        : null,
    );
  }
  async send() {
    this.edited.set(true);
    if (!this.valid() || this.sending()) return;
    this.sending.set(true);
    this.error.set('');
    try {
      await this.s.sendMetrics({
        [this.metric()]: this.metric() === 'temperature' ? this.celsius()! : this.otherValue()!,
      });
    } catch (e) {
      this.error.set(this.s.message(e));
    } finally {
      this.sending.set(false);
    }
  }
  preset(value: number) {
    if (this.metric() === 'temperature') this.celsius.set(value);
    else this.otherValue.set(value);
    void this.send();
  }
}

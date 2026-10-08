import { TemperatureUnit, fromCelsius, validTemperature } from './temperature';
import { Injectable, signal, computed } from '@angular/core';
import { AuthResult, Data, User } from './models';
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
const emptyData = (): Data => ({
  devices: [],
  alertSummary: { total: 0, bySeverity: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 } },
  rules: [],
  alerts: [],
  sessions: [],
  users: [],
  metrics: {},
  readings: [],
});
@Injectable({ providedIn: 'root' })
export class PlatformService {
  unit = signal<TemperatureUnit>('C');
  formatTemperature(value: unknown) {
    return value == null
      ? '—'
      : fromCelsius(Number(value), this.unit()).toLocaleString('es-CO', {
          maximumFractionDigits: 2,
        });
  }
  user = signal<User | null>(null);
  data = signal<Data>(emptyData());
  selected = signal('');
  connected = signal(false);
  busy = signal(false);
  error = signal('');
  notice = signal('');
  ready = signal(false);
  simulating = signal(false);
  private token = '';
  private refreshTask?: Promise<void>;
  private refreshTimer?: ReturnType<typeof setTimeout>;
  private pollTimer?: ReturnType<typeof setInterval>;
  private noticeTimer?: ReturnType<typeof setTimeout>;
  private simulationTimer?: ReturnType<typeof setTimeout>;
  private stream?: AbortController;
  private streamVersion = 0;
  private loading = false;
  async init() {
    try {
      await this.renew();
      await this.start();
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401))
        this.error.set('No pudimos conectar con la plataforma. Intenta iniciar sesión de nuevo.');
    } finally {
      this.ready.set(true);
    }
  }
  notify(message: string) {
    this.notice.set(message);
    clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => this.notice.set(''), 6000);
  }
  private async result<T>(r: Response): Promise<T> {
    if (r.status === 204) return null as T;
    let body;
    try {
      body = await r.json();
    } catch {
      throw new ApiError('Respuesta no válida del servicio.', r.status);
    }
    const message = body.message?.message ?? body.message;
    if (!r.ok)
      throw new ApiError(
        Array.isArray(message)
          ? message.join('. ')
          : typeof message === 'string'
            ? message
            : 'No pudimos completar la solicitud.',
        r.status,
      );
    return body;
  }
  async request<T = unknown>(
    path: string,
    method = 'GET',
    body?: unknown,
    retry = true,
  ): Promise<T> {
    const token = this.token;
    const response = await fetch(path.startsWith('/api/') ? path : `/api/v1/${path}`, {
      method,
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 401 && token && retry) {
      try {
        if (token === this.token) await this.renew();
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          this.clear();
          this.notify('Tu sesión terminó. Inicia sesión o crea otra demo.');
        }
        throw e;
      }
      return this.request<T>(path, method, body, false);
    }
    return this.result<T>(response);
  }
  private accept(auth: AuthResult) {
    this.token = auth.access_token;
    this.user.set(auth.user);
    clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(
      () =>
        this.renew().catch((e) => {
          if (e instanceof ApiError && e.status === 401) this.clear();
        }),
      Math.max(10000, (auth.expires_in - 60) * 1000),
    );
  }
  private renew() {
    if (!this.refreshTask)
      this.refreshTask = (async () => {
        const response = await fetch('/api/v1/auth/refresh', {
          method: 'POST',
          credentials: 'same-origin',
          signal: AbortSignal.timeout(12000),
        });
        this.accept(await this.result<AuthResult>(response));
      })().finally(() => (this.refreshTask = undefined));
    return this.refreshTask;
  }
  async login(master: boolean, username = '', password = '') {
    this.busy.set(true);
    this.error.set('');
    try {
      this.accept(
        await this.request<AuthResult>(
          master ? 'auth/login' : 'auth/demo',
          'POST',
          master ? { username, password } : {},
        ),
      );
      await this.start();
    } catch (e) {
      this.error.set(this.message(e));
    } finally {
      this.busy.set(false);
    }
  }
  async logout() {
    try {
      await this.request('auth/logout', 'POST');
      this.clear();
    } catch (e) {
      this.notify(this.message(e));
    }
  }
  private async start() {
    await this.load();
    clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => this.load(), 5000);
    void this.connectStream();
  }
  clear() {
    this.revision++;
    this.guideError.set('');
    this.stopSimulation();
    clearInterval(this.pollTimer);
    clearTimeout(this.refreshTimer);
    this.streamVersion++;
    this.stream?.abort();
    this.user.set(null);
    this.token = '';
    this.connected.set(false);
    this.data.set(emptyData());
    this.selected.set('');
    this.error.set('');
  }
  async all<T>(path: string): Promise<T[]> {
    const data: T[] = [];
    for (let page = 1; page <= 100; page++) {
      const r = await this.request<{ data: T[]; meta: { totalPages: number } }>(
        `${path}${path.includes('?') ? '&' : '?'}page=${page}&limit=100`,
      );
      data.push(...r.data);
      if (page >= r.meta.totalPages) break;
    }
    return data;
  }
  async load() {
    if (!this.user() || this.loading || this.guideBusy()) return;
    this.loading = true;
    const identity = this.user()?.id;
    const revision = this.revision;
    try {
      const [devices, rules, alerts, sessions, alertSummary] = await Promise.all([
        this.all<Data['devices'][number]>('devices'),
        this.all<Data['rules'][number]>('rules'),
        this.all<Data['alerts'][number]>('alerts'),
        this.request<Data['sessions']>('auth/sessions'),
        this.request<Data['alertSummary']>('alerts/summary'),
      ]);
      if (identity !== this.user()?.id) return;
      if (!devices.some((d) => d.id === this.selected())) this.selected.set(devices[0]?.id || '');
      let metrics: Data['metrics'] = {},
        readings: Data['readings'] = [];
      const selected = this.selected();
      if (selected) {
        const result = await Promise.all([
          this.request<Data['metrics']>(`analytics/devices/${selected}/metrics`),
          this.request<{ data: Data['readings'] }>(
            `analytics/devices/${selected}/readings?limit=30`,
          ),
        ]);
        metrics = result[0];
        readings = result[1].data;
      }
      const users = this.user()?.role === 'MASTER' ? await this.all<User>('users') : [];
      if (
        identity === this.user()?.id &&
        selected === this.selected() &&
        revision === this.revision
      )
        this.data.set({ devices, rules, alerts, sessions, metrics, readings, users, alertSummary });
      this.error.set('');
    } catch (e) {
      if (this.user()) this.error.set(this.message(e));
    } finally {
      this.loading = false;
    }
  }
  select(id: string) {
    this.stopSimulation();
    this.selected.set(id);
    this.data.update((d) => ({ ...d, metrics: {}, readings: [] }));
    void this.load();
  }
  message(e: unknown) {
    return e instanceof Error ? e.message : 'Ocurrió un error. Intenta de nuevo.';
  }
  async sendMetrics(
    values: Partial<Record<'temperature' | 'humidity' | 'pressure', number>>,
    quiet = false,
  ) {
    const limits = { temperature: [-273.15, 500], humidity: [0, 100], pressure: [0, 2000] };
    if (
      !Object.keys(values).length ||
      Object.entries(values).some(
        ([field, value]) =>
          !limits[field as keyof typeof limits] ||
          !Number.isFinite(value) ||
          value < limits[field as keyof typeof limits][0] ||
          value > limits[field as keyof typeof limits][1],
      )
    )
      throw new Error('Introduce una lectura dentro del intervalo permitido.');
    if (!this.selected()) throw new Error('Selecciona un sensor.');
    await this.request('/api/demo/reading', 'POST', { deviceId: this.selected(), ...values });
    if (!quiet) this.notify('Lectura enviada. Esperando su procesamiento…');
    setTimeout(() => this.load(), 1200);
  }
  async sendReading(temperature: number, quiet = false) {
    if (!validTemperature(temperature))
      throw new Error('La temperatura debe estar entre −273,15 y 500 °C.');
    if (!this.selected()) throw new Error('Selecciona un sensor.');
    await this.request('/api/demo/reading', 'POST', { deviceId: this.selected(), temperature });
    if (!quiet) this.notify(`Lectura de ${temperature} °C enviada. Esperando su procesamiento…`);
    setTimeout(() => this.load(), 1200);
  }
  toggleSimulation() {
    if (this.simulating()) {
      this.stopSimulation();
      return;
    }
    this.simulating.set(true);
    const tick = async () => {
      if (!this.simulating() || !this.user()) return;
      try {
        await this.sendMetrics(
          {
            temperature: 26 + Math.round(Math.random() * 5),
            humidity: 50 + Math.round(Math.random() * 10),
            pressure: 1005 + Math.round(Math.random() * 15),
          },
          true,
        );
      } catch (e) {
        this.stopSimulation();
        this.notify(this.message(e));
      }
      if (this.simulating()) this.simulationTimer = setTimeout(tick, 5000);
    };
    void tick();
  }
  stopSimulation() {
    this.simulating.set(false);
    clearTimeout(this.simulationTimer);
  }
  guideBusy = signal(false);
  guideWaiting = signal(false);
  guideError = signal('');
  private revision = 0;
  guideDevice = computed(() =>
    this.data().devices.find(
      (d) => d.metadata?.['guidedDemo'] === true && d.ownerId === this.user()?.id,
    ),
  );
  guideDefinitions = [
    {
      name: 'Temperatura alta · Recorrido',
      metricField: 'temperature',
      threshold: 35,
      severity: 'HIGH',
      color: '#db6a32',
    },
    {
      name: 'Humedad alta · Recorrido',
      metricField: 'humidity',
      threshold: 70,
      severity: 'MEDIUM',
      color: '#3073b7',
    },
    {
      name: 'Presión alta · Recorrido',
      metricField: 'pressure',
      threshold: 1050,
      severity: 'CRITICAL',
      color: '#7f55b3',
    },
  ];
  guideRules = computed(() =>
    this.guideDefinitions.map((def) =>
      this.data().rules.find(
        (r) =>
          r.deviceId === this.guideDevice()?.id &&
          r.ownerId === this.user()?.id &&
          r.name === def.name,
      ),
    ),
  );
  guideRule = computed(() => this.guideRules()[0]);
  guideAlert = computed(() =>
    this.data().alerts.find(
      (a) => a.deviceId === this.guideDevice()?.id && a.ruleId === this.guideRule()?.id,
    ),
  );
  guideStep = computed(() => {
    if (!this.guideDevice()) return 1;
    if (
      !this.guideDefinitions.every((def, index) => {
        const rule = this.guideRules()[index];
        return (
          rule?.isActive &&
          rule.metricField === def.metricField &&
          rule.condition === 'GREATER_THAN' &&
          Number(rule.threshold) === def.threshold &&
          rule.zone == null &&
          rule.deviceIds == null
        );
      })
    )
      return 2;
    return this.guideRules().every((rule) =>
      this.data().alerts.some(
        (a) => a.ruleId === rule!.id && a.deviceId === this.guideDevice()?.id,
      ),
    )
      ? 4
      : 3;
  });
  async prepare() {
    if (this.guideBusy() || !this.user()) return;
    const step = this.guideStep();
    if (step === 4) return;
    const identity = this.user()!.id;
    this.revision++;
    this.guideBusy.set(true);
    this.guideError.set('');
    try {
      if (step === 1) {
        const device = await this.request<Data['devices'][number]>('devices', 'POST', {
          name: 'Sensor del invernadero',
          type: 'MULTI_SENSOR',
          location: 'Invernadero · Zona A',
          metadata: { guidedDemo: true },
        });
        if (this.user()?.id !== identity) return;
        this.data.update((d) => ({ ...d, devices: [...d.devices, device] }));
        this.selected.set(device.id);
        return;
      }
      const device = this.guideDevice()!;
      this.stopSimulation();
      this.selected.set(device.id);
      if (step === 2) {
        const missing = this.guideRules().filter((rule) => !rule).length;
        if (this.user()?.role === 'DEMO' && this.data().rules.length + missing > 3)
          throw new Error(
            'El recorrido necesita tres reglas. Libera ' +
              (this.data().rules.length + missing - 3) +
              ' plaza(s) eliminando reglas ajenas al recorrido y reintenta.',
          );
        for (const [index, definition] of this.guideDefinitions.entries()) {
          const existing = this.guideRules()[index];
          const body = {
            ...definition,
            deviceId: device.id,
            deviceIds: null,
            zone: null,
            condition: 'GREATER_THAN',
            isActive: true,
          };
          const rule = await this.request<Data['rules'][number]>(
            existing ? 'rules/' + existing.id : 'rules',
            existing ? 'PATCH' : 'POST',
            body,
          );
          if (this.user()?.id !== identity) return;
          this.data.update((d) => ({
            ...d,
            rules: [...d.rules.filter((r) => r.id !== rule.id), rule],
          }));
        }
        return;
      }
      const ruleIds = this.guideRules().map((rule) => rule!.id);
      await this.request('/api/demo/reading', 'POST', {
        deviceId: device.id,
        temperature: 42,
        humidity: 85,
        pressure: 1080,
      });
      this.guideWaiting.set(true);
      const deadline = Date.now() + 30000;
      while (Date.now() < deadline && this.user()?.id === identity) {
        const alerts = await this.all<Data['alerts'][number]>('alerts');
        if (this.user()?.id !== identity) return;
        this.data.update((d) => ({ ...d, alerts }));
        if (
          ruleIds.every((id) => alerts.some((a) => a.ruleId === id && a.deviceId === device.id))
        ) {
          this.notify(
            'Recorrido completado: temperatura, humedad y presión generaron sus tres alertas.',
          );
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      if (this.user()?.id === identity)
        throw new Error(
          'La lectura se envió, pero aún no recibimos las tres alertas. Comprueba la conexión y reintenta el paso 3.',
        );
    } catch (error) {
      if (this.user()?.id === identity) this.guideError.set(this.message(error));
    } finally {
      this.guideWaiting.set(false);
      this.guideBusy.set(false);
    }
  }
  sessionId() {
    try {
      return JSON.parse(atob(this.token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/')))
        .sid as string;
    } catch {
      return '';
    }
  }
  private async connectStream() {
    const version = ++this.streamVersion;
    this.stream?.abort();
    while (this.user() && version === this.streamVersion) {
      const controller = new AbortController();
      this.stream = controller;
      const timer = setTimeout(() => controller.abort(), 55000);
      try {
        const response = await fetch('/api/v1/notifications/stream', {
          headers: { Authorization: `Bearer ${this.token}` },
          signal: controller.signal,
        });
        if (response.status === 401) {
          await this.request('auth/me');
          continue;
        }
        if (!response.ok || !response.body) throw new Error('Stream unavailable');
        this.connected.set(true);
        const reader = response.body.getReader(),
          decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          buffer = buffer.replaceAll('\r\n', '\n');
          let end;
          while ((end = buffer.indexOf('\n\n')) >= 0) {
            const frame = buffer.slice(0, end);
            buffer = buffer.slice(end + 2);
            if (frame.includes('event: alert')) {
              this.notify('Nueva alerta: una lectura necesita tu atención.');
              void this.load();
            }
          }
        }
      } catch {
      } finally {
        clearTimeout(timer);
        if (version === this.streamVersion) this.connected.set(false);
      }
      if (!this.user() || version !== this.streamVersion) break;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

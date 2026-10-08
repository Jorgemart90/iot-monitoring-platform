import { Component, inject, signal, viewChild, ElementRef } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { PlatformService } from './platform.service';
import { IconComponent } from './icon.component';
import { SensorHistoryComponent } from './sensor-history.component';
import { SimulatorComponent } from './simulator.component';
import { AlertBrowserComponent } from './alert-browser.component';
import { LoginComponent } from './login.component';
import { Device, Rule, Alert, User } from './models';
type Tab = 'overview' | 'devices' | 'rules' | 'alerts' | 'sessions' | 'users';
@Component({
  selector: 'app-root',
  imports: [
    FormsModule,
    IconComponent,
    SensorHistoryComponent,
    SimulatorComponent,
    AlertBrowserComponent,
    LoginComponent,
  ],
  templateUrl: './app.component.html',
})
export class AppComponent {
  s = inject(PlatformService);
  tab = signal<Tab>('overview');
  working = signal(false);
  modalError = signal('');
  mode = signal('');
  dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  editId = '';
  confirmTitle = '';
  confirmText = '';
  confirmTask: () => Promise<unknown> = async () => {};
  form = {
    name: '',
    location: '',
    deviceId: '',
    zone: '*',
    deviceIds: [] as string[],
    thresholdMax: 40 as number | null,
    customMessage: '',
    color: '#db6a32',
    metricField: 'temperature',
    condition: 'GREATER_THAN',
    threshold: 35,
    severity: 'HIGH',
  };
  nav: { id: Tab; icon: string; label: string }[] = [
    { id: 'overview', icon: 'grid', label: 'Resumen' },
    { id: 'devices', icon: 'sensor', label: 'Dispositivos' },
    { id: 'rules', icon: 'rule', label: 'Reglas' },
    { id: 'alerts', icon: 'bell', label: 'Alertas' },
    { id: 'sessions', icon: 'shield', label: 'Sesiones' },
    { id: 'users', icon: 'users', label: 'Usuarios' },
  ];
  titles: Record<Tab, [string, string]> = {
    overview: ['Tu operación, en un vistazo.', 'Cada lectura cuenta. Cada cambio, bajo control.'],
    devices: ['Conecta tu mundo.', 'Administra los sensores de tu espacio.'],
    rules: ['Anticípate a los cambios.', 'Define cuándo una lectura necesita tu atención.'],
    alerts: ['De la señal a la acción.', 'Revisa, reconoce y resuelve tus alertas.'],
    sessions: ['Tu acceso, bajo control.', 'Consulta tus sesiones y revoca las que ya no uses.'],
    users: ['Un espacio para cada usuario.', 'Administra el acceso a la plataforma.'],
  };
  constructor() {
    void this.s.init();
  }
  get d() {
    return this.s.data();
  }
  get pending() {
    return this.d.alertSummary.total;
  }
  severities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  get selectedDevice() {
    return this.d.devices.find((d) => d.id === this.s.selected());
  }
  active(device: Device) {
    const age = Date.now() - Date.parse(device.lastSeenAt || '');
    return age >= 0 && age <= 600000;
  }
  get activeCount() {
    return this.d.devices.filter((d) => this.active(d)).length;
  }
  get inactiveDevices() {
    return this.d.devices.filter((d) => !this.active(d));
  }
  get zones() {
    return [...new Set(this.d.devices.map((d) => d.location?.trim() || ''))].sort();
  }
  get zoneDevices() {
    return this.d.devices.filter(
      (d) => this.form.zone === '*' || (d.location?.trim() || '') === this.form.zone,
    );
  }
  changeRuleZone(zone: string) {
    this.form.zone = zone;
    this.form.deviceIds = [];
  }
  chooseRuleDevice(id: string, checked: boolean) {
    this.form.deviceIds = checked
      ? [...this.form.deviceIds, id]
      : this.form.deviceIds.filter((v) => v !== id);
  }
  ruleScope(rule: Rule) {
    return (
      (rule.zone != null ? (rule.zone || 'Sin zona') + ' · ' : '') +
      (rule.deviceIds
        ? rule.deviceIds.map((id) => this.deviceName(id)).join(', ')
        : this.deviceName(rule.deviceId))
    );
  }
  get rangedRule() {
    return ['BETWEEN', 'OUTSIDE_RANGE'].includes(this.form.condition);
  }
  get title() {
    return this.titles[this.tab()];
  }
  get tabLabel() {
    return this.nav.find((n) => n.id === this.tab())?.label;
  }
  num(value: unknown) {
    return value == null
      ? '—'
      : Number(value).toLocaleString('es-CO', { maximumFractionDigits: 1 });
  }
  date(value?: string) {
    return value
      ? new Date(value).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
      : '—';
  }
  deviceName(id?: string) {
    return this.d.devices.find((d) => d.id === id)?.name || 'Todos mis dispositivos';
  }
  ruleName(a: Alert) {
    return a.rule?.name || this.d.rules.find((r) => r.id === a.ruleId)?.name || 'Alerta de sensor';
  }
  label(s: string) {
    return (
      (
        {
          TRIGGERED: 'Pendiente',
          ACKNOWLEDGED: 'Reconocida',
          RESOLVED: 'Resuelta',
          HIGH: 'Alta',
          LOW: 'Baja',
          MEDIUM: 'Media',
          CRITICAL: 'Crítica',
          temperature: 'Temperatura',
          humidity: 'Humedad',
          pressure: 'Presión',
          GREATER_THAN: '>',
          LESS_THAN: '<',
          EQUALS: '=',
          BETWEEN: 'entre (inclusive)',
          OUTSIDE_RANGE: 'fuera de',
        } as Record<string, string>
      )[s] || s
    );
  }
  count(status: string) {
    return this.d.alerts.filter((a) => a.status === status).length;
  }
  async run(task: () => Promise<unknown>) {
    if (this.working()) return;
    this.working.set(true);
    try {
      await task();
      await this.s.load();
    } catch (e) {
      this.s.notify(this.s.message(e));
    } finally {
      this.working.set(false);
    }
  }
  prepare() {
    if (this.s.guideStep() === 4) {
      this.tab.set('alerts');
      return;
    }
    void this.run(() => this.s.prepare());
  }
  reading(value: number) {
    void this.run(() => this.s.sendReading(value));
  }
  viewDevice(d: Device) {
    this.s.select(d.id);
    this.tab.set('overview');
  }
  openDevice(d?: Device) {
    if (!d && this.s.user()?.role === 'DEMO' && this.d.devices.length >= 3) {
      this.s.notify('Tu demo permite hasta 3 dispositivos. Elimina uno para crear otro.');
      return;
    }
    this.editId = d?.id || '';
    this.form.name = d?.name || '';
    this.form.location = d?.location || '';
    this.open('device');
  }
  openRule(rule?: Rule) {
    if (!this.d.devices.length) {
      this.s.notify('Primero crea un dispositivo.');
      return;
    }
    if (!rule && this.s.user()?.role === 'DEMO' && this.d.rules.length >= 3) {
      this.s.notify('Tu demo permite hasta 3 reglas.');
      return;
    }
    this.form = {
      name: '',
      location: '',
      deviceId: '',
      zone: this.selectedDevice?.location?.trim() || '',
      deviceIds: this.s.selected() ? [this.s.selected()] : [],
      thresholdMax: 40,
      customMessage: '',
      color: '#db6a32',
      metricField: 'temperature',
      condition: 'GREATER_THAN',
      threshold: 35,
      severity: 'HIGH',
    };
    this.editId = rule?.id || '';
    if (rule)
      Object.assign(this.form, rule, {
        zone: rule.zone ?? '*',
        deviceIds: rule.deviceIds
          ? [...rule.deviceIds]
          : rule.deviceId
            ? [rule.deviceId]
            : this.d.devices.map((d) => d.id),
        customMessage: rule.customMessage || '',
        color: rule.color || '#db6a32',
      });
    this.open('rule');
  }
  open(mode: string) {
    this.mode.set(mode);
    this.modalError.set('');
    this.dialog()?.nativeElement.showModal();
  }
  close() {
    if (!this.working()) this.dialog()?.nativeElement.close();
  }
  confirm(title: string, text: string, task: () => Promise<unknown>) {
    this.confirmTitle = title;
    this.confirmText = text;
    this.confirmTask = task;
    this.open('confirm');
  }
  deleteDevice(d: Device) {
    this.confirm(
      '¿Eliminar este dispositivo?',
      'Sus lecturas se eliminarán. Esta acción no se puede deshacer.',
      () => this.s.request(`devices/${d.id}`, 'DELETE'),
    );
  }
  deleteRule(r: Rule) {
    this.confirm('¿Eliminar esta regla?', 'También se eliminarán las alertas asociadas.', () =>
      this.s.request(`rules/${r.id}`, 'DELETE'),
    );
  }
  toggleRule(r: Rule) {
    void this.run(() => this.s.request(`rules/${r.id}`, 'PATCH', { isActive: !r.isActive }));
  }
  alertAction(a: Alert) {
    void this.run(() =>
      this.s.request(
        `alerts/${a.id}/${a.status === 'TRIGGERED' ? 'acknowledge' : 'resolve'}`,
        'PATCH',
        {},
      ),
    );
  }
  revoke(id: string) {
    this.confirm('¿Revocar esta sesión?', 'Ese cliente deberá iniciar sesión de nuevo.', () =>
      this.s.request(`auth/sessions/${id}`, 'DELETE'),
    );
  }
  toggleUser(u: User) {
    this.confirm(
      `${u.status === 'ACTIVE' ? 'Deshabilitar' : 'Habilitar'} a ${u.username}`,
      u.status === 'ACTIVE'
        ? 'Se cerrarán todas sus sesiones activas.'
        : 'El usuario podrá iniciar sesión de nuevo.',
      () =>
        this.s.request(`users/${u.id}/status`, 'PATCH', {
          status: u.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
        }),
    );
  }
  async save() {
    this.working.set(true);
    this.modalError.set('');
    try {
      if (this.mode() === 'confirm') await this.confirmTask();
      else if (this.mode() === 'device') {
        const body = { name: this.form.name, location: this.form.location };
        await this.s.request(
          this.editId ? `devices/${this.editId}` : 'devices',
          this.editId ? 'PATCH' : 'POST',
          this.editId ? body : { ...body, type: 'MULTI_SENSOR' },
        );
      } else {
        const {
          name,
          metricField,
          condition,
          threshold,
          severity,
          zone,
          deviceIds,
          thresholdMax,
          customMessage,
          color,
        } = this.form;
        if (!deviceIds.length) throw new Error('Selecciona al menos un dispositivo de la zona.');
        if (threshold == null || !Number.isFinite(Number(threshold)))
          throw new Error('Introduce un umbral válido.');
        if (this.rangedRule && (thresholdMax == null || Number(thresholdMax) <= Number(threshold)))
          throw new Error('El límite superior debe ser mayor que el inferior.');
        await this.s.request(
          this.editId ? 'rules/' + this.editId : 'rules',
          this.editId ? 'PATCH' : 'POST',
          {
            name,
            deviceId: null,
            deviceIds,
            zone: zone === '*' ? null : zone,
            customMessage: customMessage.trim(),
            color,
            thresholdMax: this.rangedRule ? Number(thresholdMax) : null,
            metricField,
            condition,
            threshold: Number(threshold),
            severity,
            ...(!this.editId ? { isActive: true } : {}),
          },
        );
      }
      this.dialog()?.nativeElement.close();
      this.s.notify('Cambios guardados.');
      await this.s.load();
    } catch (e) {
      this.modalError.set(this.s.message(e));
    } finally {
      this.working.set(false);
    }
  }
  logout() {
    void this.s.logout().then(() => {
      if (!this.s.user()) this.tab.set('overview');
    });
  }
}

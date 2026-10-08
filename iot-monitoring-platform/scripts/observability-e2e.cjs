// Prueba contra servicios reales; elimina únicamente sus propios usuarios temporales.
const assert = require('node:assert/strict');
const { Client } = require('pg');
const mqtt = require('mqtt');
const hosts = {
  auth: 'api-gateway:3000',
  devices: 'device-service:3001',
  rules: 'alerts-service:3003',
  alerts: 'alerts-service:3003',
};
const users = [];
let checks = 0;
async function api(path, actor, method = 'GET', body, status = 200) {
  const r = await fetch(`http://${hosts[path.split(/[/?]/)[0]]}/api/v1/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(actor ? { Authorization: `Bearer ${actor.access_token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  assert.equal(r.status, status, `${method} ${path}: ${r.status}`);
  checks++;
  return status === 204 ? null : r.json();
}
async function waitFor(fn) {
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    const result = await fn();
    if (result) return result;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw Error('Se agotó la espera de procesamiento');
}
(async () => {
  const db = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });
  await db.connect();
  let broker;
  try {
    const a = await api('auth/demo', null, 'POST', {}, 201);
    users.push(a);
    const b = await api('auth/demo', null, 'POST', {}, 201);
    users.push(b);
    const createDevice = (actor, name, location) =>
      api('devices', actor, 'POST', { name, type: 'MULTI_SENSOR', location }, 201);
    const n1 = await createDevice(a, 'Norte uno', 'Norte'),
      n2 = await createDevice(a, 'Norte dos', 'Norte'),
      south = await createDevice(a, 'Sur', 'Sur'),
      other = await createDevice(b, 'Ajeno', 'Norte');
    const base = {
      name: 'Rango de zona',
      zone: 'Norte',
      deviceIds: [n1.id, n2.id],
      metricField: 'temperature',
      condition: 'OUTSIDE_RANGE',
      threshold: 10,
      thresholdMax: 30,
      severity: 'CRITICAL',
      customMessage: 'Revisar ventilación',
      color: '#336699',
    };
    for (const change of [
      { thresholdMax: null },
      { thresholdMax: 5 },
      { deviceIds: [] },
      { deviceIds: [n1.id, n1.id] },
      { color: 'red' },
      { customMessage: 'x'.repeat(501) },
      { metricField: 'anything' },
      { deviceIds: [south.id] },
    ])
      await api('rules', a, 'POST', { ...base, ...change }, 400);
    await api('rules', a, 'POST', { ...base, deviceIds: [other.id] }, 403);
    const rule = await api('rules', a, 'POST', base, 201);
    assert.deepEqual(rule.deviceIds, [n1.id, n2.id]);
    await api(`rules/${rule.id}`, a, 'PATCH', { deviceIds: [other.id] }, 403);
    await api(`rules/${rule.id}`, a, 'PATCH', { thresholdMax: 0 }, 400);
    await api(`rules/${rule.id}`, b, 'PATCH', { threshold: 0 }, 404);
    broker = await mqtt.connectAsync('mqtt://mosquitto:1883');
    async function send(id, value) {
      await broker.publishAsync(
        `iot/devices/${id}/data`,
        JSON.stringify({
          deviceId: id,
          temperature: value,
          humidity: 45,
          timestamp: new Date(Date.now() - 86400000).toISOString(),
        }),
        { qos: 1 },
      );
    }
    await send(n1.id, 40);
    await send(n2.id, 5);
    await send(south.id, 40);
    await send(other.id, 40);
    const alerts = await waitFor(async () => {
      const r = await api('alerts', a);
      return r.data.length === 2 ? r.data : null;
    });
    assert.ok(
      alerts.every((x) => x.message === base.customMessage && x.metadata.color === base.color),
    );
    assert.deepEqual(new Set(alerts.map((x) => x.deviceId)), new Set([n1.id, n2.id]));
    const seen = await api(`devices/${n1.id}`, a);
    assert.ok(
      Date.now() - Date.parse(seen.lastSeenAt) < 20000,
      'La recepción usa el reloj del servidor',
    );
    let sum = await api('alerts/summary', a);
    assert.equal(sum.total, 2);
    assert.equal(sum.bySeverity.CRITICAL, 2);
    assert.equal((await api('alerts/summary', b)).total, 0);
    await api(`alerts/${alerts[0].id}/acknowledge`, a, 'PATCH', {});
    sum = await api('alerts/summary', a);
    assert.equal(sum.total, 1);
    await api(`rules/${rule.id}`, a, 'PATCH', { customMessage: 'Nuevo mensaje', color: '#ff0000' });
    const historical = await api(`alerts/${alerts[0].id}`, a);
    assert.equal(historical.message, base.customMessage);
    assert.equal(historical.metadata.color, base.color);
    // Mover un dispositivo fuera de la zona deja de aplicarle la regla.
    await api(`devices/${n2.id}`, a, 'PATCH', { location: 'Sur' });
    await api(`rules/${rule.id}`, a, 'PATCH', { isActive: false });
    await api(`rules/${rule.id}`, a, 'PATCH', { isActive: true });
    await send(n2.id, 1);
    await send(n1.id, 10);
    await send(n1.id, 30);
    await waitFor(async () => {
      const r = await db.query(
        'SELECT COUNT(*)::int AS count FROM device_readings WHERE device_id=$1',
        [n1.id],
      );
      return r.rows[0].count >= 3;
    });
    // Dejar pasar la evaluación asíncrona antes de comprobar que los límites no disparan.
    await new Promise((r) => setTimeout(r, 1500));
    assert.equal((await api('alerts', a)).meta.total, 2);
    await api(`rules/${rule.id}`, a, 'PATCH', { deviceIds: [n1.id], condition: 'BETWEEN' });
    await send(n1.id, 10);
    await waitFor(async () => (await api('alerts', a)).meta.total === 3);
    console.log(
      `PASS: ${checks} solicitudes verificadas; zona, múltiples dispositivos, rangos, validación, aislamiento, actividad y alertas con mensaje/color persistidos.`,
    );
  } finally {
    if (broker) await broker.endAsync();
    for (const a of users)
      await db.query('DELETE FROM users WHERE id=$1 AND role=$2', [a.user.id, 'DEMO']);
    await db.end();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});

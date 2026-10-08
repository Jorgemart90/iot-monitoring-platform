// Run inside the api-gateway container. Creates and removes its own fixtures only.
const assert = require('node:assert/strict');
const { Client } = require('pg');
const { randomUUID } = require('node:crypto');
const hosts = {
  auth: 'api-gateway:3000',
  devices: 'device-service:3001',
  rules: 'alerts-service:3003',
  alerts: 'alerts-service:3003',
  analytics: 'analytics-service:3002',
};
let checks = 0;
const actors = [];
async function api(path, actor, method = 'GET', body, status = 200) {
  const r = await fetch(`http://${hosts[path.split(/[/?]/)[0]]}/api/v1/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(actor ? { Authorization: `Bearer ${actor.access_token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
  });
  assert.equal(r.status, status, `${method} ${path}: expected ${status}, got ${r.status}`);
  checks++;
  return status === 204 ? null : r.json();
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
  try {
    const a = await api('auth/demo', null, 'POST', {}, 201),
      b = await api('auth/demo', null, 'POST', {}, 201);
    actors.push(a, b);
    const master = await api('auth/login', null, 'POST', {
      username: process.env.MASTER_USERNAME,
      password: process.env.MASTER_PASSWORD,
    });
    const dev = await api(
      'devices',
      a,
      'POST',
      { name: 'History fixture north', type: 'MULTI_SENSOR', location: 'Zona Norte' },
      201,
    );
    const devB = await api(
      'devices',
      a,
      'POST',
      { name: 'History fixture south', type: 'MULTI_SENSOR', location: 'Zona Sur' },
      201,
    );
    const rule = await api(
      'rules',
      a,
      'POST',
      {
        name: 'History temperature',
        deviceId: dev.id,
        metricField: 'temperature',
        condition: 'GREATER_THAN',
        threshold: 35,
        severity: 'HIGH',
      },
      201,
    );
    const ruleB = await api(
      'rules',
      a,
      'POST',
      {
        name: 'History humidity',
        deviceId: devB.id,
        metricField: 'humidity',
        condition: 'GREATER_THAN',
        threshold: 50,
        severity: 'MEDIUM',
      },
      201,
    );
    const now = Date.now(),
      ago = (days) => new Date(now - days * 86400000).toISOString();
    for (const [days, value] of [
      [0.02, -20],
      [2, 50],
      [10, 100],
      [25, 200],
      [40, 350],
    ]) {
      await db.query(
        'INSERT INTO device_readings (id,device_id,temperature,humidity,pressure,timestamp) VALUES ($1,$2,$3,60,1013,$4)',
        [randomUUID(), dev.id, value, ago(days)],
      );
      await db.query(
        'INSERT INTO alerts (id,rule_id,device_id,message,severity,status,triggered_value,triggered_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [randomUUID(), rule.id, dev.id, 'Historical test', 'HIGH', 'TRIGGERED', value, ago(days)],
      );
    }
    await db.query(
      'INSERT INTO device_readings (id,device_id,temperature,timestamp) VALUES ($1,$2,15,$3)',
      [randomUUID(), devB.id, ago(2)],
    );
    await db.query(
      'INSERT INTO alerts (id,rule_id,device_id,message,severity,status,triggered_value,triggered_at) VALUES ($1,$2,$3,$4,$5,$6,60,$7)',
      [randomUUID(), ruleB.id, devB.id, 'Humidity test', 'MEDIUM', 'ACKNOWLEDGED', ago(2)],
    );
    const history = (id, days, actor = a) =>
      api(
        `analytics/devices/${id}/history?${new URLSearchParams({ from: ago(days), to: ago(-0.001), points: '240' })}`,
        actor,
      );
    assert.equal((await history(dev.id, 1)).meta.totalReadings, 1);
    assert.equal((await history(dev.id, 7)).meta.totalReadings, 2);
    assert.equal((await history(dev.id, 30)).meta.totalReadings, 4);
    assert.equal((await history(devB.id, 30)).meta.totalReadings, 1);
    assert.equal((await history(dev.id, 30, master)).meta.totalReadings, 4);
    const coarse = await api(
      `analytics/devices/${dev.id}/history?${new URLSearchParams({ from: ago(30), to: ago(-0.001), points: '10' })}`,
      a,
    );
    assert.ok(coarse.data.length <= 10);
    assert.equal(coarse.meta.totalReadings, 4);
    assert.equal(Math.min(...coarse.data.map((p) => p.min)), -20);
    assert.equal(Math.max(...coarse.data.map((p) => p.max)), 200);
    const path = `analytics/devices/${dev.id}/history?${new URLSearchParams({ from: ago(7), to: ago(-0.001) })}`;
    await api(path, b, 'GET', undefined, 404);
    await api(path, null, 'GET', undefined, 401);
    await api(
      `analytics/devices/${dev.id}/history?from=invalid&to=${ago(0)}`,
      a,
      'GET',
      undefined,
      400,
    );
    await api(
      `analytics/devices/${dev.id}/history?from=${ago(0)}&to=${ago(1)}`,
      a,
      'GET',
      undefined,
      400,
    );
    await api(
      `analytics/devices/${dev.id}/history?from=${ago(400)}&to=${ago(0)}`,
      a,
      'GET',
      undefined,
      400,
    );
    async function alerts(filters, actor = a) {
      return api(
        `alerts?${new URLSearchParams({ from: ago(30), to: ago(-0.001), ...filters })}`,
        actor,
      );
    }
    assert.equal((await alerts({ zone: 'Zona Norte' })).meta.total, 4);
    assert.equal((await alerts({ zone: 'Zona Sur' })).meta.total, 1);
    assert.equal(
      (await alerts({ metricField: 'humidity', severity: 'MEDIUM', status: 'ACKNOWLEDGED' })).meta
        .total,
      1,
    );
    assert.equal((await alerts({ deviceId: dev.id, from: ago(7) })).meta.total, 2);
    assert.equal((await alerts({ deviceId: dev.id, from: ago(3), to: ago(1) })).meta.total, 1);
    assert.equal((await alerts({ zone: "Zona Norte' OR 1=1 --" })).meta.total, 0);
    assert.equal((await alerts({ deviceId: dev.id }, b)).meta.total, 0);
    const paged = await alerts({ zone: 'Zona Norte', limit: '2', page: '2' });
    assert.equal(paged.data.length, 2);
    assert.equal(paged.meta.total, 4);
    await api(`alerts?from=${ago(0)}&to=${ago(1)}`, a, 'GET', undefined, 400);
    await api('alerts?severity=INVALID', a, 'GET', undefined, 400);
    for (const value of [-273.15, -20, 0, 500]) {
      const r = await fetch('http://frontend:5173/api/demo/reading', {
        method: 'POST',
        headers: { Authorization: `Bearer ${a.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: dev.id, temperature: value }),
      });
      assert.equal(r.status, 202);
      checks++;
    }
    for (const value of [null, '20', 501, -273.16]) {
      const r = await fetch('http://frontend:5173/api/demo/reading', {
        method: 'POST',
        headers: { Authorization: `Bearer ${a.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: dev.id, temperature: value }),
      });
      assert.equal(r.status, 400);
      checks++;
    }
    await api('auth/logout', master, 'POST', {}, 204);
    console.log(
      `PASS: ${checks} API checks; historical ranges, aggregation, zone/type/date filters, pagination, ownership and temperature boundaries.`,
    );
  } finally {
    for (const actor of actors)
      await db.query('DELETE FROM users WHERE id=$1 AND role=$2', [actor.user.id, 'DEMO']);
    await db.end();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});

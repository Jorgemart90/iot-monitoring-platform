#!/usr/bin/env node
/**
 * IoT Device Simulator
 * Lee dispositivos registrados en la BD via API, crea los que falten,
 * y publica lecturas usando los UUIDs reales.
 *
 * Uso: node scripts/mqtt-simulator.js [deviceCount] [intervalMs]
 * Ejemplo: node scripts/mqtt-simulator.js 5 2000
 *
 * Variables de entorno opcionales:
 *   API_GATEWAY_URL   (default: http://localhost:3000)
 *   DEVICE_SERVICE_URL (default: http://localhost:3001)
 *   MQTT_BROKER       (default: mqtt://localhost:1883)
 */

const mqtt = require('mqtt');

const API_GATEWAY_URL   = process.env.API_GATEWAY_URL    || 'http://localhost:3000';
const DEVICE_SERVICE_URL = process.env.DEVICE_SERVICE_URL || 'http://localhost:3001';
const BROKER_URL        = process.env.MQTT_BROKER         || 'mqtt://localhost:1883';
const DEVICE_COUNT      = parseInt(process.argv[2] || '3', 10);
const INTERVAL_MS       = parseInt(process.argv[3] || '2000', 10);

// ─── API helpers (Node 18+ fetch nativo) ───────────────────────────────────

async function login() {
  const res = await fetch(`${API_GATEWAY_URL}/api/v1/auth/demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  const { access_token } = await res.json();
  return access_token;
}

async function getDevices(token) {
  const res = await fetch(`${DEVICE_SERVICE_URL}/api/v1/devices?limit=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GET /devices failed: ${res.status}`);
  const { data } = await res.json();
  return data;
}

async function createDevice(token, index) {
  const res = await fetch(`${DEVICE_SERVICE_URL}/api/v1/devices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: `Simulator Device ${String(index).padStart(3, '0')}`,
      type: 'MULTI_SENSOR',
      location: 'Simulated Location',
      metadata: { simulator: true },
    }),
  });
  if (!res.ok) throw new Error(`POST /devices failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// ─── Generación de lecturas ────────────────────────────────────────────────

function randomFloat(min, max, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function generateReading(deviceId) {
  return {
    deviceId,
    temperature: randomFloat(15, 45),
    humidity:    randomFloat(20, 90),
    pressure:    randomFloat(990, 1030),
    timestamp:   new Date().toISOString(),
    metadata: {
      battery: randomFloat(20, 100, 0),
      rssi:    randomFloat(-100, -40, 0),
      simulator: true,
    },
  };
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  if (DEVICE_COUNT > 3) {
    console.error('[Simulator] La sesión demo permite máximo 3 dispositivos.');
    process.exit(1);
  }
  console.log(`[Simulator] Iniciando con ${DEVICE_COUNT} dispositivos...`);

  // 1. Login
  let token;
  try {
    token = await login();
    console.log('[Simulator] Autenticado correctamente');
  } catch (err) {
    console.error('[Simulator] Error de autenticación:', err.message);
    process.exit(1);
  }

  // 2. Obtener dispositivos registrados
  let devices;
  try {
    devices = await getDevices(token);
    console.log(`[Simulator] Dispositivos registrados en BD: ${devices.length}`);
  } catch (err) {
    console.error('[Simulator] Error al obtener dispositivos:', err.message);
    process.exit(1);
  }

  // 3. Crear los que falten para alcanzar DEVICE_COUNT
  const missing = DEVICE_COUNT - devices.length;
  if (missing > 0) {
    console.log(`[Simulator] Creando ${missing} dispositivo(s) nuevo(s)...`);
    for (let i = 0; i < missing; i++) {
      try {
        const device = await createDevice(token, devices.length + i + 1);
        devices.push(device);
        console.log(`[Simulator] Creado: "${device.name}" → ${device.id}`);
      } catch (err) {
        console.error('[Simulator] Error al crear dispositivo:', err.message);
      }
    }
  }

  // 4. Usar solo los primeros DEVICE_COUNT dispositivos
  const activeDevices = devices.slice(0, DEVICE_COUNT);
  console.log('\n[Simulator] Dispositivos activos:');
  activeDevices.forEach(d => console.log(`  ✓ ${d.name} — ${d.id}`));

  // 5. Conectar a MQTT y publicar con UUIDs reales
  const client = mqtt.connect(BROKER_URL);

  client.on('connect', () => {
    console.log(`\n[Simulator] Conectado a MQTT: ${BROKER_URL}`);
    console.log(`[Simulator] Publicando cada ${INTERVAL_MS}ms\n`);

    setInterval(() => {
      for (const device of activeDevices) {
        const reading = generateReading(device.id);
        const topic   = `iot/devices/${device.id}/data`;

        client.publish(topic, JSON.stringify(reading), { qos: 0 }, (err) => {
          if (err) {
            console.error(`[Simulator] Error publicando ${device.name}:`, err.message);
          } else {
            console.log(
              `[Simulator] ${device.name} → ` +
              `temp:${reading.temperature}°C | ` +
              `humidity:${reading.humidity}% | ` +
              `pressure:${reading.pressure}hPa`,
            );
          }
        });
      }
    }, INTERVAL_MS);
  });

  client.on('error', (err) => {
    console.error('[Simulator] Error MQTT:', err.message);
  });

  process.on('SIGINT', () => {
    console.log('\n[Simulator] Apagando...');
    client.end();
    process.exit(0);
  });
}

main();

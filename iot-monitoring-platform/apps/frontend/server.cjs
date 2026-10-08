const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const mqtt = require('mqtt');
const services = {
  auth: 'api-gateway:3000',
  users: 'api-gateway:3000',
  health: 'api-gateway:3000',
  devices: 'device-service:3001',
  analytics: 'analytics-service:3002',
  rules: 'alerts-service:3003',
  alerts: 'alerts-service:3003',
  notifications: 'notification-service:3004',
};
const broker = mqtt.connect(process.env.MQTT_BROKER || 'mqtt://mosquitto:1883', {
  connectTimeout: 5000,
});
broker.on('error', () => console.error('MQTT connection unavailable'));
const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};
async function simulate(req, res) {
  const authorization = req.headers.authorization;
  if (!authorization) return json(res, 401, { message: 'Inicia sesión para enviar una lectura.' });
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 4096) return json(res, 413, { message: 'Solicitud demasiado grande.' });
  }
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(res, 400, { message: 'Lectura inválida.' });
  }
  const limits = { temperature: [-273.15, 500], humidity: [0, 100], pressure: [0, 2000] };
  if (!body || typeof body !== 'object' || !/^[a-f0-9-]{36}$/i.test(body.deviceId || ''))
    return json(res, 400, { message: 'Selecciona un dispositivo válido.' });
  const values = {};
  for (const [field, [min, max]] of Object.entries(limits)) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      if (!Number.isFinite(body[field]) || body[field] < min || body[field] > max)
        return json(res, 400, {
          message:
            'Valor inválido: temperatura −273,15 a 500 °C, humedad 0 a 100 %, presión 0 a 2000 hPa.',
        });
      values[field] = Math.round(body[field] * 100) / 100;
    }
  }
  if (
    !Object.keys(values).length ||
    Object.keys(body).some((key) => key !== 'deviceId' && !Object.hasOwn(limits, key))
  )
    return json(res, 400, {
      message: 'Envía al menos una métrica válida: temperatura, humedad o presión.',
    });
  const device = await fetch(`http://${services.devices}/api/v1/devices/${body.deviceId}`, {
    headers: { authorization },
    signal: AbortSignal.timeout(8000),
  });
  if (!device.ok)
    return json(res, device.status, { message: 'No puedes enviar lecturas a este dispositivo.' });
  if (!broker.connected)
    return json(res, 503, { message: 'El simulador se está conectando. Intenta de nuevo.' });
  const reading = {
    deviceId: body.deviceId,
    ...values,
    timestamp: new Date().toISOString(),
    metadata: { simulator: true },
  };
  await Promise.race([
    broker.publishAsync(`iot/devices/${body.deviceId}/data`, JSON.stringify(reading), { qos: 1 }),
    new Promise((_, reject) => {
      const timer = setTimeout(() => reject(new Error('MQTT timeout')), 8000);
      timer.unref();
    }),
  ]);
  json(res, 202, { message: 'Lectura enviada', reading });
}
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  );
  try {
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      req.headers.origin &&
      req.headers.origin !== `http://${req.headers.host}` &&
      req.headers.origin !== `https://${req.headers.host}`
    )
      return json(res, 403, { message: 'Origen no permitido.' });
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/demo/reading' && req.method === 'POST')
      return await simulate(req, res);
    if (url.pathname.startsWith('/api/v1/')) {
      const target = services[url.pathname.split('/')[3]];
      if (!target) return json(res, 404, { message: 'Ruta no disponible.' });
      const headers = {};
      for (const key of ['authorization', 'cookie', 'content-type', 'accept', 'user-agent'])
        if (req.headers[key]) headers[key] = req.headers[key];
      const upstream = http.request(
        {
          hostname: target.split(':')[0],
          port: target.split(':')[1],
          path: url.pathname + url.search,
          method: req.method,
          headers,
        },
        (response) => {
          for (const key of ['content-type', 'set-cookie', 'cache-control'])
            if (response.headers[key]) res.setHeader(key, response.headers[key]);
          res.writeHead(response.statusCode);
          res.flushHeaders();
          response.pipe(res);
          response.on('error', () => res.destroy());
        },
      );
      upstream.setTimeout(65000, () => upstream.destroy());
      upstream.on('error', () => {
        if (!res.headersSent)
          json(res, 502, {
            message: 'El servicio está iniciando o no está disponible. Intenta de nuevo.',
          });
        else res.end();
      });
      res.on('close', () => upstream.destroy());
      req.pipe(upstream);
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD')
      return json(res, 405, { message: 'Método no permitido.' });
    const files = { '/': 'index.html' };
    const file =
      files[url.pathname] ||
      (/^\/[a-zA-Z0-9_-]+\.(js|css|ico)$/.test(url.pathname) ? url.pathname.slice(1) : null);
    if (!file || !fs.existsSync(path.join(__dirname, 'public', file)))
      return json(res, 404, { message: 'No encontrado.' });
    res.setHeader(
      'Content-Type',
      file.endsWith('.js')
        ? 'text/javascript; charset=utf-8'
        : file.endsWith('.css')
          ? 'text/css; charset=utf-8'
          : 'text/html; charset=utf-8',
    );
    fs.createReadStream(path.join(__dirname, 'public', file)).pipe(res);
  } catch {
    if (!res.headersSent)
      json(res, 503, { message: 'No pudimos completar la solicitud. Intenta de nuevo.' });
    else res.end();
  }
});
server.listen(5173, '0.0.0.0', () => console.log('IoT frontend ready on :5173'));
process.on('SIGTERM', () => {
  broker.end(true);
  server.close(() => process.exit(0));
});

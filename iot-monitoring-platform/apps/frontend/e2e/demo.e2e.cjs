const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
function master() {
  const env = Object.fromEntries(
    fs
      .readFileSync(path.join(__dirname, '../../../.env'), 'utf8')
      .split(/\r?\n/)
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')];
      }),
  );
  return { username: env.MASTER_USERNAME, password: env.MASTER_PASSWORD };
}
async function demo(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Crear mi demo' }).click();
  await expect(page.getByRole('heading', { name: 'Tu operación, en un vistazo.' })).toBeVisible();
}
async function nav(page, name) {
  await page.getByRole('navigation').getByRole('button', { name, exact: false }).click();
}
test('DEMO: guided simulation, live alerts, forms, session restore, isolation and logout', async ({
  page,
  browser,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Crear mi demo' })).toBeVisible();
  await page.screenshot({ path: 'test-results/login-desktop.png', fullPage: true });
  const authResponse = page.waitForResponse(
    (r) => r.url().endsWith('/auth/demo') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Crear mi demo' }).click();
  const auth = await (await authResponse).json();
  await expect(page.getByRole('heading', { name: 'Tu operación, en un vistazo.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar 42 °C' })).toBeDisabled();
  const guide = page.getByRole('region', { name: 'Recorrido guiado' });
  await expect(guide.locator('[data-step="1"]')).toHaveAttribute('aria-current', 'step');
  await page.getByRole('button', { name: 'Preparar mi recorrido' }).click();
  await expect(guide.locator('[data-step="1"]')).toContainText('Completado');
  await expect(guide.locator('[data-step="2"]')).toHaveAttribute('aria-current', 'step');
  await expect(guide.locator('[data-step="3"]')).toContainText('Pendiente');
  const beforeRules = await page.request.get('/api/v1/rules', {
    headers: { Authorization: `Bearer ${auth.access_token}` },
  });
  expect((await beforeRules.json()).data).toHaveLength(0);
  await page.reload();
  await expect(guide.locator('[data-step="2"]')).toHaveAttribute('aria-current', 'step');
  await page.getByRole('button', { name: 'Crear reglas del recorrido' }).click();
  await expect(guide.locator('[data-step="2"]')).toContainText('Completado');
  await expect(guide.locator('[data-step="3"]')).toHaveAttribute('aria-current', 'step');
  await expect(guide.locator('[data-step="3"]')).not.toContainText('Completado');
  await expect(page.locator('.connection')).toHaveText('Alertas en vivo');
  // Keep the real alert hidden briefly to verify that publication is not completion.
  await page.route('**/api/v1/alerts?*', (route) =>
    route.fulfill({ json: { data: [], meta: { totalPages: 0 } } }),
  );
  await page.getByRole('button', { name: 'Enviar lectura y recibir alertas' }).click();
  await expect(guide.getByRole('button', { name: 'Esperando alertas…' })).toBeDisabled();
  await expect(guide.locator('[data-step="3"]')).toContainText('Esperando alertas');
  await expect(guide.locator('.guide-success')).toHaveCount(0);
  await page.unroute('**/api/v1/alerts?*');
  await expect(guide.locator('.guide-success')).toContainText('Los 3 pasos están completos');
  await expect(guide.locator('[data-step="3"]')).toContainText('Completado');
  await expect(page.locator('tbody')).toContainText('42');
  await expect(page.locator('.chart')).toBeVisible();
  await page.reload();
  await expect(guide.locator('.guide-success')).toBeVisible();
  await expect(guide.getByRole('button', { name: 'Ver alertas del recorrido' })).toBeEnabled();
  await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true });
  await nav(page, 'Alertas');
  await page.getByRole('button', { name: 'Reconocer', exact: true }).first().click();
  await page.getByRole('button', { name: 'Resolver', exact: true }).first().click();
  await expect(page.locator('tbody')).toContainText('Resuelta');
  await nav(page, 'Dispositivos');
  await page.getByRole('button', { name: 'Nuevo dispositivo' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Sensor de presentación');
  await page.getByLabel('Zona / ubicación').fill('Oficina');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sensor de presentación' })).toBeVisible();
  const card = page.locator('.device-card').filter({ hasText: 'Sensor de presentación' });
  await card.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.getByLabel('Zona / ubicación').fill('Sala de juntas');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(card).toContainText('Sala de juntas');
  await nav(page, 'Reglas');
  const humidityGuide = page.locator('.rule-card').filter({ hasText: 'Humedad alta · Recorrido' });
  await humidityGuide.getByRole('button', { name: 'Eliminar', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(humidityGuide).toHaveCount(0);
  await page.getByRole('button', { name: 'Nueva regla', exact: true }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Humedad de prueba');
  await page.getByLabel('Métrica', { exact: true }).selectOption('humidity');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  const rule = page.locator('.rule-card').filter({ hasText: 'Humedad de prueba' });
  await expect(rule).toBeVisible();
  await rule.getByRole('button', { name: 'Activa · Pausar' }).click();
  await expect(rule).toContainText('Pausada · Activar');
  await rule.getByRole('button', { name: 'Eliminar' }).click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(rule).toHaveCount(0);
  await nav(page, 'Sesiones');
  await expect(page.locator('.session-list')).toContainText('Este navegador');
  const cookies = await page.context().cookies();
  const cookie = cookies.find((c) => c.name === 'iot_refresh');
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.sameSite).toBe('Lax');
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Tu operación, en un vistazo.' })).toBeVisible();
  await expect(page.getByLabel('Sensor de destino')).toContainText('Sensor del invernadero');
  const other = await browser.newContext({
    baseURL: process.env.FRONTEND_URL || 'http://localhost:5173',
  });
  const otherPage = await other.newPage();
  await demo(otherPage);
  await nav(otherPage, 'Dispositivos');
  await expect(otherPage.getByRole('heading', { name: 'Aquí empieza tu monitoreo' })).toBeVisible();
  const devices = await page.request.get('/api/v1/devices', {
    headers: { Authorization: `Bearer ${auth.access_token}` },
  });
  const id = (await devices.json()).data[0].id;
  const otherToken = await otherPage.evaluate(async () => {
    const r = await fetch('/api/v1/auth/refresh', { method: 'POST' });
    return (await r.json()).access_token;
  });
  const denied = await otherPage.request.post('/api/demo/reading', {
    headers: { Authorization: `Bearer ${otherToken}` },
    data: { deviceId: id, temperature: 42 },
  });
  expect(denied.status()).toBe(404);
  await other.close();
  await nav(page, 'Dispositivos');
  const remove = page.locator('.device-card').filter({ hasText: 'Sensor de presentación' });
  await remove.getByRole('button', { name: 'Eliminar' }).click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(remove).toHaveCount(0);
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Crear mi demo' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Crear mi demo' })).toBeVisible();
  expect(errors).toEqual([]);
});
test('MASTER: invalid login, successful login and administration', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Administrador', exact: true }).click();
  const credentials = master();
  await page.getByLabel('Usuario', { exact: true }).fill(credentials.username);
  await page.getByLabel('Contraseña').fill('incorrect-password');
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.locator('.form-error')).toContainText('Credenciales');
  await page.getByLabel('Contraseña').fill(credentials.password);
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tu operación, en un vistazo.' })).toBeVisible();
  await nav(page, 'Usuarios');
  await expect(page.getByRole('heading', { name: 'Usuarios de la plataforma' })).toBeVisible();
  await expect(page.locator('tbody')).toContainText('MASTER');
  await expect(page.locator('tbody')).toContainText('DEMO');
  await page.screenshot({ path: 'test-results/master-users.png', fullPage: true });
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
});
test('mobile: login, dashboard and navigation fit the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Crear mi demo' })).toBeVisible();
  await page.screenshot({ path: 'test-results/login-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Crear mi demo' }).click();
  await expect(page.getByRole('heading', { name: 'Tu operación, en un vistazo.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/dashboard-mobile.png', fullPage: true });
  await nav(page, 'Dispositivos');
  await expect(page.getByRole('heading', { name: 'Conecta tu mundo.' })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
});

test('guided steps ignore unrelated data, keep failed steps pending and recover without duplicates', async ({
  page,
}) => {
  const authResponse = page.waitForResponse(
    (r) => r.url().endsWith('/auth/demo') && r.request().method() === 'POST',
  );
  await demo(page);
  const auth = await (await authResponse).json();
  const headers = { Authorization: `Bearer ${auth.access_token}` };
  const d = await (
    await page.request.post('/api/v1/devices', {
      headers,
      data: { name: 'Sensor ajeno al recorrido', type: 'MULTI_SENSOR' },
    })
  ).json();
  await page.request.post('/api/v1/rules', {
    headers,
    data: {
      name: 'Regla ajena al recorrido',
      deviceId: d.id,
      metricField: 'temperature',
      condition: 'GREATER_THAN',
      threshold: 35,
      severity: 'HIGH',
    },
  });
  await page.request.post('/api/demo/reading', {
    headers,
    data: { deviceId: d.id, temperature: 42 },
  });
  await expect
    .poll(async () => {
      const r = await page.request.get('/api/v1/alerts', { headers });
      return (await r.json()).data.length;
    })
    .toBeGreaterThan(0);
  await page.reload();
  const guide = page.getByRole('region', { name: 'Recorrido guiado' });
  await expect(guide.locator('[data-step="1"]')).toHaveAttribute('aria-current', 'step');
  await page.getByRole('button', { name: 'Preparar mi recorrido' }).click();
  // La cuota sigue siendo tres: el recorrido no elimina reglas del usuario.
  await page.getByRole('button', { name: 'Crear reglas del recorrido' }).click();
  await expect(guide.getByRole('alert')).toContainText('Libera 1');
  const unrelatedRules = (await (await page.request.get('/api/v1/rules', { headers })).json()).data;
  await page.request.delete(
    '/api/v1/rules/' + unrelatedRules.find((r) => r.name === 'Regla ajena al recorrido').id,
    { headers },
  );
  await page.reload();
  await page.route('**/api/v1/rules', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 503, json: { message: 'Reglas no disponible' } })
      : route.continue(),
  );
  await page.getByRole('button', { name: 'Crear reglas del recorrido' }).click();
  await expect(guide.getByRole('alert')).toContainText('Reglas no disponible');
  await expect(guide.locator('[data-step="2"]')).toHaveAttribute('aria-current', 'step');
  await page.unroute('**/api/v1/rules');
  await page.getByRole('button', { name: 'Crear reglas del recorrido' }).click();
  await expect(guide.locator('[data-step="3"]')).toHaveAttribute('aria-current', 'step');
  await page.route('**/api/demo/reading', (route) =>
    route.fulfill({ status: 503, json: { message: 'Simulador no disponible' } }),
  );
  await page.getByRole('button', { name: 'Enviar lectura y recibir alertas' }).click();
  await expect(guide.getByRole('alert')).toContainText('Simulador no disponible');
  await expect(guide.locator('[data-step="3"]')).toHaveAttribute('aria-current', 'step');
  await expect(guide.locator('.guide-success')).toHaveCount(0);
  await page.unroute('**/api/demo/reading');
  await page.clock.install();
  await page.route('**/api/v1/alerts?*', (route) =>
    route.fulfill({ json: { data: [], meta: { totalPages: 0 } } }),
  );
  await page.getByRole('button', { name: 'Enviar lectura y recibir alertas' }).click();
  await expect(guide.getByRole('button', { name: 'Esperando alertas…' })).toBeDisabled();
  await page.clock.fastForward(35000);
  await expect(guide.getByRole('alert')).toContainText('aún no recibimos las tres alertas');
  await expect(guide.locator('[data-step="3"]')).toHaveAttribute('aria-current', 'step');
  await expect(
    guide.getByRole('button', { name: 'Enviar lectura y recibir alertas' }),
  ).toBeEnabled();
  await page.unroute('**/api/v1/alerts?*');
  await page.getByRole('button', { name: 'Enviar lectura y recibir alertas' }).click();
  await expect(guide.locator('.guide-success')).toBeVisible();
  const devices = (await (await page.request.get('/api/v1/devices', { headers })).json()).data;
  const rules = (await (await page.request.get('/api/v1/rules', { headers })).json()).data;
  expect(devices.filter((d) => d.metadata?.guidedDemo)).toHaveLength(1);
  expect(rules.filter((r) => r.name === 'Temperatura alta · Recorrido')).toHaveLength(1);
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
});

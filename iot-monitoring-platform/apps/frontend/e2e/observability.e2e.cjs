const { test, expect } = require('@playwright/test');
test('observability: zone rule, range, message/color, activity and severity summary', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  const signed = page.waitForResponse(
    (r) => r.url().endsWith('/auth/demo') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Crear mi demo' }).click();
  const actor = await (await signed).json();
  const headers = { Authorization: `Bearer ${actor.access_token}` };
  async function create(name, location) {
    const r = await page.request.post('/api/v1/devices', {
      headers,
      data: { name, location, type: 'MULTI_SENSOR' },
    });
    expect(r.status()).toBe(201);
    return r.json();
  }
  const a = await create('Cámara A', 'Cámaras'),
    b = await create('Cámara B', 'Cámaras'),
    c = await create('Oficina', 'Oficina');
  await page.reload();
  await expect(page.locator('.stats').first()).toContainText('0 activos · 3 sin señal reciente');
  await page.getByRole('navigation').getByRole('button', { name: 'Reglas', exact: false }).click();
  await page.getByRole('button', { name: 'Nueva regla', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nombre', { exact: true }).fill('Rango cámaras');
  await dialog.getByLabel('Zona de la regla').selectOption('Cámaras');
  await expect(dialog.getByRole('checkbox', { name: 'Oficina', exact: true })).toHaveCount(0);
  await dialog.getByRole('checkbox', { name: 'Cámara A', exact: true }).check();
  await dialog.getByRole('checkbox', { name: 'Cámara B', exact: true }).check();
  await dialog.getByLabel('Condición', { exact: true }).selectOption('OUTSIDE_RANGE');
  await dialog.getByLabel('Umbral', { exact: true }).fill('10');
  await dialog.getByLabel('Límite superior').fill('5');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('mayor');
  await dialog.getByLabel('Límite superior').fill('30');
  await dialog.getByLabel('Severidad', { exact: true }).selectOption('CRITICAL');
  await dialog.getByLabel('Mensaje personalizado').fill('Revisar refrigeración');
  await dialog.getByLabel('Color de la alarma').fill('#336699');
  await page.screenshot({ path: 'test-results/rule-observability.png', fullPage: true });
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const rule = page.locator('.rule-card').filter({ hasText: 'Rango cámaras' });
  await expect(rule).toContainText('Cámara A, Cámara B');
  await expect(rule).toContainText('fuera de');
  await rule.getByRole('button', { name: 'Editar', exact: true }).click();
  await expect(dialog.getByLabel('Límite superior')).toHaveValue('30');
  await expect(dialog.getByRole('checkbox', { name: 'Cámara B', exact: true })).toBeChecked();
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  for (const device of [a, b]) {
    const r = await page.request.post('/api/demo/reading', {
      headers,
      data: { deviceId: device.id, temperature: 40 },
    });
    expect(r.status()).toBe(202);
  }
  await page.getByRole('navigation').getByRole('button', { name: 'Resumen', exact: false }).click();
  const stats = page.locator('.stats').first();
  await expect(stats).toContainText('2 activos · 1 sin señal reciente');
  await page.locator('p-simulator').getByLabel('Sensor de destino').selectOption(a.id);
  await expect(stats.locator('article').nth(1)).toContainText('Cámara A · Cámaras');
  await expect(stats.locator('article').nth(2)).toContainText('Cámara A · Cámaras');
  await expect(stats.locator('[data-severity="CRITICAL"]')).toContainText('2');
  await stats.getByText('Revisar sensores sin señal', { exact: true }).click();
  await expect(stats.getByRole('button', { name: /Oficina/ })).toBeVisible();
  await expect(page.locator('.alert-message').first()).toHaveText('Revisar refrigeración');
  await expect(page.locator('.alert-color').first()).toHaveCSS(
    'background-color',
    'rgb(51, 102, 153)',
  );
  await page.screenshot({ path: 'test-results/summary-observability.png', fullPage: true });
  // Verificar vencimiento de actividad en el navegador sin esperar diez minutos reales.
  await page.clock.install();
  await page.clock.fastForward(601000);
  await expect(stats).toContainText('0 activos · 3 sin señal reciente');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});

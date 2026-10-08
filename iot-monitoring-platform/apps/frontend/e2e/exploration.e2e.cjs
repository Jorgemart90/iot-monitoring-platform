const { test, expect } = require('@playwright/test');
test('exploration: custom temperatures, units, multiple sensors, zones, zoom and alert filters', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  const signed = page.waitForResponse(
    (r) => r.url().endsWith('/auth/demo') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Crear mi demo' }).click();
  const auth = await (await signed).json();
  const headers = { Authorization: `Bearer ${auth.access_token}` };
  const post = async (path, data) => {
    const r = await page.request.post('/api/v1/' + path, { headers, data });
    expect(r.status()).toBe(201);
    return r.json();
  };
  const north = await post('devices', {
    name: 'Sensor Norte',
    type: 'MULTI_SENSOR',
    location: 'Norte',
  });
  const south = await post('devices', {
    name: 'Sensor Sur',
    type: 'MULTI_SENSOR',
    location: 'Sur',
  });
  await post('rules', {
    name: 'Calor Norte',
    deviceId: north.id,
    metricField: 'temperature',
    condition: 'GREATER_THAN',
    threshold: 35,
    severity: 'HIGH',
  });
  await page.reload();
  const simulator = page.locator('p-simulator'),
    history = page.locator('p-sensor-history');
  await simulator.getByLabel('Sensor de destino').selectOption(north.id);
  const value = simulator.getByLabel('Temperatura a enviar'),
    send = simulator.getByRole('button', { name: 'Enviar lectura personalizada' });
  for (const invalid of ['501', '-273.16', '']) {
    await value.fill(invalid);
    await expect(send).toBeDisabled();
  }
  async function publish(display, canonical) {
    await value.fill(display);
    await expect(send).toBeEnabled();
    const sent = page.waitForResponse(
      (r) => r.url().endsWith('/api/demo/reading') && r.request().method() === 'POST',
    );
    await send.click();
    const response = await sent;
    expect(response.status()).toBe(202);
    expect(response.request().postDataJSON().temperature).toBeCloseTo(canonical, 5);
  }
  await publish('-20', -20);
  await simulator.getByLabel('Unidad de temperatura').selectOption('F');
  await expect(value).toHaveValue('-4');
  await value.fill('932.01');
  await expect(send).toBeDisabled();
  await publish('107.6', 42);
  await simulator.getByLabel('Sensor de destino').selectOption(south.id);
  await publish('68', 20);
  await expect(history.locator('polyline')).toHaveCount(2);
  const colors = await history
    .locator('polyline')
    .evaluateAll((lines) => lines.map((l) => l.getAttribute('stroke')));
  expect(new Set(colors).size).toBe(2);
  await history.getByLabel('Unidad de la gráfica').selectOption('C');
  await expect(value).toHaveValue('20');
  await history.getByLabel('Zona de la gráfica').selectOption('Norte');
  await history.getByRole('button', { name: 'Seleccionar zona', exact: true }).click();
  await expect(history.locator('polyline')).toHaveCount(1);
  await history.getByLabel('Zona de la gráfica').selectOption('');
  await history.getByRole('checkbox', { name: 'Sensor Sur', exact: true }).check();
  await expect(history.locator('polyline')).toHaveCount(2);
  await history.getByLabel('Periodo', { exact: true }).selectOption({ label: 'Última semana' });
  await history.getByRole('button', { name: 'Acercar gráfica', exact: true }).click();
  await expect(history.getByLabel('Periodo', { exact: true }).locator('option:checked')).toHaveText(
    'Personalizado',
  );
  await history.getByRole('button', { name: 'Alejar gráfica', exact: true }).click();
  await history.getByLabel('Periodo', { exact: true }).selectOption({ label: 'Últimos 30 días' });
  await page.screenshot({ path: 'test-results/exploration-desktop.png', fullPage: true });
  await page.getByRole('navigation').getByRole('button', { name: 'Alertas', exact: false }).click();
  const alerts = page.locator('p-alert-browser');
  await alerts.getByLabel('Zona de alertas').selectOption('Norte');
  await alerts.getByLabel('Tipo de alarma').selectOption('temperature');
  await alerts.getByLabel('Periodo', { exact: true }).selectOption({ label: 'Últimos 30 días' });
  await alerts.getByLabel('Agrupar alertas por').selectOption('device');
  await expect(alerts.locator('.alert-group')).toContainText('Sensor Norte');
  await expect(alerts.locator('tbody')).toContainText('42 °C');
  await alerts.getByLabel('Agrupar alertas por').selectOption('type');
  await expect(alerts.locator('.alert-group')).toContainText('Temperatura');
  await alerts.getByLabel('Zona de alertas').selectOption('Sur');
  await expect(
    alerts.getByRole('heading', { name: 'No hay alertas con estos filtros' }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});

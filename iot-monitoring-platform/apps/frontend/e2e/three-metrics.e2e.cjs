const { test, expect } = require('@playwright/test');
test('three metrics: partial guide retry, all alerts, manual isolation, limits and automatic signals', async ({
  page,
}) => {
  await page.goto('/');
  const authResponse = page.waitForResponse(
    (r) => r.url().endsWith('/auth/demo') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Crear mi demo' }).click();
  const auth = await (await authResponse).json(),
    headers = { Authorization: `Bearer ${auth.access_token}` };
  await page.getByRole('button', { name: 'Preparar mi recorrido' }).click();
  const guide = page.getByRole('region', { name: 'Recorrido guiado' });
  let failed = false;
  await page.route('**/api/v1/rules', (route) => {
    if (
      route.request().method() === 'POST' &&
      route.request().postDataJSON().metricField === 'humidity' &&
      !failed
    ) {
      failed = true;
      return route.fulfill({ status: 503, json: { message: 'Fallo temporal de humedad' } });
    }
    return route.continue();
  });
  await page.getByRole('button', { name: 'Crear reglas del recorrido' }).click();
  await expect(guide.getByRole('alert')).toContainText('Fallo temporal');
  await page.reload();
  await page.getByRole('button', { name: 'Crear reglas del recorrido' }).click();
  await expect(guide.locator('[data-step="3"]')).toHaveAttribute('aria-current', 'step');
  const rules = (await (await page.request.get('/api/v1/rules', { headers })).json()).data;
  expect(rules).toHaveLength(3);
  expect(new Set(rules.map((r) => r.metricField)).size).toBe(3);
  await page.getByRole('button', { name: 'Enviar lectura y recibir alertas' }).click();
  await expect(guide.locator('.guide-success')).toBeVisible();
  const alerts = (await (await page.request.get('/api/v1/alerts', { headers })).json()).data;
  expect(new Set(alerts.map((a) => a.rule.metricField)).size).toBe(3);
  const stats = page.locator('.overview-stats');
  await expect(stats.locator('article').filter({ hasText: 'Presión' })).toContainText('1.080');
  await expect(stats.locator('article').filter({ hasText: 'Humedad' })).toContainText('85');
  const sim = page.locator('p-simulator'),
    send = sim.getByRole('button', { name: 'Enviar lectura personalizada' });
  for (const [metric, label, value, bad] of [
    ['humidity', 'Humedad', '60', '101'],
    ['pressure', 'Presión', '990', '2001'],
  ]) {
    await sim.getByLabel('Métrica a enviar').selectOption(metric);
    const input = sim.getByLabel(label + ' a enviar');
    for (const invalid of ['', '-1', bad]) {
      await input.fill(invalid);
      await expect(send).toBeDisabled();
    }
    await input.fill(value);
    const pending = page.waitForResponse(
      (r) => r.url().endsWith('/api/demo/reading') && r.request().method() === 'POST',
    );
    await send.click();
    const response = await pending;
    expect(response.status()).toBe(202);
    expect(response.request().postDataJSON()).toEqual({
      deviceId: rules[0].deviceId,
      [metric]: Number(value),
    });
    const sent = (await response.json()).reading;
    expect(sent[metric]).toBe(Number(value));
    expect(sent.temperature).toBeUndefined();
  }
  const id = rules[0].deviceId;
  for (const body of [
    {},
    { humidity: null },
    { humidity: '50' },
    { humidity: 101 },
    { pressure: -1 },
    { pressure: 2001 },
    { temperature: 30, humidity: 101 },
  ]) {
    const r = await page.request.post('/api/demo/reading', {
      headers,
      data: { deviceId: id, ...body },
    });
    expect(r.status()).toBe(400);
  }
  for (const body of [{ humidity: 0 }, { humidity: 100 }, { pressure: 0 }, { pressure: 2000 }]) {
    const r = await page.request.post('/api/demo/reading', {
      headers,
      data: { deviceId: id, ...body },
    });
    expect(r.status()).toBe(202);
  }
  const automatic = page.waitForResponse(
    (r) => r.url().endsWith('/api/demo/reading') && r.request().method() === 'POST',
  );
  await sim.getByRole('button', { name: 'Iniciar lecturas continuas' }).click();
  const all = (await automatic).request().postDataJSON();
  expect(typeof all.temperature).toBe('number');
  expect(typeof all.humidity).toBe('number');
  expect(typeof all.pressure).toBe('number');
  await sim.getByRole('button', { name: 'Detener simulación' }).click();
  await page.screenshot({ path: 'test-results/three-metrics.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
});

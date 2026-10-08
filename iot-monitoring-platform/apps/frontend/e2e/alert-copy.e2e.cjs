const { test, expect } = require('@playwright/test');
test('alert copy: legacy values, Spanish description, custom text and separated lines', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Crear mi demo' }).click();
  const base = {
    deviceId: 'sensor',
    severity: 'HIGH',
    status: 'RESOLVED',
    triggeredValue: 42,
    triggeredAt: new Date().toISOString(),
    ruleId: 'rule',
    rule: {
      name: 'Temperatura alta · Recorrido',
      metricField: 'temperature',
      threshold: 99,
      condition: 'GREATER_THAN',
    },
  };
  await page.route('**/api/v1/alerts?*', (route) =>
    route.fulfill({
      json: {
        data: [
          {
            ...base,
            id: 'legacy',
            message:
              'Rule "Temperatura alta · Recorrido" triggered: temperature = 42 (condition: GREATER_THAN 35.00)',
          },
          {
            ...base,
            id: 'custom',
            message: 'Revisar ventilación antes de reiniciar',
            rule: { ...base.rule, customMessage: 'Revisar ventilación antes de reiniciar' },
          },
        ],
        meta: { total: 2, totalPages: 1, page: 1, limit: 50 },
      },
    }),
  );
  await page.getByRole('navigation').getByRole('button', { name: 'Alertas', exact: false }).click();
  const rows = page.locator('p-alert-browser tbody tr');
  await expect(rows).toHaveCount(2);
  await expect(rows.first().locator('.alert-message')).toHaveText(
    'Temperatura: 42 °C. Supera el umbral de 35 °C.',
  );
  await expect(rows.last().locator('.alert-message')).toHaveText(
    'Revisar ventilación antes de reiniciar',
  );
  await expect(rows.first().locator('.alert-description > strong')).toHaveCSS('display', 'block');
  await expect(rows.first().locator('.alert-description > small')).toHaveCSS('display', 'block');
  await page.screenshot({ path: 'test-results/alert-copy.png', fullPage: true });
});

const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.cjs',
  timeout: 90000,
  expect: { timeout: 20000 },
  workers: 1,
  use: {
    baseURL: process.env.FRONTEND_URL || 'http://localhost:5173',
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
  },
  reporter: 'list',
});

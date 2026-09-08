import { defineConfig, devices } from '@playwright/test';
import { HA_URL, USERS } from './scripts/users.mjs';

const CI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  // One Home Assistant, one plan: journeys mutate shared state (lights, the
  // plan itself), so they run one after another, in file order.
  fullyParallel: false,
  workers: 1,
  retries: CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: CI
    ? [['list'], ['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'on-failure' }]],
  use: {
    baseURL: HA_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'en-US',
    timezoneId: 'Europe/Moscow',
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.mjs/ },
    {
      name: 'admin',
      testMatch: /.*\.admin\.spec\.mjs/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: USERS.admin.storageState },
    },
    {
      name: 'viewer',
      testMatch: /.*\.viewer\.spec\.mjs/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: USERS.viewer.storageState },
    },
    {
      name: 'mobile',
      testMatch: /.*\.mobile\.spec\.mjs/,
      dependencies: ['setup'],
      use: { ...devices['Pixel 7'], storageState: USERS.admin.storageState },
    },
  ],
});

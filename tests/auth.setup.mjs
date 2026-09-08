// Log both test users in through the real login page once; every journey
// starts from the saved browser state, the way a returning user does.
import { test as setup } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { USERS } from '../scripts/users.mjs';
import { loginThroughUi } from './lib/ha-page.mjs';

mkdirSync('.auth', { recursive: true });

for (const [role, user] of Object.entries(USERS)) {
  setup(`login as ${role} (${user.username})`, async ({ page }) => {
    await loginThroughUi(page, user);
    await page.context().storageState({ path: user.storageState });
  });
}

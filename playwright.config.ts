import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'npm --prefix frontend run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 120000,
    env: {
      VITE_API_URL: 'http://127.0.0.1:3001',
      VITE_FIREBASE_API_KEY: 'e2e-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'e2e.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'e2e-project',
      VITE_FIREBASE_APP_ID: 'e2e-app-id',
      VITE_PUZZLE_SEED_NAMESPACE: 'logic-looper-e2e',
      VITE_TRUECALLER_APP_KEY: 'e2e-truecaller-key',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})


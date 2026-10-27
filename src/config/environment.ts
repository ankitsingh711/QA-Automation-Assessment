import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';

/**
 * Single source of truth for environment-specific settings.
 *
 * Resolution order (first wins):
 *   1. real environment variables (e.g. `BASE_URL=... npm test`)
 *   2. config/env/<TEST_ENV>.env   (TEST_ENV defaults to "local")
 */
export const ROOT_DIR = path.resolve(__dirname, '../..');

const envName = process.env.TEST_ENV ?? 'local';
const envFile = path.join(ROOT_DIR, 'config', 'env', `${envName}.env`);
if (!fs.existsSync(envFile)) {
  throw new Error(`Unknown TEST_ENV "${envName}": ${envFile} does not exist`);
}
dotenv.config({ path: envFile, quiet: true });

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required config value ${name} (env: ${envName})`);
  return value;
}

const num = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (Number.isNaN(value)) throw new Error(`Config value ${name} must be a number, got "${raw}"`);
  return value;
};

const bool = (name: string, fallback: boolean): boolean => {
  const raw = process.env[name];
  return raw === undefined || raw === '' ? fallback : raw.toLowerCase() === 'true';
};

export type BrowserName = 'chromium' | 'firefox' | 'webkit';
export type ScreenshotMode = 'always' | 'failure' | 'off';

export const config = {
  envName,
  baseUrl: required('BASE_URL'),
  startApp: bool('START_APP', false),
  apiBaseUrl: required('API_BASE_URL'),
  browser: (process.env.BROWSER ?? 'chromium') as BrowserName,
  headless: bool('HEADLESS', true),
  slowMoMs: num('SLOW_MO_MS', 0),
  viewport: { width: num('VIEWPORT_WIDTH', 1280), height: num('VIEWPORT_HEIGHT', 900) },
  stepTimeoutMs: num('STEP_TIMEOUT_MS', 60_000),
  actionTimeoutMs: num('ACTION_TIMEOUT_MS', 10_000),
  apiMaxResponseMs: num('API_MAX_RESPONSE_MS', 10_000),
  screenshots: (process.env.SCREENSHOTS ?? 'always') as ScreenshotMode,
  traceOnFailure: (process.env.TRACE ?? 'on-failure') === 'on-failure',
  reportsRoot: path.join(ROOT_DIR, 'reports'),
} as const;

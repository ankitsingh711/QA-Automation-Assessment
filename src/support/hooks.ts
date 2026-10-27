import fs from 'node:fs';
import path from 'node:path';
import type { Server } from 'node:http';
import { After, AfterAll, Before, Status, setDefaultTimeout, type ITestCaseHookParameter } from '@cucumber/cucumber';
import { chromium, firefox, webkit, request, type Browser } from '@playwright/test';
import { config } from '../config/environment';
import type { TestWorld } from './world';

const { startServer } = require('../../app/server.js') as { startServer: (port: number, host: string) => Promise<Server> };

setDefaultTimeout(config.stepTimeoutMs);

let browser: Browser | undefined;
let appServer: Server | undefined;

/** Browser and app server are started lazily so API-only runs never pay for them. */
async function ensureBrowser(): Promise<Browser> {
  if (config.startApp && !appServer) {
    const url = new URL(config.baseUrl);
    appServer = await startServer(Number(url.port || 80), url.hostname);
  }
  if (!browser) {
    browser = await { chromium, firefox, webkit }[config.browser].launch({ headless: config.headless, slowMo: config.slowMoMs });
  }
  return browser;
}

/** reports/<profile>/ — the profile name comes from worldParameters in cucumber.js. */
function reportDir(world: TestWorld, sub: string): string {
  const dir = path.join(config.reportsRoot, String(world.parameters.reportName ?? 'adhoc'), sub);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const usedNames = new Set<string>();

/** Readable, unique file name per scenario (outline rows can share a title). */
function fileSafe(name: string): string {
  const base = name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 120);
  let unique = base;
  for (let n = 2; usedNames.has(unique); n++) unique = `${base}-${n}`;
  usedNames.add(unique);
  return unique;
}

Before({ tags: '@ui' }, async function (this: TestWorld) {
  const activeBrowser = await ensureBrowser();
  this.context = await activeBrowser.newContext({ baseURL: config.baseUrl, viewport: config.viewport, locale: 'en-IN' });
  this.context.setDefaultTimeout(config.actionTimeoutMs);
  if (config.traceOnFailure) {
    await this.context.tracing.start({ screenshots: true, snapshots: true });
  }
  this.page = await this.context.newPage();
});

Before({ tags: '@api' }, async function (this: TestWorld) {
  this.apiContext = await request.newContext({
    baseURL: config.apiBaseUrl,
    extraHTTPHeaders: { Accept: 'application/json' },
    timeout: config.stepTimeoutMs,
  });
});

After(async function (this: TestWorld, { pickle, result }: ITestCaseHookParameter) {
  const failed = result?.status === Status.FAILED;
  const name = fileSafe(`${path.basename(pickle.uri, '.feature')}--${pickle.name}`);

  if (this.page && !this.page.isClosed()) {
    if (config.screenshots === 'always' || (config.screenshots === 'failure' && failed)) {
      const image = await this.page.screenshot({ fullPage: true, path: path.join(reportDir(this, 'screenshots'), `${name}.png`) });
      this.attach(image, 'image/png');
    }
  }

  if (this.context) {
    if (config.traceOnFailure) {
      await this.context.tracing.stop(failed ? { path: path.join(reportDir(this, 'traces'), `${name}.zip`) } : undefined);
    }
    await this.context.close();
  }

  await this.apiContext?.dispose();
});

AfterAll(async function () {
  await browser?.close();
  await new Promise<void>((resolve) => (appServer ? appServer.close(() => resolve()) : resolve()));
});

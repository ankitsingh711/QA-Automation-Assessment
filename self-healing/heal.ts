/**
 * Self-healing locator POC.
 *
 *   npm run heal                         # auto: Claude if ANTHROPIC_API_KEY is set, otherwise offline heuristic
 *   npm run heal -- --provider=claude    # force Claude
 *   npm run heal -- --provider=heuristic # force offline
 *   npm run heal -- --only=emiValue      # one locator
 *
 * Pipeline per locator: detect → capture page → suggest → validate → report + patch.
 * Nothing is written to src/: the output is a report and a patch for a human (or a PR) to review.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { Server } from 'node:http';
import { chromium, type Browser, type Page } from '@playwright/test';
import { config, ROOT_DIR } from '../src/config/environment';
import { LEGACY_LOCATORS, type LegacyLocator } from '../src/pages/legacy/LegacyDashboardPage';
import { capturePage } from './pageSnapshot';
import { toCode, type LocatorSpec } from './locatorSpec';
import { validateCandidate, type Check } from './validate';
import { ClaudeProvider } from './providers/claudeProvider';
import { HeuristicProvider } from './providers/heuristicProvider';
import type { HealingProvider, Suggestion } from './providers/types';

const { startServer } = require('../app/server.js') as { startServer: (port: number, host: string) => Promise<Server> };

const OUTPUT_DIR = path.join(ROOT_DIR, 'reports', 'self-healing');
const PAGE_OBJECT = path.join(ROOT_DIR, 'src', 'pages', 'legacy', 'LegacyDashboardPage.ts');
/** A tie between two candidates scores 0.5 — it must be broken by evidence, not by DOM order. */
const MIN_CONFIDENCE = 0.55;

interface Attempt {
  suggestion: Suggestion;
  code: string;
  checks: Check[];
  passed: boolean;
}

interface Outcome {
  key: string;
  locator: LegacyLocator;
  status: 'healthy' | 'healed' | 'unresolved';
  failure?: string;
  healed?: { spec: LocatorSpec; code: string; confidence: number; rationale: string };
  attempts: Attempt[];
  error?: string;
}

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
}

function chooseProvider(): HealingProvider {
  const requested = arg('provider') ?? 'auto';
  const hasCredentials = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  if (requested === 'claude' || (requested === 'auto' && hasCredentials)) return new ClaudeProvider();
  return new HeuristicProvider();
}

/** Detection: run the old selector the way the test would, and capture Playwright's own error. */
async function detect(page: Page, selector: string): Promise<string | null> {
  try {
    await page.locator(selector).waitFor({ state: 'visible', timeout: 2000 });
    return (await page.locator(selector).count()) === 1 ? null : `strict mode: selector matches ${await page.locator(selector).count()} elements`;
  } catch (error) {
    return (error as Error).message.split('\n').slice(0, 3).join(' ');
  }
}

async function healOne(browser: Browser, provider: HealingProvider, key: string, locator: LegacyLocator): Promise<Outcome> {
  const openFreshPage = async () => {
    const page = await browser.newPage({ viewport: config.viewport });
    await page.goto(config.baseUrl);
    return page;
  };

  const page = await openFreshPage();
  const failure = await detect(page, locator.selector);
  if (!failure) return { key, locator, status: 'healthy', attempts: [] };

  const snapshot = await capturePage(page);
  await page.close();

  let suggestions: Suggestion[];
  try {
    suggestions = await provider.suggest({ key, locator, failure, snapshot });
  } catch (error) {
    return { key, locator, status: 'unresolved', failure, attempts: [], error: (error as Error).message };
  }

  const attempts: Attempt[] = [];
  for (const suggestion of suggestions) {
    const result = await validateCandidate(openFreshPage, locator, suggestion.spec, MIN_CONFIDENCE, suggestion.confidence);
    attempts.push({ suggestion, code: toCode(suggestion.spec), ...result });
    if (result.passed) {
      return {
        key,
        locator,
        status: 'healed',
        failure,
        attempts,
        healed: { spec: suggestion.spec, code: toCode(suggestion.spec), confidence: suggestion.confidence, rationale: suggestion.rationale },
      };
    }
  }
  return { key, locator, status: 'unresolved', failure, attempts };
}

/** Builds a patched copy of the page object and a unified diff — never touches the original. */
function writePatch(outcomes: Outcome[]): string | null {
  const healed = outcomes.filter((o) => o.healed);
  if (!healed.length) return null;
  let source = fs.readFileSync(PAGE_OBJECT, 'utf8');
  for (const { key, healed: fix } of healed) {
    source = source.replace(`this.page.locator(LEGACY_LOCATORS.${key}.selector)`, `this.page.${fix!.code}`);
  }
  const healedFile = path.join(OUTPUT_DIR, 'LegacyDashboardPage.healed.ts');
  fs.writeFileSync(healedFile, source);
  const diff = spawnSync('diff', ['-u', '--label', 'a/src/pages/legacy/LegacyDashboardPage.ts', '--label', 'b/src/pages/legacy/LegacyDashboardPage.ts', PAGE_OBJECT, healedFile], { encoding: 'utf8' });
  const patchFile = path.join(OUTPUT_DIR, 'LegacyDashboardPage.healed.patch');
  fs.writeFileSync(patchFile, diff.stdout);
  return patchFile;
}

function writeReport(provider: HealingProvider, outcomes: Outcome[], patchFile: string | null): string {
  const icon = { healthy: '✅ healthy', healed: '🩹 healed', unresolved: '❌ needs a human' } as const;
  const lines = [
    '# Self-healing report',
    '',
    `- Generated: ${new Date().toISOString()}`,
    `- Provider: ${provider.name}`,
    `- Page under test: ${config.baseUrl}`,
    `- Confidence threshold: ${MIN_CONFIDENCE}`,
    patchFile ? `- Proposed patch (not applied): \`${path.relative(ROOT_DIR, patchFile)}\`` : '- No patch produced',
    '',
    '| Locator | Broken selector | Status | Proposed locator | Confidence |',
    '|---|---|---|---|---|',
    ...outcomes.map((o) => `| \`${o.key}\` | \`${o.locator.selector}\` | ${icon[o.status]} | ${o.healed ? `\`${o.healed.code}\`` : '—'} | ${o.healed?.confidence ?? '—'} |`),
    '',
  ];
  for (const o of outcomes.filter((x) => x.status !== 'healthy')) {
    lines.push(`## \`${o.key}\` — ${icon[o.status]}`, '', `**Intent:** ${o.locator.intent}`, '', `**Detected failure:** \`${o.failure}\``, '');
    if (o.error) lines.push(`**Provider error:** ${o.error}`, '');
    o.attempts.forEach((a, i) => {
      lines.push(`### Candidate ${i + 1}: \`${a.code}\` — ${a.passed ? 'accepted' : 'rejected'}`, '', `_${a.suggestion.rationale}_ (confidence ${a.suggestion.confidence})`, '', '| Gate | Result | Detail |', '|---|---|---|');
      for (const c of a.checks) lines.push(`| ${c.name} | ${c.ok ? 'pass' : '**fail**'} | ${c.detail.replace(/\|/g, '\\|')} |`);
      lines.push('');
    });
  }
  const reportFile = path.join(OUTPUT_DIR, 'healing-report.md');
  fs.writeFileSync(reportFile, lines.join('\n'));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'healing-suggestions.json'), JSON.stringify({ provider: provider.name, outcomes }, null, 2));
  return reportFile;
}

async function main(): Promise<void> {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const provider = chooseProvider();
  const only = arg('only');
  const entries = Object.entries(LEGACY_LOCATORS as Record<string, LegacyLocator>).filter(([key]) => !only || key === only);

  let server: Server | undefined;
  if (config.startApp) {
    const url = new URL(config.baseUrl);
    server = await startServer(Number(url.port || 80), url.hostname);
  }
  const browser = await chromium.launch({ headless: config.headless });

  console.log(`Self-healing ${entries.length} locator(s) with provider: ${provider.name}\n`);
  const outcomes: Outcome[] = [];
  try {
    for (const [key, locator] of entries) {
      const outcome = await healOne(browser, provider, key, locator);
      outcomes.push(outcome);
      const detail = outcome.healed ? `→ ${outcome.healed.code}` : outcome.error ?? (outcome.status === 'unresolved' ? `${outcome.attempts.length} candidate(s) rejected` : '');
      console.log(`  ${outcome.status.padEnd(10)} ${key.padEnd(18)} ${detail}`);
    }
  } finally {
    await browser.close();
    server?.close();
  }

  const patchFile = writePatch(outcomes);
  const reportFile = writeReport(provider, outcomes, patchFile);
  console.log(`\nReport: ${path.relative(ROOT_DIR, reportFile)}`);
  if (patchFile) console.log(`Patch:  ${path.relative(ROOT_DIR, patchFile)}  (review, then: git apply ${path.relative(ROOT_DIR, patchFile)})`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

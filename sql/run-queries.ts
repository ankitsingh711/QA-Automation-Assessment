/**
 * Builds a fresh SQLite database from schema.sql + seed.sql, runs every scenario query,
 * checks the result against the rows the seed data was designed to produce, and saves
 * evidence to sql/results/: plain-text output plus a PNG "screenshot" of each query and result.
 *
 *   npm run sql
 *
 * Requires the sqlite3 CLI (3.25+ for window functions; 3.33+ for box output).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';

const SQL_DIR = __dirname;
const RESULTS_DIR = path.join(SQL_DIR, 'results');
const DB_FILE = path.join(RESULTS_DIR, 'assessment.db');

interface QueryCase {
  file: string;
  title: string;
  /** Expected rows, projected to the columns that identify a result. */
  expected: string[];
  key: (row: Record<string, unknown>) => string;
}

const CASES: QueryCase[] = [
  {
    file: 'scenario1_round_trip_transfers.sql',
    title: 'Scenario 1 — Round-trip transfers within 24h and 10%',
    key: (r) => `${r.outbound_txn}->${r.return_txn}`,
    expected: ['1->2', '3->4', '13->14', '16->17', '16->18'],
  },
  {
    file: 'scenario2_ipl_streaks.sql',
    title: 'Scenario 2 — 30+ runs in 3+ consecutive innings (2024)',
    key: (r) => `${r.player_name}@${r.streak_start}`,
    expected: ['Arjun Mehta@2024-03-22', 'Sameer Khan@2024-03-22', 'Dev Malhotra@2024-03-24', 'Rohan Iyer@2024-03-27', 'Arjun Mehta@2024-04-12'],
  },
  {
    file: 'scenario2b_ipl_streaks_team_fixtures.sql',
    title: 'Scenario 2b — streaks over consecutive team fixtures (variant)',
    key: (r) => `${r.player_name}@${r.streak_start}`,
    expected: ['Arjun Mehta@2024-03-22', 'Dev Malhotra@2024-03-24', 'Rohan Iyer@2024-03-27', 'Arjun Mehta@2024-04-12'],
  },
];

function sqlite(args: string[], input: string): string {
  const run = spawnSync('sqlite3', [...args, DB_FILE], { input, encoding: 'utf8' });
  if (run.error) throw new Error(`sqlite3 CLI not available: ${run.error.message}`);
  if (run.status !== 0) throw new Error(run.stderr);
  return run.stdout;
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function evidencePage(title: string, command: string, query: string, output: string, verdict: string, ok: boolean): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { margin: 0; background: #1e1f24; color: #e6e6e6; font: 13px/1.45 Menlo, Consolas, monospace; }
    .bar { background: #2c2d33; padding: 8px 14px; color: #9aa0aa; font-family: system-ui, sans-serif; font-size: 12px; }
    .wrap { padding: 14px 18px 18px; }
    h1 { font: 600 15px system-ui, sans-serif; color: #fff; margin: 0 0 10px; }
    .prompt { color: #7fd17f; } .sql { color: #c6d0f5; white-space: pre; margin: 6px 0 14px; } .out { white-space: pre; color: #f1f1f1; }
    .verdict { margin-top: 12px; font-family: system-ui, sans-serif; font-weight: 600; color: ${ok ? '#7fd17f' : '#ff7b72'}; }
  </style></head><body><div class="bar">sqlite3 ${escapeHtml(sqlite(['-version'], '').trim().split(' ')[0])} — ${escapeHtml(path.basename(DB_FILE))}</div>
  <div class="wrap"><h1>${escapeHtml(title)}</h1>
  <div><span class="prompt">$</span> ${escapeHtml(command)}</div>
  <div class="sql">${escapeHtml(query.trim())}</div>
  <div class="out">${escapeHtml(output)}</div>
  <div class="verdict">${escapeHtml(verdict)}</div></div></body></html>`;
}

async function main(): Promise<void> {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.rmSync(DB_FILE, { force: true });
  sqlite([], fs.readFileSync(path.join(SQL_DIR, 'schema.sql'), 'utf8'));
  sqlite([], fs.readFileSync(path.join(SQL_DIR, 'seed.sql'), 'utf8'));

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 400 }, deviceScaleFactor: 2 });
  let failures = 0;

  try {
    const schema = sqlite([], '.schema');
    fs.writeFileSync(path.join(RESULTS_DIR, 'schema.txt'), schema);
    await page.setContent(evidencePage('Table schema', `sqlite3 ${path.basename(DB_FILE)} .schema`, '', schema, 'Schema loaded from sql/schema.sql', true));
    await page.screenshot({ path: path.join(RESULTS_DIR, 'schema.png'), fullPage: true });

    for (const c of CASES) {
      const query = fs.readFileSync(path.join(SQL_DIR, c.file), 'utf8');
      const box = sqlite(['-box'], query);
      const rows = JSON.parse(sqlite(['-json'], query) || '[]') as Array<Record<string, unknown>>;
      const actual = rows.map(c.key);
      const ok = JSON.stringify(actual) === JSON.stringify(c.expected);
      if (!ok) failures++;
      const verdict = ok
        ? `PASS — ${rows.length} row(s), exactly the rows the seed data was designed to produce`
        : `FAIL — expected ${JSON.stringify(c.expected)} but got ${JSON.stringify(actual)}`;

      const name = c.file.replace(/\.sql$/, '');
      fs.writeFileSync(path.join(RESULTS_DIR, `${name}.txt`), `${c.title}\n\n${box}\n${verdict}\n`);
      await page.setContent(evidencePage(c.title, `sqlite3 -box ${path.basename(DB_FILE)} < sql/${c.file}`, query, box, verdict, ok));
      await page.screenshot({ path: path.join(RESULTS_DIR, `${name}.png`), fullPage: true });
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.title}\n${box}`);
    }
  } finally {
    await browser.close();
  }

  console.log(`Evidence written to ${path.relative(process.cwd(), RESULTS_DIR)}/`);
  if (failures) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

/**
 * Cucumber profiles. Each profile writes its own report folder under reports/<name>/.
 *
 *   npm test                    -> default       (regression gate: UI + API, all must pass)
 *   npm run test:ui             -> ui
 *   npm run test:api            -> api
 *   npm run test:known-issues   -> knownIssues   (API contract checks that expose JSONPlaceholder defects)
 *   npm run test:self-healing   -> selfHealing   (intentionally broken locators)
 */
const common = {
  paths: ['features/**/*.feature'],
  requireModule: ['ts-node/register'],
  require: ['src/support/**/*.ts', 'src/steps/**/*.ts'],
  formatOptions: { snippetInterface: 'async-await', colorsEnabled: true },
};

function profile(reportName, tags) {
  return {
    ...common,
    tags,
    worldParameters: { reportName },
    format: [
      'pretty',
      `html:reports/${reportName}/cucumber-report.html`,
      `json:reports/${reportName}/cucumber-report.json`,
      `junit:reports/${reportName}/junit.xml`,
    ],
  };
}

module.exports = {
  default: profile('regression', 'not @known-issue and not @self-healing'),
  ui: profile('ui', '@ui and not @self-healing'),
  api: profile('api', '@api and not @known-issue'),
  knownIssues: profile('known-issues', '@known-issue'),
  selfHealing: profile('self-healing', '@self-healing'),
};

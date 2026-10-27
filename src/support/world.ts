import { setWorldConstructor, World, type IWorldOptions } from '@cucumber/cucumber';
import type { APIRequestContext, BrowserContext, Page } from '@playwright/test';
import { DashboardPage } from '../pages/DashboardPage';
import { ReportPage } from '../pages/ReportPage';
import { LegacyDashboardPage } from '../pages/legacy/LegacyDashboardPage';
import { PostsApi, type ApiResult, type PostPayload } from '../api/PostsApi';
import type { LoanInput } from '../utils/loanCalculator';

/**
 * Per-scenario state. Cucumber creates a fresh World for every scenario, so nothing
 * here leaks between scenarios. Browser/API contexts are created in hooks.ts.
 */
export class TestWorld extends World {
  context?: BrowserContext;
  page?: Page;
  apiContext?: APIRequestContext;

  /** Loan last entered through the UI — the oracle input for the "Then" steps. */
  loan?: LoanInput;
  /** First EMI month ("YYYY-MM") used for the last generated report. */
  reportStart?: string;

  postPayload?: PostPayload;
  apiResult?: ApiResult;

  private pages = new Map<string, unknown>();

  constructor(options: IWorldOptions) {
    super(options);
  }

  get currentPage(): Page {
    if (!this.page) throw new Error('No browser page — is the scenario tagged @ui?');
    return this.page;
  }

  private pageObject<T>(key: string, create: () => T): T {
    if (!this.pages.has(key)) this.pages.set(key, create());
    return this.pages.get(key) as T;
  }

  get dashboard(): DashboardPage {
    return this.pageObject('dashboard', () => new DashboardPage(this.currentPage));
  }

  get report(): ReportPage {
    return this.pageObject('report', () => new ReportPage(this.currentPage));
  }

  get legacyDashboard(): LegacyDashboardPage {
    return this.pageObject('legacyDashboard', () => new LegacyDashboardPage(this.currentPage));
  }

  get postsApi(): PostsApi {
    if (!this.apiContext) throw new Error('No API context — is the scenario tagged @api?');
    return this.pageObject('postsApi', () => new PostsApi(this.apiContext!));
  }

  get expectedLoan(): LoanInput {
    if (!this.loan) throw new Error('No loan has been entered in this scenario yet');
    return this.loan;
  }
}

setWorldConstructor(TestWorld);

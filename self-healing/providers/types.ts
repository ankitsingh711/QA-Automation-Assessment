import type { LegacyLocator } from '../../src/pages/legacy/LegacyDashboardPage';
import type { LocatorSpec } from '../locatorSpec';
import type { PageSnapshot } from '../pageSnapshot';

export interface HealingRequest {
  key: string;
  locator: LegacyLocator;
  /** The Playwright error the test produced — tells the model *how* it failed. */
  failure: string;
  snapshot: PageSnapshot;
}

export interface Suggestion {
  spec: LocatorSpec;
  confidence: number;
  rationale: string;
}

export interface HealingProvider {
  readonly name: string;
  suggest(request: HealingRequest): Promise<Suggestion[]>;
}

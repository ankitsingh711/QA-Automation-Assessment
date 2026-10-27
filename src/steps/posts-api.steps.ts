import { Given, Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import type { TestWorld } from '../support/world';
import { payloadFor } from '../data/postPayloads';
import { config } from '../config/environment';
import type { ApiResult, PostPayload } from '../api/PostsApi';

const preview = (text: string, max = 400) => (text.length > max ? `${text.slice(0, max)}… (${text.length} chars)` : text);

function result(world: TestWorld): ApiResult {
  if (!world.apiResult) throw new Error('No request has been sent in this scenario yet');
  return world.apiResult;
}

function sentJson(world: TestWorld): Record<string, unknown> {
  const payload = world.postPayload as PostPayload;
  if (payload.kind !== 'json' || Array.isArray(payload.body)) throw new Error('Scenario needs a JSON object payload');
  return payload.body;
}

function responseObject(world: TestWorld): Record<string, unknown> {
  const res = result(world);
  expect(res.isJson, `response should be JSON, got: ${preview(res.text)}`).toBe(true);
  return res.json as Record<string, unknown>;
}

Given(/^I have a post payload with (.+)$/, function (this: TestWorld, name: string) {
  this.postPayload = payloadFor(name);
});

When('I submit the post', async function (this: TestWorld) {
  const payload = this.postPayload as PostPayload;
  this.apiResult = await this.postsApi.create(payload);
  const res = this.apiResult;
  this.attach(
    [
      `POST ${config.apiBaseUrl}/posts`,
      `Payload: ${payload.description} (${res.requestBytes.toLocaleString()} bytes)`,
      `→ ${res.status} in ${res.elapsedMs} ms`,
      `Response: ${preview(res.text)}`,
    ].join('\n'),
    'text/plain',
  );
});

Then('the response status should be {int}', function (this: TestWorld, status: number) {
  const res = result(this);
  expect(res.status, `expected HTTP ${status}, got ${res.status}. Body: ${preview(res.text)}`).toBe(status);
});

Then('the response status should be one of {int}, {int} or {int}', function (this: TestWorld, a: number, b: number, c: number) {
  const res = result(this);
  expect([a, b, c], `expected one of ${a}/${b}/${c}, got ${res.status}. Body: ${preview(res.text)}`).toContain(res.status);
});

Then('the API should not fail with a server error', function (this: TestWorld) {
  const res = result(this);
  expect(res.status, `server-side failure (HTTP ${res.status}): ${preview(res.text)}`).toBeLessThan(500);
});

Then('the response body should be valid JSON', function (this: TestWorld) {
  responseObject(this);
});

Then('the response should arrive within the configured time limit', function (this: TestWorld) {
  expect(result(this).elapsedMs, `response time (limit ${config.apiMaxResponseMs} ms)`).toBeLessThanOrEqual(config.apiMaxResponseMs);
});

Then('the response should echo the submitted fields with a new id', function (this: TestWorld) {
  const body = responseObject(this);
  expect(body).toMatchObject(sentJson(this));
  expect(typeof body.id, 'new resource id').toBe('number');
  expect(body.id as number).toBeGreaterThan(0);
});

Then('the title in the response should be identical to the title I sent', function (this: TestWorld) {
  const sent = sentJson(this).title as string;
  const received = responseObject(this).title as string;
  expect(received.length, 'title length should be preserved').toBe(sent.length);
  expect(received === sent, 'title should round-trip byte-for-byte').toBe(true);
});

Then('the response should contain a validation error message', function (this: TestWorld) {
  const res = result(this);
  const body = (res.isJson ? res.json : {}) as Record<string, unknown>;
  const message = body.error ?? body.message ?? body.errors;
  expect(message, `expected an error/message field in the response, got: ${preview(res.text)}`).toBeTruthy();
});

Then('the response should not expose internal implementation details', function (this: TestWorld) {
  const { text } = result(this);
  // Stack frames, module paths and raw exception names should never reach a client.
  expect(text, 'response leaks internals').not.toMatch(/node_modules|\bat \S+ \(|SyntaxError|Traceback|Exception:/);
});

/**
 * Integration test of how often the server asks a platform for its key set (D-141), through the whole app with the
 * mock Canvas: launches whose ID token names a key the platform never published do not make the server fetch the
 * key set again and again.
 *
 * Spec: LTI-001, LTI-002
 */
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { openAppTestbed, type AppTestbed } from '../support/appTestbed.js';
import { launchFromCanvas } from '../support/ltiLaunchDriver.js';
import { describeWithServices } from '../support/services.js';

const claimsOf = (jwt: string): Record<string, unknown> =>
  JSON.parse(Buffer.from(jwt.split('.')[1] ?? '', 'base64url').toString('utf8')) as Record<string, unknown>;

describeWithServices('[LTI-001] the platform’s key set is not fetched for every unknown key', () => {
  let tb: AppTestbed;
  let published: string;
  beforeAll(async () => {
    tb = await openAppTestbed();
    published = await tb.activity(await tb.staffAccount(), { published: true });
  }, 60_000);
  afterAll(() => tb.close());

  it('[LTI-001] five launches that name an unpublished key cause no key-set fetch after the first launch’s', async () => {
    // Arrange: one genuine launch, which fetches and caches the platform's key set
    const spec = { custom: { contentId: published } };
    const genuine = await launchFromCanvas(tb.app, tb.mock.canvas, spec);
    const fetched = vi.spyOn(globalThis, 'fetch');
    const keySetFetches = () =>
      fetched.mock.calls.filter(([url]) => String(url).startsWith(tb.mock.canvas.jwksUrl)).length;
    // Act: the platform's own claims, signed with another key, under a key ID its key set does not hold
    const statuses: number[] = [];
    for (let n = 0; n < 5; n += 1) {
      const run = await launchFromCanvas(tb.app, tb.mock.canvas, spec, (token, canvas) =>
        canvas.signIdToken(claimsOf(token), { key: 'foreign', kid: `unpublished-key-${String(n)}` }),
      );
      statuses.push(run.res.status);
    }
    const after = keySetFetches();
    fetched.mockRestore();
    // Assert: every one is refused, and none made the server ask the platform again within the minute
    expect(genuine.path).toBe('/lti/play');
    expect(statuses).toEqual([400, 400, 400, 400, 400]);
    expect(after).toBe(0);
  });
});

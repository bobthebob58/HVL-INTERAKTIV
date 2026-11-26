/**
 * Tests that another site, or a path an author sets in an activity, cannot write the insight audit trail (DATA-007,
 * INS-009, D-106's amendment of 2026-11-05, D-146): a browser's top-level navigation, a request it marks as sent
 * from another origin, and an image, video, frame or prefetch that a page of our own origin loads are refused with
 * 403 before any audit event is written or the rate limit is taken, with or without the own-page header; so is any
 * request without that header, which is what a browser that sends no fetch metadata gives for a navigation or an
 * image. Our pages' fetches, with the header, are served and audited. The fetch metadata is what full Chromium sends.
 *
 * Spec: DATA-007, INS-009, INS-007
 */
import { OWN_PAGE_HEADER_NAME } from '@hvl-interaktiv/api-contract';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { PersonLimit } from '../../../src/learningDesign/collaboration/PersonRateLimit.js';
import { QUESTION_SET } from '../fixtures/insightActivities.js';
import { questionSetRows } from '../fixtures/thirtyLearners.js';
import { OWN_PAGE_FETCH } from '../../support/ownPageFetch.js';
import { reportOf } from '../support/insightFixtureReport.js';
import { insightStubApp } from './support/insightStubApp.js';

const CONTENT = '0190f5d2-0000-7000-8000-000000000001';
const BASE = `/api/content/${CONTENT}/insight`;

/** What a browser sends when a page on another site sets `location` to the URL. */
const CROSS_SITE_NAVIGATION = {
  'Sec-Fetch-Site': 'cross-site',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Dest': 'document',
};

/** What a browser sends for our own pages' `fetch` (the web client's `apiRequest`), the own-page header included. */
const SAME_ORIGIN_FETCH = {
  ...OWN_PAGE_FETCH,
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Dest': 'empty',
};
const ROUTES = ['', '/export?period=semester', '/contexts', '/findings'];

/** The insight app with a limit that counts its takes. */
function countingApp() {
  const takes: string[] = [];
  const limit: PersonLimit = {
    take: async (userId) => {
      takes.push(userId);
      return { allowed: true };
    },
  };
  return { ...insightStubApp(reportOf(QUESTION_SET, questionSetRows()), { limit }), takes };
}

describe('[DATA-007] another site cannot write the insight audit trail', () => {
  it('[DATA-007] a cross-site navigation to any insight route is 403, audits nothing and takes no limit', async () => {
    // Arrange
    const { app, audited, takes } = countingApp();
    // Act
    const answers = [];
    for (const route of ROUTES) {
      answers.push(await request(app).get(`${BASE}${route}`).set(CROSS_SITE_NAVIGATION));
      answers.push(
        await request(app)
          .get(`${BASE}${route}`)
          .set({ ...OWN_PAGE_FETCH, ...CROSS_SITE_NAVIGATION }),
      );
    }
    // Assert
    for (const res of answers) {
      expect(res.status).toBe(403);
      expect(res.body.errorCode).toBe('error.forbidden');
      expect(res.headers['content-disposition']).toBeUndefined();
    }
    expect(audited).toEqual([]);
    expect(takes).toEqual([]);
  });

  it('[DATA-007] a same-site fetch, a typed URL and a same-origin navigation are refused too', async () => {
    // Arrange
    const { app, audited, takes } = countingApp();
    const requests = [
      { 'Sec-Fetch-Site': 'same-site', 'Sec-Fetch-Mode': 'no-cors', 'Sec-Fetch-Dest': 'image' },
      { 'Sec-Fetch-Site': 'none', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document' },
      { 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document' },
    ];
    // Act
    const answers = [];
    for (const headers of requests) {
      answers.push(
        await request(app)
          .get(BASE)
          .set({ ...OWN_PAGE_FETCH, ...headers }),
      );
      answers.push(
        await request(app)
          .get(`${BASE}/export`)
          .set({ ...OWN_PAGE_FETCH, ...headers }),
      );
    }
    // Assert
    expect(answers.map((res) => res.status)).toEqual([403, 403, 403, 403, 403, 403]);
    expect(audited).toEqual([]);
    expect(takes).toEqual([]);
  });

  it('[DATA-007] an image, video, frame or prefetch our own page loads (a path in authored content) is refused', async () => {
    // Arrange: what full Chromium sends for `<img>`, `<video>`, `<iframe>` and `<link rel=prefetch>` on a page of our
    // origin, e.g. an H5P image whose path an author set to this URL (H5P plays an absolute path as it is).
    const { app, audited, takes } = countingApp();
    const requests = [
      { 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': 'no-cors', 'Sec-Fetch-Dest': 'image' },
      { 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': 'no-cors', 'Sec-Fetch-Dest': 'video' },
      { 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'iframe' },
      { 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': 'no-cors', 'Sec-Fetch-Dest': 'empty' },
    ];
    // Act
    const answers = [];
    for (const headers of requests) {
      answers.push(
        await request(app)
          .get(BASE)
          .set({ ...OWN_PAGE_FETCH, ...headers }),
      );
      answers.push(
        await request(app)
          .get(`${BASE}/export?period=semester`)
          .set({ ...OWN_PAGE_FETCH, ...headers }),
      );
    }
    // Assert
    expect(answers.map((res) => res.status)).toEqual(Array.from({ length: 8 }, () => 403));
    expect(audited).toEqual([]);
    expect(takes).toEqual([]);
  });

  it('[DATA-007] a request without the own-page header is refused, whatever else it sends', async () => {
    // Arrange: a browser without fetch metadata sends a navigation or an image like this; then a wrong value, and
    // the fetch metadata of our own page's fetch without the header
    const { app, audited, takes } = countingApp();
    const requests = [
      {},
      { [OWN_PAGE_HEADER_NAME]: 'yes' },
      { [OWN_PAGE_HEADER_NAME]: '' },
      { 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': 'cors', 'Sec-Fetch-Dest': 'empty' },
    ];
    // Act
    const answers = [];
    for (const headers of requests)
      for (const route of ROUTES) answers.push(await request(app).get(`${BASE}${route}`).set(headers));
    // Assert
    expect(answers.map((res) => res.status)).toEqual(Array.from({ length: 16 }, () => 403));
    expect(answers.every((res) => res.body.errorCode === 'error.forbidden')).toBe(true);
    expect(answers.every((res) => res.headers['content-disposition'] === undefined)).toBe(true);
    expect(audited).toEqual([]);
    expect(takes).toEqual([]);
  });

  it('[INS-009] our pages’ fetch, and a client that sends the header alone, get the view and the CSV, audited', async () => {
    // Arrange
    const { app, audited, takes } = countingApp();
    // Act
    const answers = [
      await request(app).get(BASE).set(SAME_ORIGIN_FETCH),
      await request(app).get(`${BASE}/export`).set(SAME_ORIGIN_FETCH),
      await request(app).get(`${BASE}/export`).set(OWN_PAGE_FETCH),
    ];
    // Assert
    expect(answers.map((res) => res.status)).toEqual([200, 200, 200]);
    expect(answers[1]?.headers['content-type']).toMatch(/^text\/csv/);
    expect(audited).toEqual([
      expect.objectContaining({ action: 'insight.view' }),
      expect.objectContaining({ action: 'insight.export' }),
      expect.objectContaining({ action: 'insight.export' }),
    ]);
    expect(takes).toHaveLength(3);
  });
});

/**
 * Tests for the xAPI bridge in a simulated player document (jsdom): where it starts and where it stays out (no
 * configuration, a Core iframe, another origin), which of P1's recorded statements it sends (D-115), the guard against
 * events raised in a Core iframe, and its statement and attempt IDs.
 *
 * Spec: LTI-010, H5P-009
 */
import { describe, expect, it } from 'vitest';
import {
  BRIDGE_SCRIPTS,
  CONTENT_ID,
  openBridgeDocument,
  p1Fixture,
  portalConfig,
  statement,
} from './support/bridgeDocument.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Plays one view of a P1 recording through a fresh page and returns what the bridge sent, as `verb root|sub`. */
async function sentFor(type: string, view = 1) {
  const { library, statements } = p1Fixture(type);
  const page = openBridgeDocument({ mainLibrary: library });
  for (const s of statements.filter((r) => r.view === view)) page.dispatch(s.statement);
  page.tick();
  await page.settle();
  const items = page.requests.flatMap((r) => r.body.statements);
  const kind = (item: Record<string, unknown>) =>
    `${String((item.verb as { id: string }).id)
      .split('/')
      .pop()} ${(item.object as { id: string }).id === CONTENT_ID ? 'root' : 'sub'}`;
  return { items, kinds: items.map(kind) };
}

describe('[LTI-010] where the bridge starts', () => {
  it('[LTI-010] does nothing without its configuration, as on an author’s page', async () => {
    // Arrange
    const page = openBridgeDocument({ config: null });
    // Act
    page.dispatch(statement('answered'));
    page.tick();
    await page.settle();
    // Assert
    expect([page.listening(), page.requests.length]).toEqual([0, 0]);
  });

  it('[H5P-009] stays out of H5P Core’s own iframe, and starts in a frame of the web app', () => {
    expect(openBridgeDocument({ frameClass: 'h5p-iframe' }).listening()).toBe(0);
    expect(openBridgeDocument({ frameClass: 'hvl-player-frame' }).listening()).toBe(1);
  });

  it.each(['//evil.example/x', 'https://evil.example/api/h5p/xapi', '/\\evil.example', 'api/h5p/xapi'])(
    '[LTI-010] refuses to start when the endpoint %s is not a same-origin path',
    (endpoint) => {
      expect(openBridgeDocument({ config: { ...portalConfig(), endpoint } }).listening()).toBe(0);
    },
  );

  it.each([{ contentVersion: 0 }, { contentVersion: '2' }, { contentId: 7 }])(
    '[LTI-010] refuses a configuration with %o',
    (change) => {
      expect(openBridgeDocument({ config: { ...portalConfig(), ...change } }).listening()).toBe(0);
    },
  );

  it('[LTI-010] registers once even when its file runs twice', () => {
    // Arrange
    const page = openBridgeDocument();
    // Act
    page.dom.window.eval(BRIDGE_SCRIPTS[2] ?? '');
    // Assert
    expect(page.listening()).toBe(1);
  });
});

describe('[LTI-010] what the bridge sends', () => {
  it.each([
    ['H5P.MultiChoice', 1, ['attempted root', 'answered root']],
    ['H5P.DragText', 2, ['attempted root']],
    ['H5P.QuestionSet', 1, ['attempted root', ...Array<string>(4).fill('answered sub'), 'completed root']],
    ['H5P.Column', 1, ['answered sub', 'answered sub', 'completed root']],
    ['H5P.CoursePresentation', 2, ['attempted root', 'completed root']],
    ['H5P.BranchingScenario', 1, ['attempted root', 'completed root']],
    ['H5P.ImageHotspots', 1, []],
  ] as const)(
    '[LTI-010] %s, view %i: only what the server stores, once each',
    async (type, view, expected) => {
      // Act
      const { kinds, items } = await sentFor(type, view);
      // Assert
      expect(kinds).toEqual(expected);
      expect(new Set(items.map((i) => i.statementId)).size).toBe(items.length);
    },
  );

  it('[LTI-010] sends only the first root attempted of a page load, never interacted or progressed', async () => {
    // Arrange
    const page = openBridgeDocument();
    // Act
    for (const verb of ['attempted', 'interacted', 'progressed', 'attempted', 'answered'])
      page.dispatch(statement(verb));
    page.tick();
    await page.settle();
    // Assert
    const verbs = page.requests[0]?.body.statements.map((i) =>
      (i.verb as { id: string }).id.split('/').pop(),
    );
    expect(verbs).toEqual(['attempted', 'answered']);
  });

  it('[H5P-009] ignores an event that H5P marks as raised in its own iframe, which the parent’s bridge sends', async () => {
    // Arrange
    const page = openBridgeDocument();
    page.h5p.externalEmbed = false;
    // Act
    page.dispatch(statement('answered'));
    page.h5p.externalEmbed = undefined;
    page.dispatch(statement('completed'));
    page.tick();
    await page.settle();
    // Assert
    expect(page.requests[0]?.body.statements.map((i) => (i.verb as { id: string }).id)).toEqual([
      'http://adlnet.gov/expapi/verbs/completed',
    ]);
  });

  it('[LTI-010] never throws into H5P, whatever the event carries', () => {
    const page = openBridgeDocument();
    const listeners = [null, {}, { data: null }, { data: { statement: { verb: { id: 3 } } } }];
    expect(() => listeners.forEach((event) => page.dispatch(event as never))).not.toThrow();
  });
});

describe('[LTI-010] statement and attempt IDs', () => {
  it('[LTI-010] a new attempt starts right after each root result with a maximum above 0', async () => {
    // Arrange
    const page = openBridgeDocument();
    const scored = (max: number) => ({
      result: { score: { min: 0, raw: max, max, ...(max ? { scaled: 1 } : {}) } },
    });
    const sub = { object: { id: `${CONTENT_ID}?subContentId=s1` }, ...scored(1) };
    // Act: load, a sub result, the root result, a retry's root result, a result without maximum, then one more
    for (const s of [
      statement('attempted'),
      statement('answered', sub),
      statement('answered', scored(1)),
      statement('answered', scored(1)),
      statement('completed', scored(0)),
      statement('answered', sub),
    ])
      page.dispatch(s);
    page.tick();
    await page.settle();
    // Assert
    const items = page.requests[0]?.body.statements ?? [];
    const [viewId] = String(items[0]?.attemptId).split(':');
    expect(viewId).toMatch(UUID);
    expect(items.map((i) => String(i.attemptId).replace(`${viewId}:`, ''))).toEqual([
      '1',
      '1',
      '1',
      '2',
      '3',
      '3',
    ]);
    expect(items.every((i) => UUID.test(String(i.statementId)))).toBe(true);
    expect(new Set(items.map((i) => i.statementId)).size).toBe(items.length);
  });

  it('[LTI-010] each page load has its own view, so a reload starts at attempt 1 again', async () => {
    // Arrange
    const first = await sentFor('H5P.CoursePresentation', 1);
    // Act
    const second = await sentFor('H5P.CoursePresentation', 2);
    // Assert
    const view = (items: Record<string, unknown>[]) =>
      new Set(items.map((i) => String(i.attemptId).split(':')[0]));
    expect(view(first.items).size).toBe(1);
    expect([...view(first.items)][0]).not.toBe([...view(second.items)][0]);
    expect(second.items.map((i) => String(i.attemptId).split(':')[1])).toEqual(['1', '1']);
  });
});

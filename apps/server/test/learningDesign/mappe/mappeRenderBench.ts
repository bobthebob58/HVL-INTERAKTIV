/**
 * mappeRenderBench — renders the fixture's pedagogisk mappe without a database, the way `MappeRenderer.render` does:
 * activities as the source module reads them, the reader's guide and references blocks, the view, and both renders.
 *
 * Why: the renderer's rules (the criteria set's texts, the word count without the blocks, the escaping of authors'
 *      text, the placeholders) are pure; testing them on the fixture without PostgreSQL keeps those tests fast and
 *      exact, and the integration tests check the same path through the routes (MAPPE-001, MAPPE-002).
 * Spec: MAPPE-002
 * Invariants:
 *   - Uses the server's own modules in the order `MappeRenderer` uses them; only the rows are made up here.
 * Collaborators: ../../../src/learningDesign/mappe/ (the modules under test), ../../support/mappeFixture.ts.
 * Tests: apps/server/test/learningDesign/mappe/mappeRender.test.ts, apps/server/test/learningDesign/mappe/mappeView.test.ts
 */
import type { Locale } from '../../../src/i18n/translate.js';
import type { StudioContent } from '../../../src/learningDesign/content/loadStudioContent.js';
import type { ActivityAggregates } from '../../../src/learningDesign/mappe/activityResults.js';
import type { MappeActivityInputs } from '../../../src/learningDesign/mappe/mappeActivityView.js';
import type { MappeSourceActivity } from '../../../src/learningDesign/mappe/mappeActivitySource.js';
import { readersGuideBlock, referencesBlock } from '../../../src/learningDesign/mappe/mappeBlocks.js';
import type { MappeFinding } from '../../../src/learningDesign/mappe/mappeFindings.js';
import { mappeFormat } from '../../../src/learningDesign/mappe/mappeFormat.js';
import { renderMappe, type RenderedMappeMarkdown } from '../../../src/learningDesign/mappe/mappeRender.js';
import { mappeView } from '../../../src/learningDesign/mappe/mappeView.js';
import { FIXTURE_SETS, studioContentWithMappe } from '../../support/mappeFixture.js';

let defaultContent: StudioContent | undefined;

/**
 * The real studio content with the fixture's mappe, loaded once per test file.
 * @returns The content.
 */
export const benchContent = (): StudioContent => (defaultContent ??= studioContentWithMappe());

/** The moment every bench render is made at: 29 October 2026, 12:00 in Oslo. */
export const BENCH_NOW = new Date('2026-10-29T11:00:00.000Z');

/** An activity as the source module reads it, with defaults for every field. */
export function sourceActivity(overrides: Partial<MappeSourceActivity> = {}): MappeSourceActivity {
  return {
    id: '0192f0c4-0000-7000-8000-000000000001',
    title: 'Blåbærquiz',
    mainLibrary: 'H5P.MultiChoice',
    params: {},
    metadata: {},
    status: 'published',
    createdAt: new Date('2026-09-01T10:00:00.000Z'),
    updatedAt: new Date('2026-10-01T10:00:00.000Z'),
    publishedAt: new Date('2026-10-02T10:00:00.000Z'),
    outcomes: [],
    collaborative: false,
    acknowledgements: [],
    ...overrides,
  };
}

/** One activity of a bench render: the activity and, optionally, its findings and aggregates. */
export interface BenchActivity {
  readonly activity: MappeSourceActivity;
  readonly findings?: readonly MappeFinding[];
  readonly aggregates?: ActivityAggregates;
}

/** What a bench render takes; every field has a default. */
export interface BenchOptions {
  readonly content?: StudioContent;
  readonly set?: string;
  readonly locale?: Locale;
  readonly activities?: readonly BenchActivity[];
  readonly authorName?: string;
  readonly k?: number;
}

/**
 * The activity inputs of a bench render.
 * @param options - The render's options.
 * @returns The inputs `mappeView` takes per activity.
 */
export function benchInputs(options: BenchOptions = {}): MappeActivityInputs[] {
  const content = options.content ?? benchContent();
  const locale = options.locale ?? 'nn';
  return (options.activities ?? [{ activity: sourceActivity() }]).map(
    ({ activity, findings, aggregates }) => ({
      activity,
      findings: findings ?? [],
      aggregates: aggregates ?? { recorded: false, suppressed: false },
      ...(activity.phase
        ? { phaseLabel: content.phases.phases.find((phase) => phase.key === activity.phase)?.label[locale] }
        : {}),
      link: `https://hvl-interaktiv.example/aktivitet/${activity.id}`,
      k: options.k ?? 5,
    }),
  );
}

/**
 * Renders the fixture's portfolio.
 * @param options - The content (the real content with the fixture's mappe by default), set, language and activities.
 * @returns The Markdown and its counts.
 */
export function benchRender(options: BenchOptions = {}): RenderedMappeMarkdown {
  const content = options.content ?? benchContent();
  const locale = options.locale ?? 'nn';
  const portfolio = content.mappe.portfolio;
  const set = portfolio?.criteriaSets.find(({ id }) => id === (options.set ?? FIXTURE_SETS.default));
  if (!portfolio || !set) throw new Error('the bench needs the fixture mappe and a known set');
  const entries = benchInputs(options);
  const patternIds = entries.flatMap(({ activity }) => (activity.patternId ? [activity.patternId] : []));
  const blocks = {
    lesarrettleiing: readersGuideBlock(set, locale),
    referansar: referencesBlock(patternIds, content.patterns, content.references, locale),
  };
  const format = mappeFormat(locale);
  const phases = content.phases.phases.map((phase) => ({ key: phase.key, label: phase.label[locale] }));
  const viewOf = (words: number) =>
    mappeView(
      {
        activities: entries,
        ...(options.authorName ? { authorName: options.authorName } : {}),
        criteriaSetTitle: set.title[locale],
        wordLimit: set.limits.del1Words.value,
        attachmentLimit: set.limits.attachments.value,
        k: options.k ?? 5,
        now: BENCH_NOW,
        phases,
        resultsRecorded: entries.some(({ aggregates }) => aggregates.recorded),
        words,
      },
      format,
    );
  return renderMappe(portfolio.templates[locale], viewOf, blocks);
}

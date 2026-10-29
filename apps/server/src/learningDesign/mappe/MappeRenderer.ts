/**
 * MappeRenderer — the pedagogisk mappe service: the activities an author can pick, the criteria sets, and the
 * portfolio itself as Markdown with its Del 1 word count and attachment count, made on demand and never stored.
 *
 * Why: MAPPE-001 exports a draft teaching portfolio from the author's own and co-authored activities; MAPPE-002 takes
 *      its headings from the template and its criteria from the criteria set; MAPPE-003 keeps learner data out. The
 *      routes (../http/mappeRoutes.ts) only check who asks and turn this service's answer into a file.
 * Spec: MAPPE-001, MAPPE-002, MAPPE-003
 * Invariants:
 *   - PRIVACY: makes the portfolio in memory and returns it; writes no row, no object and no file (MAPPE-003). Only
 *     the aggregates of ./activityResults.ts, with the minimum group size applied, reach it.
 *   - Only the author's own and co-authored activities; any other ID is 404 `hvl:activity-unavailable` (D-066).
 *   - Without the six content files: 409 `hvl:mappe-not-ready`; an unknown set: 400 `hvl:criteria-set-unknown`;
 *     more than `MAPPE_MAX_ACTIVITIES`: 400 `hvl:mappe-too-many`. Over a limit is never a refusal (D-094).
 *   - Building it contacts nothing; reading starts with a request.
 * Collaborators: ../../server/studioServices.ts (builds it), ../http/mappeRoutes.ts, ./mappeActivitySource.ts,
 *   ./mappeFindings.ts, ./activityResults.ts, ./mappeView.ts, ./mappeBlocks.ts, ./mappeRender.ts,
 *   ../content/mappeContent.ts.
 * Tests: apps/server/test/learningDesign/mappe/mappeExport.int.test.ts,
 *   apps/server/test/learningDesign/mappe/mappePrivacy.int.test.ts
 */
import {
  DEFAULT_CRITERIA_SET,
  MAPPE_MAX_ACTIVITIES,
  type MappeActivityList,
  type MappeCriteriaSetList,
} from '@hvl-interaktiv/api-contract';
import { learningDesignError } from '../../http/learningDesignErrors.js';
import type { Locale } from '../../i18n/translate.js';
import type { Database } from '../../infra/prismaClient.js';
import type { MinimumGroupSize } from '../../privacy/minimumGroupSize.js';
import type { ContentValidator } from '../../validation/types.js';
import type { StudioContent } from '../content/loadStudioContent.js';
import type { MappeCriteriaSet, MappePortfolioContent } from '../content/mappeContent.js';
import { activityAggregates, type ActivityResultsSource } from './activityResults.js';
import { mappeActivityItems, mappeAuthorName, mappeSourceActivities } from './mappeActivitySource.js';
import { readersGuideBlock, referencesBlock } from './mappeBlocks.js';
import { mappeFindings } from './mappeFindings.js';
import { mappeFormat } from './mappeFormat.js';
import { renderMappe, type RenderedMappeMarkdown } from './mappeRender.js';
import { mappeView } from './mappeView.js';

/** What the service is built from. */
export interface MappeRendererDeps {
  readonly db: Database;
  /** The studio content loaded at start-up: the mappe, the phases, the patterns and the references. */
  readonly content: StudioContent;
  /** The pre-publish validator, the same as the findings route's. */
  readonly validator: ContentValidator;
  /** Where learner results come from: `NO_RESULTS_YET` in S5 (D-095). */
  readonly results: ActivityResultsSource;
  readonly groupSize: MinimumGroupSize;
  /** The portal's origin, for each activity's link. */
  readonly publicBaseUrl: string;
}

/** One portfolio to make. */
export interface MappeRenderRequest {
  /** The author's `User.id`. */
  readonly userId: string;
  readonly contentIds: readonly string[];
  /** The criteria set; the default set when absent. */
  readonly criteriaSet?: string;
  /** The portfolio's language. */
  readonly locale: Locale;
  /** When it is made. */
  readonly now: Date;
}

/** A made portfolio. */
export interface RenderedMappe extends RenderedMappeMarkdown {
  readonly criteriaSet: MappeCriteriaSet;
  readonly locale: Locale;
}

/** Makes pedagogisk mappe drafts. */
export class MappeRenderer {
  constructor(private readonly deps: MappeRendererDeps) {}

  /**
   * The activities an author can pick.
   * @param userId - The author's `User.id`.
   * @returns Their own and co-authored activities, newest change first.
   */
  async activities(userId: string): Promise<MappeActivityList> {
    return { items: await mappeActivityItems(this.deps.db, userId) };
  }

  /**
   * The criteria sets of the content files.
   * @returns The sets and the default one.
   * @throws HttpError 409 `hvl:mappe-not-ready` while the mappe files are not in the content.
   */
  criteriaSets(): MappeCriteriaSetList {
    return {
      defaultSet: DEFAULT_CRITERIA_SET,
      sets: this.portfolio().criteriaSets.map((set) => ({
        id: set.id,
        title: set.title,
        wordLimit: set.limits.del1Words.value,
        attachmentLimit: set.limits.attachments.value,
        limitsToVerify: set.limits.del1Words.verify || set.limits.attachments.verify,
      })),
    };
  }

  /**
   * Makes a portfolio as Markdown.
   * @param request - The author, the activities, the set, the language and the moment.
   * @returns The Markdown with its counts, set and language.
   * @throws HttpError 409 `hvl:mappe-not-ready`, 400 `hvl:criteria-set-unknown` or `hvl:mappe-too-many`, and 404
   *   `hvl:activity-unavailable` (see the module header).
   */
  async render(request: MappeRenderRequest): Promise<RenderedMappe> {
    const portfolio = this.portfolio();
    const set = portfolio.criteriaSets.find(({ id }) => id === (request.criteriaSet ?? DEFAULT_CRITERIA_SET));
    if (!set) throw learningDesignError('hvl:criteria-set-unknown');
    if (request.contentIds.length > MAPPE_MAX_ACTIVITIES) throw learningDesignError('hvl:mappe-too-many');
    const { db, content, validator, results, groupSize, publicBaseUrl } = this.deps;
    const [activities, authorName] = await Promise.all([
      mappeSourceActivities(db, request.userId, request.contentIds),
      mappeAuthorName(db, request.userId),
    ]);
    const learners = await results.learnerSummaries(activities.map((activity) => activity.id));
    const { locale } = request;
    const format = mappeFormat(locale);
    const phases = content.phases.phases.map((phase) => ({ key: phase.key, label: phase.label[locale] }));
    const entries = activities.map((activity) => ({
      activity,
      findings: mappeFindings(validator, activity, activity.acknowledgements, locale),
      aggregates: activityAggregates(
        groupSize,
        learners === undefined ? undefined : (learners.get(activity.id) ?? []),
      ),
      ...(activity.phase ? { phaseLabel: phases.find((phase) => phase.key === activity.phase)?.label } : {}),
      link: new URL(`/aktivitet/${activity.id}`, publicBaseUrl).href,
      k: groupSize.k,
    }));
    const blocks = {
      lesarrettleiing: readersGuideBlock(set, locale),
      referansar: referencesBlock(
        activities.flatMap((activity) => (activity.patternId ? [activity.patternId] : [])),
        content.patterns,
        content.references,
        locale,
      ),
    };
    const viewOf = (words: number) =>
      mappeView(
        {
          activities: entries,
          ...(authorName ? { authorName } : {}),
          criteriaSetTitle: set.title[locale],
          wordLimit: set.limits.del1Words.value,
          attachmentLimit: set.limits.attachments.value,
          k: groupSize.k,
          now: request.now,
          phases,
          resultsRecorded: learners !== undefined,
          words,
        },
        format,
      );
    return { ...renderMappe(portfolio.templates[locale], viewOf, blocks), criteriaSet: set, locale };
  }

  private portfolio(): MappePortfolioContent {
    const portfolio = this.deps.content.mappe.portfolio;
    if (!portfolio) throw learningDesignError('hvl:mappe-not-ready');
    return portfolio;
  }
}

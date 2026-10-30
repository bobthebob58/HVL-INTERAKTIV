/**
 * activityTabs — the registry of the activity page's tabs: which tabs exist, in which order, and who gets each one.
 *
 * Why: `/aktivitet/[id]` has a tab per area of work, the studio's among them (D-089: **Læringsdesign** for people who
 *      may edit, **Deling**); one list keeps the order in one place, so a new tab is one file and one line here, and
 *      ../ActivityView.tsx stays the same.
 * Spec: UD-006, LTI-006, PROD-003, LTI-012
 * Invariants:
 *   - The order of `ACTIVITY_TABS` is the order of the tab list. **Spel** is first and shown to everyone who may view
 *     the activity, so there is always a tab to select.
 *   - `shows` reads only the server's answer (`mayEdit`, `mayPublish`, `role`); the server checks every request again.
 *   - Tab `id`s are unique (apps/web/test/features/activityTabs.test.tsx).
 * Collaborators: ./activityTab.ts, ./PlayTab.tsx, ./EditTab.tsx, ./LearningDesignTab.tsx, ./SharingTab.tsx,
 *   ./CheckTab.tsx, ./GradeSyncTab.tsx, ../ActivityView.tsx.
 * Tests: apps/web/test/features/activityTabs.test.tsx, apps/web/test/features/ActivityView.test.tsx
 */
import type { ContentDetail } from '@hvl-interaktiv/api-contract';
import type { ActivityTab } from './activityTab';
import { CHECK_TAB_ID, CheckTab } from './CheckTab';
import { EDIT_TAB_ID, EditTab } from './EditTab';
import { forOwnersAndCoAuthors, GRADE_SYNC_TAB_ID, GradeSyncTab } from './GradeSyncTab';
import { LEARNING_DESIGN_TAB_ID, LearningDesignTab } from './LearningDesignTab';
import { PLAY_TAB_ID, PlayTab } from './PlayTab';
import { SHARING_TAB_ID, SharingTab } from './SharingTab';

/**
 * A tab for everyone who may view the activity.
 * @returns Always true.
 */
export const forEveryone = (): boolean => true;

/**
 * A tab for people who may edit the activity (owner, co-authors, admins).
 * @param detail - The server's answer.
 * @returns `mayEdit`.
 */
export const forEditors = (detail: ContentDetail): boolean => detail.mayEdit;

/**
 * A tab for people who may check, publish and unpublish the activity.
 * @param detail - The server's answer.
 * @returns `mayPublish`.
 */
export const forPublishers = (detail: ContentDetail): boolean => detail.mayPublish;

/**
 * Every tab of the activity page, in the order shown. A new tab is one line here, e.g.
 * `{ id: LEARNING_DESIGN_TAB_ID, labelKey: 'learningDesign.tab', shows: forEditors, Panel: LearningDesignTab }`.
 */
export const ACTIVITY_TABS: readonly ActivityTab[] = [
  { id: PLAY_TAB_ID, labelKey: 'activity.tabPlay', shows: forEveryone, Panel: PlayTab },
  { id: EDIT_TAB_ID, labelKey: 'activity.tabEdit', shows: forEditors, Panel: EditTab },
  // PED-030: the learning design is for people who may edit; the server never gives it to others (D-087).
  { id: LEARNING_DESIGN_TAB_ID, labelKey: 'learningDesign.tab', shows: forEditors, Panel: LearningDesignTab },
  // PROD-007: visibility, co-authors, the bank and copying are for people who may edit (D-089).
  { id: SHARING_TAB_ID, labelKey: 'sharing.tab', shows: forEditors, Panel: SharingTab },
  { id: CHECK_TAB_ID, labelKey: 'activity.tabCheck', shows: forPublishers, Panel: CheckTab },
  // LTI-012: the scores sent to Canvas, for the owner and co-authors only (D-104, D-106).
  { id: GRADE_SYNC_TAB_ID, labelKey: 'gradeSync.tab', shows: forOwnersAndCoAuthors, Panel: GradeSyncTab },
];

/**
 * The tabs this person gets for an activity.
 * @param detail - The server's answer, with `mayEdit` and `mayPublish`.
 * @param tabs - The registry; `ACTIVITY_TABS` by default.
 * @returns The tabs to show, in registry order.
 */
export const activityTabsFor = (
  detail: ContentDetail,
  tabs: readonly ActivityTab[] = ACTIVITY_TABS,
): readonly ActivityTab[] => tabs.filter((tab) => tab.shows(detail));

/**
 * The tab to select: the one asked for when this person gets it, else the first one (**Spel**).
 * @param requested - A tab `id`, e.g. from the address's `?fane=`; undefined when none was asked for.
 * @param shown - The tabs this person gets (`activityTabsFor`).
 * @returns The `id` to select.
 */
export const selectableTabId = (requested: string | undefined, shown: readonly ActivityTab[]): string =>
  shown.find((tab) => tab.id === requested)?.id ?? shown[0]?.id ?? PLAY_TAB_ID;

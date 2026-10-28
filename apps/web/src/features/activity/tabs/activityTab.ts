/**
 * activityTab — what the activity page (`/aktivitet/[id]`) shares with each of its tabs, and what a tab declares about
 * itself in the registry (./activityTabs.ts).
 *
 * Why: the activity page grows a tab per S5 workstream (**Læringsdesign**, **Deling**, D-089). Every tab gets the same
 *      props, so a new tab is one file and one registry line, and the page never needs to know what a tab shows.
 * Spec: UD-006, LTI-006, PROD-003
 * Invariants:
 *   - Which tabs show is decided by `shows` from the server's `mayEdit` and `mayPublish`; the server checks every
 *     request again, so a tab is never the only guard.
 *   - A tab's `id` is stable: it names the tab in the markup (../../../components/Tabs.tsx) and in the address
 *     (`?fane=<id>`, ../../../config/paths.ts `activityPath`).
 * Collaborators: ./activityTabs.ts, ../ActivityView.tsx, ./PlayTab.tsx, ./EditTab.tsx, ./CheckTab.tsx.
 * Tests: apps/web/test/features/activityTabs.test.tsx, apps/web/test/features/activityTabProps.test.tsx,
 *   apps/web/test/features/ActivityView.test.tsx
 */
import type { ContentDetail } from '@hvl-interaktiv/api-contract';
import type { ComponentType, RefObject } from 'react';
import type { MessageKey } from '../../../i18n/translate';

/** The H5P frames the page keeps hold of: the player reloads after a save, the editor is asked to focus a field. */
export interface ActivityFrames {
  /** The player frame of the **Spel** tab. */
  readonly playerRef: RefObject<HTMLIFrameElement | null>;
  /** The editor frame of the **Rediger** tab. */
  readonly editorRef: RefObject<HTMLIFrameElement | null>;
  /** Tells the page the editor frame has loaded, so a waiting «Gå til feltet» can be posted to it. */
  readonly onEditorLoad: () => void;
}

/** What every tab panel gets from the activity page. */
export interface ActivityTabProps {
  /** The activity as last loaded, with what the person may do with it. */
  readonly detail: ContentDetail;
  /** Counts the editor's saves; a panel that shows stored data loads it again when this changes. */
  readonly revision: number;
  /** Loads the activity again, e.g. after its status, visibility or learning design changed. */
  readonly reloadDetail: () => Promise<void>;
  /** Opens the **Rediger** tab and asks the editor to focus the field at an H5P params path. */
  readonly goToField: (path: string) => void;
  /** Selects another tab by its `id`; an `id` that is not shown to this person is ignored. */
  readonly selectTab: (id: string) => void;
  /** Says something in the page's polite status region (WCAG 4.1.3), also the same words twice. */
  readonly announce: (message: string) => void;
  /** The H5P frames, for the tabs that show them. */
  readonly frames: ActivityFrames;
}

/** One tab of the activity page, as the registry lists it. */
export interface ActivityTab {
  /** Stable identifier, e.g. `edit`; used in the markup and in `?fane=`. */
  readonly id: string;
  /** The tab's label. */
  readonly labelKey: MessageKey;
  /** Whether this person gets the tab, from the server's answer (`mayEdit`, `mayPublish`). */
  readonly shows: (detail: ContentDetail) => boolean;
  /** The panel, mounted the first time its tab is selected and then kept (hidden) while another is shown. */
  readonly Panel: ComponentType<ActivityTabProps>;
}

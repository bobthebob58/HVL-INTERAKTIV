/**
 * frameMessages — the messages between the web app's pages and the H5P editor page they frame.
 *
 * Why: the editor page is server-rendered by Express (D-067) and tells its parent when it saved
 *      (`hvli:content-saved`), so the activity page can refresh its findings and the new-activity page can go to the
 *      saved activity. The findings list asks the editor to focus a field (`hvli:go-to-field`, PROD-003).
 * Spec: PROD-003, H5P-007
 * Invariants:
 *   - A message is accepted only from our own origin and from the frame the page expects (`event.source`).
 *   - Messages are posted with our own origin as the target, never `'*'`.
 *   - A saved activity's ID must look like an activity ID (a UUID) before a page navigates with it.
 * Collaborators: apps/server/src/h5p/render/client/editorPage.js (the other side), ./useEditorSaved.ts,
 *   ../features/activity/ActivityView.tsx, ../features/activity/NewActivityView.tsx.
 * Tests: apps/web/test/messaging/frameMessages.test.ts
 */

/** Posted by the editor page after every successful save. */
export const CONTENT_SAVED = 'hvli:content-saved';
/** Posted to the editor page to focus the field a finding points at. */
export const GO_TO_FIELD = 'hvli:go-to-field';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The longest finding path we send; the contract allows 1000 characters. */
const MAX_PATH = 1000;

/**
 * Whether a message event comes from the given frame on our own origin.
 * @param event - The message event.
 * @param frame - The frame the page expects it from.
 * @returns True only for that frame's window and our origin.
 */
export function isFromFrame(event: MessageEvent, frame: HTMLIFrameElement | null): boolean {
  // SECURITY: any window can post to us; only our own editor frame may make the page refresh or navigate.
  return frame !== null && event.origin === window.location.origin && event.source === frame.contentWindow;
}

/**
 * The activity ID of a `hvli:content-saved` message from the frame.
 * @param event - The message event.
 * @param frame - The editor frame.
 * @returns The activity ID, or undefined for any other message.
 */
export function savedContentId(event: MessageEvent, frame: HTMLIFrameElement | null): string | undefined {
  if (!isFromFrame(event, frame)) return undefined;
  const data = event.data as { type?: unknown; contentId?: unknown } | null;
  if (typeof data !== 'object' || data === null || data.type !== CONTENT_SAVED) return undefined;
  return typeof data.contentId === 'string' && UUID.test(data.contentId) ? data.contentId : undefined;
}

/**
 * Asks the editor frame to focus the field at a finding's path.
 * @param frame - The editor frame.
 * @param path - The finding's path, e.g. `questions[0].params.behaviour.feedbackOnWrong`.
 * @returns True when the message was posted.
 */
export function postGoToField(frame: HTMLIFrameElement | null, path: string): boolean {
  const target = frame?.contentWindow;
  if (!target || path === '' || path.length > MAX_PATH) return false;
  target.postMessage({ type: GO_TO_FIELD, path }, window.location.origin);
  return true;
}

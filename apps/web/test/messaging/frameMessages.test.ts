/**
 * Tests for the messages between the web pages and the framed editor: a save counts only from our own editor frame
 * on our own origin with an activity ID, and "Gå til feltet" posts to that frame on our own origin only.
 *
 * Spec: PROD-003, H5P-007
 */
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { CONTENT_SAVED, GO_TO_FIELD, postGoToField, savedContentId } from '../../src/messaging/frameMessages';

const ID = '7d3c1a8e-5b2f-4c1d-9e8f-0a1b2c3d4e5f';

const frame = (): HTMLIFrameElement => {
  const element = document.createElement('iframe');
  document.body.append(element);
  return element;
};

const message = (data: unknown, source: MessageEventSource | null, origin = window.location.origin) =>
  new MessageEvent('message', { data, source, origin });

describe('[PROD-003] messages from the editor frame', () => {
  it('[H5P-007] accepts a save from our own editor frame on our own origin', () => {
    const editor = frame();
    expect(
      savedContentId(message({ type: CONTENT_SAVED, contentId: ID }, editor.contentWindow), editor),
    ).toBe(ID);
  });

  it.each([
    [
      'another origin',
      (editor: HTMLIFrameElement) =>
        message({ type: CONTENT_SAVED, contentId: ID }, editor.contentWindow, 'https://evil.example'),
    ],
    ['another window', () => message({ type: CONTENT_SAVED, contentId: ID }, window)],
    [
      'another type',
      (editor: HTMLIFrameElement) => message({ type: 'other', contentId: ID }, editor.contentWindow),
    ],
    [
      'an ID that is not a UUID',
      (editor: HTMLIFrameElement) =>
        message({ type: CONTENT_SAVED, contentId: '../admin' }, editor.contentWindow),
    ],
    ['no data', (editor: HTMLIFrameElement) => message(null, editor.contentWindow)],
  ])('[H5P-007] ignores a message from %s', (_case, build) => {
    const editor = frame();
    expect(savedContentId(build(editor), editor)).toBeUndefined();
  });

  it('[PROD-003] "Gå til feltet" posts the path to the editor frame for our own origin only', () => {
    // Arrange
    const editor = frame();
    const post = vi.spyOn(editor.contentWindow as Window, 'postMessage');
    // Act
    const sent = postGoToField(editor, 'content[1].content.params.alt');
    // Assert
    expect(sent).toBe(true);
    expect(post).toHaveBeenCalledWith(
      { type: GO_TO_FIELD, path: 'content[1].content.params.alt' },
      window.location.origin,
    );
  });

  it('[PROD-003] posts nothing without a frame or a path', () => {
    expect(postGoToField(null, 'alt')).toBe(false);
    expect(postGoToField(frame(), '')).toBe(false);
  });
});

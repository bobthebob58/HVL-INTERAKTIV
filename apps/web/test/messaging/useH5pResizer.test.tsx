/**
 * Tests for the H5P resize protocol on our pages: the frame's `hello` is answered, `prepareResize` and `resize` set
 * its height, and messages from other windows or origins are ignored.
 *
 * Spec: UD-008, H5P-001
 */
// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useH5pResizer } from '../../src/messaging/useH5pResizer';

let frame: HTMLIFrameElement | null = null;

const Player = () => {
  const ref = useRef<HTMLIFrameElement>(null);
  useH5pResizer(ref, true);
  return (
    <iframe
      ref={(element) => {
        ref.current = element;
        frame = element;
      }}
      title="player"
    />
  );
};

const send = (data: unknown, source: MessageEventSource | null, origin = window.location.origin) =>
  window.dispatchEvent(new MessageEvent('message', { data, source, origin }));

describe('[UD-008] the player frame takes the height of its content', () => {
  it('[UD-008] answers hello and prepareResize, and sets the height H5P asks for', () => {
    // Arrange
    render(<Player />);
    const target = frame?.contentWindow as Window;
    const post = vi.spyOn(target, 'postMessage');
    // Act
    send({ context: 'h5p', action: 'hello' }, target);
    send({ context: 'h5p', action: 'prepareResize', clientHeight: 300.4, scrollHeight: 900 }, target);
    const prepared = frame?.style.height;
    send({ context: 'h5p', action: 'resize', scrollHeight: 900 }, target);
    // Assert
    expect(post).toHaveBeenCalledWith({ context: 'h5p', action: 'hello' }, window.location.origin);
    expect(post).toHaveBeenCalledWith({ context: 'h5p', action: 'resizePrepared' }, window.location.origin);
    expect(prepared).toBe('301px');
    expect(frame?.style.height).toBe('900px');
  });

  it('[UD-008] ignores messages from another origin, another window, or without H5P’s context', () => {
    // Arrange
    render(<Player />);
    const target = frame?.contentWindow as Window;
    // Act
    send({ context: 'h5p', action: 'resize', scrollHeight: 5000 }, target, 'https://evil.example');
    send({ context: 'h5p', action: 'resize', scrollHeight: 5000 }, window);
    send({ action: 'resize', scrollHeight: 5000 }, target);
    send({ context: 'h5p', action: 'resize', scrollHeight: -1 }, target);
    // Assert
    expect(frame?.style.height).toBe('');
  });
});

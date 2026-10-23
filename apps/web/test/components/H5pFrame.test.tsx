/**
 * Component tests for H5pFrame: every frame has a title, only fullscreen is allowed, and a player frame answers
 * H5P's resize protocol while the editor frame does not.
 *
 * Spec: UD-008, UD-006, H5P-001
 */
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { H5pFrame } from '../../src/components/H5pFrame';

describe('[UD-006] the H5P frame', () => {
  it('[UD-006] has a title, a same-origin source and no powers beyond fullscreen', () => {
    render(<H5pFrame src="/h5p/play/abc" title="Spel: Quiz" frameRef={createRef()} />);
    const frame = screen.getByTitle('Spel: Quiz');
    expect(frame.tagName).toBe('IFRAME');
    expect(frame.getAttribute('src')).toBe('/h5p/play/abc');
    expect(frame.getAttribute('allow')).toBe('fullscreen');
  });

  it('[UD-008] the player takes the height H5P asks for; the editor keeps its own', () => {
    // Arrange
    const player = createRef<HTMLIFrameElement>();
    const editor = createRef<HTMLIFrameElement>();
    render(
      <>
        <H5pFrame src="/h5p/play/abc" title="Spel" frameRef={player} />
        <H5pFrame src="/h5p/edit/abc" title="Rediger" editor frameRef={editor} />
      </>,
    );
    // Act
    for (const ref of [player, editor]) {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { context: 'h5p', action: 'resize', scrollHeight: 640 },
          origin: window.location.origin,
          source: ref.current?.contentWindow ?? null,
        }),
      );
    }
    // Assert
    expect(player.current?.style.height).toBe('640px');
    expect(editor.current?.style.height).toBe('');
  });
});

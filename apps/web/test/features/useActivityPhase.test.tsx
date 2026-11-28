/**
 * Tests for the phase of the activity on screen, as the **Sjekk og publiser** tab reads it: the stored phase, read
 * again when the page has loaded the activity again, never one activity's phase for another, and no request and no
 * phase for someone who may not edit.
 *
 * Spec: PROD-014, PED-030
 */
// @vitest-environment jsdom
import type { ContentDetail, LearningDesign, PhaseKey } from '@hvl-interaktiv/api-contract';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useActivityPhase } from '../../src/features/learningDesign/useActivityPhase';
import { fakeFetch } from '../support/fakeFetch';
import { DETAIL, METADATA_PATH, STORED } from './learningDesignFixtures';

const OTHER_ID = '0192f0c4-0000-7000-8000-00000000beef';
const OTHER: ContentDetail = { ...DETAIL, id: OTHER_ID, title: 'Ein annan aktivitet' };
const design = (phase: PhaseKey | undefined): LearningDesign => ({ ...STORED, phase });

/** Mounts the hook on the fake server's two activities; `stored` is what the first one answers next. */
const mount = (start: ContentDetail = DETAIL) => {
  const stored = { phase: 'etterarbeid' as PhaseKey | undefined };
  const requests = fakeFetch({
    [`GET ${METADATA_PATH}`]: () => ({ status: 200, body: design(stored.phase) }),
    [`GET /api/content/${OTHER_ID}/learning-design`]: { status: 200, body: design('forarbeid') },
  });
  const hook = renderHook(({ detail }) => useActivityPhase(detail), { initialProps: { detail: start } });
  return { ...hook, stored, requests };
};
/** Lets every answer already on its way be handled. */
const settle = () => act(() => new Promise<void>((resolve) => void setTimeout(resolve, 0)));

describe('[PROD-014] the phase of the activity on screen', () => {
  it('[PROD-014] is the stored phase, read again when the page has loaded the activity again', async () => {
    // Arrange
    const { result, rerender, stored, requests } = mount();
    await waitFor(() => expect(result.current).toBe('etterarbeid'));
    // Act: the phase is changed and saved on the Læringsdesign tab, and the page loads the activity again
    stored.phase = 'underveis';
    rerender({ detail: { ...DETAIL } });
    // Assert
    await waitFor(() => expect(result.current).toBe('underveis'));
    expect(requests.map((request) => request.path)).toEqual([METADATA_PATH, METADATA_PATH]);
  });

  it('[PROD-014] never gives one activity the phase that was read for another', async () => {
    // Arrange
    const { result, rerender } = mount();
    await waitFor(() => expect(result.current).toBe('etterarbeid'));
    // Act
    rerender({ detail: OTHER });
    // Assert: nothing until the other activity's own answer has arrived
    expect(result.current).toBeUndefined();
    await waitFor(() => expect(result.current).toBe('forarbeid'));
  });

  it('[PROD-014][PED-030] asks nothing and gives no phase for someone who may not edit', async () => {
    // Arrange
    const { result, rerender, requests } = mount({ ...DETAIL, mayEdit: false });
    // Act
    await settle();
    // Assert
    expect(result.current).toBeUndefined();
    expect(requests).toEqual([]);
    // Act and assert: a phase that was known goes when the right to edit goes
    rerender({ detail: DETAIL });
    await waitFor(() => expect(result.current).toBe('etterarbeid'));
    rerender({ detail: { ...DETAIL, mayEdit: false } });
    expect(result.current).toBeUndefined();
  });

  it.each([
    ['has no phase', { status: 200, body: design(undefined) }],
    ['cannot be read', { status: 403, body: {} }],
  ])('[PROD-014] gives no phase when the learning design %s', async (_what, answer) => {
    // Arrange
    const requests = fakeFetch({ [`GET ${METADATA_PATH}`]: answer });
    // Act
    const { result } = renderHook(() => useActivityPhase(DETAIL));
    await waitFor(() => expect(requests).toHaveLength(1));
    await settle();
    // Assert
    expect(result.current).toBeUndefined();
  });
});

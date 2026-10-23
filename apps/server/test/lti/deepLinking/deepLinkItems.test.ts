/**
 * Tests for the Deep Linking content items: the LTI-005 item shape, a lineItem only for `assignment_selection`,
 * the platform's accept settings, placement detection (D-061) and the return-URL check.
 *
 * Spec: LTI-005, PROD-005
 */
import type { ContentItem } from 'ltijs';
import { describe, expect, it } from 'vitest';
import {
  buildDeepLinkItems,
  DEEP_LINK_IFRAME_SIZE,
  DeepLinkItemsError,
  isAllowedReturnUrl,
  placementOf,
  type DeepLinkPlacement,
} from '../../../src/lti/deepLinking/deepLinkItems.js';

const CANVAS_PLACEMENT = 'https://www.instructure.com/placement';
const CUSTOM = 'https://purl.imsglobal.org/spec/lti/claim/custom';
const ACTIVITY = { id: '0192f6a8-7c1e-7a35-9d1f-3b0c8e2a4f11', title: 'Brettspel: kva lærte vi?' };
const OTHER = { id: '0192f6a8-7c1e-7a35-9d1f-3b0c8e2a4f22', title: 'Refleksjon' };
const SINGLE = { accept_types: ['ltiResourceLink'], accept_multiple: false };
const MULTIPLE = { accept_types: ['link', 'ltiResourceLink'], accept_multiple: true };
const BASE = 'https://interaktiv.hvl.no';

const build = (placement: DeepLinkPlacement, settings: object = SINGLE, activities = [ACTIVITY]) =>
  buildDeepLinkItems({ activities, placement, publicBaseUrl: BASE, settings });

const refusal = (run: () => unknown): string | undefined => {
  try {
    run();
  } catch (error) {
    if (error instanceof DeepLinkItemsError) return error.reason;
    throw error;
  }
  return undefined;
};

describe('[LTI-005] Deep Linking content items', () => {
  it('[LTI-005] builds an ltiResourceLink with title, launch URL, contentId, iframe hint and a lineItem for assignment_selection', () => {
    // Act
    const items = build('assignment_selection');
    // Assert
    expect(items).toEqual([
      {
        type: 'ltiResourceLink',
        title: ACTIVITY.title,
        url: 'https://interaktiv.hvl.no/lti/launch',
        custom: { contentId: ACTIVITY.id },
        iframe: { width: DEEP_LINK_IFRAME_SIZE.width, height: DEEP_LINK_IFRAME_SIZE.height },
        lineItem: {
          scoreMaximum: 100,
          label: ACTIVITY.title,
          resourceId: ACTIVITY.id,
          tag: 'hvl-interaktiv',
        },
      },
    ]);
  });

  it.each<DeepLinkPlacement>(['link_selection', 'editor_button', 'other'])(
    '[PROD-005] %s gets no lineItem, so it never creates a gradebook column',
    (placement) => {
      const [item] = build(placement, MULTIPLE);
      expect(item).not.toHaveProperty('lineItem');
      expect(item).toEqual({
        type: 'ltiResourceLink',
        title: ACTIVITY.title,
        url: 'https://interaktiv.hvl.no/lti/launch',
        custom: { contentId: ACTIVITY.id },
        iframe: { width: DEEP_LINK_IFRAME_SIZE.width, height: DEEP_LINK_IFRAME_SIZE.height },
      });
    },
  );

  it('[LTI-005] returns several items in the chosen order only when accept_multiple is true', () => {
    const items = build('link_selection', MULTIPLE, [ACTIVITY, OTHER]);
    expect(items.map((item) => item.custom.contentId)).toEqual([ACTIVITY.id, OTHER.id]);
  });

  it.each([
    ['accept_multiple false (Canvas assignment_selection)', SINGLE],
    ['accept_multiple missing', { accept_types: ['ltiResourceLink'] }],
    ['accept_multiple as the string "true"', { accept_types: ['ltiResourceLink'], accept_multiple: 'true' }],
  ])('[LTI-005] refuses two activities with %s', (_case, settings) => {
    expect(refusal(() => build('assignment_selection', settings, [ACTIVITY, OTHER]))).toBe(
      'multiple-not-accepted',
    );
  });

  it.each([
    ['no accept_types', { accept_multiple: true }],
    ['accept_types without ltiResourceLink', { accept_types: ['link', 'html', 'image'] }],
    ['accept_types as a string', { accept_types: 'ltiResourceLink' }],
  ])('[LTI-005] refuses when the platform sends %s', (_case, settings) => {
    expect(refusal(() => build('link_selection', settings))).toBe('type-not-accepted');
  });

  it('[LTI-005] refuses an empty choice', () => {
    expect(refusal(() => build('link_selection', SINGLE, []))).toBe('no-activity');
  });

  it('[LTI-005] always links to our own launch URL, whatever the base URL looks like', () => {
    const items = buildDeepLinkItems({
      activities: [ACTIVITY],
      placement: 'link_selection',
      publicBaseUrl: 'https://interaktiv.hvl.no/',
      settings: SINGLE,
    });
    expect(items[0]?.url).toBe('https://interaktiv.hvl.no/lti/launch');
  });

  it('[LTI-005] returns frozen items that ltijs accepts as content items', () => {
    // Arrange
    const items = build('assignment_selection');
    // Act: the assignment type-checks only if the items fit ltijs's ContentItem.
    const contentItems: ContentItem[] = [...items];
    // Assert
    expect(contentItems).toHaveLength(1);
    expect(Object.isFrozen(items) && Object.isFrozen(items[0]) && Object.isFrozen(items[0]?.lineItem)).toBe(
      true,
    );
  });
});

describe('[LTI-005] placement of a Deep Linking request (D-061)', () => {
  it.each([
    ['Canvas placement claim', { [CANVAS_PLACEMENT]: 'assignment_selection' }, 'assignment_selection'],
    ['Canvas link_selection', { [CANVAS_PLACEMENT]: 'link_selection' }, 'link_selection'],
    ['Canvas editor_button', { [CANVAS_PLACEMENT]: 'editor_button' }, 'editor_button'],
    [
      'custom hvl_placement without a Canvas claim',
      { [CUSTOM]: { hvl_placement: 'assignment_selection' } },
      'assignment_selection',
    ],
    [
      'the Canvas claim over hvl_placement',
      { [CANVAS_PLACEMENT]: 'link_selection', [CUSTOM]: { hvl_placement: 'assignment_selection' } },
      'link_selection',
    ],
    ['an unknown Canvas placement', { [CANVAS_PLACEMENT]: 'module_index_menu_modal' }, 'other'],
    ['an unexpanded custom value', { [CUSTOM]: { hvl_placement: '$Canvas.placement' } }, 'other'],
    ['a differently cased value', { [CANVAS_PLACEMENT]: 'Assignment_Selection' }, 'other'],
    ['no placement at all', {}, 'other'],
    ['a custom claim that is not an object', { [CUSTOM]: 'assignment_selection' }, 'other'],
  ])('[LTI-005] %s', (_case, claims, placement) => {
    expect(placementOf(claims)).toBe(placement);
  });
});

describe('[LTI-005] deep_link_return_url check', () => {
  it.each([
    ['https://hvl.instructure.com/courses/1/deep_linking_response', true],
    ['http://localhost:4100/deep_linking_response', true],
    ['javascript:alert(document.domain)', false],
    ['JavaScript:alert(1)', false],
    ['data:text/html,<script>alert(1)</script>', false],
    ['vbscript:msgbox', false],
    ['ftp://hvl.instructure.com/x', false],
    ['//hvl.instructure.com/x', false],
    ['/courses/1/deep_linking_response', false],
    ['', false],
    [undefined, false],
    [42, false],
  ])('[LTI-005] %j → %s', (url, allowed) => {
    expect(isAllowedReturnUrl(url)).toBe(allowed);
  });
});

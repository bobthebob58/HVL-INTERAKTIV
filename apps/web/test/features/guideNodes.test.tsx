/**
 * Tests for the guide's node renderers: a link target the contract forbids is shown as its text, never as a link; an
 * https: link says it leaves the site and a mailto: link does not; a tight list item holds its text directly; a box's heading is one level below the heading before it; a citation of
 * a key outside the reference list is left out.
 *
 * Spec: PED-002
 */
// @vitest-environment jsdom
import type { GuideBlockNode } from '@hvl-interaktiv/api-contract';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GuideBlocks } from '../../src/features/studio/guide/GuideBlocks';
import { citationNumbers, isSafeGuideHref } from '../../src/features/studio/guide/guideCitations';

const words = (value: string) => [{ type: 'text' as const, value }];

const renderBlocks = (nodes: GuideBlockNode[]) =>
  render(
    <GuideBlocks
      nodes={nodes}
      locale="nn"
      citationNumber={citationNumbers([{ key: 'kjent' }])}
      renderMarker={(name) => <p>{name}</p>}
    />,
  );

describe('[PED-002] the guide node renderers', () => {
  it.each([
    ['javascript:alert(1)', false],
    ['//evil.example', false],
    ['/\\evil.example', false],
    ['http://www.hvl.no', false],
    ['HTTPS://www.hvl.no', true],
    ['mailto:alu@hvl.no', true],
    ['/laeringsdesign', true],
  ])('[PED-002] renders the target %s as a link: %s', (href, allowed) => {
    // Act
    renderBlocks([{ type: 'paragraph', children: [{ type: 'link', href, children: words('lenkja') }] }]);
    // Assert
    expect(isSafeGuideHref(href)).toBe(allowed);
    expect(screen.queryAllByRole('link')).toHaveLength(allowed ? 1 : 0);
    expect(screen.getByText('lenkja')).toBeTruthy();
  });

  it('[PED-002] says an https: link leaves the site, and keeps a mailto: link plain, since it opens no website', () => {
    // Act
    renderBlocks([
      {
        type: 'paragraph',
        children: [
          { type: 'link', href: 'https://www.hvl.no/alu', children: words('ALU') },
          { type: 'link', href: 'MAILTO:alu@hvl.no', children: words('Skriv til ALU') },
        ],
      },
    ]);
    // Assert
    expect(screen.getByRole('link', { name: 'ALU (opnar ekstern nettstad)' })).toBeTruthy();
    const mail = screen.getByRole('link', { name: 'Skriv til ALU' });
    expect(mail.getAttribute('href')).toBe('MAILTO:alu@hvl.no');
    expect(mail.getAttribute('rel')).toBeNull();
  });

  it('[PED-002] puts a box heading one level below the heading it follows, and a tight list item’s text in the li', () => {
    // Act
    renderBlocks([
      { type: 'box', children: [{ type: 'paragraph', children: words('Før') }] },
      { type: 'heading', level: 3, children: words('Del') },
      {
        type: 'box',
        children: [
          {
            type: 'list',
            ordered: false,
            items: [{ type: 'listItem', children: [{ type: 'paragraph', children: words('Punkt') }] }],
          },
        ],
      },
    ]);
    // Assert
    const boxHeadings = screen.getAllByRole('heading', { name: 'Kva dette betyr for aktiviteten din' });
    expect(boxHeadings.map((heading) => heading.tagName)).toEqual(['H2', 'H4']);
    expect(screen.getByRole('listitem').innerHTML).toBe('Punkt');
  });

  it('[PED-002] names each box region by its heading and the guide heading it follows, so the names differ', () => {
    // Act
    renderBlocks([
      { type: 'heading', level: 2, children: words('Segmenter') },
      { type: 'box', children: [{ type: 'paragraph', children: words('Ein') }] },
      { type: 'heading', level: 2, children: words('Forklar') },
      { type: 'box', children: [{ type: 'paragraph', children: words('To') }] },
    ]);
    // Assert
    expect(
      screen
        .getAllByRole('region')
        .map((region) => region.getAttribute('aria-labelledby')?.split(' ').length),
    ).toEqual([2, 2]);
    expect(
      screen.getByRole('region', { name: 'Kva dette betyr for aktiviteten din Segmenter' }),
    ).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Kva dette betyr for aktiviteten din Forklar' })).toBeTruthy();
  });

  it('[PED-002] leaves out a citation whose key is not in the reference list, and renders markers through the page', () => {
    // Act
    renderBlocks([
      {
        type: 'paragraph',
        children: [...words('Sjå '), { type: 'citation', key: 'ukjent' }, { type: 'citation', key: 'kjent' }],
      },
      { type: 'marker', name: 'phase-matrix' },
    ]);
    // Assert
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(['Kjelde [1]']);
    expect(screen.getByText('phase-matrix')).toBeTruthy();
  });
});

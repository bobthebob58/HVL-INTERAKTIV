/**
 * GuideBlocks — renders the guide's block nodes in order: headings, prose, the «Kva dette betyr for aktiviteten din»
 * boxes and, where a marker stands, the component the page gives for it (the phase matrix or the catalogue).
 *
 * Why: the guide's structure comes from ALU's Markdown (D-083); the page's own `h1` is from the locale files, so the
 *      guide's headings are `h2` and `h3`. A box is a `<section>` with its own heading from the locale files, one level
 *      below the heading it follows, so the outline stays unbroken (WCAG 1.3.1, 2.4.6).
 * Spec: PED-002
 * Invariants:
 *   - Heading levels come only from the node (2 or 3); a box's heading is one level below the last heading, at most
 *     `h4`, and `h2` before any heading.
 *   - Each box is labelled by its own heading and then the guide heading it follows (`aria-labelledby`), so the
 *     boxes are regions with distinct names (WCAG 2.4.6; axe `landmark-unique`); its colours are token pairs, and its
 *     meaning is in its heading, not its colour (UD-003).
 *   - A marker renders whatever `renderMarker` returns for it; the page decides what the markers are.
 * Collaborators: ./GuideProse.tsx, ./GuideInline.tsx, ../GuideView.tsx.
 * Tests: apps/web/test/features/guideNodes.test.tsx, apps/web/test/features/GuideView.test.tsx
 */
import type { GuideBlockNode, GuideProseNode } from '@hvl-interaktiv/api-contract';
import { useId, type ReactNode } from 'react';
import { t } from '../../../i18n/translate';
import { GuideInline } from './GuideInline';
import { GuideProse, type GuideProseProps } from './GuideProse';

/** A marker's name: where the page puts the phase matrix or the catalogue. */
export type GuideMarkerName = Extract<GuideBlockNode, { type: 'marker' }>['name'];

/** What the block renderer needs. */
export type GuideBlocksProps = Omit<GuideProseProps, 'nodes'> & {
  readonly nodes: readonly GuideBlockNode[];
  /** The component for a marker. */
  readonly renderMarker: (name: GuideMarkerName) => ReactNode;
};

type HeadingTag = 'h2' | 'h3' | 'h4';

function Box({
  level,
  nodes,
  sectionHeadingId,
  ...props
}: {
  readonly level: 2 | 3 | 4;
  readonly nodes: readonly GuideProseNode[];
  /** The id of the guide heading the box follows, if any. */
  readonly sectionHeadingId: string | undefined;
} & Omit<GuideProseProps, 'nodes'>) {
  const headingId = useId();
  const Heading = `h${level}` as HeadingTag;
  return (
    <section
      // A11Y: every box has the same heading, so the section heading it follows tells the regions apart.
      aria-labelledby={sectionHeadingId ? `${headingId} ${sectionHeadingId}` : headingId}
      className="mb-4 max-w-3xl border-l-4 border-hvl-primary-dark bg-hvl-feedback-info-bg p-4 text-hvl-feedback-info-fg"
    >
      <Heading id={headingId} className="text-hvl-feedback-info-fg">
        {t('studio.boxHeading', props.locale)}
      </Heading>
      <GuideProse nodes={nodes} {...props} />
    </section>
  );
}

/**
 * Each block's box level (one below the last heading before it, the page's h1 at first, at most 4) and the position
 * of that heading.
 */
const boxPlaces = (nodes: readonly GuideBlockNode[]): { level: 2 | 3 | 4; heading: number | undefined }[] => {
  let last = 1;
  let heading: number | undefined;
  return nodes.map((node, index) => {
    if (node.type === 'heading') [last, heading] = [node.level, index];
    return { level: Math.min(last + 1, 4) as 2 | 3 | 4, heading };
  });
};

/**
 * Renders the guide's blocks.
 * @param props - The nodes, the locale, the citation numbers and the marker components.
 * @returns The guide's content.
 */
export function GuideBlocks({ nodes, renderMarker, ...props }: GuideBlocksProps) {
  const places = boxPlaces(nodes);
  const idBase = useId();
  const headingId = (index: number | undefined) => (index === undefined ? undefined : `${idBase}-h${index}`);
  return (
    <>
      {nodes.map((node, index) => {
        // WHY: the nodes are a fixed tree that never reorders, so the position is a stable key.
        if (node.type === 'heading') {
          const Heading = `h${node.level}` as HeadingTag;
          return (
            <Heading key={index} id={headingId(index)}>
              <GuideInline nodes={node.children} {...props} />
            </Heading>
          );
        }
        if (node.type === 'box') {
          const place = places[index];
          return (
            <Box
              key={index}
              level={place?.level ?? 2}
              sectionHeadingId={headingId(place?.heading)}
              nodes={node.children}
              {...props}
            />
          );
        }
        if (node.type === 'marker') return <div key={index}>{renderMarker(node.name)}</div>;
        return <GuideProse key={index} nodes={[node]} {...props} />;
      })}
    </>
  );
}

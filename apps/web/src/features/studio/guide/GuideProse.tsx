/**
 * GuideProse — renders the guide's prose nodes: paragraphs and bulleted or numbered lists, nested as the guide uses
 * them. List items, boxes and a pattern's "why it works" hold only these.
 *
 * Why: the closed node tree (D-083) is rendered with plain elements, so the page needs no `innerHTML` (D-068) and
 *      lists are real lists for screen readers (WCAG 1.3.1).
 * Spec: PED-002, PED-010
 * Invariants:
 *   - A list item that holds one paragraph renders its text directly in the `li`, as a tight Markdown list reads.
 *   - Body text keeps the page's reading rules (left-aligned, line height 1.5; ../../../app/globals.css).
 * Collaborators: ./GuideInline.tsx, ./GuideBlocks.tsx, ../PatternDetailView.tsx.
 * Tests: apps/web/test/features/guideNodes.test.tsx
 */
import type { GuideProseNode } from '@hvl-interaktiv/api-contract';
import { GuideInline, type GuideInlineProps } from './GuideInline';

/** What the prose renderer needs: the nodes, the locale and the citation numbers. */
export type GuideProseProps = Omit<GuideInlineProps, 'nodes'> & { readonly nodes: readonly GuideProseNode[] };

type ListItem = Extract<GuideProseNode, { type: 'list' }>['items'][number];

function Item({ item, ...props }: { readonly item: ListItem } & Omit<GuideProseProps, 'nodes'>) {
  const [only] = item.children;
  if (item.children.length === 1 && only?.type === 'paragraph')
    return (
      <li>
        <GuideInline nodes={only.children} {...props} />
      </li>
    );
  return (
    <li>
      <GuideProse nodes={item.children} {...props} />
    </li>
  );
}

function ProseNode({ node, ...props }: { readonly node: GuideProseNode } & Omit<GuideProseProps, 'nodes'>) {
  if (node.type === 'paragraph')
    return (
      <p>
        <GuideInline nodes={node.children} {...props} />
      </p>
    );
  const items = node.items.map((item, index) => <Item key={index} item={item} {...props} />);
  return node.ordered ? (
    <ol className="mb-3 list-decimal pl-6">{items}</ol>
  ) : (
    <ul className="mb-3 list-disc pl-6">{items}</ul>
  );
}

/**
 * Renders paragraphs and lists.
 * @param props - The nodes, the locale and the citation numbers.
 * @returns The prose.
 */
export function GuideProse({ nodes, ...props }: GuideProseProps) {
  return (
    <>
      {nodes.map((node, index) => (
        // WHY: the nodes are a fixed tree that never reorders, so the position is a stable key.
        <ProseNode key={index} node={node} {...props} />
      ))}
    </>
  );
}

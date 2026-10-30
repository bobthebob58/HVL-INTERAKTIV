/**
 * guideNodes — the closed node tree the server builds from the guide's Markdown and the patterns' "why it works"
 * texts, which the web app renders with React and never as HTML.
 *
 * Why: D-083 replaces MDX with CommonMark that the server parses into a closed tree, so ALU's content never becomes
 *      code and the web app needs no `innerHTML` (D-068). Every node the builder may emit is listed here, so the
 *      builder and the renderer cannot disagree about what a guide may contain.
 * Spec: PED-002, PED-011
 * Invariants:
 *   - Closed: strict objects told apart by `type`; an unknown node or field is refused.
 *   - Blocks: heading (level 2 or 3; the page's h1 comes from the locale files), paragraph, list, box (the
 *     "what this means for your activity" section) and marker (where the phase matrix or catalogue goes). List items
 *     and boxes hold only paragraphs and lists.
 *   - Inline: text, strong, emphasis, link and citation. A link holds only text, strong and emphasis: never another
 *     link or a citation.
 *   - SECURITY: a link's `href` is `https:` or `mailto:` (in any case) or a same-site path; `//` and `/\` are refused,
 *     because browsers read both as another host.
 * Collaborators: ./studio.ts, apps/server/src/learningDesign/content/ (the builder), apps/web (the renderer).
 * Tests: packages/api-contract/test/studioSchemas.test.ts
 */
import { z } from 'zod';

/** The marker lines a guide may contain (D-083): `{{phase-matrix}}` and `{{pattern-catalogue}}`. */
export const GUIDE_MARKER_NAMES = ['phase-matrix', 'pattern-catalogue'] as const;

/** A reference key, as cited with `[@key]` and listed in `content/laeringsdesign/references.yaml`. */
export const referenceKeySchema = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/)
  .describe('A reference key from references.yaml, e.g. `guo2014`.');
/** A reference key. */
export type ReferenceKey = z.infer<typeof referenceKeySchema>;

// SECURITY: only these targets are safe to render as links: `javascript:`, `data:` and `http:` are refused, and a
// path starting `//` or `/\` would leave the site (browsers treat a backslash like a slash). The scheme letters are
// spelled out because a regex flag does not survive into the document's JSON Schema `pattern`.
/** A link target: `https:`, `mailto:` or a same-site path (D-083). */
export const guideHrefSchema = z
  .string()
  .max(2000)
  .regex(/^(?:[Hh][Tt][Tt][Pp][Ss]:\/\/\S+|[Mm][Aa][Ii][Ll][Tt][Oo]:\S+|\/(?![/\\])\S*)$/)
  .describe(
    '`https:` or `mailto:` (any case), or a same-site path that starts with `/` but not `//` or `/\\`.',
  );
/** A safe link target. */
export type GuideHref = z.infer<typeof guideHrefSchema>;

/** Plain text, never empty; the web app renders it as text. */
export interface GuideTextNode {
  type: 'text';
  value: string;
}
/** A citation `[@key]`; the answer's references list holds its full text. */
export interface GuideCitationNode {
  type: 'citation';
  key: string;
}
/** What a link may contain: text, strong and emphasis only. */
export type GuideLinkContentNode =
  | GuideTextNode
  | { type: 'strong'; children: GuideLinkContentNode[] }
  | { type: 'emphasis'; children: GuideLinkContentNode[] };
/** A link; external ones open through the web app's `ExternalLink`. */
export interface GuideLinkNode {
  type: 'link';
  href: string;
  children: GuideLinkContentNode[];
}
/** Any inline node. */
export type GuideInlineNode =
  | GuideTextNode
  | GuideCitationNode
  | GuideLinkNode
  | { type: 'strong'; children: GuideInlineNode[] }
  | { type: 'emphasis'; children: GuideInlineNode[] };
/** A paragraph or a list: what list items, boxes and pattern texts hold. */
export type GuideProseNode =
  | { type: 'paragraph'; children: GuideInlineNode[] }
  | { type: 'list'; ordered: boolean; items: { type: 'listItem'; children: GuideProseNode[] }[] };
/** Any block node of a guide. */
export type GuideBlockNode =
  | { type: 'heading'; level: 2 | 3; children: GuideInlineNode[] }
  | GuideProseNode
  | { type: 'box'; children: GuideProseNode[] }
  | { type: 'marker'; name: (typeof GUIDE_MARKER_NAMES)[number] };

const textNode = z.strictObject({ type: z.literal('text'), value: z.string().min(1) });
const citationNode = z.strictObject({ type: z.literal('citation'), key: referenceKeySchema });

/** A node inside a link (D-083). */
export const guideLinkContentNodeSchema: z.ZodType<GuideLinkContentNode> = z.discriminatedUnion('type', [
  textNode,
  z.strictObject({
    type: z.literal('strong'),
    get children() {
      return z.array(guideLinkContentNodeSchema).min(1);
    },
  }),
  z.strictObject({
    type: z.literal('emphasis'),
    get children() {
      return z.array(guideLinkContentNodeSchema).min(1);
    },
  }),
]);

/** Any inline node (D-083). */
export const guideInlineNodeSchema: z.ZodType<GuideInlineNode> = z.discriminatedUnion('type', [
  textNode,
  citationNode,
  z.strictObject({
    type: z.literal('link'),
    href: guideHrefSchema,
    children: z.array(guideLinkContentNodeSchema).min(1),
  }),
  z.strictObject({
    type: z.literal('strong'),
    get children() {
      return z.array(guideInlineNodeSchema).min(1);
    },
  }),
  z.strictObject({
    type: z.literal('emphasis'),
    get children() {
      return z.array(guideInlineNodeSchema).min(1);
    },
  }),
]);

const inlines = z.array(guideInlineNodeSchema).min(1);

/** A paragraph or a list (D-083). */
export const guideProseNodeSchema: z.ZodType<GuideProseNode> = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('paragraph'), children: inlines }),
  z.strictObject({
    type: z.literal('list'),
    ordered: z.boolean().describe('Numbered (`1.`) or bulleted (`-`); the start number is ignored.'),
    get items() {
      return z
        .array(
          z.strictObject({ type: z.literal('listItem'), children: z.array(guideProseNodeSchema).min(1) }),
        )
        .min(1);
    },
  }),
]);

/** Any block node of a guide (D-083). */
export const guideBlockNodeSchema: z.ZodType<GuideBlockNode> = z.union([
  z.strictObject({ type: z.literal('heading'), level: z.literal([2, 3]), children: inlines }),
  guideProseNodeSchema,
  z
    .strictObject({ type: z.literal('box'), children: z.array(guideProseNodeSchema).min(1) })
    .describe(
      'A blockquote: the «Kva dette betyr for aktiviteten din» section; its heading comes from the locale files.',
    ),
  z.strictObject({ type: z.literal('marker'), name: z.enum(GUIDE_MARKER_NAMES) }),
]);

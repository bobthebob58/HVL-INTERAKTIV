/**
 * BarChart — the drawn part of an insight chart: one row per item, a horizontal bar per value in the single `accent`
 * hue (solid, or striped for a second series), each with its value written next to it; a hidden or unavailable value
 * has its text and no bar.
 *
 * Why: INS-008 and D-106: a single hue from the tokens (no new colours, D-017), labels as well as colour, and
 *      non-text contrast (the bar and its outlined track against the surface, UD-003). The chart is decorative for
 *      assistive technology: its figure's text summary and the visible data table beside it carry every value, so it
 *      is `aria-hidden` and nothing is read twice.
 * Spec: INS-008, INS-006, UD-003, UD-012, UD-002
 * Invariants:
 *   - A11Y: `aria-hidden`; every value it draws is in the figure's table too (the sections in this folder).
 *   - A suppressed value (INS-006) or one that is not available has no bar, only its text («< 5»).
 *   - Colours only from the tokens through Tailwind classes; no style attribute (D-072). Bars are SVG rectangles
 *     whose width is an attribute; under forced colours they are drawn in the system's text colour.
 *   - A second series is told apart by its stripes and the legend, never by a second colour.
 *   - A row's label wraps within its column and is never truncated (UD-002, WCAG 1.4.12).
 * Collaborators: ./ItemDifficultySection.tsx, ./ChoiceQuestion.tsx, ./GapQuestion.tsx,
 *   ./VideoEngagementSection.tsx.
 * Tests: apps/web/test/features/insight/InsightCharts.test.tsx
 */
'use client';

import { useId } from 'react';

/** How a bar is filled: the first series solid, the second striped. */
export type BarPattern = 'solid' | 'striped';

/** The first series' fill. */
export const SOLID: BarPattern = 'solid';
/** The second series' fill. */
export const STRIPED: BarPattern = 'striped';

/** One bar and the value written next to it. */
export interface ChartBar {
  /** The bar's length from 0 to 1; undefined draws no bar (a suppressed or unavailable value). */
  readonly fraction: number | undefined;
  /** The value as written, e.g. `38 %`, `12` or `< 5`. */
  readonly text: string;
  readonly pattern: BarPattern;
}

/** One row of the chart. */
export interface ChartRow {
  readonly key: string;
  /** A short label, e.g. «Spm. 2» or an option's text. */
  readonly label: string;
  readonly bars: readonly ChartBar[];
}

/** One entry of the legend. */
export interface ChartLegendEntry {
  readonly pattern: BarPattern;
  readonly label: string;
}

const BAR_FILL = 'fill-hvl-accent forced-colors:fill-[CanvasText]';

/** The SVG pattern of the striped series, defined once per chart. */
function Stripes({ id }: { readonly id: string }) {
  return (
    <defs>
      <pattern id={id} width="4" height="10" patternUnits="userSpaceOnUse" patternTransform="skewX(-30)">
        <rect width="2" height="10" className={BAR_FILL} />
      </pattern>
    </defs>
  );
}

/** One bar in its outlined track. */
function Bar({ bar, patternId }: { readonly bar: ChartBar; readonly patternId: string }) {
  const striped = bar.pattern === 'striped';
  return (
    <svg viewBox="0 0 100 10" preserveAspectRatio="none" focusable="false" className="h-4 min-w-16 flex-1">
      <rect
        width="100"
        height="10"
        vectorEffect="non-scaling-stroke"
        className="fill-hvl-surface stroke-hvl-ink-muted forced-colors:fill-[Canvas] forced-colors:stroke-[CanvasText]"
      />
      {bar.fraction === undefined ? null : (
        <rect
          width={Math.min(1, Math.max(0, bar.fraction)) * 100}
          height="10"
          fill={striped ? `url(#${patternId})` : undefined}
          className={striped ? undefined : BAR_FILL}
        />
      )}
    </svg>
  );
}

/** A small sample of a series' fill, for the legend. */
function Swatch({ pattern, patternId }: { readonly pattern: BarPattern; readonly patternId: string }) {
  return (
    <svg viewBox="0 0 10 10" focusable="false" className="h-4 w-4">
      <rect
        width="10"
        height="10"
        fill={pattern === 'striped' ? `url(#${patternId})` : undefined}
        className={`stroke-hvl-ink-muted ${pattern === 'striped' ? '' : BAR_FILL}`}
      />
    </svg>
  );
}

/**
 * The drawn chart.
 * @param props - The rows and, for two series, the legend.
 * @returns The chart, hidden from assistive technology (its table carries the values).
 */
export function BarChart({
  rows,
  legend,
}: {
  readonly rows: readonly ChartRow[];
  readonly legend?: readonly ChartLegendEntry[];
}) {
  // WHY: React's IDs may hold characters that a `url(#…)` reference does not accept.
  const patternId = `insight-stripes-${useId().replace(/[^A-Za-z0-9_-]/g, '')}`;
  return (
    <div aria-hidden="true" className="relative mb-3 max-w-3xl">
      {/* WHY: one pattern per chart, defined once, so no ID repeats however many bars use it. */}
      <svg focusable="false" className="absolute h-0 w-0">
        <Stripes id={patternId} />
      </svg>
      {legend ? (
        <p className="m-0 mb-2 flex flex-wrap gap-4">
          {legend.map((entry) => (
            <span key={entry.pattern} className="inline-flex items-center gap-1">
              <Swatch pattern={entry.pattern} patternId={patternId} />
              {entry.label}
            </span>
          ))}
        </p>
      ) : null}
      <ul className="m-0 list-none p-0">
        {rows.map((row) => (
          <li key={row.key} className="mb-2 grid grid-cols-[minmax(4rem,10rem)_1fr] items-center gap-2">
            {/* A11Y: the label wraps in its column, never cut off with an ellipsis: wider text spacing (WCAG
                1.4.12) or zoom must not hide words of it (the body's overflow-wrap breaks a word too long). */}
            <span className="min-w-0">{row.label}</span>
            <span className="flex flex-col gap-1">
              {row.bars.map((bar) => (
                <span key={bar.pattern} className="flex items-center gap-2">
                  <Bar bar={bar} patternId={patternId} />
                  <span className="min-w-14 font-bold">{bar.text}</span>
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

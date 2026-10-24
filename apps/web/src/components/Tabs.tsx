/**
 * Tabs — the WAI-ARIA tabs pattern: a tab list operated with the arrow keys, Home and End, and one panel at a time.
 *
 * Why: the activity page and the Canvas page show **Spel**, **Rediger** and **Sjekk og publiser** as tabs (LTI-006,
 *      PROD-003). UD-006 asks custom widgets to follow the WAI-ARIA Authoring Practices: one tab stop for the list
 *      (roving `tabIndex`), arrows move between tabs, and the panel follows in the tab order.
 * Spec: UD-006, LTI-006, UD-005, UD-012
 * Invariants:
 *   - `manualActivation` moves focus with the arrows and selects with Enter or Space, for panels that load
 *     slowly (the H5P editor); otherwise a tab is selected when it gets focus.
 *   - A panel mounts the first time its tab is selected and then stays mounted (hidden), so an editor keeps its
 *     unsaved work while another tab is shown.
 *   - The selected tab is shown by an underline and bold text, not by colour alone, also under forced colours (the
 *     `.tab` rules in ../styles/components.css, UD-012); every tab is at least 24 px high.
 * Collaborators: ../features/activity/ActivityView.tsx, ../features/lti/LtiPlayView.tsx, ../styles/components.css.
 * Tests: apps/web/test/components/Tabs.test.tsx, apps/server/test/web/webChrome.browser.int.test.ts
 */
'use client';

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

/** One tab and its panel. */
export interface TabItem {
  /** Stable identifier, e.g. `play`. */
  readonly id: string;
  readonly label: string;
  readonly panel: ReactNode;
}

/** What the tabs need. */
export interface TabsProps {
  /** The accessible name of the tab list. */
  readonly label: string;
  readonly tabs: readonly TabItem[];
  /** The selected tab; controlled together with `onSelect`. */
  readonly selectedId: string;
  readonly onSelect: (id: string) => void;
  /** Arrows move focus only; Enter or Space selects. For panels that load slowly. */
  readonly manualActivation?: boolean;
}

/**
 * The tab list and its panels.
 * @param props - Label, tabs, the selected tab and how keys select.
 * @returns The tabs.
 */
export function Tabs({ label, tabs, selectedId, onSelect, manualActivation = false }: TabsProps) {
  const base = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const [visited, setVisited] = useState<ReadonlySet<string>>(() => new Set([selectedId]));
  if (!visited.has(selectedId)) setVisited(new Set([...visited, selectedId]));
  const selectedIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === selectedId),
  );
  const [focusIndex, setFocusIndex] = useState(selectedIndex);
  const [listFocused, setListFocused] = useState(false);

  const moveTo = (index: number) => {
    const next = (index + tabs.length) % tabs.length;
    setFocusIndex(next);
    buttons.current[next]?.focus();
    const tab = tabs[next];
    if (!manualActivation && tab) onSelect(tab.id);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const keys: Record<string, () => void> = {
      ArrowRight: () => moveTo(index + 1),
      ArrowLeft: () => moveTo(index - 1),
      Home: () => moveTo(0),
      End: () => moveTo(tabs.length - 1),
    };
    const action = keys[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };
  // WHY: the roving tab stop follows the arrows while the list has focus, and returns to the selected tab after.
  const tabStop = listFocused ? focusIndex : selectedIndex;

  return (
    <div>
      <div
        role="tablist"
        aria-label={label}
        className="flex flex-wrap gap-1 border-b border-hvl-band"
        onFocus={() => setListFocused(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setListFocused(false);
        }}
      >
        {tabs.map((tab, index) => {
          const selected = tab.id === selectedId;
          return (
            <button
              key={tab.id}
              ref={(element) => {
                buttons.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${tab.id}`}
              tabIndex={index === tabStop ? 0 : -1}
              onFocus={() => setFocusIndex(index)}
              onClick={() => onSelect(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`tab min-h-target cursor-pointer bg-transparent px-4 py-2 text-hvl-primary-dark ${
                selected ? 'font-bold' : ''
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${base}-panel-${tab.id}`}
          aria-labelledby={`${base}-tab-${tab.id}`}
          hidden={tab.id !== selectedId}
          tabIndex={0}
          className="pt-4"
        >
          {visited.has(tab.id) ? tab.panel : null}
        </div>
      ))}
    </div>
  );
}

/**
 * Dialog — a modal dialog: focus moves in and stays in, Escape closes it, and focus returns to what opened it.
 *
 * Why: UD-006 forbids keyboard traps and asks modal dialogs to return focus on close (WAI-ARIA dialog pattern). The
 *      rest of the page is made `inert` while the dialog is open, so neither pointer, keyboard nor screen reader
 *      reaches it; Tab and Shift+Tab wrap inside the dialog.
 * Spec: UD-006, UD-004
 * Invariants:
 *   - Rendered into `document.body` only while open; every other child of `body` is `inert` until it closes.
 *   - On open, focus goes to the dialog itself, so its name is read first; on close, back to the element that had
 *     focus when it opened, if that element is still on the page.
 *   - Escape and the close button both call `onClose`; the caller decides what closing means.
 * Collaborators: ./PublishDialog.tsx, ../i18n/LocaleContext.tsx.
 * Tests: apps/web/test/components/Dialog.test.tsx
 */
'use client';

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from '../i18n/LocaleContext';
import { t } from '../i18n/translate';

/** What the dialog needs. */
export interface DialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

const focusableIn = (root: HTMLElement): HTMLElement[] =>
  [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => !element.closest('[hidden]'));

/**
 * A modal dialog.
 * @param props - Whether it is open, its title, the close handler and its content.
 * @returns The dialog in a portal, or nothing while closed.
 */
export function Dialog({ open, title, onClose, children }: DialogProps) {
  const locale = useLocale();
  const titleId = useId();
  const box = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    const container = box.current?.closest('[data-dialog-root]');
    // A11Y: WCAG 2.4.3: the page behind a modal dialog cannot be reached until the dialog closes.
    const others = [...document.body.children].filter(
      (child) => child !== container && !child.hasAttribute('inert'),
    );
    for (const element of others) element.setAttribute('inert', '');
    box.current?.focus();
    return () => {
      for (const element of others) element.removeAttribute('inert');
      const previous = opener.current;
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !box.current) return;
    const focusable = focusableIn(box.current);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return event.preventDefault();
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === box.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      data-dialog-root=""
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4"
    >
      {/* WHY: the scrim is decoration behind the dialog; no text sits on it, so it is not a contrast pairing. */}
      <div aria-hidden="true" className="fixed inset-0 bg-hvl-ink opacity-60" />
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="relative mt-8 w-full max-w-2xl rounded bg-hvl-surface p-6 text-hvl-ink"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="button-secondary" onClick={onClose}>
            {t('common.close', locale)}
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

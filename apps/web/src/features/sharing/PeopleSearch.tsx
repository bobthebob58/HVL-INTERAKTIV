/**
 * PeopleSearch — finds HVL staff to add as co-authors: a labelled search field that searches after three letters,
 * a short pause, and results as a list of «Legg til <namn>» buttons.
 *
 * Why: PROD-007 finds co-authors "by name or Feide ID" (D-090). The server answers at most 10 findable colleagues and
 *      limits searches per person; the field waits for a pause in typing, so a person typing a name makes a few
 *      searches, not one per key.
 * Spec: PROD-007, UD-006, UD-013
 * Invariants:
 *   - Nothing is sent before the trimmed query has 3 characters; a query is sent 300 ms after the last change, and
 *     only the latest answer is shown.
 *   - A11Y: the field has a visible label and a hint (WCAG 3.3.2); the number of results is announced politely in a
 *     status region (WCAG 4.1.3), focus stays in the field while typing.
 *   - People already on the list (`exclude`) are not offered again.
 *   - A 429 is explained in words (wait a minute); any other refusal shows the server's message (e.g. a student
 *     author's `hvl:sharing-not-allowed`).
 *   - PRIVACY: the query lives only in the field and the request; it is never stored.
 * Collaborators: ../../api/collaborationApi.ts (`searchPeople`), ./CoAuthorSection.tsx, ./SharingFeedback.tsx.
 * Tests: apps/web/test/features/PeopleSearch.test.tsx
 */
'use client';

import type { Person } from '@hvl-interaktiv/api-contract';
import { forwardRef, useEffect, useId, useRef, useState } from 'react';
import { useApiAuth } from '../../api/ApiAuthContext';
import { searchPeople } from '../../api/collaborationApi';
import { useLocale } from '../../i18n/LocaleContext';
import { t, type Locale } from '../../i18n/translate';
import { SharingProblem } from './SharingFeedback';

/** How long the field waits after the last change before it searches. */
export const SEARCH_PAUSE_MS = 300;

/**
 * The shortest query sent: the contract's `PEOPLE_QUERY_MIN_LENGTH` (the web app imports only types from the
 * contract, so a test keeps the two equal).
 */
export const SEARCH_MIN_LENGTH = 3;

/** What the search needs. */
export interface PeopleSearchProps {
  /** User IDs already on the activity (the owner and its co-authors). */
  readonly exclude: ReadonlySet<string>;
  /** Adds a person; the search keeps focus in its field afterwards. */
  readonly onAdd: (person: Person) => void;
}

/**
 * A person's name as shown, or the "not known" text.
 * @param person - The person.
 * @param locale - The page's locale.
 * @returns The display name, or `sharing.unknownName`.
 */
export const shownName = (person: Pick<Person, 'displayName'>, locale: Locale): string =>
  person.displayName ?? t('sharing.unknownName', locale);

type Found = { readonly people: readonly Person[] } | { readonly error: string } | undefined;

/** The search field and its results; the field's element is passed to `ref`, so a caller can focus it. */
export const PeopleSearch = forwardRef<HTMLInputElement, PeopleSearchProps>(function PeopleSearch(
  { exclude, onAdd },
  ref,
) {
  const locale = useLocale();
  const auth = useApiAuth();
  const base = useId();
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Found>();
  const latest = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    latest.current += 1;
    const asked = latest.current;
    if (trimmed.length < SEARCH_MIN_LENGTH) {
      setFound(undefined);
      return;
    }
    const timer = window.setTimeout(() => {
      void searchPeople(trimmed, auth).then((result) => {
        // WHY: a slower answer to an older query must not replace the answer to the current one.
        if (asked !== latest.current) return;
        if (result.ok) setFound({ people: result.data.people });
        else if (result.status === 429) setFound({ error: t('sharing.rateLimited', locale) });
        else setFound({ error: result.error?.message ?? t('sharing.searchFailed', locale) });
      });
    }, SEARCH_PAUSE_MS);
    return () => window.clearTimeout(timer);
  }, [query, auth, locale]);

  const people = found && 'people' in found ? found.people.filter((p) => !exclude.has(p.userId)) : undefined;
  const count =
    people === undefined
      ? ''
      : people.length === 0
        ? t('sharing.searchNone', locale)
        : t('sharing.searchCount', locale, { count: people.length });
  return (
    <div className="mt-4">
      <label htmlFor={`${base}-query`} className="block font-bold">
        {t('sharing.searchLabel', locale)}
      </label>
      <p id={`${base}-hint`} className="m-0 text-hvl-ink-muted">
        {t('sharing.searchHint', locale)}
      </p>
      <input
        ref={ref}
        id={`${base}-query`}
        type="search"
        autoComplete="off"
        aria-describedby={`${base}-hint`}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="min-h-target w-full max-w-md rounded border-2 border-hvl-ink-muted bg-hvl-surface p-1"
      />
      <p role="status" className="m-0 min-h-6">
        {count}
      </p>
      {found && 'error' in found ? <SharingProblem text={found.error} /> : null}
      {people && people.length > 0 ? (
        <ul aria-label={t('sharing.searchResults', locale)} className="m-0 list-none p-0">
          {people.map((person) => (
            <li key={person.userId} className="mt-2">
              <button type="button" className="button-secondary" onClick={() => onAdd(person)}>
                {t('sharing.addPerson', locale, { name: shownName(person, locale) })}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
});

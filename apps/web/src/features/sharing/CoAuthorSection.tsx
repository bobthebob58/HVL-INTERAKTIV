/**
 * CoAuthorSection — an activity's owner and co-authors on the **Deling** tab: the list, remove buttons, and for the
 * owner the people search that adds colleagues.
 *
 * Why: PROD-007 lets HVL staff work on an activity together (D-090): the owner adds and removes co-authors, and a
 *      co-author may remove only themself («Fjern meg»). The server decides each change and answers the list as it is
 *      afterwards, which this section then shows.
 * Spec: PROD-007, UD-006, UD-013
 * Invariants:
 *   - Remove buttons follow the server's answer: every co-author's for the owner (`mayManage`), only the own one
 *     (`isSelf`) for a co-author; the search only for the owner.
 *   - A11Y: once a change has rendered (an effect, not a timer), focus returns to the search field after adding,
 *     goes to the list's heading after removing someone (the pressed button is gone), and after «Fjern meg» to a
 *     lasting message with a link to the person's activities, never to `body`. Each change is announced politely
 *     (WCAG 2.4.3, 4.1.3).
 *   - Every name is shown as given; a missing one says so in words.
 * Collaborators: ../../api/collaborationApi.ts, ./PeopleSearch.tsx, ./SharingFeedback.tsx, ./SharingPanel.tsx,
 *   ../../config/paths.ts.
 * Tests: apps/web/test/features/CoAuthorSection.test.tsx, apps/web/test/features/PeopleSearch.test.tsx
 */
'use client';

import type { CoAuthor, CoAuthorList, Person } from '@hvl-interaktiv/api-contract';
import { useEffect, useId, useRef, useState } from 'react';
import { useApiAuth } from '../../api/ApiAuthContext';
import { addCoAuthor, getCoAuthors, removeCoAuthor } from '../../api/collaborationApi';
import type { ApiResult } from '../../api/apiRequest';
import { HOME_PATH } from '../../config/paths';
import { useLocale } from '../../i18n/LocaleContext';
import { t } from '../../i18n/translate';
import { PeopleSearch, shownName } from './PeopleSearch';
import { SharingProblem } from './SharingFeedback';

/** What the section needs. */
export interface CoAuthorSectionProps {
  readonly contentId: string;
  /** Says something in the page's polite status region. */
  readonly announce: (message: string) => void;
}

/**
 * The co-author list, its remove buttons and the owner's search.
 * @param props - The activity and the page's announcer.
 * @returns The section.
 */
export function CoAuthorSection({ contentId, announce }: CoAuthorSectionProps) {
  const locale = useLocale();
  const auth = useApiAuth();
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const searchField = useRef<HTMLInputElement>(null);
  const leftMessage = useRef<HTMLParagraphElement>(null);
  const [list, setList] = useState<CoAuthorList | 'loading' | 'failed' | 'left'>('loading');
  const [problem, setProblem] = useState<string>();
  const focusAfterChange = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    // A11Y: WCAG 2.4.3: runs once the change has rendered, so the lasting message after «Fjern meg» is on screen.
    // Chromium may run a 0 ms timer before that render, as it did for the bank listing (S5 review).
    focusAfterChange.current?.();
    focusAfterChange.current = undefined;
  }, [list]);

  useEffect(() => {
    let active = true;
    void getCoAuthors(contentId, auth).then((result) => {
      if (active) setList(result.ok ? result.data : 'failed');
    });
    return () => {
      active = false;
    };
  }, [contentId, auth]);

  const change = async (request: Promise<ApiResult<CoAuthorList>>, said: string, focus: () => void) => {
    setProblem(undefined);
    const result = await request;
    if (!result.ok) {
      setProblem(result.error?.message ?? t('sharing.changeFailed', locale));
      return;
    }
    focusAfterChange.current = focus;
    setList(result.data);
    announce(said);
  };
  const add = (person: Person) =>
    void change(
      addCoAuthor(contentId, person.userId, auth),
      t('sharing.added', locale, { name: shownName(person, locale) }),
      () => searchField.current?.focus(),
    );
  const remove = (coAuthor: CoAuthor) => {
    if (coAuthor.isSelf) {
      void removeCoAuthor(contentId, coAuthor.userId, auth).then((result) => {
        if (!result.ok) return setProblem(result.error?.message ?? t('sharing.changeFailed', locale));
        focusAfterChange.current = () => leftMessage.current?.focus();
        setList('left');
        announce(t('sharing.removedSelf', locale));
      });
      return;
    }
    void change(
      removeCoAuthor(contentId, coAuthor.userId, auth),
      t('sharing.removed', locale, { name: shownName(coAuthor, locale) }),
      () => heading.current?.focus(),
    );
  };

  const title = (
    <h3 id={headingId} ref={heading} tabIndex={-1}>
      {t('sharing.coAuthorsHeading', locale)}
    </h3>
  );
  if (list === 'loading')
    return (
      <section aria-labelledby={headingId}>
        {title}
        <p role="status">{t('common.loading', locale)}</p>
      </section>
    );
  if (list === 'failed')
    return (
      <section aria-labelledby={headingId}>
        {title}
        <p role="alert">{t('sharing.coAuthorsFailed', locale)}</p>
      </section>
    );
  if (list === 'left') {
    return (
      <section aria-labelledby={headingId}>
        {title}
        <p ref={leftMessage} tabIndex={-1}>
          {t('sharing.removedSelf', locale)} <a href={HOME_PATH}>{t('sharing.backHome', locale)}</a>
        </p>
      </section>
    );
  }
  const onList = new Set([list.owner.userId, ...list.coAuthors.map((c) => c.userId)]);
  return (
    <section aria-labelledby={headingId} className="mb-6">
      {title}
      <p>{t('sharing.coAuthorsIntro', locale)}</p>
      <ul className="m-0 pl-6">
        <li>{t('sharing.ownerEntry', locale, { name: shownName(list.owner, locale) })}</li>
        {list.coAuthors.map((coAuthor) => (
          <li key={coAuthor.userId} className="mt-2">
            <span className="mr-2">{shownName(coAuthor, locale)}</span>
            {list.mayManage || coAuthor.isSelf ? (
              <button type="button" className="button-secondary" onClick={() => remove(coAuthor)}>
                {coAuthor.isSelf
                  ? t('sharing.removeSelf', locale)
                  : t('sharing.remove', locale, { name: shownName(coAuthor, locale) })}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {list.coAuthors.length === 0 ? <p>{t('sharing.noCoAuthors', locale)}</p> : null}
      {problem ? <SharingProblem text={problem} /> : null}
      {list.mayManage ? <PeopleSearch ref={searchField} exclude={onList} onAdd={add} /> : null}
    </section>
  );
}

/**
 * Component tests for PublishDialog: one reason field per unexplained error, an error summary for missing or too
 * long reasons, the publish request with the findings' `updatedAt`, and plain-language messages for the 409 answers.
 *
 * Spec: PROD-003, UD-022, UD-013
 */
// @vitest-environment jsdom
import {
  MAX_ACKNOWLEDGEMENTS,
  REASON_MAX_LENGTH,
  type FindingWithAcknowledgement,
  type FindingsResponse,
} from '@hvl-interaktiv/api-contract';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ApiAuthProvider } from '../../src/api/ApiAuthContext';
import { PublishDialog, REASON_MAX, unexplainedErrors } from '../../src/components/PublishDialog';
import { errorBody, fakeFetch } from '../support/fakeFetch';

const ID = '7d3c1a8e-5b2f-4c1d-9e8f-0a1b2c3d4e5f';
const PUBLISH = `POST /api/content/${ID}/publish`;
const error = (ruleId: string, message: string, acknowledged = false): FindingWithAcknowledgement => ({
  ruleId,
  severity: 'error',
  requirement: 'UD-021',
  path: `${ruleId}.path`,
  message,
  acknowledgement: acknowledged
    ? { reason: 'Kjem', at: '2026-10-23T10:00:00.000Z', expiresAt: '2026-11-06T10:00:00.000Z' }
    : null,
});
const FINDINGS: FindingsResponse = {
  updatedAt: '2026-10-23T12:00:00.000Z',
  findings: [
    error('V-IMG-ALT', 'Biletet manglar alternativ tekst.'),
    error('V-VID-CAPTIONS', 'Videoen manglar teksting.', true),
    { ...error('PED-H05', 'Gi ei forklaring.'), severity: 'hint' },
  ],
};

const show = (
  handlers: Partial<Record<'onPublished' | 'onStale' | 'onFindings' | 'onClose', () => void>> = {},
) =>
  render(
    <ApiAuthProvider auth={{ kind: 'portal', csrfToken: 'csrf-1' }}>
      <PublishDialog
        contentId={ID}
        open
        findings={FINDINGS}
        onClose={handlers.onClose ?? (() => undefined)}
        onPublished={handlers.onPublished ?? (() => undefined)}
        onStale={handlers.onStale ?? (() => undefined)}
        onFindings={handlers.onFindings ?? (() => undefined)}
      />
    </ApiAuthProvider>,
  );

const reasonField = () => screen.getByLabelText('Grunngjeving for «Biletet manglar alternativ tekst.»');
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Publiser no' }));

describe('[PROD-003] the publish dialog', () => {
  it('[UD-022] agrees with the contract on the longest reason and asks only about unexplained errors', () => {
    expect(REASON_MAX).toBe(REASON_MAX_LENGTH);
    expect(MAX_ACKNOWLEDGEMENTS).toBeGreaterThanOrEqual(1);
    expect(unexplainedErrors(FINDINGS.findings).map((finding) => finding.ruleId)).toEqual(['V-IMG-ALT']);
    show();
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.getByText('Åtvaringar og tips hindrar ikkje publisering (1).')).toBeTruthy();
  });

  it('[UD-013] a missing reason gives an error summary linked to the field, and nothing is sent', async () => {
    // Arrange
    const requests = fakeFetch({});
    show();
    // Act
    submit();
    // Assert
    const summary = await screen.findByRole('alert');
    expect(summary.textContent).toContain(
      'Skriv ei grunngjeving for feilen «Biletet manglar alternativ tekst.».',
    );
    const field = reasonField();
    expect(summary.querySelector('a')?.getAttribute('href')).toBe(`#${field.id}`);
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(field.getAttribute('aria-describedby')).toContain(`${field.id}-error`);
    expect(requests).toHaveLength(0);
  });

  it('[UD-022] a reason over 500 characters is refused with its length', async () => {
    fakeFetch({});
    show();
    fireEvent.change(reasonField(), { target: { value: 'x'.repeat(REASON_MAX + 1) } });
    submit();
    expect((await screen.findByRole('alert')).textContent).toContain('501 av 500 teikn');
  });

  it('[PROD-003] publishes with the findings’ updatedAt, the trimmed reason and the CSRF token', async () => {
    // Arrange
    const onPublished = vi.fn();
    const answer = {
      status: 'published',
      updatedAt: '2026-10-23T12:01:00.000Z',
      publishedAt: '2026-10-23T12:01:00.000Z',
    };
    const requests = fakeFetch({ [PUBLISH]: { status: 200, body: answer } });
    show({ onPublished });
    // Act
    fireEvent.change(reasonField(), { target: { value: '  Alt-tekst kjem i morgon.  ' } });
    submit();
    // Assert
    await waitFor(() => expect(onPublished).toHaveBeenCalledWith(answer));
    expect(requests[0]?.body).toEqual({
      updatedAt: FINDINGS.updatedAt,
      acknowledgements: [{ ruleId: 'V-IMG-ALT', path: 'V-IMG-ALT.path', reason: 'Alt-tekst kjem i morgon.' }],
    });
    expect(requests[0]?.headers['x-csrf-token']).toBe('csrf-1');
  });

  it('[PROD-003] 409 publish-blocked explains in plain language and hands on the server’s findings', async () => {
    // Arrange
    const onFindings = vi.fn();
    const current = [error('V-IMG-ALT', 'Biletet manglar alternativ tekst.'), error('V-NEW', 'Ny feil.')];
    fakeFetch({
      [PUBLISH]: { status: 409, body: { ...errorBody(409, 'hvl:publish-blocked'), findings: current } },
    });
    show({ onFindings });
    // Act
    fireEvent.change(reasonField(), { target: { value: 'Kjem.' } });
    submit();
    // Assert
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Nokre feil manglar framleis grunngjeving.',
    );
    expect(onFindings).toHaveBeenCalledWith(current);
  });

  it('[PROD-003] 409 content-changed explains, fetches the findings again and keeps the typed reason', async () => {
    // Arrange
    const onStale = vi.fn();
    fakeFetch({ [PUBLISH]: { status: 409, body: errorBody(409, 'hvl:content-changed') } });
    show({ onStale });
    // Act
    fireEvent.change(reasonField(), { target: { value: 'Kjem.' } });
    submit();
    // Assert
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Aktiviteten vart endra medan du sjekka han.',
    );
    expect(onStale).toHaveBeenCalledOnce();
    expect(reasonField()).toHaveProperty('value', 'Kjem.');
  });

  it('[UD-013] closing clears the problems but keeps the typed reasons for the next opening', async () => {
    // Arrange
    fakeFetch({});
    const Harness = () => {
      const [open, setOpen] = useState(true);
      return (
        <ApiAuthProvider auth={{ kind: 'portal', csrfToken: 'csrf-1' }}>
          <button type="button" onClick={() => setOpen(true)}>
            Opne
          </button>
          <PublishDialog
            contentId={ID}
            open={open}
            findings={FINDINGS}
            onClose={() => setOpen(false)}
            onPublished={() => undefined}
            onStale={() => undefined}
            onFindings={() => undefined}
          />
        </ApiAuthProvider>
      );
    };
    render(<Harness />);
    const long = 'x'.repeat(REASON_MAX + 1);
    fireEvent.change(reasonField(), { target: { value: long } });
    submit();
    await screen.findByRole('alert');
    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Avbryt' }));
    fireEvent.click(screen.getByRole('button', { name: 'Opne' }));
    // Assert
    expect(screen.queryByRole('alert')).toBeNull();
    expect(reasonField()).toHaveProperty('value', long);
  });

  it('[PROD-003] other refusals show the server’s translated message', async () => {
    fakeFetch({
      [PUBLISH]: { status: 401, body: errorBody(401, 'hvl:session-expired', 'Økta di har gått ut.') },
    });
    show();
    fireEvent.change(reasonField(), { target: { value: 'Kjem.' } });
    submit();
    expect((await screen.findByRole('alert')).textContent).toContain('Økta di har gått ut.');
  });
});

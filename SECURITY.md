# Tryggleik / Security

## Nynorsk

### Meld frå privat

Har du funne eit tryggleiksproblem i HVL Interaktiv? Skriv det ikkje i ei sak (*issue*), i ein kommentar eller i
eit endringsforslag (*pull request*). Alle kan lese dei.

Meld frå privat, på ein av desse måtane:

1. På GitHub: opne fana «Security» i kodelageret og vel «Report a vulnerability». Knappen finst når eigaren har slått
   på privat melding.
2. Med e-post til HVL: **[HVL fyller inn: e-postadresse for tryggleiksmeldingar]**

Eit tryggleiksproblem er til dømes:

- Nokon kan logge inn som ein annan, eller får rettar som dei ikkje skal ha.
- Nokon kan sjå eller endre data om andre. Det gjeld også tal i Innsikt for færre enn fem studentar.
- Ei fil som nokon lastar opp, kan køyre kode i nettlesaren.
- Ein nøkkel, eit passord eller ein token er synleg.

### Kva du skriv

- Kva problemet er, og kvar det er (sida, men ikkje heile adressa om ho har ein token i seg).
- Stega for å få fram problemet.
- Kva nokon kan gjere med det.

Send ikkje personopplysningar eller ekte data om studentar. Bruk testbrukarar. Hent ikkje meir data enn du treng for
å vise problemet.

### Kva som skjer

- HVL stadfestar at meldinga har kome fram.
- Vi rettar problemet slik [rettleiinga for testarar](docs/testing/rapportere-problem.md) seier, men privat til
  rettinga er klar.
- Gjeld det personopplysningar, får personvernombodet til HVL vite det same dag.
- Vi avtaler med deg når problemet kan bli kjent.

## English

Please do not report a security problem in a public issue, comment or pull request. Report it privately: through
GitHub's private vulnerability reporting («Report a vulnerability» on the repository's Security tab, once the owner
has turned it on), or by e-mail to HVL: **[HVL to fill in: e-mail address for security reports]**.

Describe the problem, where it is (without a URL that carries a token), the steps to reproduce it and its impact.
Use test users only; never send personal data or real student data, and do not access more data than you need to
show the problem. HVL confirms receipt, fixes the problem privately as the pilot's fault process describes, tells
HVL's data protection officer the same day if personal data is involved, and agrees with you when it can be made
public.

**Supported version:** the `main` branch and the version deployed for the pilot.

**Known and mitigated:** CVE-2025-7062 (stored XSS through uploaded files) is not fixed in any release of
`@lumieducation/h5p-server`, including 10.0.4, which HVL Interaktiv uses. HVL Interaktiv sanitises every SVG on both
upload paths, checks file contents against their type, and serves the player's user files from a separate origin with
`Content-Security-Policy: sandbox` and `X-Content-Type-Options: nosniff`; the editor's files stay on the app origin
under grants of their own (decisions D-003 and D-110, requirements `SEC-001` and `SEC-004`). A report that names the
CVE alone is known; a way around these measures is very welcome.

# Draft: two `clamscan` issues (TLS without SNI; errors on stderr without debug mode)

| | |
|---|---|
| **Recipient** | The `clamscan` maintainer, repository `kylefarris/clamscan` |
| **Channel** | Two public GitHub issues. Neither is a vulnerability: the certificate is still checked against the host name, and the log lines hold no file content |
| **Status** | Needs the owner's check: whether to file them (D-112's Decision names Lumi and H5P only; PROGRESS's step-6 list adds `clamscan`) |
| **Our records** | D-110's ClamAV amendment (2026-11-05), D-112; `docs/ops/clamav.md` |
| **Checked** | 2026-11-05: `clamscan` 2.4.0, still npm's newest (modified 2024-10-21); Node.js 24.22.1 |

---

## Issue 1

### Title

TLS connections to clamd send no SNI (`servername` is commented out)

### Body

#### Environment

`clamscan` 2.4.0, Node.js 24.22.1, `clamdscan: { host, port, tls: true }`, clamd behind a TLS proxy.

#### Steps to reproduce

1. Run a TLS server that logs the server name it receives (Node's `tls.createServer`, whose socket has
   `servername`), or a TLS proxy that picks its certificate by SNI.
2. Point `clamscan` at it with `tls: true` and a host name, and scan a file.

#### Expected

The client sends the host name as SNI, so a proxy that serves several names picks the right certificate.

#### Actual

`index.js` (`_initSocket`) calls `tls.connect({ host, port, timeout })`; the line
`servername: this.settings.clamdscan.host` below "Activate SNI" is commented out. Node's `tls.connect` sends no SNI
when `servername` is not given (measured with Node.js 24.22.1: the server sees `servername === false`). The
certificate is still checked against `host`, so a proxy that needs SNI to choose its certificate answers with the
wrong one and the connection fails.

#### Suggested fix

Pass `servername: host` when `host` is a name, not an IP address (Node warns about an IP address as SNI).

#### Our workaround

None in code. Our operations guide puts a TLS proxy in front of clamd, since clamd has no TLS of its own, and says
that the proxy must not depend on SNI to choose its certificate (`docs/ops/clamav.md`). Our test
`FailClosedMalwareScanner.failures.test.ts` ("[SEC-006] with CLAMAV_TLS a clamd without TLS is refused, never spoken
to in clear text") covers the TLS path; with TLS on, a wrong or untrusted certificate is refused and the file is not
sent.

## Issue 2

### Title

Socket errors are written to stderr with `console.error` even when `debugMode` is off

### Body

#### Environment

`clamscan` 2.4.0, Node.js 24.

#### Steps to reproduce

Scan a stream (`scanStream`) against a clamd that refuses the connection, closes it, or fails the TLS handshake,
with `debugMode: false`.

#### Expected

Nothing is written to stdout or stderr when `debugMode` is off; the error reaches the caller.

#### Actual

`index.js` writes ``console.error(`${me.debugLabel}: Error emitted from ClamAV socket: `, err)`` without a `debugMode`
check (about line 1301), while the similar line for a failed connection (about line 1371) has one. Hosts that log
in a structured format get an unstructured line on stderr; for a TLS name mismatch it includes the peer certificate.

#### Suggested fix

Guard the call with `if (me.settings.debugMode)`, as the other socket error is.

#### Our workaround

We note it in our code (`apps/server/src/security/malware/clamdClient.ts`, marked `UPSTREAM:`) and in our runbook:
the line holds Node's error text, never a file name or file content.

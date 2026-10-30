# Trying HVL Interaktiv in GitHub Codespaces

This folder sets up a development container: Node.js 24, Docker for the local PostgreSQL, Redis and S3 emulator
(`docker-compose.yml`), full Chromium, the H5P core and editor, the ten real content types and the built web app. The
app then runs against the **mock Feide** and the **mock Canvas** (`tools/mock-platform`, D-049), with made-up users
and no HVL accounts. It is for trying and reviewing the app, never for real data.

## Start a codespace

1. On the repository's page on GitHub, choose **Code → Codespaces → … → New with options**.
2. Choose the branch, and a machine with at least 4 cores (`hostRequirements` asks for it). Choose **Create
   codespace**.
3. The first start runs `setup.sh` for about 20–30 minutes. It downloads and builds the content types (about 2 GB),
   then builds the web app. Its last line is `Ready. Start the app with: bash .devcontainer/start.sh`. You can follow
   it in the creation log (Command Palette → **Codespaces: View Creation Log**). If a step fails, the log names the
   step instead (see [Check that it works](#check-that-it-works)).
4. **Open the codespace in VS Code on your own computer:** on [github.com/codespaces](https://github.com/codespaces),
   choose **…** next to the codespace → **Open in** → **Visual Studio Code** (in the browser editor, the menu (☰) →
   **Open in VS Code Desktop** does the same). VS Code needs the **GitHub Codespaces** extension, signed in to your
   GitHub account. This matters: VS Code then forwards the app's ports to `localhost` (`127.0.0.1`) on your computer,
   which the mock Feide and the mock Canvas need. In the browser editor the ports get `*.app.github.dev` addresses:
   the pages load there, but «Logg inn med Feide» ends on `localhost:4200` with «connection refused», and the mock
   Canvas does not load. The Ports tab tells you which you have: its «Forwarded Address» column must say
   `localhost:3000`, not `https://…app.github.dev`. In VS Code, Ctrl+Shift+P → **Codespaces: Connect to Codespace**
   opens an existing codespace, and **Editor preference → Visual Studio Code** on
   [github.com/settings/codespaces](https://github.com/settings/codespaces) opens new ones there. Without VS Code,
   keep the browser editor and run
   `gh codespace ports forward 3000:3000 4100:4100 4200:4200` on your own computer (GitHub CLI; it asks which
   codespace and listens on `127.0.0.1` too) while you try the app.
5. When `setup.sh` has printed `Ready`, run `bash .devcontainer/start.sh` in a VS Code terminal. Ctrl+C stops it.

| Address on your computer | What it is |
|---|---|
| `http://localhost:3000/` | HVL Interaktiv. «Logg inn med Feide» logs in the mock teacher `author` (`author@hvl.no`) |
| `http://127.0.0.1:4100/` | The mock Canvas: a course page that launches an activity as teacher or student, and the Deep Linking placements |
| `http://localhost:4200/__mock/next-login?user=student` | Chooses who the next Feide login is: `author`, `student`, `ppu-student`, `uib-employee`, `no-feide-id` |

Ports 3000, 4100 and 4200 must be free on your computer (`requireLocalPort`): the tool and the mocks address each
other by these ports.

## Check that it works

- **Setup:** `setup.sh` ends with `Ready. Start the app with: bash .devcontainer/start.sh`. When a step fails, it
  ends with `setup.sh stopped at «<step>» (exit code <n>)` instead: fix the cause shown above that line, then run
  `bash .devcontainer/setup.sh` in a terminal. Running it again is safe, and an existing `apps/server/.env` is kept.
- **Services:** `bash .devcontainer/services.sh` ends with `S3 bucket hvli-content: exists` (or `created`) and the
  same line for `hvli-temporary`, and `docker compose ps` lists `postgres`, `redis` and `s3` as running.
- **App:** `start.sh` prints the addresses above once both mocks answer, then the server's log
  (`HVL Interaktiv server listening`). In a second terminal, `curl http://localhost:3000/healthz` answers
  `{"status":"ok"}`. When a mock cannot start, `start.sh` stops before the server, with
  `The mock Canvas or the mock Feide did not start …`.
- **In your browser:** after «Logg inn med Feide» on `http://localhost:3000/`, the page shows «Aktivitetane dine»
  and «Logg ut». On `http://127.0.0.1:4100/`, a launch opens the tool inside the mock Canvas course page.

## What you can try, and what is not built yet

Built (Sessions 1–5): activities with the ten content types, «Sjekk og publiser», the læringsdesign studio (guide,
patterns, planner), sharing and the content bank, the pedagogisk mappe, and the Canvas side through the mock Canvas
(launches, Deep Linking, resume). Not yet (Session 6): teacher insight, grades to Canvas, and the Docker images for a
real server. See [PROGRESS.md](../PROGRESS.md).

The PDF download of the pedagogisk mappe needs Chromium's sandbox, which `services.sh` allows where the codespace's
kernel lets it. If it says «PDF-fila kan ikkje lagast akkurat no», the Markdown download still works.

## After a stop

A stopped codespace keeps its files. On the next start, `services.sh` starts the services again and creates the S3
buckets again; start the app again with `bash .devcontainer/start.sh`. The database keeps your activities and users,
but the S3 emulator keeps files in memory only: images and other files uploaded before the stop are gone, and the
activities show them as missing.

Codespaces stops a codespace after 30 minutes without activity by default (typing, the mouse, or input or output in a
terminal), and any codespace after 12 hours. Compute is counted in core hours: an hour on the 4-core machine uses 4
of the 120 core hours a month that GitHub Free includes (180 with Pro), so about 30 hours of use (45 with Pro). With
a custom image like this one, the whole container counts as storage (15 GB-month included with Free, 20 with Pro).
Delete the codespace when you are done; a stopped one is otherwise deleted after 30 days without use.

## Files

| File | Role |
|---|---|
| `devcontainer.json` | The container: image, Docker, machine size, forwarded ports, the two scripts below |
| `setup.sh` | Runs once at creation: the steps of `apps/server/README.md` "How to run", in CI's order |
| `services.sh` | Starts PostgreSQL, Redis and the S3 emulator and creates its buckets (also on every later start) |
| `createS3Buckets.mjs` | Creates the server's two buckets in the S3 emulator, which the server never does itself |
| `start.sh` | Starts the mocks and the server in one terminal |

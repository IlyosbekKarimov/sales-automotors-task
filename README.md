# Field Task Manager

**Candidate code: `SA-RN-2026-ILYOS`**
Author: Ilyosbek Karimov · 1st Mobile Task — React Native Intern

An offline-first React Native app for field technicians: create, plan, track and review daily
work tasks with locations, attachments, status changes, local reminders and a full action history.
Every feature works with no network at all; the mock REST server is reconciled opportunistically.

---

## 1. Main features

| Area               | What it does                                                                                                                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tasks**          | Create, edit, view and delete tasks with title, description, due date/time, location, attachments and status (New / In Progress / Completed / Cancelled).                                 |
| **Validation**     | Inline, field-level, user-facing messages. Errors appear on blur (and on every field after a failed submit), never mid-keystroke. Invalid tasks cannot be saved.                          |
| **List & sorting** | Sort by due date, date added or status; free-text search across title, description and address; multi-select status filters; due-date range filter (presets + custom range); live counts. |
| **Status**         | Change status from the detail screen. Every change is written to the history log with a timestamp. Closed tasks stay visible until deleted.                                               |
| **Attachments**    | Camera, photo library and documents (PDF / images / text). Multi-select, full-screen image preview, graceful handling of missing files.                                                   |
| **Reminders**      | Local notification 30 minutes before the due time, with a defined fallback when the task is due sooner, and a **demo mode** that fires in ~35 s.                                          |
| **Map**            | OpenStreetMap tiles with a pin per located task, colour-coded by status. Tap a pin → callout → open the task. No API key required.                                                        |
| **History**        | Append-only audit trail grouped by day, filterable by category, persisted locally, tappable through to the task.                                                                          |
| **Offline & sync** | Everything is written to the device first. Pending changes and offline deletions are queued and replayed against json-server when connectivity returns.                                   |
| **Theming**        | Light / dark / follow-system, toggled from every screen header or from Settings. Persisted.                                                                                               |
| **Accessibility**  | 48 dp minimum tap targets, roles and labels on every control, colour never used as the only signal, capped font scaling.                                                                  |

---

## 2. Running the app

Requires **Node 20+** and **pnpm** (the package manager is pinned in `package.json`).

```bash
pnpm install

cp .env.example .env      # optional — see "Mock server" below

pnpm start                # Expo dev server
pnpm android              # or: build/launch on a connected device or emulator
```

> **Reminders need a development build or the release APK.** Android removed notification support
> from Expo Go in SDK 53, and `expo-notifications` throws rather than degrading when it is loaded
> there. The app detects Expo Go and disables the reminder layer instead of crashing, so every
> other feature — tasks, attachments, map, history, offline sync, theming — still works for
> day-to-day development. Reminders behave normally in a development build and in the APK.

```bash
eas build -p android --profile development   # one-off dev build, reminders included
```

### Quality gates

```bash
pnpm verify        # typecheck + lint + tests
pnpm typecheck     # tsc --noEmit (strict, noUncheckedIndexedAccess)
pnpm lint          # ESLint 10 flat config
pnpm test          # Jest — 90 unit tests
pnpm format        # Prettier
```

---

## 3. Mock server (json-server)

The repository ships seed data in [`db.json`](db.json) — four tasks, three of them with
coordinates, so the map has something to show immediately.

```bash
pnpm mock-server     # json-server --watch db.json --port 3000 --host 0.0.0.0
```

Endpoints used by the sync service:

| Method   | Path                   | Purpose                                              |
| -------- | ---------------------- | ---------------------------------------------------- |
| `GET`    | `/tasks`               | Pull the server's task list                          |
| `GET`    | `/tasks?clientId=<id>` | Find a task's server record when the mapping is lost |
| `PUT`    | `/tasks/:remoteId`     | Push an updated task                                 |
| `POST`   | `/tasks`               | Push a task the server has not seen                  |
| `DELETE` | `/tasks/:remoteId`     | Replay a deletion queued while offline               |
| `POST`   | `/history`             | Mirror history entries (best effort)                 |

### Pointing the app at the server

Set the address at runtime in **Settings → Mock server URL**. It can also come from
`EXPO_PUBLIC_MOCK_API_URL` at build time, or fall back to the platform default in
`src/constants/config.ts` — but the runtime override is the one that matters: the APK is built
once, while your json-server will be on a different address than the one baked in.

**Settings → Test connection** checks the address without changing any data and names the exact
failure: no route to the host, nothing listening, or a server that is not json-server.

| Where the app runs | Base URL                    |
| ------------------ | --------------------------- |
| Android emulator   | `http://10.0.2.2:3000`      |
| iOS simulator      | `http://localhost:3000`     |
| Physical device    | see the three options below |

#### Reaching the server from a real phone

**A. Public HTTPS tunnel — recommended, and what the demo video uses.** Works from any network,
needs no shared Wi-Fi, and gives an HTTPS URL so Android's cleartext policy is irrelevant:

```bash
pnpm mock-server                                        # terminal 1
npx cloudflared tunnel --url http://localhost:3000      # terminal 2
```

Paste the printed `https://<random>.trycloudflare.com` URL into **Settings → Mock server URL**.
The URL changes on every run, which is precisely why the setting is editable in-app.

**B. USB cable.** Reliable regardless of Wi-Fi, needs USB debugging enabled:

```bash
adb reverse tcp:3000 tcp:3000     # then use http://localhost:3000 in the app
```

**C. Same Wi-Fi.** Use `http://<your-computer-ip>:3000` (`hostname -I`). Note this fails when the
phone is itself acting as the hotspot, because Android routes app traffic over mobile data rather
than the hotspot subnet — use A or B in that case.

---

## 4. The APK

**Download:** _paste the EAS build URL or Google Drive link here before submitting_

The project is configured for **EAS Build**, with a `preview` profile that produces a directly
installable APK (not an AAB):

```bash
npm install -g eas-cli
eas login
eas build:configure          # writes the projectId into app.json on first run
eas build -p android --profile preview
```

The build finishes with a download link for the `.apk`. Local Gradle builds also work if you have
the Android SDK installed:

```bash
npx expo prebuild -p android
cd android && ./gradlew assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk
```

---

## 5. Architecture

```
src/
├── bootstrap/     App root and the provider stack (deliberately not named `app/`:
│                  the Expo CLI treats a `src/app` folder as an Expo Router root)
├── components/
│   ├── ui/        Design-system primitives (Button, TextField, Card, Toast, OptionSheet, …)
│   ├── task/      Task-specific composites (TaskCard, filter bar, attachment gallery, form fields)
│   ├── map/       WebView map component and its HTML document
│   ├── history/   Timeline entry
│   └── common/    Screen header, sync status bar
├── constants/     Design tokens, app config, validation rules, storage keys
├── context/       Settings, Theme, Toast and Task providers
├── hooks/         Network status, reminder deep-linking
├── navigation/    Navigators, typed route params, navigation ref
├── screens/       One file per screen
├── services/      Storage, history, attachments, notifications, API client, sync
├── types/         The domain model — single source of truth
└── utils/         Pure helpers: dates, formatting, validation, list shaping, sync merge,
                   dev-only logger
```

The rule that shapes everything: **UI renders, services do work, one context writes.**
No screen touches AsyncStorage, `fetch` or the notification scheduler directly.

### State management — React Context + `useReducer`

Four small providers instead of one large store, so unrelated updates do not cascade:

- `SettingsProvider` — preferences, hydrated once and written back on change.
- `ThemeProvider` — resolves `light` / `dark` / `system` into the active token set.
- `ToastProvider` — one app-wide feedback channel (no blocking `Alert.alert` anywhere).
- `TaskProvider` — tasks, history, deletion queue, id map and sync state, behind a reducer.

Redux/Zustand would have been reasonable, but the app has exactly one write-heavy domain slice and
no cross-cutting selector needs; a reducer behind a context covers it without a dependency. List
view state (search text, sort key, status filters) is deliberately kept **local to the screen** —
it is view state, not domain state, so typing in the search box never re-runs the reducer.

Every mutation follows the same order: **build the next state → persist it → commit it.** Because
persistence happens before the commit, the UI can never display a task that failed to save; the
operation returns `{ ok: false, message }` and the screen shows the reason.

### Storage — AsyncStorage behind an abstraction

`services/storage.service.ts` is the only module that imports AsyncStorage. Two things make it
more than a wrapper:

- **Reads never throw.** A corrupt or half-written JSON blob returns the fallback instead of
  crashing on launch.
- **Reads are normalised.** Records written by an older build are coerced into the current shape,
  so adding a field to `Task` does not strand data already on the device. Anything with an
  untrustworthy sync state is conservatively marked `Pending Sync`.

Writes _do_ surface failures, because a silent save failure is a data-loss bug the user must see.

### Sync — offline-first, last-write-wins with a local-changes guard

A run is a strict sequence (`services/sync.service.ts`):

1. **Replay deletions** queued while offline (`DELETE`). A 404 counts as success — the intent is
   already satisfied.
2. **Push** every task marked `Pending Sync` / `Sync Failed` (`PUT`, falling back to `POST` when
   the record does not exist yet).
3. **Pull** the server list and merge it.
4. **Mirror history** entries, best effort — a failure here never fails the task sync.

#### Task identity: why there is an id map

Tasks are created on the device, offline, so the device mints the id. But json-server **overwrites
any client-supplied `id` on `POST`** with one of its own — `{ ...data, id: randomId() }`, in
`json-server/lib/service.js`. Pushing a task therefore does not make the server agree with us about
its id, and a naive "PUT, fall back to POST" loop would re-create the same task on **every single
sync**.

Two ways out: rewrite the local id to whatever the server returned, or keep a mapping. Rewriting
would invalidate history entries, notification payloads and any screen currently open on that task,
so the app keeps a persisted `IdMap` (`localId → remoteId`) instead. Local ids are stable for
their whole life and the mapping stays an implementation detail of the sync layer.

The local id also travels in the payload as `clientId`. If the mapping is ever lost (app data
cleared, reinstall), the push path looks the task up by `clientId` before creating it — which is
what stops a reinstall from duplicating every task on the server. Records written by hand into
`db.json` have no `clientId`, so their server id becomes their local id, which is correct: the
device has never seen them before.

#### Conflict rules

These live in `utils/sync.utils.ts` as pure functions, so they are unit tested without a server:

> The base rule is **last-write-wins on `updatedAt`**. On top of that, a local task carrying
> unpushed changes always beats the server copy, whatever the timestamps say. Plain LWW can
> silently discard work typed offline if the device clock lags the server's, and losing field notes
> is far worse than briefly keeping a stale server value — the next successful push reconciles it.

Tasks queued for deletion are never resurrected by a pull. `syncStatus` and `notificationId` are
device-local and stripped from every payload.

Sync is triggered three ways: automatically on the **offline → online transition** (only when
something is pending, so a flaky connection cannot hammer the server), by pull-to-refresh, and by
tapping the sync status bar or **Settings → Sync now**. Status is always visible: `Pending Sync` /
`Synced` / `Sync Failed` per task, plus an app-level bar and a tab-bar badge.

### Notifications — `expo-notifications`, local only

`scheduleTaskReminder` resolves in a defined order and returns a tagged result carrying a
user-facing message, so screens display `result.message` rather than deciding policy themselves:

| Condition                          | Behaviour                                              |
| ---------------------------------- | ------------------------------------------------------ |
| Reminders switched off in Settings | Skipped, with an explanation                           |
| OS permission refused              | Skipped, message depends on whether it can be re-asked |
| **Demo mode on**                   | Fires in **~35 s** — for the review video              |
| Due in more than 30 min            | Fires exactly **30 min** before                        |
| **Due in under 30 min**            | Fires in **~10 s**, clearly labelled as such           |
| Due date already passed            | Skipped — nothing to remind about                      |

The under-30-minutes case is the fallback the brief asks about: rather than silently dropping the
reminder or refusing to save, the task saves and the reminder arrives immediately with a message
saying why. Closing a task (Completed / Cancelled) cancels its reminder. Tapping a reminder opens
the task — including from a cold start, which is handled via
`getLastNotificationResponseAsync`, not just the live listener.

Only **local** notifications are used — no push tokens, no remote delivery, no server involvement.
Even so, `expo-notifications` refuses to load in Expo Go on Android from SDK 53 onward and throws
on import-adjacent calls, so `areRemindersSupported()` gates every entry point in the service. In
Expo Go the reminder rows in Settings are disabled with an explanation; in a development build or
the release APK the full flow runs.

### Map and location — OpenStreetMap in a WebView, no API key

`react-native-maps` and `expo-maps` both require a **Google Maps API key on Android and a custom
development build**; neither runs in Expo Go, and a reviewer without the key sees a blank grey
square. So the map is a self-contained document rendered in `react-native-webview`
(`components/map/map-html.ts`): Web Mercator projection, an OSM raster tile grid, drag to pan,
pinch and buttons to zoom, status-coloured pins, and a callout that opens the task — roughly 200
lines with **zero third-party JavaScript** and nothing loaded from a CDN.

The bridge is deliberately tiny — RN pushes markers in, the document posts back "this pin was
tapped" — so no DOM state leaks into React and panning is never interrupted by a re-render. In
dark mode a CSS filter turns the light OSM raster into a usable dark basemap.

Real geocoding is out of scope (it would need a keyed service). Instead, coordinates are optional
and can be entered manually, or filled together with the address in one tap from the **saved
sites** preset list — which is how a technician actually enters a recurring depot or client site.

### Logging

Nothing writes to the console in a release build. `utils/logger.ts` is the only module
allowed to call `console`, and every call sits behind `__DEV__`. ESLint enforces this with
`no-console: error` plus a single scoped exception for the logger itself.

Worth being precise: Metro defines `__DEV__` as a runtime global in the release prelude
(`__DEV__=false`) rather than inlining it per call site, so the minifier cannot delete the
branch. The guard is a runtime check — nothing is ever printed in a release build, but the
message string is still built on the paths that log. All of those are already error paths,
so the cost is nil. Verified by grepping a minified release bundle.

### Attachments

Both pickers hand back URIs in the **cache** directory, which Android may purge at any time — an
attachment stored that way silently disappears days later. Every picked file is therefore copied
into `<documents>/attachments/` before its metadata record is created, so it survives a restart.
Files picked but abandoned (form cancelled) are cleaned up; files removed from a saved task are
deleted only after the save succeeds.

Missing files are handled explicitly: the gallery checks the file up front and renders a labelled
"unavailable" tile that can still be removed, rather than a broken image box.

---

## 6. Tests

90 unit tests over the pure logic layers — `pnpm test`.

| Suite                   | Covers                                                                            |
| ----------------------- | --------------------------------------------------------------------------------- |
| `validation.utils.test` | Field rules, coordinate pairing and ranges, whole-form validation                 |
| `task.utils.test`       | Search, status filters, all three sort keys and directions, overdue logic, counts |
| `sync.utils.test`       | Payload shaping, id mapping and clientId fallback, every merge/conflict branch    |
| `date.utils.test`       | Relative and day-bucket formatting, overdue checks, date/time merging             |

Jest runs in a plain Node environment with `babel-preset-expo`, which is why
`constants/validation-rules.ts` is kept free of any React Native import. Component tests were left
out deliberately — the brief marks tests as optional, and the logic worth protecting is the logic
that is easy to get wrong.

---

## 7. Known limitations and trade-offs

- **Map tiles need a connection.** Pins, panning and zoom still work offline (the grid is
  computed locally), but tiles come from OpenStreetMap live — there is no offline tile cache. OSM's
  public tile server is fine at demo volume but is not a production choice.
- **Attachments do not cross devices.** They sync as metadata with `file://` URIs; the bytes stay
  on the device that captured them. Real file sync needs an upload endpoint, which json-server is
  not.
- **Conflict resolution is last-write-wins** (with the local-changes guard described above). No
  field-level merge, no three-way diff, no tombstone reconciliation.
- **No geocoding.** Address → coordinates would need a keyed service; the preset site list and
  manual entry cover it instead.
- **History is capped at 500 entries** and trimmed oldest-first, so the log cannot grow unbounded
  on a long-lived device.
- **`eslint-plugin-react-native` was removed.** Version 5 calls ESLint APIs deleted in ESLint 10
  and crashes the linter; its rules are stylistic and Prettier covers the overlap.
- **No authentication, no production backend, no real-time collaboration** — all explicitly out of
  scope per the brief.

---

## 8. AI / tooling disclosure

This project was built with the help of an AI coding assistant (Claude, by Anthropic), used as a
pair-programming tool for scaffolding components, drafting the service layer and writing the test
suite. Every architectural decision documented above — the offline-first write ordering, the
local-changes guard on top of last-write-wins, the choice to hand-write the map instead of taking
a keyed native dependency, the reminder fallback policy — was made and reviewed deliberately, and
I can walk through any module in the repository on request.

Also used: the official Expo SDK 57 documentation (verified against the installed packages'
TypeScript definitions rather than from memory — which is how the AsyncStorage v3 `removeMany`
rename and the ESLint 10 plugin incompatibilities were caught), ESLint, Prettier and TypeScript in
strict mode.

---

**Candidate code: `SA-RN-2026-ILYOS`** — also shown in the app under **Settings → About**.

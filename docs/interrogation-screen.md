# Interrogation screen implementation and verification

The existing police station now offers **Interrogation Room** alongside **Investigation Board**. Suspects, names, roles, initial statements, question budgets and completed interviews come from the player's `game:snapshot`. No case JSON or private AI instructions are imported into the browser.

## Files

- `frontend/src/components/InterrogationScreen.tsx`: suspect selection, shared dialogue, optional pinned clue presentation, accessible question form, waiting/error states and station return navigation.
- `frontend/src/components/SuspectPortrait.tsx`: archetype-based emotional portraits, runtime green-screen removal and missing-image fallback. Source artwork is unchanged.
- `frontend/src/components/RoomView.tsx`: existing police station navigation integration.
- `frontend/src/stores/gameStore.ts`: shared per-suspect request status, authoritative answer updates, replay protection, disconnect handling and snapshot restoration.
- `frontend/src/lib/socket.ts`: typed `interrogation:ask` emitter using the existing authenticated socket. Its 45-second acknowledgement timeout allows the backend's 30-second AI timeout to complete.
- `frontend/src/index.css`: responsive scene and interview record styling using existing buttons, typography and brass color.
- `frontend/src/components/InterrogationScreen.test.tsx`: contract payloads, private versus shared evidence, optional evidence, duplicate submissions/events, teammate history, emotion/count updates, switching, snapshot restoration, unavailable handling and exhaustion.
- `frontend/src/components/SuspectPortrait.test.tsx`: missing asset fallback.

The pre-existing change to `frontend/package-lock.json` was left untouched. No backend, AI, deployment, environment or image files were changed. No commit or push was made.

## Backend integration

- Emit `interrogation:ask` with `{ suspect, question, evidence }`; evidence is the pinned clue reference or `null`.
- Receive `interrogation:thinking` (`{ suspect }`), `interrogation:answer` (`{ entry, questions_left }`) and `interrogation:unavailable` (`{ suspect, message }`). These are lobby broadcasts, including activity outside the station.
- Restore completed history and budgets from `game:snapshot`; use `board:state` for current pinned clue eligibility. The existing authenticated connection and reconnect snapshot flow are reused.
- History is stored in the synchronized game store, deduplicated by server entry ID. No permanent optimistic counter decrement occurs.
- Backend validation remains authoritative. The form mirrors the actual 300-character question limit and prevents blank questions.
- The backend's refusal text is currently “The suspect refuses to speak for now. Your question was not used.” The UI intentionally maps the unavailable event to the requested exact text: **The suspect refuses to talk right now.** The subsequent error acknowledgement cannot replace that message.
- The backend also permits pinned quote references as evidence. This screen's evidence picker offers pinned clues, as requested; existing quote pinning remains available on the board.

## Assets

The background is `themes/conac/interrogation_room.webp` (or the current theme's station image from its map). Portraits are separate canvas image layers sourced from:

- `themes/conac/portraits/dr_ilie_strat/dr_strat_{emotion}.webp` — doctor
- `themes/conac/portraits/ana_muresan/ana_muresan_{emotion}.webp` — housekeeper
- `themes/conac/portraits/victor_vornicu/victor_vornicu_{emotion}.webp` — heir
- `themes/conac/portraits/elena_vornicu/elena_vornicu_{emotion}.webp` — lady

All six contract emotions are supported. Calm is used before the first answer and as an asset fallback. Unknown themes/archetypes display a text fallback. Asset mapping is by public archetype, not case-specific suspect IDs. The green backing is removed at render time without generating or modifying artwork.

## Acceptance status and limitations

**Not every criterion is fully satisfied.** Functional frontend requirements are implemented, with these precise limits:

1. The repository's sole interrogation room image uses an elevated view. It is reused independently of the front-facing portrait, but the requested fully front-facing room composition needs replacement artwork. No new artwork was generated.
2. The snapshot contains completed interviews but no in-flight status or request identifier. Reconnecting restores history and budgets but cannot reliably restore another player's already-running thinking state. The backend still rejects concurrent questions to that suspect. A lost acknowledgement has no request-status API to reconcile immediately; the screen directs the player to reconnect and inspect history.
3. Live four-player interrogation, actual AI answers, visual compositing, and mobile layout still require the manual checks below. Automated tests exercise real store listeners with server-shaped events, rather than four live browser clients. Local browser smoke verification covered creation and departure of a live lobby only.

## Four-player local verification

1. Keep Docker Compose services and the Vite frontend running, with the existing live-server configuration (`VITE_USE_MOCK=false`). Do not change any secrets.
2. Open `http://localhost:5173` in four isolated browser profiles/containers (separate storage). In profile 1 enter a detective name and click **Create lobby**. Copy its lobby code.
3. In profiles 2–4 enter different names, enter that code and click **Join game**. In profile 1 select **Death at Vornicu Manor**, then **Start investigation** once all four detectives are connected.
4. In each profile navigate to **Police station**, then **Interrogation Room**. Select each suspect. Compare names, roles, initial calm portraits and server question budgets.
5. In profile 1 ask a nonempty question without evidence. While it is running, confirm **The suspect is thinking...** and disabled submission in other profiles viewing that suspect. Switch to another suspect during the wait. Once answered, compare the question, named detective, answer, updated emotion/portrait and budget across all four clients.
6. Explore an assigned unlocked room in profile 2 and inspect an object to collect a clue. Confirm it is absent from the other players' evidence pickers until profile 2 pins it using **Police station → Investigation Board**. Return to interrogation; verify its title/description and ask a question with it. Confirm private/unpinned clues are excluded.
7. Alternate questions from all four profiles. Verify shared order and counters. Switch suspects, return to the station, reopen interrogation and reload a profile; completed history must remain available.
8. In a disposable game exhaust a suspect's server budget; confirm all clients disable submission and show the no-questions explanation. Empty and whitespace-only input must also remain disabled. Double-click submission while waiting; only one question should be sent.
9. To exercise a real unavailable event, temporarily stop only the local AI service using the existing Compose service controls, then ask a question. Confirm the exact message **The suspect refuses to talk right now.**, no invented answer and unchanged budget across clients. Restart that service afterward.
10. Disconnect/reconnect a browser during a question and verify completed history on its reconnect snapshot. An already-running thinking state may be unknown, as documented above.
11. Use a narrow viewport (approximately 390px), then desktop width. Check keyboard labels/focus, wrapping, form usability and history scrolling. Inspect all emotion variants when real backend answers produce them. Block a portrait URL locally to check fallback; source assets should remain unchanged.
12. Confirm board operations, manor exploration and the existing final accusation flow still work.

## Executed checks

From `frontend/`:

- `npm run build` — passed, including `tsc -b` and the Vite production build. Vite reports a JavaScript chunk above 500 kB; this is a warning, not a build failure.
- `npm run lint` — passed.
- `npm test` — passed: 13 test files, 64 tests.
- `npm test -- src/components/InterrogationScreen.test.tsx` — passed: 4 focused integration tests.
- `git diff --check` from the repository root — passed.

Early builds caught missing fields in test fixtures; these were fixed before the final successful build. A build command was also accidentally attempted at the repository root, which has no package manifest; verification was rerun successfully from `frontend/`.

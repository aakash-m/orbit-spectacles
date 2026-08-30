# Orbit — prompt log

This folder is the prompt log for Orbit: the prompts actually used to build it,
in the order they were sent, including the mid-build approvals and corrections.
It is the CLAD-execution artifact — read it top to bottom.

Each phase file was handed to Claude Code with an `@`-reference
(`@orbit-prompts/01-ring.md`). The shorter approval and correction prompts were
typed inline; the ones that changed the design or approach are captured here as
their own files and, where they changed a phase mid-flight, appended to that
phase's file under a `## Correction` heading.

## Sequence

| file | what it is |
|---|---|
| `00-setup.md` | Phase 0 — environment + SPECS 27 project validation |
| `01-ring.md` | **Phase 1** — data layer + the body-anchored ring |
| `Approved.md` | Phase-1 plan approved; raised the additive-display contrast question |
| `Approved_Phase-2.md` | Phase-2 go-ahead — real-time clock vs demo timing, snooze-return constant, DOWN as a stub |
| `02-flick-triage.md` | **Phase 2** — pinch-and-flick triage, commit thresholds, mandatory undo |
| `Before_phase_3.md` | Hands-on review setup — dissolve timing constant, force-empty debug key, WAV audition |
| `Approved_Before_phase_4.md` | Phase-3 decisions — local storage, Gemini model, palm-menu guard, mid-session token expiry, the ASR question |
| `03-ai-and-reply.md` | **Phase 3** — AI summaries + voice reply |
| `Before_phase_4a.md` | Summaries approved; deterministic tie-break for the 0.90 tie; label simulated transcripts; classify `INTERNAL_ERROR` vs assertion failure |
| `04a-leaf-tests.md` | **Phase 4a** — LEAF integration suite (10 scenarios) |
| `Before_phase_4b.md` | Bake the AI summaries to a static file; note the LEAF-caught defect in the README |
| `BugFix_before_phase_4b.md` | Fix 5 `/code-review` findings in `OrbitAiService` without disturbing the frozen layout |
| `04b-performance.md` | **Phase 4b** — differential frame-time attribution + optimize |
| `After_phase_4b.md` | "Option 1" — three low-risk wins only; verify the frozen layout; write `FINDINGS.md` |
| `05-optional-hand-menu.md` | Optional phase — not executed (scoped out) |
| `06-optional-pin-to-wall.md` | Optional phase — not executed (see the README's "What's next") |
| `Health_check_after_restart.md` | Post-restart verification before filming; the flick misfire found here traced to preview-camera drift |
| `Diagnose_fix.md` | Pushback on that diagnosis — preview-fps measurement, no flick-tuning changes |
| `Clean_up_before_ship.md` | Pre-publish secrets audit, Perfetto tooling note, delete unused assets |
| `07-token-scrub.md` | Scrub RSG tokens from `Scene.scene` to placeholders + whole-tree audit |
| `08-ship-pass.md` | Lock the build — disable debug keys, confirm flags, re-run LEAF 10/10 |
| `09-repo-setup.md` | `git init`, `.gitignore`, review the file list, first commit + push |
| `10-readme.md` | Write the repo `README.md` |
| `11-prompt-log.md` | This step — commit the log, append the corrections, write this file |

## Corrections

Appended to the relevant phase file under a `## Correction` heading:

- `01-ring.md` — additive-display contrast (dark scrim gives no contrast on an additive display)
- `03-ai-and-reply.md` — deterministic tie-break (seven messages tied at urgency 0.90)
- `04a-leaf-tests.md` — Correction 1: a real defect caught by LEAF (`OrbitUndoChipUI` disabled its SceneObject inside `onTriggerStart`, stranding the awaited `onTriggerEnd` — would have hung on device). Correction 2: `INTERNAL_ERROR` vs real assertion failure
- `04b-performance.md` — option 1 over the full optimize pass (Preview's ~19 fps was VIO/face-detect simulation, not Lens work)
- `Health_check_after_restart.md` — the flick misfire was preview-camera drift, not frame rate

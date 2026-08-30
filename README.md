# Orbit

A spatial message-triage experience for Spectacles. Messages from email, chat,
calendar, and social arrive as cards on a ring around you at arm's length,
sorted by urgency. You clear them with directional hand flicks — snooze,
archive, pin, reply — and draft replies by voice.

Orbit takes the "Connect" theme from the side of the person being reached.
Staying available across many apps means the things people need from you — a
reply, a yes to an invite, a decision — end up scattered and buried. Orbit
collects them into one ranked surface: the most urgent card is in the centre, a
glance shows the state of everything, and each card is cleared with one flick or
answered with one spoken sentence that Gemini drafts in the sender's own
register. It is for people whose incoming messages are split across four or five
channels and who want to keep up with the people contacting them without working
down a notification list.

## Demo

<!-- video link goes here -->
_Demo video: https://drive.google.com/drive/folders/1mtCnvNNmg_eE1Q_LI669Mg2o42gdcJKL?usp=sharing_

## How to run

1. Lens Studio 5.23.2 (5.22 or newer).
2. Open `Orbit.esproj`.
3. Press **Preview**. **No network is required.** The ring loads from a baked
   summary file (`Assets/orbit-summaries-baked.json`), so it runs identically
   with no Remote Service Gateway tokens.
4. The live AI paths (fresh summaries, voice-reply drafting) need RSG tokens
   pasted into the `RemoteServiceGatewayCredentials` fields in
   `Assets/Scene.scene` — generate them via **Window → Remote Service Gateway
   Token**. The committed scene ships with `[INSERT … TOKEN HERE]` placeholders.

## What's real and what's mocked

- **Dataset** — 24 fixed mock messages (`Assets/orbit-messages.json`). Not a
  live feed.
- **Summaries and urgency** — real Gemini 2.5 Flash output, generated once and
  frozen into the baked file so the ring layout is stable. The live path
  (`OrbitAiService`) still runs when tokens are present.
- **Voice reply** — real Gemini drafting. Dictation is **simulated in Preview**
  (Lens Studio has no mic passthrough) behind a visibly labelled canned
  transcript; real ASR (`AsrModule`) is wired for device.
- **Outbox** — a local prototype. "Sending" appends to a list in persistent
  storage. **Nothing is transmitted anywhere.**
- Built and verified in Lens Studio Preview. **Not tested on hardware.**

## Architecture

- **`MessageStore`** — loads the dataset and owns triage state (active /
  snoozed / archived / pinned). Exposes the urgency-sorted visible set (capped
  at 12) and the overflow count. Every other layer goes through it. Summary
  origin is decoupled: a card reads `displaySummary()`, which the AI layer
  fills via `updateState`.
- **Ring layout** (`OrbitRing`, `OrbitCardUI`) — 12 cards on a 120°, 70 cm arc
  in three tiers. Body-anchored with lazy-follow re-centring (turn more than 45°
  and hold 0.5 s); per-frame billboard.
- **Interaction layer** (`CardFlickController`, `TriageController`) — SIK
  `Interactable` plus a translate-only `InteractableManipulation` per card. A
  flick commits only on travel ≥ 12 cm **and** release speed ≥ 70 cm/s;
  `TriageController` routes left / right / up / down to snooze / archive / pin /
  reply and owns the 4-second undo.
- **AI service adapter** (`OrbitAiService`, `OrbitReplyService`,
  `ReplyDictation`) — Gemini 2.5 Flash through the Remote Service Gateway.
  Summaries resolve baked → local cache → live, in that order, with a hard
  placeholder fallback on timeout so the ring never blocks. Reply drafting
  mirrors the formality of the original message.

## Built with CLAD

Built in four phases with Claude / CLAD. The prompts are the log, in
[`orbit-prompts/`](orbit-prompts/) — including the corrective prompts appended
under each phase's `## Correction` heading.

1. Data layer and the ring
2. Flick triage
3. AI summaries and voice reply
4. LEAF integration tests (10 scenarios) and a performance pass

Two things worth calling out:

- **LEAF caught a real defect.** `OrbitUndoChipUI.trigger()` disabled its own
  SceneObject synchronously inside the `onTriggerStart` callback, which pulled
  the collider out from under SIK mid-interaction — the awaited `onTriggerEnd`
  then never fired and the interaction hung. The same hazard exists on device.
  Fix: defer the disable by 0.15 s so the in-flight trigger completes first.
- **The performance pass changed the plan.** Lens Studio Preview renders the
  scene at about 19 fps, but frame-time attribution showed that is `Track`
  (VIO / SLAM tracking simulation, ~20 ms/frame, flat regardless of Lens
  content) plus `FaceDetectPreprocess` — both Preview-only. Orbit's own cost is
  about 4.5 ms/frame against a 16.6 ms budget. `/specs-lens-perf-optimize` and
  `/specs-optimize-lens-mesh` were **deliberately not run**: nothing sat above
  the noise floor, and a mesh-merge pass would have risked the frozen layout.
  Details in
  [`performance_traces/analysis/FINDINGS.md`](performance_traces/analysis/FINDINGS.md).

## What's next

- Live platform integration — real email / chat / calendar feeds behind the
  existing `MessageStore` interface.
- On-device tuning of the additive-display treatment: fill and border luminance
  need calibrating against real Spectacles optics.
- Pin-to-wall placement via the World Query API.

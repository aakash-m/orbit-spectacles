Restarting after a shutdown. Orbit is fully built: phases 1-3, LEAF 10/10,
phase 4b done. I'm filming the demo today. Verify the project is in the state
I left it:

1. Ring layout — must be the frozen filming layout: 12 visible, Recruiting
(m08, urgency 1.00) dead centre, same tier order. Preview's persistent storage
doesn't survive a restart, so confirm the BAKED summaries file is loading and
nothing re-summarized. If any summary is blank or the order shifted, tell me
before I record.

2. RSG tokens — expired overnight. Tell me if the reply-draft Gemini call will
get a real draft or silently fall back to the stub, and regenerate them if
stale. I want live drafts on camera.

3. Confirm debugForceEmptyKey (E) and debugReplyKey (R) are still ON.

4. Cold start with zero Orbit console errors or warnings.

5. Re-run the LEAF suite — 10/10.

Also: Scene.scene still contains the 6 RSG tokens. Do NOT commit anything yet.

## Correction 1 — the flick misfire was preview-camera drift, not frame rate

Prompted by step 5 (re-run LEAF) coming back 6/10 after the restart —
s02/s04/s06/s09 each a directional flick that should commit an archive instead
registering as "down" and opening the reply panel. The first diagnosis blamed
low Preview frame rate; pushed back on in `Diagnose_fix.md` because a screen
recorder would only make that worse. The real cause was the interactive
Preview camera, drifted to ~90° yaw: `CardFlickController` classifies flick
direction by projecting the card's world-space travel onto the camera's
right/up axes captured at grab, so with the camera yawed ~90° a world-X flick
projects onto "down". `MovePreviewCamera` reset -> identity -> LEAF 10/10
restored. A Perfetto trace confirmed Preview was a healthy ~30 fps with ~3x
headroom, so frame rate was never the issue. Flick thresholds were not touched.

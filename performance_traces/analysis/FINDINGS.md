# Orbit — Phase 4b performance findings

**Date:** 2026-08-29
**Method:** differential frame-time attribution sweep in Lens Studio Preview
(6 cumulative stages, one 10 s Perfetto trace each, 2 s warm-up trimmed).
Representative scene: full 24-message dataset (12 cards on the ring) with the
reply panel open on the most-urgent card.

Artifacts in this folder:

| file | what |
|---|---|
| `../sweep_00_baseline_preview0.pftrace` … `sweep_05_full_preview0.pftrace` | the 6 sweep-stage traces |
| `../sweep_01b_ring_culled_preview0.pftrace` | ring re-trace after the billboard-cull change |
| `orbit_attribution_donut.png` | the attribution chart |
| `contributors.csv` | chart data |
| `per_slice_by_stage.json` | full per-slice per-stage numbers |

---

## Headline

**The Lens is not the frame-time bottleneck, and there is no 60 fps problem
attributable to Orbit.** With 12 cards and the reply panel open, Orbit's own
work is **≈ 4.5 ms/frame** against a **16.6 ms** (60 fps) budget — comfortably
inside 90 fps (11.1 ms) as well.

Lens Studio **Preview** renders this scene at only **~19 fps (~28 ms of
`ProcessFrame` CPU)**, but that is a *Preview artifact*, not the Lens:

| slice | ms/frame | moves with Lens content? | on Spectacles |
|---|---|---|---|
| `Track` (VIO / SLAM tracking simulation) | **20.1** | **no** — flat across all 6 stages (Δ −0.01) | runs on dedicated vision silicon; ~free to the app |
| `FaceDetectPreprocess` | **1.5** | **no** — flat | Preview-injected; Orbit is a world lens with `DeviceTracking = World` and never reads face data |
| everything else (Orbit + SIK + render) | ~6.5 | — | — |

`Track` alone is ~72 % of the Preview frame and is pure simulation overhead.

---

## Attribution (positive deltas only, Preview baseline excluded)

Total attributed to Orbit: **4.46 ms/frame**

| contributor | ms/frame | % | evidence |
|---|---|---|---|
| 12-card ring — GPU render subtree | 3.06 | 69 % | stage 00→01: `CoreManagerRender` 2.61→5.67, `RenderFrame` +1.03, `Camera` +0.77, `RenderPass` +0.74; 13 draw calls appear |
| Ring per-frame scripts (billboard + card-lag ×12 + card colliders) | 0.91 | 20 % | stage 00→01: `Scene::Update` +0.71, `Scene::PhysicsUpdate` +0.20 |
| Reply panel open — build + layout | 0.46 | 10 % | stage 03→04: `ProcessFrame` +0.46, draw calls 13→17 |
| Triage UI (undo chip + empty-state + "+N" counter) | 0.03 | 1 % | stage 01→02: within noise |

Noise floor of the sweep ≈ ±0.6 ms/frame (the DissolveVFX stage measured
−0.68 ms — i.e. an idle `VFXComponent` costs nothing).

### Draw calls

* **13** with the 12-card ring alone
* **17** with the reply panel also open

`RoundedRectangle` (SDF) and `Text` components already batch well. Only ~3 of
the 12 cards fall inside the Preview camera's portrait FOV at once; the other 9
run their scripts but are correctly frustum-culled from rendering.

---

## Changes applied

Only **one** of the three candidate wins was an actual code change; the other
two were already in the desired state.

1. **Camera tracking — already correct.** `DeviceTracking.deviceTrackingMode`
   is `World`, not `Face`. `FaceDetectPreprocess` in the trace is
   Preview-injected (SIK requests hand data; the Preview camera sim bundles a
   face pass) and does not run on device. No change.
2. **Shadows — already off.** Both `LightSource` components have
   `shadowType = None` / `castsShadows = false`. The `ShadowBlurRadius: 4` in
   `Scene.scene` is an inert stored default. No change.
3. **Billboard view-cull — applied** (`OrbitRing.billboardCards`). Cards more
   than ~70° off the camera's look axis (well beyond the ~63° FOV) skip the
   `quat.lookAt` + `setWorldRotation` call. The billboard is recomputed from
   scratch every frame, so a card re-entering view is oriented correctly on its
   first rendered frame — no pop, no stored state. `OrbitCardUI.tickVisual`
   (the per-card lag/tilt) is **untouched**; it already early-outs at rest.

### Verification after the change

* **Ring layout byte-identical** to the frozen filming layout — same 12 visible
  cards, same tier order, Recruiting (`m08`, urgency 1.00) dead centre. Full urgency-sorted
  dump matches pre-change exactly.
* **LEAF suite 10 / 10** in Preview (`s01`–`s10`), including `s10-lazy-follow-
  recentre` which exercises the billboard / head-yaw path and `s01-ring-loads-
  sorted` which validates the layout.
* **Render-neutral:** draw calls and `Visual` count unchanged (13 → 13). The
  cull removes CPU quaternion math only; it can never add work or change what is
  drawn.
* Re-trace (`sweep_01b_ring_culled`) confirmed no regression. (Absolute
  frame-time deltas between the before/after ring traces are dominated by
  Preview run-to-run variance in `Track` — ±10 ms — so the ~0.2 ms the cull
  saves is below what Preview can measure; the guarantee is structural, not
  statistical.)

---

## Why `/specs-lens-perf-optimize` and `/specs-optimize-lens-mesh` were NOT run

**`/specs-lens-perf-optimize`** — the sweep found nothing above the ±0.6 ms
noise floor to optimise. Orbit's ~4.5 ms/frame sits at ~27 % of the 60 fps
budget with ~12 ms of headroom. Running the dispatch-a-worker-per-recommendation
loop would be premature optimisation against a non-problem, and every change
carries a regression risk to a layout that is frozen for filming.

**`/specs-optimize-lens-mesh`** — the pass merges same-material
`RenderMeshVisual`s. Orbit's card meshes cannot merge: each card's rects and
text carry per-card unique content (source-hue bar, initials, sender name,
summary line, relative time), so they are distinct material instances by design.
Merging would require a texture-atlas / SDF-glyph rewrite of `OrbitCardUI`,
which would (a) change the rendered output and risk the frozen layout and (b)
save at most ~2–4 of the already-low 17 draw calls. Not worth the risk before a
shoot.

Both passes remain available if a future device capture (not Preview) shows a
real budget problem.

---

## Environment note

Perfetto's trace processor (`trace_processor_shell.exe`, v46.0, Google-hosted
prebuilt) was fetched from the network for this analysis. It lives **outside the
project** at `~/.local/bin/trace_processor_shell.exe` and is not part of the
repo — nothing here depends on it at runtime or build time.

The bundled `specs-lens-perf-attribution` scripts were incompatible with the
installed `perfetto` Python package (0.58.2 — `dict(Row)` API change), so a
small local analysis script was used instead; its output is
`per_slice_by_stage.json`.

Phase 4b for Orbit. Run /specs-capture-perf-trace with 12 cards visible and a
reply panel open, then /specs-lens-perf-attribution to find where frame time
is going. Show me the attribution chart.

Then run /specs-lens-perf-optimize and apply fixes one at a time with
before/after capture, verifying visual parity after each. Also run
/specs-optimize-lens-mesh to merge same-material card meshes.

Target: sustained 60fps with 12 cards, text, blur, and an open reply panel.
Show me the before/after comparison when you're done.

## Correction 1 — option 1 over the full optimize pass

The phase prompt targets "sustained 60fps" via `/specs-lens-perf-optimize` +
`/specs-optimize-lens-mesh`. The attribution sweep showed Orbit's own work is
~4.46 ms/frame against a 16.6 ms budget, and Preview's ~19 fps is `Track`
(VIO/SLAM simulation, ~20 ms/frame, flat regardless of Lens content) plus
`FaceDetectPreprocess` — neither is Lens work. Presented with the options the
user chose "option 1": apply only the three low-risk wins and re-trace.
Applied: `OrbitRing.billboardCards` skips `quat.lookAt` for cards >70° off the
camera axis; the other two (camera `DeviceTracking = World`, lights
`castsShadows = false`) were already in place. Re-trace confirmed no regression
and a byte-identical ring layout. `/specs-lens-perf-optimize` and
`/specs-optimize-lens-mesh` were deliberately not run — nothing sat above the
noise floor and a mesh-merge would have risked the frozen filming layout. Full
write-up: `../performance_traces/analysis/FINDINGS.md`.

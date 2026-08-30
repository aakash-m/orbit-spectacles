Option 1. Apply the three low-risk wins, re-trace to confirm no regression.

After that, confirm the ring layout is byte-identical to the frozen filming
layout — same 12 cards, same tiers, Recruiting still dead centre. The
cull-skip change touches per-card visual ticking so I want that verified, not
assumed.

Then write performance_traces/analysis/FINDINGS.md covering: the 4.46 ms/frame
Lens attribution vs the 16.6 ms budget, that Preview's ~19 fps is
VIO/SLAM + face-detect simulation and not Lens work, the draw call counts
(13 ring / 17 with panel), the three wins applied, and why
/specs-lens-perf-optimize and /specs-optimize-lens-mesh were deliberately not
run. I'm putting this in the README.
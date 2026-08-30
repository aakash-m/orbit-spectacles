Write README.md at the repo root. Structure:

- Orbit — one-sentence description, then the project description paragraph
  from orbit-prompts (what it is, how it answers the "Connect" theme, who
  it's for).
- Demo — placeholder for the video link, I'll fill it in.
- How to run — Lens Studio version, open the project, no network required,
  baked summaries mean it works without RSG tokens. Note that live AI paths
  need tokens in Scene.scene.
- What's real and what's mocked — 24-message mock dataset; local prototype
  outbox, nothing sends; dictation simulated in preview (no mic), real ASR
  wired for device; built and verified in preview, not on hardware.
- Architecture — message store, ring layout, interaction layer, AI service
  adapter. Brief.
- Built with CLAD — four phases, link the orbit-prompts/ folder. Call out
  two things concretely: LEAF caught a real defect (OrbitUndoChipUI disabled
  its SceneObject synchronously inside onTriggerStart, stranding the awaited
  onTriggerEnd — would have hung on device), and the perf pass found the
  apparent 19fps was VIO/face-detect simulation, not Lens work, so
  /specs-lens-perf-optimize and /specs-optimize-lens-mesh were deliberately
  not run. Link performance_traces/analysis/FINDINGS.md.
- What's next — live platform integration, on-device tuning of the additive
  display treatment, pin-to-wall via world query.

Keep it tight. No marketing voice.

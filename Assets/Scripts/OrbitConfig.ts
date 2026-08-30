/**
 * Orbit — tunable constants for phase 2 (flick triage).
 *
 * This is the ONE place to change the feel of triage. Every value is a plain
 * mutable field so a LEAF test can override it before the scene runs
 * (e.g. `OrbitConfig.snoozeReturnSeconds = 0.1`).
 */
export const OrbitConfig = {
  // ── Snooze ────────────────────────────────────────────────────────────────
  /**
   * How long (real seconds) a snoozed card stays out of the ring before it
   * returns to the queue. The undo chip / card still SAY "1 hour" to the user —
   * this is only the demo/test timing, decoupled from the label.
   *   45  → normal running: a snoozed card visibly returns during a demo.
   *   0.1 → LEAF tests set this so snooze-return is instant.
   */
  snoozeReturnSeconds: 45,

  /** The human label shown for a snooze, regardless of the timing above. */
  snoozeLabel: "1 hour",

  // ── Flick thresholds (the important knobs — see 02-flick-triage.md) ────────
  /** Minimum travel from the grab origin, in cm, before a flick can commit. */
  minTravelCm: 12,

  /**
   * Minimum release speed, in cm/s, to commit. Below this a past-threshold drag
   * springs back instead of committing. Tuned against preview tests: a casual
   * reposition measured ~41 cm/s (23 cm travel) and did not commit; a deliberate
   * flick measured ~93 cm/s (13 cm travel) and did. 70 sits clear of casual with
   * headroom, and any real hand flick clears it easily. The 12 cm travel gate is
   * the primary guard against accidental triggers.
   */
  minReleaseSpeedCmPerSec: 70,

  /** Dominant-axis must exceed the cross-axes by this factor (cone of acceptance). */
  directionStrictness: 1.3,

  // ── Timings (seconds) ────────────────────────────────────────────────────
  affordanceFadeIn: 0.15,
  springBackDuration: 0.3,
  settleDuration: 0.15,
  commitAnimDuration: 0.32,
  reflowDuration: 0.4,
  reflowStagger: 0.03,
  undoSeconds: 4,

  /**
   * How long the archive particle dissolve lingers after the card is gone, in
   * seconds. TEMPORARILY set to 2.0 so the effect can be watched — final value
   * TBD. The `.graphVfx` particle Life is tuned to roughly match this.
   */
  archiveDissolveSeconds: 2.0,

  // ── Card follow feel ─────────────────────────────────────────────────────
  /** Visual-card lag toward the grabbed root (0 = glued, 1 = frozen). Per-frame lerp uses 1-this. */
  followLag: 0.78,
  /** Max tilt of the card into the movement direction, degrees. */
  maxTiltDeg: 12,

  // ── Audio ────────────────────────────────────────────────────────────────
  /** Master volume for every triage SFX. Keeps everything well under -20 dB in-scene. */
  sfxVolume: 0.12,

  // ── Phase 3: AI summarization ────────────────────────────────────────────
  /**
   * Master flip for the AI pass. false → the Lens runs entirely on the phase-1
   * placeholder summaries + dataset urgency, no network at all. This is the
   * "flip one config flag" the spec asks for.
   */
  aiEnabled: true,

  /** Model for the summarization batch calls. Per-call knob — change without a rebuild. */
  aiSummaryModel: "gemini-2.5-flash",

  /**
   * Model for the reply-draft call. Starts at 2.5-flash; if the dictation→draft
   * round-trip exceeds 4 s, drop THIS one to "gemini-2.0-flash".
   */
  aiDraftModel: "gemini-2.5-flash",

  /** Messages per summarization request. Never one call per message. */
  aiBatchSize: 6,

  /** Per-batch hard timeout. On timeout those messages keep placeholder + urgency 0.5. */
  aiTimeoutSeconds: 8,

  /** Neutral urgency assigned to messages the AI couldn't summarize. */
  aiFallbackUrgency: 0.5,

  /** Card re-sort animation when AI urgency arrives (spec: 800 ms, not a snap). */
  aiResortSeconds: 0.8,

  // ── Phase 3: voice reply ────────────────────────────────────────────────
  /** Reply panel width, cm. */
  replyPanelWidth: 30,

  /** Other cards' alpha while the reply panel is open (spec: 30%). */
  replyBackgroundAlpha: 0.3,

  /** How far the ring pushes back while the reply panel is open, cm. */
  replyBackgroundPushCm: 15,

  /** Send is two-step: the confirm state reverts after this many seconds. */
  sendConfirmSeconds: 3,

  // ── Phase 3: palm-up outbox menu ────────────────────────────────────────
  /** Palm must face the user for this long before the outbox menu appears (anti-flicker). */
  palmMenuShowHoldSeconds: 0.4,
  /** Palm must be turned away for this long before the menu hides (anti-flicker). */
  palmMenuHideHoldSeconds: 0.4,

  // ── Phase 3: debug ─────────────────────────────────────────────────────
  /**
   * When ASR produces no transcript (e.g. Lens Studio Preview), the reply flow
   * uses a canned intent so the draft/send/outbox path stays testable. The panel
   * shows it clearly labelled as a SIMULATED transcript — never disguised as real
   * dictation.
   */
  simulatedDictationText: "tell her thursday works but push it to 3pm",

  // ── Phase 4a: LEAF test seam ───────────────────────────────────────────
  /**
   * Set true by LEAF scenarios only. Makes the reply flow deterministic and
   * offline: dictation resolves to `simulatedDictationText` on the next frame
   * (no ASR, no 3.5 s watchdog) and OrbitReplyService returns a canned draft
   * instead of calling Gemini. Never ship this true.
   */
  replyTestMode: false,

  /** LEAF/debug: CardFlickController logs its release decision. */
  flickDebug: false,

  /** Debug: OrbitAiService prints the full summary set as JSON (for baking). */
  dumpBakeJson: false,

  // ── Phase 4b: baked summaries ──────────────────────────────────────────
  /**
   * When true, ignore the baked file + local cache and re-run every message
   * through Gemini live (results still go to the local cache, never the baked
   * file). Use to prove the live path still works. Ship false.
   */
  aiForceResummarize: false,
}

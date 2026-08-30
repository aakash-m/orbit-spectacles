/**
 * Orbit — MessageStore.
 *
 * The single source of truth for message data. Every phase goes through this
 * module: phase 1 reads it to build the ring, phase 2 flags triage state,
 * phase 3 writes AI summaries. It is a plain module (no scene wiring) so any
 * script can `import { MessageStore }` and use it immediately.
 *
 * Data is loaded once from Assets/orbit-messages.json — a bundled JsonAsset.
 * There is no network anywhere in this module and there must never be one.
 *
 * Triage state (phase 2) is tracked in a side map keyed by message id, so the
 * OrbitMessage model from the dataset stays untouched. Snooze timing uses
 * `getTime()` (seconds since lens start) — a monotonic runtime clock, separate
 * from the wall-clock used for "23m ago" labels.
 */

import { OrbitMessage, placeholderSummary, compareForRing } from "./OrbitTypes"
import { OrbitConfig } from "./OrbitConfig"

/** Hard cap on cards shown in the ring at once. */
export const MAX_VISIBLE = 12

const DATA = requireAsset("../orbit-messages.json") as JsonAsset

interface RawFile {
  version: number
  messages: OrbitMessage[]
}

export type TriageStatus = "active" | "snoozed" | "archived" | "pinned"

interface TriageRecord {
  status: TriageStatus
  /** For snoozed: `getTime()` value at which the card returns to the queue. */
  wakeAtSec: number
}

let loaded: OrbitMessage[] | null = null
const triage = new Map<string, TriageRecord>()

function load(): OrbitMessage[] {
  if (loaded !== null) return loaded
  try {
    const parsed = JSON.parse(DATA.getString()) as RawFile
    loaded = parsed.messages.slice()
  } catch (e) {
    console.error("[MessageStore] failed to parse orbit-messages.json: " + e)
    loaded = []
  }
  return loaded
}

/** Deterministic ring order: urgency desc → receivedAt desc → id asc. */
const byRingOrder = compareForRing

function statusOf(id: string): TriageStatus {
  const r = triage.get(id)
  return r ? r.status : "active"
}

function findById(id: string): OrbitMessage | null {
  const all = load()
  for (let i = 0; i < all.length; i++) if (all[i].id === id) return all[i]
  return null
}

export const MessageStore = {
  /** Every message, unsorted, in file order. */
  getAll(): OrbitMessage[] {
    return load().slice()
  },

  /**
   * The messages that should currently be on the ring: only `active` ones,
   * sorted by urgency descending, capped at MAX_VISIBLE. Index 0 is the most
   * urgent — it belongs dead centre at eye level.
   */
  getVisible(): OrbitMessage[] {
    return load()
      .filter((m) => statusOf(m.id) === "active")
      .sort(byRingOrder)
      .slice(0, MAX_VISIBLE)
  },

  /** How many active messages are queued behind the visible set (drives "+N more"). */
  overflowCount(): number {
    const active = load().filter((m) => statusOf(m.id) === "active").length
    return Math.max(0, active - MAX_VISIBLE)
  },

  /** No message is active or snoozed — the queue is truly exhausted (empty state). */
  isExhausted(): boolean {
    return load().every((m) => {
      const s = statusOf(m.id)
      return s === "archived" || s === "pinned"
    })
  },

  triageStatus(id: string): TriageStatus {
    return statusOf(id)
  },

  // ── Triage mutations (phase 2) ───────────────────────────────────────────
  /** Slide-off-left action. Returns to the queue after OrbitConfig.snoozeReturnSeconds. */
  snooze(id: string, nowSec: number): void {
    triage.set(id, { status: "snoozed", wakeAtSec: nowSec + OrbitConfig.snoozeReturnSeconds })
  },

  archive(id: string): void {
    triage.set(id, { status: "archived", wakeAtSec: 0 })
  },

  pin(id: string): void {
    triage.set(id, { status: "pinned", wakeAtSec: 0 })
  },

  /** Undo: return a card to the active ring. */
  restore(id: string): void {
    triage.delete(id)
  },

  /**
   * Advance snooze timers. Any snoozed card whose wake time has passed becomes
   * active again. Returns the ids that just woke, so the ring can animate them
   * back in. Call once per frame from OrbitRing.
   */
  tick(nowSec: number): string[] {
    const woke: string[] = []
    triage.forEach((rec, id) => {
      if (rec.status === "snoozed" && nowSec >= rec.wakeAtSec) woke.push(id)
    })
    for (const id of woke) triage.delete(id)
    return woke
  },

  // ── Existing generic update + summary accessor ───────────────────────────
  /**
   * Merge a partial update into a stored message. Phase 3 uses it as
   * `updateState(id, { summary })` — a single assignment that the card picks
   * up through displaySummary().
   */
  updateState(id: string, patch: Partial<OrbitMessage>): void {
    const all = load()
    for (let i = 0; i < all.length; i++) {
      if (all[i].id === id) {
        all[i] = { ...all[i], ...patch }
        return
      }
    }
    console.warn("[MessageStore] updateState: no message with id " + id)
  },

  /**
   * The summary line to render for a message. Returns the real `summary` once
   * the phase-3 AI pass has written one, otherwise the first-12-words
   * placeholder. The card binds to THIS, never to `message.summary`.
   */
  displaySummary(message: OrbitMessage): string {
    const s = message.summary
    if (typeof s === "string" && s.trim().length > 0) return s.trim()
    return placeholderSummary(message.body)
  },

  /** Look up a message by id (used by the undo flow). */
  byId(id: string): OrbitMessage | null {
    return findById(id)
  },
}

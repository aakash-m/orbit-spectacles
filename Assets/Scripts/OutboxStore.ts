/**
 * Orbit — OutboxStore (phase 3).
 *
 * The local "sent" list for the voice-reply flow. This is a PROTOTYPE outbox:
 * nothing is transmitted anywhere. "Sending" a draft appends it here, and the
 * palm-up outbox menu reads it back. Persisted in persistentStorageSystem so a
 * relaunch still shows what you sent — no backend, no Snap Cloud.
 *
 * A plain module (no scene wiring), same shape as MessageStore.
 */

import { OrbitSource } from "./OrbitTypes"

const STORE_KEY = "orbit.outbox.v1"

export interface OutboxEntry {
  /** Source message id this was a reply to. */
  replyToId: string
  to: string
  source: OrbitSource
  /** The full drafted reply text that was "sent". */
  body: string
  /** Wall-clock ms at send time (Date.now()). */
  sentAtMs: number
}

let cache: OutboxEntry[] | null = null

function store(): GeneralDataStore {
  return global.persistentStorageSystem.store
}

function load(): OutboxEntry[] {
  if (cache !== null) return cache
  const raw = store().getString(STORE_KEY)
  if (raw && raw.length > 0) {
    try {
      const parsed = JSON.parse(raw) as OutboxEntry[]
      cache = Array.isArray(parsed) ? parsed : []
    } catch (e) {
      cache = []
    }
  } else {
    cache = []
  }
  return cache
}

export const OutboxStore = {
  /** Every sent draft, newest first. */
  getAll(): OutboxEntry[] {
    return load().slice().sort((a, b) => b.sentAtMs - a.sentAtMs)
  },

  count(): number {
    return load().length
  },

  /** Append a "sent" draft and persist. */
  add(entry: OutboxEntry): void {
    const all = load()
    all.push(entry)
    try {
      store().putString(STORE_KEY, JSON.stringify(all))
    } catch (e) {
      print("[OutboxStore] persist failed: " + e)
    }
  },

  /** Wipe the prototype outbox (used by debug / tests). */
  clear(): void {
    cache = []
    store().remove(STORE_KEY)
  },
}

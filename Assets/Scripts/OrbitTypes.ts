/**
 * Orbit — shared types and pure helpers.
 *
 * No component, no scene dependencies. Every other Orbit module imports from here.
 * Phase 1: data model, source colour coding, placeholder-summary derivation,
 * relative-time formatting.
 */

export type OrbitSource = "email" | "chat" | "calendar" | "social"

/**
 * The message model, exactly as stored in Assets/orbit-messages.json.
 * `summary` is empty in the dataset and populated by the AI pass in phase 3 —
 * never read it directly for display, go through MessageStore.displaySummary().
 */
export interface OrbitMessage {
  id: string
  source: OrbitSource
  senderName: string
  senderInitials: string
  body: string
  receivedAt: string
  urgency: number
  threadId: string
  requiresResponse: boolean
  summary: string
}

/**
 * Per-source visual identity.
 *
 * `bar` is applied ONLY as the 4 mm left-edge bar on a card — never as a fill
 * tint (that would wreck text contrast). Hues are muted but mutually distinct so
 * the source reads at a glance without labels, and each sits well above black so
 * it survives the additive display.
 *
 * `iconName` is the file stem under Assets/Icons/ (imported via /icon-selector).
 */
export interface SourceStyle {
  bar: vec4
  iconName: string
  label: string
}

export const SOURCE_STYLE: { [k in OrbitSource]: SourceStyle } = {
  email: { bar: new vec4(0.36, 0.62, 0.96, 1.0), iconName: "mail", label: "Email" },
  chat: { bar: new vec4(0.40, 0.83, 0.56, 1.0), iconName: "chat_bubble", label: "Chat" },
  calendar: { bar: new vec4(0.97, 0.73, 0.38, 1.0), iconName: "calendar_today", label: "Calendar" },
  social: { bar: new vec4(0.76, 0.56, 0.97, 1.0), iconName: "share", label: "Social" },
}

/**
 * Placeholder summary: the first 12 words of the body, ellipsised if truncated.
 * Used only until the phase-3 AI pass writes a real `summary`. Kept as a pure
 * function so the card never depends on where its summary text came from.
 */
export function placeholderSummary(body: string): string {
  const trimmed = body.trim().replace(/\s+/g, " ")
  if (trimmed.length === 0) return ""
  const words = trimmed.split(" ")
  if (words.length <= 12) return trimmed
  return words.slice(0, 12).join(" ") + "…"
}

/**
 * Parse an ISO-8601 UTC timestamp ("YYYY-MM-DDThh:mm:ssZ") to epoch milliseconds.
 * Manual parse via Date.UTC — deterministic, no dependence on the runtime's
 * Date string-parsing. Returns NaN on a malformed string.
 */
export function parseIso(iso: string): number {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/)
  if (m === null) return NaN
  return Date.UTC(
    parseInt(m[1], 10),
    parseInt(m[2], 10) - 1,
    parseInt(m[3], 10),
    parseInt(m[4], 10),
    parseInt(m[5], 10),
    parseInt(m[6], 10)
  )
}

/**
 * The one true ring order. Deterministic so the centre card is identical on
 * every run — required for filming multiple takes:
 *   1. urgency descending  (most urgent first)
 *   2. receivedAt descending  (newer first) — breaks the AI's urgency ties
 *   3. id ascending  (lexicographic) — final tiebreak, always unique
 * A malformed / missing timestamp sorts as epoch 0 (oldest).
 */
export function compareForRing(a: OrbitMessage, b: OrbitMessage): number {
  if (b.urgency !== a.urgency) return b.urgency - a.urgency
  const ta = parseIso(a.receivedAt) || 0
  const tb = parseIso(b.receivedAt) || 0
  if (tb !== ta) return tb - ta
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/**
 * Compact relative time: "now", "5m ago", "2h ago", "3d ago", "1w ago".
 * `nowMs` is supplied by the caller (OrbitRing's reference-now input) so the
 * scene is deterministic regardless of wall-clock.
 */
export function relativeTime(receivedAtIso: string, nowMs: number): string {
  const then = parseIso(receivedAtIso)
  if (isNaN(then)) return ""
  const sec = Math.max(0, (nowMs - then) / 1000)
  const min = Math.floor(sec / 60)
  if (min < 1) return "now"
  if (min < 60) return min + "m ago"
  const hr = Math.floor(min / 60)
  if (hr < 24) return hr + "h ago"
  const day = Math.floor(hr / 24)
  if (day < 7) return day + "d ago"
  return Math.floor(day / 7) + "w ago"
}

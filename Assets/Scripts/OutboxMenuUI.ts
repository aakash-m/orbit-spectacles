/**
 * Orbit — OutboxMenuUI (phase 3).
 *
 * The "Outbox (prototype)" view. Raise an open palm toward your face and, after
 * a short hold, this panel appears listing the drafts you've "sent" this
 * session (and earlier — it's persisted). Turn the palm away and it hides after
 * an equal hold. The hold on both edges (OrbitConfig.palmMenu*HoldSeconds) stops
 * it flickering in and out while you're triaging.
 *
 * Honest labelling: this is a prototype outbox. Nothing was transmitted.
 *
 * Head-anchored panel (parented under the camera by the bootstrap), shown in the
 * lower-left of view. Self-building, same visual idiom as the rest of Orbit.
 */

import { HandInputData } from "SpectaclesInteractionKit.lspkg/Providers/HandInputData/HandInputData"
import { RoundedRectangle } from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import { OutboxStore } from "./OutboxStore"
import { OrbitConfig } from "./OrbitConfig"

/** "just now" / "4m ago" / "2h ago" / "3d ago" from an epoch-ms delta. */
function ago(sentAtMs: number, nowMs: number): string {
  const sec = Math.max(0, (nowMs - sentAtMs) / 1000)
  if (sec < 45) return "just now"
  const min = Math.floor(sec / 60)
  if (min < 60) return min + "m ago"
  const hr = Math.floor(min / 60)
  if (hr < 24) return hr + "h ago"
  return Math.floor(hr / 24) + "d ago"
}

const THEME_FONT = requireAsset("../Fonts/Inter.ttf") as Font

const PANEL_W = 22
const PANEL_H = 20
const CZ = 0.5
const MAX_ROWS = 7

const FILL = new vec4(0.12, 0.135, 0.16, 0.94)
const BORDER = new vec4(0.74, 0.76, 0.83, 0.9)
const PRIMARY = new vec4(1, 1, 1, 0.95)
const SECONDARY = new vec4(1, 1, 1, 0.5)

@component
export class OutboxMenuUI extends BaseScriptComponent {
  @input
  @hint("Which hand's palm opens the menu: \"right\" or \"left\".")
  handType: string = "right"

  private built = false
  private title!: Text
  private rows: Text[] = []
  private emptyLine!: Text

  private hands: HandInputData | null = null
  private shown = false
  private facingTimer = 0
  private awayTimer = 0

  onAwake(): void {
    this.build()
    this.sceneObject.enabled = false
    this.createEvent("OnStartEvent").bind(() => {
      this.hands = HandInputData.getInstance()
      this.refresh()
    })
    this.createEvent("UpdateEvent").bind(() => this.tick())
  }

  /** Rebuild the list — called on launch and after each send. */
  refresh(): void {
    if (!this.built) this.build()
    const entries = OutboxStore.getAll()
    const now = Date.now()

    this.title.text = "Outbox (prototype)  ·  " + entries.length

    this.emptyLine.enabled = entries.length === 0
    for (let i = 0; i < this.rows.length; i++) {
      const row = this.rows[i]
      if (i < entries.length) {
        const e = entries[i]
        const preview = e.body.replace(/\s+/g, " ").trim()
        const short = preview.length > 38 ? preview.slice(0, 38) + "…" : preview
        row.text = "→ " + e.to + "   ·   " + ago(e.sentAtMs, now) + "\n" + short
        row.enabled = true
      } else {
        row.enabled = false
      }
    }
  }

  // ── Palm gating with hysteresis ──────────────────────────────────────────
  private tick(): void {
    if (!this.hands) return
    const hand = this.hands.getHand(this.handType === "left" ? "left" : "right")
    const facing = hand.isTracked() && hand.isFacingCamera()
    const dt = getDeltaTime()

    if (facing) {
      this.facingTimer += dt
      this.awayTimer = 0
      if (!this.shown && this.facingTimer >= OrbitConfig.palmMenuShowHoldSeconds) this.setShown(true)
    } else {
      this.awayTimer += dt
      this.facingTimer = 0
      if (this.shown && this.awayTimer >= OrbitConfig.palmMenuHideHoldSeconds) this.setShown(false)
    }
  }

  private setShown(v: boolean): void {
    this.shown = v
    if (v) this.refresh()
    this.sceneObject.enabled = v
  }

  // ── Build ────────────────────────────────────────────────────────────────
  private build(): void {
    if (this.built) return
    const root = this.sceneObject

    const plateSO = global.scene.createSceneObject("OutboxPlate")
    plateSO.setParent(root)
    const plate = plateSO.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
    plate.size = new vec2(PANEL_W, PANEL_H)
    plate.cornerRadius = 1.4
    plate.backgroundColor = FILL
    plate.border = true
    plate.borderColor = BORDER
    plate.borderSize = 0.12
    if (!plate.initialized) plate.initialize()
    plate.renderMeshVisual.mainPass.depthTest = true

    this.title = this.text("OutboxTitle", new vec3(-PANEL_W / 2 + 1.4, PANEL_H / 2 - 1.8, CZ), 34, PRIMARY, Rect.create(0, PANEL_W - 2.8, -1.0, 1.0))
    this.title.text = "Outbox (prototype)"

    this.emptyLine = this.text("OutboxEmpty", new vec3(-PANEL_W / 2 + 1.4, PANEL_H / 2 - 4.4, CZ), 30, SECONDARY, Rect.create(0, PANEL_W - 2.8, -1.0, 1.0))
    this.emptyLine.text = "Nothing sent yet."

    const rowTop = PANEL_H / 2 - 4.0
    const rowGap = 2.35
    for (let i = 0; i < MAX_ROWS; i++) {
      const r = this.text(
        "OutboxRow" + i,
        new vec3(-PANEL_W / 2 + 1.4, rowTop - i * rowGap, CZ),
        26,
        new vec4(1, 1, 1, 0.8),
        Rect.create(0, PANEL_W - 2.8, -1.1, 1.1)
      )
      r.verticalAlignment = VerticalAlignment.Top
      r.verticalOverflow = VerticalOverflow.Overflow
      r.enabled = false
      this.rows.push(r)
    }

    this.built = true
  }

  private text(name: string, pos: vec3, size: number, color: vec4, rect: Rect): Text {
    const so = global.scene.createSceneObject(name)
    so.setParent(this.sceneObject)
    so.getTransform().setLocalPosition(pos)
    const t = so.createComponent("Component.Text") as Text
    t.font = THEME_FONT
    t.size = size
    t.depthTest = true
    t.horizontalAlignment = HorizontalAlignment.Left
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Ellipsis
    t.verticalOverflow = VerticalOverflow.Truncate
    t.layoutRect = rect
    t.textFill.color = color
    return t
  }
}

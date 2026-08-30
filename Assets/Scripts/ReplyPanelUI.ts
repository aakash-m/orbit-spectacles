/**
 * Orbit — ReplyPanelUI (phase 3).
 *
 * The reply panel: a head-anchored 30 cm surface that the DOWN-flick opens in
 * front of the (pushed-back, dimmed) ring. Self-building, same idiom as the
 * other Orbit UI — dark translucent fill + luminous border for the additive
 * display, Inter font, world-space Text/Image, SIK Interactable buttons.
 *
 * It is a dumb view: ReplyFlowController drives it through setPhase() / setters
 * and listens to the button events. The panel never touches the store or the AI.
 *
 * Phases:
 *   dictating  — live transcript, [Done] [Cancel]
 *   drafting   — "drafting reply…", [Cancel]
 *   review     — the draft, [Send] [Redraft] [Edit] [Cancel]
 *   confirm    — Send accented, "press again to send", 3 s to revert
 *   editing    — keyboard is up, [Cancel]
 *   sent       — "Sent · Outbox (prototype)", no buttons
 */

import Event, { PublicApi } from "SpectaclesInteractionKit.lspkg/Utils/Event"
import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import { RoundedRectangle } from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import { OrbitMessage, SOURCE_STYLE } from "./OrbitTypes"
import { OrbitConfig } from "./OrbitConfig"

const THEME_FONT = requireAsset("../Fonts/Inter.ttf") as Font

const PANEL_W = 30
const PANEL_H = 29
const CZ = 0.5 // content z, in front of the plate
const IN_L = -PANEL_W / 2 + 1.6 // left content edge
const IN_W = PANEL_W - 3.2 // usable content width

// Vertical anchors (local Y), top → bottom.
const Y_HEADER = PANEL_H / 2 - 2.0
const Y_MSG_CAP = PANEL_H / 2 - 4.2
const Y_BODY = PANEL_H / 2 - 5.1 // body text top
const BODY_RECT_H = 5.4
const Y_SCROLLHINT = PANEL_H / 2 - 11.0
const Y_DIVIDER = PANEL_H / 2 - 11.7
const Y_TR_CAP = PANEL_H / 2 - 13.0
const Y_TR = PANEL_H / 2 - 13.9
const TR_RECT_H = 2.8
const Y_DR_CAP = PANEL_H / 2 - 17.2
const Y_DR = PANEL_H / 2 - 18.1
const DR_RECT_H = 5.2
const Y_BUTTONS = -PANEL_H / 2 + 2.0

const FILL = new vec4(0.12, 0.135, 0.16, 0.94)
const BORDER = new vec4(0.74, 0.76, 0.83, 0.92)
const PRIMARY = new vec4(1, 1, 1, 0.96)
const SECONDARY = new vec4(1, 1, 1, 0.55)
const CAPS = new vec4(1, 1, 1, 0.4)
const AMBER = new vec4(0.97, 0.75, 0.4, 0.95)
const ACCENT = new vec4(0.42, 0.82, 0.56, 1.0)

export type ReplyPhase = "dictating" | "drafting" | "review" | "confirm" | "editing" | "sent"

interface Btn {
  root: SceneObject
  rect: RoundedRectangle
  label: Text
  interactable: Interactable
  event: Event<void>
}

@component
export class ReplyPanelUI extends BaseScriptComponent {
  private built = false

  private plate!: RoundedRectangle
  private header!: Text
  private bodyText!: Text
  private bodyScrollZone!: SceneObject
  private divider!: RoundedRectangle
  private scrollHint!: Text
  private transcriptLabel!: Text
  private transcriptText!: Text
  private draftLabel!: Text
  private draftText!: Text
  private sentOverlay!: Text

  private bDone!: Btn
  private bSend!: Btn
  private bRedraft!: Btn
  private bEdit!: Btn
  private bCancel!: Btn

  private bodyScroll = 0
  private bodyLines = 1

  private _onDone = new Event<void>()
  private _onSend = new Event<void>()
  private _onRedraft = new Event<void>()
  private _onEdit = new Event<void>()
  private _onCancel = new Event<void>()
  get onDone(): PublicApi<void> {
    return this._onDone.publicApi()
  }
  get onSend(): PublicApi<void> {
    return this._onSend.publicApi()
  }
  get onRedraft(): PublicApi<void> {
    return this._onRedraft.publicApi()
  }
  get onEdit(): PublicApi<void> {
    return this._onEdit.publicApi()
  }
  get onCancel(): PublicApi<void> {
    return this._onCancel.publicApi()
  }

  onAwake(): void {
    this.build()
    this.sceneObject.enabled = false
  }

  // ── Public API (driven by ReplyFlowController) ───────────────────────────
  open(msg: OrbitMessage): void {
    if (!this.built) this.build()
    const style = SOURCE_STYLE[msg.source]
    this.header.text = msg.senderName + "   ·   " + style.label
    this.header.textFill.color = PRIMARY
    this.bodyText.text = msg.body
    this.bodyLines = Math.ceil(msg.body.length / 46)
    this.bodyScroll = 0
    this.applyBodyScroll()
    this.transcriptText.text = ""
    this.draftText.text = ""
    this.sentOverlay.enabled = false
    this.sceneObject.enabled = true
    this.setPhase("dictating")
  }

  close(): void {
    this.sceneObject.enabled = false
  }

  setTranscript(text: string, simulated: boolean): void {
    this.transcriptText.text = text
    if (simulated) {
      this.transcriptLabel.text = "SIMULATED TRANSCRIPT  ·  NO MIC IN PREVIEW"
      this.transcriptLabel.textFill.color = AMBER
      this.transcriptText.textFill.color = new vec4(0.97, 0.85, 0.66, 0.95)
    } else {
      this.transcriptLabel.text = "YOUR INTENT"
      this.transcriptLabel.textFill.color = CAPS
      this.transcriptText.textFill.color = SECONDARY
    }
  }

  /** Live partial transcript while dictating — does not touch the label. */
  setPartial(text: string): void {
    this.transcriptText.text = text
  }

  setListening(): void {
    this.transcriptLabel.text = "LISTENING…"
    this.transcriptLabel.textFill.color = ACCENT
    this.transcriptText.textFill.color = SECONDARY
    this.transcriptText.text = ""
  }

  setDraft(text: string): void {
    this.draftText.text = text
  }

  getDraft(): string {
    return this.draftText.text
  }

  setPhase(phase: ReplyPhase): void {
    const dictating = phase === "dictating"
    const drafting = phase === "drafting"
    const review = phase === "review"
    const confirm = phase === "confirm"
    const editing = phase === "editing"
    const sent = phase === "sent"

    this.transcriptLabel.getSceneObject().enabled = !sent
    this.transcriptText.getSceneObject().enabled = !sent
    this.draftLabel.getSceneObject().enabled = !sent && !dictating
    this.draftText.getSceneObject().enabled = !sent && !dictating
    this.bodyText.getSceneObject().enabled = !sent
    this.bodyScrollZone.enabled = !sent
    this.sentOverlay.enabled = sent

    this.draftLabel.text = drafting ? "DRAFTING REPLY…" : editing ? "EDITING — USE THE KEYBOARD" : "DRAFT REPLY"

    this.showBtn(this.bDone, dictating)
    this.showBtn(this.bSend, review || confirm)
    this.showBtn(this.bRedraft, review || confirm)
    this.showBtn(this.bEdit, review || confirm)
    this.showBtn(this.bCancel, !sent)

    if (confirm) {
      this.bSend.label.text = "Press again to send"
      this.bSend.rect.backgroundColor = ACCENT
      this.bSend.label.textFill.color = new vec4(0.05, 0.12, 0.07, 1)
    } else {
      this.bSend.label.text = "Send"
      this.bSend.rect.backgroundColor = FILL
      this.bSend.label.textFill.color = PRIMARY
    }

    this.layoutButtons()
  }

  // ── Build ────────────────────────────────────────────────────────────────
  private build(): void {
    if (this.built) return
    const root = this.sceneObject

    this.plate = this.rect(root, "ReplyPlate", new vec3(0, 0, 0), PANEL_W, PANEL_H, PANEL_H / 18, {
      fill: FILL,
      border: true,
    })

    this.header = this.text(root, "ReplyHeader", new vec3(IN_L, Y_HEADER, CZ), 60, PRIMARY, HorizontalAlignment.Left, Rect.create(0, IN_W, -1.4, 1.4))
    this.header.horizontalOverflow = HorizontalOverflow.Ellipsis

    this.capLabel(root, "MESSAGE", new vec3(IN_L, Y_MSG_CAP, CZ))
    this.bodyText = this.text(
      root,
      "ReplyBody",
      new vec3(IN_L, Y_BODY, CZ),
      32,
      new vec4(1, 1, 1, 0.82),
      HorizontalAlignment.Left,
      Rect.create(0, IN_W, -BODY_RECT_H, 0)
    )
    this.bodyText.verticalAlignment = VerticalAlignment.Top
    this.bodyText.verticalOverflow = VerticalOverflow.Truncate

    // Scroll zone over the body region.
    this.bodyScrollZone = global.scene.createSceneObject("ReplyBodyScroll")
    this.bodyScrollZone.setParent(root)
    this.bodyScrollZone.getTransform().setLocalPosition(new vec3(0, Y_BODY - BODY_RECT_H / 2, CZ - 0.15))
    const szCol = this.bodyScrollZone.createComponent("Physics.ColliderComponent")
    const szShape = Shape.createBoxShape()
    szShape.size = new vec3(IN_W, BODY_RECT_H, 1.2)
    szCol.shape = szShape
    const szInt = this.bodyScrollZone.createComponent(Interactable.getTypeName()) as Interactable
    szInt.targetingMode = 1
    this.scrollHint = this.capLabel(root, "", new vec3(PANEL_W / 2 - 1.6, Y_SCROLLHINT, CZ), HorizontalAlignment.Right)

    this.divider = this.rect(root, "ReplyDivider", new vec3(0, Y_DIVIDER, CZ), IN_W, 0.08, 0.04, {
      fill: new vec4(1, 1, 1, 0.22),
      border: false,
    })

    this.transcriptLabel = this.capLabel(root, "LISTENING…", new vec3(IN_L, Y_TR_CAP, CZ))
    this.transcriptText = this.text(
      root,
      "ReplyTranscript",
      new vec3(IN_L, Y_TR, CZ),
      32,
      SECONDARY,
      HorizontalAlignment.Left,
      Rect.create(0, IN_W, -TR_RECT_H, 0)
    )
    this.transcriptText.verticalAlignment = VerticalAlignment.Top
    this.transcriptText.verticalOverflow = VerticalOverflow.Truncate

    this.draftLabel = this.capLabel(root, "DRAFT REPLY", new vec3(IN_L, Y_DR_CAP, CZ))
    this.draftText = this.text(
      root,
      "ReplyDraft",
      new vec3(IN_L, Y_DR, CZ),
      32,
      PRIMARY,
      HorizontalAlignment.Left,
      Rect.create(0, IN_W, -DR_RECT_H, 0)
    )
    this.draftText.verticalAlignment = VerticalAlignment.Top
    this.draftText.verticalOverflow = VerticalOverflow.Truncate

    this.sentOverlay = this.text(root, "ReplySent", new vec3(0, 0, CZ + 0.2), 62, ACCENT, HorizontalAlignment.Center, Rect.create(-PANEL_W / 2 + 2, PANEL_W / 2 - 2, -3, 3))
    this.sentOverlay.text = "Sent  ·  Outbox (prototype)"
    this.sentOverlay.enabled = false

    this.bDone = this.button(root, "Done", () => this._onDone.invoke())
    this.bSend = this.button(root, "Send", () => this._onSend.invoke())
    this.bRedraft = this.button(root, "Redraft", () => this._onRedraft.invoke())
    this.bEdit = this.button(root, "Edit", () => this._onEdit.invoke())
    this.bCancel = this.button(root, "Cancel", () => this._onCancel.invoke())

    this.createEvent("OnStartEvent").bind(() => {
      szInt.onTriggerStart.add(() => this.cycleBodyScroll())
      this.bindBtn(this.bDone)
      this.bindBtn(this.bSend)
      this.bindBtn(this.bRedraft)
      this.bindBtn(this.bEdit)
      this.bindBtn(this.bCancel)
    })

    this.built = true
  }

  // ── Body scroll ──────────────────────────────────────────────────────────
  private pageCount(): number {
    return Math.max(1, Math.ceil(this.bodyLines / 4))
  }

  private cycleBodyScroll(): void {
    this.bodyScroll = (this.bodyScroll + 1) % this.pageCount()
    this.applyBodyScroll()
  }

  private applyBodyScroll(): void {
    const t = this.bodyText.getSceneObject().getTransform()
    t.setLocalPosition(new vec3(IN_L, Y_BODY + this.bodyScroll * (BODY_RECT_H - 0.6), CZ))
    const pages = this.pageCount()
    if (pages > 1) {
      this.scrollHint.text = "⌄ pinch body to scroll  (" + (this.bodyScroll + 1) + "/" + pages + ")"
    } else {
      this.scrollHint.text = ""
    }
  }

  // ── Buttons ──────────────────────────────────────────────────────────────
  private button(parent: SceneObject, label: string, fire: () => void): Btn {
    const so = global.scene.createSceneObject("ReplyBtn_" + label)
    so.setParent(parent)
    const rect = so.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
    rect.size = new vec2(6.4, 2.6)
    rect.cornerRadius = 1.3
    rect.backgroundColor = FILL
    rect.border = true
    rect.borderColor = BORDER
    rect.borderSize = 0.1
    if (!rect.initialized) rect.initialize()
    rect.renderMeshVisual.mainPass.depthTest = true

    const textSO = global.scene.createSceneObject("Label")
    textSO.setParent(so)
    textSO.getTransform().setLocalPosition(new vec3(0, 0, 0.1))
    const t = textSO.createComponent("Component.Text") as Text
    t.font = THEME_FONT
    t.size = 40
    t.text = label
    t.depthTest = true
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-3.4, 3.4, -1.2, 1.2)
    t.textFill.color = PRIMARY

    const col = so.createComponent("Physics.ColliderComponent")
    const shape = Shape.createBoxShape()
    shape.size = new vec3(6.4, 2.6, 1.5)
    col.shape = shape
    const interactable = so.createComponent(Interactable.getTypeName()) as Interactable
    interactable.targetingMode = 1

    const event = new Event<void>()
    event.add(fire)
    so.enabled = false
    return { root: so, rect, label: t, interactable, event }
  }

  private bindBtn(b: Btn): void {
    b.interactable.onTriggerStart.add(() => {
      if (b.root.enabled) b.event.invoke()
    })
  }

  private showBtn(b: Btn, on: boolean): void {
    b.root.enabled = on
  }

  private layoutButtons(): void {
    const visible: Btn[] = []
    for (const b of [this.bDone, this.bSend, this.bRedraft, this.bEdit, this.bCancel]) {
      if (b.root.enabled) visible.push(b)
    }
    const gap = 0.6
    const wSend = 8.4
    let total = 0
    for (const b of visible) total += (b === this.bSend ? wSend : 6.4) + gap
    total -= gap
    let x = -total / 2
    const y = -PANEL_H / 2 + 2.2
    for (const b of visible) {
      const w = b === this.bSend ? wSend : 6.4
      b.rect.size = new vec2(w, 2.6)
      b.root.getTransform().setLocalPosition(new vec3(x + w / 2, y, CZ))
      x += w + gap
    }
  }

  // ── Primitives ───────────────────────────────────────────────────────────
  private rect(
    parent: SceneObject,
    name: string,
    pos: vec3,
    w: number,
    h: number,
    r: number,
    opts: { fill: vec4; border: boolean }
  ): RoundedRectangle {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    so.getTransform().setLocalPosition(pos)
    const rect = so.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
    rect.size = new vec2(w, h)
    rect.cornerRadius = r
    rect.backgroundColor = opts.fill
    rect.border = opts.border
    if (opts.border) {
      rect.borderColor = BORDER
      rect.borderSize = 0.12
    }
    if (!rect.initialized) rect.initialize()
    rect.renderMeshVisual.mainPass.depthTest = true
    return rect
  }

  private text(
    parent: SceneObject,
    name: string,
    pos: vec3,
    size: number,
    color: vec4,
    hAlign: HorizontalAlignment,
    rect: Rect
  ): Text {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    so.getTransform().setLocalPosition(pos)
    const t = so.createComponent("Component.Text") as Text
    t.font = THEME_FONT
    t.size = size
    t.depthTest = true
    t.horizontalAlignment = hAlign
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Wrap
    t.verticalOverflow = VerticalOverflow.Truncate
    t.layoutRect = rect
    t.textFill.color = color
    return t
  }

  private capLabel(parent: SceneObject, str: string, pos: vec3, hAlign: HorizontalAlignment = HorizontalAlignment.Left): Text {
    const t = this.text(parent, "Cap", pos, 24, CAPS, hAlign, Rect.create(hAlign === HorizontalAlignment.Right ? -(PANEL_W - 3.2) : 0, hAlign === HorizontalAlignment.Right ? 0 : PANEL_W - 3.2, -0.9, 0.9))
    t.text = str
    t.horizontalOverflow = HorizontalOverflow.Overflow
    return t
  }
}

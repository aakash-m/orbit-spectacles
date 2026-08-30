/**
 * Orbit — OrbitCardUI.
 *
 * One message card: 22 cm × 14 cm, soft-cornered, dark-translucent surface with
 * a luminous border, a 4 mm source-hue bar down the left edge, and five content
 * elements — sender initials in a circle, sender name, the summary line
 * (one line, ellipsised), relative time, and the source icon.
 *
 * Structure:
 *   cardRoot (this.sceneObject)      ← CardFlickController grabs / moves this
 *   ├── CardVisual                    ← lags behind the root + tilts into motion
 *   │    └── Surface / SourceBar / InitialsBadge / Initials / SenderName /
 *   │        Summary / RelativeTime / SourceIcon
 *   └── Affordances                   ← four directional icons, hidden until grab
 *
 * Data flows IN through setMessage(); the card never reaches back into the store
 * except through MessageStore.displaySummary(). Phase 2 adds the affordance
 * icons and the animation helpers used by the triage flow.
 */

import animate from "SpectaclesInteractionKit.lspkg/Utils/animate"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import { RoundedRectangle } from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import { OrbitMessage, OrbitSource, SOURCE_STYLE, relativeTime } from "./OrbitTypes"
import { MessageStore } from "./MessageStore"
import { OrbitConfig } from "./OrbitConfig"

const THEME_FONT = requireAsset("../Fonts/Inter.ttf") as Font
const IMAGE_MATERIAL = requireAsset("../Materials/ImageMaterial.mat") as Material

const SOURCE_ICON: { [k in OrbitSource]: Texture } = {
  email: requireAsset("../Icons/mail.png") as Texture,
  chat: requireAsset("../Icons/chat_bubble.png") as Texture,
  calendar: requireAsset("../Icons/calendar_today.png") as Texture,
  social: requireAsset("../Icons/share.png") as Texture,
}

const AFFORDANCE_ICON = {
  left: requireAsset("../Icons/snooze.png") as Texture,
  right: requireAsset("../Icons/archive.png") as Texture,
  up: requireAsset("../Icons/keep.png") as Texture,
  down: requireAsset("../Icons/reply.png") as Texture,
}

export type CardSfx =
  | "lift"
  | "whoosh-left"
  | "whoosh-right"
  | "whoosh-up"
  | "whoosh-down"
  | "dissolve"

const SFX: { [k in CardSfx]: AudioTrackAsset } = {
  lift: requireAsset("../GeneratedSFX/card-lift.wav") as AudioTrackAsset,
  "whoosh-left": requireAsset("../GeneratedSFX/whoosh-left.wav") as AudioTrackAsset,
  "whoosh-right": requireAsset("../GeneratedSFX/whoosh-right.wav") as AudioTrackAsset,
  "whoosh-up": requireAsset("../GeneratedSFX/whoosh-up.wav") as AudioTrackAsset,
  "whoosh-down": requireAsset("../GeneratedSFX/whoosh-down.wav") as AudioTrackAsset,
  dissolve: requireAsset("../GeneratedSFX/dissolve.wav") as AudioTrackAsset,
}

// ── Card geometry (cm, local to the card origin at its centre) ───────────────
const CARD_W = 22
const CARD_H = 14
const BAR_W = 0.4
const CONTENT_Z = 0.6
const BADGE_D = 2.7
const X_LEFT = -CARD_W / 2 + BAR_W + 1.3

const SIZE_NAME = 92
const SIZE_SUMMARY = 88
const SIZE_TIME = 88
const SIZE_INITIALS = 84

const AFF_BASE_ALPHA = 0.26
const AFF_PEAK_ALPHA = 1.0
const AFF_SIZE = 2.8
const AFF_GAP = 4.5 // cm beyond the card edge

export type FlickDir = "left" | "right" | "up" | "down"

export interface CardTheme {
  surfaceFill: vec4
  borderColor: vec4
  borderSize: number
  cornerRadius: number
  badgeFill: vec4
  primaryText: vec4
  secondaryText: vec4
}

export const DEFAULT_CARD_THEME: CardTheme = {
  surfaceFill: new vec4(0.13, 0.145, 0.17, 0.9),
  borderColor: new vec4(0.72, 0.74, 0.8, 0.9),
  borderSize: 0.15,
  cornerRadius: 1.2,
  badgeFill: new vec4(1, 1, 1, 0.16),
  primaryText: new vec4(1, 1, 1, 1),
  secondaryText: new vec4(1, 1, 1, 0.62),
}

function withAlpha(c: vec4, mul: number): vec4 {
  return new vec4(c.x, c.y, c.z, c.w * mul)
}

@component
export class OrbitCardUI extends BaseScriptComponent {
  private theme: CardTheme = DEFAULT_CARD_THEME

  private visual!: SceneObject
  private affordances!: SceneObject
  private surface!: RoundedRectangle
  private leftBar!: RoundedRectangle
  private badge!: RoundedRectangle
  private initialsText!: Text
  private nameText!: Text
  private summaryText!: Text
  private timeText!: Text
  private iconImage!: Image
  private iconMaterial!: Material
  private sfx!: AudioComponent

  private affIcons: { [k in FlickDir]?: { img: Image; mat: Material } } = {}

  private built = false
  private currentSource: OrbitSource | null = null
  private alpha = 1

  // Base (design) colours, captured after each setMessage so setAlpha() can
  // scale them without drift.
  private base = {
    barW: 1,
    badgeW: 0.92,
  }

  // Lag/tilt state
  private grabbed = false
  private cam: Transform | null = null

  onAwake(): void {
    this.build()
    this.createEvent("OnStartEvent").bind(() => {
      this.cam = WorldCameraFinderProvider.getInstance().getTransform()
    })
    this.createEvent("UpdateEvent").bind(() => this.tickVisual())
  }

  applyTheme(theme: Partial<CardTheme>): void {
    this.theme = { ...this.theme, ...theme }
    if (this.built) this.restyle()
  }

  setMessage(message: OrbitMessage, nowMs: number): void {
    if (!this.built) this.build()
    const style = SOURCE_STYLE[message.source]

    this.initialsText.text = message.senderInitials
    this.nameText.text = message.senderName
    this.summaryText.text = MessageStore.displaySummary(message)
    this.timeText.text = relativeTime(message.receivedAt, nowMs)

    if (this.currentSource !== message.source) {
      this.currentSource = message.source
      this.leftBar.backgroundColor = style.bar
      this.badge.backgroundColor = new vec4(style.bar.x, style.bar.y, style.bar.z, 0.92)
      this.iconMaterial.mainPass.baseTex = SOURCE_ICON[message.source]
    }
    this.setAlpha(1)
  }

  /** Refresh just the relative-time label (OrbitRing calls this each second). */
  refreshTime(message: OrbitMessage, nowMs: number): void {
    if (this.built) this.timeText.text = relativeTime(message.receivedAt, nowMs)
  }

  getRootObject(): SceneObject {
    return this.sceneObject
  }

  /** Play a triage SFX from the card's own position (spatialized). */
  playSfx(key: CardSfx): void {
    if (!this.sfx) return
    this.sfx.audioTrack = SFX[key]
    this.sfx.play(1)
  }

  // ── Grab / lag / tilt ────────────────────────────────────────────────────
  onGrabStart(): void {
    this.grabbed = true
    this.playSfx("lift")
  }

  onGrabEnd(): void {
    this.grabbed = false
  }

  /**
   * The visible card lags the root in world space (chases it at a fixed rate),
   * so it drifts when the hand moves and settles when the hand stops — the
   * "weighted, not glued" feel. It also tips its face toward the direction of
   * travel. Always running; cheap. When the root is still this is a no-op.
   */
  private tickVisual(): void {
    if (!this.visual) return
    const vt = this.visual.getTransform()
    const rootPos = this.sceneObject.getTransform().getWorldPosition()
    const cur = vt.getWorldPosition()
    const offset = rootPos.sub(cur)

    if (offset.length < 0.02 && !this.grabbed) {
      // Snap to rest and clear tilt when close enough.
      vt.setWorldPosition(rootPos)
      vt.setLocalRotation(quat.quatIdentity())
      return
    }

    const k = 1 - OrbitConfig.followLag
    vt.setWorldPosition(new vec3(
      cur.x + offset.x * k,
      cur.y + offset.y * k,
      cur.z + offset.z * k
    ))

    // Tilt toward motion — project the (still-present) offset onto the camera's
    // right / up axes and rotate the visual by a clamped fraction.
    if (this.cam) {
      const right = this.cam.right
      const up = this.cam.up
      const maxRad = OrbitConfig.maxTiltDeg * MathUtils.DegToRad
      const tiltY = MathUtils.clamp(offset.dot(right) * 0.5, -maxRad, maxRad)
      const tiltX = MathUtils.clamp(-offset.dot(up) * 0.5, -maxRad, maxRad)
      vt.setLocalRotation(quat.fromEulerAngles(tiltX, tiltY, 0))
    }
  }

  // ── Affordances ──────────────────────────────────────────────────────────
  showAffordances(): void {
    if (!this.affordances) return
    this.affordances.enabled = true
    for (const dir of ["left", "right", "up", "down"] as FlickDir[]) {
      this.setAffAlpha(dir, 0)
    }
    animate({
      duration: OrbitConfig.affordanceFadeIn,
      easing: "ease-out-quad",
      update: (t: number) => {
        for (const dir of ["left", "right", "up", "down"] as FlickDir[]) {
          this.setAffAlpha(dir, AFF_BASE_ALPHA * t)
        }
      },
    })
  }

  /** planarTravelCm: (+x = right, +y = up) travel in the card's facing plane. */
  updateAffordances(planarTravelCm: vec2): void {
    const proj: { [k in FlickDir]: number } = {
      right: planarTravelCm.x,
      left: -planarTravelCm.x,
      up: planarTravelCm.y,
      down: -planarTravelCm.y,
    }
    for (const dir of ["left", "right", "up", "down"] as FlickDir[]) {
      const t = MathUtils.clamp(proj[dir] / OrbitConfig.minTravelCm, 0, 1)
      this.setAffAlpha(dir, AFF_BASE_ALPHA + (AFF_PEAK_ALPHA - AFF_BASE_ALPHA) * t)
    }
  }

  hideAffordances(): void {
    if (!this.affordances) return
    const aff = this.affordances
    animate({
      duration: OrbitConfig.affordanceFadeIn,
      easing: "ease-in-quad",
      update: (t: number) => {
        for (const dir of ["left", "right", "up", "down"] as FlickDir[]) {
          this.setAffAlpha(dir, AFF_BASE_ALPHA * (1 - t))
        }
      },
      ended: () => {
        aff.enabled = false
      },
    })
  }

  private setAffAlpha(dir: FlickDir, a: number): void {
    const entry = this.affIcons[dir]
    if (entry) entry.mat.mainPass.baseColor = new vec4(1, 1, 1, a)
  }

  // ── Alpha (fade the whole visual) ────────────────────────────────────────
  setAlpha(a: number): void {
    this.alpha = a
    this.surface.backgroundColor = withAlpha(this.theme.surfaceFill, a)
    this.surface.borderColor = withAlpha(this.theme.borderColor, a)
    if (this.currentSource) {
      const bar = SOURCE_STYLE[this.currentSource].bar
      this.leftBar.backgroundColor = new vec4(bar.x, bar.y, bar.z, this.base.barW * a)
      this.badge.backgroundColor = new vec4(bar.x, bar.y, bar.z, this.base.badgeW * a)
    }
    this.initialsText.textFill.color = withAlpha(this.theme.primaryText, a)
    this.nameText.textFill.color = withAlpha(this.theme.primaryText, a)
    this.summaryText.textFill.color = withAlpha(this.theme.primaryText, a)
    this.timeText.textFill.color = withAlpha(this.theme.secondaryText, a)
    this.iconMaterial.mainPass.baseColor = new vec4(1, 1, 1, a)
  }

  fadeTo(target: number, duration: number, onDone?: () => void): void {
    const from = this.alpha
    animate({
      duration,
      easing: "ease-out-quad",
      update: (t: number) => this.setAlpha(from + (target - from) * t),
      ended: () => {
        if (onDone) onDone()
      },
    })
  }

  // ── Transform animation helpers (all in pivot-LOCAL space) ───────────────
  //
  // Cards are children of RingPivot. Working in local space means these
  // animations survive the ring re-centring under them. The billboard rotation
  // (set on the root each frame by OrbitRing) is independent of position.
  setLocalPos(p: vec3): void {
    this.sceneObject.getTransform().setLocalPosition(p)
  }

  getLocalPos(): vec3 {
    return this.sceneObject.getTransform().getLocalPosition()
  }

  private moveLocalTo(
    target: vec3,
    duration: number,
    easing: "ease-out-quad" | "ease-out-back" | "ease-in-out-quad" | "ease-in-quad",
    onDone?: () => void,
    delay = 0
  ): void {
    const start = this.sceneObject.getTransform().getLocalPosition()
    animate({
      duration,
      easing,
      delayFrames: delay > 0 ? Math.round(delay * 60) : undefined,
      update: (t: number) => {
        this.sceneObject
          .getTransform()
          .setLocalPosition(new vec3(
            start.x + (target.x - start.x) * t,
            start.y + (target.y - start.y) * t,
            start.z + (target.z - start.z) * t
          ))
      },
      ended: () => {
        if (onDone) onDone()
      },
    })
  }

  /** Soft settle back into the slot (below-threshold gesture). */
  settle(slotLocal: vec3): void {
    this.moveLocalTo(slotLocal, OrbitConfig.settleDuration, "ease-out-quad")
  }

  /** Spring back into the slot (travel exceeded but not fast enough). */
  springBack(slotLocal: vec3): void {
    this.moveLocalTo(slotLocal, OrbitConfig.springBackDuration, "ease-out-back")
  }

  /** Commit: slide off toward a local direction and fade, then hide + callback. */
  commitSlide(dirLocal: vec3, slotLocal: vec3, onGone: () => void): void {
    const target = slotLocal.add(dirLocal.normalize().uniformScale(55))
    this.moveLocalTo(target, OrbitConfig.commitAnimDuration, "ease-in-quad")
    this.fadeTo(0, OrbitConfig.commitAnimDuration, () => {
      this.sceneObject.enabled = false
      onGone()
    })
  }

  /** Commit: fly up and out, then hide + callback (pin stub). */
  commitFlyUp(slotLocal: vec3, onGone: () => void): void {
    const target = slotLocal.add(new vec3(0, 45, 12))
    this.moveLocalTo(target, OrbitConfig.commitAnimDuration + 0.05, "ease-in-quad")
    this.fadeTo(0, OrbitConfig.commitAnimDuration + 0.05, () => {
      this.sceneObject.enabled = false
      onGone()
    })
  }

  /** Commit: dissolve in place — fade + slight shrink, then hide + callback.
   *  The particle burst is spawned by TriageController. */
  commitDissolve(onGone: () => void): void {
    const t0 = this.sceneObject.getTransform()
    const s0 = t0.getLocalScale()
    animate({
      duration: OrbitConfig.commitAnimDuration,
      easing: "ease-in-quad",
      update: (t: number) => {
        const s = 1 - 0.15 * t
        t0.setLocalScale(new vec3(s0.x * s, s0.y * s, s0.z * s))
      },
    })
    this.fadeTo(0, OrbitConfig.commitAnimDuration, () => {
      t0.setLocalScale(s0)
      this.sceneObject.enabled = false
      onGone()
    })
  }

  /** Re-flow: start at `fromLocal`, ease to the (possibly new) slot, staggered.
   *  `durationSeconds` overrides the default (used by the 800 ms AI re-sort). */
  reflowFromTo(fromLocal: vec3, slotLocal: vec3, staggerIndex: number, durationSeconds?: number): void {
    this.setLocalPos(fromLocal)
    this.moveLocalTo(
      slotLocal,
      durationSeconds ?? OrbitConfig.reflowDuration,
      "ease-in-out-quad",
      undefined,
      staggerIndex * OrbitConfig.reflowStagger
    )
  }

  /** A newly-visible card enters at its slot from further out + fades up. */
  enterAt(slotLocal: vec3, fromLocal: vec3): void {
    this.sceneObject.enabled = true
    this.setLocalPos(fromLocal)
    this.setAlpha(0)
    this.moveLocalTo(slotLocal, OrbitConfig.reflowDuration, "ease-out-quad")
    this.fadeTo(1, OrbitConfig.reflowDuration)
  }

  /** Undo: reverse the commit — reappear at `fromLocal` and animate to the slot. */
  reverseTo(slotLocal: vec3, fromLocal: vec3, onDone?: () => void): void {
    this.sceneObject.enabled = true
    this.setLocalPos(fromLocal)
    this.setAlpha(0)
    this.moveLocalTo(slotLocal, OrbitConfig.commitAnimDuration, "ease-out-quad", onDone)
    this.fadeTo(1, OrbitConfig.commitAnimDuration)
  }

  // ── Construction ─────────────────────────────────────────────────────────
  private build(): void {
    if (this.built) return
    const root = this.sceneObject

    this.visual = global.scene.createSceneObject("CardVisual")
    this.visual.setParent(root)
    const v = this.visual

    this.surface = this.makeRect(v, "Surface", new vec3(0, 0, 0), CARD_W, CARD_H, {
      cornerRadius: this.theme.cornerRadius,
      fill: this.theme.surfaceFill,
      border: true,
      borderColor: this.theme.borderColor,
      borderSize: this.theme.borderSize,
    })

    this.leftBar = this.makeRect(
      v,
      "SourceBar",
      new vec3(-CARD_W / 2 + BAR_W / 2 + 0.25, 0, CONTENT_Z),
      BAR_W,
      CARD_H - 1.8,
      { cornerRadius: BAR_W / 2, fill: new vec4(1, 1, 1, 1), border: false }
    )

    this.badge = this.makeRect(
      v,
      "InitialsBadge",
      new vec3(X_LEFT + BADGE_D / 2, CARD_H / 2 - 2.7, CONTENT_Z),
      BADGE_D,
      BADGE_D,
      { cornerRadius: BADGE_D / 2, fill: this.theme.badgeFill, border: false }
    )

    this.initialsText = this.makeText(
      v,
      "Initials",
      new vec3(X_LEFT + BADGE_D / 2, CARD_H / 2 - 2.7, CONTENT_Z + 0.05),
      SIZE_INITIALS,
      this.theme.primaryText,
      HorizontalAlignment.Center,
      Rect.create(-BADGE_D / 2, BADGE_D / 2, -BADGE_D / 2, BADGE_D / 2),
      HorizontalOverflow.Overflow
    )

    const nameLeft = X_LEFT + BADGE_D + 1.0
    this.nameText = this.makeText(
      v,
      "SenderName",
      new vec3(nameLeft, CARD_H / 2 - 2.7, CONTENT_Z),
      SIZE_NAME,
      this.theme.primaryText,
      HorizontalAlignment.Left,
      Rect.create(0, CARD_W / 2 - nameLeft - 0.6, -1.5, 1.5),
      HorizontalOverflow.Ellipsis
    )

    this.summaryText = this.makeText(
      v,
      "Summary",
      new vec3(X_LEFT, 0.3, CONTENT_Z),
      SIZE_SUMMARY,
      this.theme.primaryText,
      HorizontalAlignment.Left,
      Rect.create(0, CARD_W / 2 - X_LEFT - 0.9, -1.5, 1.5),
      HorizontalOverflow.Ellipsis
    )

    this.timeText = this.makeText(
      v,
      "RelativeTime",
      new vec3(X_LEFT, -CARD_H / 2 + 2.6, CONTENT_Z),
      SIZE_TIME,
      this.theme.secondaryText,
      HorizontalAlignment.Left,
      Rect.create(0, 10, -1.5, 1.5),
      HorizontalOverflow.Overflow
    )

    this.buildIcon(v)
    this.buildAffordances(root)

    this.sfx = root.createComponent("Component.AudioComponent") as AudioComponent
    this.sfx.volume = OrbitConfig.sfxVolume
    this.sfx.playbackMode = Audio.PlaybackMode.LowLatency
    this.sfx.spatialAudio.enabled = true

    this.built = true
  }

  private buildIcon(parent: SceneObject): void {
    const so = global.scene.createSceneObject("SourceIcon")
    so.setParent(parent)
    so.getTransform().setLocalPosition(new vec3(CARD_W / 2 - 2.3, -CARD_H / 2 + 2.6, CONTENT_Z))
    so.getTransform().setLocalScale(new vec3(1.9, 1.9, 1))

    this.iconImage = so.createComponent("Component.Image") as Image
    this.iconMaterial = IMAGE_MATERIAL.clone()
    this.iconMaterial.mainPass.depthTest = true
    this.iconMaterial.mainPass.depthWrite = false
    this.iconImage.clearMaterials()
    this.iconImage.addMaterial(this.iconMaterial)
  }

  private buildAffordances(root: SceneObject): void {
    this.affordances = global.scene.createSceneObject("Affordances")
    this.affordances.setParent(root)
    this.affordances.enabled = false

    const place: { dir: FlickDir; pos: vec3 }[] = [
      { dir: "left", pos: new vec3(-(CARD_W / 2 + AFF_GAP), 0, CONTENT_Z) },
      { dir: "right", pos: new vec3(CARD_W / 2 + AFF_GAP, 0, CONTENT_Z) },
      { dir: "up", pos: new vec3(0, CARD_H / 2 + AFF_GAP, CONTENT_Z) },
      { dir: "down", pos: new vec3(0, -(CARD_H / 2 + AFF_GAP), CONTENT_Z) },
    ]
    for (const { dir, pos } of place) {
      const so = global.scene.createSceneObject("Aff_" + dir)
      so.setParent(this.affordances)
      so.getTransform().setLocalPosition(pos)
      so.getTransform().setLocalScale(new vec3(AFF_SIZE, AFF_SIZE, 1))
      const img = so.createComponent("Component.Image") as Image
      const mat = IMAGE_MATERIAL.clone()
      mat.mainPass.baseTex = AFFORDANCE_ICON[dir]
      mat.mainPass.depthTest = true
      mat.mainPass.depthWrite = false
      mat.mainPass.baseColor = new vec4(1, 1, 1, 0)
      img.clearMaterials()
      img.addMaterial(mat)
      this.affIcons[dir] = { img, mat }
    }
  }

  private restyle(): void {
    this.surface.backgroundColor = this.theme.surfaceFill
    this.surface.borderColor = this.theme.borderColor
    this.surface.borderSize = this.theme.borderSize
    this.surface.cornerRadius = this.theme.cornerRadius
    this.badge.backgroundColor = this.theme.badgeFill
    this.initialsText.textFill.color = this.theme.primaryText
    this.nameText.textFill.color = this.theme.primaryText
    this.summaryText.textFill.color = this.theme.primaryText
    this.timeText.textFill.color = this.theme.secondaryText
  }

  // ── Primitive helpers ────────────────────────────────────────────────────
  private makeRect(
    parent: SceneObject,
    name: string,
    localPos: vec3,
    w: number,
    h: number,
    opts: { cornerRadius: number; fill: vec4; border: boolean; borderColor?: vec4; borderSize?: number }
  ): RoundedRectangle {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    so.getTransform().setLocalPosition(localPos)

    const rect = so.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
    rect.size = new vec2(w, h)
    rect.cornerRadius = opts.cornerRadius
    rect.backgroundColor = opts.fill
    rect.border = opts.border
    if (opts.border) {
      rect.borderColor = opts.borderColor ?? new vec4(1, 1, 1, 1)
      rect.borderSize = opts.borderSize ?? 0.15
    }
    if (!rect.initialized) rect.initialize()
    rect.renderMeshVisual.mainPass.depthTest = true
    return rect
  }

  private makeText(
    parent: SceneObject,
    name: string,
    localPos: vec3,
    size: number,
    color: vec4,
    hAlign: HorizontalAlignment,
    rect: Rect,
    hOverflow: HorizontalOverflow
  ): Text {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    so.getTransform().setLocalPosition(localPos)

    const t = so.createComponent("Component.Text") as Text
    t.font = THEME_FONT
    t.size = size
    t.depthTest = true
    t.horizontalAlignment = hAlign
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = hOverflow
    t.verticalOverflow = VerticalOverflow.Truncate
    t.layoutRect = rect
    t.textFill.color = color
    return t
  }
}

/**
 * Orbit — OrbitUndoChipUI.
 *
 * The undo chip. Head-anchored, lower field of view. Appears after every
 * destructive-feeling triage action (snooze / archive / pin) with a depleting
 * progress line. Pinch it to restore the card. After the window elapses it
 * fades and the action becomes permanent.
 *
 * This Lens performs destructive-feeling actions on a user's messages; the undo
 * is what makes it safe to use quickly.
 */

import animate from "SpectaclesInteractionKit.lspkg/Utils/animate"
import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import { RoundedRectangle } from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import { OrbitConfig } from "./OrbitConfig"

const THEME_FONT = requireAsset("../Fonts/Inter.ttf") as Font
const IMAGE_MATERIAL = requireAsset("../Materials/ImageMaterial.mat") as Material
const UNDO_ICON = requireAsset("../Icons/undo.png") as Texture
const UNDO_TONE = requireAsset("../GeneratedSFX/undo-tone.wav") as AudioTrackAsset

const CHIP_W = 15
const CHIP_H = 3.8
const CONTENT_Z = 0.4
const BAR_W = CHIP_W - 1.4

@component
export class OrbitUndoChipUI extends BaseScriptComponent {
  private surface!: RoundedRectangle
  private progress!: RoundedRectangle
  private label!: Text
  private interactable!: Interactable
  private sfx!: AudioComponent

  private built = false
  private active = false
  private onUndo: (() => void) | null = null
  private cancelProgress: (() => void) | null = null

  onAwake(): void {
    this.build()
    this.createEvent("OnStartEvent").bind(() => {
      this.interactable.onTriggerStart.add(() => this.trigger())
    })
    this.sceneObject.enabled = false
  }

  /** Show the chip for `seconds`; `onUndo` runs if the user pinches in time. */
  show(seconds: number, kindLabel: string, onUndo: () => void): void {
    if (!this.built) this.build()
    this.finishSilently() // collapse any pending chip first
    this.onUndo = onUndo
    this.active = true
    this.sceneObject.enabled = true
    this.label.text = "Undo " + kindLabel

    // Reset + deplete the progress line.
    this.setProgress(1)
    this.cancelProgress = animate({
      duration: seconds,
      easing: "linear",
      update: (t: number) => this.setProgress(1 - t),
      ended: () => {
        this.cancelProgress = null
        this.expire()
      },
    })
  }

  playTone(): void {
    if (this.sfx) {
      this.sfx.audioTrack = UNDO_TONE
      this.sfx.play(1)
    }
  }

  private trigger(): void {
    if (!this.active) return
    const cb = this.onUndo
    // Collapse state now, but DON'T disable the SceneObject synchronously inside
    // the onTriggerStart callback — SIK (and LEAF's synthetic trigger) still need
    // this interactable alive to fire onTriggerEnd. Hide it a frame later.
    if (this.cancelProgress) {
      this.cancelProgress()
      this.cancelProgress = null
    }
    this.active = false
    this.onUndo = null
    this.hideNextFrame()
    if (cb) cb()
  }

  private hideNextFrame(): void {
    const so = this.sceneObject
    const ev = this.createEvent("DelayedCallbackEvent")
    ev.bind(() => {
      so.enabled = false
    })
    ev.reset(0.15) // let the in-flight SIK trigger sequence finish first
  }

  private expire(): void {
    if (!this.active) return
    this.active = false
    this.onUndo = null
    this.fadeOutAndHide()
  }

  /** Collapse the current chip immediately without firing undo (e.g. a new action). */
  finishSilently(): void {
    if (this.cancelProgress) {
      this.cancelProgress()
      this.cancelProgress = null
    }
    this.active = false
    this.onUndo = null
    this.sceneObject.enabled = false
  }

  private fadeOutAndHide(): void {
    const so = this.sceneObject
    animate({
      duration: 0.2,
      easing: "ease-in-quad",
      update: () => {},
      ended: () => {
        so.enabled = false
      },
    })
  }

  private setProgress(f: number): void {
    const w = Math.max(0.001, BAR_W * MathUtils.clamp(f, 0, 1))
    this.progress.size = new vec2(w, 0.35)
    this.progress
      .getSceneObject()
      .getTransform()
      .setLocalPosition(new vec3(-BAR_W / 2 + w / 2, -CHIP_H / 2 + 0.55, CONTENT_Z + 0.05))
  }

  private build(): void {
    if (this.built) return
    const root = this.sceneObject

    const plateSO = global.scene.createSceneObject("UndoSurface")
    plateSO.setParent(root)
    this.surface = plateSO.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
    this.surface.size = new vec2(CHIP_W, CHIP_H)
    this.surface.cornerRadius = CHIP_H / 2
    this.surface.backgroundColor = new vec4(0.14, 0.155, 0.18, 0.92)
    this.surface.border = true
    this.surface.borderColor = new vec4(0.74, 0.76, 0.82, 0.9)
    this.surface.borderSize = 0.12
    if (!this.surface.initialized) this.surface.initialize()
    this.surface.renderMeshVisual.mainPass.depthTest = true

    const iconSO = global.scene.createSceneObject("UndoIcon")
    iconSO.setParent(root)
    iconSO.getTransform().setLocalPosition(new vec3(-CHIP_W / 2 + 2.0, 0.3, CONTENT_Z))
    iconSO.getTransform().setLocalScale(new vec3(1.9, 1.9, 1))
    const img = iconSO.createComponent("Component.Image") as Image
    const imat = IMAGE_MATERIAL.clone()
    imat.mainPass.baseTex = UNDO_ICON
    imat.mainPass.baseColor = new vec4(1, 1, 1, 0.9)
    imat.mainPass.depthTest = true
    imat.mainPass.depthWrite = false
    img.clearMaterials()
    img.addMaterial(imat)

    const textSO = global.scene.createSceneObject("UndoLabel")
    textSO.setParent(root)
    textSO.getTransform().setLocalPosition(new vec3(1.2, 0.3, CONTENT_Z))
    this.label = textSO.createComponent("Component.Text") as Text
    this.label.font = THEME_FONT
    this.label.size = 52
    this.label.text = "Undo"
    this.label.depthTest = true
    this.label.horizontalAlignment = HorizontalAlignment.Center
    this.label.verticalAlignment = VerticalAlignment.Center
    this.label.horizontalOverflow = HorizontalOverflow.Overflow
    this.label.verticalOverflow = VerticalOverflow.Overflow
    this.label.layoutRect = Rect.create(-6, 6, -1.4, 1.4)
    this.label.textFill.color = new vec4(1, 1, 1, 0.9)

    const barSO = global.scene.createSceneObject("UndoProgress")
    barSO.setParent(root)
    this.progress = barSO.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
    this.progress.size = new vec2(BAR_W, 0.35)
    this.progress.cornerRadius = 0.17
    this.progress.backgroundColor = new vec4(0.85, 0.87, 0.95, 0.95)
    this.progress.border = false
    if (!this.progress.initialized) this.progress.initialize()
    this.progress.renderMeshVisual.mainPass.depthTest = true

    // Collider + Interactable so a pinch reaches the chip.
    const collider = root.createComponent("Physics.ColliderComponent")
    const shape = Shape.createBoxShape()
    shape.size = new vec3(CHIP_W, CHIP_H, 2)
    collider.shape = shape
    this.interactable = root.createComponent(Interactable.getTypeName()) as Interactable
    this.interactable.targetingMode = 1

    this.sfx = root.createComponent("Component.AudioComponent") as AudioComponent
    this.sfx.volume = OrbitConfig.sfxVolume
    this.sfx.playbackMode = Audio.PlaybackMode.LowLatency

    this.setProgress(1)
    this.built = true
  }
}

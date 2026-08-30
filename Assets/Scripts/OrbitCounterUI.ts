/**
 * Orbit — OrbitCounterUI.
 *
 * The small "+N more" chip in the lower field of view. Head-anchored (its
 * SceneObject is parented under the camera by the bootstrap), static, no motion.
 * Shows how many messages are queued behind the 12 visible cards.
 *
 * Built from the same UIKit RoundedRectangle primitive as the cards for a
 * consistent surface treatment on the additive display.
 */

import { RoundedRectangle } from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"

const THEME_FONT = requireAsset("../Fonts/Inter.ttf") as Font

const CHIP_W = 9.5
const CHIP_H = 3.4
const CONTENT_Z = 0.4

@component
export class OrbitCounterUI extends BaseScriptComponent {
  @input
  @hint("Chip surface fill. Low luminance on the additive display; a black fill would be invisible.")
  @widget(new ColorWidget())
  surfaceFill: vec4 = new vec4(0.13, 0.145, 0.17, 0.9)

  @input
  @hint("Chip border colour — the bright edge that defines the chip against the world.")
  @widget(new ColorWidget())
  borderColor: vec4 = new vec4(0.72, 0.74, 0.8, 0.85)

  @input
  @hint("Text colour for the count label.")
  @widget(new ColorWidget())
  textColor: vec4 = new vec4(1, 1, 1, 0.85)

  private label!: Text
  private surface!: RoundedRectangle
  private built = false

  onAwake(): void {
    this.build()
  }

  /** Set the overflow count. n <= 0 hides the chip entirely. */
  setCount(n: number): void {
    if (!this.built) this.build()
    if (n <= 0) {
      this.sceneObject.enabled = false
      return
    }
    this.sceneObject.enabled = true
    this.label.text = "+" + n + " more"
  }

  private build(): void {
    if (this.built) return
    const root = this.sceneObject

    const plateSO = global.scene.createSceneObject("ChipSurface")
    plateSO.setParent(root)
    this.surface = plateSO.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
    this.surface.size = new vec2(CHIP_W, CHIP_H)
    this.surface.cornerRadius = CHIP_H / 2
    this.surface.backgroundColor = this.surfaceFill
    this.surface.border = true
    this.surface.borderColor = this.borderColor
    this.surface.borderSize = 0.12
    if (!this.surface.initialized) this.surface.initialize()
    this.surface.renderMeshVisual.mainPass.depthTest = true

    const textSO = global.scene.createSceneObject("ChipLabel")
    textSO.setParent(root)
    textSO.getTransform().setLocalPosition(new vec3(0, 0, CONTENT_Z))
    this.label = textSO.createComponent("Component.Text") as Text
    this.label.font = THEME_FONT
    this.label.size = 58
    this.label.text = "+0 more"
    this.label.depthTest = true
    this.label.horizontalAlignment = HorizontalAlignment.Center
    this.label.verticalAlignment = VerticalAlignment.Center
    this.label.horizontalOverflow = HorizontalOverflow.Overflow
    this.label.verticalOverflow = VerticalOverflow.Overflow
    this.label.layoutRect = Rect.create(-CHIP_W / 2, CHIP_W / 2, -CHIP_H / 2, CHIP_H / 2)
    this.label.textFill.color = this.textColor

    this.built = true
  }
}

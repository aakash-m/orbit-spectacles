/**
 * Orbit — OrbitEmptyStateUI.
 *
 * The calm completion state shown when every message has been triaged. Its
 * SceneObject is head-anchored (parented under the camera by the bootstrap),
 * roughly centred. A single mark and one line of text — no celebration, no
 * animation. Hidden until OrbitRing calls setVisible(true).
 */

import { RoundedRectangle } from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"

const THEME_FONT = requireAsset("../Fonts/Inter.ttf") as Font
const IMAGE_MATERIAL = requireAsset("../Materials/ImageMaterial.mat") as Material
const CHECK_ICON = requireAsset("../Icons/check_circle.png") as Texture

const CONTENT_Z = 0.4

@component
export class OrbitEmptyStateUI extends BaseScriptComponent {
  @input
  @hint("The single line shown under the mark.")
  message: string = "You're all caught up"

  @input
  @hint("Mark + text colour.")
  @widget(new ColorWidget())
  color: vec4 = new vec4(1, 1, 1, 0.82)

  private built = false

  onAwake(): void {
    this.build()
    this.sceneObject.enabled = false
  }

  setVisible(v: boolean): void {
    if (!this.built) this.build()
    this.sceneObject.enabled = v
  }

  private build(): void {
    if (this.built) return
    const root = this.sceneObject

    // Faint backing so the mark + text hold against a busy world.
    const plateSO = global.scene.createSceneObject("EmptyPlate")
    plateSO.setParent(root)
    const plate = plateSO.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
    plate.size = new vec2(26, 14)
    plate.cornerRadius = 1.6
    plate.backgroundColor = new vec4(0.13, 0.145, 0.17, 0.82)
    plate.border = true
    plate.borderColor = new vec4(0.7, 0.72, 0.78, 0.7)
    plate.borderSize = 0.13
    if (!plate.initialized) plate.initialize()
    plate.renderMeshVisual.mainPass.depthTest = true

    const iconSO = global.scene.createSceneObject("EmptyMark")
    iconSO.setParent(root)
    iconSO.getTransform().setLocalPosition(new vec3(0, 3.0, CONTENT_Z))
    iconSO.getTransform().setLocalScale(new vec3(4.5, 4.5, 1))
    const img = iconSO.createComponent("Component.Image") as Image
    const mat = IMAGE_MATERIAL.clone()
    mat.mainPass.baseTex = CHECK_ICON
    mat.mainPass.baseColor = this.color
    mat.mainPass.depthTest = true
    mat.mainPass.depthWrite = false
    img.clearMaterials()
    img.addMaterial(mat)

    const textSO = global.scene.createSceneObject("EmptyText")
    textSO.setParent(root)
    textSO.getTransform().setLocalPosition(new vec3(0, -3.0, CONTENT_Z))
    const t = textSO.createComponent("Component.Text") as Text
    t.font = THEME_FONT
    t.size = 62
    t.text = this.message
    t.depthTest = true
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-13, 13, -2, 2)
    t.textFill.color = this.color

    this.built = true
  }
}

/**
 * Orbit — LEAF test helpers (phase 4a). Not a component.
 */

import { findSceneObjectByName, findSceneObject, matchSceneObjectName, matchSceneObjectParentName } from "Leaf.lspkg/Utils/common/Utils"
import { OrbitRing } from "../Scripts/OrbitRing"
import { ReplyFlowController } from "../Scripts/ReplyFlowController"

/** The live OrbitRing component on the OrbitRig object. */
export function getRing(): OrbitRing {
  const rig = findSceneObjectByName("OrbitRig")
  if (!rig) throw new Error("OrbitRig not found")
  const ring = rig.getComponent(OrbitRing.getTypeName()) as OrbitRing
  if (!ring) throw new Error("OrbitRing component not found on OrbitRig")
  return ring
}

/** The live ReplyFlowController component. */
export function getReplyFlow(): ReplyFlowController {
  const o = findSceneObjectByName("ReplyFlow")
  if (!o) throw new Error("ReplyFlow object not found")
  const f = o.getComponent(ReplyFlowController.getTypeName()) as ReplyFlowController
  if (!f) throw new Error("ReplyFlowController component not found")
  return f
}

/** Text of a scene object's Text component. */
export function textOf(objName: string): string {
  const o = findSceneObjectByName(objName)
  if (!o) throw new Error(`object "${objName}" not found`)
  const t = o.getComponent("Component.Text") as Text
  if (!t) throw new Error(`no Text on "${objName}"`)
  return t.text
}

/** Text of a child named `childName` under a parent named `parentName`. */
export function childText(parentName: string, childName: string): string {
  const o = findSceneObject(
    (so) => matchSceneObjectName(childName)(so) && matchSceneObjectParentName(parentName)(so)
  )
  if (!o) throw new Error(`"${childName}" under "${parentName}" not found`)
  const t = o.getComponent("Component.Text") as Text
  if (!t) throw new Error(`no Text on "${childName}"`)
  return t.text
}

export function isEnabled(objName: string): boolean {
  const o = findSceneObjectByName(objName)
  return !!o && o.enabled
}

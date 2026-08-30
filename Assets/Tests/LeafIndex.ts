/**
 * Orbit — LEAF scenario index (phase 4a). Attached to a root "LeafIndex" object.
 */
import { scenariosIndex } from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import { ScenarioMetadata } from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"

import { S01_RingLoadsSorted } from "./S01_RingLoadsSorted"
import { S02_FlickRightArchives } from "./S02_FlickRightArchives"
import { S03_SlowDragSpringsBack } from "./S03_SlowDragSpringsBack"
import { S04_UndoRestoresPosition } from "./S04_UndoRestoresPosition"
import { S05_FlickDownOpensReply } from "./S05_FlickDownOpensReply"
import { S06_AiFailurePlaceholders } from "./S06_AiFailurePlaceholders"
import { S07_SendTwoStep } from "./S07_SendTwoStep"
import { S08_CancelLeavesUnchanged } from "./S08_CancelLeavesUnchanged"
import { S09_RefillNoGap } from "./S09_RefillNoGap"
import { S10_LazyFollowRecentre } from "./S10_LazyFollowRecentre"

@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    { id: "s01-ring-loads-sorted", typename: S01_RingLoadsSorted.getTypeName() },
    { id: "s02-flick-right-archives", typename: S02_FlickRightArchives.getTypeName() },
    { id: "s03-slow-drag-springs-back", typename: S03_SlowDragSpringsBack.getTypeName() },
    { id: "s04-undo-restores-position", typename: S04_UndoRestoresPosition.getTypeName() },
    { id: "s05-flick-down-opens-reply", typename: S05_FlickDownOpensReply.getTypeName() },
    { id: "s06-ai-failure-placeholders", typename: S06_AiFailurePlaceholders.getTypeName() },
    { id: "s07-send-two-step", typename: S07_SendTwoStep.getTypeName() },
    { id: "s08-cancel-leaves-unchanged", typename: S08_CancelLeavesUnchanged.getTypeName() },
    { id: "s09-refill-no-gap", typename: S09_RefillNoGap.getTypeName() },
    { id: "s10-lazy-follow-recentre", typename: S10_LazyFollowRecentre.getTypeName() },
  ]
}

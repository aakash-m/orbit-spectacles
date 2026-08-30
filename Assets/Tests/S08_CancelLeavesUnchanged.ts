/**
 * S08 — Cancelling a reply returns the card to the ring unchanged.
 */
import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario"
import { expect } from "Leaf.lspkg/Utils/common/Expect"
import { sleep } from "Leaf.lspkg/Utils/common/Utils"
import { MessageStore } from "../Scripts/MessageStore"
import { OrbitConfig } from "../Scripts/OrbitConfig"
import { OrbitLeafInteractor } from "./OrbitLeafInteractor"
import { isEnabled, getReplyFlow } from "./OrbitTestUtil"

@component
export class S08_CancelLeavesUnchanged extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    OrbitConfig.replyTestMode = true
    const interactor = new OrbitLeafInteractor()
    const flow = getReplyFlow()

    const beforeIds = MessageStore.getVisible().map((m) => m.id)
    const slot = 2
    const target = MessageStore.byId(beforeIds[slot])!

    await interactor.flickCard("Card_02", "down", true)
    await sleep(800)
    expect(isEnabled("ReplyPanel")).toBe(true)

    // Cancel at review (draft already shown thanks to replyTestMode).
    flow.testAction("cancel")
    await sleep(600)

    expect(isEnabled("ReplyPanel")).toBe(false)
    // Message untouched, ring identical.
    expect(MessageStore.triageStatus(target.id)).toBe("active")
    expect(MessageStore.getVisible().map((m) => m.id).join(",")).toBe(beforeIds.join(","))
  }
}

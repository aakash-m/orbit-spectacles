/**
 * S05 — Flicking down opens the reply panel containing the full message body.
 */
import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario"
import { expect } from "Leaf.lspkg/Utils/common/Expect"
import { sleep } from "Leaf.lspkg/Utils/common/Utils"
import { MessageStore } from "../Scripts/MessageStore"
import { OrbitConfig } from "../Scripts/OrbitConfig"
import { OrbitLeafInteractor } from "./OrbitLeafInteractor"
import { isEnabled, textOf, getReplyFlow } from "./OrbitTestUtil"

@component
export class S05_FlickDownOpensReply extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    OrbitConfig.replyTestMode = true
    const interactor = new OrbitLeafInteractor()

    const target = MessageStore.getVisible()[2]
    expect(target).toBeTruthy()
    expect(isEnabled("ReplyPanel")).toBe(false)

    await interactor.flickCard("Card_02", "down", true)
    await sleep(800)

    // Panel is open and shows the full body verbatim.
    expect(isEnabled("ReplyPanel")).toBe(true)
    expect(textOf("ReplyBody")).toBe(target.body)
    // The card was NOT triaged by opening a reply.
    expect(MessageStore.triageStatus(target.id)).toBe("active")

    // Cancel to leave the ring as we found it.
    getReplyFlow().testAction("cancel")
    await sleep(500)
    expect(isEnabled("ReplyPanel")).toBe(false)
  }
}

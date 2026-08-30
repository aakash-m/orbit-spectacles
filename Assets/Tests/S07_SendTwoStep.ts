/**
 * S07 — Send requires two presses within the 3-second confirm window; one press
 * does not send.
 */
import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario"
import { expect } from "Leaf.lspkg/Utils/common/Expect"
import { sleep } from "Leaf.lspkg/Utils/common/Utils"
import { MessageStore } from "../Scripts/MessageStore"
import { OrbitConfig } from "../Scripts/OrbitConfig"
import { OutboxStore } from "../Scripts/OutboxStore"
import { OrbitLeafInteractor } from "./OrbitLeafInteractor"
import { isEnabled, childText, getRing, getReplyFlow } from "./OrbitTestUtil"

@component
export class S07_SendTwoStep extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    OrbitConfig.replyTestMode = true
    const interactor = new OrbitLeafInteractor()
    const flow = getReplyFlow()

    const target = MessageStore.getVisible()[2]
    const outboxBefore = OutboxStore.count()

    await interactor.flickCard("Card_02", "down", true)
    await sleep(800) // replyTestMode: dictation + draft resolve fast → review
    expect(isEnabled("ReplyPanel")).toBe(true)
    expect(flow.testPhase()).toBe("review")

    // Press 1 → confirm state, nothing sent.
    flow.testAction("send")
    await sleep(200)
    expect(flow.testPhase()).toBe("confirm")
    expect(childText("ReplyBtn_Send", "Label")).toBe("Press again to send")
    expect(OutboxStore.count()).toBe(outboxBefore)

    // Wait out the confirm window (OrbitConfig.sendConfirmSeconds = 3): reverts,
    // still nothing sent — a lone press never sends.
    await sleep(3300)
    expect(flow.testPhase()).toBe("review")
    expect(OutboxStore.count()).toBe(outboxBefore)

    // Now two presses within the window → sent.
    flow.testAction("send")
    await sleep(150)
    expect(flow.testPhase()).toBe("confirm")
    flow.testAction("send")
    await sleep(300)
    expect(flow.testPhase()).toBe("sent")
    expect(OutboxStore.count()).toBe(outboxBefore + 1)
    expect(OutboxStore.getAll()[0].replyToId).toBe(target.id)

    // Sending archives the original + closes the panel; wait out the "sent" hold.
    await sleep(2200)
    expect(isEnabled("ReplyPanel")).toBe(false)

    // Cleanup: restore the archived original.
    MessageStore.restore(target.id)
    getRing().refill()
    await sleep(300)
  }
}

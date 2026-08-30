/**
 * S06 — With the AI service unavailable, all 12 cards still render and the ring
 * is fully usable on placeholder summaries + dataset urgency.
 *
 * NOTE: scenarios run against one already-initialised Lens, so OrbitAiService's
 * one-shot cache/AI pass has already happened. This scenario therefore verifies
 * the two things that make AI-failure safe: (a) the placeholder-summary fallback
 * that MessageStore.displaySummary() uses when a summary is missing, and (b) that
 * the ring stays full and interactive. OrbitConfig.aiEnabled is also flipped off
 * to match the "one config flag" the spec asks for.
 */
import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario"
import { expect } from "Leaf.lspkg/Utils/common/Expect"
import { sleep } from "Leaf.lspkg/Utils/common/Utils"
import { MessageStore, MAX_VISIBLE } from "../Scripts/MessageStore"
import { OrbitConfig } from "../Scripts/OrbitConfig"
import { placeholderSummary } from "../Scripts/OrbitTypes"
import { OrbitLeafInteractor } from "./OrbitLeafInteractor"
import { isEnabled, getRing } from "./OrbitTestUtil"

@component
export class S06_AiFailurePlaceholders extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    OrbitConfig.aiEnabled = false

    // Ring is full and every card renders.
    const activeCount = MessageStore.getAll().filter((m) => MessageStore.triageStatus(m.id) === "active").length
    const expectedVisible = Math.min(MAX_VISIBLE, activeCount)
    expect(MessageStore.getVisible().length).toBe(expectedVisible)
    for (let i = 0; i < expectedVisible; i++) {
      const name = "Card_" + (i < 10 ? "0" + i : "" + i)
      expect(isEnabled(name)).toBe(true)
    }

    // Placeholder fallback: when a summary is missing, the card still shows text.
    const m = MessageStore.getVisible()[6]
    const saved = m.summary
    MessageStore.updateState(m.id, { summary: "" })
    const shown = MessageStore.displaySummary(MessageStore.byId(m.id)!)
    expect(shown.length > 0).toBe(true)
    expect(shown).toBe(placeholderSummary(m.body))
    MessageStore.updateState(m.id, { summary: saved })

    // Ring is still interactive with no AI.
    const target = MessageStore.getVisible()[5]
    const interactor = new OrbitLeafInteractor()
    await interactor.flickCard("Card_05", "right", true)
    await sleep(400)
    expect(MessageStore.triageStatus(target.id)).toBe("archived")

    MessageStore.restore(target.id)
    getRing().refill()
    OrbitConfig.aiEnabled = true
    await sleep(300)
  }
}

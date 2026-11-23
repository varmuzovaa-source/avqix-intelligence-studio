import { describe, expect, it } from "vitest";
import { buildAdvicePlan, type Advice } from "@/lib/client-strategy";

const advice = (priority: Advice["priority"], title: string): Advice => ({
  priority,
  title,
  explanation: `Proč ${title}`,
  action: `Akce ${title}`,
  steps: [`Postup ${title}`],
  successMetric: `Měřítko ${title}`,
});

describe("buildAdvicePlan", () => {
  it("shows up to three urgent priorities and groups the rest by horizon", () => {
    const plan = buildAdvicePlan([
      advice("Vysoká", "Urgent 1"),
      advice("Vysoká", "Urgent 2"),
      advice("Vysoká", "Urgent 3"),
      advice("Vysoká", "Urgent 4"),
      advice("Střední", "Týden 1"),
      advice("Nízká", "Později 1"),
    ]);
    expect(plan.today.map((item) => item.title)).toEqual(["Urgent 1", "Urgent 2", "Urgent 3"]);
    expect(plan.thisWeek.map((item) => item.title)).toEqual(["Týden 1"]);
    expect(plan.later.map((item) => item.title)).toEqual(["Později 1"]);
  });

  it("keeps every horizon empty when there are no recommendations", () => {
    expect(buildAdvicePlan([])).toEqual({ today: [], thisWeek: [], later: [] });
  });
});

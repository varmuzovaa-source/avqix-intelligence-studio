import { afterEach, describe, expect, it, vi } from "vitest";
import { bridgeStore } from "@/lib/campaign-data";
import { liveAvailable, refreshFromFachman } from "@/lib/fachman-live";

afterEach(() => {
  vi.unstubAllGlobals();
  bridgeStore.clear();
});

describe("local Fachman connector", () => {
  it("detects whether the local-only endpoint is available", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("{}", { status: 200 }))
        .mockResolvedValueOnce(new Response("{}", { status: 404 })),
    );
    await expect(liveAvailable()).resolves.toBe(true);
    await expect(liveAvailable()).resolves.toBe(false);
  });

  it("loads both read-only account exports into the selected client", async () => {
    const files = [
      {
        name: "studio-google-ads-30d-2026-11-23.json",
        text: JSON.stringify([
          {
            campaign: {
              id: "g1",
              name: "Search",
              status: "ENABLED",
              advertisingChannelType: "SEARCH",
            },
            metrics: {
              costMicros: "2500000",
              clicks: "25",
              impressions: "100",
              conversions: 2,
              conversionsValue: 5000,
            },
            segments: { date: "2026-11-22" },
          },
        ]),
      },
      {
        name: "studio-meta-ads-30d-2026-11-23.json",
        text: JSON.stringify([
          {
            campaign_id: "m1",
            campaign_name: "Lead campaign",
            spend: "30",
            clicks: "10",
            impressions: "50",
            actions: [{ action_type: "lead", value: "1" }],
            date_start: "2026-11-22",
          },
        ]),
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ files }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const result = await refreshFromFachman("Studio", {
      slug: "studio",
      google: "123-456-7890",
      meta: "act_123456",
      days: 30,
    });

    expect(result.ok).toBe(true);
    expect(bridgeStore.get()["Studio"]?.map((set) => set.source)).toEqual([
      "google_ads",
      "meta_ads",
    ]);
    expect(bridgeStore.get()["Studio"]?.every((set) => set.fetchedAt)).toBe(true);
  });

  it("shows a useful local bridge error and does not replace current data", async () => {
    const original = {
      source: "google_ads" as const,
      fileName: "old.json",
      days: 30,
      campaigns: [],
      notes: [],
    };
    bridgeStore.set("Studio", original);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Fachman není nainstalovaný" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const result = await refreshFromFachman("Studio", {
      slug: "studio",
      google: "123-456-7890",
      days: 30,
    });

    expect(result).toEqual({ ok: false, error: "Fachman není nainstalovaný" });
    expect(bridgeStore.get()["Studio"]).toEqual([original]);
  });
});

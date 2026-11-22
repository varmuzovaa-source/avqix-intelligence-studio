import { afterEach, expect, it, vi } from "vitest";
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => ({})) }));
afterEach(() => {
  window.history.replaceState(null, "", "/");
  vi.resetModules();
});
it("does not reopen completed recovery when Settings is visited again", async () => {
  window.history.replaceState(null, "", "/nastaveni#type=recovery");
  const firstVisit = await import("@/lib/supabase");
  expect(firstVisit.passwordRecoveryRequested).toBe(true);
  firstVisit.completePasswordRecovery();
  const nextVisit = await import("@/lib/supabase");
  expect(nextVisit.passwordRecoveryRequested).toBe(false);
});

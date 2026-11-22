import { createClient } from "@supabase/supabase-js";
// Capture only the flow marker before the SDK consumes the URL fragment.
export let passwordRecoveryRequested =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery";
// Browser-safe publishable key; authorization is enforced by database RLS.
export const supabase = createClient(
  "https://ccwbyffhpljmmrnkakwu.supabase.co",
  "sb_publishable_Lxn20p0I5NsiAPnIPExDqA_rMG95ucE",
);

/** A completed recovery must not reopen when Settings mounts again. */
export function completePasswordRecovery() {
  passwordRecoveryRequested = false;
}

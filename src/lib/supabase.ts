import { createClient } from "@supabase/supabase-js";
// Browser-safe publishable key; authorization is enforced by database RLS.
export const supabase = createClient(
  "https://ccwbyffhpljmmrnkakwu.supabase.co",
  "sb_publishable_Lxn20p0I5NsiAPnIPExDqA_rMG95ucE",
);

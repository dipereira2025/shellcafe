import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export function getSupabase() {
  return createClientComponentClient();
}

import "server-only";
import { createClient } from "@supabase/supabase-js";

// Server-only Supabase client. It uses the SERVICE ROLE key, which bypasses
// Row Level Security and must NEVER reach the browser. The `server-only`
// import above makes the build fail if this module is ever imported into a
// Client Component.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing env var NEXT_PUBLIC_SUPABASE_URL");
}
if (!serviceRoleKey) {
  throw new Error("Missing env var SUPABASE_SERVICE_ROLE_KEY");
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

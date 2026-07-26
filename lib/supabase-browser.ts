import { createClient } from "@supabase/supabase-js";

// Browser Supabase client, used only to upload a source file straight to
// Storage via a one-time signed upload URL (the token authorizes the write, so
// the public publishable key is all that's needed here). Keeping large uploads
// off our API routes sidesteps the serverless request-body limit.
export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);

import { createClient } from "@supabase/supabase-js";

const STAGING_SUPABASE_URL = "https://zgkoofphhivesclehrom.supabase.co";
const STAGING_PUBLISHABLE_KEY = "sb_publishable_AL-huSxqksjQPUQsduo1zA_rF9x7NaM";

const supabase = createClient(STAGING_SUPABASE_URL, STAGING_PUBLISHABLE_KEY, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: false,
    persistSession: true
  }
});

globalThis.STORE_SALES_SESSION_REFRESHER = async () => {
  const { data, error } = await supabase.auth.getSession();
  const session = data?.session;
  if (error || !session?.access_token || !session.expires_at) return null;

  const { data: verified, error: verifyError } = await supabase.auth.getUser(session.access_token);
  if (verifyError || !verified?.user?.id) return null;

  return {
    sessionToken: session.access_token,
    audience: "nov_hub",
    expiresAt: new Date(session.expires_at * 1000).toISOString()
  };
};

import { createClient } from "@supabase/supabase-js";
import { clearNovHubSession } from "../../portal/js/nov-hub-session-candidate.js";

const STAGING_SUPABASE_URL = "https://zgkoofphhivesclehrom.supabase.co";
const STAGING_PUBLISHABLE_KEY = "sb_publishable_AL-huSxqksjQPUQsduo1zA_rF9x7NaM";
const FIXED_DESTINATION = "/store-sales/";
const authReturn = /(?:^|[?&#])(access_token|refresh_token|code|error|error_code)=/.test(`${location.search}${location.hash}`);
const authReturnFailed = /(?:^|[?&#])(error|error_code)=/.test(`${location.search}${location.hash}`);

// Supabase invite links can fall back to the configured Site URL instead of
// /auth/callback. Never let a previous NOV HUB actor survive that auth return.
if (authReturn) clearNovHubSession();

const supabase = createClient(STAGING_SUPABASE_URL, STAGING_PUBLISHABLE_KEY, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true
  }
});

globalThis.STORE_SALES_SESSION_REFRESHER = async () => {
  if (authReturnFailed) {
    await supabase.auth.signOut({ scope: "local" });
    history.replaceState({}, "", FIXED_DESTINATION);
    return null;
  }

  const { data, error } = await supabase.auth.getSession();
  const session = data?.session;
  if (authReturn) history.replaceState({}, "", FIXED_DESTINATION);
  if (error || !session?.access_token || !session.expires_at) return null;

  const { data: verified, error: verifyError } = await supabase.auth.getUser(session.access_token);
  if (verifyError || !verified?.user?.id) return null;

  return {
    sessionToken: session.access_token,
    audience: "nov_hub",
    expiresAt: new Date(session.expires_at * 1000).toISOString()
  };
};

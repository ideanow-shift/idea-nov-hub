import { createClient } from "@supabase/supabase-js";
import { setNovHubSession } from "../../portal/js/nov-hub-session-candidate.js";

const STAGING_SUPABASE_URL = "https://zgkoofphhivesclehrom.supabase.co";
const STAGING_PUBLISHABLE_KEY = "sb_publishable_AL-huSxqksjQPUQsduo1zA_rF9x7NaM";
const FIXED_DESTINATION = "/store-sales/";

const status = document.getElementById("auth-status");
const supabase = createClient(STAGING_SUPABASE_URL, STAGING_PUBLISHABLE_KEY, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true
  }
});

function fail(message) {
  history.replaceState({}, "", "/auth/callback");
  status.textContent = message;
  document.documentElement.dataset.authState = "failed";
}

try {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token || !data.session.expires_at) {
    fail("ログインリンクを確認できません。新しいMagic Linkを発行してください。");
  } else {
    const accepted = setNovHubSession({
      sessionToken: data.session.access_token,
      audience: "nov_hub",
      expiresAt: new Date(data.session.expires_at * 1000).toISOString()
    });
    if (!accepted) fail("セッションを開始できませんでした。新しいMagic Linkを発行してください。");
    else {
      history.replaceState({}, "", "/auth/callback");
      location.replace(FIXED_DESTINATION);
    }
  }
} catch {
  fail("セッションを開始できませんでした。新しいMagic Linkを発行してください。");
}

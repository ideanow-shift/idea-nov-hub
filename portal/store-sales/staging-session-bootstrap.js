import { setNovHubSession } from "../js/nov-hub-session-candidate.js";

const expiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
const actorRole = document.documentElement.dataset.stagingActor || "representative_director";
setNovHubSession({
  sessionToken: `stg-synthetic:${actorRole}:${Date.parse(expiry)}:synthetic-signature`,
  audience: "nov_hub",
  expiresAt: expiry
}, { persist: false });

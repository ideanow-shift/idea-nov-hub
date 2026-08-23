const COOKIE_SESSION_MARKER="server-managed-store-operations-session";
const HANDOFF_PATTERN=/^[A-Za-z0-9_-]{43}$/u;
let exchangeAttempt=null;
function capture(){const url=new URL(location.href);const params=new URLSearchParams(url.hash.startsWith("#")?url.hash.slice(1):"");const value={handoffCode:String(params.get("handoff_code")||""),state:String(params.get("state")||"")};if(url.hash){url.hash="";history.replaceState({},document.title,url.toString());}return value;}
const incoming=capture();
async function request(path,payload){const response=await fetch(path,{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});const body=await response.json().catch(()=>({}));return response.ok?body:null;}
async function establish(){const body=HANDOFF_PATTERN.test(incoming.handoffCode)?await request("/session/handoff/exchange",incoming):await request("/session/status",{});if(!body?.ok||!body.expiresAt||Date.parse(body.expiresAt)<=Date.now())return null;return {sessionToken:COOKIE_SESSION_MARKER,audience:"nov_hub",expiresAt:body.expiresAt};}
globalThis.STORE_SALES_SESSION_REFRESHER=()=>exchangeAttempt||(exchangeAttempt=establish().finally(()=>{exchangeAttempt=null;}));
if(location.pathname==="/auth/callback"){establish().then(session=>{if(session)location.replace("/store-sales/");else document.body.textContent="NOV HUBセッションを確認できません。NOV HUBから開き直してください。";});}

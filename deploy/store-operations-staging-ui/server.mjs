import {createReadStream} from "node:fs";
import {stat} from "node:fs/promises";
import {extname,join,normalize} from "node:path";
import {createServer} from "node:http";
import {fileURLToPath} from "node:url";
import {createHmac,createHash,randomBytes,timingSafeEqual} from "node:crypto";

const root=fileURLToPath(new URL("./dist/",import.meta.url));
const port=Number(process.env.PORT||8080);
const edgeUrl=process.env.STORE_OPERATIONS_STAGING_EDGE_URL||"https://zgkoofphhivesclehrom.supabase.co/functions/v1/nov-hub-api";
const exchangeSecret=String(process.env.STORE_OPERATIONS_HANDOFF_EXCHANGE_SECRET||"");
const cookieSigningSecret=String(process.env.STORE_OPERATIONS_HANDOFF_COOKIE_SIGNING_SECRET||"");
const launcherUrl=String(process.env.STORE_OPERATIONS_STAGING_HUB_LAUNCHER_URL||"");
const expectedRuntimeServiceAccount=String(process.env.STORE_OPERATIONS_EXPECTED_RUNTIME_SERVICE_ACCOUNT||"");
const sessionCookie="__Host-store_ops_session";
const startCookie="__Host-store_ops_handoff";
const targetOrigin="https://idea-nov-store-operations-staging-ui-787968950888.asia-northeast1.run.app";
const callbackPath="/auth/callback";
const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".svg":"image/svg+xml"};
const headers={"Content-Security-Policy":"default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY","Permissions-Policy":"camera=(), microphone=(), geolocation=()","Cache-Control":"no-store"};
const b64url=(value)=>Buffer.from(value).toString("base64url");
const pkce=(value)=>createHash("sha256").update(value).digest("base64url");
function json(res,status,body,extra={}){res.writeHead(status,{...headers,"Content-Type":"application/json; charset=utf-8",...extra});res.end(JSON.stringify(body));}
async function readJson(req,max=16384){let value="";for await(const chunk of req){value+=chunk;if(Buffer.byteLength(value)>max)throw Object.assign(new Error("REQUEST_TOO_LARGE"),{status:413});}try{return JSON.parse(value||"{}");}catch{throw Object.assign(new Error("INVALID_JSON"),{status:400});}}
function readCookie(req,name){for(const part of String(req.headers.cookie||"").split(";")){const [key,...rest]=part.trim().split("=");if(key===name)return decodeURIComponent(rest.join("="));}return "";}
function signStartState(value,secret){const body=b64url(JSON.stringify(value));return `${body}.${createHmac("sha256",secret).update(body).digest("base64url")}`;}
function verifyStartState(value,secret,now){const [body,signature,extra]=String(value||"").split(".");if(!body||!signature||extra)return null;const expected=createHmac("sha256",secret).update(body).digest();let supplied;try{supplied=Buffer.from(signature,"base64url");}catch{return null;}if(expected.length!==supplied.length||!timingSafeEqual(expected,supplied))return null;try{const parsed=JSON.parse(Buffer.from(body,"base64url").toString("utf8"));return parsed.expiresAt>now?parsed:null;}catch{return null;}}
async function metadata(path,request){const response=await request(`http://metadata.google.internal/computeMetadata/v1/${path}`,{headers:{"Metadata-Flavor":"Google"},cache:"no-store"});if(!response.ok)throw Object.assign(new Error("CLOUD_RUN_IDENTITY_UNAVAILABLE"),{status:503});return String(await response.text()).trim();}
async function cloudRunIdentity(request,audience,expectedEmail){const email=await metadata("instance/service-accounts/default/email",request);if(!expectedEmail||email.toLowerCase()!==expectedEmail.toLowerCase())throw Object.assign(new Error("CLOUD_RUN_IDENTITY_MISMATCH"),{status:503});const token=await metadata(`instance/service-accounts/default/identity?audience=${encodeURIComponent(audience)}&format=full`,request);if(token.split(".").length!==3)throw Object.assign(new Error("CLOUD_RUN_IDENTITY_UNAVAILABLE"),{status:503});return token;}
async function edge(action,payload,{token="",secret="",identity="",request=fetch,url=edgeUrl}={}){const response=await request(url,{method:"POST",cache:"no-store",headers:{"content-type":"application/json",...(token?{authorization:`Bearer ${token}`} :{}),...(secret?{"x-store-operations-exchange-secret":secret}:{}),...(identity?{"x-cloud-run-identity":`Bearer ${identity}`}:{})},body:JSON.stringify({action,payload})});return {status:response.status,body:await response.json().catch(()=>({ok:false,code:"INVALID_EDGE_RESPONSE"}))};}

export function createStoreOperationsStagingServer(options={}){
  const request=options.edgeFetch||fetch;
  const metadataFetch=options.metadataFetch||fetch;
  const boundarySecret=options.exchangeSecret??exchangeSecret;
  const signingSecret=options.cookieSigningSecret??cookieSigningSecret;
  const hubLauncher=options.launcherUrl??launcherUrl;
  const runtimeServiceAccount=options.expectedRuntimeServiceAccount??expectedRuntimeServiceAccount;
  const runtimeEdgeUrl=options.edgeUrl||edgeUrl;
  const now=options.now||Date.now;
  return createServer(async(req,res)=>{try{
    const url=new URL(req.url||"/","https://staging.invalid");const pathname=url.pathname;
    if(pathname==="/ready"&&req.method==="GET")return json(res,200,{ok:true});
    if(pathname==="/auth/start"){
      if(req.method!=="GET")return json(res,405,{ok:false,code:"METHOD_NOT_ALLOWED"});
      if(signingSecret.length<32||!hubLauncher.startsWith("https://"))return json(res,503,{ok:false,code:"HANDOFF_START_UNAVAILABLE"});
      const state=b64url(randomBytes(24));const verifier=b64url(randomBytes(32));const expiresAt=now()+120000;
      const launch=new URL(hubLauncher);launch.searchParams.set("store_operations_state",state);launch.searchParams.set("code_challenge",pkce(verifier));launch.searchParams.set("code_challenge_method","S256");launch.searchParams.set("callback_path",callbackPath);
      res.writeHead(302,{...headers,Location:launch.toString(),"Set-Cookie":`${startCookie}=${encodeURIComponent(signStartState({state,verifier,expiresAt},signingSecret))}; Path=/; Max-Age=120; Secure; HttpOnly; SameSite=Lax`});return res.end();
    }
    if(pathname==="/session/handoff/exchange"){
      if(req.method!=="POST")return json(res,405,{ok:false,code:"METHOD_NOT_ALLOWED"});
      if(boundarySecret.length<32||signingSecret.length<32)return json(res,503,{ok:false,code:"EXCHANGE_BOUNDARY_UNAVAILABLE"});
      const start=verifyStartState(readCookie(req,startCookie),signingSecret,now());if(!start)return json(res,401,{ok:false,code:"HANDOFF_STATE_REQUIRED"},{"Set-Cookie":`${startCookie}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax`});
      const payload=await readJson(req,4096);if(Object.keys(payload).some(key=>!["handoffCode","state"].includes(key))||payload.state!==start.state)return json(res,401,{ok:false,code:"HANDOFF_STATE_MISMATCH"});
      const identity=await cloudRunIdentity(metadataFetch,runtimeEdgeUrl,runtimeServiceAccount);
      const result=await edge("storeOperationsHandoffExchangeV1",{handoffCode:String(payload.handoffCode||""),state:String(payload.state||""),codeVerifier:start.verifier,origin:targetOrigin},{secret:boundarySecret,identity,request,url:runtimeEdgeUrl});const session=result.body?.session;
      const clearStart=`${startCookie}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax`;
      if(result.status!==200||!session?.sessionToken)return json(res,result.status,result.body,{"Set-Cookie":clearStart});
      const maxAge=Math.max(0,Math.min(900,Math.floor((Date.parse(session.expiresAt)-now())/1000)));
      res.writeHead(200,{...headers,"Content-Type":"application/json; charset=utf-8","Set-Cookie":[clearStart,`${sessionCookie}=${encodeURIComponent(session.sessionToken)}; Path=/; Max-Age=${maxAge}; Secure; HttpOnly; SameSite=Lax`]});return res.end(JSON.stringify({ok:true,expiresAt:session.expiresAt}));
    }
    if(pathname==="/session/status"){
      if(req.method!=="POST")return json(res,405,{ok:false,code:"METHOD_NOT_ALLOWED"});const token=readCookie(req,sessionCookie);if(!token)return json(res,401,{ok:false,code:"HUB_AUTH_REQUIRED"});
      const result=await edge("storeOperationsSessionStatusV1",{authType:"store_operations_staging_session"},{token,request,url:runtimeEdgeUrl});return json(res,result.status,result.status===200?{ok:true,expiresAt:result.body?.session?.expiresAt}:result.body);
    }
    if(pathname==="/api/store-operations"){
      if(req.method!=="POST")return json(res,405,{ok:false,code:"METHOD_NOT_ALLOWED"});const token=readCookie(req,sessionCookie);if(!token)return json(res,401,{ok:false,code:"HUB_AUTH_REQUIRED"});
      const input=await readJson(req);const action=String(input.action||"");const payload=input.payload&&typeof input.payload==="object"?input.payload:{};if(action!=="storeMonthlyActualProjectionV1")return json(res,403,{ok:false,code:"ACCESS_DENIED"});
      const safePayload={selectedMonth:String(payload.selectedMonth||""),authType:"store_operations_staging_session",responseProfile:String(payload.responseProfile||"")};const result=await edge(action,safePayload,{token,request,url:runtimeEdgeUrl});return json(res,result.status,result.body);
    }
    if(req.method!=="GET"&&req.method!=="HEAD")return json(res,405,{ok:false,code:"METHOD_NOT_ALLOWED"});if(pathname==="/"){res.writeHead(302,{...headers,Location:"/auth/start"});return res.end();}
    const relative=normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/u,"");let file=join(root,relative);if(pathname.endsWith("/")||pathname===callbackPath)file=join(file,"index.html");if(!file.startsWith(root))return json(res,404,{ok:false,code:"NOT_FOUND"});
    try{if(!(await stat(file)).isFile())throw new Error("NOT_FILE");res.writeHead(200,{...headers,"Content-Type":types[extname(file)]||"application/octet-stream"});if(req.method==="HEAD")return res.end();createReadStream(file).pipe(res);}catch{return json(res,404,{ok:false,code:"NOT_FOUND"});}
  }catch(error){return json(res,Number(error.status||500),{ok:false,code:String(error.message||"INTERNAL_ERROR")});}});
}
if(process.env.NODE_ENV!=="test")createStoreOperationsStagingServer().listen(port,"0.0.0.0");

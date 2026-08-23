import {createReadStream} from "node:fs";
import {stat} from "node:fs/promises";
import {extname,join,normalize} from "node:path";
import {createServer} from "node:http";
import {fileURLToPath} from "node:url";
const root=fileURLToPath(new URL("./dist/",import.meta.url));
const port=Number(process.env.PORT||8080);
const edgeUrl=process.env.STORE_OPERATIONS_STAGING_EDGE_URL||"https://zgkoofphhivesclehrom.supabase.co/functions/v1/nov-hub-api";
const exchangeSecret=String(process.env.STORE_OPERATIONS_HANDOFF_EXCHANGE_SECRET||"");
const cookieName="__Host-store_ops_session";
const targetOrigin="https://idea-nov-store-operations-staging-ui-787968950888.asia-northeast1.run.app";
const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".svg":"image/svg+xml"};
const headers={"Content-Security-Policy":"default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY","Permissions-Policy":"camera=(), microphone=(), geolocation=()","Cache-Control":"no-store"};
function json(res,status,body,extra={}){res.writeHead(status,{...headers,"Content-Type":"application/json; charset=utf-8",...extra});res.end(JSON.stringify(body));}
async function readJson(req,max=16384){let value="";for await(const chunk of req){value+=chunk;if(Buffer.byteLength(value)>max)throw Object.assign(new Error("REQUEST_TOO_LARGE"),{status:413});}try{return JSON.parse(value||"{}");}catch{throw Object.assign(new Error("INVALID_JSON"),{status:400});}}
function cookie(req){for(const part of String(req.headers.cookie||"").split(";")){const [name,...rest]=part.trim().split("=");if(name===cookieName)return decodeURIComponent(rest.join("="));}return "";}
async function edge(action,payload,token="",secret="",request=fetch,url=edgeUrl){const response=await request(url,{method:"POST",cache:"no-store",headers:{"content-type":"application/json",...(token?{authorization:`Bearer ${token}`}:{}),...(secret?{"x-store-operations-exchange-secret":secret}:{})},body:JSON.stringify({action,payload})});return {status:response.status,body:await response.json().catch(()=>({ok:false,code:"INVALID_EDGE_RESPONSE"}))};}
export function createStoreOperationsStagingServer(options={}){const request=options.edgeFetch||fetch;const boundarySecret=options.exchangeSecret??exchangeSecret;const runtimeEdgeUrl=options.edgeUrl||edgeUrl;return createServer(async(req,res)=>{try{
  const url=new URL(req.url||"/","https://staging.invalid");const pathname=url.pathname;
  if(pathname==="/ready"&&req.method==="GET")return json(res,200,{ok:true});
  if(pathname==="/session/handoff/exchange"){
    if(req.method!=="POST")return json(res,405,{ok:false,code:"METHOD_NOT_ALLOWED"});
    if(boundarySecret.length<32)return json(res,503,{ok:false,code:"EXCHANGE_BOUNDARY_UNAVAILABLE"});
    const payload=await readJson(req,4096);if(Object.keys(payload).some(key=>!["handoffCode","state"].includes(key)))return json(res,400,{ok:false,code:"INVALID_REQUEST"});
    const result=await edge("storeOperationsHandoffExchangeV1",{handoffCode:String(payload.handoffCode||""),state:String(payload.state||""),origin:targetOrigin},"",boundarySecret,request,runtimeEdgeUrl);const session=result.body?.session;
    if(result.status!==200||!session?.sessionToken)return json(res,result.status,result.body);
    const maxAge=Math.max(0,Math.min(900,Math.floor((Date.parse(session.expiresAt)-Date.now())/1000)));
    return json(res,200,{ok:true,expiresAt:session.expiresAt},{"Set-Cookie":`${cookieName}=${encodeURIComponent(session.sessionToken)}; Path=/; Max-Age=${maxAge}; Secure; HttpOnly; SameSite=Lax`});
  }
  if(pathname==="/session/status"){
    if(req.method!=="POST")return json(res,405,{ok:false,code:"METHOD_NOT_ALLOWED"});const token=cookie(req);if(!token)return json(res,401,{ok:false,code:"HUB_AUTH_REQUIRED"});
    const result=await edge("storeOperationsSessionStatusV1",{authType:"store_operations_staging_session"},token,"",request,runtimeEdgeUrl);return json(res,result.status,result.status===200?{ok:true,expiresAt:result.body?.session?.expiresAt}:result.body);
  }
  if(pathname==="/api/store-operations"){
    if(req.method!=="POST")return json(res,405,{ok:false,code:"METHOD_NOT_ALLOWED"});const token=cookie(req);if(!token)return json(res,401,{ok:false,code:"HUB_AUTH_REQUIRED"});
    const input=await readJson(req);const action=String(input.action||"");const payload=input.payload&&typeof input.payload==="object"?input.payload:{};if(action!=="storeMonthlyActualProjectionV1")return json(res,403,{ok:false,code:"ACCESS_DENIED"});
    const safePayload={selectedMonth:String(payload.selectedMonth||""),authType:"store_operations_staging_session",responseProfile:String(payload.responseProfile||"")};const result=await edge(action,safePayload,token,"",request,runtimeEdgeUrl);return json(res,result.status,result.body);
  }
  if(req.method!=="GET"&&req.method!=="HEAD")return json(res,405,{ok:false,code:"METHOD_NOT_ALLOWED"});if(pathname==="/"){res.writeHead(302,{...headers,Location:"/store-sales/"});return res.end();}
  const relative=normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/u,"");let file=join(root,relative);if(pathname.endsWith("/"))file=join(file,"index.html");if(!file.startsWith(root))return json(res,404,{ok:false,code:"NOT_FOUND"});
  try{if(!(await stat(file)).isFile())throw new Error("NOT_FILE");res.writeHead(200,{...headers,"Content-Type":types[extname(file)]||"application/octet-stream"});if(req.method==="HEAD")return res.end();createReadStream(file).pipe(res);}catch{return json(res,404,{ok:false,code:"NOT_FOUND"});}
}catch(error){return json(res,Number(error.status||500),{ok:false,code:String(error.message||"INTERNAL_ERROR")});}});}
if(process.env.NODE_ENV!=="test")createStoreOperationsStagingServer().listen(port,"0.0.0.0");

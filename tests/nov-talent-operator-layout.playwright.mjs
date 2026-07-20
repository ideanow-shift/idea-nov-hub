import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,isAbsolute,join,relative,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const packageDir=process.env.PLAYWRIGHT_PACKAGE_DIR;
assert.ok(packageDir,'PLAYWRIGHT_PACKAGE_DIR is required');
const {chromium}=await import(pathToFileURL(join(packageDir,'index.mjs')).href);
const root=fileURLToPath(new URL('../portal/',import.meta.url));
const requiredAssets=new Set([
  '/talent/index.html',
  '/talent/app.mjs',
  '/talent/operator.mjs',
  '/talent/exact1.mjs',
  '/talent/runtime-config.candidate.js',
  '/talent/style.css',
  '/js/nov-hub-session-candidate.js'
]);
const observedAssets=new Set();
let requiredAsset404Count=0;

const productionHtml=await readFile(resolve(root,'talent/index.html'),'utf8');
const appScriptPattern=/<script\s+type=["']module["']\s+src=["']\.\/app\.mjs(?:\?[^"']*)?["']><\/script>/g;
assert.equal(productionHtml.match(appScriptPattern)?.length,1,'production app module script must be exact1');
const fixtureHtml=productionHtml.replace(
  appScriptPattern,
  '<script type="module" src="/__fixture__/bootstrap.mjs"></script>'
);
const fixtureBootstrap=`
import {setNovHubSessionMemoryProvider} from '/js/nov-hub-session-candidate.js';

window.__writeRequests=0;
window.__readRequests=0;
window.__tokenCalls=0;
const session=Object.freeze({
  sessionToken:'fixture-only-session-value',
  audience:'nov_hub',
  expiresAt:new Date(Date.now()+60_000).toISOString()
});
setNovHubSessionMemoryProvider(()=>{
  window.__tokenCalls+=1;
  return session;
});
const descriptor=Object.getOwnPropertyDescriptor(window,'NovHubSession');
window.__helperDescriptorExact=descriptor?.configurable===false
  &&descriptor?.enumerable===false
  &&descriptor?.writable===false
  &&Object.isFrozen(descriptor?.value);
if(!window.__helperDescriptorExact)throw new Error('fixture_helper_contract_mismatch');
window.fetch=async(_input,init={})=>{
  const method=String(init.method||'GET').toUpperCase();
  if(method==='POST')window.__writeRequests+=1;
  else window.__readRequests+=1;
  return new Response(JSON.stringify({ok:true,data:{applicationNo:'NT-2026-000001',accepted:true}}),{
    status:200,
    headers:{'content-type':'application/json'}
  });
};
await import('/talent/app.mjs');
`;

const server=createServer(async(req,res)=>{
  let requestUrl='/';
  try{
    requestUrl=decodeURIComponent((req.url||'/').split('?')[0]);
    if(requestUrl==='/__fixture__/bootstrap.mjs'){
      res.writeHead(200,{'content-type':'text/javascript; charset=utf-8'});
      res.end(fixtureBootstrap);
      return;
    }
    const requestPath=requestUrl.replace(/^\/+/, '')||'talent/index.html';
    const path=resolve(root,requestPath);
    const scoped=relative(root,path);
    if(scoped.startsWith('..')||isAbsolute(scoped)){
      res.writeHead(404).end();
      return;
    }
    const body=requestUrl==='/talent/index.html'?fixtureHtml:await readFile(path);
    if(requiredAssets.has(requestUrl))observedAssets.add(requestUrl);
    const type={
      '.html':'text/html; charset=utf-8',
      '.js':'text/javascript; charset=utf-8',
      '.mjs':'text/javascript; charset=utf-8',
      '.css':'text/css; charset=utf-8'
    }[extname(path)]||'application/octet-stream';
    res.writeHead(200,{'content-type':type});
    res.end(body);
  }catch{
    if(requiredAssets.has(requestUrl))requiredAsset404Count+=1;
    res.writeHead(404).end();
  }
});

await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const localOrigin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  for(const viewport of [
    {name:'desktop',width:1440,height:900},
    {name:'mobile',width:390,height:844}
  ]){
    const page=await browser.newPage({viewport});
    let externalRequestCount=0;
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.origin===localOrigin)await route.continue();
      else{
        externalRequestCount+=1;
        await route.abort();
      }
    });
    let confirmations=0;
    page.on('dialog',async dialog=>{
      confirmations+=1;
      if(viewport.name==='desktop')await dialog.accept();
      else await dialog.dismiss();
    });
    await page.goto(`${localOrigin}/talent/index.html`);
    const startup=await page.evaluate(()=>({
      readRequests:window.__readRequests,
      writeRequests:window.__writeRequests,
      tokenCalls:window.__tokenCalls,
      helperDescriptorExact:window.__helperDescriptorExact
    }));
    assert.deepEqual(startup,{
      readRequests:0,
      writeRequests:0,
      tokenCalls:0,
      helperDescriptorExact:true
    });
    await page.fill('#operator-event-at','2026-07-20T10:00');
    await page.click('#operator-create-event');
    const state=await page.evaluate(()=>{
      const panel=document.getElementById('talent-operator-panel');
      const coverage=document.querySelector('.coverage-label');
      const status=document.getElementById('operator-status');
      const controls=[...panel.querySelectorAll('input,select,button,[role="status"]')]
        .filter(element=>{
          const rect=element.getBoundingClientRect();
          return rect.width>0&&rect.height>0;
        });
      let overlapCount=0;
      for(let index=0;index<controls.length;index+=1){
        const left=controls[index].getBoundingClientRect();
        for(let other=index+1;other<controls.length;other+=1){
          const right=controls[other].getBoundingClientRect();
          const overlaps=Math.min(left.right,right.right)>Math.max(left.left,right.left)
            &&Math.min(left.bottom,right.bottom)>Math.max(left.top,right.top);
          if(overlaps)overlapCount+=1;
        }
      }
      return{
        coverageVisible:coverage?.getBoundingClientRect().height>0,
        panelVisible:panel?.getBoundingClientRect().height>0,
        body:[document.body.scrollWidth,document.body.clientWidth],
        panel:[panel.scrollWidth,panel.clientWidth],
        overlapCount,
        readRequests:window.__readRequests,
        writeRequests:window.__writeRequests,
        tokenCalls:window.__tokenCalls,
        statusCategory:status?.dataset.category,
        syntheticTokenRendered:document.body.innerText.includes('fixture-only-session-value')
      };
    });
    assert.equal(state.coverageVisible,true);
    assert.equal(state.panelVisible,true);
    assert.equal(confirmations,1);
    assert.equal(state.readRequests,0);
    assert.equal(state.writeRequests,viewport.name==='desktop'?1:0);
    assert.equal(state.tokenCalls,viewport.name==='desktop'?1:0);
    assert.equal(state.statusCategory,viewport.name==='desktop'?'recorded':'confirmation_required');
    assert.equal(state.overlapCount,0);
    assert.equal(state.syntheticTokenRendered,false);
    assert.equal(externalRequestCount,0);
    assert.ok(state.body[0]<=state.body[1]);
    assert.ok(state.panel[0]<=state.panel[1]);
    await page.close();
  }
  assert.equal(requiredAsset404Count,0);
  assert.deepEqual([...observedAssets].sort(),[...requiredAssets].sort());
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
console.log('playwright_layout: 2/2_PASS');

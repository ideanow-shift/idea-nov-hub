import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,join,normalize} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const packageDir=process.env.PLAYWRIGHT_PACKAGE_DIR;
assert.ok(packageDir,'PLAYWRIGHT_PACKAGE_DIR is required');
const {chromium}=await import(pathToFileURL(join(packageDir,'index.mjs')).href);
const root=fileURLToPath(new URL('../portal/talent/',import.meta.url));
const server=createServer(async(req,res)=>{try{const relative=(req.url||'/').split('?')[0].replace(/^\/+/, '')||'index.html';const path=normalize(join(root,relative));if(!path.startsWith(normalize(root))){res.writeHead(404).end();return;}const body=await readFile(path);const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'}[extname(path)]||'application/octet-stream';res.writeHead(200,{'content-type':type});res.end(body);}catch{res.writeHead(404).end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{for(const viewport of [{name:'desktop',width:1440,height:900},{name:'mobile',width:390,height:844}]){const page=await browser.newPage({viewport});await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);await page.evaluate(()=>{document.getElementById('talent-operator-panel').hidden=false;});const state=await page.evaluate(()=>{const panel=document.getElementById('talent-operator-panel'),coverage=document.querySelector('.coverage-label');return{coverageVisible:coverage?.getBoundingClientRect().height>0,panelVisible:panel?.getBoundingClientRect().height>0,body:[document.body.scrollWidth,document.body.clientWidth],panel:[panel.scrollWidth,panel.clientWidth]};});assert.equal(state.coverageVisible,true);assert.equal(state.panelVisible,true);assert.ok(state.body[0]<=state.body[1]);assert.ok(state.panel[0]<=state.panel[1]);await page.close();}}
finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
console.log('playwright_layout: 2/2_PASS');

import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageDir = process.env.PLAYWRIGHT_PACKAGE_DIR;
assert.ok(packageDir, "PLAYWRIGHT_PACKAGE_DIR is required");
const { chromium } = await import(pathToFileURL(join(packageDir, "index.mjs")).href);
const root = fileURLToPath(new URL("../portal/", import.meta.url));
const productionHtml = await readFile(resolve(root, "talent/index.html"), "utf8");
const fixtureHtml = productionHtml.replace(/<script\s+type="module"\s+src="\.\/app\.mjs\?[^"]+"><\/script>/u,
  '<script type="module" src="/__fixture__/outcome2.mjs"></script>');
const fixture = `
import {createCandidateActivityConfirmationController} from '/talent/candidate-activity-confirmation.mjs';
import {buildDailyWorkflowQueue} from '/talent/daily-workflow.mjs';
window.__confirmEvents=0; window.__postRequests=0;
const dialog=document.getElementById('candidate-activity-dialog');
document.getElementById('student-detail').hidden=false;
document.body.append(document.querySelector('[aria-labelledby="daily-workflow-queue-title"]'));
document.getElementById('activity-entity-type').value='EVENT';
const code=document.getElementById('activity-code'); code.replaceChildren(Object.assign(document.createElement('option'),{value:'COMMUNICATION_RECORDED',textContent:'連絡記録'}));
document.getElementById('activity-communication-fields').hidden=false;
document.getElementById('activity-communication-at').value='2026-08-09T10:30';
document.getElementById('activity-communication-method').value='LINE';
document.getElementById('activity-communication-direction').value='OUTBOUND';
document.getElementById('activity-communication-result').value='REACHED';
document.getElementById('activity-content').value='日程を案内';
document.getElementById('activity-reason').value='確認済みの連絡事実を記録';
dialog.showModal();
const save=document.getElementById('candidate-activity-save');
const controller=createCandidateActivityConfirmationController({documentObject:document,onConfirm:async()=>{window.__confirmEvents+=1;return false;}});
document.getElementById('candidate-activity-form').addEventListener('submit',event=>{event.preventDefault();controller.open({candidateName:'検証学生',eventLabel:'連絡記録（LINE・こちらから・連絡済み）',date:'2026-08-09 10:30',reason:document.getElementById('activity-reason').value,command:{fixture:true},focusTarget:save});});
const data={sourceCoverageState:'COMPLETE',nextActions:[
 {id:'1',candidateId:'c1',state:'OPEN',dueDate:'2026-08-08',text:'期限超過対応',assignedTo:'採用担当'},
 {id:'2',candidateId:'c2',state:'OPEN',dueDate:'2026-08-09',text:'今日の対応',assignedTo:'採用担当'},
 {id:'3',candidateId:'c3',state:'ON_HOLD',dueDate:'2026-08-08',text:'確認待ち',assignedTo:'採用担当'},
 {id:'4',candidateId:'c4',state:'COMPLETED',dueDate:'2026-08-07',text:'完了済み',assignedTo:'採用担当'}]};
const queue=buildDailyWorkflowQueue(data,'2026-08-09');
const list=document.getElementById('daily-workflow-queue-list');
const render=(filter='ALL')=>{const rows=queue.rows.filter(r=>filter==='ALL'?r.category!=='CLOSED':r.category===filter);list.replaceChildren(...rows.map(r=>Object.assign(document.createElement('li'),{textContent:r.category+'・'+r.text})));document.getElementById('daily-workflow-queue-status').textContent=rows.length+'件';};
document.getElementById('daily-workflow-filter').addEventListener('change',e=>render(e.target.value)); render();
`;
const server=createServer(async(request,response)=>{try{const url=decodeURIComponent((request.url||'/').split('?')[0]);if(url==='/__fixture__/outcome2.mjs'){response.writeHead(200,{'content-type':'text/javascript; charset=utf-8'});response.end(fixture);return;}const requestPath=url.replace(/^\/+/, '')||'talent/index.html';const file=resolve(root,requestPath);const scoped=relative(root,file);if(scoped.startsWith('..')||isAbsolute(scoped))return response.writeHead(404).end();const body=url==='/talent/index.html'?fixtureHtml:await readFile(file);const type={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'}[extname(file)]||'application/octet-stream';response.writeHead(200,{'content-type':type});response.end(body);}catch{response.writeHead(404).end();}});
await new Promise(resolveServer=>server.listen(0,'127.0.0.1',resolveServer));
const origin=`http://127.0.0.1:${server.address().port}`; const browser=await chromium.launch({channel:'chrome',headless:true});
try{for(const viewport of [{name:'pc',width:1280,height:900},{name:'mobile',width:390,height:844}]){
 const page=await browser.newPage({viewport});const errors=[],warnings=[];page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
 await page.goto(origin+'/talent/index.html');
 assert.equal(await page.locator('#activity-communication-fields').isVisible(),true);
 await page.evaluate(()=>document.getElementById('candidate-activity-dialog').close());
 assert.equal(await page.locator('#daily-workflow-queue-list > li').count(),3);
 await page.selectOption('#daily-workflow-filter','OVERDUE'); assert.equal(await page.locator('#daily-workflow-queue-list > li').count(),1);
 await page.selectOption('#daily-workflow-filter','ON_HOLD'); assert.equal(await page.locator('#daily-workflow-queue-list > li').count(),1);
 await page.selectOption('#daily-workflow-filter','CLOSED'); assert.equal(await page.locator('#daily-workflow-queue-list > li').count(),1);
 await page.evaluate(()=>document.getElementById('candidate-activity-dialog').showModal());
 await page.click('#candidate-activity-save');await page.waitForSelector('#candidate-activity-confirm-dialog[open]');
 const first=await page.evaluate(()=>{const d=document.getElementById('candidate-activity-confirm-dialog'),r=d.getBoundingClientRect();return{candidate:document.getElementById('candidate-activity-confirm-candidate').textContent,event:document.getElementById('candidate-activity-confirm-event').textContent,focus:document.activeElement?.id,noOverflow:d.scrollWidth<=d.clientWidth&&r.left>=0&&r.right<=innerWidth};});
 assert.equal(first.candidate,'検証学生');assert.match(first.event,/LINE/u);assert.equal(first.focus,'candidate-activity-confirm-execute');assert.equal(first.noOverflow,true);
 await page.click('#candidate-activity-confirm-cancel');assert.equal(await page.locator('#candidate-activity-confirm-dialog').getAttribute('open'),null);
 await page.click('#candidate-activity-save');await page.waitForSelector('#candidate-activity-confirm-dialog[open]');await page.dblclick('#candidate-activity-confirm-execute');await page.waitForTimeout(30);
 assert.equal(await page.evaluate(()=>window.__confirmEvents),1);assert.equal(await page.evaluate(()=>window.__postRequests),0);assert.deepEqual(errors,[]);assert.deepEqual(warnings,[]);await page.close();
}}finally{await browser.close();await new Promise(resolveServer=>server.close(resolveServer));}
console.log('outcome2_daily_workflow: 2/2_PASS');

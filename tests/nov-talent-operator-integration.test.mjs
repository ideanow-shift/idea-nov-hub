import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createTalentOperatorController} from '../portal/talent/operator.mjs';

const baseConfig={writeApiEnabled:true,writeApiBaseUrl:'https://local.invalid/functions/v1/nov-talent-write-api'};
const helper={getSessionToken:async()=> 'local-fixture-token'};

test('feature flag false preserves startup request0 and token0',async()=>{
 let requests=0,tokens=0;const controller=createTalentOperatorController({config:{...baseConfig,writeApiEnabled:false},helper:{getSessionToken:async()=>{tokens++;return'never';}},fetchImpl:async()=>{requests++;throw new Error('never');}});
 assert.equal(controller.enabled,false);assert.equal(requests,0);assert.equal(tokens,0);
});

test('create, continue, and invalidate each issue exact1 without retry',async()=>{
 const calls=[];const fetchImpl=async(url,init)=>{calls.push({url,init});const create=JSON.parse(init.body).applicationNo===undefined;
  return new Response(JSON.stringify(create?{ok:true,data:{applicationNo:'NT-2026-000001',accepted:true}}:{ok:true,data:{accepted:true}}),{status:200,headers:{'content-type':'application/json'}});};
 const controller=createTalentOperatorController({config:baseConfig,helper,fetchImpl});
 let before=calls.length;assert.equal((await controller.record({newApplication:true,metricKey:'contacts',eventAt:'2026-07-19T10:00:00+09:00'})).ok,true);assert.equal(calls.length-before,1);
 before=calls.length;assert.equal((await controller.record({metricKey:'interviews',eventAt:'2026-07-20T10:00:00+09:00'})).ok,true);assert.equal(calls.length-before,1);
 before=calls.length;assert.equal((await controller.invalidate({metricKey:'expectedJoiners',fiscalYear:2026,code:'WITHDRAWN'})).ok,true);assert.equal(calls.length-before,1);
 assert.equal(calls.length,3);
});

test('busy and withdrawn guards fail before duplicate request',async()=>{
 let release;let requests=0;const pending=new Promise(resolve=>{release=resolve;});
 const controller=createTalentOperatorController({config:baseConfig,helper,fetchImpl:async()=>{requests++;await pending;return new Response(JSON.stringify({ok:true,data:{applicationNo:'NT-2026-000002',accepted:true}}),{status:200});}});
 const first=controller.record({newApplication:true,metricKey:'contacts',eventAt:'2026-07-19T10:00:00+09:00'});await Promise.resolve();
 assert.equal((await controller.record({newApplication:true,metricKey:'contacts',eventAt:'2026-07-19T10:00:00+09:00'})).category,'busy');assert.equal(requests,1);release();await first;
 assert.equal(controller.selectApplicationNo('NT-2026-000002'),true);assert.equal((await controller.invalidate({metricKey:'offers',fiscalYear:2026,code:'WITHDRAWN'})).category,'invalid_request');assert.equal(requests,1);
});

test('published candidate has v2-only read, disabled write, coverage, and no persistence transport',async()=>{
 const [html,app,operator,config]=await Promise.all(['index.html','app.mjs','operator.mjs','runtime-config.candidate.js'].map(name=>readFile(new URL(`../portal/talent/${name}`,import.meta.url),'utf8')));
 assert.match(html,/本システム稼働開始以降の集計/);assert.match(app,/initializeTalentOperatorPanel\(\)/);
 assert.match(config,/nov-talent-readonly-api-v2/);assert.doesNotMatch(config,/nov-talent-readonly-api["']/);assert.match(config,/writeApiEnabled:\s*false/);
 assert.doesNotMatch(operator,/localStorage|sessionStorage|postMessage|opener|console\.|location\.|URLSearchParams/);
 assert.doesNotMatch(operator,/applicationId|application_id|UUID/i);
});

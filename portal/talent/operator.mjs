const METRICS=Object.freeze({contacts:'CONTACT_RECORDED',lineRegistrations:'LINE_REGISTERED',salonTours:'SALON_TOUR_COMPLETED',interviews:'INTERVIEW_COMPLETED',passed:'SELECTION_PASSED',offers:'OFFER_ISSUED',expectedJoiners:'EXPECTED_JOIN_CONFIRMED'});
const INVALIDATIONS=Object.freeze(['CANCELLED','NO_SHOW','DELETED','WITHDRAWN']);
const APPLICATION_NO=/^NT-[0-9]{4}-[0-9]{6}$/;

export function createTalentOperatorController({globalObject=globalThis,fetchImpl=globalObject.fetch,config=globalObject.NOV_TALENT_CONFIG,helper=globalObject.NovHubSession}={}){
 let applicationNo=null,busy=false;
 const enabled=config?.writeApiEnabled===true&&typeof config?.writeApiBaseUrl==='string'&&typeof helper?.getSessionToken==='function'&&typeof fetchImpl==='function';
 const send=async(path,payload)=>{if(!enabled||busy)return Object.freeze({ok:false,category:busy?'busy':'feature_disabled'});busy=true;
  try{const token=await helper.getSessionToken({audience:'nov_hub'});if(typeof token!=='string'||!token)return Object.freeze({ok:false,category:'auth_required'});
   const response=await fetchImpl(`${config.writeApiBaseUrl}${path}`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(payload)});
   const body=await response.json().catch(()=>null);if(!response.ok||body?.ok!==true)return Object.freeze({ok:false,category:response.status===503?'not_ready':'write_failed'});
   return Object.freeze({ok:true,data:body.data});
  }catch{return Object.freeze({ok:false,category:'write_failed'});}finally{busy=false;}};
 return Object.freeze({enabled,isBusy:()=>busy,selectApplicationNo(value){if(busy||!APPLICATION_NO.test(String(value)))return false;applicationNo=String(value);return true;},
  async record({metricKey,eventAt,newApplication=false}){if(!Object.hasOwn(METRICS,metricKey)||Number.isNaN(Date.parse(eventAt)))return Object.freeze({ok:false,category:'invalid_request'});
   const payload={...(newApplication?{}:{applicationNo}),metricKey,eventCode:METRICS[metricKey],eventAt:new Date(eventAt).toISOString()};
   if(!newApplication&&!APPLICATION_NO.test(String(applicationNo||'')))return Object.freeze({ok:false,category:'application_required'});
   const result=await send('/api/talent/v1/events',payload);const returned=result.data?.applicationNo;
   if(result.ok&&newApplication&&APPLICATION_NO.test(String(returned)))applicationNo=String(returned);return Object.freeze({ok:result.ok,category:result.ok?'recorded':result.category});},
  async invalidate({metricKey,fiscalYear,code}){if(!APPLICATION_NO.test(String(applicationNo||''))||!Object.hasOwn(METRICS,metricKey)||!Number.isInteger(Number(fiscalYear))||!INVALIDATIONS.includes(code)||(code==='WITHDRAWN'&&metricKey!=='expectedJoiners'))return Object.freeze({ok:false,category:'invalid_request'});
   const result=await send('/api/talent/v1/events/invalidate',{applicationNo,metricKey,fiscalYear:Number(fiscalYear),code});return Object.freeze({ok:result.ok,category:result.ok?'invalidated':result.category});}
 });
}

export function initializeTalentOperatorPanel({globalObject=globalThis,documentObject=globalObject.document,fetchImpl=globalObject.fetch}={}){
 const panel=documentObject?.getElementById?.('talent-operator-panel'),status=documentObject?.getElementById?.('operator-status');
 if(!panel||!status)return Object.freeze({initialized:false});const controller=createTalentOperatorController({globalObject,fetchImpl});
 panel.hidden=!controller.enabled;if(!controller.enabled){status.textContent='入力機能は現在無効です';return Object.freeze({initialized:true,enabled:false,requestCount:0});}
 const controls=[...panel.querySelectorAll('button,input,select')],setBusy=value=>{for(const control of controls)control.disabled=value;panel.setAttribute('aria-busy',String(value));};
 const safe=result=>{status.dataset.category=result.category;status.textContent=result.ok?'操作を完了しました':({not_ready:'入力機能は準備中です',auth_required:'認証を確認できません',application_required:'応募番号を選択してください',invalid_request:'入力内容を確認してください',busy:'処理中です'}[result.category]||'操作を完了できません');};
 const value=id=>documentObject.getElementById(id)?.value||'';
 documentObject.getElementById('operator-select-application')?.addEventListener('click',()=>{const input=documentObject.getElementById('operator-application-no');const accepted=controller.selectApplicationNo(input?.value);if(input)input.value='';safe({ok:accepted,category:accepted?'selected':'invalid_request'});});
 const run=async action=>{if(controller.isBusy())return;setBusy(true);try{safe(await action());}finally{setBusy(false);}};
 documentObject.getElementById('operator-create-event')?.addEventListener('click',()=>run(()=>controller.record({newApplication:true,metricKey:value('operator-metric'),eventAt:value('operator-event-at')})));
 documentObject.getElementById('operator-continue-event')?.addEventListener('click',()=>run(()=>controller.record({metricKey:value('operator-metric'),eventAt:value('operator-event-at')})));
 documentObject.getElementById('operator-invalidate-event')?.addEventListener('click',()=>run(()=>controller.invalidate({metricKey:value('operator-metric'),fiscalYear:value('operator-fiscal-year'),code:value('operator-invalidation-code')})));
 return Object.freeze({initialized:true,enabled:true,requestCount:0,controller});
}

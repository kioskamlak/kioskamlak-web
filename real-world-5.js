/* Copyright (c) 2026 Shirangi. All rights reserved. */
/**
 * Shirangi Real-World Five — production domain primitives.
 * 1) market feed, 2) official verification adapter, 3) e-signature,
 * 4) demand marketplace, 5) appointments.
 * No fake external confirmation: provider-backed states are fail-closed.
 */
(function(global){
'use strict';
const NS='shirangi.realworld5';
const KEYS={market:`${NS}.market`,verify:`${NS}.verify`,sign:`${NS}.sign`,demand:`${NS}.demand`,appointments:`${NS}.appointments`};
const memory=new Map();
const now=()=>new Date().toISOString();
const id=p=>`${p}_${global.crypto?.randomUUID?.()||`${Date.now().toString(36)}_${++idSeq}`}`;
let idSeq=0;
const text=(v,n=500)=>String(v??'').trim().replace(/\s+/g,' ').slice(0,n);
const digits=s=>String(s??'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const num=v=>{
  let x=digits(v).trim().replace(/\s/g,'').replace(/[٬،]/g,'');
  // Persian/Arabic decimal separator is normalized; slash is not a decimal separator.
  x=x.replace(/٫/g,'.');
  if ((x.match(/\./g)||[]).length>1) {
    const last=x.lastIndexOf('.');
    x=x.slice(0,last).replace(/\./g,'')+x.slice(last);
  }
  const n=Number(x.replace(/,/g,''));
  return Number.isFinite(n)?n:null;
};
function read(k,f=[]){try{return global.ShirangiStore?.readLegacy(k,k,f)??f}catch{return memory.get(k)??f}}
function write(k,v){try{if(global.ShirangiStore?.write)return !!global.ShirangiStore.write(k,v)}catch{} memory.set(k,v);return true}
function list(k){const x=read(k,[]);return Array.isArray(x)?x:[]}
function add(k,x,limit=1000){const a=[x,...list(k)].slice(0,limit);if(!write(k,a))return null;return x}
function update(k,idv,fn){const a=list(k),i=a.findIndex(x=>String(x.id)===String(idv));if(i<0)return null;const x={...a[i]};fn(x);a[i]=x;if(!write(k,a))return null;return x}

// Cryptographic SHA-256, synchronous and dependency-free for browser/runtime parity.
// Used for document/provenance integrity; it is not a signature or proof of legal identity.
function utf8(s){
  const out=[]; for(const ch of String(s)){const c=ch.codePointAt(0);
    if(c<0x80)out.push(c); else if(c<0x800)out.push(0xc0|(c>>6),0x80|(c&63));
    else if(c<0x10000)out.push(0xe0|(c>>12),0x80|((c>>6)&63),0x80|(c&63));
    else out.push(0xf0|(c>>18),0x80|((c>>12)&63),0x80|((c>>6)&63),0x80|(c&63));
  } return out;
}
const K256=Uint32Array.from([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
function rotr(x,n){return (x>>>n)|(x<<(32-n))}
function hash(input){
 const bytes=utf8(input), bitLen=bytes.length*8, total=((bytes.length+9+63)>>6)<<6, m=new Uint8Array(total);m.set(bytes);m[bytes.length]=0x80;
 const hi=Math.floor(bitLen/0x100000000),lo=bitLen>>>0;
 new DataView(m.buffer).setUint32(total-8,hi);new DataView(m.buffer).setUint32(total-4,lo);
 let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
 const w=new Uint32Array(64);
 for(let o=0;o<total;o+=64){
  const v=new DataView(m.buffer,o,64);for(let i=0;i<16;i++)w[i]=v.getUint32(i*4);
  for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2],s0=rotr(a,7)^rotr(a,18)^(a>>>3),s1=rotr(b,17)^rotr(b,19)^(b>>>10);w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0}
  let a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7;
  for(let i=0;i<64;i++){const S1=rotr(e,6)^rotr(e,11)^rotr(e,25),ch=(e&f)^(~e&g),t1=(h+S1+ch+K256[i]+w[i])>>>0,S0=rotr(a,2)^rotr(a,13)^rotr(a,22),maj=(a&b)^(a&c)^(b&c),t2=(S0+maj)>>>0;h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0}
  h0=(h0+a)>>>0;h1=(h1+b)>>>0;h2=(h2+c)>>>0;h3=(h3+d)>>>0;h4=(h4+e)>>>0;h5=(h5+f)>>>0;h6=(h6+g)>>>0;h7=(h7+h)>>>0;
 }
 return [h0,h1,h2,h3,h4,h5,h6,h7].map(x=>x.toString(16).padStart(8,'0')).join('');
}
// 1. Market feed: only accepted provider payloads become "verified" observations.
const MARKET_PROVIDERS=new Set(['manual','licensed_feed','official_feed','partner_feed']);
function ingestMarket(input={},meta={}){
 const rows=Array.isArray(input)?input:[input]; const out=[];
 for(const r of rows){const district=text(r.district||r.zone,120),price=num(r.price||r.pricePerMeter||r.value),area=num(r.area||r.metrage);if(!district||!(price>0))continue;const ppm=area>0&&price>0?Math.round(price/area):price;const provider=text(r.provider||meta.provider||'manual',60);const verified=!!r.verified && MARKET_PROVIDERS.has(provider) && !!text(r.source||meta.source);out.push(add(KEYS.market,{id:id('mkt'),district,zone:text(r.zone,80),type:text(r.type||'sale',30),price:price,area,pricePerMeter:ppm,source:text(r.source||meta.source||'',160),provider,verified,observedAt:r.observedAt&&Number.isFinite(Date.parse(r.observedAt))?new Date(r.observedAt).toISOString():now(),provenanceHash:hash(JSON.stringify(r))}));}
 return out;
}
function marketSnapshot(district,days=90){const cut=Date.now()-Math.max(1,days)*86400000;const rows=list(KEYS.market).filter(x=>(!district||x.district===text(district,120))&&Date.parse(x.observedAt)>=cut&&x.pricePerMeter>0);const vals=rows.map(x=>x.pricePerMeter).sort((a,b)=>a-b);const med=vals.length?vals[Math.floor((vals.length-1)/2)]:null;return {count:rows.length,verifiedCount:rows.filter(x=>x.verified).length,median:med,min:vals[0]??null,max:vals.at(-1)??null,verified:rows.filter(x=>x.verified).length>0};}

// 2. Official verification: request/response lifecycle, never infer official status locally.
const VERIFY_STATES=['pending','submitted','provider_verified','provider_rejected','manual_review','failed'];
function requestVerification(input={}){if(!text(input.propertyId,160))return {ok:false,error:'property_required'};return add(KEYS.verify,{id:id('vrf'),propertyId:text(input.propertyId,160),documentType:text(input.documentType||'unknown',60),documentRef:text(input.documentRef,160),requestedBy:text(input.requestedBy,120),state:'pending',provider:text(input.provider,100),createdAt:now(),updatedAt:now()});}
function markVerification(idv,state,providerResult={}){const allowed=['submitted','provider_verified','provider_rejected','manual_review','failed'];if(!allowed.includes(state))return {ok:false,error:'invalid_verification_state'};const current=list(KEYS.verify).find(v=>String(v.id)===String(idv));if(!current)return {ok:false,error:'verification_not_found'};const canVerifyTransition=(from,to)=>(from==='pending'&&['submitted','failed'].includes(to))||(from==='submitted'&&['provider_verified','provider_rejected','manual_review','failed'].includes(to))||(from==='manual_review'&&['provider_verified','provider_rejected','failed'].includes(to));if(!canVerifyTransition(current.state,state))return {ok:false,error:'invalid_verification_transition'};if(state.startsWith('provider_')&&!text(providerResult.reference||providerResult.providerReference,180))return {ok:false,error:'provider_reference_required'};const x=update(KEYS.verify,idv,v=>{v.state=state;v.providerReference=text(providerResult.reference||providerResult.providerReference,180);v.checks=Array.isArray(providerResult.checks)?providerResult.checks.slice(0,50):[];v.reason=text(providerResult.reason,500);v.updatedAt=now();});return x||{ok:false,error:'verification_update_failed'};}

// 3. E-signature: canonical digest + provider request, not a fake signature.
const SIGN_STATES=['draft','pending','sent','signed','declined','expired','failed'];
function createSignRequest(input={}){const contractId=text(input.contractId,160),document=input.documentText||input.document||'';if(!contractId||!String(document).trim())return {ok:false,error:'contract_and_document_required'};const digest=hash(String(document));return add(KEYS.sign,{id:id('sign'),contractId,parties:Array.isArray(input.parties)?input.parties.slice(0,20).map(p=>({id:text(p.id,120),name:text(p.name,160),role:text(p.role,60)})):[],documentHash:digest,state:'draft',provider:text(input.provider,100),providerReference:'',createdAt:now(),updatedAt:now()});}
function transitionSign(idv,state,providerResult={}){if(!SIGN_STATES.includes(state))return {ok:false,error:'invalid_sign_state'};const current=list(KEYS.sign).find(v=>String(v.id)===String(idv));if(!current)return {ok:false,error:'sign_request_not_found'};const canSignTransition=(from,to)=>(from==='draft'&&['pending','failed'].includes(to))||(from==='pending'&&['sent','failed','expired'].includes(to))||(from==='sent'&&['signed','declined','expired','failed'].includes(to));if(!canSignTransition(current.state,state))return {ok:false,error:'invalid_sign_transition'};if(state==='signed'&&!text(providerResult.reference||providerResult.providerReference,180))return {ok:false,error:'provider_reference_required'};const x=update(KEYS.sign,idv,v=>{v.state=state;v.providerReference=text(providerResult.reference||providerResult.providerReference,180);v.signedAt=state==='signed'?now():v.signedAt||null;v.updatedAt=now()});return x||{ok:false,error:'sign_update_failed'};}

// 4. Demand marketplace: structured demand + explainable matching using canonical engine.
function createDemand(input={}){const title=text(input.title||input.description,240),phone=text(input.phone,40);if(!title)return {ok:false,error:'demand_description_required'};return add(KEYS.demand,{id:id('dmd'),title,phone,district:text(input.district,120),type:text(input.type||'sale',40),budgetMin:num(input.budgetMin)||0,budgetMax:num(input.budgetMax||input.budget)||0,areaMin:num(input.areaMin)||0,areaMax:num(input.areaMax)||0,rooms:num(input.rooms)||0,features:Array.isArray(input.features)?input.features.slice(0,20).map(x=>text(x,60)):[],status:'active',createdAt:now(),updatedAt:now()});}
function rankDemand(demand,properties,limit=20){const d=demand||{};const props=Array.isArray(properties)?properties:[];if(global.ShirangiMatching?.rank)return global.ShirangiMatching.rank({...d,preferredDistrict:d.district,preferredType:d.type},props,limit).map(x=>({...x,explanation:`امتیاز ${x.score} از ۱۰۰ بر اساس محدوده، بودجه، متراژ، اتاق و وضعیت فایل`}));return []}

// 5. Appointment: conflict-safe interval scheduling in local-first storage.
function overlap(a,b){return Date.parse(a.startAt)<Date.parse(b.endAt)&&Date.parse(b.startAt)<Date.parse(a.endAt)}
function scheduleAppointment(input={}){const start=Date.parse(input.startAt),end=Date.parse(input.endAt);if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return {ok:false,error:'invalid_time_range'};const agent=text(input.agentId,120);if(!agent)return {ok:false,error:'agent_required'};const candidate={id:id('apt'),propertyId:text(input.propertyId,160),customerId:text(input.customerId,160),agentId:agent,startAt:new Date(start).toISOString(),endAt:new Date(end).toISOString(),status:'scheduled',notes:text(input.notes,500),createdAt:now(),updatedAt:now()};if(list(KEYS.appointments).some(x=>x.status==='scheduled'&&x.agentId===agent&&overlap(x,candidate)))return {ok:false,error:'appointment_conflict'};return add(KEYS.appointments,candidate);}
function rescheduleAppointment(idv,startAt,endAt){const current=list(KEYS.appointments).find(x=>String(x.id)===String(idv));if(!current)return {ok:false,error:'appointment_not_found'};if(!['scheduled','confirmed'].includes(current.status))return {ok:false,error:'appointment_not_reschedulable'};const start=Date.parse(startAt),end=Date.parse(endAt);if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return {ok:false,error:'invalid_time_range'};const candidate={...current,startAt:new Date(start).toISOString(),endAt:new Date(end).toISOString()};if(list(KEYS.appointments).some(x=>String(x.id)!==String(idv)&&['scheduled','confirmed'].includes(x.status)&&x.agentId===current.agentId&&overlap(x,candidate)))return {ok:false,error:'appointment_conflict'};return update(KEYS.appointments,idv,x=>{x.startAt=candidate.startAt;x.endAt=candidate.endAt;x.updatedAt=now()})||{ok:false,error:'appointment_update_failed'};}
function setAppointmentStatus(idv,status){const allowed=['scheduled','confirmed','completed','cancelled','no_show'];if(!allowed.includes(status))return {ok:false,error:'invalid_appointment_status'};return update(KEYS.appointments,idv,x=>{x.status=status;x.updatedAt=now()})||{ok:false,error:'appointment_not_found'};}

const api=Object.freeze({KEYS,ingestMarket,marketSnapshot,requestVerification,markVerification,createSignRequest,transitionSign,createDemand,rankDemand,scheduleAppointment,rescheduleAppointment,setAppointmentStatus});
global.ShirangiRealWorld5=api;
})(typeof window!=='undefined'?window:globalThis);

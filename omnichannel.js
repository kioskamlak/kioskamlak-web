/* Copyright (c) 2026 Shirangi. All rights reserved. */
/**
 * REOS Omnichannel Engine v42.0 — channel-agnostic message/action queue.
 * Provider adapters live outside this core and must be server-authorized.
 */
(function(global){
'use strict';
const CHANNELS=Object.freeze(['sms','whatsapp','call','email','push','internal']);
const STATES=Object.freeze(['queued','sent','delivered','failed','cancelled']);
const OUTBOUND_CHANNELS=Object.freeze(['sms','whatsapp','call','email','push']);
function id(){try{return crypto.randomUUID()}catch(_){return 'msg_'+Date.now()}}
function action(x={}){
  const channel=String(x.channel||'internal');if(!CHANNELS.includes(channel))throw new Error('OMNI_CHANNEL');
  if(!x.workspaceId||!x.leadId)throw new Error('OMNI_REQUIRED_FIELDS');
  return {id:id(),workspaceId:String(x.workspaceId),leadId:String(x.leadId),channel,to:String(x.to||'').slice(0,160),body:String(x.body||'').slice(0,4000),templateId:x.templateId||null,state:'queued',scheduledAt:x.scheduledAt?new Date(x.scheduledAt).toISOString():new Date().toISOString(),createdAt:new Date().toISOString(),metadata:sanitizeMetadata(x.metadata)}; 
}
function sanitizeMetadata(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return {};
  const out={}; for(const [k,v] of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(k))continue;out[String(k).slice(0,80)]=typeof v==='string'?v.slice(0,500):(['number','boolean'].includes(typeof v)?v:null);} return out;
}
function consentStatus(m={}){if(!OUTBOUND_CHANNELS.includes(m.channel))return {required:false,ok:true};const c=m.consent||m.metadata?.consent;return {required:true,ok:c===true||c==='granted'||c==='opt_in'};}
function canDispatch(m={}){const c=consentStatus(m);return c.ok&&m.state==='queued'&&(!m.scheduledAt||Date.parse(m.scheduledAt)<=Date.now());}
function transition(m,next){if(!STATES.includes(next))throw new Error('OMNI_STATE');const a={queued:['sent','cancelled','failed'],sent:['delivered','failed'],delivered:[],failed:['queued'],cancelled:[]};if(!a[m.state]?.includes(next))throw new Error('OMNI_INVALID_TRANSITION');return {...m,state:next};}
function timeline(events=[]){return [...(Array.isArray(events)?events:[])].sort((a,b)=>new Date(a.occurredAt||a.createdAt||0)-new Date(b.occurredAt||b.createdAt||0));}
function nextFollowUp(lead,now=Date.now()){const t=Date.parse(lead?.nextFollowUpAt||'');return Number.isFinite(t)&&t<=now;}
global.ShirangiOmnichannel=Object.freeze({CHANNELS,OUTBOUND_CHANNELS,STATES,action,sanitizeMetadata,consentStatus,canDispatch,transition,timeline,nextFollowUp});
})(typeof window!=='undefined'?window:globalThis);

/* Copyright (c) 2026 Shirangi. All rights reserved. */
/**
 * REOS MLS/Cooperation Engine v42.0
 * State machine + matching + referral economics. Persistence is caller-owned.
 */
(function(global){
'use strict';
const STATES=Object.freeze(['draft','published','reserved','matched','referred','closed','expired','revoked']);
const REF_STATES=Object.freeze(['pending','accepted','rejected','cancelled','paid']);
function id(){if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();if(globalThis.crypto?.getRandomValues){const b=new Uint8Array(16);globalThis.crypto.getRandomValues(b);return 'id_'+Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');}throw new Error('SECURE_RANDOM_UNAVAILABLE')}
function listing(input={}){
  if(!input.workspaceId||!input.propertyId||!input.ownerAgentId)throw new Error('MLS_REQUIRED_FIELDS');
  return {id:id(),workspaceId:String(input.workspaceId),propertyId:String(input.propertyId),ownerAgentId:String(input.ownerAgentId),visibility:input.visibility||'network',state:'published',expiresAt:input.expiresAt||null,allowedAgents:Array.isArray(input.allowedAgents)?input.allowedAgents.map(String):[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
}
function isExpired(l,at=Date.now()){const t=Date.parse(l?.expiresAt||'');return Number.isFinite(t)&&t<=at;}
function canAccess(l,agentId,at=Date.now()){
  if(!l||l.state==='revoked'||l.state==='expired'||isExpired(l,at))return false;
  return l.visibility==='network'||l.ownerAgentId===String(agentId)||(l.allowedAgents||[]).includes(String(agentId));
}
function validateListing(l){
  const errors=[];
  if(!l?.workspaceId)errors.push('workspaceId'); if(!l?.propertyId)errors.push('propertyId'); if(!l?.ownerAgentId)errors.push('ownerAgentId');
  if(l?.expiresAt&&!Number.isFinite(Date.parse(l.expiresAt)))errors.push('expiresAt');
  if(!['network','private','restricted'].includes(l?.visibility))errors.push('visibility');
  return {ok:errors.length===0,errors};
}
function idempotencyKey(input={}){return [input.workspaceId||'',input.propertyId||'',input.ownerAgentId||'',input.clientRequestId||''].map(String).join(':');}
function transition(l,next){
  if(!STATES.includes(next))throw new Error('MLS_INVALID_STATE');
  const allowed={draft:['published','revoked'],published:['reserved','matched','referred','expired','revoked'],reserved:['matched','closed','revoked'],matched:['referred','reserved','closed','revoked'],referred:['matched','closed','revoked'],closed:[],expired:['published'],revoked:[]};
  if(!allowed[l.state]?.includes(next))throw new Error('MLS_INVALID_TRANSITION');
  return {...l,state:next,updatedAt:new Date().toISOString()};
}
function createReferral(input={}){
  const split=Number(input.splitPct);
  if(!input.workspaceId||!input.fromAgentId||!input.toAgentId)throw new Error('REFERRAL_REQUIRED_FIELDS');
  if(input.fromAgentId===input.toAgentId)throw new Error('REFERRAL_SELF');
  if(!Number.isFinite(split)||split<0||split>100)throw new Error('REFERRAL_SPLIT');
  return {id:id(),workspaceId:String(input.workspaceId),fromAgentId:String(input.fromAgentId),toAgentId:String(input.toAgentId),propertyId:input.propertyId?String(input.propertyId):null,leadId:input.leadId?String(input.leadId):null,splitPct:split,state:'pending',createdAt:new Date().toISOString()};
}
function referralTransition(r,next){if(!REF_STATES.includes(next))throw new Error('REFERRAL_INVALID_STATE');const allowed={pending:['accepted','rejected','cancelled'],accepted:['paid','cancelled'],rejected:[],cancelled:[],paid:[]};if(!allowed[r.state]?.includes(next))throw new Error('REFERRAL_INVALID_TRANSITION');return {...r,state:next};}
function matchLead(lead,properties,scoreFn,limit=10){return (Array.isArray(properties)?properties:[]).map(p=>({property:p,score:scoreFn(lead,p)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,Math.max(1,limit));}
global.ShirangiMLS=Object.freeze({STATES,REF_STATES,listing,isExpired,canAccess,validateListing,idempotencyKey,transition,createReferral,referralTransition,matchLead});
})(typeof window!=='undefined'?window:globalThis);

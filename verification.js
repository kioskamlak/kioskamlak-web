/* Copyright (c) 2026 Shirangi. All rights reserved. */
/**
 * REOS Property Verification Engine v42.0
 * Deterministic risk/quality scoring; never claims legal title verification.
 */
(function(global){
'use strict';
const clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,Number(n)||0));
function evidenceState(p={},ctx={}){
  const docs=Array.isArray(p.documents)?p.documents:[];
  const hasDoc=!!(p.documentVerified||p.documentNumber||p.documentType||docs.length);
  const official=!!(p.authorityVerified||ctx.authorityVerified);
  return {hasDocumentEvidence:hasDoc,officialAuthorityConfirmed:official,legalTitleConfirmed:false};
}
function norm(s){return String(s??'').trim().toLowerCase();}
function score(p={},ctx={}){
  const checks=[];
  const evidence=evidenceState(p,ctx);
  const add=(id,weight,ok,detail='')=>checks.push({id,weight,ok:!!ok,detail});
  add('owner_identity',30,!!(p.ownerVerified||ctx.ownerVerified),'مالک/نماینده در سامانه تأیید شده');
  add('document_metadata',15,evidence.hasDocumentEvidence,'اطلاعات مدرک ثبت شده');
  add('freshness',15,freshness(p.updatedAt||p.createdAt,ctx.freshnessDays||30),'فایل نسبتاً تازه است');
  add('price_sanity',15,priceSanity(p,ctx.market),'قیمت در بازه قابل قبول بازار');
  add('media',5,Array.isArray(p.images)?p.images.length>0:!!p.imageUrl,'رسانه/تصویر موجود است');
  add('duplicate',10,ctx.duplicate!==true,'تکراری تشخیص داده نشده');
  add('agent_trust',10,Number(ctx.agentTrust??p.agentTrust??0)>=60,'اعتبار مشاور مناسب');
  const earned=checks.reduce((s,x)=>s+(x.ok?x.weight:0),0);
  const risk=100-earned;
  const status=earned>=90?'verified':earned>=75?'trusted':earned>=50?'review_required':'risky';
  const reasons=checks.filter(x=>!x.ok).map(x=>x.id);
  const confidence=earned>=90?'high':earned>=75?'medium':'low';
  return Object.freeze({score:earned,status,risk,checks,reasons,confidence,evidence});
}
function freshness(date,maxDays){if(!date)return false;const t=Date.parse(date);return Number.isFinite(t)&&Date.now()-t<=maxDays*86400000;}
function priceSanity(p,m){
  if(!m||!p.area||!p.price)return false;
  const ppm=p.price/p.area, lo=m.p25??m.min, hi=m.p75??m.max;
  if(!(lo>0&&hi>0))return false;
  return ppm>=lo*.65&&ppm<=hi*1.35;
}
function duplicateKey(p){return [norm(p.address),p.area||'',p.rooms||'',p.yearBuilt||'',p.ownerPhone||''].join('|');}
function findDuplicates(properties=[]){
  const map=new Map(),dups=[];
  for(const p of Array.isArray(properties)?properties:[]){
    const k=duplicateKey(p);if(!k.replace(/\|/g,''))continue;
    if(map.has(k))dups.push({key:k,ids:[map.get(k).id,p.id]});
    else map.set(k,p);
  }
  return dups;
}
global.ShirangiVerification=Object.freeze({score,findDuplicates,duplicateKey,evidenceState});
})(typeof window!=='undefined'?window:globalThis);

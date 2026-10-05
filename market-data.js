/* Copyright (c) 2026 Shirangi. All rights reserved. */
/**
 * REOS Market Data Engine v42.0
 * Pure ingestion/normalization/statistics. No network, no DOM, no secrets.
 */
(function (global) {
  'use strict';
  const DIGITS = '۰۱۲۳۴۵۶۷۸۹';
  function digits(s){return String(s??'').replace(/[۰-۹]/g,d=>DIGITS.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));}
  function num(v){
    let s=digits(String(v??'')).trim().replace(/\u066B/g,'.');
    if(/^[-+]?\d{1,3}(?:[٬،,/]\d{3})+$/.test(s)) s=s.replace(/[٬،,/]/g,'');
    else s=s.replace(/[٬،,\s]/g,'');
    const n=Number(s);return Number.isFinite(n)?n:null;
  }
  function cleanText(v,max=200){return String(v??'').trim().replace(/\s+/g,' ').slice(0,max);}
  function normalize(record={}){
    const price=num(record.price??record.salePrice??record.amount);
    const area=num(record.area??record.metrage);
    const district=cleanText(record.district??record.zone??'',80);
    return Object.freeze({
      id: cleanText(record.id||cryptoId(),64), district,
      zone: cleanText(record.zone||'',40),
      type: cleanText(record.type||record.dealType||'sale',32),
      category: cleanText(record.category||'residential',32),
      price, area,
      pricePerMeter: price!=null&&area>0?Math.round(price/area):null,
      observedAt: validDate(record.observedAt)||new Date().toISOString(),
      source: cleanText(record.source||'manual',80),
      sourceRef: cleanText(record.sourceRef||'',160),
      confidence: clamp(num(record.confidence)??50,0,100),
      verified: record.verified === true,
      provenance: cleanText(record.provenance||record.sourceRef||record.source||'manual',200),
      quality: record.verified===true ? 'verified' : (record.source && record.source!=='manual' ? 'unverified-source' : 'manual')
    });
  }
  function cryptoId(){if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();if(globalThis.crypto?.getRandomValues){const b=new Uint8Array(16);globalThis.crypto.getRandomValues(b);return 'mkt_'+Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');}throw new Error('SECURE_RANDOM_UNAVAILABLE');}
  function validDate(v){const d=new Date(v);return Number.isFinite(d.getTime())?d.toISOString():null;}
  function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
  function ingest(records,{source='manual',observedAt=new Date().toISOString(),verified=false,provenance=''}={}){
    const input=Array.isArray(records)?records:[records];
    const seen=new Set(), out=[];
    for(const raw of input){
      const x=normalize({...raw,source:raw?.source||source,observedAt:raw?.observedAt||observedAt,verified:raw?.verified??verified,provenance:raw?.provenance||provenance});
      const key=[x.district,x.type,x.area,x.price,x.observedAt.slice(0,10)].join('|');
      if(x.price==null||x.area==null||x.area<=0||x.price<0||seen.has(key))continue;
      seen.add(key);out.push(x);
    }
    return out;
  }
  function summarize(records,{district,type,days=90,verifiedOnly=false}={}){
    const cutoff=Date.now()-Math.max(1,days)*86400000;
    const rows=ingest(records).filter(x=>(!verifiedOnly||x.verified)&&(!district||x.district===String(district))&&(!type||x.type===type)&&new Date(x.observedAt).getTime()>=cutoff&&x.pricePerMeter!=null);
    const vals=rows.map(x=>x.pricePerMeter).sort((a,b)=>a-b);
    if(!vals.length)return {count:0,median:null,p25:null,p75:null,mean:null,min:null,max:null};
    const q=p=>vals[Math.min(vals.length-1,Math.floor((vals.length-1)*p))];
    const mean=Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
    return {count:vals.length,median:q(.5),p25:q(.25),p75:q(.75),mean,min:vals[0],max:vals.at(-1)};
  }
  function trend(records,{district,type,periodDays=30,lookbackPeriods=6,verifiedOnly=false}={}){
    const rows=ingest(records).filter(x=>(!verifiedOnly||x.verified)&&(!district||x.district===String(district))&&(!type||x.type===type)&&x.pricePerMeter!=null);
    const now=Date.now(), periods=[];
    for(let i=lookbackPeriods-1;i>=0;i--){
      const end=now-i*periodDays*86400000,start=end-periodDays*86400000;
      const p=rows.filter(x=>{const t=new Date(x.observedAt).getTime();return t>=start&&t<end;}).map(x=>x.pricePerMeter);
      periods.push({start:new Date(start).toISOString(),end:new Date(end).toISOString(),count:p.length,median:p.length?median(p):null});
    }
    const populated=periods.filter(x=>x.median!=null);
    const first=populated[0]?.median,last=populated.at(-1)?.median;
    return {periods,changePct:populated.length>=2&&first?Math.round((last-first)/first*10000)/100:null};
  }
  function median(a){const x=[...a].sort((a,b)=>a-b);return x.length?x[Math.floor((x.length-1)/2)]:null;}
  function sourceHealth(records=[]){
    const rows=ingest(records), verified=rows.filter(x=>x.verified).length;
    const sources=[...new Set(rows.map(x=>x.source).filter(Boolean))];
    return {count:rows.length,verifiedCount:verified,verifiedRatio:rows.length?Math.round(verified/rows.length*10000)/10000:0,sources};
  }
  global.ShirangiMarketData=Object.freeze({normalize,ingest,summarize,trend,num,sourceHealth});
})(typeof window!=='undefined'?window:globalThis);

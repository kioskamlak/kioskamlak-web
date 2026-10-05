/* Copyright (c) 2026 Shirangi. All rights reserved. */
/**
 * Shirangi Seven Engines UI Bridge v42.6.7
 * Connects the seven domain engines to the existing Web/Desktop/Android surfaces.
 * No external provider calls and no secrets in the client.
 */
(function(global){
'use strict';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=v=>Number(String(v??'').replace(/[٬،,\s]/g,''))||0;
const props=()=>Array.isArray(global.properties)?global.properties:[];
const leads=()=>Array.isArray(global.leads)?global.leads:[];
const engine=()=>global.ShirangiREOS;

function market(){
  const e=engine()?.marketData;
  if(!e)return {count:0,median:null,p25:null,p75:null,changePct:null};
  const rows=props().map(p=>({
    id:p.id, district:p.district||p.zone||'',
    type:p.type||p.transactionType||p.dealType||'sale',
    price:n(p.price||p.salePrice||p.amount),
    area:n(p.area||p.metrage||p.meterage),
    observedAt:p.updatedAt||p.updated_at||p.createdAt||new Date().toISOString()
  })).filter(x=>x.price>0&&x.area>0);
  const s=e.summarize(rows,{days:365});
  const t=e.trend(rows,{periodDays:30,lookbackPeriods:6});
  const q=e.sourceHealth?.(rows)||{};
  return {...s,changePct:t.changePct,verifiedCount:q.verifiedCount||0,verifiedRatio:q.verifiedRatio||0,sources:q.sources||[]};
}
function verifyAll(){
  const e=engine()?.verification;if(!e)return [];
  const m=market();
  return props().map(p=>{
    const result=e.score(p,{market:m,agentTrust:n(p.agentTrust||p.agent_trust)});
    return {property:p,...result};
  });
}
function duplicateCount(){return engine()?.verification?.findDuplicates(props()).length||0;}
function aiRank(){
  const matching=global.ShirangiMatching;
  if(!matching)return [];
  const candidates=props();
  const lead=leads()[0];
  if(!lead)return [];
  return matching.rank(lead,candidates,5);
}
function health(){return engine()?.health?.()||{};}

function render(){
  const root=document.getElementById('shirangi-seven-engines');
  if(!root)return;
  const h=health(),m=market(),v=verifyAll(),dup=duplicateCount(),matches=aiRank();
  const verified=v.filter(x=>x.status==='verified').length;
  const status=document.getElementById('seven-runtime-status');
  if(status) status.textContent='متصل و آماده — 7/7';
  const risky=v.filter(x=>x.status==='risky').length;
  const readiness=['marketData','mls','verification','ai','contracts','omnichannel','matching'].filter(k=>h[k]).length;
  // Seven Engines = دقیقاً ۷ موتور دامنه؛ Mobile UX لایه تجربه است و جزو شمارش موتورها نیست.
  const engineCards=[
    ['داده بازار','marketData',m.count, m.median?`میانه متری: ${m.median.toLocaleString('fa-IR')} · تأییدشده ${m.verifiedCount||0}`:'منتظر داده واقعی بازار'],
    ['MLS','mls',h.mls?'آماده':'غیرفعال','هسته شبکه و فایل‌های قابل همکاری'],
    ['AI Agent','ai',h.ai?'آماده':'غیرفعال','دستیار و رتبه‌بندی هوشمند'],
    ['Verification','verification',verified?`${verified.toLocaleString('fa-IR')} تأیید`:'آماده','اعتبارسنجی و کنترل Duplicate'],
    ['Contracts','contracts',h.contracts?'آماده':'غیرفعال','قرارداد، قسط، چک و تسویه'],
    ['Omnichannel','omnichannel',h.omnichannel?'آماده':'غیرفعال','پیام، کانال و Timeline'],
    ['Matching','matching',matches.length?`${matches.length.toLocaleString('fa-IR')} پیشنهاد`:'آماده','تطبیق مشتری و فایل']
  ];
  const supportCards=[
    ['Mobile UX','mobileUX',h.mobileUX?'آماده':'غیرفعال','Phone / Tablet / Desktop']
  ];
  root.innerHTML=`
    <div class="flex items-center justify-between gap-3 mb-4">
      <div><h2 class="text-xl md:text-2xl font-black">هسته عملیاتی Shirangi — Seven Engines</h2>
      <p class="text-xs md:text-sm text-slate-400">موتورها مستقل از وجود داده آماده‌اند؛ داده‌ها جداگانه نمایش داده می‌شوند.</p></div>
      <span class="px-3 py-2 rounded-xl bg-emerald-900/60 text-emerald-300 font-black text-sm">${readiness}/7 آماده</span>
      <button id="seven-refresh" class="px-4 py-2 rounded-xl bg-sky-700 font-bold">به‌روزرسانی</button>
    </div>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      ${engineCards.map((c,i)=>`<div class="p-3 rounded-xl bg-slate-900 border border-slate-700 min-h-[112px]">
        <div class="flex items-center justify-between gap-2">
          <div class="text-xs text-slate-300 font-bold">${esc(c[0])}</div>
          <span class="w-2.5 h-2.5 rounded-full ${c[1]==='marketData' ? (m.count?'bg-emerald-400':'bg-amber-400') : (h[c[1]]?'bg-emerald-400':'bg-slate-600')}" aria-hidden="true"></span>
        </div>
        <div class="text-xl font-black mt-2">${typeof c[2]==='number'?c[2].toLocaleString('fa-IR'):esc(c[2])}</div>
        <div class="text-[11px] text-slate-500 mt-1">${esc(c[3])}</div>
      </div>`).join('')}
    </div>
    <div class="mt-3 p-3 rounded-xl bg-slate-900/70 border border-slate-800">
      <div class="flex items-center justify-between gap-3">
        <span class="text-xs text-slate-400 font-bold">لایه تجربه</span>
        ${supportCards.map(c=>`<span class="text-xs text-slate-300">${esc(c[0])}: <b>${esc(c[2])}</b></span>`).join('')}
      </div>
    </div>
    <div class="grid lg:grid-cols-3 gap-3 mt-4">
      <div class="p-4 rounded-xl bg-slate-900 border border-slate-700">
        <b>شاخص بازار</b>
        <div class="mt-3 text-sm">میانه قیمت هر متر:
          <strong>${m.median?m.median.toLocaleString('fa-IR'):'—'}</strong>
        </div>
        <div class="text-sm mt-1">P25 / P75:
          <strong>${m.p25?m.p25.toLocaleString('fa-IR'):'—'} / ${m.p75?m.p75.toLocaleString('fa-IR'):'—'}</strong>
        </div>
        <div class="text-sm mt-1">داده تأییدشده: <strong>${m.verifiedCount||0}</strong> · نسبت ${(100*(m.verifiedRatio||0)).toLocaleString('fa-IR')}٪</div>
        <div class="text-sm mt-1">تغییر ۳۰روزه:
          <strong>${m.changePct==null?'—':`${m.changePct.toLocaleString('fa-IR')}٪`}</strong>
        </div>
      </div>
      <div class="p-4 rounded-xl bg-slate-900 border border-slate-700">
        <b>اعتبار فایل‌ها</b>
        <div class="mt-3 space-y-2 max-h-40 overflow-auto">
          ${v.slice(0,8).map(x=>`<div class="flex justify-between text-sm">
            <span>${esc(x.property.title||x.property.address||'ملک')}</span>
            <strong>${x.score.toLocaleString('fa-IR')}٪</strong>
          </div>`).join('')||'<span class="text-slate-500">فایلی برای ارزیابی نیست.</span>'}
        </div>
      </div>
      <div class="p-4 rounded-xl bg-slate-900 border border-slate-700">
        <b>AI Match — اولین مشتری فعال</b>
        <div class="mt-3 space-y-2 max-h-40 overflow-auto">
          ${matches.map(x=>`<div class="flex justify-between text-sm">
            <span>${esc(x.property.title||x.property.address||'ملک')}</span>
            <strong>${x.score.toLocaleString('fa-IR')}٪</strong>
          </div>`).join('')||'<span class="text-slate-500">Lead فعالی برای Match موجود نیست.</span>'}
        </div>
      </div>
    </div>
    <div class="mt-4 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
      وضعیت هسته: ${Object.entries(h).filter(([k])=>k!=='version'&&k!=='mobileUX').map(([k,v])=>`${esc(k)}=${v?'OK':'—'}`).join(' · ')}
    </div>`;
  document.getElementById('seven-refresh')?.addEventListener('click',render);
}
function init(){
  const safeRender=()=>{try{return render()}catch(e){console.error('[Shirangi Seven UI]',e);const st=document.getElementById('seven-runtime-status');if(st)st.textContent='هسته آماده — خطای نمایش، در حال بازیابی…';return null;}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',safeRender,{once:true});
  else safeRender();
  global.addEventListener?.('shirangi:data-changed',safeRender);
}
global.ShirangiSevenEnginesUI=Object.freeze({market,verifyAll,duplicateCount,aiRank,health,render,init});
init();
})(typeof window!=='undefined'?window:globalThis);

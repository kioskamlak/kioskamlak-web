/* Copyright (c) 2026 Shirangi. All rights reserved. */
/*
 * Shirangi Platform Expansion
 * Five product layers: MLS Network, Marketplace, Multi-channel Publishing,
 * Verified Market Data, and an explainable AI Copilot.
 * Local-first, provider-agnostic, fail-closed: no fake external delivery.
 */
(function (global) {
  'use strict';

  const NS = 'shirangi.platform';
  const LIMIT = 1000;
  const MAX_TEXT = 4000;
  const KEYS = Object.freeze({
    members: `${NS}.members`,
    networkListings: `${NS}.networkListings`,
    networkRequests: `${NS}.networkRequests`,
    marketplaceListings: `${NS}.marketplaceListings`,
    marketplaceRequests: `${NS}.marketplaceRequests`,
    marketplaceLeads: `${NS}.marketplaceLeads`,
    publishJobs: `${NS}.publishJobs`,
    marketObservations: `${NS}.marketObservations`,
    copilotRuns: `${NS}.copilotRuns`
  });
  const CHANNELS = Object.freeze(['website', 'mobile', 'instagram', 'telegram', 'whatsapp', 'portal', 'sms']);
  const now = () => Date.now();
  const text = (v, n = MAX_TEXT) => String(v ?? '').trim().slice(0, n);
  let seq = 0;
  const id = p => `${p || 'sh'}_${global.crypto?.randomUUID?.() || `${Date.now()}_${++seq}`}`;
  const num = v => Number(String(v ?? '').replace(/,/g, '')) || 0;
  const fa = v => String(v).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const esc = v => text(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  function read(key, fallback = []) {
    try { return global.ShirangiStore?.readLegacy(key, key, fallback) ?? fallback; } catch { return fallback; }
  }
  function write(key, value) {
    try { return !!global.ShirangiStore?.write(key, value); } catch { return false; }
  }
  function list(key) { const v = read(key, []); return Array.isArray(v) ? v : []; }
  function append(key, value) { const rows = list(key); rows.unshift(value); write(key, rows.slice(0, LIMIT)); return value; }
  function update(key, itemId, fn) { const rows = list(key); const item = rows.find(x => x.id === itemId); if (!item) return null; fn(item); write(key, rows); return item; }
  function properties() { return Array.isArray(global.properties) ? global.properties : []; }
  function customers() { return Array.isArray(global.customers) ? global.customers : []; }
  function propertyPrice(p) { return num(p?.price || p?.salePrice || p?.deposit); }
  function cloudReady() { return !!global.ShirangiConfigGuard?.isCloudReady?.(); }

  async function cloud(path, body = {}) {
    if (!cloudReady()) return { ok: false, error: 'cloud_not_configured' };
    const base = text(global.SHIRANGI_CONFIG?.functionsBase, 500).replace(/\/$/, '');
    if (!/^https:\/\//i.test(base) || !path.startsWith('/api/v1/')) return { ok: false, error: 'provider_not_configured' };
    const hardened = global.ShirangiSecurityRuntime?.transportPayload?.(body, 250000);
    if (!hardened?.ok) return hardened || { ok: false, error: 'payload_invalid' };
    const payload = hardened.json;
    if (!global.ShirangiSecurityRuntime?.allow?.(`cloud:${path}`, 30, 60000)) return { ok: false, error: 'rate_limited' };
    try {
      const session = await global.supabase?.auth?.getSession?.();
      const token = session?.data?.session?.access_token || '';
      if (!token) return { ok: false, error: 'authentication_required' };
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 12000);
      try {
        const r = await fetch(base + path, { method:'POST', headers:{'content-type':'application/json',authorization:`Bearer ${token}`}, body:payload, signal:controller.signal });
        const raw = await r.text(); if (raw.length > 500000) return {ok:false,error:'response_too_large'};
        let data={}; try { data=raw?JSON.parse(raw):{}; } catch { return {ok:false,error:'invalid_server_response'}; }
        return r.ok ? data : {ok:false,error:data.error || `http_${r.status}`};
      } finally { clearTimeout(timer); }
    } catch (e) { return {ok:false,error:e?.name==='AbortError'?'timeout':'network_error'}; }
  }

  // 1) Real MLS / cooperation network: explicit visibility, trust, and requests.
  function upsertMember(input = {}) {
    const member = { id: text(input.id,120) || id('member'), name:text(input.name,160), office:text(input.office,160), city:text(input.city,100), areas:text(input.areas,400), phone:text(input.phone,40), status:text(input.status || 'pending',30), verified:!!input.verified, updatedAt:now(), createdAt:Number(input.createdAt)||now() };
    if (!member.name) return {ok:false,error:'member_name_required'};
    const rows=list(KEYS.members), existing=rows.find(x=>x.id===member.id || (member.phone && x.phone===member.phone));
    if (existing) { Object.assign(existing, member, {id:existing.id}); write(KEYS.members, rows); void cloud('/api/v1/platform/network',{action:'upsert_member',member}); return existing; }
    const saved=append(KEYS.members, member); void cloud('/api/v1/platform/network',{action:'upsert_member',member:saved}); return saved;
  }
  function publishNetworkListing(input = {}) {
    const propertyId=text(input.propertyId,160); if (!propertyId) return {ok:false,error:'property_required'};
    const saved=append(KEYS.networkListings, {id:id('mls'),propertyId,title:text(input.title,200),city:text(input.city,100),district:text(input.district,120),price:num(input.price),visibility:text(input.visibility||'verified-network',40),status:'active',ownerMemberId:text(input.ownerMemberId,120),createdAt:now(),updatedAt:now()}); void cloud('/api/v1/platform/network',{action:'publish_listing',listing:saved}); return saved;
  }
  function requestNetworkAccess(input = {}) {
    const listingId=text(input.listingId,120), from=text(input.fromMemberId,120), to=text(input.toMemberId,120);
    if (!listingId || !from) return {ok:false,error:'listing_and_requester_required'};
    return append(KEYS.networkRequests,{id:id('nreq'),listingId,fromMemberId:from,toMemberId:to,message:text(input.message,800),share:text(input.share||'negotiable',80),status:'pending',createdAt:now(),updatedAt:now()});
  }
  function networkMetrics(){ const m=list(KEYS.members),l=list(KEYS.networkListings),r=list(KEYS.networkRequests); return {members:m.length,verifiedMembers:m.filter(x=>x.verified).length,activeListings:l.filter(x=>x.status==='active').length,pendingRequests:r.filter(x=>x.status==='pending').length,acceptedRequests:r.filter(x=>x.status==='accepted').length}; }

  // 2) Public marketplace: safe listing projection + request -> lead capture.
  function publishMarketplaceListing(input = {}) {
    const propertyId=text(input.propertyId,160), title=text(input.title,200), district=text(input.district,120);
    if (!title && !propertyId) return {ok:false,error:'listing_identity_required'};
    const saved=append(KEYS.marketplaceListings,{id:id('pub'),propertyId,title:title||'ملک',district,city:text(input.city,100),type:text(input.type||'sale',30),price:num(input.price),area:num(input.area),bedrooms:num(input.bedrooms),description:text(input.description,1800),media:Array.isArray(input.media)?input.media.slice(0,20).map(x=>global.ShirangiSecurity?.safeUrl?.(x)||'').filter(Boolean):[],verified:!!input.verified,status:'active',createdAt:now(),updatedAt:now()}); void cloud('/api/v1/platform/marketplace',{action:'publish_listing',listing:saved}); return saved;
  }
  function createMarketplaceRequest(input = {}) {
    const name=text(input.name,120), phone=text(input.phone,40);
    if (!name || !phone) return {ok:false,error:'name_and_phone_required'};
    const request=append(KEYS.marketplaceRequests,{id:id('req'),name,phone,district:text(input.district,120),type:text(input.type||'sale',30),budget:num(input.budget),areaMin:num(input.areaMin),areaMax:num(input.areaMax),description:text(input.description,1200),status:'new',createdAt:now()});
    const lead=append(KEYS.marketplaceLeads,{id:id('lead'),requestId:request.id,name:request.name,phone:request.phone,source:'shirangi-marketplace',status:'new',createdAt:now()});
    try { global.ShirangiCompetitive?.updateLead?.(lead.id,{source:'marketplace'}); } catch {}
    void cloud('/api/v1/platform/marketplace',{action:'create_request',request,lead});
    return {ok:true,request,lead};
  }
  function marketplaceSearch(input = {}) {
    const district=text(input.district,120), type=text(input.type,30), budget=num(input.budget), area=num(input.area);
    return list(KEYS.marketplaceListings).filter(x=>x.status==='active').map(x=>{
      let score=0; if(district && text(x.district).includes(district))score+=35; if(type && x.type===type)score+=15; if(budget && x.price>0 && x.price<=budget)score+=25; if(area && x.area>0)score+=Math.max(0,25-Math.min(25,Math.abs(x.area-area)/Math.max(area,1)*25)); return {...x,score:Math.round(score)};
    }).filter(x=>x.score>0 || (!district&&!type&&!budget&&!area)).sort((a,b)=>b.score-a.score).slice(0,30);
  }

  // 3) Publishing orchestration: queues work and only executes through configured adapters.
  function queuePublish(propertyId, channels, input = {}) {
    const p=properties().find(x=>String(x.id)===String(propertyId));
    const safeChannels=[...(Array.isArray(channels)?channels:String(channels||'').split(',')).map(x=>text(x,30)).filter(x=>CHANNELS.includes(x))].filter((x,i,a)=>a.indexOf(x)===i);
    if (!propertyId || !safeChannels.length) return {ok:false,error:'property_and_channels_required'};
    return append(KEYS.publishJobs,{id:id('pubjob'),propertyId:String(propertyId),title:text(input.title||p?.title||p?.address||'ملک',200),channels:safeChannels,status:'queued',results:[],attempts:0,createdAt:now(),updatedAt:now()});
  }
  async function executePublish(jobId, options = {}) {
    const job=list(KEYS.publishJobs).find(x=>x.id===jobId); if(!job)return {ok:false,error:'job_not_found'};
    if(options.dryRun !== false) { update(KEYS.publishJobs,jobId,x=>{x.status='ready';x.updatedAt=now();x.results=x.channels.map(channel=>({channel,status:'dry_run',at:now()}));}); return {ok:true,dryRun:true,job}; }
    const result=await cloud('/api/v1/publishing/execute',{jobId,channels:job.channels,propertyId:job.propertyId});
    if(!result.ok) return result;
    update(KEYS.publishJobs,jobId,x=>{x.status='published';x.updatedAt=now();x.results=result.results||[];x.attempts=(x.attempts||0)+1;});
    return result;
  }
  function publishingMetrics(){const j=list(KEYS.publishJobs);return {queued:j.filter(x=>x.status==='queued').length,ready:j.filter(x=>x.status==='ready').length,published:j.filter(x=>x.status==='published').length,failed:j.filter(x=>x.status==='failed').length};}

  // 4) Verified market data: provenance first, no synthetic market facts.
  function addMarketObservation(input = {}) {
    const value=num(input.value); const district=text(input.district,120); const source=text(input.source,200); const observedAt=Number(input.observedAt)||now();
    if(!district || value<=0 || !source) return {ok:false,error:'district_value_source_required'};
    const trusted=!!input.verified;
    const row=append(KEYS.marketObservations,{id:id('obs'),district,metric:text(input.metric||'meter_price',60),value,unit:text(input.unit||'تومان',30),source,sourceType:text(input.sourceType||'manual',40),verified:trusted,observedAt,createdAt:now(),notes:text(input.notes,600),syncStatus:'pending'});
    void cloud('/api/v1/market/observations',{items:[row]}).then(r=>{ if(r?.ok) update(KEYS.marketObservations,row.id,x=>{x.syncStatus='synced';x.syncedAt=now();}); });
    return row;
  }
  function marketSnapshot(district, metric='meter_price') {
    const rows=list(KEYS.marketObservations).filter(x=>x.district===text(district,120)&&x.metric===metric&&x.value>0).sort((a,b)=>b.observedAt-a.observedAt);
    const trusted=rows.filter(x=>x.verified); const pool=trusted.length?trusted:rows;
    if(!pool.length)return {ok:false,error:'no_market_data'};
    const values=pool.map(x=>x.value).sort((a,b)=>a-b), median=values[Math.floor(values.length/2)];
    return {ok:true,district:text(district,120),metric,count:pool.length,median,low:values[0],high:values.at(-1),verifiedCount:trusted.length,lastObservedAt:pool[0].observedAt,sources:[...new Set(pool.map(x=>x.source))].slice(0,10)};
  }
  function marketValuation(input = {}) {
    const area=num(input.area); const district=text(input.district,120); if(area<=0||!district)return {ok:false,error:'area_and_district_required'};
    const snap=marketSnapshot(district); if(!snap.ok)return snap;
    const center=area*snap.median, confidence=Math.min(96,45+snap.count*5+(snap.verifiedCount?snap.verifiedCount*3:0));
    const local={ok:true,center,low:center*.92,high:center*1.08,meter:snap.median,confidence,source:snap.sources,verifiedObservations:snap.verifiedCount};
    void cloud('/api/v1/market/valuation',{area,district,comps:list(KEYS.marketObservations).filter(x=>x.district===district&&x.metric==='meter_price'&&x.value>0).slice(0,100).map(x=>({meter:x.value,verified:!!x.verified,source:x.source}))}).then(r=>{ if(r?.ok) local.remote={low:r.low,center:r.center,high:r.high,confidence:r.confidence}; });
    return local;
  }

  // 5) Explainable AI Copilot: recommendations/drafts only; no autonomous external side effects.
  function copilot(input = {}) {
    const lead=input.lead||customers().find(Boolean)||{}; const props=properties();
    const budget=num(lead.budget||lead.maxBudget), district=text(lead.district||lead.area||lead.needs,120);
    const ranked=props.map(p=>{let score=0;const price=propertyPrice(p), loc=text(p.district||p.address,200);if(district&&loc.includes(district))score+=40;if(budget&&price&&price<=budget)score+=35;if(num(lead.area)&&num(p.area))score+=Math.max(0,25-Math.min(25,Math.abs(num(p.area)-num(lead.area))/Math.max(num(lead.area),1)*25));return {...p,_score:Math.round(score)};}).filter(x=>x._score>0).sort((a,b)=>b._score-a._score).slice(0,5);
    const hot=ranked[0]; const next=hot?'ارسال ۳ فایل برتر و پیشنهاد بازدید':'تکمیل نیازسنجی مشتری و ثبت منطقه/بودجه';
    const draft=hot?`سلام، بر اساس نیاز شما ${hot.title||hot.address||'یک فایل مناسب'} را پیشنهاد می‌کنم. اگر مناسب است زمان بازدید را هماهنگ کنیم.`:'برای پیشنهاد دقیق‌تر، بودجه و محدوده موردنظر مشتری را تکمیل کنید.';
    const result={ok:true,generatedAt:now(),reasoning:[district?'تطبیق محدوده':'محدوده نامشخص',budget?'کنترل بودجه':'بودجه نامشخص',ranked.length?'امتیازدهی فایل‌های موجود':'فایل مناسب پیدا نشد'],recommendations:ranked.map(x=>({propertyId:x.id,title:text(x.title||x.address||'ملک',160),score:x._score,price:propertyPrice(x)})),nextAction:next,draftMessage:draft,autonomousAction:false,connection:'local'};
    append(KEYS.copilotRuns,{id:id('copilot'),...result});
    void cloud('/api/v1/ai/copilot',{input:`تحلیل سرنخ املاک: منطقه=${district||'نامشخص'} بودجه=${budget||'نامشخص'}`,context:{lead:{district,budget},recommendations:result.recommendations}}).then(r=>{ if(r?.ok){ update(KEYS.copilotRuns,list(KEYS.copilotRuns)[0]?.id,x=>{x.connection='cloud';x.remote=r.result;}); } });
    return result;
  }
  function copilotHistory(){return list(KEYS.copilotRuns).slice(0,20);}

  function render() {
    const root=global.document?.getElementById('shirangi-platform-expansion'); if(!root)return;
    const n=networkMetrics(), p=publishingMetrics(), m=list(KEYS.marketplaceListings).filter(x=>x.status==='active').length, obs=list(KEYS.marketObservations).length;
    root.innerHTML=`<div class="grid md:grid-cols-5 gap-2 mb-4">${[['شبکه فعال',n.activeListings],['اعضای تأییدشده',n.verifiedMembers],['بازار عمومی',m],['صف انتشار',p.queued],['داده بازار',obs]].map(x=>`<div class="p-3 rounded-xl bg-slate-900 border border-slate-700 text-center"><b class="text-xl">${fa(x[1])}</b><div class="text-[11px] text-slate-400">${esc(x[0])}</div></div>`).join('')}</div>
    <div class="grid lg:grid-cols-2 gap-4">
      <section class="p-4 rounded-2xl bg-slate-900 border border-slate-700"><h3 class="font-black text-emerald-300 mb-3">شبکه MLS و Marketplace</h3><div class="grid md:grid-cols-2 gap-2"><input id="px-member-name" class="form-input" placeholder="نام مشاور/دفتر"><input id="px-member-city" class="form-input" placeholder="شهر"><input id="px-listing-id" class="form-input" placeholder="شناسه ملک"><input id="px-listing-title" class="form-input" placeholder="عنوان فایل"><input id="px-request-name" class="form-input" placeholder="نام متقاضی"><input id="px-request-phone" class="form-input" placeholder="شماره تماس"><button onclick="ShirangiPlatform.addMemberFromUI()" class="py-2 rounded-xl bg-emerald-700 font-bold">ثبت عضو شبکه</button><button onclick="ShirangiPlatform.publishListingFromUI()" class="py-2 rounded-xl bg-sky-700 font-bold">انتشار فایل در شبکه</button><button onclick="ShirangiPlatform.createRequestFromUI()" class="py-2 rounded-xl bg-rose-700 font-bold md:col-span-2">ثبت درخواست عمومی و ساخت Lead</button></div></section>
      <section class="p-4 rounded-2xl bg-slate-900 border border-slate-700"><h3 class="font-black text-cyan-300 mb-3">انتشار چندکاناله</h3><div class="grid gap-2"><input id="px-publish-property" class="form-input" placeholder="شناسه ملک"><input id="px-publish-channels" class="form-input" value="website,portal,instagram,whatsapp" placeholder="website,portal,instagram,whatsapp"><button onclick="ShirangiPlatform.queuePublishFromUI()" class="py-2 rounded-xl bg-cyan-700 font-bold">ساخت صف انتشار</button><div id="px-publish-list" class="space-y-2"></div></div></section>
      <section class="p-4 rounded-2xl bg-slate-900 border border-slate-700"><h3 class="font-black text-amber-300 mb-3">داده واقعی بازار و ارزش‌گذاری</h3><div class="grid gap-2"><input id="px-market-district" class="form-input" placeholder="منطقه / محله"><input id="px-market-value" class="form-input" inputmode="decimal" placeholder="قیمت هر متر"><input id="px-market-source" class="form-input" placeholder="منبع داده (الزامی)"><button onclick="ShirangiPlatform.addMarketFromUI()" class="py-2 rounded-xl bg-amber-700 font-bold">ثبت مشاهده بازار</button><div id="px-market-result" class="p-3 rounded-xl bg-slate-800 text-sm">منبع داده بدون تأیید به‌عنوان واقعیت قطعی نمایش داده نمی‌شود.</div></div></section>
      <section class="p-4 rounded-2xl bg-slate-900 border border-slate-700"><h3 class="font-black text-fuchsia-300 mb-3">AI Copilot مشاور</h3><div class="grid gap-2"><input id="px-ai-district" class="form-input" placeholder="منطقه مشتری"><input id="px-ai-budget" class="form-input" inputmode="decimal" placeholder="بودجه مشتری"><button onclick="ShirangiPlatform.runCopilotFromUI()" class="py-2 rounded-xl bg-fuchsia-700 font-bold">تحلیل و پیشنهاد</button><div id="px-ai-result" class="space-y-2 text-sm"></div></div></section>
    </div>`;
    renderPublishingList();
  }
  function renderPublishingList(){const r=global.document?.getElementById('px-publish-list');if(!r)return;r.innerHTML=list(KEYS.publishJobs).slice(0,8).map(j=>`<div class="p-2 rounded-lg bg-slate-800 border border-slate-700 flex justify-between gap-2"><span>${esc(j.title)} · ${esc(j.channels.join('، '))}</span><button class="text-cyan-300" onclick="ShirangiPlatform.executePublish('${esc(j.id)}')">آماده‌سازی</button></div>`).join('')||'<span class="text-slate-500">صف خالی است.</span>';}

  const api=Object.freeze({
    keys:KEYS, upsertMember,publishNetworkListing,requestNetworkAccess,networkMetrics,
    publishMarketplaceListing,createMarketplaceRequest,marketplaceSearch,
    queuePublish,executePublish,publishingMetrics,
    addMarketObservation,marketSnapshot,marketValuation,
    copilot,copilotHistory,render,
    addMemberFromUI(){return upsertMember({name:global.document?.getElementById('px-member-name')?.value,city:global.document?.getElementById('px-member-city')?.value,status:'active'}),render();},
    publishListingFromUI(){return publishNetworkListing({propertyId:global.document?.getElementById('px-listing-id')?.value,title:global.document?.getElementById('px-listing-title')?.value}),render();},
    createRequestFromUI(){const r=createMarketplaceRequest({name:global.document?.getElementById('px-request-name')?.value,phone:global.document?.getElementById('px-request-phone')?.value});render();return r;},
    queuePublishFromUI(){const r=queuePublish(global.document?.getElementById('px-publish-property')?.value,global.document?.getElementById('px-publish-channels')?.value);render();return r;},
    async executePublish(jobId){const r=await executePublish(jobId,{dryRun:true});renderPublishingList();return r;},
    addMarketFromUI(){const r=addMarketObservation({district:global.document?.getElementById('px-market-district')?.value,value:global.document?.getElementById('px-market-value')?.value,source:global.document?.getElementById('px-market-source')?.value});const out=global.document?.getElementById('px-market-result');if(out)out.textContent=r.ok?'مشاهده بازار ثبت شد؛ برای برآورد، داده‌های تأییدشده در اولویت‌اند.':`خطا: ${r.error}`;return r;},
    runCopilotFromUI(){const r=copilot({lead:{district:global.document?.getElementById('px-ai-district')?.value,budget:global.document?.getElementById('px-ai-budget')?.value}});const out=global.document?.getElementById('px-ai-result');if(out)out.innerHTML=`<div class="p-3 rounded-xl bg-slate-800">${r.recommendations.map(x=>`<div>🏠 ${esc(x.title)} · امتیاز ${fa(x.score)}</div>`).join('')||'فایل مناسبی پیدا نشد.'}</div><div class="p-3 rounded-xl bg-slate-800">اقدام بعدی: ${esc(r.nextAction)}</div><div class="p-3 rounded-xl bg-slate-800">پیشنهاد پیام: ${esc(r.draftMessage)}</div>`;return r;}
  });
  global.ShirangiPlatform=api;
  global.document?.addEventListener('DOMContentLoaded',()=>setTimeout(render,0));
})(typeof window!=='undefined'?window:globalThis);

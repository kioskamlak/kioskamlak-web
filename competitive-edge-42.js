/* Copyright (c) 2026 Shirangi. All rights reserved. */
/* Shirangi Competitive Edge 42 — four-layer market-winning foundation.
 * Layer 1: operational depth | Layer 2: real market intelligence
 * Layer 3: network effect | Layer 4: defensible data/AI moat.
 * Local-first, provider-agnostic, human approval for consequential actions.
 */
(function(global){
  'use strict';
  const VERSION='42.0.0';
  const NS='shirangi.edge42.v1';
  const MAX=2000;
  const now=()=>Date.now();
  const text=(v,max=500)=>String(v??'').trim().slice(0,max);
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,num(v)));
  let uidSeq=0;
  const memory=new Map();
  const uid=p=>`${p||'edge'}_${global.crypto?.randomUUID?.()||`${now().toString(36)}_${(++uidSeq).toString(36)}`}`;
  const read=(key,fallback)=>{try{return global.ShirangiStore?.readLegacy(key,key,memory.has(key)?memory.get(key):fallback)??(memory.has(key)?memory.get(key):fallback)}catch{return memory.has(key)?memory.get(key):fallback}};
  const write=(key,value)=>{try{if(global.ShirangiStore){global.ShirangiStore.write(key,value)}else{memory.set(key,value)}return true}catch{return false}};
  const list=(key)=>Array.isArray(read(key,[]))?read(key,[]):[];
  const append=(key,row,limit=MAX)=>{const rows=list(key);rows.unshift(row);write(key,rows.slice(0,limit));return row};
  const update=(key,id,fn)=>{const rows=list(key);const x=rows.find(r=>r.id===id);if(!x)return null;fn(x);x.updatedAt=now();write(key,rows);return x};
  const safe=(x)=>({id:x.id||uid('row'),...x});

  const K=Object.freeze({
    leads:`${NS}.leads`, touchpoints:`${NS}.touchpoints`, tasks:`${NS}.tasks`, docs:`${NS}.docs`, money:`${NS}.money`, teams:`${NS}.teams`,
    observations:`${NS}.observations`, comps:`${NS}.comps`, valuations:`${NS}.valuations`, alerts:`${NS}.alerts`,
    listings:`${NS}.listings`, referrals:`${NS}.referrals`, members:`${NS}.members`, trust:`${NS}.trust`,
    graph:`${NS}.graph`, outcomes:`${NS}.outcomes`, features:`${NS}.features`
  });

  // ---------------- Layer 1: operational depth ----------------
  class LeadOps {
    upsert(input={}){const phone=text(input.phone,40);const email=text(input.email,160).toLowerCase();const existing=list(K.leads).find(x=>(phone&&x.phone===phone)||(email&&x.email===email));
      if(existing)return update(K.leads,existing.id,x=>Object.assign(x,input,{dedupe:true}));
      return append(K.leads,safe({...input,phone,email,status:text(input.status||'new',30),createdAt:now(),lastActivityAt:now()})); }
    score(lead={}){let s=0;if(lead.phone||lead.email)s+=10;if(lead.budget||lead.requirements)s+=15;if(lead.replied)s+=15;if(lead.requestedViewing)s+=20;if(num(lead.viewingCount)>0)s+=Math.min(15,num(lead.viewingCount)*5);if(lead.offerMade)s+=20;if(lead.ownerIntent)s+=15;if(lead.lastActivityAt)s+=Math.max(0,10-Math.floor((now()-num(lead.lastActivityAt))/86400000));return {score:clamp(s),band:s>=75?'hot':s>=45?'warm':'cold'};}
    nextAction(lead={}){if(lead.offerMade)return 'negotiation';if(lead.requestedViewing)return 'viewing_followup';if(lead.replied)return 'send_matches';if(lead.phone||lead.email)return 'contact';return 'qualify';}
  }
  class Omnichannel {
    record(input={}){return append(K.touchpoints,safe({...input,channel:text(input.channel||'unknown',30),direction:text(input.direction||'inbound',20),body:text(input.body,4000),at:num(input.at)||now()}));}
    timeline(contactId){return list(K.touchpoints).filter(x=>x.contactId===contactId).sort((a,b)=>num(a.at)-num(b.at));}
    stats(contactId){const rows=this.timeline(contactId);return {total:rows.length,channels:[...new Set(rows.map(x=>x.channel))],inbound:rows.filter(x=>x.direction==='inbound').length,outbound:rows.filter(x=>x.direction==='outbound').length,lastAt:rows.at(-1)?.at||null};}
  }
  class Workflow {
    task(input={}){return append(K.tasks,safe({...input,title:text(input.title,200),status:text(input.status||'open',30),dueAt:num(input.dueAt),priority:clamp(input.priority,1,5),createdAt:now()}));}
    complete(id){return update(K.tasks,id,x=>x.status='done');}
    due(until=now()+86400000){return list(K.tasks).filter(x=>x.status!=='done'&&x.dueAt>0&&x.dueAt<=until).sort((a,b)=>a.dueAt-b.dueAt);}
    automation(event={}){const actions=[];if(event.type==='viewing_completed'&&event.customerId)actions.push(this.task({title:'پیگیری بعد از بازدید',customerId:event.customerId,propertyId:event.propertyId,dueAt:now()+4*3600000,priority:5,source:'automation'}));if(event.type==='lead_created'&&event.leadId)actions.push(this.task({title:'تماس اولیه لید',leadId:event.leadId,dueAt:now()+30*60000,priority:5,source:'automation'}));return actions;}
  }
  class DocumentOps {
    register(input={}){return append(K.docs,safe({...input,name:text(input.name,200),type:text(input.type||'unknown',50),status:'registered',createdAt:now()}));}
    checklist(deal={}){const required=['identity','ownership','property','contract','payment'];return required.map(type=>({type,complete:(deal.documents||[]).some(d=>d.type===type&&d.status==='verified')}));}
    verify(id,verifiedBy){return update(K.docs,id,x=>{x.status='verified';x.verifiedBy=text(verifiedBy,100);x.verifiedAt=now()});}
  }
  class FinanceOps {
    entry(input={}){const amount=num(input.amount);if(amount<0)return {ok:false,error:'invalid_amount'};return append(K.money,safe({...input,amount,type:text(input.type||'income',20),status:text(input.status||'posted',20),createdAt:now()}));}
    commission(deal={}){const gross=num(deal.grossCommission);const splits=(deal.splits||[]).map(x=>({...x,amount:gross*clamp(x.percent)/100}));return {gross,splits,total:splits.reduce((a,x)=>a+x.amount,0)};}
    cashflow(range={}){const from=num(range.from),to=num(range.to)||now();const rows=list(K.money).filter(x=>num(x.createdAt)>=from&&num(x.createdAt)<=to);return {income:rows.filter(x=>x.type==='income').reduce((a,x)=>a+num(x.amount),0),expense:rows.filter(x=>x.type==='expense').reduce((a,x)=>a+num(x.amount),0),count:rows.length};}
  }
  class TeamOps {
    addMember(input={}){return append(K.teams,safe({...input,role:text(input.role||'agent',40),active:true,createdAt:now()}));}
    assign(input={}){return append(K.teams,safe({...input,kind:'assignment',assignedAt:now()}));}
    leaderboard(stats=[]){return [...stats].map(x=>({...x,score:Math.round(clamp(num(x.conversion)*100)*.4+clamp(100-num(x.responseMinutes)*2)*.2+clamp(num(x.closed)*10)*.4)})).sort((a,b)=>b.score-a.score);}
  }

  // ---------------- Layer 2: real market intelligence ----------------
  class MarketData {
    observe(input={}){const row=safe({district:text(input.district,120),lat:num(input.lat),lng:num(input.lng),metric:text(input.metric||'sale_ppm2',50),value:num(input.value),source:text(input.source||'manual',80),sampleSize:num(input.sampleSize),observedAt:num(input.observedAt)||now(),createdAt:now()});if(row.value<0)return {ok:false,error:'invalid_value'};return append(K.observations,row);}
    query(filters={}){return list(K.observations).filter(x=>(!filters.district||x.district===filters.district)&&(!filters.metric||x.metric===filters.metric)&&(!filters.from||x.observedAt>=filters.from)&&(!filters.to||x.observedAt<=filters.to));}
    index(district,metric='sale_ppm2'){const rows=this.query({district,metric}).map(x=>x.value).filter(v=>v>0);if(!rows.length)return {district,metric,value:null,sampleSize:0};rows.sort((a,b)=>a-b);const med=rows[Math.floor(rows.length/2)];const mean=rows.reduce((a,b)=>a+b,0)/rows.length;return {district,metric,value:med,mean,sampleSize:rows.length,min:rows[0],max:rows.at(-1)};}
  }
  class ComparableEngine {
    add(input={}){return append(K.comps,safe({...input,area:num(input.area),price:num(input.price),district:text(input.district,120),observedAt:num(input.observedAt)||now()}));}
    find(subject={},limit=30){const area=num(subject.area);return list(K.comps).filter(x=>x.price>0&&x.area>0&&(!subject.district||x.district===subject.district)).map(x=>({...x,distance:Math.abs(x.area-area)/Math.max(1,area)})).sort((a,b)=>a.distance-b.distance).slice(0,limit);}
  }
  class AVM {
    estimate(input={}){const comps=new ComparableEngine().find(input,30);const ppm=comps.map(x=>x.price/x.area).filter(Number.isFinite);if(!ppm.length)return {ok:false,error:'insufficient_comps'};ppm.sort((a,b)=>a-b);const median=ppm[Math.floor(ppm.length/2)];const area=num(input.area);let factor=1-(Math.min(50,Math.max(0,num(input.age)))*.003);if(input.parking)factor*=1.025;if(input.elevator)factor*=1.01;const price=area*median*factor;const confidence=clamp(40+comps.length*2+((input.district)?15:0),40,96);const out={ok:true,price,low:price*(1-(100-confidence)/500),high:price*(1+(100-confidence)/500),ppm,confidence,comparables:comps};return append(K.valuations,{id:uid('avm'),...out,input,createdAt:now()});}
  }
  class MarketAlerts {
    scan(properties=[],observations=[]){const alerts=[];for(const p of properties){const old=num(p.previousPrice),cur=num(p.price||p.salePrice);if(old>0&&cur>0&&cur<old*.9)alerts.push({type:'price_drop',propertyId:p.id,pct:(1-cur/old)*100});if(num(p.updatedAt)>0&&now()-num(p.updatedAt)>45*86400000)alerts.push({type:'stale_listing',propertyId:p.id,days:Math.floor((now()-num(p.updatedAt))/86400000)});}return alerts.map(x=>append(K.alerts,safe({...x,createdAt:now()})));}
  }

  // ---------------- Layer 3: network effect ----------------
  class MLSNetwork {
    publish(input={}){return append(K.listings,safe({...input,status:'active',publishedAt:now(),version:1}));}
    update(id,patch={}){return update(K.listings,id,x=>Object.assign(x,patch,{version:num(x.version)+1}));}
    search(q={}){return list(K.listings).filter(x=>x.status==='active'&&(!q.district||x.district===q.district)&&(!q.maxPrice||num(x.price)<=num(q.maxPrice))&&(!q.minArea||num(x.area)>=num(q.minArea))).sort((a,b)=>num(b.updatedAt)-num(a.updatedAt));}
    matchNeed(need={},limit=20){const rows=this.search({district:need.district,maxPrice:need.maxBudget,minArea:need.minArea});return rows.map(x=>{let s=0;s+=need.district&&x.district===need.district?40:0;s+=need.maxBudget&&x.price<=need.maxBudget?30:0;s+=need.minArea&&x.area>=need.minArea?15:0;s+=need.bedrooms&&num(x.bedrooms)>=num(need.bedrooms)?15:0;return {...x,matchScore:s}}).sort((a,b)=>b.matchScore-a.matchScore).slice(0,limit);}
  }
  class ReferralNetwork {
    create(input={}){return append(K.referrals,safe({...input,status:'offered',createdAt:now()}));}
    accept(id,actor){return update(K.referrals,id,x=>{x.status='accepted';x.acceptedBy=text(actor,100);x.acceptedAt=now()});}
    score(input={}){return Math.round(clamp(num(input.rating)*20)+clamp(num(input.closed)*15)+clamp(num(input.responseScore)*.4));}
  }
  class Trust {
    member(input={}){return append(K.members,safe({...input,status:'pending',createdAt:now()}));}
    verify(id,method='manual'){return update(K.members,id,x=>{x.status='verified';x.verificationMethod=text(method,50);x.verifiedAt=now()});}
    reputation(memberId,events=[]){const e=events.filter(x=>x.memberId===memberId);let score=70;score+=e.filter(x=>x.type==='closed').length*2;score-=e.filter(x=>x.type==='complaint').length*15;score-=e.filter(x=>x.type==='cancelled').length*5;return {memberId,score:clamp(score),events:e.length};}
  }
  class Graph {
    link(fromType,fromId,toType,toId,relation,weight=1){return append(K.graph,safe({fromType,fromId,toType,toId,relation:text(relation,60),weight:num(weight),createdAt:now()}));}
    neighbors(type,id,relation){return list(K.graph).filter(x=>(x.fromType===type&&x.fromId===id)||(x.toType===type&&x.toId===id)).filter(x=>!relation||x.relation===relation);}
  }

  // ---------------- Layer 4: defensible moat ----------------
  class OutcomeLearning {
    record(input={}){return append(K.outcomes,safe({...input,outcome:text(input.outcome,80),createdAt:now()}));}
    winRate(filter={}){const rows=list(K.outcomes).filter(x=>!filter.type||x.type===filter.type);const wins=rows.filter(x=>x.outcome==='won'||x.outcome==='closed').length;return {wins,total:rows.length,rate:rows.length?wins/rows.length:0};}
    learn(featureVector={},outcome){return append(K.features,safe({featureVector,outcome,createdAt:now()}));}
  }
  class OpportunityEngine {
    rank({leads=[],properties=[],tasks=[],marketAlerts=[]}={}){const out=[];for(const l of leads){const s=new LeadOps().score(l).score;out.push({kind:'lead',id:l.id,score:s+((l.requestedViewing)?20:0),action:new LeadOps().nextAction(l)});}for(const p of properties){const stale=now()-num(p.updatedAt)>30*86400000;const drop=num(p.previousPrice)>num(p.price)&&num(p.previousPrice)>0;out.push({kind:'property',id:p.id,score:(stale?35:0)+(drop?40:0)+(num(p.inquiries)*2),action:drop?'review_price':'refresh_listing'});}for(const t of tasks.filter(x=>x.status!=='done'))out.push({kind:'task',id:t.id,score:t.priority*15+(t.dueAt&&t.dueAt<now()?40:0),action:'complete_or_reassign'});for(const a of marketAlerts)out.push({kind:'alert',id:a.id,score:a.type==='price_drop'?80:50,action:a.type});return out.sort((a,b)=>b.score-a.score).slice(0,50);}
  }
  class NetworkMoat {
    metrics(){const listings=list(K.listings),refs=list(K.referrals),members=list(K.members),graph=list(K.graph);return {activeListings:listings.filter(x=>x.status==='active').length,networkMembers:members.length,verifiedMembers:members.filter(x=>x.status==='verified').length,referrals:refs.length,acceptedReferrals:refs.filter(x=>x.status==='accepted').length,graphEdges:graph.length};}
    flywheel(){const m=this.metrics();return {supply:m.activeListings,demandSignals:list(K.leads).length,network:m.networkMembers,transactions:list(K.outcomes).filter(x=>x.outcome==='closed').length,loopScore:clamp(m.activeListings*.02+m.networkMembers*.05+m.acceptedReferrals*1+list(K.outcomes).filter(x=>x.outcome==='closed').length*2)};}
  }

  const api=Object.freeze({version:VERSION,keys:K,LeadOps:new LeadOps(),Omnichannel:new Omnichannel(),Workflow:new Workflow(),DocumentOps:new DocumentOps(),FinanceOps:new FinanceOps(),TeamOps:new TeamOps(),MarketData:new MarketData(),ComparableEngine:new ComparableEngine(),AVM:new AVM(),MarketAlerts:new MarketAlerts(),MLSNetwork:new MLSNetwork(),ReferralNetwork:new ReferralNetwork(),Trust:new Trust(),Graph:new Graph(),OutcomeLearning:new OutcomeLearning(),OpportunityEngine:new OpportunityEngine(),NetworkMoat:new NetworkMoat(),
    snapshot(){return {version:VERSION,operational:{leads:list(K.leads).length,tasks:list(K.tasks).length,touchpoints:list(K.touchpoints).length,documents:list(K.docs).length,moneyEntries:list(K.money).length},intelligence:{observations:list(K.observations).length,comparables:list(K.comps).length,valuations:list(K.valuations).length},network:{listings:list(K.listings).length,referrals:list(K.referrals).length,members:list(K.members).length},moat:{edges:list(K.graph).length,outcomes:list(K.outcomes).length,features:list(K.features).length}};}
  });
  global.ShirangiCompetitiveEdge42=api;
})(typeof globalThis!=='undefined'?globalThis:this);

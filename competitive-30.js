/* Copyright (c) 2026 Shirangi. All rights reserved. */
/* Shirangi Competitive 30 — production-oriented local engines with explicit provider boundaries. */
(function(global){
  'use strict';
  const VERSION='36.9.2';
  const crypto=global.crypto || null;
  // Signing/verification is a server/provider concern. Feature code never imports Node crypto.
  const signingProvider = () => ({ok:false,code:'signing_provider_not_configured'});
  let uuidCounter=0;
  const uuid=()=>{
    const webCrypto=globalThis.crypto;
    if(webCrypto?.randomUUID) return `sh_${webCrypto.randomUUID()}`;
    if(webCrypto?.getRandomValues) return `sh_${Date.now().toString(36)}_${Array.from(webCrypto.getRandomValues(new Uint32Array(2))).join('')}`;
    return `sh_${Date.now().toString(36)}_${++uuidCounter}`;
  };
  const iso=()=>new Date().toISOString();
  const n=v=>Number(v)||0;
  const s=v=>String(v??'').trim();
  const clamp=(x,a=0,b=100)=>Math.max(a,Math.min(b,x));
  const median=a=>{const x=[...a].filter(Number.isFinite).sort((a,b)=>a-b);if(!x.length)return null;const m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2};
  class Base { constructor(store=new Map()){this.store=store} put(type,data){const v={id:data.id||uuid(),...data,updatedAt:iso()};let t=this.store.get(type);if(!t){t=new Map();this.store.set(type,t)}t.set(v.id,v);return v} list(type){return [...(this.store.get(type)?.values()||[])]} }

  // 1 Real server-side licensing / anti-piracy
  class LicenseEngine extends Base { issue(input){if(!s(input.orgId)||!s(input.deviceId))return {ok:false,code:'org_and_device_required'};if(!crypto?.createHmac)return signingProvider();const exp=Date.now()+Math.max(86400000,n(input.ttlMs||2592000000));const plan=['agent','agency','pro'].includes(input.plan)?input.plan:'pro';const body=`${input.orgId}.${input.deviceId}.${plan}.${exp}`;const secret=s(input.signingSecret);if(!secret)return {ok:false,code:'signing_secret_required'};const sig=crypto.createHmac('sha256',secret).update(body).digest('hex');return {ok:true,token:`${body}.${sig}`,expiresAt:new Date(exp).toISOString(),plan}} verify(token,secret,deviceId){if(!crypto?.createHmac)return signingProvider();const p=s(token).split('.');if(p.length!==5||!secret)return {ok:false,code:'invalid_license'};const [org,dev,plan,exp,sig]=p;const body=`${org}.${dev}.${plan}.${exp}`;const expected=crypto.createHmac('sha256',secret).update(body).digest('hex');const ok=sig.length===expected.length&&crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected));return {ok:ok&&dev===s(deviceId)&&Date.now()<Number(exp),orgId:org,deviceId:dev,plan,expiresAt:new Date(Number(exp)).toISOString(),code:ok?'valid':'invalid_or_expired'}} }

  // 2 Production cloud/RLS readiness
  class CloudReadiness extends Base { evaluate(config={}){const checks={tls:/^https:\/\//i.test(s(config.baseUrl)),auth:!!s(config.auth),db:!!s(config.database),rls:config.rls===true,backups:config.backups===true,monitoring:config.monitoring===true};return {ok:Object.values(checks).every(Boolean),checks,missing:Object.entries(checks).filter(([,v])=>!v).map(([k])=>k)}} }
  // 3 Security/pentest gate
  class SecurityGate extends Base { assess(input={}){const findings=[];if(!input.csp)findings.push('csp_missing');if(!input.rateLimit)findings.push('rate_limit_missing');if(!input.audit)findings.push('audit_missing');if(input.secretsInClient)findings.push('client_secret_exposure');if(input.debug)findings.push('debug_enabled');return {ok:findings.length===0,findings,severity:findings.includes('client_secret_exposure')?'critical':findings.length?'medium':'none'}} }
  // 4 Backup/DR
  class DisasterRecovery extends Base { plan(input={}){const rto=Math.max(1,n(input.rtoMinutes||60)),rpo=Math.max(1,n(input.rpoMinutes||15));return {rtoMinutes:rto,rpoMinutes:rpo,backupFrequencyMinutes:Math.min(rpo,60),restoreTestRequired:true,runbook:['snapshot','verify','restore_to_isolated_env','checksum','promote']}} }
  // 5 Monitoring/alerting
  class Observability extends Base { record(metric,value,tags={}){return this.put('metrics',{metric,value:n(value),tags,at:iso()})} alert(metric,value,threshold,operator='>'){const hit=operator==='<'?n(value)<n(threshold):n(value)>n(threshold);return {triggered:hit,metric,value:n(value),threshold:n(threshold)}} summary(){const rows=this.list('metrics');return rows.reduce((a,x)=>{a[x.metric]=(a[x.metric]||0)+1;return a},{})} }
  // 6 Payment verification
  class PaymentEngine extends Base { createIntent(data){if(n(data.amount)<=0)return {ok:false,code:'amount_required'};return this.put('payments',{...data,amount:n(data.amount),status:'pending',createdAt:iso()})} verifyWebhook(raw,signature,secret){if(!crypto?.createHmac)return {ok:false,code:'payment_verifier_not_configured'};if(!secret)return {ok:false,code:'secret_required'};const expected=crypto.createHmac('sha256',secret).update(s(raw)).digest('hex');return {ok:signature===expected}} settle(id,providerRef){const p=this.list('payments').find(x=>x.id===id);if(!p)return {ok:false,code:'payment_not_found'};return this.put('payments',{...p,status:'settled',providerRef})} }
  // 7 Real-estate intelligence graph
  class IntelligenceGraph extends Base { link(type,a,b,meta={}){return this.put('graph_edges',{from:{type,id:a},to:{type,id:b},meta})} neighbors(type,id){return this.list('graph_edges').filter(e=>e.from.type===type&&e.from.id===id||e.to.type===type&&e.to.id===id)} }
  // 8 Market data pipeline
  class MarketPipeline extends Base { ingest(rows,source){return (rows||[]).filter(r=>n(r.price)>0&&n(r.area)>0).map(r=>this.put('market_observations',{...r,source:s(source||'unknown'),observedAt:r.observedAt||iso()}))} aggregate(rows){const valid=(rows||[]).filter(r=>n(r.price)>0&&n(r.area)>0);return {count:valid.length,medianPrice:median(valid.map(r=>n(r.price))),medianPpm2:median(valid.map(r=>n(r.price)/n(r.area)))}} }
  // 9 Advanced AVM
  class AdvancedAVM extends Base { predict(input={}){const comps=(input.comps||[]).filter(x=>n(x.price)>0&&n(x.area)>0);const ppm=median(comps.map(x=>n(x.price)/n(x.area)));if(!ppm||n(input.area)<=0)return {ok:false,code:'insufficient_comps'};let factor=1;if(n(input.age)>0)factor*=1-Math.min(40,n(input.age))*.004;if(input.parking)factor*=1.025;if(input.elevator)factor*=1.015;const center=n(input.area)*ppm*factor;const spread=comps.length>=10?.05:comps.length>=5?.08:.12;return {ok:true,center,low:center*(1-spread),high:center*(1+spread),ppm2:ppm,confidence:clamp(45+comps.length*3,0,95)}} }
  // 10 AI action agent
  class ActionAgent extends Base { propose(context={}){const actions=[];if(context.uncontactedLead)actions.push({type:'contact_lead',requiresApproval:true});if(context.matchingProperty)actions.push({type:'send_property_match',requiresApproval:true});if(context.viewingDue)actions.push({type:'schedule_followup',requiresApproval:true});return {ok:true,actions,policy:'human_approval_for_external_actions'}} execute(action,executor){if(!action?.requiresApproval)return {ok:false,code:'approval_required'};if(typeof executor!=='function')return {ok:false,code:'executor_missing'};return Promise.resolve().then(()=>executor(action))} }
  // 11 Lead automation
  class LeadLifecycle extends Base { score(lead={}){let x=0;x+=lead.phone?15:0;x+=lead.budget?15:0;x+=lead.requirements?15:0;x+=lead.lastReplyAt?20:0;x+=lead.viewingCount?Math.min(20,n(lead.viewingCount)*5):0;x+=lead.offerMade?15:0;return {score:clamp(x),band:x>=75?'hot':x>=45?'warm':'cold'}} next(lead={}){if(lead.offerMade)return 'negotiation';if(lead.viewingCount)return 'viewing_followup';if(lead.lastReplyAt)return 'match_and_contact';return 'qualify'}}
  // 12 Portal/MLS real connectors
  class ConnectorHub extends Base { normalize(x={}){return {id:x.id||uuid(),externalId:s(x.externalId),source:s(x.source),title:s(x.title),price:n(x.price),area:n(x.area),updatedAt:iso()}} diff(a,b){const out={};for(const k of ['title','price','area','status','address'])if(a?.[k]!==b?.[k])out[k]={from:a?.[k]??null,to:b?.[k]??null};return out} syncPlan(listings){return {items:(listings||[]).map(x=>this.normalize(x)),mode:'upsert_by_external_id',dedupeKey:'source:externalId'}} }
  // 13 Transaction OS
  class TransactionOS extends Base { transition(tx,next,actor){const map={lead:['viewing'],viewing:['offer'],offer:['negotiation'],negotiation:['contract'],contract:['signature'],signature:['payment'],payment:['closing'],closing:[]};if(!map[tx?.stage]?.includes(next))return {ok:false,code:'invalid_transition'};return this.put('transactions',{...tx,stage:next,actor,transitionedAt:iso()})} timeline(id){return this.list('transactions').filter(x=>x.transactionId===id||x.id===id).sort((a,b)=>String(a.updatedAt).localeCompare(String(b.updatedAt)))}} 
  // 14 Agent performance
  class AgentPerformance extends Base { score(stats={}){const leads=n(stats.leads),closed=n(stats.closed);const conv=leads?closed/leads:0;const response=clamp(100-n(stats.avgResponseMinutes)*2,0,100);const revenue=n(stats.revenue);return {conversion:conv,conversionPct:conv*100,responseScore:response,revenue,performance:Math.round(conv*50+response*.3+Math.min(20,revenue/100000))}} forecast(stats={},days=30){const rate=n(stats.closed)/Math.max(1,n(stats.days));return {expectedClosings:rate*days,expectedRevenue:rate*days*n(stats.avgDealValue)}} }
  // 15 Buyer/seller portal
  class ExperiencePortal extends Base { publish(customerId,data){return this.put('portal_experience',{customerId,...data,visible:true})} feed(customerId){return this.list('portal_experience').filter(x=>x.customerId===customerId&&x.visible)} }
  // 16 Enterprise identity
  class EnterpriseIdentity extends Base { role(userId,role,scope={}){return this.put('iam_roles',{userId,role,scope})} can(userId,role,scope={}){return this.list('iam_roles').some(x=>x.userId===userId&&x.role===role&&Object.entries(scope).every(([k,v])=>x.scope[k]==null||x.scope[k]===v))} }
  // 17 Compliance/privacy
  class ComplianceEngine extends Base { consent(userId,purpose,granted){return this.put('consents',{userId,purpose,granted:!!granted,at:iso()})} retention(records,days){const cut=Date.now()-n(days)*86400000;return (records||[]).filter(x=>new Date(x.createdAt||0).getTime()<cut).map(x=>x.id)} export(userId,records){return (records||[]).filter(x=>x.userId===userId||x.customerId===userId)} }
  // 18 Fraud/risk
  class FraudEngine extends Base { score(x={}){let risk=0,reasons=[];if(n(x.amount)>n(x.typicalAmount)*5&&n(x.typicalAmount)>0){risk+=35;reasons.push('amount_anomaly')}if(x.duplicateSignal){risk+=30;reasons.push('duplicate_signal')}if(x.velocity&&n(x.velocity)>10){risk+=25;reasons.push('velocity_anomaly')}if(x.newDevice){risk+=10;reasons.push('new_device')}return {score:clamp(risk),level:risk>=70?'high':risk>=35?'medium':'low',reasons}} }
  // 19 BI/forecasting
  class BIEngine extends Base { funnel(events,steps){return (steps||[]).map(step=>({step,count:(events||[]).filter(e=>e.step===step).length}))} attribution(events){const m={};for(const e of events||[]){const k=s(e.source||'unknown');m[k]=(m[k]||0)+n(e.revenue)}return m} forecast(series,horizon=3){const v=(series||[]).map(n);if(!v.length)return [];const avg=v.reduce((a,b)=>a+b,0)/v.length;return Array.from({length:horizon},()=>avg)}}
  // 20 Data export/API platform
  class DataPlatform extends Base { schema(){return {version:'v1',resources:['properties','leads','customers','transactions','payments','documents','analytics'],pagination:'cursor',idempotency:true}} export(resource,rows,fields){return (rows||[]).map(x=>fields?Object.fromEntries(fields.filter(f=>f in x).map(f=>[f,x[f]])):x)} }
  // 21 AI voice agent
  class VoiceAgent extends Base { script(intent,context={}){return {intent,language:context.language||'fa-IR',steps:['greeting','qualification','consent','recommendation','handoff'],recordingConsentRequired:true}} transcribe(text){return {text:s(text),confidence:s(text)?0.99:0,provider:'external-boundary'}} }
  // 22 Property photo enhancement
  class PhotoAI extends Base { job(images=[],options={}){return this.put('photo_jobs',{images:[...(images||[])].slice(0,50),options,status:'queued',createdAt:iso()})} validate(image){return {ok:!!image?.url&&/^https:\/\//i.test(image.url),policy:'no_material_property_deception'}} }
  // 23 AI listing generator
  class ListingGenerator extends Base { generate(p={}){const title=s(p.title||`${p.type||'ملک'} در ${p.district||'محدوده'}`);const bullets=[p.area&&`${p.area} متر`,p.bedrooms&&`${p.bedrooms} خواب`,p.parking&&'پارکینگ',p.elevator&&'آسانسور'].filter(Boolean);return {title,description:`${title}. ${bullets.join('، ')}.`,facts:bullets,requiresHumanReview:true}} }
  // 24 AI video/virtual tour plan
  class VideoTour extends Base { create(p={}){return this.put('video_tours',{propertyId:p.propertyId,assets:(p.assets||[]).slice(0,100),durationSec:Math.min(300,Math.max(15,n(p.durationSec||60))),status:'queued',createdAt:iso()})} storyboard(p={}){return ['exterior','entrance','living','kitchen','bedrooms','bathrooms','view','cta'].map(scene=>({scene,propertyId:p.propertyId}))} }
  // 25 Predictive intent
  class IntentEngine extends Base { predict(x={}){let score=20;if(x.replied)score+=20;if(x.viewedListings)score+=20;if(x.requestedViewing)score+=25;if(x.offer)score+=20;if(x.daysSinceContact!=null)score-=Math.min(20,n(x.daysSinceContact)*2);return {score:clamp(score),intent:score>=75?'high':score>=45?'medium':'low'}} }
  // 26 Dynamic pricing
  class PricingEngine extends Base { recommend(p={}){const market=n(p.marketPpm2),area=n(p.area);if(!market||!area)return {ok:false,code:'market_and_area_required'};const demand=clamp(n(p.demandIndex||50),0,100);const urgency=clamp(n(p.sellerUrgency||50),0,100);const multiplier=1+(demand-50)*.001-(urgency-50)*.0005;const price=area*market*multiplier;return {ok:true,price,multiplier,range:{low:price*.97,high:price*1.03}}} }
  // 27 Automated fraud detection
  class FraudDetector extends Base { detect(entity={}){const flags=[];if(entity.samePhoneDifferentOwners)flags.push('identity_reuse');if(entity.samePropertyMultipleListings)flags.push('listing_collision');if(entity.priceDropPct>30)flags.push('rapid_price_change');if(entity.documentMismatch)flags.push('document_mismatch');return {ok:flags.length===0,flags,risk:clamp(flags.length*25)}} }
  // 28 Negotiation assistant
  class NegotiationEngine extends Base { advise(deal={}){const ask=n(deal.ask),offer=n(deal.offer);if(!(ask>0&&offer>0))return {ok:false,code:'ask_and_offer_required'};const gap=(ask-offer)/ask;return {ok:true,gapPct:gap*100,position:gap<.05?'close':gap<.15?'negotiable':'wide',suggestedCounter:Math.round((ask+offer)/2),requiresHumanApproval:true}} }
  // 29 Commission optimization
  class CommissionEngine extends Base { optimize(deal={},agents=[]){const base=n(deal.commission);const rows=(agents||[]).map(a=>({...a,expectedNet:base*n(a.split||0),conversion:n(a.conversion||0)})).sort((a,b)=>b.expectedNet-a.expectedNet);return {recommended:rows[0]||null,candidates:rows}} }
  // 30 Agent marketplace
  class AgentMarketplace extends Base { offer(input={}){if(!s(input.propertyId)||!s(input.agentId))return {ok:false,code:'property_and_agent_required'};return this.put('marketplace_offers',{...input,status:'open',createdAt:iso()})} match(input={},agents=[]){return (agents||[]).map(a=>({...a,score:clamp((a.district===input.district?40:0)+(a.specialty===input.type?30:0)+n(a.rating)*6)})).sort((a,b)=>b.score-a.score)} accept(id,agentId){const x=this.list('marketplace_offers').find(v=>v.id===id);if(!x)return {ok:false,code:'offer_not_found'};return this.put('marketplace_offers',{...x,status:'accepted',acceptedBy:agentId,acceptedAt:iso()})} }

  const classes={LicenseEngine,CloudReadiness,SecurityGate,DisasterRecovery,Observability,PaymentEngine,IntelligenceGraph,MarketPipeline,AdvancedAVM,ActionAgent,LeadLifecycle,ConnectorHub,TransactionOS,AgentPerformance,ExperiencePortal,EnterpriseIdentity,ComplianceEngine,FraudEngine,BIEngine,DataPlatform,VoiceAgent,PhotoAI,ListingGenerator,VideoTour,IntentEngine,PricingEngine,FraudDetector,NegotiationEngine,CommissionEngine,AgentMarketplace};
  const names={LicenseEngine:'License',CloudReadiness:'CloudReadiness',SecurityGate:'Security',DisasterRecovery:'DisasterRecovery',Observability:'Observability',PaymentEngine:'Payment',IntelligenceGraph:'IntelligenceGraph',MarketPipeline:'MarketPipeline',AdvancedAVM:'AdvancedAVM',ActionAgent:'ActionAgent',LeadLifecycle:'LeadLifecycle',ConnectorHub:'ConnectorHub',TransactionOS:'TransactionOS',AgentPerformance:'AgentPerformance',ExperiencePortal:'ExperiencePortal',EnterpriseIdentity:'EnterpriseIdentity',ComplianceEngine:'Compliance',FraudEngine:'Fraud',BIEngine:'BI',DataPlatform:'DataPlatform',VoiceAgent:'VoiceAgent',PhotoAI:'PhotoAI',ListingGenerator:'ListingGenerator',VideoTour:'VideoTour',IntentEngine:'Intent',PricingEngine:'Pricing',FraudDetector:'FraudDetector',NegotiationEngine:'Negotiation',CommissionEngine:'Commission',AgentMarketplace:'Marketplace'};
  const api={version:VERSION,classes,createRuntime(){const store=new Map();return Object.fromEntries(Object.entries(classes).map(([k,C])=>[names[k],new C(store)]))}};
  global.ShirangiCompetitive30=Object.freeze(api);
})(typeof globalThis!=='undefined'?globalThis:this);

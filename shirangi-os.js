/* Copyright (c) 2026 Shirangi. All rights reserved. */
/* Shirangi — Top 20 Production Engines
 * Local deterministic domain layer. External providers are explicit adapters:
 * no fake delivery, payments, signatures, MLS, or messaging.
 */
(function (global) {
  "use strict";

  const crypto = global.crypto || require("crypto");
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : require("crypto").randomUUID());
  const now = () => new Date().toISOString();

  const digits = s => String(s ?? "")
    .replace(/[۰-۹]/g, c => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)))
    .replace(/[٠-٩]/g, c => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)));
  const norm = s => digits(s).toLowerCase().trim().replace(/\s+/g, " ");
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  class Store {
    constructor() { this.tables = new Map(); }
    table(name) { if (!this.tables.has(name)) this.tables.set(name, new Map()); return this.tables.get(name); }
    put(table, value) { const id = value.id || uuid(); const v = {...value, id, updated_at: now()}; this.table(table).set(id, v); return v; }
    get(table, id) { return this.table(table).get(id) || null; }
    list(table, predicate = () => true) { return [...this.table(table).values()].filter(predicate); }
    delete(table, id) { return this.table(table).delete(id); }
  }

  class Audit {
    constructor(store) { this.store = store; }
    record(event) { return this.store.put("audit_log", {...event, created_at: now()}); }
  }

  class ProviderRegistry {
    constructor() { this.providers = new Map(); }
    register(kind, provider) { this.providers.set(kind, provider); }
    status(kind) {
      const p = this.providers.get(kind);
      return p ? {configured:true, kind} : {configured:false, kind, code:`${kind}_provider_not_configured`};
    }
    async call(kind, method, payload) {
      const p = this.providers.get(kind);
      if (!p || typeof p[method] !== "function")
        return {ok:false, code:`${kind}_provider_not_configured`};
      return p[method](payload);
    }
  }

  // 1. Market data
  class MarketEngine {
    snapshot(records) {
      const rows = (records || []).filter(r => Number(r.price) > 0 && Number(r.area) > 0);
      if (!rows.length) return {count:0, median_price:null, median_ppm2:null, confidence:0};
      const median = a => { const x=[...a].sort((a,b)=>a-b), m=Math.floor(x.length/2); return x.length%2?x[m]:(x[m-1]+x[m])/2; };
      const prices = rows.map(r=>+r.price), ppm2 = rows.map(r=>+r.price/+r.area);
      return {count:rows.length, median_price:median(prices), median_ppm2:median(ppm2),
        min_price:Math.min(...prices), max_price:Math.max(...prices),
        confidence:clamp(0.35 + Math.log10(rows.length + 1)*0.3, 0, 0.95)};
    }
    history(records) {
      return [...(records||[])].sort((a,b)=>String(a.date||"").localeCompare(String(b.date||"")));
    }
  }

  // 2. MLS / portal hub
  class ListingHub {
    normalize(listing) {
      return {...listing, id:listing.id||uuid(), title:String(listing.title||"").trim(),
        price:Number(listing.price||0), area:Number(listing.area||0),
        updated_at:now()};
    }
    diff(before, after) {
      const keys = ["title","price","area","district","status"];
      const changes = {};
      for (const k of keys) if ((before||{})[k] !== (after||{})[k]) changes[k]={from:(before||{})[k]??null,to:(after||{})[k]??null};
      return changes;
    }
    dedupe(listings) {
      const seen = new Map(), out=[];
      for (const l of listings||[]) {
        const key = norm(`${l.address||""}|${l.area||""}|${l.price||""}|${l.bedrooms||""}`);
        if (!seen.has(key)) { seen.set(key,l); out.push(l); }
      }
      return out;
    }
  }

  // 3. Omnichannel
  class Omnichannel {
    constructor(providers, audit) { this.providers=providers; this.audit=audit; }
    async send(channel, message) {
      const res = await this.providers.call(channel, "send", message);
      this.audit.record({type:"message_attempt", channel, message_id:message.id||uuid(), result:res.code||"ok"});
      return res;
    }
  }

  // 4. VoIP / call center
  class CallCenter {
    constructor(store, audit) { this.store=store; this.audit=audit; }
    start(call) { const c=this.store.put("calls",{...call,status:"started",started_at:now()}); this.audit.record({type:"call_started",call_id:c.id}); return c; }
    end(id, data={}) { const c=this.store.get("calls",id); if(!c) return null; const v=this.store.put("calls",{...c,...data,status:"ended",ended_at:now()}); this.audit.record({type:"call_ended",call_id:id}); return v; }
    transcript(callId, text) { return this.store.put("call_transcripts",{id:uuid(),call_id:callId,text:String(text||"").trim(),created_at:now()}); }
  }

  // 5. AI agent boundary
  class AIAgent {
    constructor(store, providers, audit) { this.store=store; this.providers=providers; this.audit=audit; }
    session(userId, context={}) { return this.store.put("ai_sessions",{user_id:userId,context,history:[],status:"active"}); }
    async respond(sessionId, text) {
      const s=this.store.get("ai_sessions",sessionId); if(!s) return {ok:false,code:"session_not_found"};
      const history=[...(s.history||[]),{role:"user",content:String(text||""),at:now()}];
      const llm=await this.providers.call("llm","respond",{messages:history,context:s.context});
      const answer=llm.ok ? llm.answer : {type:"local_intent",text:"درخواست دریافت شد؛ برای پاسخ هوشمند خارجی، Provider باید تنظیم شود."};
      const next={...s,history:[...history,{role:"assistant",content:typeof answer==="string"?answer:JSON.stringify(answer),at:now()}]};
      this.store.put("ai_sessions",next); this.audit.record({type:"ai_response",session_id:sessionId,provider:llm.ok?"llm":"local"});
      return {ok:true,answer,provider:llm.ok?"llm":"local"};
    }
  }

  // 6. Search
  class SearchEngine {
    search(items, query, filters={}) {
      const q=norm(query), terms=q.split(" ").filter(Boolean);
      const score=item => {
        const text=norm([item.title,item.description,item.address,item.district,item.city].filter(Boolean).join(" "));
        let s=terms.reduce((n,t)=>n+(text.includes(t)?1:0),0);
        if(filters.min_price!=null && Number(item.price)<filters.min_price) return -1;
        if(filters.max_price!=null && Number(item.price)>filters.max_price) return -1;
        if(filters.min_area!=null && Number(item.area)<filters.min_area) return -1;
        if(filters.max_area!=null && Number(item.area)>filters.max_area) return -1;
        if(filters.bedrooms!=null && Number(item.bedrooms)!==Number(filters.bedrooms)) return -1;
        return s;
      };
      return (items||[]).map(x=>({...x,_score:score(x)})).filter(x=>x._score>=0).sort((a,b)=>b._score-a._score);
    }
  }

  // 7. Workflow
  class WorkflowEngine {
    constructor(store,audit) { this.store=store; this.audit=audit; }
    define(workflow) { return this.store.put("workflows",{...workflow,status:"active"}); }
    run(workflowId,input={}) {
      const wf=this.store.get("workflows",workflowId); if(!wf) return {ok:false,code:"workflow_not_found"};
      const run=this.store.put("workflow_runs",{workflow_id:workflowId,input,state:"queued",attempts:0});
      this.audit.record({type:"workflow_queued",run_id:run.id,workflow_id:workflowId}); return run;
    }
    transition(runId,state,data={}) {
      const r=this.store.get("workflow_runs",runId); if(!r) return null;
      const v=this.store.put("workflow_runs",{...r,...data,state});
      this.audit.record({type:"workflow_transition",run_id:runId,state}); return v;
    }
  }

  // 8. Webhooks
  class WebhookEngine {
    constructor(store,audit,secret="") { this.store=store; this.audit=audit; this.secret=secret; }
    verify(raw, signature) {
      if(!this.secret) return {ok:false,code:"webhook_secret_not_configured"};
      const h=require("crypto").createHmac("sha256",this.secret).update(String(raw)).digest("hex");
      return {ok: signature===h};
    }
    ingest(event) {
      const id=event.id||uuid(), existing=this.store.get("webhook_events",id);
      if(existing) return {...existing,duplicate:true};
      const v=this.store.put("webhook_events",{...event,id,status:"received",received_at:now()});
      this.audit.record({type:"webhook_received",event_id:id}); return v;
    }
  }

  // 9. Transaction
  class TransactionEngine {
    constructor(store,audit) { this.store=store; this.audit=audit; }
    transition(id,next,actor) {
      const allowed={lead:["viewing"],viewing:["offer"],offer:["negotiation"],negotiation:["contract"],contract:["signature"],signature:["payment"],payment:["closing"],closing:[]};
      const t=this.store.get("transactions",id); if(!t) return {ok:false,code:"transaction_not_found"};
      if(!(allowed[t.stage]||[]).includes(next)) return {ok:false,code:"invalid_transition"};
      const v=this.store.put("transactions",{...t,stage:next});
      this.audit.record({type:"transaction_transition",transaction_id:id,from:t.stage,to:next,actor}); return {ok:true,transaction:v};
    }
  }

  // 10. E-sign provider boundary
  class ESign {
    constructor(providers) { this.providers=providers; }
    createEnvelope(payload) { return this.providers.call("esign","createEnvelope",payload); }
  }

  // 11. Documents
  class Documents {
    constructor(store,audit) { this.store=store; this.audit=audit; }
    add(doc) { const v=this.store.put("documents",{...doc,version:Number(doc.version||1)}); this.audit.record({type:"document_added",document_id:v.id}); return v; }
    newVersion(id,patch) { const d=this.store.get("documents",id); if(!d) return null; return this.add({...d,...patch,id:uuid(),version:d.version+1,parent_id:d.id}); }
  }

  // 12. Document AI (deterministic extraction baseline)
  class DocumentAI {
    extract(text) {
      const t=digits(text);
      const money=t.match(/(?:€|\$|USD|EUR)?\s*([\d][\d\s.,]{2,})/i);
      const dates=t.match(/\b(20\d{2}[-/.]\d{1,2}[-/.]\d{1,2})\b/);
      return {price_candidate:money?Number(money[1].replace(/[^\d]/g,"")):null,date_candidate:dates?dates[1]:null};
    }
  }

  // 13. Financial OS
  class Finance {
    constructor(store,audit) { this.store=store; this.audit=audit; }
    commission(deal, rate) { const amount=Number(deal.amount||0), r=Number(rate||0); return {gross:amount,rate:r,commission:amount*r}; }
    invoice(data) { const v=this.store.put("invoices",{...data,status:"draft"}); this.audit.record({type:"invoice_created",invoice_id:v.id}); return v; }
    payout(data) { const v=this.store.put("payouts",{...data,status:"pending"}); this.audit.record({type:"payout_created",payout_id:v.id}); return v; }
  }

  // 14. Customer portal
  class CustomerPortal {
    constructor(store) { this.store=store; }
    add(customerId,item) { return this.store.put("portal_items",{...item,customer_id:customerId}); }
    list(customerId) { return this.store.list("portal_items",x=>x.customer_id===customerId); }
  }

  // 15. Enterprise IAM
  class IAM {
    constructor(store,audit) { this.store=store; this.audit=audit; }
    grant(userId,role,scope={}) { const v=this.store.put("permissions",{user_id:userId,role,scope}); this.audit.record({type:"permission_granted",permission_id:v.id}); return v; }
    can(userId,role,scope={}) {
      return this.store.list("permissions",p=>p.user_id===userId && p.role===role)
        .some(p=>Object.entries(scope).every(([k,v])=>p.scope[k]==null || p.scope[k]===v));
    }
  }

  // 16. Audit
  // Provided by Audit class.

  // 17. Compliance
  class Compliance {
    constructor(store) { this.store=store; }
    consent(userId,purpose,granted) { return this.store.put("consents",{user_id:userId,purpose,granted:!!granted,at:now()}); }
    exportUser(userId) {
      const result={};
      for(const [name,table] of this.store.tables) result[name]=[...table.values()].filter(x=>x.user_id===userId||x.customer_id===userId);
      return result;
    }
  }

  // 18. Fraud/risk baseline
  class RiskEngine {
    score(entity={}) {
      let score=0; const reasons=[];
      if(entity.price!=null && Number(entity.price)<=0){score+=40;reasons.push("invalid_price");}
      if(entity.phone && norm(entity.phone).replace(/\D/g,"").length<7){score+=20;reasons.push("invalid_phone");}
      if(entity.duplicate_count>0){score+=30;reasons.push("duplicate_signal");}
      return {score:clamp(score,0,100),level:score>=70?"high":score>=35?"medium":"low",reasons};
    }
  }

  // 19. Analytics / attribution
  class Analytics {
    constructor(store) { this.store=store; }
    event(event) { return this.store.put("analytics_events",{...event,occurred_at:event.occurred_at||now()}); }
    funnel(events,steps) {
      return (steps||[]).map(step=>({step,count:(events||[]).filter(e=>e.step===step).length}));
    }
    roi(revenue,cost) { return {revenue:Number(revenue||0),cost:Number(cost||0),roi:Number(cost)?(Number(revenue)-Number(cost))/Number(cost):null}; }
  }

  // 20. Production infrastructure
  class Reliability {
    retry(fn, attempts=3) {
      return Promise.resolve().then(async()=>{ let last; for(let i=0;i<attempts;i++){try{return await fn(i+1)}catch(e){last=e}} throw last; });
    }
    idempotencyKey(scope,payload) {
      return require("crypto").createHash("sha256").update(scope+"|"+JSON.stringify(payload)).digest("hex");
    }
  }

  const api = {
    version:(global.ShirangiVersion?.runtime||"42.6.7"),
    createRuntime() {
      const store=new Store(), audit=new Audit(store), providers=new ProviderRegistry();
      return {
        store,audit,providers,
        market:new MarketEngine(),
        listingHub:new ListingHub(),
        omnichannel:new Omnichannel(providers,audit),
        calls:new CallCenter(store,audit),
        ai:new AIAgent(store,providers,audit),
        search:new SearchEngine(),
        workflow:new WorkflowEngine(store,audit),
        webhooks:new WebhookEngine(store,audit),
        transactions:new TransactionEngine(store,audit),
        esign:new ESign(providers),
        documents:new Documents(store,audit),
        documentAI:new DocumentAI(),
        finance:new Finance(store,audit),
        portal:new CustomerPortal(store),
        iam:new IAM(store,audit),
        compliance:new Compliance(store),
        risk:new RiskEngine(),
        analytics:new Analytics(store),
        reliability:new Reliability()
      };
    }
  };

  if (typeof module !== "undefined" && module.exports) module.exports=api;
  global.ShirangiTop20 = api;
})(typeof globalThis !== "undefined" ? globalThis : this);


/* Compact product facade: the only user-facing entry point for the ten OS.
 * Domain engines above remain implementation details; no duplicate runtime.
 */
(function (global) {
  "use strict";
  const base = global.ShirangiTop20;
  if (!base) throw new Error("ShirangiTop20 is required");
  const ALLOWED_CHANNELS = Object.freeze(["whatsapp","telegram","instagram"]);

  class Messaging {
    constructor(runtime) { this.runtime = runtime; }
    channels() { return [...ALLOWED_CHANNELS]; }
    async send(channel, payload={}) {
      channel=String(channel||"").toLowerCase();
      if (!ALLOWED_CHANNELS.includes(channel))
        return {ok:false,code:"channel_not_supported",allowed:[...ALLOWED_CHANNELS]};
      return this.runtime.omnichannel.send(channel,{...payload,channel});
    }
    async sendAll(payload={}) {
      const out={};
      for (const c of ALLOWED_CHANNELS) out[c]=await this.send(c,payload);
      return out;
    }
  }

  const createBase=base.createRuntime;
  base.createRuntime=function(){
    const runtime=createBase();
    if (global.ShirangiCompetitive30) runtime.competitive30=global.ShirangiCompetitive30.createRuntime();
    runtime.messaging=new Messaging(runtime);
    runtime.os=Object.freeze({
      property:Object.freeze({market:runtime.market,listings:runtime.listingHub,search:runtime.search}),
      crm:Object.freeze({calls:runtime.calls,workflow:runtime.workflow,portal:runtime.portal}),
      ai:runtime.ai,
      marketing:Object.freeze({messaging:runtime.messaging,analytics:runtime.analytics}),
      transaction:Object.freeze({transactions:runtime.transactions,documents:runtime.documents,esign:runtime.esign}),
      finance:runtime.finance,
      brokerage:Object.freeze({iam:runtime.iam,risk:runtime.risk}),
      intelligence:Object.freeze({market:runtime.market,documentAI:runtime.documentAI,analytics:runtime.analytics}),
      enterprise:Object.freeze({iam:runtime.iam,compliance:runtime.compliance,audit:runtime.audit}),
      integration:Object.freeze({messaging:runtime.messaging,webhooks:runtime.webhooks,providers:runtime.providers,reliability:runtime.reliability})
    });
    return runtime;
  };
  global.ShirangiOS=Object.freeze({
    version:(global.ShirangiVersion?.runtime||"42.6.7"),
    allowedMessagingChannels:[...ALLOWED_CHANNELS],
    createRuntime:base.createRuntime
  });
})(typeof globalThis!=="undefined"?globalThis:this);

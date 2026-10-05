/* Copyright (c) 2026 Shirangi. All rights reserved. */
/**
 * Shirangi AI Agent — explainable, local-first orchestration.
 * No network, no provider credentials, no hidden side effects.
 */
(function (global) {
  'use strict';

  const VERSION = '36.6.0';

  const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
  const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

  function normalizeText(input) {
    let s = String(input ?? '')
      .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
      .replace(/ۀ/g, 'ه').replace(/ة/g, 'ه')
      .replace(/[\u200c\u200d]/g, ' ')
      .trim();
    s = s.replace(/[۰-۹]/g, c => String(PERSIAN_DIGITS.indexOf(c)))
         .replace(/[٠-٩]/g, c => String(ARABIC_DIGITS.indexOf(c)));
    return s.replace(/\s+/g, ' ');
  }

  function num(s) {
    let value = String(s??'').replace(/[۰-۹]/g,c=>String(PERSIAN_DIGITS.indexOf(c))).replace(/[٠-٩]/g,c=>String(ARABIC_DIGITS.indexOf(c))).replace(/٫/g,'.').trim();
    if(/^[-+]?\d{1,3}(?:[,٬،/]\d{3})+$/.test(value)) value=value.replace(/[,٬،/]/g,'');
    else value=value.replace(/[,٬،\s]/g,'');
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function parseMoneyToken(raw) {
    const ctx = String(raw).toLowerCase();
    const match = ctx.match(/\d+(?:\.\d+)?/);
    const n = match ? num(match[0]) : null;
    if (n == null || !Number.isFinite(n)) return null;
    return /میلیارد|میليارد|billion|bn/.test(ctx) ? n * 1e9
      : /میلیون|ميليون|million|mn/.test(ctx) ? n * 1e6
      : n;
  }

  function extractRange(s, patterns, mapper) {
    for (const re of patterns) {
      const m = s.match(re);
      if (m) {
        const a = mapper(m[1]), b = mapper(m[2]);
        if (a != null && b != null) return [Math.min(a,b), Math.max(a,b)];
      }
    }
    return null;
  }

  function parseNeed(input) {
    const s = normalizeText(input);
    const out = { raw: String(input ?? ''), normalized: s, confidence: 0.2, signals: [] };

    const areaRange = extractRange(s, [
      /(\d+(?:\.\d+)?)\s*(?:تا|-)\s*(\d+(?:\.\d+)?)\s*(?:متر|متری)/,
      /(?:از)\s*(\d+(?:\.\d+)?)\s*(?:متر)\s*(?:تا)\s*(\d+(?:\.\d+)?)/
    ], Number);
    if (areaRange) { [out.areaMin,out.areaMax]=areaRange; out.signals.push('area-range'); }
    else {
      const singleArea=s.match(/(?:^|\s)(\d+(?:[.٫]\d+)?)\s*(?:متر|متری)(?:\s|$)/);
      if(singleArea){const a=num(singleArea[1]);if(a!=null){out.areaMin=Math.round(a*.85);out.areaMax=Math.round(a*1.15);out.signals.push('area-single');}}
    }

    const budgetRange = s.match(/(\d+(?:\.\d+)?)\s*(میلیارد|میلیون|ميليارد|million|billion)\s*(?:تا|-)\s*(\d+(?:\.\d+)?)\s*(میلیارد|میلیون|ميليارد|million|billion)/);
    if (budgetRange) {
      out.budgetMin=Math.min(parseMoneyToken(budgetRange[1]+budgetRange[2]),parseMoneyToken(budgetRange[3]+budgetRange[4]));
      out.budgetMax=Math.max(parseMoneyToken(budgetRange[1]+budgetRange[2]),parseMoneyToken(budgetRange[3]+budgetRange[4]));
      out.signals.push('budget-range');
    } else {
      const bm=s.match(/(?:تا|حداکثر|بودجه|قیمت)\s*(\d+(?:\.\d+)?)\s*(میلیارد|میلیون|ميليارد|million|billion)/);
      if (bm) { out.budgetMax=parseMoneyToken(bm[1]+bm[2]); out.signals.push('budget-max'); }
    }

    const room = s.match(/(\d+)\s*(?:خواب|خوابه|اتاق)/);
    const wordRoom = s.match(/(یک|یه|دو|سه|چهار|پنج|شش)\s*(?:خواب|خوابه|اتاق)/);
    if (room) { out.rooms=Number(room[1]); out.signals.push('rooms'); }
    else if (wordRoom) {
      const words={یک:1,'یه':1,دو:2,سه:3,چهار:4,پنج:5,شش:6};
      out.rooms=words[wordRoom[1]]; out.signals.push('rooms');
    }

    const district = s.match(/(?:منطقه|زون|district)\s*([0-9۰-۹]{1,2})/i);
    if (district) { out.district=normalizeText(district[1]); out.signals.push('district'); }

    if (/(?:اجاره|رهن|ودیعه)/.test(s)) { out.preferredType='rent'; out.signals.push('rent'); }
    else if (/(?:فروش|خرید|بخر|خریداری)/.test(s)) { out.preferredType='sale'; out.signals.push('sale'); }

    const featureMap = [
      ['parking','پارکینگ|پارکینگ‌دار'],['elevator','آسانسور'],['storage','انباری'],
      ['terrace','تراس|بالکن'],['pool','استخر'],['warehouse','انباری'],
      ['renovated','بازسازی|نوساز'],['sunny','نورگیر']
    ];
    out.features=[];
    for (const [key, re] of featureMap) if (new RegExp(re).test(s)) { out.features.push(key); out.signals.push('feature:'+key); }

    const intentRules = [
      ['valuation',/(ارزش|قیمت گذاری|قیمت‌گذاری|چقدر می ارزه|چقدر می‌ارزه)/],
      ['market_analysis',/(تحلیل بازار|روند قیمت|قیمت منطقه|بازار)/],
      ['follow_up',/(پیگیری|فالوآپ|فالو آپ|یادآوری تماس)/],
      ['campaign',/(کمپین|تبلیغ|بازاریابی|آگهی)/],
      ['transaction',/(قرارداد|مذاکره|پیشنهاد خرید|معامله|امضا)/],
      ['lead_qualification',/(مشتری|لید|خریدار|مستاجر|صلاحیت)/],
      ['property_search',/(خانه|آپارتمان|ملک|ویلا|واحد|متر|خواب|منطقه|پارکینگ|آسانسور|بودجه|میلیارد|میلیون)/]
    ];
    const hits=intentRules.filter(([,re])=>re.test(s));
    out.intent=hits.length?hits[0][0]:'general';
    out.confidence=Math.min(0.99,0.35 + hits.length*0.12 + Math.min(out.signals.length,5)*0.06);
    if (out.intent==='property_search' && out.signals.length>=3) out.confidence=Math.min(.98,out.confidence+.08);
    out.summary = {
      intent: out.intent,
      constraints: Object.fromEntries(Object.entries(out).filter(([k])=>['areaMin','areaMax','budgetMin','budgetMax','rooms','district','preferredType','features'].includes(k)))
    };
    return out;
  }

  function action(id,type,payload,reason) {
    return { id, type, status:'queued', payload:payload||{}, reason, createdAt:new Date().toISOString() };
  }

  function plan(input, context={}) {
    const parsed=parseNeed(input);
    const actions=[];
    if (parsed.intent==='property_search') {
      actions.push(action('match-1','match_properties',parsed.summary.constraints,'پیدا کردن فایل‌های مطابق نیاز'));
      actions.push(action('draft-1','draft_recommendation',{count:5},'ساخت shortlist قابل توضیح'));
    } else if (parsed.intent==='valuation') {
      actions.push(action('valuation-1','calculate_valuation',{propertyId:context.propertyId||null},'محاسبه ارزش با داده‌های موجود'));
    } else if (parsed.intent==='market_analysis') {
      actions.push(action('market-1','analyze_market',{district:parsed.district||context.district||null},'تحلیل داده‌های بازار موجود'));
    } else if (parsed.intent==='lead_qualification') {
      actions.push(action('qualify-1','qualify_lead',{leadId:context.leadId||null},'امتیازدهی و تعیین مرحله لید'));
    } else if (parsed.intent==='follow_up') {
      actions.push(action('followup-1','create_followup',{leadId:context.leadId||null},'ثبت پیگیری بدون ارسال خارجی'));
    } else if (parsed.intent==='campaign') {
      actions.push(action('campaign-1','prepare_campaign',{propertyId:context.propertyId||null},'آماده‌سازی کمپین'));
    } else if (parsed.intent==='transaction') {
      actions.push(action('transaction-1','review_transaction',{transactionId:context.transactionId||null},'بررسی وضعیت معامله'));
    }
    return { version:VERSION, parsed, actions, requiresConfirmation: actions.some(a=>/^(draft|campaign|followup|transaction)/.test(a.id)) };
  }

  function createSession(seed={}) {
    return { id: (global.crypto?.randomUUID ? crypto.randomUUID() : 'local-'+Date.now()),
      createdAt:new Date().toISOString(), turns:[], context:{...seed} };
  }

  function respond(session, message) {
    const planResult=plan(message,session.context);
    session.turns.push({role:'user',content:String(message),at:new Date().toISOString(), plan:planResult});
    return {session, ...planResult};
  }

  function execute(actions, executor) {
    if (!Array.isArray(actions)) throw new TypeError('ACTIONS_ARRAY_REQUIRED');
    return actions.map(a=>{
      if (!a || a.status!=='queued') return {...a, error:'ACTION_NOT_QUEUED'};
      if (typeof executor!=='function') return {...a, status:'blocked', error:'EXECUTOR_REQUIRED'};
      try {
        const result=executor(a);
        return {...a,status:'completed',result};
      } catch(e) {
        return {...a,status:'failed',error:String(e?.message||e)};
      }
    });
  }

  global.ShirangiAIAgent={VERSION,normalizeText,parseNeed,plan,createSession,respond,execute};
})(typeof window!=='undefined'?window:globalThis);

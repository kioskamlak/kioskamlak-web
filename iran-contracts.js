/* Copyright (c) 2026 Shirangi. All rights reserved. */
/**
 * REOS Iran Contract & Settlement Engine v42.0
 * Contract lifecycle, commission, installments, checks and settlement ledger.
 * This is operational software, not legal advice or an official contract authority.
 */
(function(global){
'use strict';
const CONTRACT_STATES=Object.freeze(['draft','negotiating','pending_signature','active','completed','cancelled']);
const PAYMENT_STATES=Object.freeze(['scheduled','pending','paid','failed','cancelled']);
function id(prefix='ct'){try{return prefix+'_'+crypto.randomUUID()}catch(_){return prefix+'_'+Date.now()}}
function money(v){
  let s=String(v??'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/٫/g,'.').trim().toLowerCase();
  const unit=/میلیارد|میليارد|billion|bn/.test(s)?1e9:/میلیون|ميليون|million|mn/.test(s)?1e6:1;
  s=s.replace(/میلیارد|میليارد|billion|bn|میلیون|ميليون|million|mn/g,'').trim();
  if(/^[-+]?\d{1,3}(?:[٬،,/]\d{3})+$/.test(s))s=s.replace(/[٬،,/]/g,'');else s=s.replace(/[٬،,\s]/g,'');
  const n=Number(s)*unit;return Number.isFinite(n)&&n>=0?Math.round(n):0;
}
function validDate(v){const t=Date.parse(v||'');return Number.isFinite(t)?new Date(t).toISOString():null;}
function contract(x={}){
  if(!x.workspaceId||!x.propertyId)throw new Error('CONTRACT_REQUIRED_FIELDS');
  return {id:id(),workspaceId:String(x.workspaceId),propertyId:String(x.propertyId),buyerId:x.buyerId||null,sellerId:x.sellerId||null,tenantId:x.tenantId||null,type:x.type||'sale',state:'draft',amount:money(x.amount),deposit:money(x.deposit),notes:String(x.notes||'').slice(0,4000),version:1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
}
function transition(c,next){if(!CONTRACT_STATES.includes(next))throw new Error('CONTRACT_INVALID_STATE');const a={draft:['negotiating','cancelled'],negotiating:['pending_signature','draft','cancelled'],pending_signature:['active','negotiating','cancelled'],active:['completed','cancelled'],completed:[],cancelled:[]};if(!a[c.state]?.includes(next))throw new Error('CONTRACT_INVALID_TRANSITION');return {...c,state:next,updatedAt:new Date().toISOString()};}
function installment(c,{amount,dueAt,description='',method='bank'}={}){const due=validDate(dueAt);if(!due)throw new Error('PAYMENT_DUE_INVALID');const value=money(amount);if(value<=0)throw new Error('PAYMENT_AMOUNT_INVALID');return {id:id('pay'),contractId:c.id,workspaceId:c.workspaceId,amount:value,dueAt:due,description:String(description).slice(0,300),method:String(method).slice(0,40),state:'scheduled',createdAt:new Date().toISOString()};}
function check(c,{amount,dueAt,number,last4='',bank='' }={}){const n=String(number||'').replace(/\D/g,'');const due=validDate(dueAt);if(n.length<4)throw new Error('CHECK_NUMBER_REQUIRED');if(!due)throw new Error('CHECK_DUE_INVALID');const value=money(amount);if(value<=0)throw new Error('CHECK_AMOUNT_INVALID');return {id:id('chk'),contractId:c.id,workspaceId:c.workspaceId,amount:value,dueAt:due,number:n.slice(0,32),last4:String(last4||n.slice(-4)).slice(-4),bank:String(bank||'').slice(0,80),state:'scheduled'};}
function commission({type='sale',amount=0,salePercent=.5,rent=0,rentMonths=1,mortgage=0,mortgagePercent=.5}={}){
  const a=money(amount),r=money(rent),m=money(mortgage);
  if(type==='sale')return Math.round(a*Number(salePercent)/100);
  if(type==='rent')return Math.round(r*Math.max(1,Number(rentMonths)));
  if(type==='mortgage_rent')return Math.round(m*Number(mortgagePercent)/100+r*Math.max(1,Number(rentMonths)));
  return 0;
}
function settlement(items=[]){const rows=Array.isArray(items)?items:[];const paid=rows.filter(x=>x.state==='paid').reduce((s,x)=>s+money(x.amount),0);const pending=rows.filter(x=>x.state!=='paid'&&x.state!=='cancelled').reduce((s,x)=>s+money(x.amount),0);return {paid,pending,total:paid+pending,count:rows.length,overdue:rows.filter(x=>x.state!=='paid'&&x.state!=='cancelled'&&Date.parse(x.dueAt)<Date.now()).length};}
function validateContract(c={}){const errors=[];if(!c.workspaceId)errors.push('workspaceId');if(!c.propertyId)errors.push('propertyId');if(!CONTRACT_STATES.includes(c.state))errors.push('state');if(money(c.amount)<=0)errors.push('amount');return {ok:errors.length===0,errors};}
function scheduleTotal(items=[]){return (Array.isArray(items)?items:[]).reduce((s,x)=>s+money(x.amount),0);}
global.ShirangiIranContracts=Object.freeze({CONTRACT_STATES,PAYMENT_STATES,contract,validateContract,transition,installment,check,commission,settlement,scheduleTotal});
})(typeof window!=='undefined'?window:globalThis);

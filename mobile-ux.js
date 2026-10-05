/* Copyright (c) 2026 Shirangi. All rights reserved. */
/**
 * REOS Mobile UX helpers v42.0 — platform-neutral responsive policy.
 */
(function(global){
'use strict';
const BREAKPOINTS=Object.freeze({phone:480,tablet:768,desktop:1024});
function layout(width){
  const w=Number(width)||0;
  return w<=BREAKPOINTS.phone?'phone':w<BREAKPOINTS.desktop?'tablet':'desktop';
}
function priority(actions=[]){
  const weight={critical:100,high:70,normal:40,low:10};
  return [...(Array.isArray(actions)?actions:[])].sort((a,b)=>(weight[b.priority]||0)-(weight[a.priority]||0));
}
function touchTarget(size=44){const n=Number(size)||44;return {minWidth:Math.max(44,n),minHeight:Math.max(44,n),accessible:true};}
function responsiveModel(width,{role='agent',online=true}={}){const device=layout(width);return {device,compact:device==='phone',columns:device==='phone'?1:device==='tablet'?2:4,touch:touchTarget(),nav:navModel({role,online})};}
function navModel({role='agent',online=true}={}){
  const common=[{id:'dashboard',label:'داشبورد'},{id:'properties',label:'املاک'},{id:'leads',label:'مشتریان'},{id:'map',label:'نقشه'}];
  if(role==='manager')common.push({id:'team',label:'تیم'},{id:'reports',label:'گزارش‌ها'});
  common.push({id:'inbox',label:'پیگیری‌ها'},{id:'more',label:'بیشتر'});
  return {online,items:common.map((item,index)=>({...item,order:index+1}))};
}
global.ShirangiMobileUX=Object.freeze({BREAKPOINTS,layout,priority,touchTarget,responsiveModel,navModel});
})(typeof window!=='undefined'?window:globalThis);

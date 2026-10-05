/* Copyright (c) 2026 Shirangi. All rights reserved. */
(function(){
  const KEY='shirangi.module.tour360.v1';const read=()=>globalThis.ShirangiStore?.readLegacy(KEY,KEY,[])??memory.get(KEY)??[];
  const memory=new Map();
  function render(){const el=document.getElementById('tour-list');if(!el)return;const rows=read();el.innerHTML=rows.length?rows.map(x=>`<div class="p-4 rounded-xl bg-slate-900 border border-slate-700"><b>${escapeHtml(x.title)}</b><div class="text-xs text-slate-400 mt-1">${escapeHtml(x.url)}</div><a class="inline-block mt-3 px-3 py-2 rounded-lg bg-violet-700" href="${escapeHtml(x.url)}" target="_blank" rel="noopener noreferrer">باز کردن تور</a></div>`).join(''):'<p class="text-slate-500">تور یا لینک ۳۶۰ ثبت نشده است.</p>'}
  function save(){const title=document.getElementById('tour-title')?.value.trim(),url=document.getElementById('tour-url')?.value.trim();if(!title||!/^https:\/\//i.test(url)){alert('عنوان و یک لینک HTTPS معتبر وارد کنید.');return}const rows=read();rows.unshift({id:crypto.randomUUID?.()||String(Date.now()),title,url,createdAt:Date.now()});globalThis.ShirangiStore ? globalThis.ShirangiStore.write(KEY,rows.slice(0,100)) : memory.set(KEY,rows.slice(0,100));render();}
  window.ShirangiTour360={render,save};
})();

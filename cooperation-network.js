/* Copyright (c) 2026 Shirangi. All rights reserved. */
(function(){
  const KEY='shirangi.module.cooperation.v1';
  const memory=new Map();
  const read=()=>globalThis.ShirangiStore?.readLegacy(KEY,KEY,[])??memory.get(KEY)??[];
  const write=x=>{globalThis.ShirangiStore ? globalThis.ShirangiStore.write(KEY,x.slice(0,500)) : memory.set(KEY,x.slice(0,500));};
  function render(){const el=document.getElementById('coop-list');if(!el)return;const rows=read();el.innerHTML=rows.length?rows.map(x=>`<div class="p-4 rounded-xl bg-slate-900 border border-slate-700"><div class="flex justify-between gap-2"><b>${escapeHtml(x.property||'ملک بدون عنوان')}</b><span class="text-xs text-emerald-300">${escapeHtml(x.status)}</span></div><div class="text-xs text-slate-400 mt-2">از: ${escapeHtml(x.from||'—')} · به: ${escapeHtml(x.to||'—')} · سهم: ${Number(x.share||0).toLocaleString('fa-IR')}٪</div></div>`).join(''):'<p class="text-slate-500 text-center py-6">درخواست همکاری ثبت نشده است.</p>'}
  function submit(){const property=document.getElementById('coop-property')?.value.trim(),from=document.getElementById('coop-from')?.value.trim(),to=document.getElementById('coop-to')?.value.trim(),share=Number(document.getElementById('coop-share')?.value||0);if(!property||!from||!to||share<0||share>100){alert('عنوان ملک، دفتر مبدأ، دفتر مقصد و سهم معتبر را وارد کنید.');return}const rows=read();rows.unshift({id:crypto.randomUUID?.()||String(Date.now()),property,from,to,share,status:'در انتظار تأیید',createdAt:Date.now()});write(rows);document.getElementById('coop-property').value='';render();alert('درخواست همکاری ثبت شد.');}
  window.ShirangiCooperation={render,submit};
})();

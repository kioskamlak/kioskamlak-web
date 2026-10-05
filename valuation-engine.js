/* Copyright (c) 2026 Shirangi. All rights reserved. */
(function(){
  function estimate(){const area=Number(document.getElementById('val-area')?.value||0),meter=Number(document.getElementById('val-meter')?.value||0),age=Number(document.getElementById('val-age')?.value||0),floor=Number(document.getElementById('val-floor')?.value||0),parking=document.getElementById('val-parking')?.checked; if(area<=0||meter<=0){alert('متراژ و قیمت پایه هر متر را وارد کنید.');return}let factor=1-Math.min(age,30)*0.006;factor+=parking?.03:0;factor+=floor>=3?.015:0;const low=area*meter*factor*.92,high=area*meter*factor*1.08;const out=document.getElementById('val-result');if(out)out.innerHTML=`برآورد نرم‌افزاری: <b>${Math.round(low).toLocaleString('fa-IR')} تا ${Math.round(high).toLocaleString('fa-IR')} تومان</b><div class="text-xs text-slate-500 mt-2">این عدد ارزیابی رسمی نیست و به داده معاملات واقعی منطقه وابسته است.</div>`}
  window.ShirangiValuation={estimate};
})();

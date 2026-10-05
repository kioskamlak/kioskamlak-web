# شش ماژول مکمل شیرنگی 36.2.2
این شش ماژول عمداً جدا از هسته اصلی نگه داشته شده‌اند:
1. شبکه همکاری
2. بازار و درخواست ملک
3. ارزش‌گذاری
4. مرکز پیامک (صف ارسال، بدون ارسال جعلی)
5. جستجوی ذخیره‌شده
6. تور 360
هر ماژول API کوچک و ذخیره‌سازی محلی خودش را دارد و برای اتصال واقعی به Supabase/SMS Provider/داده بازار باید مرحله بعدی انجام شود.


## Runtime layering — 42.6 surgical cleanup
The deployable targets no longer load superseded compatibility modules `shirangi-ultimate-43.js`, `shirangi-iran-44.js`, `competitive-30.js`, `shirangi-40.js`, `shirangi-41.js`, or `platform-expansion.js`. They remain in the repository for regression/reference tests only. The runtime path is: target shell → canonical app/core → focused feature modules → provider adapters. No feature module is a second OS facade.


## Canonical structure — 42.6
The retired versioned compatibility facades (shirangi-40, shirangi-41, shirangi-ultimate-43, shirangi-iran-44) have been removed from deployable and test paths. Product behavior now lives in the canonical Core/Domain engines and the single OS facade. This prevents parallel business logic and version drift.

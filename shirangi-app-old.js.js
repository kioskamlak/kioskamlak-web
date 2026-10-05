/* Copyright (c) 2026 Shirangi. All rights reserved. */
/* Shirangi runtime — 42.6.0 canonical release / 41.1.0 Unified Domain Core (legacy OS stack removed)
 * Surface: Kernel + Core + App + Pro + Cloud + Enterprise 36.2.2
 */

/* ===== Canonical runtime storage facade =====
 * Feature code talks to this boundary only. ShirangiStore owns the
 * browser persistence primitive and performs one-way legacy migration.
 */
(function (global) {
  'use strict';
  const store = global.ShirangiStore;
  if (!store) throw new Error('SHIRANGI_STORE_REQUIRED');

  const read = (key) => store.readLegacyValue(String(key), String(key), null);
  const encode = (value) => {
    if (value === null || value === undefined) return '';
    return typeof value === 'string' ? value : JSON.stringify(value);
  };
  const decode = (raw) => {
    if (raw === '') return '';
    try { return JSON.parse(raw); } catch (_) { return raw; }
  };

  global.ShirangiRuntimeStorage = Object.freeze({
    getItem(key) {
      const value = read(key);
      return value === null || value === undefined ? null : encode(value);
    },
    setItem(key, value) {
      store.write(String(key), decode(String(value)));
    },
    removeItem(key) {
      store.remove(String(key));
    },
    keys() {
      return store.keys();
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);

/* ===== 1: js/supabase-config.js ===== */
/* SHIRANGI PROJECT LAYER — project-owned integration marker.
 * Runtime layer registry: identifies this module as part of Shirangi Real Estate Kiosk.
 * Third-party libraries/data remain subject to their own licenses and attribution.
 */
(function () {
  if (typeof window === 'undefined') return;
  window.__SHIRANGI_BRAND__ = window.__SHIRANGI_BRAND__ || Object.freeze({
    product: 'Shirangi Real Estate Kiosk', owner: 'Shirangi', namespace: 'shirangi'
  });
  window.__SHIRANGI_LAYERS__ = window.__SHIRANGI_LAYERS__ || [];
  var id = 'supabase-config';
  if (!window.__SHIRANGI_LAYERS__.some(function (x) { return x.id === id; })) {
    window.__SHIRANGI_LAYERS__.push({ id: id, name: 'Shirangi — ' + id, product: 'Shirangi Real Estate Kiosk' });
  }
}());
// تنظیمات عمومی کلاینت — هرگز Merchant ID زرین‌پال یا Service Role Key را اینجا قرار ندهید.
// مقادیر واقعی Supabase را از محیط امن/فایل build خود وارد کنید.
const __CLOUD_RUNTIME__ = (window.__SHIRANGI_SUPABASE__ && typeof window.__SHIRANGI_SUPABASE__ === 'object') ? window.__SHIRANGI_SUPABASE__ : {};
const SUPABASE_URL = String(__CLOUD_RUNTIME__.url || '');
const SUPABASE_ANON_KEY = String(__CLOUD_RUNTIME__.anonKey || '');
window.SHIRANGI_CONFIG = {
  useSupabase: !!(__CLOUD_RUNTIME__.useSupabase && SUPABASE_URL && SUPABASE_ANON_KEY),
  productionMode: !!__CLOUD_RUNTIME__.productionMode, // true فقط وقتی URL/کلید واقعی + Edge Functions deploy شده‌اند
  requireCloudAuthForPremium: true, // جلوگیری از entitlement آفلاین جعلی
  memoryIntelligenceVersion: '16.2',
  supabaseUrl: SUPABASE_URL,
  supabaseKey: SUPABASE_ANON_KEY,
  functionsBase: String(__CLOUD_RUNTIME__.functionsBase || ''),
  useEdgePayment: true,
  useCloudAI: true,
  aiFunctionName: 'shirangi-ai',
  zarinpalMerchantId: '', // فقط سازگاری قدیمی؛ پرداخت جدید از Edge استفاده می‌کند
  zarinpalSandbox: true,
  enterpriseCloudPreferred: true // وقتی useSupabase=true، لایه Enterprise اول cloud را امتحان می‌کند
};

/** Helpers for production fail-closed behavior (client-side). */
window.ShirangiConfigGuard = Object.freeze({
  isCloudReady() {
    const c = window.SHIRANGI_CONFIG || {};
    if (!c.useSupabase) return false;
    const url = String(c.supabaseUrl || '');
    const key = String(c.supabaseKey || '');
    if (!url || url.includes('YOUR_PROJECT') || !key || key.includes('YOUR_ANON')) return false;
    if (!c.functionsBase || !/^https:\/\//i.test(c.functionsBase)) return false;
    return true;
  },
  assertCloudReady(feature) {
    if (!this.isCloudReady()) {
      const msg = 'قابلیت «' + (feature || 'ابر') + '» فقط پس از تنظیم Supabase واقعی و Edge Functions فعال می‌شود.';
      console.warn('[ShirangiConfigGuard]', msg);
      return { ok: false, error: msg };
    }
    return { ok: true };
  },
  canUsePremiumLocally() {
    const c = window.SHIRANGI_CONFIG || {};
    if (c.requireCloudAuthForPremium && c.useSupabase) return false;
    return true;
  },
  /** Static + runtime production readiness report (no network side-effects beyond optional session probe). */
  async runProductionReadinessCheck() {
    const c = window.SHIRANGI_CONFIG || {};
    const checks = [];
    const add = (id, ok, detail) => checks.push({ id, ok: !!ok, detail: String(detail || '') });
    add('useSupabase', !!c.useSupabase, c.useSupabase ? 'enabled' : 'disabled — local-only mode');
    add('productionMode', !!c.productionMode, c.productionMode ? 'on' : 'off');
    add('requireCloudAuthForPremium', c.requireCloudAuthForPremium !== false, 'blocks offline premium minting');
    add('enterpriseCloudPreferred', c.enterpriseCloudPreferred !== false, 'enterprise prefers cloud when ready');
    const urlOk = !!(c.supabaseUrl && !String(c.supabaseUrl).includes('YOUR_PROJECT'));
    const keyOk = !!(c.supabaseKey && !String(c.supabaseKey).includes('YOUR_ANON'));
    add('supabaseUrl', urlOk, urlOk ? 'set' : 'placeholder or missing');
    add('supabaseAnonKey', keyOk, keyOk ? 'set' : 'placeholder or missing');
    const fb = String(c.functionsBase || '');
    add('functionsBase', /^https:\/\//i.test(fb), fb || 'missing');
    add('edgePayment', c.useEdgePayment !== false, 'client must not hold merchant id');
    add('noClientMerchant', !c.zarinpalMerchantId, c.zarinpalMerchantId ? 'REMOVE merchant from client' : 'ok');
    add('sandboxFlag', c.productionMode ? c.zarinpalSandbox === false : true,
      c.productionMode ? (c.zarinpalSandbox === false ? 'live' : 'still sandbox') : 'n/a until productionMode');
    let sessionOk = false;
    try {
      if (urlOk && keyOk && window.supabase?.auth) {
        const { data } = await window.supabase.auth.getSession();
        sessionOk = !!(data?.session?.access_token);
      }
    } catch (_) {}
    add('supabaseSession', !c.useSupabase || sessionOk, sessionOk ? 'session present' : 'no session yet');
    const failed = checks.filter(x => !x.ok);
    return {
      ok: failed.length === 0,
      cloudReady: this.isCloudReady(),
      failed: failed.map(x => x.id),
      checks,
      at: new Date().toISOString()
    };
  }
});



/* ===== 2: core security policy + rate-limit (inlined) ===== */
/**
 * Shirangi Core — Security Policy (canonical)
 * Central allow-lists, sensitive-key rules, and freeze helpers.
 */
(function (global) {
  'use strict';

  const ALLOWED_EXTERNAL_HOSTS = Object.freeze([
    'www.zarinpal.com',
    'sandbox.zarinpal.com',
    'api.zarinpal.com',
    'www.whatsapp.com',
    'wa.me',
    'api.whatsapp.com',
    'cdn.jsdelivr.net',
    'unpkg.com',
  ]);

  const SENSITIVE_STORAGE_KEYS = Object.freeze([
    'password', 'secret', 'token', 'merchant', 'service_role', 'private_key', 'admin_secret'
  ]);

  const ALLOWED_LAUNCHER_IDS = Object.freeze([
    'v362-launcher',
    'shirangi-cloud-launcher'
  ]);


  function isAllowedExternalUrl(url) {
    try {
      const u = new URL(String(url || ''), 'https://local.invalid');
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
      if (u.protocol === 'http:' && !/localhost|127\.0\.0\.1/.test(u.hostname)) return false;
      return ALLOWED_EXTERNAL_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith('.' + h));
    } catch {
      return false;
    }
  }

  function isSensitiveStorageKey(key) {
    const k = String(key || '').toLowerCase();
    return SENSITIVE_STORAGE_KEYS.some((s) => k.includes(s));
  }

  function freezeDeep(obj, depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 4) return obj;
    try {
      Object.freeze(obj);
      for (const v of Object.values(obj)) {
        if (v && typeof v === 'object') freezeDeep(v, depth + 1);
      }
    } catch (_) {}
    return obj;
  }

  function assertSafeNavigation(url) {
    const s = String(url || '');
    if (!s) return false;
    if (/^(javascript|data|vbscript):/i.test(s)) return false;
    if (/^https?:\/\//i.test(s)) return isAllowedExternalUrl(s);
    if (s.startsWith('/') || s.startsWith('#') || s.startsWith('./')) return true;
    return false;
  }

  global.ShirangiSecurityPolicy = Object.freeze({
    ALLOWED_EXTERNAL_HOSTS,
    SENSITIVE_STORAGE_KEYS,
    ALLOWED_LAUNCHER_IDS,
    isAllowedExternalUrl,
    isSensitiveStorageKey,
    freezeDeep,
    assertSafeNavigation
  });
})(typeof window !== 'undefined' ? window : globalThis);

/**
 * Shirangi Core — Client-side rate limiter for sensitive local actions.
 */
(function (global) {
  'use strict';

  const buckets = new Map();

  function allow(key, limit = 20, windowMs = 60_000) {
    const k = String(key || 'default');
    const now = Date.now();
    let b = buckets.get(k);
    if (!b || now >= b.reset) {
      b = { count: 0, reset: now + windowMs };
      buckets.set(k, b);
    }
    if (b.count >= limit) return false;
    b.count += 1;
    return true;
  }

  function remaining(key) {
    const b = buckets.get(String(key || 'default'));
    if (!b || Date.now() >= b.reset) return Infinity;
    return Math.max(0, (b.limit || 20) - b.count);
  }

  function reset(key) {
    buckets.delete(String(key || 'default'));
  }

  global.ShirangiRateLimit = Object.freeze({ allow, remaining, reset });
})(typeof window !== 'undefined' ? window : globalThis);


/* ===== 3: js/shirangi-kernel.js ===== */
/* SHIRANGI KERNEL — canonical 36.2.2 runtime guard.
 * There is no legacy launcher suppression pass: retired Enterprise v36 code
 * is not shipped in this bundle. The kernel only enforces the current public
 * launcher contract and sensitive-storage write policy.
 */
(function (global) {
  'use strict';
  const KERNEL_VERSION = '36.2.2-kernel';
  const SENSITIVE_STORAGE_KEY_BLOCKED = 'SENSITIVE_STORAGE_KEY_BLOCKED';
  const state = { booted: false, blockedSensitiveWrites: 0, lastBlockReason: null };
  const ALLOWED_LAUNCHERS = new Set(['v362-launcher', 'shirangi-cloud-launcher']);

  function removeDuplicateLaunchers() {
    if (typeof document === 'undefined') return;
    for (const id of ALLOWED_LAUNCHERS) {
      const nodes = document.querySelectorAll('#' + CSS.escape(id));
      nodes.forEach((node, i) => { if (i > 0) node.remove(); });
    }
  }

  function patchLocalStorage() {
    try {
      const proto = Storage.prototype;
      if (proto.__shirangiPatched) return;
      const rawSet = proto.setItem;
      proto.setItem = function (key, value) {
        const k = String(key || '').toLowerCase();
        const sensitive = ['password','secret','token','merchant','service_role','private_key','admin_secret']
          .some(x => k.includes(x));
        if (sensitive) { state.blockedSensitiveWrites += 1; state.lastBlockReason = SENSITIVE_STORAGE_KEY_BLOCKED; return; }
        return rawSet.call(this, key, value);
      };
      Object.defineProperty(proto, '__shirangiPatched', { value: true, configurable: false });
    } catch (_) {}
  }

  function boot() {
    if (state.booted) return;
    state.booted = true;
    removeDuplicateLaunchers();
    patchLocalStorage();
  }

  global.ShirangiKernel = Object.freeze({ version: KERNEL_VERSION, state, boot, removeDuplicateLaunchers });
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);

/* ===== 4: core/domain (validation + schemas + commission + pricing + matching) ===== */
/**
 * Shirangi Core — Domain Validation (canonical)
 * Pure functions. No DOM, no network, no secrets.
 * Platforms consume via window.ShirangiValidation / ShirangiCore.validation
 */
(function (global) {
  'use strict';

  const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

  const asString = (v, max = 500) => String(v ?? '').trim().slice(0, max);

  const asMoney = (v) => {
    const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/,/g, ''));
    return Number.isSafeInteger(n) && n >= 0 ? n : null;
  };

  const asDate = (v) => {
    const s = asString(v, 40);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const d = new Date(`${s}T00:00:00Z`);
    return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : s;
  };

  const nonNegativeMoney = (v) => asMoney(v) !== null;

  const between = (n, min, max) => Number.isFinite(n) && n >= min && n <= max;

  const validateRange = (start, end) => {
    const a = asDate(start);
    const b = asDate(end);
    return !!a && !!b && a <= b;
  };

  const required = (value, max = 500) => asString(value, max).length > 0;

  const sanitizeRecord = (record, schema) => {
    if (!isObject(record) || !isObject(schema)) return null;
    const out = {};
    for (const [key, rule] of Object.entries(schema)) {
      const value = record[key];
      if (rule.required && !required(value, rule.max ?? 500)) return null;
      if (value == null && !rule.required) continue;
      if (rule.type === 'string') out[key] = asString(value, rule.max ?? 500);
      else if (rule.type === 'money') {
        const n = asMoney(value);
        if (n === null) return null;
        out[key] = n;
      } else if (rule.type === 'date') {
        const d = asDate(value);
        if (!d) return null;
        out[key] = d;
      } else if (rule.type === 'integer') {
        const n = Number(value);
        if (!Number.isSafeInteger(n) || (rule.min != null && n < rule.min) || (rule.max != null && n > rule.max)) return null;
        out[key] = n;
      } else if (rule.type === 'boolean') out[key] = Boolean(value);
      else if (rule.type === 'object') {
        if (!isObject(value)) return null;
        out[key] = value;
      } else return null;
    }
    return out;
  };

  /** Reject non-finite / NaN / unsafe numeric input for money/area fields. */
  const rejectUnhealthyNumber = (raw) => {
    if (raw == null || raw === '') return { ok: false, reason: 'empty' };
    const cleaned = String(raw).replace(/[٬،,\s]/g, '').replace(/٫/g, '.');
    if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return { ok: false, reason: 'malformed' };
    const n = Number(cleaned);
    if (!Number.isFinite(n) || !Number.isSafeInteger(Math.trunc(n))) return { ok: false, reason: 'unsafe' };
    return { ok: true, value: n };
  };

  global.ShirangiValidation = Object.freeze({
    asString,
    asMoney,
    asDate,
    nonNegativeMoney,
    between,
    validateRange,
    required,
    sanitizeRecord,
    rejectUnhealthyNumber,
    isObject
  });
})(typeof window !== 'undefined' ? window : globalThis);


/* ===== 4b: schemas ===== */
/**
 * Shirangi Core — Domain Schemas (canonical)
 * Pure property / customer / deal shapes for real-estate kiosk.
 * No DOM, no network, no secrets.
 */
(function (global) {
  'use strict';

  const V = global.ShirangiValidation;
  if (!V) {
    console.warn('[ShirangiSchemas] ShirangiValidation must load first');
  }

  /** Canonical deal types used across UI + storage. */
  const DEAL_TYPES = Object.freeze(['sale', 'rent', 'mortgage', 'mortgage_rent', 'partnership']);

  /** Property categories. */
  const CATEGORIES = Object.freeze(['residential', 'commercial', 'office', 'land', 'industrial', 'other']);

  /** Property lifecycle status. */
  const PROPERTY_STATUS = Object.freeze(['available', 'reserved', 'sold', 'rented', 'archived']);

  const PROPERTY_SCHEMA = Object.freeze({
    id:          { type: 'string', required: true, max: 64 },
    title:       { type: 'string', required: true, max: 200 },
    type:        { type: 'string', required: true, max: 32 },       // DEAL_TYPES
    category:    { type: 'string', required: false, max: 32 },      // CATEGORIES
    status:      { type: 'string', required: false, max: 32 },      // PROPERTY_STATUS
    address:     { type: 'string', required: false, max: 400 },
    district:    { type: 'string', required: false, max: 80 },
    zone:        { type: 'string', required: false, max: 40 },
    area:        { type: 'integer', required: false, min: 0, max: 500000 },
    rooms:       { type: 'integer', required: false, min: 0, max: 50 },
    bedrooms:    { type: 'integer', required: false, min: 0, max: 30 },
    yearBuilt:   { type: 'integer', required: false, min: 1300, max: 1500 }, // Persian year range
    price:       { type: 'money', required: false },
    salePrice:   { type: 'money', required: false },
    rent:        { type: 'money', required: false },
    mortgage:    { type: 'money', required: false },
    description:{ type: 'string', required: false, max: 4000 },
    features:    { type: 'string', required: false, max: 1000 },
    amenities:   { type: 'string', required: false, max: 1000 },
    lat:         { type: 'string', required: false, max: 24 },
    lng:         { type: 'string', required: false, max: 24 },
    createdAt:   { type: 'string', required: false, max: 40 },
    updatedAt:   { type: 'string', required: false, max: 40 }
  });

  const CUSTOMER_SCHEMA = Object.freeze({
    id:          { type: 'string', required: true, max: 64 },
    name:        { type: 'string', required: true, max: 120 },
    phone:       { type: 'string', required: false, max: 20 },
    type:        { type: 'string', required: false, max: 32 }, // customer | owner | both
    budgetMin:   { type: 'money', required: false },
    budgetMax:   { type: 'money', required: false },
    areaMin:     { type: 'integer', required: false, min: 0, max: 500000 },
    areaMax:     { type: 'integer', required: false, min: 0, max: 500000 },
    rooms:       { type: 'integer', required: false, min: 0, max: 30 },
    bedrooms:    { type: 'integer', required: false, min: 0, max: 20 },
    preferredType: { type: 'string', required: false, max: 32 },
    preferredDistrict: { type: 'string', required: false, max: 80 },
    notes:       { type: 'string', required: false, max: 2000 },
    createdAt:   { type: 'string', required: false, max: 40 },
    updatedAt:   { type: 'string', required: false, max: 40 }
  });

  const DEAL_SCHEMA = Object.freeze({
    id:            { type: 'string', required: true, max: 64 },
    propertyId:    { type: 'string', required: true, max: 64 },
    customerId:    { type: 'string', required: false, max: 64 },
    type:          { type: 'string', required: true, max: 32 },
    amount:        { type: 'money', required: false },
    commissionRate:{ type: 'string', required: false, max: 16 }, // percent as string for precision
    commissionAmount: { type: 'money', required: false },
    status:        { type: 'string', required: false, max: 32 }, // draft | active | closed | cancelled
    closedAt:      { type: 'date', required: false },
    notes:         { type: 'string', required: false, max: 2000 },
    createdAt:     { type: 'string', required: false, max: 40 }
  });

  function sanitizeProperty(raw) {
    if (!V) return null;
    const out = V.sanitizeRecord(raw, PROPERTY_SCHEMA);
    if (!out) return null;
    if (out.type && !DEAL_TYPES.includes(out.type)) out.type = 'sale';
    if (out.category && !CATEGORIES.includes(out.category)) out.category = 'residential';
    if (out.status && !PROPERTY_STATUS.includes(out.status)) out.status = 'available';
    return out;
  }

  function sanitizeCustomer(raw) {
    if (!V) return null;
    return V.sanitizeRecord(raw, CUSTOMER_SCHEMA);
  }

  function sanitizeDeal(raw) {
    if (!V) return null;
    const out = V.sanitizeRecord(raw, DEAL_SCHEMA);
    if (!out) return null;
    if (out.type && !DEAL_TYPES.includes(out.type)) out.type = 'sale';
    return out;
  }

  function isValidDealType(t) {
    return DEAL_TYPES.includes(String(t || ''));
  }

  function isValidCategory(c) {
    return CATEGORIES.includes(String(c || ''));
  }

  function isValidPropertyStatus(s) {
    return PROPERTY_STATUS.includes(String(s || ''));
  }

  global.ShirangiSchemas = Object.freeze({
    DEAL_TYPES,
    CATEGORIES,
    PROPERTY_STATUS,
    PROPERTY_SCHEMA,
    CUSTOMER_SCHEMA,
    DEAL_SCHEMA,
    sanitizeProperty,
    sanitizeCustomer,
    sanitizeDeal,
    isValidDealType,
    isValidCategory,
    isValidPropertyStatus
  });
})(typeof window !== 'undefined' ? window : globalThis);


/* ===== 4c: commission ===== */
/**
 * Shirangi Core — Commission Engine (canonical)
 * Pure calculations for sale / rent / mortgage deals.
 * No DOM, no network.
 */
(function (global) {
  'use strict';

  const V = global.ShirangiValidation;

  /**
   * Default rates (percent). Can be overridden per call.
   * Sale: typically 0.5% each side or agency-configured.
   * Rent: often 1 month rent total, split, or percent.
   */
  const DEFAULTS = Object.freeze({
    salePercent: 0.5,          // % of sale price (one side)
    saleBothSides: true,       // if true → buyer + seller
    rentMonths: 1,             // months of rent as commission total
    rentPercent: null,         // alternative: percent of annual rent
    mortgagePercent: 0.5
  });

  function toNum(v) {
    if (V?.rejectUnhealthyNumber) {
      const r = V.rejectUnhealthyNumber(v);
      return r.ok ? r.value : 0;
    }
    const n = Number(String(v ?? '').replace(/[٬،,\s]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }

  function clampPercent(p) {
    const n = Number(p);
    if (!Number.isFinite(n) || n < 0) return 0;
    if (n > 100) return 100;
    return n;
  }

  /**
   * Calculate commission for a deal.
   * @param {object} opts
   * @param {'sale'|'rent'|'mortgage'|'mortgage_rent'} opts.type
   * @param {number} opts.amount - sale price / rent monthly / mortgage amount
   * @param {number} [opts.rent] - monthly rent (for mortgage_rent or rent)
   * @param {number} [opts.salePercent]
   * @param {boolean} [opts.saleBothSides]
   * @param {number} [opts.rentMonths]
   * @param {number|null} [opts.rentPercent]
   * @param {number} [opts.mortgagePercent]
   * @returns {{ amount: number, breakdown: object, rateLabel: string }}
   */
  function calculate(opts = {}) {
    const type = String(opts.type || 'sale');
    const amount = Math.max(0, toNum(opts.amount));
    const rent = Math.max(0, toNum(opts.rent ?? opts.monthlyRent ?? 0));
    const salePercent = clampPercent(opts.salePercent ?? DEFAULTS.salePercent);
    const saleBothSides = opts.saleBothSides !== undefined ? !!opts.saleBothSides : DEFAULTS.saleBothSides;
    const rentMonths = Math.max(0, toNum(opts.rentMonths ?? DEFAULTS.rentMonths));
    const rentPercent = opts.rentPercent != null ? clampPercent(opts.rentPercent) : null;
    const mortgagePercent = clampPercent(opts.mortgagePercent ?? DEFAULTS.mortgagePercent);

    let commission = 0;
    const breakdown = { type, base: amount };

    if (type === 'sale') {
      const oneSide = Math.round(amount * (salePercent / 100));
      commission = saleBothSides ? oneSide * 2 : oneSide;
      breakdown.salePercent = salePercent;
      breakdown.oneSide = oneSide;
      breakdown.sides = saleBothSides ? 2 : 1;
      breakdown.rateLabel = saleBothSides
        ? `${salePercent}% × ۲ طرف`
        : `${salePercent}% یک طرف`;
    } else if (type === 'rent') {
      if (rentPercent != null) {
        // percent of annual rent
        const annual = rent * 12;
        commission = Math.round(annual * (rentPercent / 100));
        breakdown.rentPercent = rentPercent;
        breakdown.annual = annual;
        breakdown.rateLabel = `${rentPercent}% اجاره سالانه`;
      } else {
        commission = Math.round(rent * rentMonths);
        breakdown.rentMonths = rentMonths;
        breakdown.monthlyRent = rent;
        breakdown.rateLabel = `${rentMonths} ماه اجاره`;
      }
    } else if (type === 'mortgage') {
      commission = Math.round(amount * (mortgagePercent / 100));
      breakdown.mortgagePercent = mortgagePercent;
      breakdown.rateLabel = `${mortgagePercent}% رهن`;
    } else if (type === 'mortgage_rent') {
      // typical: percent of mortgage + months of rent
      const fromMortgage = Math.round(amount * (mortgagePercent / 100));
      const fromRent = Math.round(rent * rentMonths);
      commission = fromMortgage + fromRent;
      breakdown.mortgagePart = fromMortgage;
      breakdown.rentPart = fromRent;
      breakdown.rateLabel = `${mortgagePercent}% رهن + ${rentMonths} ماه اجاره`;
    } else {
      // partnership / other → treat as sale percent on amount
      commission = Math.round(amount * (salePercent / 100));
      breakdown.rateLabel = `${salePercent}% (سایر)`;
    }

    return Object.freeze({
      amount: Math.max(0, commission),
      breakdown: Object.freeze(breakdown),
      rateLabel: breakdown.rateLabel || ''
    });
  }

  /**
   * Split commission between parties (e.g. agent share vs office).
   * @param {number} total
   * @param {number} agentPercent - 0..100
   */
  function split(total, agentPercent = 50) {
    const t = Math.max(0, toNum(total));
    const p = clampPercent(agentPercent);
    const agent = Math.round(t * (p / 100));
    return Object.freeze({
      total: t,
      agent,
      office: t - agent,
      agentPercent: p
    });
  }

  global.ShirangiCommission = Object.freeze({
    DEFAULTS,
    calculate,
    split,
    toNum,
    clampPercent
  });
})(typeof window !== 'undefined' ? window : globalThis);


/* ===== 4d: pricing ===== */
/**
 * Shirangi Core — Pricing Helpers (canonical)
 * Price per m², rahn↔ejare conversion, loan installment (annuity).
 * Pure functions. No DOM, no network.
 */
(function (global) {
  'use strict';

  const V = global.ShirangiValidation;

  function toNum(v) {
    if (V?.rejectUnhealthyNumber) {
      const r = V.rejectUnhealthyNumber(v);
      return r.ok ? r.value : null;
    }
    if (v == null || v === '') return null;
    const cleaned = String(v).replace(/[٬،,\s]/g, '').replace(/٫/g, '.');
    if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }

  /**
   * Price per square meter.
   * @returns {number|null}
   */
  function pricePerMeter(totalPrice, area) {
    const p = toNum(totalPrice);
    const a = toNum(area);
    if (p == null || a == null || a <= 0) return null;
    return Math.round(p / a);
  }

  /**
   * Iranian market convention: every 1M Toman rahn ≈ rate thousand Toman monthly rent.
   * Default rate = 30 (i.e. 1M rahn → 30,000 Toman rent).
   *
   * @param {number} rahnToman - full rahn amount in Toman
   * @param {number} [rate=30]
   * @returns {{ rahn: number, rentMonthly: number, rate: number }}
   */
  function rahnToRent(rahnToman, rate = 30) {
    const rahn = Math.max(0, toNum(rahnToman) ?? 0);
    const r = Math.max(0, toNum(rate) ?? 30);
    // 1,000,000 rahn → r * 1000 Toman rent
    const rentMonthly = Math.round((rahn / 1_000_000) * r * 1000);
    return Object.freeze({ rahn, rentMonthly, rate: r });
  }

  /**
   * Inverse: monthly rent → equivalent rahn.
   */
  function rentToRahn(rentMonthly, rate = 30) {
    const rent = Math.max(0, toNum(rentMonthly) ?? 0);
    const r = Math.max(0, toNum(rate) ?? 30);
    if (r <= 0) return Object.freeze({ rentMonthly: rent, rahn: 0, rate: r });
    const rahn = Math.round((rent / (r * 1000)) * 1_000_000);
    return Object.freeze({ rentMonthly: rent, rahn, rate: r });
  }

  /**
   * Fixed-installment loan (annuity formula).
   * PMT = P * r(1+r)^n / ((1+r)^n − 1)
   *
   * @param {object} opts
   * @param {number} opts.principal - loan amount (Toman)
   * @param {number} opts.annualRatePercent - e.g. 23 for 23%
   * @param {number} opts.months - term in months
   * @returns {{ monthly: number, totalPayment: number, totalInterest: number, principal: number, months: number, annualRatePercent: number } | null}
   */
  function loanInstallment(opts = {}) {
    const principal = toNum(opts.principal ?? opts.amount);
    const annualRatePercent = toNum(opts.annualRatePercent ?? opts.rate);
    const months = toNum(opts.months ?? opts.term);
    if (principal == null || principal <= 0) return null;
    if (annualRatePercent == null || annualRatePercent < 0) return null;
    if (months == null || months <= 0 || !Number.isInteger(months)) return null;

    if (annualRatePercent === 0) {
      const monthly = Math.round(principal / months);
      return Object.freeze({
        monthly,
        totalPayment: monthly * months,
        totalInterest: 0,
        principal,
        months,
        annualRatePercent: 0
      });
    }

    const monthlyRate = annualRatePercent / 100 / 12;
    const factor = Math.pow(1 + monthlyRate, months);
    const monthly = Math.round(principal * (monthlyRate * factor) / (factor - 1));
    const totalPayment = monthly * months;
    const totalInterest = totalPayment - principal;

    return Object.freeze({
      monthly,
      totalPayment,
      totalInterest,
      principal,
      months,
      annualRatePercent
    });
  }

  /**
   * Format helper for display (fa-IR). Pure — does not touch DOM.
   */
  function formatToman(n) {
    const v = toNum(n);
    if (v == null) return '—';
    return Math.round(v).toLocaleString('fa-IR') + ' تومان';
  }

  global.ShirangiPricing = Object.freeze({
    toNum,
    pricePerMeter,
    rahnToRent,
    rentToRahn,
    loanInstallment,
    formatToman
  });
})(typeof window !== 'undefined' ? window : globalThis);


/* ===== 4e: matching ===== */
/**
 * Shirangi Core — Customer ↔ Property Matching (canonical)
 * Pure scoring. No DOM, no network.
 */
(function (global) {
  'use strict';

  const V = global.ShirangiValidation;

  function num(v) {
    let raw=String(v ?? '').trim()
      .replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
      .replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d))
      .replace(/٫/g,'.')
      .replace(/[٬،,\s\/\\]/g,'');
    // Support grouped integers such as 16.000.000.000 while preserving 16.5.
    if((raw.match(/\./g)||[]).length>1 || /^-?\d+\.\d{3}(?:\.\d{3})+$/.test(raw)) raw=raw.replace(/\./g,'');
    if (V?.rejectUnhealthyNumber) {
      const r = V.rejectUnhealthyNumber(raw);
      return r.ok ? r.value : 0;
    }
    const n=Number(raw);
    return Number.isFinite(n) ? n : 0;
  }
  function str(v) {
    return String(v ?? '').trim().toLowerCase();
  }

  function propType(p) {
    return str(p?.type || p?.transactionType || p?.dealType || 'sale');
  }

  function priceOf(p) {
    return num(p?.price || p?.salePrice || p?.amount);
  }

  function areaOf(p) {
    return num(p?.area || p?.metrage || p?.meterage);
  }

  function roomsOf(p) {
    return num(p?.rooms || p?.bedrooms);
  }

  function rentOf(p) {
    return num(p?.rent || p?.monthlyRent || p?.ejare);
  }

  /**
   * Score how well a property matches a customer need (0–100).
   * Higher = better match.
   *
   * @param {object} customer - budget*, area*, rooms, preferredType, preferredDistrict, notes/features
   * @param {object} property
   * @returns {number}
   */
  function score(customer, property) {
    if (!customer || !property) return 0;
    let s = 50; // baseline

    const cType = str(customer.preferredType || customer.type || '');
    const pType = propType(property);
    if (cType) {
      s += pType === cType || (cType === 'rent' && (pType === 'rent' || pType === 'mortgage_rent'))
        ? 18
        : -12;
    }

    const budgetMax = num(customer.budgetMax || customer.budget);
    const budgetMin = num(customer.budgetMin);
    const price = priceOf(property) || rentOf(property);
    if (budgetMax > 0 && price > 0) {
      if (price <= budgetMax) s += 16;
      else if (price <= budgetMax * 1.1) s += 6;
      else s -= 18;
    }
    if (budgetMin > 0 && price > 0 && price < budgetMin * 0.7) s -= 8;

    const areaMin = num(customer.areaMin || customer.minArea);
    const areaMax = num(customer.areaMax || customer.maxArea);
    const area = areaOf(property);
    if (area > 0) {
      if (areaMin > 0) s += area >= areaMin ? 10 : -10;
      if (areaMax > 0) s += area <= areaMax ? 8 : -8;
    }

    const wantRooms = num(customer.rooms || customer.bedrooms);
    const haveRooms = roomsOf(property);
    if (wantRooms > 0 && haveRooms > 0) {
      const diff = Math.abs(haveRooms - wantRooms);
      if (diff === 0) s += 12;
      else if (diff === 1) s += 4;
      else s -= 8;
    }

    const dist = str(customer.preferredDistrict || customer.district || customer.zone);
    if (dist) {
      const hay = str([property.district, property.zone, property.address, property.title].join(' '));
      s += hay.includes(dist) ? 12 : -4;
    }

    // feature keywords from customer notes
    const features = str(customer.notes || customer.features || customer.need || '');
    if (features.length > 2) {
      const tokens = features.split(/[\s,،+]+/).filter((t) => t.length > 2);
      const propHay = str([
        property.title,
        property.description,
        property.features,
        property.amenities,
        property.address
      ].join(' '));
      let hits = 0;
      for (const t of tokens.slice(0, 12)) {
        if (propHay.includes(t)) hits += 1;
      }
      s += Math.min(12, hits * 3);
    }

    // prefer available
    const status = str(property.status || 'available');
    if (status === 'available') s += 4;
    else if (status === 'archived' || status === 'sold' || status === 'rented') s -= 25;

    return Math.max(0, Math.min(100, Math.round(s)));
  }

  /**
   * Rank properties for a customer.
   * @returns {Array<{ property: object, score: number }>}
   */
  function rank(customer, properties, limit = 10) {
    const list = Array.isArray(properties) ? properties : [];
    return list
      .map((p) => ({ property: p, score: score(customer, p) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, limit));
  }

  /**
   * Parse a natural-language need string into structured filters (heuristic, FA).
   * Lightweight — not full NLP.
   */
  /** Normalize Persian/Arabic digits to ASCII. */
  function toAsciiDigits(s) {
    return String(s || '')
      .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
      .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  }

  function parseNeed(text) {
    const raw = String(text || '').trim();
    const t = toAsciiDigits(raw);
    const out = {
      preferredType: null,
      areaMin: null,
      areaMax: null,
      budgetMax: null,
      rooms: null,
      preferredDistrict: null,
      features: []
    };
    if (!t) return out;

    if (/رهن\s*و\s*اجاره|رهن و اجاره/.test(t)) out.preferredType = 'mortgage_rent';
    else if (/اجاره/.test(t) && /رهن/.test(t)) out.preferredType = 'mortgage_rent';
    else if (/اجاره/.test(t)) out.preferredType = 'rent';
    else if (/رهن/.test(t)) out.preferredType = 'mortgage';
    else if (/مشارکت/.test(t)) out.preferredType = 'partnership';
    else if (/فروش|خرید|آپارتمان|ویلا|ملک|خانه|منزل/.test(t)) out.preferredType = 'sale';

    const areaMatch = t.match(/(\d+)\s*تا\s*(\d+)\s*متر/);
    if (areaMatch) {
      out.areaMin = Number(areaMatch[1]);
      out.areaMax = Number(areaMatch[2]);
    } else {
      const single = t.match(/(\d+)\s*متر/);
      if (single) {
        out.areaMin = Math.round(Number(single[1]) * 0.85);
        out.areaMax = Math.round(Number(single[1]) * 1.15);
      }
    }

    // Prefer explicit میلیارد / میلیون units to avoid matching area numbers.
    const priceMatch =
      t.match(/تا\s*([\d٬،,\s]+)\s*(میلیارد)/) ||
      t.match(/تا\s*([\d٬،,\s]+)\s*(میلیون)/) ||
      t.match(/(?:بودجه|قیمت|مبلغ)\s*([\d٬،,\s]+)\s*(میلیارد|میلیون)?/);
    if (priceMatch) {
      let n = Number(String(priceMatch[1]).replace(/[٬،,\s]/g, ''));
      const unit = priceMatch[2];
      if (unit === 'میلیارد') n *= 1_000_000_000;
      else if (unit === 'میلیون') n *= 1_000_000;
      if (Number.isFinite(n) && n > 0) out.budgetMax = n;
    }

    const roomWord = { یک: 1, دو: 2, سه: 3, چهار: 4, پنج: 5, شش: 6 };
    const roomMatch = t.match(/(\d+)\s*خواب|(\d+)\s*اتاق/);
    if (roomMatch) out.rooms = Number(roomMatch[1] || roomMatch[2]);
    else {
      for (const [w, n] of Object.entries(roomWord)) {
        if (new RegExp(w + '\\s*خواب|' + w + '\\s*اتاق').test(t)) {
          out.rooms = n;
          break;
        }
      }
    }

    const zoneMatch = t.match(/منطقه\s*(\d+|[\u0600-\u06FF]+)/);
    if (zoneMatch) out.preferredDistrict = zoneMatch[1];

    const featureWords = ['پارکینگ', 'آسانسور', 'انباری', 'بالکن', 'مستر', 'نورگیر', 'بازسازی'];
    for (const f of featureWords) {
      if (raw.includes(f) || t.includes(f)) out.features.push(f);
    }

    return out;
  }

  global.ShirangiMatching = Object.freeze({
    score,
    rank,
    parseNeed,
    num,
    propType,
    priceOf,
    areaOf,
    roomsOf,
    rentOf
  });
})(typeof window !== 'undefined' ? window : globalThis);


/* ===== 5: core/security/guards.js ===== */
/**
 * Shirangi Core — Security Guards (canonical)
 * Output escaping, URL policy, timing-safe compare helpers.
 * No secrets, no network.
 */
(function (global) {
  'use strict';

  const escapeHtml = (v) =>
    String(v ?? '').replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );

  const escapeAttr = (v) => escapeHtml(v).replace(/`/g, '&#96;');

  /** Allow only http(s) and relative paths; block dangerous URL schemes. */
  const BAD_SCHEMES = ['java' + 'script:', 'data:', 'vb' + 'script:'];
  const safeUrl = (raw, { allowRelative = true } = {}) => {
    const s = String(raw ?? '').trim();
    if (!s) return '';
    const lower = s.toLowerCase();
    if (BAD_SCHEMES.some((sch) => lower.startsWith(sch))) return '';
    if (/^https?:\/\//i.test(s)) {
      const policy = global.ShirangiSecurityPolicy;
      return policy?.isAllowedExternalUrl?.(s) ? s : '';
    }
    if (allowRelative && (s.startsWith('/') || s.startsWith('./') || s.startsWith('#'))) return s;
    return '';
  };

  /** Constant-time string compare for short secrets / tokens (browser-safe). */
  const timingSafeEqual = (a, b) => {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  };

  /** Device id format used across payment / subscription. */
  const isValidDeviceId = (id) => /^dev_[A-Za-z0-9_-]{8,120}$/.test(String(id || ''));

  /** Block accidental exposure of service-role or merchant material in client logs. */
  const redactSecrets = (text) =>
    String(text ?? '')
      .replace(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]')
      .replace(/sk-[A-Za-z0-9]{20,}/g, '[REDACTED_KEY]')
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, (m) =>
        m.length === 36 ? '[REDACTED_UUID]' : m
      );

  global.ShirangiSecurity = Object.freeze({
    escapeHtml,
    escapeAttr,
    safeUrl,
    timingSafeEqual,
    isValidDeviceId,
    redactSecrets
  });
})(typeof window !== 'undefined' ? window : globalThis);


/* ===== 6: core/runtime/bus.js (events + ShirangiCore) ===== */
/* Copyright (c) 2026 Shirangi. All rights reserved. */
/**
 * Shirangi Core — Event bus + health/error isolation (canonical) v41.1.0
 */
(function (global) {
  'use strict';

  const listeners = new Map();

  const on = (event, fn) => {
    if (typeof fn !== 'function') return () => {};
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => listeners.get(event)?.delete(fn);
  };

  const off = (event, fn) => listeners.get(event)?.delete(fn);

  const once = (event, fn) => {
    if (typeof fn !== 'function') return () => {};
    const wrap = (payload) => {
      off(event, wrap);
      try {
        fn(payload);
      } catch (err) {
        global.ShirangiCore?.reportError?.('event-once:' + event, err);
      }
    };
    return on(event, wrap);
  };

  /** Promise that resolves on next event (or rejects on timeout). */
  const waitFor = (event, timeoutMs = 10000) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsub();
        reject(new Error('WAIT_FOR_TIMEOUT:' + event));
      }, Math.max(0, timeoutMs));
      const unsub = on(event, (payload) => {
        clearTimeout(timer);
        unsub();
        resolve(payload);
      });
    });

  const emit = (event, payload) => {
    const set = listeners.get(event);
    if (!set) return 0;
    let delivered = 0;
    for (const fn of [...set]) {
      try {
        fn(payload);
        delivered += 1;
      } catch (err) {
        global.ShirangiCore?.reportError?.('event:' + event, err);
      }
    }
    return delivered;
  };

  const listenerCount = (event) => listeners.get(event)?.size || 0;

  const clear = (event) => {
    if (event) listeners.delete(event);
    else listeners.clear();
  };

  global.ShirangiEvents = Object.freeze({ on, off, once, waitFor, emit, listenerCount, clear });

  const startedAt = Date.now();
  const errors = [];
  let globalHandlersInstalled = false;

  const reportError = (source, err) => {
    const entry = {
      at: new Date().toISOString(),
      source: String(source || 'unknown').slice(0, 120),
      message: String(err?.message || err || '').slice(0, 500)
    };
    errors.unshift(entry);
    if (errors.length > 50) errors.length = 50;
    try {
      global.ShirangiStore?.write('runtime-errors', errors);
    } catch (_) {}
    try {
      console.warn('[ShirangiCore]', entry.source, entry.message);
    } catch (_) {}
  };

  const installGlobalErrorHandlers = () => {
    if (globalHandlersInstalled || typeof global?.addEventListener !== 'function') return false;
    globalHandlersInstalled = true;
    global.addEventListener('error', (event) => {
      const err = event?.error || new Error(String(event?.message || 'Unhandled error'));
      reportError('window:error', err);
    });
    global.addEventListener('unhandledrejection', (event) => {
      const reason = event?.reason instanceof Error ? event.reason : new Error(String(event?.reason || 'Unhandled rejection'));
      reportError('window:unhandledrejection', reason);
    });
    return true;
  };

  const health = () => ({
    version: '36.2.2',
    uptimeMs: Date.now() - startedAt,
    errorCount: errors.length,
    lastError: errors[0] || null,
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    hasStore: !!global.ShirangiStore,
    hasValidation: !!global.ShirangiValidation,
    hasSecurity: !!global.ShirangiSecurity,
    hasSchemas: !!global.ShirangiSchemas,
    hasCommission: !!global.ShirangiCommission,
    hasPricing: !!global.ShirangiPricing,
    hasMatching: !!global.ShirangiMatching,
    eventChannels: listeners.size,
    globalErrorHandlers: globalHandlersInstalled
  });

  installGlobalErrorHandlers();

  global.ShirangiCore = Object.freeze({
    version: '36.2.2',
    startedAt,
    reportError,
    installGlobalErrorHandlers,
    health,
    get validation() {
      return global.ShirangiValidation;
    },
    get security() {
      return global.ShirangiSecurity;
    },
    get events() {
      return global.ShirangiEvents;
    },
    get store() {
      return global.ShirangiStore;
    },
    get schemas() {
      return global.ShirangiSchemas;
    },
    get commission() {
      return global.ShirangiCommission;
    },
    get pricing() {
      return global.ShirangiPricing;
    },
    get matching() {
      return global.ShirangiMatching;
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);


/* ===== 8: core/index.js ===== */
/* Copyright (c) 2026 Shirangi. All rights reserved. */
/**
 * Shirangi Core — entry (load order) stable core
 * domain → security → storage → runtime
 *
 * Recommended load order (modular / docs):
 *   core/domain/validation.js
 *   core/domain/schemas.js
 *   core/domain/commission.js
 *   core/domain/pricing.js
 *   core/domain/matching.js
 *   core/security/guards.js
 *   core/security/policy.js
 *   core/security/rate-limit.js
 *   core/storage/store.js
 *   core/runtime/bus.js
 *
 * Business modules MUST depend only on window.ShirangiCore / ShirangiValidation / etc.
 * Core must never import feature modules, payment credentials, or platform adapters.
 */
(function () {
  'use strict';
  if (typeof window !== 'undefined' && window.ShirangiCore) {
    window.__SHIRANGI_LAYERS__ = window.__SHIRANGI_LAYERS__ || [];
    if (!window.__SHIRANGI_LAYERS__.some((x) => x.id === 'core')) {
      window.__SHIRANGI_LAYERS__.push({
        id: 'core',
        name: 'Shirangi — canonical stable core',
        product: 'Shirangi Real Estate Kiosk'
      });
    }
  }
})();


/* ===== 9: js/shirangi-pro.js ===== */
/* SHIRANGI PROJECT LAYER — project-owned integration marker.
 * Runtime layer registry: identifies this module as part of Shirangi Real Estate Kiosk.
 * Third-party libraries/data remain subject to their own licenses and attribution.
 */
(function () {
  if (typeof window === 'undefined') return;
  window.__SHIRANGI_BRAND__ = window.__SHIRANGI_BRAND__ || Object.freeze({
    product: 'Shirangi Real Estate Kiosk', owner: 'Shirangi', namespace: 'shirangi'
  });
  window.__SHIRANGI_LAYERS__ = window.__SHIRANGI_LAYERS__ || [];
  var id = 'shirangi-pro';
  if (!window.__SHIRANGI_LAYERS__.some(function (x) { return x.id === id; })) {
    window.__SHIRANGI_LAYERS__.push({ id: id, name: 'Shirangi — ' + id, product: 'Shirangi Real Estate Kiosk' });
  }
}());
/* Shirangi Pro Pack 10.0 - AI sales funnel, lead stages, conversion analytics and smart follow-up */
(function(){
  'use strict';
  const KEY='shirangi_pro_v2';
  const today=()=>typeof crmToday==='function'?crmToday():new Date().toLocaleDateString('fa-IR');
  const num=v=>{const s=String(v??'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[٬،]/g,'').replace(/٫/g,'.'); const n=Number(s.replace(/[^0-9.-]/g,'')); return Number.isFinite(n)?n:0};
  const esc=v=>typeof escapeHtml==='function'?escapeHtml(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // Inline handlers need a JS-safe argument, not HTML escaping.
  const jsArg=v=>encodeURIComponent(String(v??'')).replace(/'/g,'%27');
  const read=()=>{try{return JSON.parse(ShirangiRuntimeStorage.getItem(KEY)||'{}')}catch(_){return {}}};
  const write=o=>ShirangiRuntimeStorage.setItem(KEY,JSON.stringify(o));
  function state(){const s=read();s.tasks=s.tasks||[];s.logs=s.logs||[];s.settings=s.settings||{commission:0.5};s.autoFollowups=s.autoFollowups||[];return s}
  function log(action,meta){const s=state();s.logs.unshift({id:Date.now(),date:today(),action,meta:meta||''});s.logs=s.logs.slice(0,700);write(s)}
  function activeProps(){const a=typeof window.shirangiProGetProperties==='function'?window.shirangiProGetProperties():(window.properties||[]);return (a||[]).filter(p=>p.status!=='archived')}
  function contacts(){if(typeof crmContacts==='function')return crmContacts().filter(x=>x.type==='customer');const a=typeof window.shirangiProGetCustomers==='function'?window.shirangiProGetCustomers():(window.customers||[]);return a||[]}
  function money(v){return Number(v||0).toLocaleString('fa-IR')+' تومان'}
  function propType(p){return p?.type||p?.transactionType||p?.dealType||'sale'}
  function priceOf(p){return num(p?.price||p?.salePrice||p?.amount)}
  function areaOf(p){return num(p?.area||p?.metrage||p?.meterage)}
  function rentOf(p){return num(p?.rent||p?.monthlyRent||p?.ejare)}
  function customerScore(c){
    let s=0; if(c?.name)s+=15;if(c?.phone)s+=15;if(c?.district)s+=15;if(c?.type&&c.type!=='any')s+=10;if(c?.budgetMin||c?.budgetMax)s+=20;if(c?.areaMin||c?.areaMax)s+=10;if(c?.rooms)s+=10;if(c?.callDate)s+=5;return Math.min(100,s);
  }
  function matchScore(c,p){
    let score=0,total=0; const add=(ok,w)=>{total+=w;if(ok)score+=w};
    const bmin=num(c?.budgetMin||c?.minBudget),bmax=num(c?.budgetMax||c?.maxBudget||c?.priceMax||c?.budget),pp=priceOf(p);
    if(bmin||bmax)add((!pp)||((!bmin||pp>=bmin*0.85)&&(!bmax||pp<=bmax*1.15)),30);
    const minArea=num(c?.areaMin||c?.minArea),maxArea=num(c?.areaMax||c?.maxArea),a=areaOf(p); if(minArea||maxArea)add((!a)||((!minArea||a>=minArea*0.9)&&(!maxArea||a<=maxArea*1.1)),15);
    const room=num(c?.rooms||c?.bedrooms),pr=num(p?.rooms||p?.bedrooms);if(room)add(room===pr?15:pr===room-1?8:0,15);
    const zone=String(c?.district||c?.area||c?.zone||'').trim(),addr=String(p?.address||p?.district||'');if(zone)add(addr.includes(zone),20);
    const want=String(c?.transactionType||c?.type||'').toLowerCase();if(want)add(want==='rent'?['rent','mortgage','mortgage_rent'].includes(propType(p)):want==='sale'?propType(p)==='sale':true,20);
    return total?Math.round(score/total*100):50;
  }
  function topMatches(c,limit=3){return activeProps().map(p=>({p,score:matchScore(c,p)})).sort((a,b)=>b.score-a.score).slice(0,limit)}
  function normalizeDigits(s){return String(s||'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d))}
  function numberTokenPattern(){return '[0-9]+(?:[\/\\.,٬،\s][0-9]{3})*(?:\.[0-9]+)?'}
  function cleanNumberToken(v){return num(String(v||'').trim())}
  function parseVoiceProperty(text){
    const t=normalizeDigits(text).replace(/،/g,',');const out={};
    const m=(re)=>{const x=t.match(re);return x?x[1].trim():''};
    out.title=m(/(?:عنوان|ملک|فایل)\s+(.+?)(?=\s+(?:در|منطقه|متراژ|متر|قیمت|خواب|سال)|$)/i);
    out.district=m(/(?:منطقه|ناحیه)\s*([\wآ-ی۰-۹\-]+)/i);
    const area=m(/(?:متراژ|مساحت|متراژش)\s*(\d+(?:\.\d+)?)/i);if(area)out.area=area;
    const rooms=m(/(?:خواب|اتاق)\s*(\d+)/i);if(rooms)out.rooms=rooms;
    const price=m(/(?:قیمت|فروش)\s*([\d\s,٬]+(?:\s*(?:میلیارد|میلیون))?)/i);if(price)out.price=price;
    const addr=m(/(?:آدرس|واقع در|در)\s+(.+?)(?=\s+(?:منطقه|متراژ|متر|قیمت|خواب|سال)|$)/i);if(addr&&addr.length>2)out.address=addr;
    const year=m(/(?:سال ساخت|ساخت)\s*(\d{4})/i);if(year)out.year=year;
    if(/اجاره|رهن|رهن و اجاره/.test(t))out.type=/رهن و اجاره/.test(t)?'mortgage_rent':'rent';else if(/مشارکت/.test(t))out.type='partnership';else out.type='sale';
    return out;
  }
  function fillField(id,v){const el=document.getElementById(id);if(el&&v!==undefined&&v!=='')el.value=v}
  function startVoiceIntake(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){alert('تشخیص گفتار در این مرورگر در دسترس نیست. Chrome/Edge را امتحان کنید.');return}
    const r=new SR();r.lang='fa-IR';r.interimResults=false;r.maxAlternatives=1;
    log('شروع ورود صوتی فایل');alert('صحبت کنید؛ مثلاً: «آپارتمان دو خوابه در منطقه ۵، متراژ ۱۲۰ متر، قیمت ۸ میلیارد»');
    r.onresult=e=>{const text=e.results?.[0]?.[0]?.transcript||'';const p=parseVoiceProperty(text);fillField('f-title',p.title||text.slice(0,60));fillField('f-district',p.district);fillField('f-area',p.area);fillField('f-rooms',p.rooms);fillField('f-price',p.price);fillField('f-address',p.address);fillField('f-year',p.year);if(p.type)fillField('f-type',p.type);log('ورود صوتی فایل',text);alert('اطلاعات استخراج شد؛ قبل از ذخیره یک‌بار بررسی کنید.')};
    r.onerror=()=>alert('تشخیص صدا ناموفق بود؛ دوباره تلاش کنید.');r.start();
  }
  function followupPlan(){
    const s=state(),cs=contacts(),now=new Date();const generated=[];
    cs.forEach(c=>{
      const score=customerScore(c),matches=topMatches(c,1),hasReminder=Boolean(c.callDate&&!c.callDone);
      if(score<55&&!hasReminder)generated.push({key:'complete-'+c.id,title:'تکمیل اطلاعات مشتری '+(c.name||''),note:'بودجه/منطقه/متراژ/تلفن را کامل کنید',priority:'high'});
      if(matches[0]&&matches[0].score>=70&&!hasReminder)generated.push({key:'match-'+c.id,title:'ارسال فایل به '+(c.name||''),note:'بهترین تطبیق: '+(matches[0].p.title||matches[0].p.address||'فایل')+' ('+matches[0].score+'٪)',priority:'high'});
      if(c.callDate&&!c.callDone)generated.push({key:'call-'+c.id,title:'پیگیری مشتری '+(c.name||''),note:'تماس برنامه‌ریزی‌شده',priority:'medium'});
    });
    generated.forEach(g=>{if(!s.autoFollowups.some(x=>x.key===g.key&&x.date===today())){s.autoFollowups.unshift({...g,id:crypto.randomUUID(),date:today(),done:false});}});
    s.autoFollowups=s.autoFollowups.slice(0,300);write(s);return generated.length;
  }
  function smartLeadInsights(){
    const cs=contacts(),ps=activeProps();return cs.map(c=>{const matches=topMatches(c,1)[0];let risk=0;if(!c.phone)risk+=25;if(!c.budgetMin&&!c.budgetMax)risk+=20;if(!c.district)risk+=15;if(!c.callDate)risk+=20;if(matches&&matches.score<55)risk+=20;return {c,matches,risk:Math.min(100,risk),score:Math.max(0,100-risk)}}).sort((a,b)=>b.score-a.score);
  }

  const FUNNEL=['new','contacted','visit','negotiation','won','lost'];
  const FUNNEL_FA={new:'سرنخ جدید',contacted:'تماس گرفته شد',visit:'بازدید',negotiation:'مذاکره',won:'معامله موفق',lost:'از دست رفته'};
  function funnelState(){const s=state();s.funnel=s.funnel||{};return s}
  function customerKey(c){return String(c?.id||c?.key||c?.phone||c?.name||'')}
  function funnelStage(c){const s=funnelState(),k=customerKey(c);return s.funnel[k]?.stage||c?.salesStage||'new'}
  function setFunnelStage(k,stage){const s=funnelState();s.funnel[k]={stage,updated:today()};write(s)}
  function funnelStats(){const cs=contacts(), counts=Object.fromEntries(FUNNEL.map(x=>[x,0]));cs.forEach(c=>{const st=funnelStage(c);counts[counts[st]!==undefined?st:'new']++});const active=cs.length-(counts.lost||0),won=counts.won||0;return {cs,counts,active,won,rate:cs.length?Math.round(won/cs.length*100):0}}
  function salesFunnelHtml(){
    const {cs,counts,rate}=funnelStats();
    const max=Math.max(1,...FUNNEL.map(x=>counts[x]));
    const stages=FUNNEL.map((st,i)=>`<div class="p-3 rounded-xl bg-slate-900 border border-slate-700 min-w-[145px]"><div class="flex justify-between text-xs"><b>${FUNNEL_FA[st]}</b><span>${counts[st].toLocaleString('fa-IR')}</span></div><div class="h-2 bg-slate-800 rounded-full mt-3 overflow-hidden"><div class="h-full bg-primary-500" style="width:${Math.max(6,counts[st]/max*100)}%"></div></div>${i<FUNNEL.length-1?'<div class="text-[10px] text-slate-500 mt-2">مرحله بعد ↓</div>':''}</div>`).join('');
    const rows=cs.slice().sort((a,b)=>customerScore(b)-customerScore(a)).slice(0,12).map(c=>{const k=customerKey(c),st=funnelStage(c);return `<div class="grid grid-cols-[1fr_auto] gap-2 items-center p-3 rounded-xl bg-slate-900 border border-slate-700"><div><b>${esc(c.name||'مشتری بدون نام')}</b><div class="text-xs text-slate-500 mt-1">${esc(c.phone||'بدون تلفن')} · امتیاز ${customerScore(c)}٪</div></div><select class="form-input text-xs" onchange="shirangiProSetStage('${esc(k)}',this.value)">${FUNNEL.map(x=>`<option value="${x}" ${x===st?'selected':''}>${FUNNEL_FA[x]}</option>`).join('')}</select></div>`}).join('')||'<p class="text-slate-500 text-sm">هنوز مشتری‌ای برای قیف فروش ثبت نشده است.</p>';
    return `<section class="xl:col-span-3 bg-slate-800 border border-slate-700 rounded-2xl p-5"><div class="flex flex-wrap items-center justify-between gap-3 mb-4"><div><h3 class="font-black text-lg">📈 قیف فروش 10.0</h3><p class="text-xs text-slate-400">از ورود سرنخ تا بازدید، مذاکره و معامله.</p></div><div class="px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-300 text-sm font-bold">نرخ تبدیل به معامله: ${rate}٪</div></div><div class="flex gap-2 overflow-x-auto pb-2">${stages}</div><div class="grid lg:grid-cols-2 gap-3 mt-4">${rows}</div></section>`;
  }
  window.shirangiProSetStage=(customerId,stage)=>{if(!FUNNEL.includes(stage))return;setFunnelStage(String(customerId),stage);const c=contacts().find(x=>customerKey(x)===String(customerId));log('تغییر مرحله قیف فروش',(c?.name||'مشتری')+' · '+FUNNEL_FA[stage]);render()};

  function managerHtml(){
    const ps=activeProps(),cs=contacts(),ins=smartLeadInsights(),s=state();const hot=ins.filter(x=>x.matches&&x.matches.score>=70).length;const risky=ins.filter(x=>x.risk>=60).length;
    const agents={};ps.forEach(p=>{const a=p.agent||'بدون مشاور';agents[a]=(agents[a]||0)+1});const top=Object.entries(agents).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const conv=cs.length?Math.round((hot/cs.length)*100):0;
    return `<div class="grid md:grid-cols-4 gap-3 mb-4"><div class="p-4 rounded-xl bg-slate-900"><div class="text-2xl font-black text-emerald-300">${conv}٪</div><div class="text-xs text-slate-400">نرخ مشتری با فایل مناسب</div></div><div class="p-4 rounded-xl bg-slate-900"><div class="text-2xl font-black text-amber-300">${hot.toLocaleString('fa-IR')}</div><div class="text-xs text-slate-400">سرنخ داغ</div></div><div class="p-4 rounded-xl bg-slate-900"><div class="text-2xl font-black text-rose-300">${risky.toLocaleString('fa-IR')}</div><div class="text-xs text-slate-400">سرنخ در خطر</div></div><div class="p-4 rounded-xl bg-slate-900"><div class="text-2xl font-black text-violet-300">${s.autoFollowups.filter(x=>!x.done).length.toLocaleString('fa-IR')}</div><div class="text-xs text-slate-400">اقدام خودکار باز</div></div></div><div class="space-y-2">${top.map(([a,n],i)=>`<div class="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-700"><span>${i+1}. ${esc(a)}</span><b>${n.toLocaleString('fa-IR')} فایل</b></div>`).join('')||'<p class="text-slate-500">داده مشاوران کافی نیست.</p>'}</div>`;
  }
  function render(){
    const root=document.getElementById('shirangi-pro-root');if(!root)return;followupPlan();const ps=activeProps(),cs=contacts(),s=state(),overdue=(s.tasks||[]).filter(t=>!t.done&&t.date&&t.date<today()).length;const sales=ps.filter(p=>propType(p)==='sale').length,rent=ps.filter(p=>['rent','mortgage','mortgage_rent'].includes(propType(p))).length;
    root.innerHTML=`<div class="grid grid-cols-2 lg:grid-cols-7 gap-3 mb-5">${[['فایل فعال',ps.length,'text-sky-300'],['مشتری',cs.length,'text-emerald-300'],['فروش',sales,'text-amber-300'],['اجاره/رهن',rent,'text-violet-300'],['پیگیری باز',(s.tasks||[]).filter(t=>!t.done).length,'text-orange-300'],['عقب‌افتاده',overdue,'text-rose-300'],['اقدام هوشمند',s.autoFollowups.filter(x=>!x.done).length,'text-cyan-300']].map(x=>`<div class="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center"><div class="text-2xl font-black ${x[2]}">${Number(x[1]).toLocaleString('fa-IR')}</div><div class="text-xs text-slate-400 mt-1">${x[0]}</div></div>`).join('')}</div>
    <div class="grid xl:grid-cols-3 gap-5">
      ${salesAgentHtml()}
      ${salesFunnelHtml()}
      <section class="xl:col-span-2 bg-slate-800 border border-slate-700 rounded-2xl p-5"><div class="flex items-center justify-between mb-4"><div><h3 class="font-black text-lg">🤖 دستیار فروش هوشمند</h3><p class="text-xs text-slate-400">اولویت مشتری، بهترین فایل و ریسک از دست رفتن سرنخ.</p></div><button class="touch-btn px-4 py-2 bg-primary-600 rounded-xl" onclick="shirangiProRefreshMatches()">تحلیل مجدد</button></div><div id="pro-leads" class="space-y-2">${smartLeadInsights().slice(0,8).map(x=>`<div class="p-3 rounded-xl bg-slate-900 border border-slate-700 flex gap-3 items-center"><div class="w-12 h-12 rounded-xl ${x.score>=70?'bg-emerald-500/15 text-emerald-300':'bg-amber-500/15 text-amber-300'} flex items-center justify-center font-black">${x.score}</div><div class="flex-1"><b>${esc(x.c.name||'مشتری')}</b><div class="text-xs text-slate-400">${x.matches?'بهترین فایل: '+esc(x.matches.p.title||x.matches.p.address||'بدون عنوان')+' · '+x.matches.score+'٪':'فعلاً فایل مناسب پیدا نشد'}</div><div class="text-xs mt-1 ${x.risk>=60?'text-rose-300':'text-slate-500'}">${x.risk>=60?'ریسک از دست رفتن بالا':'وضعیت پایدار'}</div></div></div>`).join('')||'<p class="text-slate-500">مشتری ثبت نشده.</p>'}</div></section>
      <section class="bg-slate-800 border border-slate-700 rounded-2xl p-5"><h3 class="font-black text-lg mb-3">⚡ اقدامات سریع</h3><div class="grid gap-2"><button class="touch-btn py-3 bg-sky-600 rounded-xl" onclick="goTo('add')">+ ثبت ملک</button><button class="touch-btn py-3 bg-emerald-600 rounded-xl" onclick="goTo('customers')">+ مشتری جدید</button><button class="touch-btn py-3 bg-violet-600 rounded-xl" onclick="shirangiProAddTask()">+ یادآوری پیگیری</button><button class="touch-btn py-3 bg-cyan-700 rounded-xl" onclick="shirangiProAutoFollowups()">اجرای پیگیری هوشمند</button><button class="touch-btn py-3 bg-fuchsia-700 rounded-xl" onclick="shirangiProAskCloudAI()">🧠 تحلیل با AI ابری</button><div id="shirangi-ai-result" class="mt-2 p-3 rounded-xl bg-slate-900 border border-slate-700 text-sm">AI ابری غیرفعال است تا کلید روی سرور تنظیم شود.</div><button class="touch-btn py-3 bg-fuchsia-700 rounded-xl" onclick="shirangiProVoice()">🎙️ ثبت ملک با صدا</button><button class="touch-btn py-3 bg-slate-700 rounded-xl" onclick="shirangiProExportCSV()">خروجی گزارش CSV</button></div></section>
      <section class="bg-slate-800 border border-slate-700 rounded-2xl p-5"><h3 class="font-black text-lg mb-3">📌 اقدامات هوشمند</h3><div class="space-y-2 max-h-72 overflow-auto">${s.autoFollowups.filter(x=>!x.done).slice(0,15).map(t=>`<div class="p-3 rounded-xl bg-slate-900 border border-slate-700"><div class="flex justify-between gap-2"><b class="text-sm">${esc(t.title)}</b><button class="text-emerald-300" onclick="shirangiProDoneAuto('${esc(String(t.id))}')">✓</button></div><div class="text-xs text-slate-400 mt-1">${esc(t.note||'')}</div></div>`).join('')||'<p class="text-slate-500 text-sm">اقدام جدیدی پیشنهاد نشده.</p>'}</div></section>
      <section class="bg-slate-800 border border-slate-700 rounded-2xl p-5"><h3 class="font-black text-lg mb-3">📊 گزارش مدیر دفتر</h3>${managerHtml()}</section>
      <section class="xl:col-span-2 bg-slate-800 border border-slate-700 rounded-2xl p-5"><h3 class="font-black text-lg mb-3">🎯 تطبیق هوشمند مشتری و ملک</h3><div class="grid md:grid-cols-2 gap-3"><select id="pro-match-customer" class="form-input"><option value="">انتخاب مشتری</option>${cs.map(c=>`<option value="${esc(c.id||c.key)}">${esc(c.name)}${c.phone?' · '+esc(c.phone):''}</option>`).join('')}</select><select id="pro-match-limit" class="form-input"><option value="5">۵ نتیجه</option><option value="10">۱۰ نتیجه</option><option value="20">۲۰ نتیجه</option></select></div><div id="pro-match-results" class="mt-4 space-y-2"><p class="text-sm text-slate-500">یک مشتری انتخاب کنید.</p></div></section>
      <section class="bg-slate-800 border border-slate-700 rounded-2xl p-5"><h3 class="font-black text-lg mb-3">📈 تحلیل سریع قیمت</h3><div>${marketHtml(ps)}</div></section>
    </div>`;
  }
  function salesAgentPlan(c){
    const best=topMatches(c,5), chosen=best.filter(x=>x.score>=55).slice(0,3), name=c?.name||'مشتری';
    const actions=[];
    if(!c?.phone) actions.push('شماره تماس مشتری را تکمیل کنید.');
    if(!c?.budgetMin&&!c?.budgetMax) actions.push('بودجه مشتری را مشخص کنید.');
    if(!c?.district) actions.push('منطقه یا محدوده موردنظر را مشخص کنید.');
    if(chosen.length) actions.push('۳ فایل برتر را همین امروز ارسال کنید.');
    else actions.push('با مشتری تماس بگیرید و نیاز او را دقیق‌تر ثبت کنید.');
    return {best,chosen,actions,name};
  }
  function salesAgentHtml(){
    const cs=contacts();
    return `<section class="xl:col-span-3 bg-slate-800 border border-emerald-500/30 rounded-2xl p-5">
      <div class="flex items-center justify-between gap-3 mb-4"><div><h3 class="font-black text-lg">💼 فروشنده هوشمند شیرنگی 2.2</h3><p class="text-xs text-slate-400">نیاز مشتری را به اقدام فروش تبدیل می‌کند: پیشنهاد ملک، دلیل پیشنهاد و پیگیری بعدی.</p></div><span class="pro-badge">SALES AGENT</span></div>
      <div class="grid md:grid-cols-[1fr_auto] gap-3"><select id="sales-agent-customer" class="form-input"><option value="">انتخاب مشتری</option>${cs.map(c=>`<option value="${esc(c.id||c.key)}">${esc(c.name||'مشتری بدون نام')}${c.phone?' · '+esc(c.phone):''}</option>`).join('')}</select><button class="touch-btn px-5 py-3 bg-emerald-600 rounded-xl font-bold" onclick="shirangiProSalesAgentRun()">ساخت برنامه فروش</button></div>
      <div id="sales-agent-result" class="mt-4"><p class="text-sm text-slate-500">یک مشتری انتخاب کنید تا برنامه فروش ساخته شود.</p></div>
    </section>`;
  }
  window.shirangiProSalesAgentRun=()=>{
    const id=document.getElementById('sales-agent-customer')?.value, out=document.getElementById('sales-agent-result');
    if(!out)return; if(!id){out.innerHTML='<p class="text-sm text-slate-500">ابتدا مشتری را انتخاب کنید.</p>';return}
    const c=contacts().find(x=>String(x.id||x.key)===String(id)); if(!c){out.innerHTML='<p class="text-rose-300">مشتری پیدا نشد.</p>';return}
    const plan=salesAgentPlan(c);
    out.innerHTML=`<div class="grid lg:grid-cols-3 gap-3">
      <div class="lg:col-span-2 space-y-2"><div class="p-3 rounded-xl bg-slate-900 border border-slate-700"><b>پیشنهاد فروش برای ${esc(plan.name)}</b><div class="text-xs text-slate-400 mt-1">بر اساس بودجه، متراژ، خواب، منطقه و نوع معامله.</div></div>
      ${plan.chosen.map((x,i)=>`<div class="p-3 rounded-xl bg-slate-900 border border-slate-700 flex items-center gap-3"><div class="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-300 flex items-center justify-center font-black">${x.score}%</div><div class="flex-1"><b>${esc(x.p.title||x.p.address||'ملک')}</b><div class="text-xs text-slate-400 mt-1">${esc(x.p.address||x.p.district||'')} · ${areaOf(x.p)?areaOf(x.p).toLocaleString('fa-IR')+' متر':''}</div><div class="text-xs text-emerald-300 mt-1">دلیل: تطبیق ${x.score}% با نیاز ثبت‌شده</div></div><button class="touch-btn px-3 py-2 bg-primary-600 rounded-lg text-xs" onclick="openDetail(decodeURIComponent(\'${jsArg(String(x.p.id))}\'))">مشاهده</button></div>`).join('')||'<div class="p-4 rounded-xl bg-slate-900 text-amber-300">فایل با تطبیق کافی پیدا نشد.</div>'}</div>
      <div class="p-3 rounded-xl bg-slate-900 border border-slate-700"><b>اقدام بعدی</b><div class="space-y-2 mt-3">${plan.actions.map((a,i)=>`<div class="text-sm p-2 rounded-lg bg-slate-800">${i+1}. ${esc(a)}</div>`).join('')}</div><button class="touch-btn w-full mt-3 py-3 bg-violet-600 rounded-xl font-bold" onclick="shirangiProCreateSalesTask(decodeURIComponent(\'${jsArg(String(c.id||c.key))}\'))">ساخت پیگیری</button><button class="touch-btn w-full mt-2 py-3 bg-cyan-700 rounded-xl font-bold" onclick="shirangiProLogSalesAction(decodeURIComponent(\'${jsArg(String(c.id||c.key))}\'))">ثبت تماس/ارسال فایل</button></div>
    </div>`;
    log('اجرای فروشنده هوشمند',plan.name+' · '+plan.chosen.length+' فایل');
  };
  window.shirangiProCreateSalesTask=(customerId)=>{const c=contacts().find(x=>String(x.id||x.key)===String(customerId));if(!c)return;const best=topMatches(c,1)[0];const s=state();s.tasks.push({id:Date.now(),title:'پیگیری فروش '+(c.name||'مشتری'),date:today(),done:false,customerId:String(customerId),propertyId:best?.p?.id||'',source:'sales-agent',note:best?'ارسال/پیگیری فایل '+(best.p.title||best.p.address||'پیشنهاد شده'):'تکمیل نیاز مشتری'});write(s);log('ساخت پیگیری فروش',c.name||'مشتری');render();alert('پیگیری فروش ساخته شد.')};
  window.shirangiProLogSalesAction=(customerId)=>{const c=contacts().find(x=>String(x.id||x.key)===String(customerId));if(!c)return;const action=prompt('اقدام انجام‌شده را وارد کنید:','تماس با مشتری و ارسال فایل‌های پیشنهادی');if(!action)return;log('اقدام فروش',`${c.name||'مشتری'} · ${action}`);alert('اقدام فروش ثبت شد.')};
  function marketHtml(ps){const priced=ps.filter(p=>priceOf(p)>0&&areaOf(p)>0);if(!priced.length)return '<p class="text-slate-500 text-sm">برای تحلیل، ملک دارای قیمت و متراژ ثبت کنید.</p>';const vals=priced.map(p=>priceOf(p)/areaOf(p));const avg=vals.reduce((a,b)=>a+b,0)/vals.length;return `<div class="space-y-3"><div class="text-2xl font-black text-emerald-300">${money(Math.round(avg))}</div><p class="text-xs text-slate-500">میانگین قیمت هر متر از فایل‌های داخلی.</p></div>`}
  window.shirangiProRefreshMatches=()=>{const id=document.getElementById('pro-match-customer')?.value,out=document.getElementById('pro-match-results');if(!out)return;if(!id){out.innerHTML='<p class="text-sm text-slate-500">یک مشتری انتخاب کنید.</p>';return}const c=contacts().find(x=>String(x.id||x.key)===String(id));const list=topMatches(c,Number(document.getElementById('pro-match-limit')?.value||5));out.innerHTML=list.map(({p,score})=>`<div class="p-3 rounded-xl bg-slate-900 border border-slate-700 flex items-center gap-3"><div class="w-12 h-12 rounded-xl bg-emerald-500/15 flex items-center justify-center font-black text-emerald-300">${score}%</div><div class="flex-1"><b>${esc(p.title||p.address||'ملک بدون عنوان')}</b><div class="text-xs text-slate-400">${esc(p.address||'')} · ${areaOf(p)?areaOf(p).toLocaleString('fa-IR')+' متر':''}</div></div><button class="touch-btn px-3 py-2 bg-primary-600 rounded-lg text-xs" onclick="openDetail(decodeURIComponent(\'${jsArg(String(p.id))}\'))">مشاهده</button></div>`).join('')||'<p class="text-sm text-slate-500">فایل مناسبی پیدا نشد.</p>';};
  async function cloudAI(prompt, context){
    const cfg=window.SHIRANGI_CONFIG||{};
    if(!cfg.useCloudAI || !cfg.functionsBase){throw new Error('AI ابری هنوز در تنظیمات فعال نشده است.');}
    const fn=cfg.aiFunctionName||'shirangi-ai';
    const url=String(cfg.functionsBase).replace(/\/$/,'')+'/'+fn;
    const payload={prompt:String(prompt||'').slice(0,6000),context:context||{}};
    const headers={'Content-Type':'application/json'};
     const sbClient=(window.supabase?.createClient&&cfg.supabaseUrl&&cfg.supabaseKey&&!String(cfg.supabaseUrl).includes('YOUR_PROJECT'))?window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey):null;
     if(!sbClient) throw new Error('برای AI ابری، اتصال امن Supabase لازم است.');
     const sessionResult=await sbClient.auth.getSession();
     const accessToken=sessionResult?.data?.session?.access_token||'';
     if(!accessToken) throw new Error('برای استفاده از AI ابری ابتدا وارد حساب کاربری شوید.');
     headers.Authorization='Bearer '+accessToken;
     headers.apikey=cfg.supabaseKey;
    const r=await fetch(url,{method:'POST',headers,body:JSON.stringify(payload)});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||!j.ok)throw new Error(j.error||'پاسخ هوش مصنوعی دریافت نشد.');
    return String(j.text||'').trim();
  }
  window.shirangiProAskCloudAI=async()=>{
    const ins=smartLeadInsights().slice(0,12).map(x=>({customer:{name:x.c?.name||'',phone:x.c?.phone||'',district:x.c?.district||'',budgetMin:x.c?.budgetMin||x.c?.minBudget||'',budgetMax:x.c?.budgetMax||x.c?.maxBudget||x.c?.budget||''},leadScore:x.score,risk:x.risk,bestMatch:x.matches?{title:x.matches.p?.title||'',address:x.matches.p?.address||'',score:x.matches.score}:null}));
    const prompt=promptUser('از داده‌های فروش زیر استفاده کن و یک برنامه عملی ۷ روزه برای افزایش معاملات بده. ۵ سرنخ اولویت‌دار را مشخص کن، برای هرکدام اقدام بعدی کوتاه پیشنهاد بده و در پایان ۳ پیشنهاد برای مدیر دفتر بده. فقط بر اساس داده موجود صحبت کن و چیزی را حدس نزن.');
    if(!prompt)return;
    const out=document.getElementById('shirangi-ai-result');if(out)out.innerHTML='<div class="text-sm text-slate-400">در حال تحلیل...</div>';
    try{const text=await cloudAI(prompt,{leads:ins,properties:activeProps().slice(0,60).map(p=>({title:p.title||'',address:p.address||'',type:propType(p),area:areaOf(p),price:priceOf(p),rent:rentOf(p)}))});if(out)out.innerHTML='<div class="whitespace-pre-wrap leading-7">'+esc(text)+'</div>';log('تحلیل AI ابری','برنامه فروش ۷ روزه');}catch(e){if(out)out.innerHTML='<div class="text-rose-300">'+esc(e.message||'خطا')+'</div>';}
  };
  function promptUser(message){return window.prompt(message,'یک برنامه فروش عملی و کوتاه می‌خواهم.')||''}
  window.shirangiProAutoFollowups=()=>{const n=followupPlan();render();log('اجرای پیگیری هوشمند',n+' اقدام پیشنهاد شد');alert(n+' اقدام هوشمند برای پیگیری ساخته شد.')};
  window.shirangiProDoneAuto=id=>{const s=state(),t=s.autoFollowups.find(x=>String(x.id)===String(id));if(t)t.done=true;write(s);render()};
  window.shirangiProVoice=()=>{if(document.getElementById('screen-add')?.classList.contains('active'))startVoiceIntake();else{goTo('add');setTimeout(startVoiceIntake,350)}};
  window.shirangiProAddTask=()=>{const title=prompt('عنوان پیگیری را وارد کنید:');if(!title)return;const date=prompt('تاریخ پیگیری (مثلاً '+today()+'):',today());const s=state();s.tasks.push({id:Date.now(),title,date:date||today(),done:false});write(s);log('ثبت پیگیری',title);render()};
  window.shirangiProExportCSV=()=>{const ps=activeProps(),rows=[['شناسه','عنوان','نوع','آدرس','متراژ','قیمت','اجاره'],...ps.map(p=>[p.id,p.title||'',propType(p),p.address||'',areaOf(p),priceOf(p),rentOf(p)])],csv='\ufeff'+rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='shirangi-report.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);log('خروجی CSV','گزارش املاک')};
  function injectVoiceButton(){const form=document.getElementById('add-property-form');if(!form||document.getElementById('shirangi-voice-btn'))return;const b=document.createElement('button');b.type='button';b.id='shirangi-voice-btn';b.className='touch-btn px-4 py-3 bg-fuchsia-700 rounded-xl font-bold mb-3';b.innerHTML='🎙️ ورود سریع مشخصات با صدا';b.onclick=startVoiceIntake;form.insertBefore(b,form.firstChild)}
  function marketData(){
    const ps=activeProps(), districts=[...new Set(ps.map(p=>String(p.district||p.zone||'').trim()).filter(Boolean))].slice(0,30);
    return {ps,districts};
  }
  function marketCard(p,selected){
    const price=priceOf(p), area=areaOf(p), ppm=price&&area?Math.round(price/area):0;
    return `<article class="market-card p-3 rounded-2xl bg-slate-900 border ${selected?'border-primary-400':'border-slate-700'} flex gap-3 items-center">
      <div class="w-24 h-20 rounded-xl bg-slate-800 overflow-hidden flex-shrink-0"><img src="${esc(p.image||p.images?.[0]||'')}" onerror="this.style.display='none'" class="w-full h-full object-cover" alt=""></div>
      <div class="min-w-0 flex-1"><div class="flex items-center gap-2"><b class="truncate">${esc(p.title||p.address||'ملک بدون عنوان')}</b><span class="text-[10px] px-2 py-1 rounded-full bg-primary-500/15 text-primary-300">${propType(p)==='sale'?'فروش':'اجاره'}</span></div>
      <div class="text-xs text-slate-400 mt-1 truncate">${esc(p.district||'')} · ${area?area.toLocaleString('fa-IR')+' متر':''} · ${num(p.rooms||p.bedrooms)?num(p.rooms||p.bedrooms)+' خواب':''}</div>
      <div class="text-sm text-emerald-300 font-bold mt-1">${price?money(price):rentOf(p)?money(rentOf(p)):'قیمت توافقی'} ${ppm?' · '+money(ppm)+'/متر':''}</div></div>
      <button class="touch-btn px-3 py-2 bg-primary-600 rounded-lg text-xs" onclick="openDetail(decodeURIComponent(\'${jsArg(String(p.id))}\'))">مشاهده</button>
      <button class="touch-btn px-3 py-2 bg-slate-700 rounded-lg text-xs" onclick="shirangiProToggleCompare(decodeURIComponent(\'${jsArg(String(p.id))}\'))">${selected?'حذف':'مقایسه'}</button>
    </article>`;
  }
  function parseNaturalNeed(text){
    const t=normalizeDigits(String(text||'').toLowerCase().replace(/،/g,',')); const out={type:'',district:'',minArea:0,maxArea:0,maxPrice:0,rooms:0,features:[]};
    let m=t.match(/(\d+(?:\.\d+)?)\s*(?:تا|الی)\s*(\d+(?:\.\d+)?)\s*متر/); if(m){out.minArea=num(m[1]);out.maxArea=num(m[2]);} else {m=t.match(/(\d+(?:\.\d+)?)\s*متر/);if(m)out.minArea=num(m[1]);}
    m=t.match(new RegExp('(?:تا|حداکثر)\\s*('+numberTokenPattern()+')\\s*(میلیارد|میلیون)(?:\\s*تومان)?')); if(m){const n=cleanNumberToken(m[1]);out.maxPrice=m[2].includes('میلیارد')?n*1e9:n*1e6;} else {m=t.match(new RegExp('(?:تا|حداکثر)\\s*('+numberTokenPattern()+')(?:\\s*تومان)?')); if(m){out.maxPrice=cleanNumberToken(m[1]);}}
    m=t.match(/(\d+)\s*(?:خواب|اتاق)/); if(m)out.rooms=num(m[1]);
    if(/رهن/.test(t)&&/اجاره/.test(t))out.type='mortgage_rent'; else if(/اجاره/.test(t))out.type='rent'; else if(/فروش|خرید/.test(t))out.type='sale';
    out.district=marketData().districts.find(d=>t.includes(String(d).toLowerCase()))||'';
    out.features=['آسانسور','پارکینگ','انباری','بالکن','استخر','نگهبانی','لابی','بازسازی'].filter(k=>t.includes(k)); return out;
  }
  function naturalRank(p,n){let s=50,hay=[p.title,p.address,p.district,p.description,p.features,p.amenities].join(' ').toLowerCase(),pp=priceOf(p),aa=areaOf(p),rr=num(p.rooms||p.bedrooms);if(n.type)s+=propType(p)===n.type?20:-15;if(n.minArea)s+=aa>=n.minArea?12:-10;if(n.maxArea)s+=aa<=n.maxArea?8:-8;if(n.maxPrice&&pp)s+=pp<=n.maxPrice?15:-18;if(n.rooms&&rr)s+=rr===n.rooms?12:(Math.abs(rr-n.rooms)===1?4:-10);if(n.district)s+=String(p.district||p.zone||p.address||'').toLowerCase().includes(n.district.toLowerCase())?12:-5;n.features.forEach(f=>{if(hay.includes(f))s+=4});return Math.max(0,Math.min(100,Math.round(s)))}
  function aiNeedHtml(){return `<section class="bg-slate-800 border border-fuchsia-500/30 rounded-2xl p-4"><div class="flex items-center justify-between gap-3"><div><h3 class="font-black text-lg">🧠 دستیار انتخاب ملک</h3><p class="text-xs text-slate-400">نیاز مشتری را طبیعی بنویسید؛ ۵ ملک برتر را رتبه‌بندی می‌کنیم.</p></div><button class="touch-btn px-4 py-2 bg-fuchsia-600 rounded-xl" onclick="shirangiProRunNeedAI()">پیدا کن</button></div><div class="mt-3 grid md:grid-cols-4 gap-2"><input id="market-ai-query" class="form-input md:col-span-3" placeholder="مثلاً آپارتمان ۱۰۰ تا ۱۳۰ متر، دو خواب، تا ۱۰ میلیارد، پارکینگ و آسانسور در منطقه ۵"><button class="touch-btn bg-slate-700 rounded-xl" onclick="shirangiProVoiceNeed()">🎙️ گفتن نیاز</button></div><div id="market-ai-summary" class="mt-3 text-sm"></div><div id="market-ai-results" class="mt-3 space-y-2"></div></section>`}
  window.shirangiProRunNeedAI=()=>{const q=document.getElementById('market-ai-query')?.value||'';if(!q.trim()){alert('نیاز مشتری را وارد کنید.');return}const n=parseNaturalNeed(q),r=activeProps().map(p=>({p,score:naturalRank(p,n)})).sort((a,b)=>b.score-a.score).slice(0,5),sum=document.getElementById('market-ai-summary'),box=document.getElementById('market-ai-results');if(sum)sum.innerHTML=`<div class="p-3 rounded-xl bg-slate-900 border border-slate-700"><b>برداشت سیستم:</b> ${n.type==='sale'?'فروش':n.type==='rent'?'اجاره':n.type==='mortgage_rent'?'رهن و اجاره':'همه معاملات'}${n.minArea?' · از '+n.minArea+' متر':''}${n.maxArea?' تا '+n.maxArea+' متر':''}${n.maxPrice?' · تا '+money(n.maxPrice):''}${n.rooms?' · '+n.rooms+' خواب':''}${n.district?' · '+esc(n.district):''}${n.features.length?' · '+n.features.map(esc).join('، '):''}</div>`;if(box)box.innerHTML=r.map(x=>`<div class="p-3 rounded-xl bg-slate-900 border border-slate-700 flex items-center gap-3"><div class="w-12 h-12 rounded-xl bg-fuchsia-500/15 text-fuchsia-300 flex items-center justify-center font-black">${x.score}%</div><div class="flex-1"><b>${esc(x.p.title||x.p.address||'ملک')}</b><div class="text-xs text-slate-400">${esc(x.p.district||x.p.address||'')} · ${areaOf(x.p)?areaOf(x.p).toLocaleString('fa-IR')+' متر':''} · ${priceOf(x.p)?money(priceOf(x.p)):'توافقی'}</div></div><button class="touch-btn px-3 py-2 bg-primary-600 rounded-lg text-xs" onclick="openDetail(decodeURIComponent(\'${jsArg(String(x.p.id))}\'))">مشاهده</button></div>`).join('')||'<p class="text-slate-500">ملک مناسبی پیدا نشد.</p>';log('AI محلی - جستجوی نیاز',q)};
  window.shirangiProVoiceNeed=()=>{const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){alert('تشخیص گفتار در این مرورگر فعال نیست.');return}const r=new SR();r.lang='fa-IR';r.interimResults=false;r.onresult=e=>{const t=e.results?.[0]?.[0]?.transcript||'';const el=document.getElementById('market-ai-query');if(el){el.value=t;window.shirangiProRunNeedAI()}};r.start()};
  function marketRender(){
    const root=document.getElementById('shirangi-market-root'); if(!root)return;
    const {ps,districts}=marketData(), q=String(document.getElementById('market-q')?.value||'').trim().toLowerCase();
    const type=String(document.getElementById('market-type')?.value||'all'), min=num(document.getElementById('market-min')?.value), max=num(document.getElementById('market-max')?.value), minA=num(document.getElementById('market-min-area')?.value), maxA=num(document.getElementById('market-max-area')?.value), rooms=num(document.getElementById('market-rooms')?.value), district=String(document.getElementById('market-district')?.value||'');
    const filtered=ps.filter(p=>{const hay=[p.title,p.address,p.district,p.zone,p.neighborhood,p.description].join(' ').toLowerCase(); if(q&&!hay.includes(q))return false; if(type!=='all'&&propType(p)!==type)return false; const pr=priceOf(p),ar=areaOf(p),rm=num(p.rooms||p.bedrooms); if(min&&(pr&&pr<min))return false;if(max&&(pr&&pr>max))return false;if(minA&&(ar&&ar<minA))return false;if(maxA&&(ar&&ar>maxA))return false;if(rooms&&rm!==rooms)return false;if(district&&String(p.district||p.zone||'')!==district)return false;return true}).sort((a,b)=>(priceOf(a)||1)-(priceOf(b)||1));
    const selected=new Set(state().compare||[]);
    root.querySelector('#market-count').textContent=filtered.length.toLocaleString('fa-IR')+' فایل';
    root.querySelector('#market-results').innerHTML=filtered.slice(0,60).map(p=>marketCard(p,selected.has(String(p.id)))).join('')||'<div class="p-8 text-center text-slate-500">فایلی با این فیلتر پیدا نشد.</div>';
    const comp=filtered.filter(p=>selected.has(String(p.id))).slice(0,4); const box=root.querySelector('#market-compare');
    box.innerHTML=comp.length?`<div class="overflow-auto"><table class="w-full text-sm"><thead><tr class="text-slate-400"><th class="p-2 text-right">ویژگی</th>${comp.map(p=>`<th class="p-2 text-right">${esc(p.title||p.address||'ملک')}</th>`).join('')}</tr></thead><tbody>${[['قیمت',p=>priceOf(p)?money(priceOf(p)):'—'],['متراژ',p=>areaOf(p)?areaOf(p).toLocaleString('fa-IR')+' متر':'—'],['قیمت/متر',p=>priceOf(p)&&areaOf(p)?money(Math.round(priceOf(p)/areaOf(p))):'—'],['منطقه',p=>p.district||'—'],['خواب',p=>num(p.rooms||p.bedrooms)||'—']].map(([k,f])=>`<tr class="border-t border-slate-700"><td class="p-2 text-slate-400">${k}</td>${comp.map(p=>`<td class="p-2 font-bold">${esc(f(p))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:'<p class="text-sm text-slate-500">برای مقایسه، روی «مقایسه» بزنید (حداکثر ۴ ملک).</p>';
  }
  window.shirangiProToggleCompare=id=>{const s=state();s.compare=s.compare||[];id=String(id);const i=s.compare.indexOf(id);if(i>=0)s.compare.splice(i,1);else if(s.compare.length<4)s.compare.push(id);else return alert('حداکثر ۴ ملک را می‌توان مقایسه کرد.');write(s);marketRender()};
  window.shirangiProFormatMoneyInput=el=>{if(!el)return;const n=num(el.value);el.value=el.value.trim()===''?'':Math.round(n).toLocaleString('fa-IR');};
  function marketScreen(){
    if(document.getElementById('screen-market'))return;
    const st=document.createElement('div');st.id='screen-market';st.className='screen';st.innerHTML=`<header class="bg-slate-800/95 backdrop-blur px-5 py-4 flex items-center justify-between border-b border-slate-700 gap-3"><button onclick="goTo('list')" class="touch-btn px-4 py-3 bg-slate-700 rounded-xl">↩ بازگشت</button><div class="text-center"><h2 class="text-2xl font-black">بازار هوشمند شیرنگی <span class="pro-badge">2.2 AI</span></h2><p class="text-xs text-slate-400">جستجوی سریع، فیلتر حرفه‌ای و مقایسه ملک</p></div><button onclick="shirangiProMarket()" class="touch-btn px-4 py-3 bg-primary-600 rounded-xl">بروزرسانی</button></header><div class="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-950"><div class="max-w-7xl mx-auto space-y-4"><section class="bg-slate-800 border border-slate-700 rounded-2xl p-4"><div class="mb-4">${aiNeedHtml()}</div><div class="grid md:grid-cols-6 gap-2"><input id="market-q" oninput="shirangiProMarketRender()" class="form-input md:col-span-2" placeholder="جستجو: محله، آدرس، عنوان..."><select id="market-type" onchange="shirangiProMarketRender()" class="form-input"><option value="all">همه معاملات</option><option value="sale">فروش</option><option value="rent">اجاره</option><option value="mortgage_rent">رهن و اجاره</option></select><select id="market-district" onchange="shirangiProMarketRender()" class="form-input"><option value="">همه مناطق</option></select><input id="market-min" oninput="shirangiProFormatMoneyInput(this);shirangiProMarketRender()" class="form-input" inputmode="decimal" placeholder="حداقل قیمت"><input id="market-max" oninput="shirangiProFormatMoneyInput(this);shirangiProMarketRender()" class="form-input" inputmode="decimal" placeholder="حداکثر قیمت"><input id="market-min-area" oninput="shirangiProMarketRender()" class="form-input" inputmode="numeric" placeholder="حداقل متراژ"><input id="market-max-area" oninput="shirangiProMarketRender()" class="form-input" inputmode="numeric" placeholder="حداکثر متراژ"><select id="market-rooms" onchange="shirangiProMarketRender()" class="form-input"><option value="0">هر تعداد خواب</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></div><div class="flex justify-between mt-3 text-xs text-slate-400"><span id="market-count">۰ فایل</span><button onclick="shirangiProClearCompare()" class="text-amber-300">پاک کردن مقایسه</button></div></section><section class="bg-slate-800 border border-slate-700 rounded-2xl p-4"><div class="flex items-center justify-between mb-3"><h3 class="font-black text-lg">نتایج</h3><span class="text-xs text-slate-500">تا ۶۰ نتیجه</span></div><div id="market-results" class="space-y-2"></div></section><section class="bg-slate-800 border border-slate-700 rounded-2xl p-4"><h3 class="font-black text-lg mb-3">⚖️ مقایسه هوشمند</h3><div id="market-compare"></div></section></div></div>`;
    document.body.insertBefore(st,document.body.firstChild);
    st.querySelector('#market-district').innerHTML='<option value="">همه مناطق</option>'+marketData().districts.map(d=>`<option value="${esc(d)}">${esc(d)}</option>`).join('');
  }
  window.shirangiProClearCompare=()=>{const s=state();s.compare=[];write(s);marketRender()};
  window.shirangiProMarketRender=marketRender;
  window.shirangiProMarket=()=>{marketScreen();goTo('market');marketRender()};
  function inject(){if(document.getElementById('screen-pro'))return;const style=document.createElement('style');style.textContent='.pro-nav-btn{position:fixed;bottom:18px;left:18px;z-index:40;box-shadow:0 10px 30px #0008}.pro-badge{font-size:10px;padding:2px 6px;border-radius:999px;background:#7c3aed}';document.head.appendChild(style);const screen=document.createElement('div');screen.id='screen-pro';screen.className='screen';screen.innerHTML='<header class="bg-slate-800/95 backdrop-blur px-6 py-4 flex items-center justify-between border-b border-slate-700"><button onclick="goTo(\'list\')" class="touch-btn px-5 py-3 bg-slate-700 rounded-xl text-lg">↩ بازگشت</button><div class="text-center"><h2 class="text-2xl font-black">مرکز مدیریت شیرنگی <span class="pro-badge">PRO 2.2 AI SALES</span></h2><p class="text-sm text-slate-400">دستیار فروش، صوت، پیگیری هوشمند و گزارش مدیر</p></div><button onclick="renderShirangiPro()" class="touch-btn px-5 py-3 bg-primary-600 rounded-xl">بروزرسانی</button></header><div class="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-900"><div class="max-w-7xl mx-auto" id="shirangi-pro-root"></div></div>';document.body.insertBefore(screen,document.body.firstChild);const btn=document.createElement('button');btn.className='pro-nav-btn touch-btn px-4 py-3 bg-violet-600 rounded-2xl font-black';btn.innerHTML='📊 مرکز مدیریت';btn.onclick=()=>window.shirangiProOpen();document.body.appendChild(btn);const mb=document.createElement('button');mb.className='pro-nav-btn touch-btn px-4 py-3 bg-emerald-600 rounded-2xl font-black';mb.style.bottom='76px';mb.innerHTML='🏠 بازار هوشمند';mb.onclick=()=>window.shirangiProMarket();document.body.appendChild(mb);marketScreen();window.renderShirangiPro=render;setTimeout(injectVoiceButton,0)}
  window.shirangiProOpen=()=>{goTo('pro');render()};
  function boot(){inject();injectVoiceButton();const s=state();if(!s.installed){s.installed=true;write(s);log('فعال‌سازی Shirangi Pro','نسخه 1.8.1')}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();


/* ===== 10: inline ===== */
// ========== DATA ==========
        // نمونه املاک پوشش مناطق ۲۲گانه تهران
        // املاک جدید از طریق فرم «افزودن ملک» اضافه و در مرورگر ذخیره می‌شوند
        let properties = [];
        window.shirangiProGetProperties = () => properties;
        // داده‌های نمونه/فیک عمداً از پروژه حذف شده‌اند.
        // املاک فقط از طریق ورود اطلاعات واقعی، بکاپ یا اتصال داده ذخیره‌شده بارگذاری می‌شوند.

        // ========== ذخیره‌سازی: Electron (هارد) یا مرورگر (ShirangiRuntimeStorage) ==========
        const isElectron = !!(window.electronAPI && window.electronAPI.isElectron);

        function escapeHtml(value) {
            return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch]));
        }


        function safeJsArg(value) {
            return encodeURIComponent(String(value ?? ''));
        }
        function decodeJsArg(value) {
            try { return decodeURIComponent(String(value ?? '')); } catch (_) { return ''; }
        }

        function safeImageSrc(value) {
            const src = String(value ?? '').trim();
            if (/^https?:\/\//i.test(src)) return src;
            if (/^data:image\/(?:png|jpeg|jpg|webp);base64,/i.test(src)) return src;
            // در Electron فقط فایل‌های تصویری تولیدشده توسط خود کیوسک مجازند؛
            // از بارگذاری file:// دلخواه برای جلوگیری از افشای فایل محلی جلوگیری کن.
            if (isElectron && /^file:\/\//i.test(src)) {
                try {
                    const u = new URL(src);
                    const p = decodeURIComponent(u.pathname || '');
                    if (/\/kiosk-data\/images\/prop-[a-zA-Z0-9_-]+-[a-zA-Z0-9_-]+-\d{1,3}\.(?:png|jpe?g|webp)$/i.test(p)) return src;
                } catch (_) {}
            }
            return '';
        }

        function normalizePropertiesList(list) {
            if (!Array.isArray(list)) return [];
            const used = new Set();
            let nextId = 1;
            const usedFileNumbers = new Set();
            let nextFileNumber = 1;
            return list.filter(p => p && typeof p === 'object' && !Array.isArray(p)).map(p => {
                let id = Number(p.id);
                if (!Number.isSafeInteger(id) || id <= 0 || used.has(id)) {
                    while (used.has(nextId)) nextId++;
                    id = nextId++;
                }
                used.add(id);
                p.id = id;
                let fileNumber = Number(p.fileNumber);
                if (!Number.isSafeInteger(fileNumber) || fileNumber <= 0 || usedFileNumbers.has(fileNumber)) {
                    while (usedFileNumbers.has(nextFileNumber)) nextFileNumber++;
                    fileNumber = nextFileNumber++;
                }
                usedFileNumbers.add(fileNumber);
                p.fileNumber = fileNumber;
                p.status = ['available','reserved','sold','archived'].includes(p.status) ? p.status : 'available';
                p.category = typeof p.category === 'string' && p.category.length <= 40 ? p.category : 'residential';
                if (p.type === 'buy') p.type = 'sale';
                if (!['sale','rent','mortgage','mortgage_rent','rahn','partnership'].includes(p.type)) p.type = 'sale';
                // سازگاری داده‌های قدیمی: «rahn» همان رهن است.
                if (p.type === 'rahn') p.type = 'mortgage';
                const lat = Number(p.lat), lng = Number(p.lng);
                if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) { p.lat = 35.6892; p.lng = 51.3890; }
                p.images = p.images && typeof p.images === 'object' ? p.images : {};
                for (const key of ['facade','alley','plan','unit']) {
                    const arr = Array.isArray(p.images[key]) ? p.images[key] : [];
                    p.images[key] = arr.filter(x => typeof x === 'string' && x.length <= 4 * 1024 * 1024 && !!safeImageSrc(x)).slice(0, 20);
                }
                return p;
            });
        }

        function normalizeAgentsList(list) {
            if (!Array.isArray(list)) return [];
            const used = new Set(); let next = 1;
            return list.filter(a => a && typeof a === 'object' && typeof a.name === 'string' && a.name.trim() && a.name.length <= 200).map(a => {
                let id = Number(a.id);
                if (!Number.isSafeInteger(id) || id <= 0 || used.has(id)) { while (used.has(next)) next++; id = next++; }
                used.add(id); a.id = id; a.name = a.name.trim(); a.phone = a.phone ? String(a.phone).slice(0, 50) : ''; return a;
            });
        }

        function normalizeCustomersList(list) {
            if (!Array.isArray(list)) return [];
            const used = new Set(); let next = 1;
            const usedCustomerNumbers = new Set(); let nextCustomerNumber = 1;
            return list.filter(c => c && typeof c === 'object' && typeof c.name === 'string' && c.name.trim() && c.name.length <= 200).map(c => {
                let id = Number(c.id);
                if (!Number.isSafeInteger(id) || id <= 0 || used.has(id)) { while (used.has(next)) next++; id = next++; }
                used.add(id); c.id=id;
                let customerNumber = Number(c.customerNumber);
                if (!Number.isSafeInteger(customerNumber) || customerNumber <= 0 || usedCustomerNumbers.has(customerNumber)) {
                    while (usedCustomerNumbers.has(nextCustomerNumber)) nextCustomerNumber++;
                    customerNumber = nextCustomerNumber++;
                }
                usedCustomerNumbers.add(customerNumber);
                c.customerNumber = customerNumber;
                c.budgetMin = parseNumericField(c.budgetMin);
                c.budgetMax = parseNumericField(c.budgetMax);
                c.areaMin = parseNumericField(c.areaMin);
                c.areaMax = parseNumericField(c.areaMax);
                c.rooms = parseIntegerField(c.rooms);
                if (c.rooms != null && (c.rooms < 0 || c.rooms > 100)) c.rooms = null;
                c.name=c.name.trim(); c.phone=c.phone?String(c.phone).slice(0,50):''; c.note=c.note?String(c.note).slice(0,2000):''; c.callDate=normalizeJalaliDate(c.callDate||'')||''; c.callTime=/^([01]\\d|2[0-3]):[0-5]\\d$/.test(toEnglishDigits(c.callTime||''))?toEnglishDigits(c.callTime):'10:00'; c.callNote=c.callNote?String(c.callNote).slice(0,500):''; c.callDone=!!c.callDone;
                // مشتری‌های نسخه قدیمی بودجه را به «میلیون تومان» ذخیره می‌کردند؛ یک‌بار به تومان تبدیل کن.
                if (c.budgetUnit !== 'toman') {
                    if (c.budgetMin != null && c.budgetMin < 100000000) c.budgetMin *= 1000000;
                    if (c.budgetMax != null && c.budgetMax < 100000000) c.budgetMax *= 1000000;
                    c.budgetUnit = 'toman';
                }
                if (c.budgetMin != null && c.budgetMax != null && c.budgetMin > c.budgetMax) [c.budgetMin, c.budgetMax] = [c.budgetMax, c.budgetMin];
                if (c.areaMin != null && c.areaMax != null && c.areaMin > c.areaMax) [c.areaMin, c.areaMax] = [c.areaMax, c.areaMin];
                return c;
            });
        }

        // بارگذاری اولیه از ShirangiRuntimeStorage (مرورگر) — در Electron بعداً از فایل لود می‌شود
        if (!isElectron) {
            try {
                const saved = ShirangiRuntimeStorage.getItem('shirangi_properties');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (Array.isArray(parsed)) {
                        properties = parsed;
                    }
                }
            } catch (e) {}
        }
        normalizePropertiesList(properties);

        async function saveProperties() {
            if (isElectron) {
                try {
                    const result = await window.electronAPI.writeJson('properties.json', properties);
                    if (!result?.ok) throw new Error(result?.error || 'SAVE_PROPERTIES_FAILED');
                    return { ok: true };
                } catch (e) {
                    console.error('saveProperties', e);
                    alert('ذخیره اطلاعات روی هارد ناموفق بود. تغییرات ثبت نشد.');
                    return { ok: false, error: String(e.message || e) };
                }
            }
            try {
                ShirangiRuntimeStorage.setItem('shirangi_properties', JSON.stringify(properties));
                return { ok: true };
            } catch (e) {
                console.error('ShirangiRuntimeStorage full?', e);
                alert('فضای مرورگر پر شده. از نسخه دسکتاپ (Electron) استفاده کنید یا بکاپ بگیرید.');
                return { ok: false, error: 'LOCAL_STORAGE_FULL' };
            }
        }

        // ========== مشاوران ==========
        const DEFAULT_AGENTS = [
            { id: 1, name: 'مهندس شیرنگی', phone: '09999926525' },
            { id: 2, name: 'علی محمدی', phone: '' },
            { id: 3, name: 'سارا احمدی', phone: '' }
        ];
        let agents = DEFAULT_AGENTS.slice();
        if (!isElectron) {
            try {
                const sa = ShirangiRuntimeStorage.getItem('shirangi_agents');
                if (sa) {
                    const parsed = JSON.parse(sa);
                    if (Array.isArray(parsed)) agents = normalizeAgentsList(parsed);
                }
            } catch (e) {}
        }

        agents = normalizeAgentsList(agents);

        async function saveAgents() {
            if (isElectron) {
                try {
                    const result = await window.electronAPI.writeJson('agents.json', agents);
                    if (!result?.ok) throw new Error(result?.error || 'SAVE_AGENTS_FAILED');
                    return { ok: true };
                } catch (e) { console.error('saveAgents', e); return { ok: false, error: String(e.message || e) }; }
            }
            try { ShirangiRuntimeStorage.setItem('shirangi_agents', JSON.stringify(agents)); return { ok: true }; }
            catch (e) { console.error('saveAgents', e); return { ok: false, error: 'LOCAL_STORAGE_FULL' }; }
        }

        // ========== مشتریان (دفترچه + تطبیق) ==========
        let customers = [];
        window.shirangiProGetCustomers = () => customers;
        try {
            const sc = isElectron ? null : ShirangiRuntimeStorage.getItem('shirangi_customers');
            if (sc) {
                const parsed = JSON.parse(sc);
                if (Array.isArray(parsed)) customers = parsed;
            }
        } catch (e) {}

        customers = normalizeCustomersList(customers);

        async function saveCustomers() {
            if (isElectron && window.electronAPI?.writeJson) {
                try {
                    const result = await window.electronAPI.writeJson('customers.json', customers);
                    if (!result?.ok) throw new Error(result?.error || 'SAVE_CUSTOMERS_FAILED');
                    return { ok: true };
                } catch (e) { console.error('saveCustomers', e); return { ok: false, error: String(e.message || e) }; }
            }
            try { ShirangiRuntimeStorage.setItem('shirangi_customers', JSON.stringify(customers)); return { ok: true }; }
            catch (e) { console.error('saveCustomers', e); return { ok: false, error: 'LOCAL_STORAGE_FULL' }; }
        }



        // ========== مالکین و برنامه‌های روتین دستیار ==========
        let assistantOwners = [];
        let assistantRoutines = [];
        let routinePeriod = 'daily';
        const ROUTINE_PERIODS = ['daily','weekly','monthly'];
        const ROUTINE_TITLES = { daily:'کارهای روزانه', weekly:'کارهای هفتگی', monthly:'کارهای ماهانه' };

        function makeStableId(prefix, collection) {
            const used = new Set((Array.isArray(collection) ? collection : []).map(x => Number(x?.id)).filter(Number.isSafeInteger));
            let id = Date.now();
            while (used.has(id)) id++;
            return id;
        }

        function normalizeOwnersList(list) {
            if (!Array.isArray(list)) return [];
            const usedIds = new Set();
            const usedNumbers = new Set();
            let nextId = 1, nextNumber = 1;
            const valid = list.filter(o => o && typeof o === 'object' && !Array.isArray(o) && typeof o.name === 'string' && o.name.trim());
            return valid.map(o => {
                let id = Number(o.id);
                if (!Number.isSafeInteger(id) || id <= 0 || usedIds.has(id)) {
                    while (usedIds.has(nextId)) nextId++;
                    id = nextId++;
                }
                usedIds.add(id);
                let ownerNumber = Number(o.ownerNumber);
                if (!Number.isSafeInteger(ownerNumber) || ownerNumber <= 0 || usedNumbers.has(ownerNumber)) {
                    while (usedNumbers.has(nextNumber)) nextNumber++;
                    ownerNumber = nextNumber++;
                }
                usedNumbers.add(ownerNumber);
                o.id = id;
                o.ownerNumber = ownerNumber;
                o.name = o.name.trim().slice(0, 200);
                o.phone = o.phone ? String(o.phone).trim().slice(0, 50) : '';
                o.note = o.note ? String(o.note).trim().slice(0, 1000) : '';
                o.callDate = normalizeJalaliDate(o.callDate || '') || '';
                o.callTime = o.callTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(toEnglishDigits(String(o.callTime))) ? toEnglishDigits(String(o.callTime)) : '';
                o.callNote = o.callNote ? String(o.callNote).trim().slice(0, 500) : '';
                o.callDone = !!o.callDone;
                o.createdAt = typeof o.createdAt === 'string' ? o.createdAt : new Date().toISOString();
                return o;
            });
        }

        function normalizeRoutinesList(list) {
            if (!Array.isArray(list)) return [];
            const used = new Set(); let next = 1;
            return list.filter(t => t && typeof t === 'object' && !Array.isArray(t) && ROUTINE_PERIODS.includes(t.period) && typeof t.title === 'string' && t.title.trim())
                .slice(0, 10000).map(t => {
                    let id = Number(t.id);
                    if (!Number.isSafeInteger(id) || id <= 0 || used.has(id)) { while (used.has(next)) next++; id = next++; }
                    used.add(id);
                    t.id = id;
                    t.title = t.title.trim().slice(0, 200);
                    t.done = !!t.done;
                    // lastCompletedPeriod باعث می‌شود تیک هر دوره مستقل باشد و در شروع دوره بعدی خودکار باز شود.
                    t.lastCompletedPeriod = typeof t.lastCompletedPeriod === 'string' ? t.lastCompletedPeriod : '';
                    return t;
                });
        }

        function currentRoutinePeriodKey(period) {
            const d = new Date();
            const j = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
            if (period === 'daily') return `${j[0]}/${String(j[1]).padStart(2,'0')}/${String(j[2]).padStart(2,'0')}`;
            if (period === 'monthly') return `${j[0]}/${String(j[1]).padStart(2,'0')}`;
            // شنبه شروع هفته است؛ با تبدیل روز میلادی به شاخص شنبه=0، کلید هفته پایدار می‌شود.
            const dayFromSunday = d.getDay();
            const saturdayBased = (dayFromSunday + 1) % 7;
            const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - saturdayBased);
            const sj = gregorianToJalali(start.getFullYear(), start.getMonth() + 1, start.getDate());
            return `${sj[0]}/${String(sj[1]).padStart(2,'0')}/${String(sj[2]).padStart(2,'0')}`;
        }

        function syncRoutineCompletionState() {
            let changed = false;
            for (const t of assistantRoutines) {
                const key = currentRoutinePeriodKey(t.period);
                if (t.done && t.lastCompletedPeriod !== key) { t.done = false; changed = true; }
            }
            return changed;
        }

        // ========== سازندگان (دفترچه + تطبیق) ==========
        let builders = [];
        let editingBuilderId = null;
        const BUILDERS_KEY = 'shirangi_builders_v2';

        function normalizeBuildersList(list) {
            if (!Array.isArray(list)) return [];
            const used = new Set(); let next = 1;
            return list.slice(0, 5000).map((b, i) => {
                let n = Number(b?.builderNumber);
                if (!Number.isSafeInteger(n) || n <= 0 || used.has(n)) { while (used.has(next)) next++; n = next++; }
                used.add(n);
                return {
                    id: String(b?.id || ('builder_' + Date.now() + '_' + i)),
                    builderNumber: n,
                    name: String(b?.name || '').slice(0, 200),
                    phone: String(b?.phone || '').slice(0, 80),
                    district: String(b?.district || '').slice(0, 120),
                    budget: String(b?.budget || '').slice(0, 80),
                    callDate: String(b?.callDate || '').slice(0, 30),
                    callTime: String(b?.callTime || '').slice(0, 10),
                    callDone: !!b?.callDone,
                    targets: Array.isArray(b?.targets) ? b.targets.filter(v => v === 'کلنگی' || v === 'مشارکت').slice(0, 2) : [],
                    note: String(b?.note || '').slice(0, 2000),
                    createdAt: String(b?.createdAt || '').slice(0, 40)
                };
            });
        }

        async function loadBuilders() {
            try {
                if (isElectron && window.electronAPI?.readJson) {
                    const x = await window.electronAPI.readJson('builders.json');
                    if (Array.isArray(x)) { builders = normalizeBuildersList(x); return; }
                }
                const raw = ShirangiRuntimeStorage.getItem(BUILDERS_KEY) ?? ShirangiRuntimeStorage.getItem('shirangi_builders_standalone_v1') ?? '[]';
                builders = normalizeBuildersList(JSON.parse(raw));
            } catch (e) { builders = []; }
        }

        async function saveBuilders() {
            builders = normalizeBuildersList(builders);
            try {
                if (isElectron && window.electronAPI?.writeJson) {
                    const r = await window.electronAPI.writeJson('builders.json', builders);
                    if (!r?.ok) throw new Error(r?.error || 'SAVE_BUILDERS_FAILED');
                    return { ok: true };
                }
                ShirangiRuntimeStorage.setItem(BUILDERS_KEY, JSON.stringify(builders));
                return { ok: true };
            } catch (e) { console.error('saveBuilders', e); return { ok: false, error: String(e.message || e) }; }
        }

        function resetBuilderForm() {
            ['builder-name','builder-phone','builder-call-date','builder-call-time','builder-budget','builder-district','builder-note'].forEach(id => { const e=document.getElementById(id); if(e)e.value=''; });
            const a=document.getElementById('builder-target-demo'), b=document.getElementById('builder-target-part'); if(a)a.checked=true; if(b)b.checked=true;
            editingBuilderId = null;
            const t=document.getElementById('builder-form-title'), btn=document.getElementById('builder-save-btn'), cancel=document.getElementById('builder-cancel-edit-btn');
            if(t)t.innerHTML='<i class="fas fa-building-circle-check ml-2"></i> ثبت سازنده جدید';
            if(btn)btn.innerHTML='<i class="fas fa-save ml-2"></i> ذخیره سازنده';
            if(cancel)cancel.classList.add('hidden');
        }

        function editBuilder(id) {
            if (isElectron && !isAdminUnlocked()) { requireAdmin(() => editBuilder(id)); return; }
            const b=builders.find(x=>String(x.id)===String(id)); if(!b)return;
            editingBuilderId=b.id;
            const vals={'builder-name':b.name,'builder-phone':b.phone,'builder-call-date':b.callDate,'builder-call-time':b.callTime,'builder-budget':b.budget,'builder-district':b.district,'builder-note':b.note};
            Object.entries(vals).forEach(([id,v])=>{const e=document.getElementById(id);if(e)e.value=v||''});
            document.getElementById('builder-target-demo').checked=(b.targets||[]).includes('کلنگی');
            document.getElementById('builder-target-part').checked=(b.targets||[]).includes('مشارکت');
            document.getElementById('builder-form-title').innerHTML='<i class="fas fa-building-circle-check ml-2"></i> ویرایش سازنده';
            document.getElementById('builder-save-btn').innerHTML='<i class="fas fa-check ml-2"></i> ذخیره تغییرات';
            document.getElementById('builder-cancel-edit-btn').classList.remove('hidden');
            document.getElementById('screen-builders')?.scrollTo({top:0,behavior:'smooth'});
        }

        function addBuilder() {
            if (isElectron && !isAdminUnlocked()) { requireAdmin(() => addBuilder()); return; }
            const name=(document.getElementById('builder-name')?.value||'').trim();
            if(!name){alert('نام سازنده یا شرکت را وارد کنید');return;}
            const targets=[];
            if(document.getElementById('builder-target-demo')?.checked)targets.push('کلنگی');
            if(document.getElementById('builder-target-part')?.checked)targets.push('مشارکت');
            if(!targets.length){alert('حداقل یکی از خرید کلنگی یا مشارکت را انتخاب کنید');return;}
            const data={
                id: editingBuilderId || ('builder_'+crypto.randomUUID()),
                builderNumber: editingBuilderId ? (builders.find(x=>String(x.id)===String(editingBuilderId))?.builderNumber || 1) : (builders.length ? Math.max(...builders.map(x=>Number(x.builderNumber)||0))+1 : 1),
                name, phone:(document.getElementById('builder-phone')?.value||'').trim(),
                callDate:normalizeJalaliDate(document.getElementById('builder-call-date')?.value||'')||'',
                callTime:toEnglishDigits(document.getElementById('builder-call-time')?.value||''),
                budget:(document.getElementById('builder-budget')?.value||'').trim(),
                district:(document.getElementById('builder-district')?.value||'').trim(),
                targets, note:(document.getElementById('builder-note')?.value||'').trim(), callDone:false,
                createdAt: editingBuilderId ? (builders.find(x=>String(x.id)===String(editingBuilderId))?.createdAt || new Date().toISOString()) : new Date().toISOString()
            };
            if(editingBuilderId){const i=builders.findIndex(x=>String(x.id)===String(editingBuilderId));if(i<0){resetBuilderForm();return;}data.callDone=builders[i].callDone||false;builders[i]=data;}else builders.unshift(data);
            saveBuilders().then(r=>{if(!r?.ok){alert('ذخیره سازنده انجام نشد؛ فضای ذخیره‌سازی را بررسی کنید');return;}resetBuilderForm();renderBuilders();});
        }

        function deleteBuilder(id) {
            if (isElectron && !isAdminUnlocked()) { requireAdmin(() => deleteBuilder(id)); return; }
            if(!confirm('حذف این سازنده؟'))return;
            const old=builders; builders=builders.filter(b=>String(b.id)!==String(id));
            saveBuilders().then(r=>{if(!r?.ok){builders=old;return;}renderBuilders();});
        }

        function toggleBuilderReminder(id) {
            if (isElectron && !isAdminUnlocked()) { requireAdmin(() => toggleBuilderReminder(id)); return; }
            const b=builders.find(x=>String(x.id)===String(id)); if(!b)return; const old=b.callDone; b.callDone=!old;
            saveBuilders().then(r=>{if(!r?.ok)b.callDone=old;renderBuilders();});
        }

        function builderProperties() {
            try { if(window.ShirangiDealEngineData&&typeof window.ShirangiDealEngineData.properties==='function') return window.ShirangiDealEngineData.properties()||[]; } catch(e){}
            return Array.isArray(window.properties)?window.properties:[];
        }
        function builderTargetProperties() {
            return builderProperties().filter(p=>/کلنگ|مشارکت|تخریب|زمین/.test(String(p?.deal_type||p?.type||p?.category||p?.title||p?.description||'')));
        }

        function renderBuilders() {
            const list=document.getElementById('builders-list'), count=document.getElementById('builder-count'), remCount=document.getElementById('builder-reminder-count'), propCount=document.getElementById('builder-property-count');
            if(count)count.textContent=builders.length.toLocaleString('fa-IR')+' نفر';
            if(remCount)remCount.textContent=builders.filter(b=>b.callDate&&!b.callDone).length.toLocaleString('fa-IR')+' تماس';
            const ps=builderTargetProperties(); if(propCount)propCount.textContent=ps.length.toLocaleString('fa-IR')+' فایل';
            if(list) list.innerHTML=builders.length?builders.map(b=>{
                const targets=(b.targets||[]).join(' + ')||'—';
                return `<div class="bg-slate-900/80 rounded-xl p-4 border border-slate-700 flex flex-col md:flex-row md:items-center gap-3">
                    <div class="w-12 h-12 shrink-0 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-black text-lg shadow-lg" title="شماره سازنده">${Number(b.builderNumber)||'—'}</div>
                    <div class="flex-1"><p class="font-bold text-white">${escapeHtml(b.name)}${b.phone?' <span class="text-slate-400 text-sm font-normal">· '+escapeHtml(b.phone)+'</span>':''}</p>
                    <p class="text-sm text-slate-400 mt-1">${escapeHtml(targets)} · بودجه: ${escapeHtml(b.budget||'—')} · ${escapeHtml(b.district||'همه مناطق')}</p>
                    ${b.note?'<p class="text-xs text-slate-500 mt-1">'+escapeHtml(b.note)+'</p>':''}${b.callDate&&!b.callDone?'<p class="text-xs text-amber-300 mt-1"><i class="fas fa-calendar-check ml-1"></i> تماس: '+escapeHtml(toPersianNum(b.callDate))+' · '+escapeHtml(toPersianNum(b.callTime||''))+'</p>':''}</div>
                    <div class="flex gap-2 shrink-0 flex-wrap"><button type="button" onclick="toggleBuilderReminder(decodeJsArg('${safeJsArg(b.id)}'))" class="touch-btn px-3 py-2 bg-amber-600 rounded-xl text-sm font-bold"><i class="fas fa-calendar-check ml-1"></i>${b.callDone?'بازکردن پیگیری':'تماس'}</button><button type="button" onclick="editBuilder(decodeJsArg('${safeJsArg(b.id)}'))" class="touch-btn px-3 py-2 bg-blue-600 rounded-xl text-sm font-bold"><i class="fas fa-pen ml-1"></i>ویرایش</button><button type="button" onclick="deleteBuilder(decodeJsArg('${safeJsArg(b.id)}'))" class="touch-btn px-3 py-2 bg-slate-700 rounded-xl text-sm"><i class="fas fa-trash"></i></button></div></div>`;
            }).join(''):'<p class="text-slate-500 text-center py-6">هنوز سازنده‌ای ثبت نشده. فرم بالا را پر کنید.</p>';
            const rem=document.getElementById('builder-reminders-list');
            const pending=builders.filter(b=>b.callDate&&!b.callDone).slice().sort((a,b)=>String(a.callDate+' '+a.callTime).localeCompare(String(b.callDate+' '+b.callTime)));
            if(rem)rem.innerHTML=pending.length?pending.map(b=>`<div class="bg-slate-900/70 rounded-xl p-3 border border-slate-700 flex items-center justify-between gap-3"><div><b>${escapeHtml(b.name)}</b><div class="text-xs text-slate-400 mt-1">${escapeHtml(toPersianNum(b.callDate))} · ${escapeHtml(toPersianNum(b.callTime||''))} · ${escapeHtml(b.phone||'بدون شماره')}</div></div><button type="button" onclick="toggleBuilderReminder(decodeJsArg('${safeJsArg(b.id)}'))" class="touch-btn px-3 py-2 bg-amber-600 rounded-xl text-sm font-bold">انجام شد</button></div>`).join(''):'<p class="text-slate-500 text-center py-5">پیگیری بازی ثبت نشده است.</p>';
            const pl=document.getElementById('builder-properties-list');
            if(pl)pl.innerHTML=ps.slice(0,20).map(p=>`<div class="bg-slate-900/70 rounded-xl p-3 border border-slate-700"><b>${escapeHtml(p.title||p.address||p.name||'ملک')}</b><div class="text-xs text-slate-400 mt-1">${escapeHtml(p.deal_type||p.type||p.category||'کلنگی / مشارکت')}</div></div>`).join('')||'<p class="text-slate-500 text-center py-5">فایل کلنگی یا مشارکتی ثبت‌شده پیدا نشد.</p>';
        }

        function openBuilderAssistant() {
            if (isElectron && !isAdminUnlocked()) { requireAdmin(() => openBuilderAssistant()); return true; }
            goTo('builders');
            return true;
        }

        function readStoredJsonArray(key) {
            try {
                const value = JSON.parse(ShirangiRuntimeStorage.getItem(key) || '[]');
                return Array.isArray(value) ? value : [];
            } catch (_) {
                return [];
            }
        }

        function loadAssistantPlannerData() {
            if (isElectron) return;
            // Parse each store independently: corruption in one collection must not erase the other.
            assistantOwners = normalizeOwnersList(readStoredJsonArray('shirangi_owners'));
            assistantRoutines = normalizeRoutinesList(readStoredJsonArray('shirangi_routines'));
            syncRoutineCompletionState();
        }
        loadAssistantPlannerData();

        async function saveAssistantPlannerData() {
            assistantOwners = normalizeOwnersList(assistantOwners);
            assistantRoutines = normalizeRoutinesList(assistantRoutines);
            try {
                if (isElectron && window.electronAPI?.writeJson) {
                    const a = await window.electronAPI.writeJson('owners.json', assistantOwners);
                    if (!a?.ok) throw new Error(a.error || 'SAVE_OWNERS_FAILED');
                    const b = await window.electronAPI.writeJson('routines.json', assistantRoutines);
                    if (!b?.ok) throw new Error(b.error || 'SAVE_ROUTINES_FAILED');
                    return { ok:true };
                }
                ShirangiRuntimeStorage.setItem('shirangi_owners', JSON.stringify(assistantOwners));
                ShirangiRuntimeStorage.setItem('shirangi_routines', JSON.stringify(assistantRoutines));
                return { ok:true };
            } catch (e) {
                console.error('saveAssistantPlannerData', e);
                alert('ذخیره مالکین و برنامه‌های روتین انجام نشد. تغییرات ثبت نشد.');
                return { ok:false, error:String(e.message || e) };
            }
        }

        function nextOwnerNumber() {
            const nums = assistantOwners.map(o => Number(o.ownerNumber)).filter(Number.isSafeInteger);
            return nums.length ? Math.max(...nums, 0) + 1 : 1;
        }

        function addAssistantOwner() {
            const nameEl = document.getElementById('owner-name');
            const phoneEl = document.getElementById('owner-phone');
            const dateEl = document.getElementById('owner-call-date');
            const timeEl = document.getElementById('owner-call-time');
            const callNoteEl = document.getElementById('owner-call-note');
            const noteEl = document.getElementById('owner-note');
            const name = String(nameEl?.value || '').trim().slice(0,200);
            if (!name) { alert('نام مالک را وارد کنید.'); nameEl?.focus(); return; }
            const phone = String(phoneEl?.value || '').trim().slice(0,50);
            const rawDate = String(dateEl?.value || '').trim();
            const callDate = rawDate ? normalizeJalaliDate(rawDate) : '';
            if (rawDate && !callDate) { alert('تاریخ تماس شمسی نامعتبر است. نمونه: ۱۴۰۵/۰۶/۱۰'); dateEl?.focus(); return; }
            const callTime = normalizeTimeInput(timeEl?.value, '');
            if (timeEl?.value?.trim() && !callTime) { alert('ساعت تماس نامعتبر است.'); timeEl?.focus(); return; }
            const callNote = String(callNoteEl?.value || '').trim().slice(0,500);
            const note = String(noteEl?.value || '').trim().slice(0,1000);
            const owner = { id: makeStableId('owner', assistantOwners), ownerNumber: nextOwnerNumber(), name, phone, note, callDate, callTime, callNote, callDone:false, createdAt: new Date().toISOString() };
            assistantOwners.unshift(owner);
            saveAssistantPlannerData().then(r => {
                if (r.ok) {
                    [nameEl,phoneEl,dateEl,callNoteEl,noteEl].forEach(e => { if(e) e.value=''; });
                    if (timeEl) timeEl.value='';
                    renderAssistantPlanner();
                } else assistantOwners = assistantOwners.filter(o => o.id !== owner.id);
            });
        }

        function setOwnerReminder(id) {
            const owner = assistantOwners.find(x => x.id === Number(id));
            if (!owner) return;
            const date = prompt('تاریخ تماس مالک به شمسی (مثلاً ۱۴۰۵۰۶۱۰):', owner.callDate || '');
            if (date === null) return;
            const normalized = normalizeJalaliDate(date);
            if (!normalized) { alert('تاریخ شمسی نامعتبر است.'); return; }
            const time = prompt('ساعت تماس (مثلاً ۱۰۳۰):', owner.callTime || '');
            if (time === null) return;
            const normalizedTime = normalizeTimeInput(time.trim());
            if (!normalizedTime) { alert('ساعت نامعتبر است.'); return; }
            const note = prompt('یادداشت تماس:', owner.callNote || '');
            if (note === null) return;
            owner.callDate = normalized;
            owner.callTime = normalizedTime;
            owner.callNote = note.trim().slice(0,500);
            owner.callDone = false;
            saveAssistantPlannerData().then(r => { if (r.ok) renderAssistantPlanner(); });
        }

        function completeOwnerReminder(id) {
            const owner = assistantOwners.find(x => x.id === Number(id));
            if (!owner) return;
            owner.callDone = true;
            saveAssistantPlannerData().then(r => { if (r.ok) renderAssistantPlanner(); });
        }

        function deleteAssistantOwner(id) {
            const n = Number(id); if (!Number.isSafeInteger(n)) return;
            const owner = assistantOwners.find(o => o.id === n);
            if (!owner || !confirm(`مالک «${owner.name}» حذف شود؟`)) return;
            const previous = assistantOwners;
            assistantOwners = assistantOwners.filter(o => o.id !== n);
            saveAssistantPlannerData().then(r => { if(r.ok) renderAssistantPlanner(); else assistantOwners = previous; });
        }

        function addRoutineTask() {
            const defaultTitle = routinePeriod === 'daily' ? 'پیگیری فایل‌ها و تماس‌ها' : routinePeriod === 'weekly' ? 'مرور فایل‌های مالکین' : 'گزارش ماهانه و پیگیری مالکین';
            const title = prompt('عنوان کار روتین را وارد کنید:', defaultTitle);
            if (title === null || !title.trim()) return;
            const task = { id: makeStableId('routine', assistantRoutines), period: routinePeriod, title: title.trim().slice(0,200), done:false, lastCompletedPeriod:'' };
            assistantRoutines.push(task);
            saveAssistantPlannerData().then(r => { if(r.ok) renderAssistantPlanner(); else assistantRoutines = assistantRoutines.filter(x => x.id !== task.id); });
        }

        function toggleRoutineTask(id) {
            const t = assistantRoutines.find(x => x.id === Number(id));
            if (!t) return;
            const oldDone = t.done, oldKey = t.lastCompletedPeriod;
            t.done = !t.done;
            t.lastCompletedPeriod = t.done ? currentRoutinePeriodKey(t.period) : '';
            saveAssistantPlannerData().then(r => { if(r.ok) renderAssistantPlanner(); else { t.done=oldDone; t.lastCompletedPeriod=oldKey; } });
        }

        function deleteRoutineTask(id) {
            const n = Number(id); if (!Number.isSafeInteger(n)) return;
            const old = assistantRoutines;
            assistantRoutines = assistantRoutines.filter(x => x.id !== n);
            saveAssistantPlannerData().then(r => { if(r.ok) renderAssistantPlanner(); else assistantRoutines = old; });
        }

        function setRoutinePeriod(period) {
            routinePeriod = ROUTINE_PERIODS.includes(period) ? period : 'daily';
            renderAssistantPlanner();
        }

        function renderAssistantPlanner() {
            if (typeof renderCRM === 'function') renderCRM();
            if (syncRoutineCompletionState()) saveAssistantPlannerData();
            renderCallReminders('assistant-call-reminders-list', 'assistant-call-reminder-count');
            updateAssistantStats();
            const ownerList = document.getElementById('assistant-owners-list');
            const ownerCount = document.getElementById('assistant-owner-count');
            if (ownerCount) ownerCount.textContent = assistantOwners.length.toLocaleString('fa-IR') + ' مالک';
            if (ownerList) ownerList.innerHTML = assistantOwners.length ? assistantOwners.map(o => {
                const reminder = o.callDate && !o.callDone;
                const status = reminderStatus(o);
                const statusText = status ? '<span class="px-2 py-1 rounded-lg bg-amber-500/15 text-amber-300 text-[11px]">' + status + '</span>' : '';
                return `
                <div class="bg-slate-800 rounded-xl border border-slate-700 p-3 space-y-2">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0 font-black">${Number(o.ownerNumber) || '—'}</div>
                        <div class="flex-1 min-w-0"><div class="flex flex-wrap items-center gap-2"><p class="font-bold truncate">${escapeHtml(o.name)}</p>${statusText}</div><p class="text-xs text-slate-400 mt-1">${escapeHtml(o.phone || 'بدون شماره')}${o.note ? ' · ' + escapeHtml(o.note) : ''}</p></div>
                        ${o.phone ? '<a href="tel:' + encodeURIComponent(o.phone).replace(/'/g,'%27') + '" class="px-3 py-2 bg-emerald-600 rounded-lg text-xs font-bold"><i class="fas fa-phone ml-1"></i>تماس</a>' : ''}
                        <button type="button" onclick="deleteAssistantOwner(Number(decodeJsArg(\'${safeJsArg(o.id)}\')))" class="px-3 py-2 bg-rose-600 rounded-lg text-xs font-bold"><i class="fas fa-trash"></i></button>
                    </div>
                    <div class="flex flex-wrap items-center gap-2 text-xs">
                        ${reminder ? '<span class="text-amber-300"><i class="fas fa-calendar-check ml-1"></i>' + escapeHtml(toPersianNum(o.callDate)) + ' · ' + escapeHtml(toPersianNum(o.callTime || '')) + '</span>' : '<span class="text-slate-500">بدون برنامه تماس</span>'}
                        ${o.callNote ? '<span class="text-slate-400">· ' + escapeHtml(o.callNote) + '</span>' : ''}
                    </div>
                    <div class="flex flex-wrap gap-2 pt-2 border-t border-slate-700/70">
                        <button type="button" onclick="setOwnerReminder(Number(decodeJsArg(\'${safeJsArg(o.id)}\')))" class="touch-btn px-3 py-2 bg-amber-600 rounded-lg text-xs font-bold"><i class="fas fa-calendar-plus ml-1"></i>${reminder ? 'ویرایش برنامه' : 'برنامه تماس'}</button>
                        ${reminder ? `<button type="button" onclick="completeOwnerReminder(Number(decodeJsArg('${safeJsArg(o.id)}')))" class="touch-btn px-3 py-2 bg-indigo-600 rounded-lg text-xs font-bold">انجام شد</button>` : ''}
                    </div>
                </div>`;
            }).join('') : '<p class="text-slate-500 text-center py-5 text-sm">هنوز مالکی ثبت نشده است.</p>';

            const title = document.getElementById('routine-period-title');
            if (title) title.textContent = ROUTINE_TITLES[routinePeriod];
            ROUTINE_PERIODS.forEach(p => { const b=document.getElementById('routine-tab-'+p); if (b) b.className='touch-btn px-4 py-2 rounded-xl text-sm font-bold '+(p===routinePeriod?'bg-cyan-600':'bg-slate-700'); });
            const list=document.getElementById('assistant-routine-list');
            if (list) {
                const items=assistantRoutines.filter(t=>t.period===routinePeriod);
                list.innerHTML=items.length ? items.map(t => `
                    <div class="flex items-center gap-3 bg-slate-800 rounded-xl border border-slate-700 p-3">
                        <button type="button" onclick="toggleRoutineTask(Number(decodeJsArg('${safeJsArg(t.id)}')))" class="w-9 h-9 rounded-lg ${t.done?'bg-emerald-600':'bg-slate-700'} shrink-0" aria-label="${t.done?'بازکردن کار':'انجام شد'}"><i class="fas ${t.done?'fa-check':'fa-circle'}"></i></button>
                        <span class="flex-1 ${t.done?'line-through text-slate-500':'text-slate-200'}">${escapeHtml(t.title)}</span>
                        <button type="button" onclick="deleteRoutineTask(Number(decodeJsArg('${safeJsArg(t.id)}')))" class="px-3 py-2 bg-rose-600/80 rounded-lg text-xs" aria-label="حذف"><i class="fas fa-trash"></i></button>
                    </div>`).join('') : '<p class="text-slate-500 text-center py-6 text-sm">برای این بازه کاری ثبت نشده است. «کار جدید» را بزنید.</p>';
            }
        }

        // ========== تقویم شمسی و یادآوری تماس ==========
        function jalaliToGregorian(jy, jm, jd) {
            jy = Number.parseInt(jy, 10);
            jm = Number.parseInt(jm, 10);
            jd = Number.parseInt(jd, 10);
            const jy0 = jy - 979;
            const jm0 = jm - 1;
            const jd0 = jd - 1;
            let jDayNo = 365 * jy0 + Math.floor(jy0 / 33) * 8 + Math.floor(((jy0 % 33) + 3) / 4);
            const jDays = [31,31,31,31,31,31,30,30,30,30,30,29];
            for (let i = 0; i < jm0; i++) jDayNo += jDays[i];
            jDayNo += jd0;
            let gDayNo = jDayNo + 79;
            let gy = 1600 + 400 * Math.floor(gDayNo / 146097);
            gDayNo %= 146097;
            let leap = true;
            if (gDayNo >= 36525) {
                gDayNo--;
                gy += 100 * Math.floor(gDayNo / 36524);
                gDayNo %= 36524;
                if (gDayNo >= 365) gDayNo++;
                else leap = false;
            }
            gy += 4 * Math.floor(gDayNo / 1461);
            gDayNo %= 1461;
            if (gDayNo >= 366) {
                leap = false;
                gDayNo--;
                gy += Math.floor(gDayNo / 365);
                gDayNo %= 365;
            }
            const gDays = [31, leap ? 29 : 28, 31,30,31,30,31,31,30,31,30,31];
            let gm = 0;
            let gd = gDayNo + 1;
            while (gm < 12 && gd > gDays[gm]) {
                gd -= gDays[gm];
                gm++;
            }
            return [gy, gm + 1, gd];
        }
        function gregorianToJalali(gy, gm, gd) {
            gy = Number.parseInt(gy, 10);
            gm = Number.parseInt(gm, 10);
            gd = Number.parseInt(gd, 10);
            const gdm = [0,31,59,90,120,151,181,212,243,273,304,334];
            let jy = gy <= 1600 ? 0 : 979;
            let gy0 = gy <= 1600 ? gy - 621 : gy - 1600;
            const gy2 = gm > 2 ? gy0 + 1 : gy0;
            let days = 365 * gy0 + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) +
                Math.floor((gy2 + 399) / 400) - 80 + gd + gdm[gm - 1];
            jy += 33 * Math.floor(days / 12053);
            days %= 12053;
            jy += 4 * Math.floor(days / 1461);
            days %= 1461;
            if (days > 365) {
                jy += Math.floor((days - 1) / 365);
                days = (days - 1) % 365;
            }
            const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
            const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
            return [jy, jm, jd];
        }
        function todayJalali() {
            const d = new Date();
            const j = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
            return j.map(n => String(n).padStart(2, '0')).join('/');
        }
        function normalizeJalaliDate(value) {
            // تاریخ شمسی: اعداد فارسی/عربی/لاتین و جداکننده‌های / - . پذیرفته می‌شوند.
            let raw = toEnglishDigits(value).replace(/[.\-\\]/g, '/').replace(/\s+/g, '').trim();
            // تاریخ را می‌توان فقط با عدد وارد کرد: ۱۴۰۵۰۶۱۰ یا 14050610
            if (/^\d{8}$/.test(raw)) raw = raw.slice(0,4) + '/' + raw.slice(4,6) + '/' + raw.slice(6,8);
            const m = raw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
            if (!m) return null;
            const jy=+m[1], jm=+m[2], jd=+m[3];
            if (jy < 1300 || jy > 1500 || jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
            if (jm > 6 && jd > 30) return null;
            const g = jalaliToGregorian(jy, jm, jd);
            const back = gregorianToJalali(g[0], g[1], g[2]);
            if (back[0] !== jy || back[1] !== jm || back[2] !== jd) return null;
            return [jy,jm,jd].map(n => String(n).padStart(2,'0')).join('/');
        }
        function reminderKey(c) {
            if (!c.callDate) return Infinity;
            const parts = c.callDate.split('/').map(Number);
            const g = jalaliToGregorian(parts[0], parts[1], parts[2]);
            const t = (c.callTime || '').split(':').map(Number);
            return new Date(g[0], g[1]-1, g[2], t[0]||0, t[1]||0).getTime();
        }
        function reminderStatus(c) {
            const diff = reminderKey(c) - Date.now();
            if (!Number.isFinite(diff)) return '';
            if (diff < 0) return 'معوق';
            if (diff < 24*60*60*1000) return 'امروز';
            return '';
        }
        function setCustomerReminder(id) {
            const c = customers.find(x => x.id === id);
            if (!c) return;
            const date = prompt('تاریخ تماس به شمسی (مثلاً ۱۴۰۵۰۶۱۰):', c.callDate || '');
            if (date === null) return;
            const normalized = normalizeJalaliDate(date);
            if (!normalized) { alert('تاریخ شمسی نامعتبر است. نمونه: ۱۴۰۵۰۶۱۰'); return; }
            const time = prompt('ساعت تماس (مثلاً ۱۰۳۰):', c.callTime || '');
            if (time === null) return;
            if (!normalizeTimeInput(time.trim())) { alert('ساعت نامعتبر است.'); return; }
            const note = prompt('یادداشت تماس:', c.callNote || '');
            if (note === null) return;
            const old = {callDate:c.callDate,callTime:c.callTime,callNote:c.callNote,callDone:c.callDone};
            c.callDate = normalized;
            c.callTime = normalizeTimeInput(time.trim());
            c.callNote = note.trim().slice(0,500);
            c.callDone = false;
            saveCustomers().then(result => { if (result?.ok) { renderCustomers(); renderAssistantCustomers(); } else { Object.assign(c, old); } });
        }
        function completeCustomerReminder(id) {
            const c = customers.find(x => x.id === id);
            if (!c) return;
            const oldDone = c.callDone;
            c.callDone = true;
            saveCustomers().then(result => { if (result?.ok) { renderCustomers(); renderAssistantCustomers(); } else { c.callDone = oldDone; } });
        }
        function renderCallReminders(targetListId, targetCountId) {
            const list = document.getElementById(targetListId);
            const count = document.getElementById(targetCountId);
            if (!list) return;
            const customerItems = customers.filter(c => c.callDate && !c.callDone).map(c => ({ ...c, contactType:'customer', contactNumber:Number(c.customerNumber)||0 }));
            const ownerItems = assistantOwners.filter(o => o.callDate && !o.callDone).map(o => ({ ...o, contactType:'owner', contactNumber:Number(o.ownerNumber)||0 }));
            const items = [...customerItems, ...ownerItems].sort((a,b) => reminderKey(a)-reminderKey(b));
            if (count) count.textContent = items.length.toLocaleString('fa-IR') + ' تماس';
            if (!items.length) {
                list.innerHTML = '<p class="text-slate-500 text-center py-5">فعلاً تماس برنامه‌ریزی‌شده‌ای ندارید.</p>';
                return;
            }
            list.innerHTML = items.map(c => {
                const status = reminderStatus(c);
                const statusText = status ? '<span class="px-2 py-1 rounded-lg bg-amber-500/15 text-amber-300 text-xs">' + status + '</span>' : '';
                const isOwner = c.contactType === 'owner';
                const typeText = isOwner ? 'مالک' : 'مشتری';
                const badgeClass = isOwner ? 'bg-emerald-600/20 text-emerald-300' : 'bg-violet-600/20 text-violet-300';
                const editCall = isOwner
                    ? "setOwnerReminder(Number(decodeJsArg('" + safeJsArg(c.id) + "')))"
                    : "setCustomerReminder(Number(decodeJsArg('" + safeJsArg(c.id) + "')))";
                const doneCall = isOwner
                    ? "completeOwnerReminder(Number(decodeJsArg('" + safeJsArg(c.id) + "')))"
                    : "completeCustomerReminder(Number(decodeJsArg('" + safeJsArg(c.id) + "')))";
                return '<div class="rounded-xl border border-slate-700 bg-slate-900/70 p-3 flex flex-col md:flex-row md:items-center gap-3">' +
                    '<div class="w-12 h-12 rounded-xl ' + badgeClass + ' flex items-center justify-center font-black">' + c.contactNumber + '</div>' +
                    '<div class="flex-1"><div class="flex flex-wrap items-center gap-2"><b>' + escapeHtml(c.name) + '</b><span class="px-2 py-1 rounded-lg bg-slate-700 text-slate-300 text-xs">' + typeText + '</span>' + statusText + '</div>' +
                    '<p class="text-sm text-slate-300 mt-1"><i class="fas fa-calendar ml-1"></i>' + escapeHtml(toPersianNum(c.callDate)) + ' · <i class="fas fa-clock ml-1"></i>' + escapeHtml(toPersianNum(c.callTime||'')) + '</p>' +
                    (c.callNote ? '<p class="text-xs text-slate-400 mt-1">' + escapeHtml(c.callNote) + '</p>' : '') + '</div>' +
                    (c.phone ? '<a href="tel:' + escapeHtml(c.phone) + '" class="touch-btn px-4 py-2 bg-emerald-600 rounded-xl text-sm font-bold"><i class="fas fa-phone ml-1"></i> تماس</a>' : '') +
                    '<button type="button" onclick="' + editCall + '" class="touch-btn px-3 py-2 bg-slate-700 rounded-xl text-sm">ویرایش</button>' +
                    '<button type="button" onclick="' + doneCall + '" class="touch-btn px-3 py-2 bg-indigo-600 rounded-xl text-sm">انجام شد</button></div>';
            }).join('');
        }

        let editingCustomerId = null;

        function resetCustomerForm() {
            ['cust-name','cust-phone','cust-call-date','cust-call-time','cust-call-note','cust-budget-min','cust-budget-max','cust-area-min','cust-area-max','cust-rooms','cust-district','cust-note'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            const type = document.getElementById('cust-type'); if (type) type.value = 'sale';
            const category = document.getElementById('cust-category'); if (category) category.value = 'residential';
        }

        function setCustomerEditMode(on, customer) {
            editingCustomerId = on ? Number(customer?.id) : null;
            const title = document.getElementById('customer-form-title');
            const btn = document.getElementById('customer-save-btn');
            const cancel = document.getElementById('customer-cancel-edit-btn');
            if (title) title.innerHTML = on ? '<i class="fas fa-user-pen ml-2"></i> ویرایش مشتری' : '<i class="fas fa-user-plus ml-2"></i> ثبت مشتری جدید';
            if (btn) btn.innerHTML = on ? '<i class="fas fa-check ml-2"></i> ذخیره تغییرات' : '<i class="fas fa-save ml-2"></i> ذخیره مشتری';
            if (cancel) cancel.classList.toggle('hidden', !on);
        }

        function editCustomer(id) {
            if (isElectron && !isAdminUnlocked()) { requireAdmin(() => editCustomer(id)); return; }
            const c = customers.find(x => Number(x.id) === Number(id));
            if (!c) return;
            const values = {
                'cust-name': c.name || '', 'cust-phone': c.phone || '',
                'cust-call-date': c.callDate || '', 'cust-call-time': c.callTime || '',
                'cust-call-note': c.callNote || '', 'cust-type': c.type || 'any',
                'cust-category': c.category || 'any', 'cust-budget-min': c.budgetMin ?? '',
                'cust-budget-max': c.budgetMax ?? '', 'cust-area-min': c.areaMin ?? '',
                'cust-area-max': c.areaMax ?? '', 'cust-rooms': c.rooms ?? '',
                'cust-district': c.district || '', 'cust-note': c.note || ''
            };
            Object.entries(values).forEach(([key,val]) => { const el=document.getElementById(key); if(el) el.value=key.includes('budget')||key.includes('area') ? formatNumericInputValue(val) : val; });
            setCustomerEditMode(true, c);
            document.getElementById('screen-customers')?.scrollTo({top:0, behavior:'smooth'});
            document.getElementById('cust-name')?.focus();
        }

        function cancelCustomerEdit() {
            editingCustomerId = null;
            resetCustomerForm();
            setCustomerEditMode(false);
        }

        function addCustomer() {
            if (isElectron && !isAdminUnlocked()) { requireAdmin(() => addCustomer()); return; }
            const name = (document.getElementById('cust-name')?.value || '').trim();
            if (!name) {
                alert('نام مشتری را وارد کنید');
                return;
            }
            const c = {
                id: crypto.randomUUID(),
                customerNumber: customers.length ? Math.max(...customers.map(c => Number(c.customerNumber) || 0)) + 1 : 1,
                name,
                phone: (document.getElementById('cust-phone')?.value || '').trim(),
                callDate: normalizeJalaliDate(document.getElementById('cust-call-date')?.value || '') || '',
                callTime: toEnglishDigits(document.getElementById('cust-call-time')?.value || ''),
                callNote: (document.getElementById('cust-call-note')?.value || '').trim(),
                callDone: false,
                type: document.getElementById('cust-type')?.value || 'any',
                category: document.getElementById('cust-category')?.value || 'any',
                budgetMin: parseAmountInput(document.getElementById('cust-budget-min')?.value) || null,
                budgetMax: parseAmountInput(document.getElementById('cust-budget-max')?.value) || null,
                budgetUnit: 'toman',
                areaMin: parseAmountInput(document.getElementById('cust-area-min')?.value) || null,
                areaMax: parseAmountInput(document.getElementById('cust-area-max')?.value) || null,
                rooms: parseIntegerField(document.getElementById('cust-rooms')?.value) || null,
                district: (document.getElementById('cust-district')?.value || '').trim(),
                note: (document.getElementById('cust-note')?.value || '').trim(),
                createdAt: new Date().toISOString()
            };
            if (editingCustomerId != null) {
                const index = customers.findIndex(x => Number(x.id) === Number(editingCustomerId));
                if (index < 0) { cancelCustomerEdit(); return; }
                const previous = { ...customers[index] };
                c.id = customers[index].id;
                c.customerNumber = customers[index].customerNumber;
                c.createdAt = customers[index].createdAt || c.createdAt;
                c.callDone = customers[index].callDone || false;
                customers[index] = c;
                saveCustomers().then(result => {
                    if (!result?.ok) { customers[index] = previous; return; }
                    cancelCustomerEdit();
                    renderCustomers();
                    renderAssistantCustomers();
                });
                return;
            }

            customers.unshift(c);
            saveCustomers().then(result => {
                if (!result?.ok) { customers = customers.filter(x => x !== c); return; }
                resetCustomerForm();
                renderCustomers();
                renderAssistantCustomers();
            });
        }

        function deleteCustomer(id) {
            if (isElectron && !isAdminUnlocked()) { requireAdmin(() => deleteCustomer(id)); return; }
            if (!confirm('حذف این مشتری؟')) return;
            const previous = customers;
            customers = customers.filter(c => c.id !== id);
            saveCustomers().then(result => {
                if (!result?.ok) { customers = previous; return; }
                renderCustomers();
                renderAssistantCustomers();
                document.getElementById('match-results-section')?.classList.add('hidden');
            });
        }

        function renderCustomers() {
            const list = document.getElementById('customers-list');
            const countEl = document.getElementById('cust-count');
            if (countEl) countEl.textContent = customers.length + ' نفر';
            const matchSelect = document.getElementById('match-customer-select');
            if (matchSelect) {
                const current = matchSelect.value;
                matchSelect.innerHTML = '<option value="">انتخاب مشتری برای پیشنهاد خودکار...</option>' +
                    customers.map(c => '<option value="' + escapeHtml(String(c.id)) + '">' + escapeHtml(c.name) + '</option>').join('');
                if (current && customers.some(c => String(c.id) === current)) matchSelect.value = current;
            }
            if (!customers.length) {
                list.innerHTML = '<p class="text-slate-500 text-center py-6">هنوز مشتری ثبت نشده. فرم بالا را پر کنید.</p>';
                return;
            }
            renderCallReminders('call-reminders-list', 'call-reminder-count');
            list.innerHTML = customers.map(c => {
                const budget = [c.budgetMin, c.budgetMax].filter(Boolean).map(n => (n).toLocaleString('fa-IR')).join(' تا ') || '—';
                const area = [c.areaMin, c.areaMax].filter(Boolean).join('–') || '—';
                return `<div class="bg-slate-900/80 rounded-xl p-4 border border-slate-700 flex flex-col md:flex-row md:items-center gap-3">
                    <div class="w-12 h-12 shrink-0 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-lg" title="شماره مشتری">
                        ${Number(c.customerNumber) || '—'}
                    </div>
                    <div class="w-11 h-11 shrink-0 rounded-xl bg-violet-600 flex items-center justify-center text-white font-black">${Number(c.customerNumber)||'—'}</div>
                    <div class="flex-1">
                        <p class="font-bold text-white">${escapeHtml(c.name)}${c.phone ? ' <span class="text-slate-400 text-sm font-normal">· ' + escapeHtml(c.phone) + '</span>' : ''}</p>
                        <p class="text-sm text-slate-400 mt-1">بودجه: ${budget} تومان · متراژ: ${area} · خواب: ${escapeHtml(c.rooms || '—')} · ${escapeHtml(c.district || 'منطقه آزاد')}</p>
                        ${c.note ? '<p class="text-xs text-slate-500 mt-1">' + escapeHtml(c.note) + '</p>' : ''}${c.callDate && !c.callDone ? '<p class="text-xs text-amber-300 mt-1"><i class="fas fa-calendar-check ml-1"></i> تماس: ' + escapeHtml(toPersianNum(c.callDate)) + ' · ' + escapeHtml(toPersianNum(c.callTime || '')) + '</p>' : ''}
                    </div>
                    <div class="flex gap-2 shrink-0">
                        <button type="button" onclick="setCustomerReminder(Number(decodeJsArg('${safeJsArg(c.id)}')))" class="touch-btn px-3 py-2 bg-amber-600 rounded-xl text-sm font-bold"><i class="fas fa-calendar-plus ml-1"></i> تماس</button>
                        <button type="button" onclick="matchCustomer(Number(decodeJsArg('${safeJsArg(c.id)}')))" class="touch-btn px-4 py-2 bg-emerald-600 rounded-xl text-sm font-bold"><i class="fas fa-magic ml-1"></i> پیشنهاد فایل‌ها</button>
                        <button type="button" onclick="editCustomer(Number(decodeJsArg('${safeJsArg(c.id)}')))" class="touch-btn px-3 py-2 bg-blue-600 rounded-xl text-sm font-bold"><i class="fas fa-pen ml-1"></i>ویرایش</button>
                        <button type="button" onclick="deleteCustomer(Number(decodeJsArg('${safeJsArg(c.id)}')))" class="touch-btn px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold"><i class="fas fa-trash ml-1"></i>حذف</button>
                    </div>
                </div>`;
            }).join('');
        }

        let assistantSelectedCustomerId = null;

        function assistantMatchCustomer(id) {
            if (typeof id === 'number') assistantSelectedCustomerId = id;
            const selectedId = assistantSelectedCustomerId;
            if (!selectedId) return;
            renderCustomerMatches(selectedId, {
                sectionId: 'assistant-match-results-section',
                labelId: 'assistant-match-for-label',
                boxId: 'assistant-match-results',
                includeArchivedId: 'assistant-include-archived'
            });
        }

        function assistantMatchReason(c, p) {
            const reasons = [];
            const pm = priceToToman(p.price);
            if (c.budgetMin != null || c.budgetMax != null) {
                const min = c.budgetMin != null ? c.budgetMin : 0, maxB = c.budgetMax != null ? c.budgetMax : 1e15;
                if (pm != null && pm >= min && pm <= maxB) reasons.push('بودجه منطبق');
                else if (pm != null) reasons.push('بودجه نزدیک');
            }
            const area = parseNumericField(p.area) || 0;
            if (area && (c.areaMin != null || c.areaMax != null)) {
                const amin = c.areaMin != null ? c.areaMin : 0, amax = c.areaMax != null ? c.areaMax : 1e6;
                reasons.push(area >= amin && area <= amax ? 'متراژ منطبق' : 'متراژ نزدیک');
            }
            if (c.district && ((p.district || '').includes(c.district) || (p.address || '').includes(c.district))) reasons.push('منطقه منطبق');
            const rooms = parseNumericField(p.rooms) || 0;
            if (c.rooms != null && rooms >= c.rooms) reasons.push('تعداد خواب مناسب');
            return reasons.length ? reasons.join(' · ') : 'تطبیق کلی با نیاز مشتری';
        }

        function transactionTypeMatches(customerType, propertyType) {
            const c = customerType || 'any', p = propertyType || 'sale';
            if (c === 'any') return true;
            if (c === 'sale') return p === 'sale';
            if (c === 'rent') return ['rent', 'mortgage', 'mortgage_rent'].includes(p);
            if (c === 'mortgage') return ['mortgage', 'mortgage_rent'].includes(p);
            if (c === 'mortgage_rent') return p === 'mortgage_rent';
            return p === c;
        }

        function renderCustomerMatches(id, target) {
            const c = customers.find(x => x.id === id);
            const section = document.getElementById(target.sectionId);
            const label = document.getElementById(target.labelId);
            const box = document.getElementById(target.boxId);
            if (!c || !section || !box) return;
            const includeArchived = document.getElementById(target.includeArchivedId)?.checked !== false;
            if (label) label.textContent = 'برای «' + c.name + '» — تطبیق بر اساس بودجه، متراژ، خواب، نوع و منطقه' + (includeArchived ? ' + فایل‌های بایگانی' : '');
            const candidateProperties = properties.filter(p => includeArchived || p.status !== 'archived');
            const scored = candidateProperties.map(p => {
                let score = 0, max = 0;
                max += 15;
                if (c.type === 'any' || !c.type) score += 15;
                else if (transactionTypeMatches(c.type, p.type)) score += 15;
                max += 15;
                const cat = String(p.category || p.usage || '').toLowerCase().trim();
                const categoryAliases = { residential: ['residential','مسکونی'], commercial: ['commercial','تجاری','مغازه','فروشگاه'], office: ['office','اداری','دفتر'], partnership: ['partnership','مشارکت'] };
                const aliases = categoryAliases[c.category] || [String(c.category || '').toLowerCase()];
                if (c.category === 'any' || !c.category) score += 15;
                else if (aliases.some(a => cat.includes(a)) || (c.category === 'residential' && !cat)) score += 15;
                max += 25;
                const pm = priceToToman(p.price);
                if (pm != null && (c.budgetMin != null || c.budgetMax != null)) {
                    const min = c.budgetMin != null ? c.budgetMin : 0, maxB = c.budgetMax != null ? c.budgetMax : 1e15;
                    if (pm >= min && pm <= maxB) score += 25;
                    else if (pm < min && pm >= min * 0.85) score += 12;
                    else if (pm > maxB && pm <= maxB * 1.15) score += 12;
                } else if (c.budgetMin == null && c.budgetMax == null) score += 15;
                max += 20;
                const area = parseNumericField(p.area) || 0;
                if (area && (c.areaMin != null || c.areaMax != null)) {
                    const amin = c.areaMin != null ? c.areaMin : 0, amax = c.areaMax != null ? c.areaMax : 1e6;
                    if (area >= amin && area <= amax) score += 20;
                    else if (area >= amin * 0.9 && area <= amax * 1.1) score += 10;
                } else if (c.areaMin == null && c.areaMax == null) score += 12;
                max += 15;
                const rooms = parseNumericField(p.rooms) || 0;
                if (c.rooms != null) {
                    if (rooms >= c.rooms) score += 15;
                    else if (rooms === c.rooms - 1) score += 7;
                } else score += 10;
                max += 10;
                if (c.district) {
                    const d = (p.district || '') + ' ' + (p.address || '');
                    if (d.includes(c.district) || c.district.includes((p.district || '').replace('منطقة ', ''))) score += 10;
                } else score += 6;
                return { p, score: max ? Math.round((score / max) * 100) : 0 };
            }).filter(x => x.score >= 35).sort((a,b) => b.score-a.score).slice(0,12);

            section.classList.remove('hidden');
            if (!scored.length) {
                box.innerHTML = '<div class="md:col-span-2 text-slate-500 text-center py-6"><i class="fas fa-search text-2xl mb-2"></i><p>ملکی با تطبیق قابل قبول برای این مشتری پیدا نشد.</p></div>';
                return;
            }
            box.innerHTML = scored.map(({p,score}) => {
                const color = score >= 75 ? 'text-emerald-400' : score >= 55 ? 'text-amber-300' : 'text-slate-300';
                return `<button type="button" onclick="openDetail(decodeJsArg('${safeJsArg(p.id)}')); goTo('detail')" class="w-full text-right bg-slate-900/80 hover:bg-slate-700/80 rounded-xl p-4 border border-slate-700 flex items-center gap-3">
                    <span class="text-2xl font-bold ${color} w-14 shrink-0">${score}٪</span>
                    <div class="flex-1 min-w-0">
                        <p class="font-bold truncate">${escapeHtml(p.title || p.address || 'بدون عنوان')}</p>
                        <p class="text-sm text-slate-400 mt-1">${escapeHtml(p.district || '')} · ${escapeHtml(p.area || '—')} متر · ${escapeHtml(p.price || '—')} · <span class="${p.status === 'archived' ? 'text-violet-300' : 'text-slate-400'}">${escapeHtml(statusLabel(p.status || 'available'))}</span></p>
                        <p class="text-xs text-slate-500 mt-1">${escapeHtml(assistantMatchReason(c, p))}</p>
                    </div>
                    <i class="fas fa-chevron-left text-slate-500"></i>
                </button>`;
            }).join('');
        }

        function clearAssistantCustomerSearch() {
            const q = document.getElementById('assistant-customer-search');
            const f = document.getElementById('assistant-customer-filter');
            if (q) q.value = '';
            if (f) f.value = 'all';
            renderAssistantCustomers();
        }

        function assistantIsToday(date) {
            if (!date) return false;
            return normalizeJalaliDate(date) === todayJalali();
        }

        function updateAssistantStats() {
            const contacts = customers.length + assistantOwners.length;
            const today = customers.filter(c => assistantIsToday(c.callDate) && !c.callDone).length +
                assistantOwners.filter(o => assistantIsToday(o.callDate) && !o.callDone).length;
            const pending = customers.filter(c => c.callDate && !c.callDone).length +
                assistantOwners.filter(o => o.callDate && !o.callDone).length;
            const activeProperties = properties.filter(p => p.status !== 'archived').length;
            const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = Number(value || 0).toLocaleString('fa-IR'); };
            set('assistant-stat-total', contacts); set('assistant-stat-today', today); set('assistant-stat-pending', pending); set('assistant-stat-properties', activeProperties);
        }

        function renderAssistantCustomers() {
            const list = document.getElementById('assistant-customers-list');
            const count = document.getElementById('assistant-cust-count');
            const emptyFilter = document.getElementById('assistant-customers-empty-filter');
            if (!list) return;
            renderCallReminders('assistant-call-reminders-list', 'assistant-call-reminder-count');
            renderAssistantPlanner();
            updateAssistantStats();

            const q = normalizeSearchQuery(String(document.getElementById('assistant-customer-search')?.value || '').trim());
            const filter = document.getElementById('assistant-customer-filter')?.value || 'all';
            const filtered = customers.filter(c => {
                const haystack = normalizeSearchQuery([c.name, c.phone, c.district, c.note].filter(Boolean).join(' '));
                if (q && !haystack.includes(q)) return false;
                if (filter === 'pending' && (!c.callDate || c.callDone)) return false;
                if (filter === 'today' && (!assistantIsToday(c.callDate) || c.callDone)) return false;
                if (filter === 'no-reminder' && c.callDate) return false;
                return true;
            });
            if (count) count.textContent = filtered.length.toLocaleString('fa-IR') + ' نفر';
            if (!customers.length) {
                list.innerHTML = '<p class="text-slate-500 text-center py-6">هنوز مشتری ثبت نشده. ابتدا از بخش مشتریان، مشتری اضافه کنید.</p>';
                if (emptyFilter) emptyFilter.classList.add('hidden');
                return;
            }
            if (!filtered.length) {
                list.innerHTML = '';
                if (emptyFilter) emptyFilter.classList.remove('hidden');
                return;
            }
            if (emptyFilter) emptyFilter.classList.add('hidden');
            list.innerHTML = filtered.map(c => {
                const budget = [c.budgetMin, c.budgetMax].filter(Boolean).map(n => n.toLocaleString('fa-IR')).join(' تا ') || '—';
                const area = [c.areaMin, c.areaMax].filter(Boolean).join('–') || '—';
                const selected = assistantSelectedCustomerId === c.id;
                const reminder = c.callDate && !c.callDone;
                const reminderText = reminder ? ('<span class="text-amber-300"><i class="fas fa-calendar-check ml-1"></i>' + escapeHtml(toPersianNum(c.callDate)) + ' · ' + escapeHtml(toPersianNum(c.callTime || '')) + '</span>') : '<span class="text-slate-500">بدون برنامه تماس</span>';
                return `<div class="${selected ? 'bg-violet-950/40 border-violet-500 ring-1 ring-violet-500/30' : 'bg-slate-900/80 border-slate-700'} rounded-xl p-4 border flex flex-col gap-3">
                    <div class="flex flex-col md:flex-row md:items-start gap-3">
                        <div class="w-12 h-12 shrink-0 rounded-xl bg-violet-600 flex items-center justify-center text-white font-black text-lg">${Number(c.customerNumber) || '—'}</div>
                        <div class="flex-1 min-w-0">
                            <div class="flex flex-wrap items-center gap-2"><p class="font-bold text-white">${escapeHtml(c.name)}</p>${c.phone ? '<span class="text-slate-400 text-sm">· ' + escapeHtml(c.phone) + '</span>' : ''}</div>
                            <p class="text-sm text-slate-400 mt-1">بودجه: ${budget} تومان · متراژ: ${area} · خواب: ${escapeHtml(c.rooms || '—')} · ${escapeHtml(c.district || 'منطقه آزاد')}</p>
                            <p class="text-xs mt-2">${reminderText}</p>
                        </div>
                        <div class="flex flex-wrap gap-2 shrink-0">
                            ${c.phone ? '<a href="tel:' + escapeHtml(c.phone) + '" class="touch-btn px-3 py-2 bg-emerald-600 rounded-xl text-sm font-bold"><i class="fas fa-phone ml-1"></i>تماس</a>' : ''}
                            <button type="button" onclick="setCustomerReminder(Number(decodeJsArg('${safeJsArg(c.id)}')))" class="touch-btn px-3 py-2 bg-amber-600 rounded-xl text-sm font-bold"><i class="fas fa-calendar-plus ml-1"></i>برنامه</button>
                            ${reminder ? `<button type="button" onclick="completeCustomerReminder(Number(decodeJsArg('${safeJsArg(c.id)}')))" class="touch-btn px-3 py-2 bg-indigo-600 rounded-xl text-sm font-bold">انجام شد</button>` : ''}
                        </div>
                    </div>
                    <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-700/70">
                        <span class="text-xs text-slate-500">دستیار: تطبیق فایل بر اساس نیاز ثبت‌شده</span>
                        <button type="button" onclick="assistantMatchCustomer(Number(decodeJsArg('${safeJsArg(c.id)}')))" class="touch-btn px-5 py-10.0 bg-emerald-600 rounded-xl text-sm font-bold"><i class="fas fa-wand-magic-sparkles ml-1"></i>نمایش فایل‌های مناسب</button>
                    </div>
                </div>`;
            }).join('');
        }

        function matchCustomerFromSelect() {
            const id = Number(document.getElementById('match-customer-select')?.value || 0);
            if (id) matchCustomer(id);
            else document.getElementById('match-results-section')?.classList.add('hidden');
        }

        function priceToMillion(p) {
            if (p == null || p === '') return null;
            const n = typeof p === 'number' ? p : parseAmountInput(String(p));
            if (n == null) return null;
            // فرض: اگر عدد بزرگ باشد (تومان کامل) به میلیون تبدیل کن
            if (n > 100000) return n / 1e6;
            return n;
        }

        function matchCustomer(id) {
            assistantSelectedCustomerId = Number(id) || null;
            renderCustomerMatches(assistantSelectedCustomerId, {
                sectionId: 'match-results-section', labelId: 'match-for-label', boxId: 'match-results', includeArchivedId: 'match-include-archived'
            });
        }

        /** بارگذاری داده از هارد (فقط Electron) */
        async function loadFromDisk() {
            if (!isElectron) return;
            try {
                const props = await window.electronAPI.readJson('properties.json');
                if (Array.isArray(props)) {
                    properties = normalizePropertiesList(props);
                }
                const ag = await window.electronAPI.readJson('agents.json');
                if (Array.isArray(ag)) {
                    agents = normalizeAgentsList(ag);
                }
                const cu = await window.electronAPI.readJson('customers.json');
                if (Array.isArray(cu)) customers = normalizeCustomersList(cu);
                const ow = await window.electronAPI.readJson('owners.json');
                if (Array.isArray(ow)) assistantOwners = normalizeOwnersList(ow);
                const rt = await window.electronAPI.readJson('routines.json');
                if (Array.isArray(rt)) assistantRoutines = normalizeRoutinesList(rt);
                syncRoutineCompletionState();
            } catch (e) {
                console.error('loadFromDisk', e);
            }
        }

        function fillAgentSelect(selectedName) {
            const sel = document.getElementById('f-agent');
            if (!sel) return;
            const cur = selectedName || sel.value || (agents[0] && agents[0].name) || '';
            sel.innerHTML = agents.map(a =>
                '<option value="' + escapeHtml(a.name) + '"' +
                (a.name === cur ? ' selected' : '') + '>' + escapeHtml(a.name) + '</option>'
            ).join('');
            if (!agents.length) {
                sel.innerHTML = '<option value="مهندس شیرنگی">مهندس شیرنگی</option>';
            }
        }

        function renderAgentsList() {
            const box = document.getElementById('agents-list');
            if (!box) return;
            if (!agents.length) {
                box.innerHTML = '<p class="text-slate-400 text-center py-6">مشاوری ثبت نشده</p>';
                return;
            }
            box.innerHTML = agents.map(a => `
                <div class="flex items-center justify-between gap-3 bg-slate-900/80 rounded-xl px-4 py-3 border border-slate-700">
                    <div class="min-w-0">
                        <p class="font-bold truncate">${escapeHtml(a.name)}</p>
                        ${a.phone ? '<p class="text-xs text-slate-400 mt-0.5" style="direction:ltr;text-align:right">' + escapeHtml(a.phone) + '</p>' : ''}
                    </div>
                    <button type="button" onclick="removeAgent(Number(decodeJsArg('${safeJsArg(a.id)}')))" class="touch-btn px-4 py-2 bg-red-600/80 hover:bg-red-600 rounded-xl text-sm shrink-0" title="حذف">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `).join('');
        }

        function submitAddAgent(e) {
            e.preventDefault();
            if (!isAdminUnlocked()) {
                requireAdmin();
                return false;
            }
            const nameEl = document.getElementById('new-agent-name');
            const phoneEl = document.getElementById('new-agent-phone');
            const name = (nameEl && nameEl.value || '').trim();
            const phone = (phoneEl && phoneEl.value || '').trim();
            if (!name) return false;
            if (agents.some(a => a.name === name)) {
                alert('این مشاور قبلاً ثبت شده است.');
                return false;
            }
            const newId = agents.length ? Math.max(...agents.map(a => a.id)) + 1 : 1;
            const agent = { id: newId, name: name.slice(0,200), phone: phone.slice(0,50) };
            agents.push(agent);
            saveAgents().then(result => {
                if (result?.ok) { fillAgentSelect(name); renderAgentsList(); if (nameEl) nameEl.value = ''; if (phoneEl) phoneEl.value = ''; }
                else { agents = agents.filter(a => a !== agent); alert('ذخیره مشاور ناموفق بود.'); }
            });
            return false;
        }

        function removeAgent(id) {
            const a = agents.find(x => x.id === id);
            if (!a) return;
            if (agents.length <= 1) {
                alert('حداقل یک مشاور باید باقی بماند.');
                return;
            }
            if (!confirm('حذف مشاور «' + a.name + '»؟')) return;
            const previous = agents;
            agents = agents.filter(x => x.id !== id);
            saveAgents().then(result => {
                if (result?.ok) { fillAgentSelect(); renderAgentsList(); }
                else { agents = previous; alert('حذف مشاور ذخیره نشد.'); }
            });
        }

        function openAdminPanel() {
            requireAdmin(() => {
                renderAgentsList();
                fillAgentSelect();
                goTo('admin');
            });
        }

        async function submitChangePassword(e) {
            e.preventDefault();
            if (!isAdminUnlocked()) {
                alert('ابتدا وارد شوید.');
                return false;
            }
            const p1 = document.getElementById('new-admin-pass');
            const p2 = document.getElementById('new-admin-pass2');
            const msg = document.getElementById('change-pass-msg');
            const v1 = (p1 && p1.value) || '';
            const v2 = (p2 && p2.value) || '';
            if (v1.length < 10) {
                if (msg) { msg.textContent = 'رمز باید حداقل ۱۰ کاراکتر باشد'; msg.className = 'text-sm text-center text-red-400'; msg.classList.remove('hidden'); }
                return false;
            }
            if (v1 !== v2) {
                if (msg) { msg.textContent = 'رمز و تکرار آن یکسان نیست'; msg.className = 'text-sm text-center text-red-400'; msg.classList.remove('hidden'); }
                return false;
            }
            const ok = await changeAdminPassword(v1);
            if (msg) {
                msg.textContent = ok ? 'رمز با موفقیت ذخیره شد' : 'خطا در ذخیره';
                msg.className = 'text-sm text-center ' + (ok ? 'text-green-400' : 'text-red-400');
                msg.classList.remove('hidden');
            }
            if (ok && p1 && p2) { p1.value = ''; p2.value = ''; }
            return false;
        }

        // ========== امنیت ادمین ==========
        let _adminUnlocked = false;
        let _adminConfigured = false;
        let _adminPendingAction = null;
        let _adminFailCount = 0;
        let _adminLockUntil = 0;

        async function initAdminSecurity() {
            if (isElectron && window.electronAPI?.adminStatus) {
                try {
                    const st = await window.electronAPI.adminStatus();
                    _adminConfigured = !!st.configured;
                    _adminUnlocked = !!st.authenticated;
                } catch (_) { _adminConfigured = false; _adminUnlocked = false; }
            } else {
                // Web/Android: local admin credential is stored only as a salted WebCrypto hash.
                // It is a convenience lock, not a replacement for server-side authorization.
                try { _adminConfigured = !!ShirangiRuntimeStorage.getItem('shirangi_admin_v1'); }
                catch (_) { _adminConfigured = false; }
            }
            updateAdminUI();
        }
        function isAdminUnlocked() { return _adminUnlocked === true; }
        async function setAdminUnlocked(ok) {
            _adminUnlocked = !!ok;
            updateAdminUI();
        }
        async function sha256Hex(str) {
            const data = new TextEncoder().encode(str);
            const buf = await crypto.subtle.digest('SHA-256', data);
            return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        }
        function updateAdminUI() {
            const unlocked = isAdminUnlocked();
            document.querySelectorAll('[data-admin-only]').forEach(el => {
                if (unlocked) { el.classList.remove('hidden'); el.style.display = el.id === 'map-admin-controls' ? 'flex' : ''; }
                else { el.classList.add('hidden'); if (el.id === 'map-admin-controls') el.style.display = 'none'; }
            });
            ['btn-welcome-pricing','btn-list-pricing'].forEach(id => { const btn=document.getElementById(id); if(btn){btn.classList.toggle('hidden',unlocked);btn.style.display=unlocked?'none':'';} });
            const badge=document.getElementById('admin-lock-badge');
            if (badge) badge.innerHTML = unlocked ? '<i class="fas fa-unlock text-green-400"></i> ادمین' : '<i class="fas fa-lock text-amber-400"></i> قفل';
            if (!unlocked && typeof cancelPickLocationMode === 'function') { try { cancelPickLocationMode(); } catch (_) {} }
        }
        function requireAdmin(actionFn) {
            if (isAdminUnlocked()) { if (typeof actionFn === 'function') actionFn(); return true; }
            _adminPendingAction = actionFn || null; openAdminModal(); return false;
        }
        function openAdminModal() {
            const modal=document.getElementById('admin-modal'), err=document.getElementById('admin-auth-error'), input=document.getElementById('admin-password-input');
            if(err){err.classList.add('hidden');err.textContent=_adminConfigured?'رمز اشتباه است':'ابتدا یک رمز مدیریت حداقل ۱۰ کاراکتری تعیین کنید';}
            if(input){input.value='';input.placeholder=_adminConfigured?'رمز مدیریت':'رمز جدید مدیریت';}
            const title=document.querySelector('#admin-modal h3'); if(title) title.textContent=_adminConfigured?'ورود مدیر':'تنظیم رمز مدیریت';
            if(modal){modal.classList.remove('hidden');modal.classList.add('flex');}
            setTimeout(()=>{if(input)input.focus();},150);
        }
        function closeAdminModal(){const modal=document.getElementById('admin-modal');if(modal){modal.classList.add('hidden');modal.classList.remove('flex');}_adminPendingAction=null;}
        function _adminBytesToB64(bytes) {
            let s=''; for(const b of bytes)s+=String.fromCharCode(b); return btoa(s);
        }
        function _adminB64ToBytes(s) {
            const bin=atob(s), a=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i); return a;
        }
        async function _adminHashPassword(password, saltB64) {
            if (!window.crypto?.subtle) throw new Error('WebCrypto unavailable');
            const salt=_adminB64ToBytes(saltB64);
            const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
            const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:150000,hash:'SHA-256'},key,256);
            return _adminBytesToB64(new Uint8Array(bits));
        }
        async function setupLocalAdminPassword(password) {
            const salt=new Uint8Array(16); crypto.getRandomValues(salt);
            const saltB64=_adminBytesToB64(salt);
            const hash=await _adminHashPassword(password,saltB64);
            ShirangiRuntimeStorage.setItem('shirangi_admin_v1',JSON.stringify({v:1,salt:saltB64,hash}));
        }
        async function verifyLocalAdminPassword(password) {
            const raw=ShirangiRuntimeStorage.getItem('shirangi_admin_v1'); if(!raw)return false;
            const rec=JSON.parse(raw);
            if(!rec || rec.v!==1 || !rec.salt || !rec.hash)return false;
            const got=await _adminHashPassword(password,rec.salt);
            if(got.length!==rec.hash.length)return false;
            let diff=0; for(let i=0;i<got.length;i++)diff|=got.charCodeAt(i)^rec.hash.charCodeAt(i);
            return diff===0;
        }
                async function submitAdminAuth(e) {
            e.preventDefault(); const now=Date.now();
            if(now<_adminLockUntil){const sec=Math.ceil((_adminLockUntil-now)/1000),err=document.getElementById('admin-auth-error');if(err){err.textContent='لطفاً '+toPersianNum(sec)+' ثانیه صبر کنید';err.classList.remove('hidden');}return false;}
            const input=document.getElementById('admin-password-input'),pwd=(input?.value||''); if(pwd.length<10){const err=document.getElementById('admin-auth-error');if(err){err.textContent='رمز مدیریت باید حداقل ۱۰ کاراکتر باشد';err.classList.remove('hidden');}return false;}
            let ok=false;
            if(isElectron && window.electronAPI){
                const result = _adminConfigured ? await window.electronAPI.adminAuthenticate(pwd) : await window.electronAPI.adminSetup(pwd);
                ok=!!result?.ok; if(result?.ok)_adminConfigured=true;
            } else {
                // Web/Android local admin lock. The password itself is never stored.
                try {
                    if (!_adminConfigured) {
                        await setupLocalAdminPassword(pwd);
                        ok = true;
                        _adminConfigured = true;
                    } else {
                        ok = await verifyLocalAdminPassword(pwd);
                    }
                } catch (_) { ok = false; }
            }
            if(ok){_adminFailCount=0;const fn=_adminPendingAction;_adminPendingAction=null;await setAdminUnlocked(true);closeAdminModal();if(typeof fn==='function')fn();}
            else{_adminFailCount++;const err=document.getElementById('admin-auth-error');if(err){err.textContent='رمز اشتباه است';err.classList.remove('hidden');}if(_adminFailCount>=5){_adminLockUntil=Date.now()+60000;_adminFailCount=0;}if(input){input.value='';input.focus();}}
            return false;
        }
        async function logoutAdmin(){if(isElectron&&window.electronAPI?.adminLogout)await window.electronAPI.adminLogout();await setAdminUnlocked(false);}
        async function changeAdminPassword(newPassword){
            if(!isAdminUnlocked()||!isElectron||!window.electronAPI?.adminChangePassword)return false;
            if(String(newPassword).length<10)return false;
            // current password is requested by the UI in a separate prompt to avoid exposing it in storage.
            const current=window.prompt('رمز فعلی مدیریت را وارد کنید:')||'';
            const r=await window.electronAPI.adminChangePassword({currentPassword:current,newPassword:String(newPassword)});
            if(r?.ok)alert('رمز مدیریت با موفقیت تغییر کرد.');
            return !!r?.ok;
        }
        window.changeAdminPassword = changeAdminPassword;
        window.logoutAdmin = logoutAdmin;
        window.submitAdminAuth = submitAdminAuth;
        window.closeAdminModal = closeAdminModal;
        window.requireAdmin = requireAdmin;
        window.openAdminPanel = openAdminPanel;
        window.submitAddAgent = submitAddAgent;
        window.removeAgent = removeAgent;
        window.submitChangePassword = submitChangePassword;
        window.fillAgentSelect = fillAgentSelect;

        let mapInstance = null;
        let currentProperty = null;
        let currentGallery = 'facade';
        let currentList = properties;
        let plaqueModeActive = false;
        let currentIndex = 0;
        let propertyMarkers = [];
        let longPressTimer = null;
        let longPressStartLatLng = null;
        let longPressMoved = false;
        let longPressStartXY = null;
        let tempLocationMarker = null;
        let longPressSetupDone = false;
        let pickLocationMode = false;
        const LONG_PRESS_MS = 450;
        const LONG_PRESS_MOVE_PX = 28;

        // ========== SUBSCRIPTION SYSTEM ==========
        const PLANS = {
            free:   { id: 'free',   name: 'رایگان', label: 'پلن رایگان', price: 0,       canAdd: false, canAgents: false },
            agent:  { id: 'agent',  name: 'مشاور',  label: 'پلن مشاور',  price: 590000,  canAdd: true,  canAgents: true  },
            agency: { id: 'agency', name: 'آژانس',  label: 'پلن آژانس',  price: 2900000, canAdd: true,  canAgents: true  }
        };
        const SUB_STORAGE_KEY = 'shirangi_subscription';
        const CODES_STORAGE_KEY = 'shirangi_activation_codes';
        const DEVICE_ID_KEY = 'shirangi_device_id';
        const TRIAL_DAYS = 7;
        const MS_PER_DAY = 24 * 60 * 60 * 1000;
        let _pendingZarinpalPlan = null;
        let _supabaseClient = null;
        let _subscriptionCloudVerified = false;

        function createSecureDeviceToken() {
            try {
                if (window.crypto?.randomUUID) return window.crypto.randomUUID().replace(/-/g, '');
                const bytes = new Uint8Array(24);
                if (window.crypto?.getRandomValues) { window.crypto.getRandomValues(bytes); return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(''); }
                throw new Error('secure random unavailable');
            } catch (_) {
                throw new Error('secure random unavailable');
            }
        }

        function getDeviceId() {
            try {
                let id = ShirangiRuntimeStorage.getItem(DEVICE_ID_KEY);
                if (!id) {
                    id = 'dev_' + createSecureDeviceToken();
                    ShirangiRuntimeStorage.setItem(DEVICE_ID_KEY, id);
                }
                return id;
            } catch (e) {
                return '';
            }
        }

        function requireDeviceId() {
            const id = getDeviceId();
            if (!id) throw new Error('SECURE_DEVICE_ID_UNAVAILABLE');
            return id;
        }

        function getConfig() {
            return window.SHIRANGI_CONFIG || { useSupabase: false };
        }

        // تاریخ انقضای اشتراک همیشه از اعتبار فعلی ادامه پیدا می‌کند، نه از امروز.
        function addCalendarMonthsFromExpiry(expiresMs, months) {
            const m = Math.max(1, Math.min(24, parseInt(months, 10) || 1));
            const base = Number.isFinite(expiresMs) && expiresMs > Date.now() ? new Date(expiresMs) : new Date();
            base.setMonth(base.getMonth() + m);
            return base.getTime();
        }

        function validateBackupArray(value, maxItems, label) {
            if (!Array.isArray(value) || value.length > maxItems) throw new Error(label + ' نامعتبر است');
            return value.filter(v => v && typeof v === 'object' && !Array.isArray(v));
        }

        async function ensureSupabaseSession() {
            const sb = getSupabase();
            if (!sb) return null;
            try {
                const current = await sb.auth.getSession();
                if (current?.data?.session?.user) return current.data.session;
                const { data, error } = await sb.auth.signInAnonymously();
                if (error) throw error;
                if (!data?.session?.user) throw new Error('AUTH_SESSION_UNAVAILABLE');
                return data.session;
            } catch (e) {
                console.warn('Supabase identity unavailable', e);
                return null;
            }
        }

        async function sbSessionForFunctions() {
            const sb = getSupabase();
            if (!sb) throw new Error('SUPABASE_UNAVAILABLE');
            const session = await ensureSupabaseSession();
            if (!session?.access_token) throw new Error('AUTH_REQUIRED');
            return session;
        }

        function getSupabase() {
            if (_supabaseClient) return _supabaseClient;
            const cfg = getConfig();
            if (!cfg.useSupabase || !cfg.supabaseUrl || !cfg.supabaseKey ||
                cfg.supabaseUrl.includes('YOUR_PROJECT') || typeof window.supabase === 'undefined') {
                return null;
            }
            try {
                _supabaseClient = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
                return _supabaseClient;
            } catch (e) {
                console.warn('Supabase init failed', e);
                return null;
            }
        }

        function defaultSubscription() {
            return {
                plan: 'free',
                expires: null,
                activatedAt: null,
                trial: false,
                trialUsed: false,
                expiredFrom: null
            };
        }

        function normalizeSubscription(raw) {
            const base = defaultSubscription();
            if (!raw || typeof raw !== 'object') return base;
            const plan = PLANS[raw.plan] ? raw.plan : 'free';
            return {
                plan,
                expires: (typeof raw.expires === 'number' && raw.expires > 0) ? raw.expires : null,
                activatedAt: (typeof raw.activatedAt === 'number') ? raw.activatedAt : null,
                trial: !!raw.trial,
                trialUsed: !!raw.trialUsed || !!raw.trial,
                expiredFrom: raw.expiredFrom || null
            };
        }

        function getSubscription() {
            try {
                const raw = ShirangiRuntimeStorage.getItem(SUB_STORAGE_KEY);
                if (!raw) return defaultSubscription();
                let s = normalizeSubscription(JSON.parse(raw));
                if (s.expires && Date.now() > s.expires) {
                    const expired = {
                        plan: 'free',
                        expires: null,
                        activatedAt: null,
                        trial: false,
                        trialUsed: s.trialUsed,
                        expiredFrom: s.plan
                    };
                    ShirangiRuntimeStorage.setItem(SUB_STORAGE_KEY, JSON.stringify(expired));
                    pushSubscriptionToCloud(expired);
                    return expired;
                }
                // Cloud-auth mode: unverified local premium is treated as free for entitlement decisions.
                const cfg = getConfig();
                if (cfg.useSupabase && cfg.requireCloudAuthForPremium && s.plan !== 'free' && !_subscriptionCloudVerified) {
                    return {
                        plan: 'free',
                        expires: null,
                        activatedAt: null,
                        trial: false,
                        trialUsed: s.trialUsed,
                        expiredFrom: s.plan,
                        pendingCloudVerification: true
                    };
                }
                return s;
            } catch (e) {
                return defaultSubscription();
            }
        }

        function saveSubscription(partial) {
            const prev = getSubscription();
            const next = normalizeSubscription({
                ...prev,
                ...partial,
                trialUsed: !!(prev.trialUsed || partial.trialUsed || partial.trial)
            });
            try {
                ShirangiRuntimeStorage.setItem(SUB_STORAGE_KEY, JSON.stringify(next));
            } catch (e) {
                console.warn('saveSubscription failed', e);
            }
            pushSubscriptionToCloud(next);
            updateSubscriptionUI();
            return next;
        }

        // اشتراک از سمت کلاینت قابل upsert نیست؛ تنها پرداخت/کد فعال‌سازی سمت سرور آن را تغییر می‌دهد.
        async function pushSubscriptionToCloud(sub) {
            return null;
        }

        async function pullSubscriptionFromCloud() {
            const sb = getSupabase();
            if (!sb) return null;
            try {
                const deviceId = getDeviceId();
            if (!deviceId) { alert('شناسه امن دستگاه در دسترس نیست. لطفاً از مرورگر/نسخه به‌روز استفاده کنید.'); return; }
                if (!(await ensureSupabaseSession())) { _subscriptionCloudVerified = false; return null; }
                const { data, error } = await sb.rpc('get_subscription');
                if (error) { _subscriptionCloudVerified = false; return null; }
                const row = Array.isArray(data) ? data[0] : data;
                // حتی نبودن رکورد نیز یک پاسخ معتبر از سرور است: این دستگاه Free است.
                _subscriptionCloudVerified = true;
                if (!row) {
                    const free = defaultSubscription();
                    try { ShirangiRuntimeStorage.setItem(SUB_STORAGE_KEY, JSON.stringify(free)); } catch (_) {}
                    updateSubscriptionUI();
                    return free;
                }
                const remote = normalizeSubscription({
                    plan: row.plan,
                    expires: row.expires_at ? new Date(row.expires_at).getTime() : null,
                    activatedAt: row.activated_at ? new Date(row.activated_at).getTime() : null,
                    trial: !!row.trial,
                    trialUsed: !!row.trial_used_at || !!row.trial || (row.notes || '').includes('trial_used')
                });
                // وقتی Backend فعال است، سرور منبع حقیقت است؛ cache محلی حتی اگر جدیدتر به نظر برسد معتبر نیست.
                try {
                    ShirangiRuntimeStorage.setItem(SUB_STORAGE_KEY, JSON.stringify(remote));
                } catch (e) {}
                updateSubscriptionUI();
                return remote;
            } catch (e) {
                _subscriptionCloudVerified = false;
                console.warn('pullSubscriptionFromCloud', e);
            }
            return null;
        }

        function currentPlan() {
            const s = getSubscription();
            return PLANS[s.plan] || PLANS.free;
        }

        function canAddProperty() {
            if (isAdminUnlocked()) return true; // صاحب اپ همیشه دسترسی کامل دارد
            const cfg = getConfig();
            const sb = getSupabase();
            // وقتی Backend تنظیم شده، cache محلی به‌تنهایی منبع مجوز نیست.
            if (sb && !_subscriptionCloudVerified) return false;
            if (cfg.useSupabase && cfg.requireCloudAuthForPremium && !window.ShirangiConfigGuard?.canUsePremiumLocally()) {
                if (!_subscriptionCloudVerified) return false;
            }
            if (cfg.productionMode && window.ShirangiConfigGuard && !window.ShirangiConfigGuard.isCloudReady()) {
                return false;
            }
            const s = getSubscription();
            const plan = PLANS[s.plan];
            return !!(plan && plan.canAdd);
        }

        function formatPlanPrice(price) {
            if (!price) return '۰ تومان';
            if (price >= 1000000) {
                const m = (price / 1000000).toFixed(1).replace(/\.0$/, '');
                return m + ' میلیون تومان';
            }
            if (price >= 1000) {
                return Math.round(price / 1000) + ' هزار تومان';
            }
            return price + ' تومان';
        }

        function daysLeft(expires) {
            if (!expires) return null;
            return Math.max(0, Math.ceil((expires - Date.now()) / MS_PER_DAY));
        }

        function updateSubscriptionUI() {
            const s = getSubscription();
            const plan = PLANS[s.plan] || PLANS.free;

            const badge = document.getElementById('welcome-plan-badge');
            const badgeText = document.getElementById('welcome-plan-text');
            if (badge && badgeText) {
                if (s.plan !== 'free') {
                    badge.classList.remove('hidden');
                    let t = 'پلن فعال: ' + plan.name;
                    if (s.trial) t += ' (آزمایشی)';
                    if (s.expires) {
                        t += ' تا ' + new Date(s.expires).toLocaleDateString('fa-IR');
                    }
                    badgeText.textContent = t;
                } else {
                    badge.classList.add('hidden');
                }
            }

            const label = document.getElementById('current-plan-label');
            const expEl = document.getElementById('current-plan-expire');
            if (label) {
                label.textContent = plan.label + (s.trial ? ' — آزمایشی' : '');
            }
            if (expEl) {
                if (s.expires) {
                    const d = daysLeft(s.expires);
                    expEl.textContent = 'اعتبار تا ' + new Date(s.expires).toLocaleDateString('fa-IR') +
                        (d != null ? ' (' + d + ' روز باقی‌مانده)' : '');
                } else if (s.plan === 'free') {
                    if (s.expiredFrom) {
                        expEl.textContent = 'اشتراک قبلی منقضی شده. برای ثبت فایل دوباره ارتقا دهید.';
                    } else {
                        expEl.textContent = 'برای ثبت فایل، پلن مشاور یا آژانس را انتخاب کنید';
                    }
                } else {
                    expEl.textContent = 'اشتراک بدون تاریخ انقضا (فعال‌سازی دستی)';
                }
            }

            document.querySelectorAll('[data-plan-card]').forEach(card => {
                const id = card.getAttribute('data-plan-card');
                if (id === s.plan) {
                    card.classList.add('ring-2', 'ring-emerald-400');
                } else {
                    card.classList.remove('ring-2', 'ring-emerald-400');
                }
            });

            const trialBtn = document.getElementById('btn-activate-trial');
            if (trialBtn) {
                if (s.plan !== 'free' && s.trial) {
                    trialBtn.disabled = true;
                    trialBtn.classList.add('opacity-50', 'cursor-not-allowed');
                    trialBtn.innerHTML = '<i class="fas fa-check ml-1"></i> آزمایشی فعال است';
                } else if (s.trialUsed && s.plan === 'free') {
                    trialBtn.disabled = true;
                    trialBtn.classList.add('opacity-50', 'cursor-not-allowed');
                    trialBtn.innerHTML = '<i class="fas fa-ban ml-1"></i> آزمایشی قبلاً استفاده شده';
                } else {
                    trialBtn.disabled = false;
                    trialBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                    trialBtn.innerHTML = '<i class="fas fa-gift ml-1"></i> فعال‌سازی آزمایشی ۷ روزه (مشاور)';
                }
            }

            const adminSub = document.getElementById('admin-sub-status');
            if (adminSub) {
                let t = plan.label;
                if (s.trial) t += ' (آزمایشی)';
                if (s.expires) {
                    const d = daysLeft(s.expires);
                    t += ' — ' + (d != null ? d + ' روز' : '') + ' تا ' + new Date(s.expires).toLocaleDateString('fa-IR');
                } else if (s.plan !== 'free') {
                    t += ' — بدون انقضا';
                }
                if (s.trialUsed) t += ' | trial استفاده شده';
                adminSub.textContent = t;
            }

            // دکمه زرین‌پال: اگر Edge Function یا Merchant مستقیم تنظیم شده باشد
            const zpGroup = document.getElementById('zp-pay-group');
            if (zpGroup) {
                const cfg = getConfig();
                const edgeOk = !!(cfg.useEdgePayment && cfg.functionsBase && String(cfg.functionsBase).includes('http'));
                const directOk = false; // Merchant ID must never be shipped to clients
                if (edgeOk) {
                    zpGroup.classList.remove('hidden');
                } else {
                    zpGroup.classList.add('hidden');
                }
            }
        }

        function selectPlan(planId) {
            if (!PLANS[planId]) return;
            if (planId === 'free') {
                const cur = getSubscription();
                if (cur.plan === 'free') {
                    alert('شما هم‌اکنون روی پلن رایگان هستید.');
                    return;
                }
                if (!confirm('اشتراک فعلی لغو و به پلن رایگان برگردید؟\nثبت فایل جدید غیرفعال می‌شود.')) return;
                saveSubscription({
                    plan: 'free',
                    expires: null,
                    activatedAt: Date.now(),
                    trial: false,
                    expiredFrom: null
                });
                alert('پلن رایگان فعال شد. برای ثبت فایل به پلن مشاور یا آژانس ارتقا دهید.');
                return;
            }
            _pendingZarinpalPlan = planId;
            const plan = PLANS[planId];
            const priceStr = formatPlanPrice(plan.price) + ' در ماه';
            const cfg = getConfig();
            let msg =
                'پلن «' + plan.name + '»\n\n' +
                'قیمت: ' + priceStr + '\n\n' +
                'پرداخت: تماس / کارت‌به‌کارت — شماره ۰۹۹۹۹۹۲۶۵۲۵\n' +
                'بعد از پرداخت، کد فعال‌سازی بگیرید یا از مدیر بخواهید فعال کند.\n\n';
            const edgeOk = !!(cfg.useEdgePayment && cfg.functionsBase && String(cfg.functionsBase).includes('http'));
            const directOk = false; // Direct gateway access is permanently disabled; Merchant stays server-side.
            if (edgeOk) {
                msg += 'می‌توانید از دکمه «پرداخت با زرین‌پال» هم استفاده کنید.\n\n';
            }
            msg += 'آیا نسخه آزمایشی ۷ روزه همین پلن را الان فعال می‌کنید؟';
            if (confirm(msg)) {
                activateTrial(planId);
            }
        }

        async function activateTrial(planId) {
            if (!PLANS[planId] || planId === 'free') planId = 'agent';
            const cur = getSubscription();
            if (cur.plan !== 'free' && cur.expires && Date.now() < cur.expires) {
                alert('نسخه آزمایشی/اشتراک شما هنوز فعال است تا ' + new Date(cur.expires).toLocaleDateString('fa-IR') + '.');
                return;
            }
            const sb = getSupabase();
            if (sb) {
                try {
                    if (!(await ensureSupabaseSession())) throw new Error('AUTH_REQUIRED');
                    const { data, error } = await sb.rpc('start_trial', { p_plan: planId, p_device_id: requireDeviceId() });
                    if (error) throw error;
                    const row = Array.isArray(data) ? data[0] : data;
                    if (!row?.expires_at) throw new Error('TRIAL_RESPONSE_INVALID');
                    const expires = new Date(row.expires_at).getTime();
                    saveSubscription({ plan: row.plan || planId, expires, activatedAt: Date.now(), trial: true, trialUsed: true, expiredFrom: null });
                        _subscriptionCloudVerified = true;
                    alert('نسخه آزمایشی ۷ روزه پلن «' + PLANS[row.plan || planId].name + '» فعال شد.\nتا ' + new Date(expires).toLocaleDateString('fa-IR') + ' می‌توانید فایل ثبت کنید.');
                    goTo('map');
                    return;
                } catch (e) {
                    console.warn('cloud trial', e);
                    const msg = String(e?.message || '');
                    if (/TRIAL_ALREADY_USED/i.test(msg)) {
                        alert('نسخه آزمایشی این دستگاه قبلاً استفاده شده است.');
                        return;
                    }
                    alert('فعال‌سازی آزمایشی از سرور ناموفق بود. لطفاً اتصال اینترنت یا تنظیمات Supabase را بررسی کنید.');
                    return;
                }
            }
            // Trial is a server entitlement. Never mint a premium trial locally.
            alert('برای فعال‌سازی نسخه آزمایشی، اتصال امن به سرویس اشتراک و ورود کاربر لازم است.');
        }

        async function activatePaidPlan(planId, months) {
            if (!isAdminUnlocked()) {
                requireAdmin(() => activatePaidPlan(planId, months));
                return;
            }
            if (!PLANS[planId] || planId === 'free') { alert('پلن نامعتبر'); return; }
            months = Math.max(1, Math.min(24, parseInt(months, 10) || 1));
            const cfg = getConfig();
            const edgeOk = !!(cfg.useEdgePayment && cfg.functionsBase && String(cfg.functionsBase).includes('http'));
            if (edgeOk) {
                const secret = window.prompt('کلید مدیریت فعال‌سازی اشتراک را وارد کنید:');
                if (!secret) return;
                try {
                    const session = await sbSessionForFunctions();
                    const res = await fetch(String(cfg.functionsBase).replace(/\/$/, '') + '/admin-set-subscription', {
                        method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token,'apikey':cfg.supabaseKey||''},
                        body:JSON.stringify({admin_secret:secret,device_id:requireDeviceId(),plan:planId,months})
                    });
                    const json = await res.json();
                    if (!res.ok || !json.ok || !json.expires_at) throw new Error(json.error || 'فعال‌سازی ناموفق بود');
                    const expires = new Date(json.expires_at).getTime();
                    if (!Number.isFinite(expires)) throw new Error('تاریخ انقضا نامعتبر است');
                    _subscriptionCloudVerified = true;
                    saveSubscription({plan:json.plan||planId,expires,activatedAt:Date.now(),trial:false,expiredFrom:null});
                    alert('پلن «' + PLANS[json.plan||planId].name + '» برای ' + months + ' ماه فعال شد.\nاعتبار تا ' + new Date(expires).toLocaleDateString('fa-IR'));
                    return;
                } catch(e) { alert('فعال‌سازی امن اشتراک ناموفق بود: ' + (e.message||'')); return; }
            }
            alert('فعال‌سازی اشتراک فقط از سرویس امن سرور انجام می‌شود.');
        }

        async function resetToFreePlan() {
            if (!isAdminUnlocked()) { requireAdmin(() => resetToFreePlan()); return; }
            if (!confirm('اشتراک به پلن رایگان برگردد؟')) return;
            const cfg = getConfig();
            const edgeOk = !!(cfg.useEdgePayment && cfg.functionsBase && String(cfg.functionsBase).includes('http'));
            if (edgeOk) {
                const secret = window.prompt('کلید مدیریت فعال‌سازی اشتراک را وارد کنید:');
                if (!secret) return;
                try {
                    const session = await sbSessionForFunctions();
                    const res = await fetch(String(cfg.functionsBase).replace(/\/$/, '') + '/admin-set-subscription', {
                        method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token,'apikey':cfg.supabaseKey||''},
                        body:JSON.stringify({admin_secret:secret,device_id:requireDeviceId(),plan:'free',months:1,mode:'free'})
                    });
                    const json = await res.json();
                    if (!res.ok || !json.ok) throw new Error(json.error || 'عملیات ناموفق بود');
                    _subscriptionCloudVerified = true;
                } catch(e) { alert('بازگردانی امن اشتراک ناموفق بود: ' + (e.message||'')); return; }
            }
            saveSubscription({plan:'free',expires:null,activatedAt:Date.now(),trial:false,expiredFrom:null});
            alert('به پلن رایگان برگشت.');
        }

        function copyPaymentInfo() {
            const t =
                'کیوسک املاک شیرنگی\n' +
                'تماس: 09999926525\n' +
                'پلن مشاور: ' + formatPlanPrice(PLANS.agent.price) + '/ماه\n' +
                'پلن آژانس: ' + formatPlanPrice(PLANS.agency.price) + '/ماه';
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(t).then(() => {
                    const m = document.getElementById('payment-copy-msg');
                    if (m) {
                        m.classList.remove('hidden');
                        setTimeout(() => m.classList.add('hidden'), 2000);
                    }
                }).catch(() => alert(t));
            } else {
                alert(t);
            }
        }

        // ----- کدهای فعال‌سازی -----
        async function generateActivationCode() {
            if (!isAdminUnlocked()) { requireAdmin(() => generateActivationCode()); return; }
            const planSel = document.getElementById('gen-code-plan');
            const monthsSel = document.getElementById('gen-code-months');
            const planId = (planSel && planSel.value) || 'agent';
            const months = Math.max(1, Math.min(24, parseInt((monthsSel && monthsSel.value) || '1', 10)));
            if (!PLANS[planId] || planId === 'free') { alert('پلن نامعتبر'); return; }
            const cfg = getConfig();
            const edgeOk = !!(cfg.useEdgePayment && cfg.functionsBase && String(cfg.functionsBase).includes('http'));
            if (edgeOk) {
                const secret = window.prompt('کلید مدیریت صدور کد فعال‌سازی را وارد کنید:');
                if (!secret) return;
                try {
                    const session = await sbSessionForFunctions();
                    const res = await fetch(String(cfg.functionsBase).replace(/\/$/, '') + '/issue-activation-code', {
                        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token, 'apikey': cfg.supabaseKey || '' },
                        body: JSON.stringify({ plan: planId, months, admin_secret: secret })
                    });
                    const json = await res.json();
                    if (!res.ok || !json.ok || !json.code) throw new Error(json.error || 'صدور کد ناموفق بود');
                    const box = document.getElementById('generated-code-box');
                    const val = document.getElementById('generated-code-value');
                    if (val) val.textContent = json.code;
                    if (box) box.classList.remove('hidden');
                    return;
                } catch (e) {
                    console.error(e);
                    alert('صدور کد از سرور ناموفق بود. مطمئن شوید SHIRANGI_CODE_ADMIN_SECRET روی Edge Function تنظیم شده است.');
                    return;
                }
            }
            // Premium activation codes are cloud-issued only. Never mint a locally-valid entitlement.
            alert('صدور کد فعال‌سازی فقط از سرویس امن سرور انجام می‌شود. Supabase و Edge Function را فعال کنید.');
            return;
        }

        function copyGeneratedCode() {
            const val = document.getElementById('generated-code-value');
            if (!val || !val.textContent) return;
            const t = val.textContent.trim();
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(t).then(() => alert('کد کپی شد: ' + t)).catch(() => alert(t));
            } else {
                alert(t);
            }
        }

        async function redeemActivationCode() {
            const input = document.getElementById('activation-code-input');
            const msg = document.getElementById('activation-code-msg');
            const code = (input && input.value || '').trim().toUpperCase().replace(/\s+/g, '');
            const showMsg = (text, cls='text-red-400') => {
                if (!msg) return;
                msg.classList.remove('hidden');
                msg.className = 'text-sm mt-2 ' + cls;
                msg.textContent = text;
            };
            if (!/^SHIR-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) {
                showMsg('فرمت کد فعال‌سازی نامعتبر است.');
                return;
            }

            const sb = getSupabase();
            if (sb) {
                // مصرف کد باید اتمیک باشد؛ SELECT سپس UPDATE باعث می‌شد دو دستگاه یک کد را همزمان مصرف کنند.
                try {
                    if (!(await ensureSupabaseSession())) throw new Error('AUTH_REQUIRED');
                    const { data, error } = await sb.rpc('redeem_activation_code', {
                        p_code: code,
                        p_device_id: requireDeviceId()
                    });
                    if (!error && data?.length) {
                        const r = data[0];
                        if (!PLANS[r.plan] || r.plan === 'free') throw new Error('INVALID_PLAN');
                        const expires = new Date(r.expires_at).getTime();
                        saveSubscription({
                            plan: r.plan,
                            expires,
                            activatedAt: Date.now(),
                            trial: false,
                            trialUsed: getSubscription().trialUsed,
                            expiredFrom: null
                        });
                        _subscriptionCloudVerified = true;
                        if (input) input.value = '';
                        showMsg('پلن «' + PLANS[r.plan].name + '» برای ' + r.months + ' ماه فعال شد ✓', 'text-emerald-400');
                        alert('کد پذیرفته شد!\nپلن «' + PLANS[r.plan].name + '» برای ' + r.months + ' ماه فعال شد.\nاعتبار تا ' + new Date(expires).toLocaleDateString('fa-IR'));
                        updateSubscriptionUI();
                        return;
                    }
                    console.warn('redeem_activation_code', error);
                    showMsg('کد نامعتبر، قبلاً استفاده شده یا سرویس فعال‌سازی در دسترس نیست.');
                    return;
                } catch (e) {
                    console.warn('cloud redeem', e);
                    showMsg('فعال‌سازی کد از سرور ناموفق بود.');
                    return;
                }
            }

            showMsg('کد فعال‌سازی فقط از سرویس امن سرور قابل مصرف است.');
            return;
        }

        // ----- زرین‌پال (ترجیحاً از Edge Function — امن) -----
        async function startZarinpalPayment() {
            const cfg = getConfig();
            const planId = _pendingZarinpalPlan || 'agent';
            const monthsEl = document.getElementById('zp-months');
            const months = Math.max(1, Math.min(24, parseInt((monthsEl && monthsEl.value) || '1', 10) || 1));
            const plan = PLANS[planId] || PLANS.agent;
            const deviceId = requireDeviceId();
            const callback = window.location.href.split('?')[0];

            const edgeOk = !!(cfg.useEdgePayment && cfg.functionsBase && String(cfg.functionsBase).includes('http'));
            const directOk = false; // Direct gateway access is permanently disabled; Merchant stays server-side.

            if (!edgeOk) {
                alert(
                    'پرداخت آنلاین هنوز تنظیم نشده.\n\n' +
                    'یا functionsBase را در supabase-config.js بگذار (بعد از deploy توابع)،\n' +
                    'در غیر این صورت از تماس + کد فعال‌سازی استفاده کنید.'
                );
                return;
            }

            try {
                const session = await sbSessionForFunctions();
                if (edgeOk) {
                    const res = await fetch(String(cfg.functionsBase).replace(/\/$/, '') + '/zarinpal-request', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + session.access_token,
                            'apikey': cfg.supabaseKey || ''
                        },
                        body: JSON.stringify({
                            plan: planId,
                            months: months,
                            device_id: deviceId,
                        })
                    });
                    const json = await res.json();
                    if (!json.ok || !json.payment_url || !window.ShirangiSecurityPolicy?.isAllowedExternalUrl?.(json.payment_url)) {
                        throw new Error(json.error || 'آدرس پرداخت نامعتبر است');
                    }
                    try {
                        ShirangiRuntimeStorage.setItem('zp_authority', json.authority || '');
                        ShirangiRuntimeStorage.setItem('zp_plan', planId);
                        ShirangiRuntimeStorage.setItem('zp_months', String(months));
                        ShirangiRuntimeStorage.setItem('zp_authority_pending', json.authority || '');
                    } catch (e) {}
                    if (isElectron && window.electronAPI?.openExternal) {
                        await window.electronAPI.openExternal(json.payment_url);
                        pollZarinpalPayment(json.authority, planId, months);
                    } else {
                        window.location.href = json.payment_url;
                    }
                    return;
                }
                throw new Error('DIRECT_PAYMENT_DISABLED');
            } catch (e) {
                console.error(e);
                alert('ارتباط با درگاه برقرار نشد.\nاز تماس / کد فعال‌سازی استفاده کنید.\n\n' + (e.message || ''));
            }
        }

        async function pollZarinpalPayment(authority, planId, months) {
            const cfg = getConfig();
            if (!isElectron || !authority || !cfg.useEdgePayment || !cfg.functionsBase) return;
            const base = String(cfg.functionsBase).replace(/\/$/, '');
            const session = await sbSessionForFunctions();
            for (let i = 0; i < 60; i++) {
                await new Promise(r => setTimeout(r, 5000));
                try {
                    const res = await fetch(base + '/zarinpal-status', {
                        method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer ' + session.access_token,'apikey':cfg.supabaseKey || ''},
                        body:JSON.stringify({authority, device_id:requireDeviceId()})
                    });
                    const json = await res.json();
                    if (json.ok && json.status === 'paid' && json.expires_at) {
                        const expiresMs = new Date(json.expires_at).getTime();
                        if (!Number.isFinite(expiresMs)) throw new Error('INVALID_EXPIRES');
                        saveSubscription({plan:json.plan || planId, expires:expiresMs, activatedAt:Date.now(), trial:false, expiredFrom:null});
                        try { ShirangiRuntimeStorage.removeItem('zp_authority'); ShirangiRuntimeStorage.removeItem('zp_plan'); ShirangiRuntimeStorage.removeItem('zp_months'); ShirangiRuntimeStorage.removeItem('zp_authority_pending'); } catch (_) {}
                        alert('پرداخت تأیید شد ✓\nپلن «' + (PLANS[json.plan || planId]?.name || planId) + '» فعال شد.\nاعتبار تا ' + new Date(expiresMs).toLocaleDateString('fa-IR'));
                        updateSubscriptionUI();
                        return;
                    }
                    if (json.status === 'failed') { alert('پرداخت ناموفق بود.'); return; }
                } catch (e) { console.warn('zarinpal status poll', e); }
            }
            alert('زمان انتظار برای تأیید پرداخت تمام شد. اگر پرداخت انجام شده، چند دقیقه بعد صفحه را باز کنید یا Authority را به مدیر بدهید.');
        }

        async function handleZarinpalReturn() {
            const params = new URLSearchParams(window.location.search);
            if (params.get('zp') !== '1') return;
            const status = params.get('Status') || params.get('status');
            const authority = params.get('Authority') || params.get('authority') || ShirangiRuntimeStorage.getItem('zp_authority') || ShirangiRuntimeStorage.getItem('zp_authority_pending');
            const planId = params.get('plan') || ShirangiRuntimeStorage.getItem('zp_plan') || 'agent';
            const months = parseInt(params.get('months') || ShirangiRuntimeStorage.getItem('zp_months') || '1', 10) || 1;

            try {
                const clean = window.location.pathname + window.location.hash;
                window.history.replaceState({}, '', clean);
            } catch (e) {}

            if (!(status === 'OK' || status === 'ok')) {
                if (status) {
                    alert('پرداخت لغو شد یا ناموفق بود.');
                    goTo('pricing');
                }
                return;
            }

            const cfg = getConfig();
            const edgeOk = !!(cfg.useEdgePayment && cfg.functionsBase && String(cfg.functionsBase).includes('http'));

            if (edgeOk && authority) {
                try {
                    const session = await sbSessionForFunctions();
                    const res = await fetch(String(cfg.functionsBase).replace(/\/$/, '') + '/zarinpal-verify', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + session.access_token,
                            'apikey': cfg.supabaseKey || ''
                        },
                        body: JSON.stringify({
                            authority: authority,
                            device_id: requireDeviceId()
                        })
                    });
                    const json = await res.json();
                    if (json.ok) {
                        if (!json.expires_at) throw new Error('سرور تاریخ انقضا را برنگرداند');
                        const expiresMs = new Date(json.expires_at).getTime();
                        if (!Number.isFinite(expiresMs)) throw new Error('تاریخ انقضای سرور نامعتبر است');
                        saveSubscription({
                            plan: json.plan || planId,
                            expires: expiresMs,
                            activatedAt: Date.now(),
                            trial: false,
                            expiredFrom: null
                        });
                        _subscriptionCloudVerified = true;
                        alert(
                            'پرداخت تأیید شد ✓\n' +
                            'پلن «' + (PLANS[json.plan || planId] ? PLANS[json.plan || planId].name : planId) + '» فعال شد.\n' +
                            (json.ref_id ? ('کد پیگیری: ' + json.ref_id + '\n') : '') +
                            'اعتبار تا ' + new Date(expiresMs).toLocaleDateString('fa-IR')
                        );
                        goTo('pricing');
                        return;
                    }
                    alert(
                        'پرداخت انجام شد ولی تأیید سرور ناموفق بود:\n' +
                        (json.error || 'خطای نامشخص') +
                        '\n\nکد Authority را به مدیر بدهید یا از کد فعال‌سازی استفاده کنید.\n' +
                        (authority || '')
                    );
                    goTo('pricing');
                    return;
                } catch (e) {
                    console.error(e);
                    alert(
                        'پرداخت انجام شد ولی ارتباط با سرور تأیید برقرار نشد.\n' +
                        'Authority: ' + (authority || '—') + '\n' +
                        'لطفاً به مدیر اطلاع دهید یا کد فعال‌سازی بگیرید.'
                    );
                    goTo('pricing');
                    return;
                }
            }

            // بدون Edge: فقط اطلاع — فعال‌سازی دستی/کد
            alert(
                'پرداخت با موفقیت انجام شد (Authority: ' + (authority || '—') + ').\n\n' +
                'تأیید نهایی امن نیاز به Edge Function دارد.\n' +
                'لطفاً به مدیر اطلاع دهید تا اشتراک «' +
                (PLANS[planId] ? PLANS[planId].name : planId) + '» را فعال کند، یا کد فعال‌سازی دریافت کنید.'
            );
            goTo('pricing');
        }

        function requireSubscriptionForAdd() {
            if (canAddProperty()) return true;
            if (confirm('برای ثبت فایل جدید نیاز به پلن مشاور یا آژانس دارید.\n\nمی‌خواهید صفحه پلن‌ها را ببینید؟')) {
                goTo('pricing');
            }
            return false;
        }

        function goToAdd() {
            if (!requireSubscriptionForAdd()) return;
            goTo('add');
        }

        // بعد از لود صفحه: برگشت از زرین‌پال + همگام‌سازی ابری
        setTimeout(function () {
            handleZarinpalReturn();
            pullSubscriptionFromCloud();
            updateSubscriptionUI();
        }, 400);

        // ========== NETWORK & DEALS / ECOSYSTEM ==========
        // Single source of truth for the "شبکه و معامله" screen.
        // Reads the real local property list plus CRM/enterprise deal data; never invents demo rows.
        let ecoTab = 'properties';
        function ecoReadCRM(){
            try { const raw=ShirangiRuntimeStorage.getItem('shirangi_crm'); return raw?JSON.parse(raw):{}; } catch(_){ return {}; }
        }
        function ecoReadEnterprise(){
            try { const raw=ShirangiRuntimeStorage.getItem('shirangi.enterprise-suite.v36'); return raw?JSON.parse(raw):{}; } catch(_){ return {}; }
        }
        function ecoMoney(v){ const n=Number(v||0); return n>0?n.toLocaleString('fa-IR')+' تومان':'توافقی'; }
        function ecoStage(v){ return ({new:'جدید',qualified:'احراز',visit:'بازدید',offer:'پیشنهاد',negotiation:'مذاکره',contract:'قرارداد',closed:'بسته شد',agreement:'توافق',done:'انجام شد'})[String(v||'')]||String(v||'—'); }
        function ecoDealRows(){
            const crm=ecoReadCRM(), ent=ecoReadEnterprise();
            const rows=[];
            (Array.isArray(ent.deals)?ent.deals:[]).forEach(d=>rows.push({id:d.id,title:d.title||'معامله بدون عنوان',contact:d.contact||'',property:d.property||'',value:d.value,stage:d.stage,agent:d.agent||''}));
            (Array.isArray(crm.pipeline)?crm.pipeline:[]).forEach(p=>{
                const c=(typeof crmResolveContact==='function')?crmResolveContact(p.key):{name:'مخاطب'};
                rows.push({id:'crm-'+p.id,title:'فرآیند معامله',contact:c?.name||'مخاطب',property:'',value:0,stage:p.stage,agent:'',note:p.note||''});
            });
            const seen=new Set(); return rows.filter(r=>{const k=String(r.id);if(seen.has(k))return false;seen.add(k);return true;});
        }
        function ecoRender(){
            const k=document.getElementById('eco-kpis'), nav=document.getElementById('eco-module-nav'), panel=document.getElementById('eco-panel');
            if(!k||!nav||!panel)return;
            const deals=ecoDealRows(), activeDeals=deals.filter(d=>!['closed','done'].includes(String(d.stage))).length;
            const activeProps=(Array.isArray(properties)?properties:[]).filter(p=>String(p.status||'available')!=='archived');
            const contacts=[...(Array.isArray(customers)?customers:[]),...(Array.isArray(assistantOwners)?assistantOwners:[])];
            k.innerHTML=[['🏠','فایل‌ها',activeProps.length],['🤝','معاملات',deals.length],['🔥','در جریان',activeDeals],['👥','مخاطبان',contacts.length]].map(x=>`<div class="p-3 rounded-xl bg-slate-900 border border-slate-700"><div class="text-xs text-slate-400">${x[0]} ${x[1]}</div><b class="text-xl">${Number(x[2]).toLocaleString('fa-IR')}</b></div>`).join('');
            const tabs=[['properties','🏠 فهرست املاک'],['deals','🤝 فهرست معاملات'],['contacts','👥 شبکه مخاطبان']];
            nav.innerHTML=tabs.map(([id,label])=>`<button type="button" data-eco-tab="${id}" class="touch-btn p-4 rounded-xl border ${ecoTab===id?'border-fuchsia-400 bg-fuchsia-600/20':'border-slate-700 bg-slate-900'} font-bold">${label}</button>`).join('');
            nav.onclick=e=>{const b=e.target.closest('[data-eco-tab]');if(b){ecoTab=b.dataset.ecoTab;ecoRender()}};
            if(ecoTab==='properties'){
                panel.innerHTML=`<div class="flex items-center justify-between mb-4"><div><h3 class="text-xl font-black">فهرست املاک شبکه</h3><p class="text-xs text-slate-400">همان فایل‌های ثبت‌شده در کیوسک؛ بدون داده ساختگی</p></div><button type="button" onclick="goTo('add')" class="touch-btn px-4 py-2 rounded-xl bg-emerald-600">+ افزودن ملک</button></div>`+
                    (activeProps.length?`<div class="grid md:grid-cols-2 gap-3">${activeProps.slice(0,100).map(p=>`<button type="button" onclick="openDetail(decodeURIComponent('${safeJsArg(p.id)}'));goTo('detail')" class="text-right p-4 rounded-xl bg-slate-900 border border-slate-700 hover:border-fuchsia-400"><div class="flex justify-between gap-2"><b>${escapeHtml(p.title||p.address||'ملک بدون عنوان')}</b><span class="text-xs text-fuchsia-300">${escapeHtml(dealTypeLabel(p.type||'sale'))}</span></div><div class="text-xs text-slate-400 mt-2">${escapeHtml(p.address||p.district||'آدرس ثبت نشده')} · ${Number(p.area||0).toLocaleString('fa-IR')} متر</div><div class="text-sm text-emerald-300 mt-2">${ecoMoney(p.price||p.salePrice||p.rent)}</div></button>`).join('')}</div>`:'<div class="p-6 text-center text-slate-500">هنوز ملکی ثبت نشده است. از «افزودن ملک» یک فایل واقعی ثبت کنید.</div>');
            } else if(ecoTab==='deals'){
                panel.innerHTML=`<div class="flex items-center justify-between mb-4"><div><h3 class="text-xl font-black">فهرست معاملات شبکه</h3><p class="text-xs text-slate-400">معاملات ثبت‌شده در CRM و مرکز عملیات، یکجا نمایش داده می‌شوند</p></div><button type="button" onclick="shirangiProOpen?.()" class="touch-btn px-4 py-2 rounded-xl bg-violet-600">مرکز معاملات</button></div>`+
                    (deals.length?`<div class="space-y-2">${deals.slice(0,100).map(d=>`<div class="p-4 rounded-xl bg-slate-900 border border-slate-700"><div class="flex flex-wrap justify-between gap-2"><b>${escapeHtml(d.title)}</b><span class="text-xs px-2 py-1 rounded-lg bg-slate-800 text-violet-300">${escapeHtml(ecoStage(d.stage))}</span></div><div class="grid md:grid-cols-4 gap-2 mt-2 text-xs text-slate-400"><span>مشتری: ${escapeHtml(d.contact||'—')}</span><span>ملک: ${escapeHtml(d.property||'—')}</span><span>مشاور: ${escapeHtml(d.agent||'—')}</span><span class="text-emerald-300">${ecoMoney(d.value)}</span></div>${d.note?`<div class="text-xs text-slate-500 mt-2">${escapeHtml(d.note)}</div>`:''}</div>`).join('')}</div>`:'<div class="p-6 text-center text-slate-500">هنوز معامله‌ای ثبت نشده است. وقتی معامله/مرحله قیف ثبت شود، اینجا نمایش داده می‌شود.</div>');
            } else {
                panel.innerHTML=`<div class="flex items-center justify-between mb-4"><h3 class="text-xl font-black">شبکه مخاطبان</h3><span class="text-xs text-slate-500">${contacts.length.toLocaleString('fa-IR')} نفر</span></div>`+
                    (contacts.length?`<div class="grid md:grid-cols-2 gap-3">${contacts.slice(0,100).map(c=>`<div class="p-4 rounded-xl bg-slate-900 border border-slate-700"><b>${escapeHtml(c.name||'بدون نام')}</b><div class="text-xs text-slate-400 mt-1">${escapeHtml(c.phone||'بدون تلفن')} · ${escapeHtml(c.customerNumber||c.ownerNumber||'—')}</div></div>`).join('')}</div>`:'<div class="p-6 text-center text-slate-500">هنوز مخاطبی در شبکه ثبت نشده است.</div>');
            }
        }
        function shirangiEcoRefresh(){ ecoRender(); }
        window.shirangiEcoRefresh=shirangiEcoRefresh;

        // ========== NAVIGATION ==========
        function goTo(screen) {
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            const el = document.getElementById('screen-' + screen);
            if (el) el.classList.add('active');

            if (screen !== 'map' && typeof cancelPickLocationMode === 'function') {
                cancelPickLocationMode();
            }
            if (screen === 'map') {
                setTimeout(initMap, 150);
            }
            if (screen === 'list') {
                applyFilters();
            }
            if (screen === 'ecosystem') {
                setTimeout(shirangiEcoRefresh, 0);
            }
            if (screen === 'detail') {
                updateAdminUI();
            }
            if (screen === 'pricing' || screen === 'welcome' || screen === 'admin') {
                updateSubscriptionUI();
            }
            if (screen === 'tools') {
                calcCommission();
                calcConvert();
                calcPricePerMeter();
                calcLoan();
            }
            if (screen === 'customers') {
                renderCustomers();
            }
            if (screen === 'builders') {
                loadBuilders().then(renderBuilders);
            }
            if (screen === 'assistant') {
                renderAssistantCustomers();
                if (assistantSelectedCustomerId) assistantMatchCustomer();
            }
            if (screen !== 'add' && tempLocationMarker && mapInstance) {
                try { mapInstance.removeLayer(tempLocationMarker); } catch (e) {}
                tempLocationMarker = null;
            }
            if (typeof resetIdleTimer === 'function') resetIdleTimer();
        }

        // ========== MAP (سفید + فقط پلاک — بدون Carto و بدون مناطق) ==========
        function toPersianNum(n) {
            return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
        }

        function toEnglishDigits(str) {
            return String(str || '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
        }

        // مراکز تقریبی مناطق ۲۲گانه تهران
        const DISTRICT_CENTERS = {
            'منطقه ۱': [35.8075, 51.4280], 'منطقه ۲': [35.7700, 51.3580], 'منطقه ۳': [35.7580, 51.4320],
            'منطقه ۴': [35.7420, 51.5350], 'منطقه ۵': [35.7380, 51.3050], 'منطقه ۶': [35.7320, 51.4080],
            'منطقه ۷': [35.7280, 51.4380], 'منطقه ۸': [35.7480, 51.5050], 'منطقه ۹': [35.6880, 51.3180],
            'منطقه ۱۰': [35.6830, 51.3720], 'منطقه ۱۱': [35.6980, 51.3980], 'منطقه ۱۲': [35.6720, 51.4220],
            'منطقه ۱۳': [35.7120, 51.4850], 'منطقه ۱۴': [35.6580, 51.4750], 'منطقه ۱۵': [35.6380, 51.4650],
            'منطقه ۱۶': [35.6320, 51.4080], 'منطقه ۱۷': [35.6520, 51.3580], 'منطقه ۱۸': [35.6480, 51.2950],
            'منطقه ۱۹': [35.6180, 51.3780], 'منطقه ۲۰': [35.5850, 51.4350], 'منطقه ۲۱': [35.7020, 51.2480],
            'منطقه ۲۲': [35.7480, 51.1950]
        };

        const NEIGHBORHOOD_TO_DISTRICT = {
            'زعفرانیه': 'منطقه ۱', 'نیاوران': 'منطقه ۱', 'تجریش': 'منطقه ۱', 'ولنجک': 'منطقه ۱', 'فرمانیه': 'منطقه ۱', 'اقدسیه': 'منطقه ۱',
            'سعادت آباد': 'منطقه ۲', 'سعادت‌آباد': 'منطقه ۲', 'پونک': 'منطقه ۲', 'شهرک غرب': 'منطقه ۲', 'گیشا': 'منطقه ۲', 'طرشت': 'منطقه ۲',
            'ونک': 'منطقه ۳', 'پاسداران': 'منطقه ۳', 'جردن': 'منطقه ۳', 'دولت': 'منطقه ۳',
            'تهرانپارس': 'منطقه ۴', 'حکیمیه': 'منطقه ۴', 'لویزان': 'منطقه ۴', 'هروی': 'منطقه ۴',
            'اکباتان': 'منطقه ۵', 'جنت آباد': 'منطقه ۵', 'جنت‌آباد': 'منطقه ۵', 'آپادانا': 'منطقه ۵', 'کن': 'منطقه ۵',
            'یوسف آباد': 'منطقه ۶', 'یوسف‌آباد': 'منطقه ۶', 'آرژانتین': 'منطقه ۶', 'امیرآباد': 'منطقه ۶',
            'سهروردی': 'منطقه ۷', 'بهار': 'منطقه ۷', 'مطهری': 'منطقه ۷', 'شریعتی': 'منطقه ۷',
            'نارمک': 'منطقه ۸', 'تهران نو': 'منطقه ۸',
            'مهرآباد': 'منطقه ۹',
            'جیحون': 'منطقه ۱۰', 'آزادی': 'منطقه ۱۰', 'کارگر': 'منطقه ۱۰',
            'انقلاب': 'منطقه ۱۱', 'جمهوری': 'منطقه ۱۱', 'ولیعصر': 'منطقه ۱۱',
            'بازار': 'منطقه ۱۲', 'بهارستان': 'منطقه ۱۲', 'فردوسی': 'منطقه ۱۲',
            'پیروزی': 'منطقه ۱۳', 'نیروی هوایی': 'منطقه ۱۳',
            'افسریه': 'منطقه ۱۴', 'نبرد': 'منطقه ۱۴',
            'مشیریه': 'منطقه ۱۵', 'کیانشهر': 'منطقه ۱۵',
            'نازی آباد': 'منطقه ۱۶', 'نازی‌آباد': 'منطقه ۱۶', 'جوادیه': 'منطقه ۱۶',
            'آذری': 'منطقه ۱۷', 'قزوین': 'منطقه ۱۷',
            'یافت آباد': 'منطقه ۱۸', 'یافت‌آباد': 'منطقه ۱۸', 'شهران': 'منطقه ۱۸',
            'نعمت آباد': 'منطقه ۱۹', 'نعمت‌آباد': 'منطقه ۱۹',
            'شهرری': 'منطقه ۲۰', 'ری': 'منطقه ۲۰',
            'تهرانسر': 'منطقه ۲۱', 'وردآورد': 'منطقه ۲۱',
            'چیتگر': 'منطقه ۲۲', 'دهکده المپیک': 'منطقه ۲۲', 'دریاچه': 'منطقه ۲۲', 'آزادشهر': 'منطقه ۲۲'
        };

        function normalizeSearchQuery(q) {
            return toEnglishDigits(String(q || '').trim())
                .replace(/\s+/g, ' ')
                .toLowerCase()
                .replace(/ي/g, 'ی')
                .replace(/ك/g, 'ک');
        }

        function resolveDistrictFromQuery(raw) {
            const q = normalizeSearchQuery(raw);
            if (!q) return null;
            const numMatch = q.match(/(?:منطقه\s*)?(\d{1,2})$/) || q.match(/^(\d{1,2})$/);
            if (numMatch) {
                const n = parseInt(numMatch[1], 10);
                if (n >= 1 && n <= 22) return 'منطقه ' + toPersianNum(n);
            }
            const faMatch = String(raw || '').match(/منطقه\s*([۰-۹1-9]{1,2})/);
            if (faMatch) {
                const n = parseInt(toEnglishDigits(faMatch[1]), 10);
                if (n >= 1 && n <= 22) return 'منطقه ' + toPersianNum(n);
            }
            for (let i = 1; i <= 22; i++) {
                const name = 'منطقه ' + toPersianNum(i);
                if (normalizeSearchQuery(name).includes(q) || q.includes(normalizeSearchQuery(name))) return name;
            }
            for (const [neigh, dist] of Object.entries(NEIGHBORHOOD_TO_DISTRICT)) {
                const nn = normalizeSearchQuery(neigh);
                if (nn.includes(q) || q.includes(nn)) return dist;
            }
            return null;
        }

        function getMapSearchSuggestions(raw) {
            const q = normalizeSearchQuery(raw);
            if (!q || q.length < 1) return [];
            const out = [];
            const seen = new Set();
            const isNumericQuery = /^\d+$/.test(q); // فقط عدد (انگلیسی یا فارسی تبدیل‌شده)

            // ۱) اگر کوئری عددی باشه، اول پلاک‌های دقیق و نزدیک رو بیار
            if (isNumericQuery || q.length >= 1) {
                // اول تطابق دقیق پلاک
                properties.forEach(p => {
                    const pl = normalizeSearchQuery(p.plaque);
                    if (pl === q) {
                        const key = 'p' + p.id;
                        if (!seen.has(key)) {
                            seen.add(key);
                            out.push({ label: 'پلاک ' + p.plaque + ' — ' + p.title, district: p.district, propId: p.id, count: 1, type: 'property' });
                        }
                    }
                });
                // بعد پلاک‌هایی که با این عدد شروع می‌شن یا شاملش هستن
                if (q.length >= 1) {
                    properties.forEach(p => {
                        const pl = normalizeSearchQuery(p.plaque);
                        if (pl !== q && (pl.startsWith(q) || pl.includes(q))) {
                            const key = 'p' + p.id;
                            if (!seen.has(key) && out.length < 8) {
                                seen.add(key);
                                out.push({ label: 'پلاک ' + p.plaque + ' — ' + p.title, district: p.district, propId: p.id, count: 1, type: 'property' });
                            }
                        }
                    });
                }
            }

            // ۲) مناطق
            for (let i = 1; i <= 22; i++) {
                const name = 'منطقه ' + toPersianNum(i);
                if (normalizeSearchQuery(name).includes(q) || String(i) === q || toPersianNum(i) === String(raw).trim()) {
                    if (!seen.has(name)) {
                        seen.add(name);
                        out.push({ label: name, district: name, count: properties.filter(p => p.district === name).length, type: 'district' });
                    }
                }
            }

            // ۳) محله‌ها
            for (const [neigh, dist] of Object.entries(NEIGHBORHOOD_TO_DISTRICT)) {
                const nn = normalizeSearchQuery(neigh);
                if (nn.includes(q) || q.includes(nn)) {
                    const key = dist + '|' + neigh;
                    if (!seen.has(key)) {
                        seen.add(key);
                        out.push({ label: neigh + ' ← ' + dist, district: dist, count: properties.filter(p => p.district === dist).length, type: 'neighborhood' });
                    }
                }
            }

            // ۴) بقیه املاک (عنوان/آدرس) اگر هنوز جا باشه
            if (q.length >= 2) {
                properties.forEach(p => {
                    const hay = normalizeSearchQuery([p.title, p.address, p.district].join(' '));
                    if (hay.includes(q) && out.length < 12) {
                        const key = 'p' + p.id;
                        if (!seen.has(key)) {
                            seen.add(key);
                            out.push({ label: 'پلاک ' + p.plaque + ' — ' + p.title, district: p.district, propId: p.id, count: 1, type: 'property' });
                        }
                    }
                });
            }
            return out.slice(0, 10);
        }

        function onMapSearchInput() {
            const input = document.getElementById('map-search-input');
            const box = document.getElementById('map-search-results');
            const clearBtn = document.getElementById('map-search-clear');
            if (!input || !box) return;
            const q = input.value.trim();
            if (clearBtn) clearBtn.classList.toggle('hidden', !q);
            if (!q) {
                box.classList.add('hidden');
                box.innerHTML = '';
                hideMapSearchStatus();
                return;
            }
            const suggestions = getMapSearchSuggestions(q);
            if (!suggestions.length) {
                box.innerHTML = '<div class="px-4 py-3 text-slate-400 text-sm text-center">نتیجه‌ای یافت نشد</div>';
                box.classList.remove('hidden');
                return;
            }
            box.innerHTML = suggestions.map((s, idx) => {
                if (s.type === 'property') {
                    return '<button type="button" data-sidx="' + idx + '" class="map-sugg-btn w-full text-right px-4 py-3 hover:bg-slate-700/80 border-b border-slate-700/50 flex items-center justify-between gap-2"><span class="text-sm text-white truncate"><i class="fas fa-home text-primary-400 ml-2"></i>' + escapeHtml(s.label) + '</span></button>';
                }
                return '<button type="button" data-sidx="' + idx + '" class="map-sugg-btn w-full text-right px-4 py-3 hover:bg-slate-700/80 border-b border-slate-700/50 flex items-center justify-between gap-2"><span class="text-sm text-white"><i class="fas fa-map-marker-alt text-amber-400 ml-2"></i>' + escapeHtml(s.label) + '</span><span class="text-xs text-slate-400 shrink-0">' + toPersianNum(s.count) + ' ملک</span></button>';
            }).join('');
            box._suggestions = suggestions;
            box.querySelectorAll('.map-sugg-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.getAttribute('data-sidx'), 10);
                    const item = box._suggestions[idx];
                    if (item) selectMapSearchResult(item);
                });
            });
            box.classList.remove('hidden');
        }

        function selectMapSearchResult(s) {
            const input = document.getElementById('map-search-input');
            const box = document.getElementById('map-search-results');
            if (box) { box.classList.add('hidden'); box.innerHTML = ''; }
            if (s.type === 'property' && s.propId) {
                if (input) input.value = s.label;
                flyToProperty(s.propId);
                return;
            }
            if (input) input.value = s.type === 'neighborhood' ? s.label.split(' ← ')[0] : s.district;
            if (s.type === 'neighborhood') {
                flyToNeighborhood(s.label.split(' ← ')[0], s.district);
            } else {
                flyToDistrict(s.district);
            }
        }

        function runMapDistrictSearch() {
            const input = document.getElementById('map-search-input');
            const box = document.getElementById('map-search-results');
            if (box) box.classList.add('hidden');
            if (!input) return;
            const q = input.value.trim();
            if (!q) return;

            // ابتدا محله را پیدا کن تا نقشه دقیقاً روی همان محدوده برود، نه صرفاً مرکز منطقه.
            const nq = normalizeSearchQuery(q);
            for (const [neigh, dist] of Object.entries(NEIGHBORHOOD_TO_DISTRICT)) {
                const nn = normalizeSearchQuery(neigh);
                if (nn === nq || nn.includes(nq) || nq.includes(nn)) {
                    flyToNeighborhood(neigh, dist);
                    return;
                }
            }

            const district = resolveDistrictFromQuery(q);
            if (district) { flyToDistrict(district); return; }
            const qn = normalizeSearchQuery(q);
            const prop = properties.find(p =>
                normalizeSearchQuery(p.plaque) === qn ||
                normalizeSearchQuery(p.title).includes(qn) ||
                normalizeSearchQuery(p.address).includes(qn)
            );
            if (prop) { flyToProperty(prop.id); return; }
            showMapSearchStatus('منطقه‌ای با این نام پیدا نشد. مثلاً «۵» یا «سعادت‌آباد» را امتحان کنید.', true);
        }

        function clearMapSearch() {
            const input = document.getElementById('map-search-input');
            const box = document.getElementById('map-search-results');
            const clearBtn = document.getElementById('map-search-clear');
            if (input) input.value = '';
            if (box) { box.classList.add('hidden'); box.innerHTML = ''; }
            if (clearBtn) clearBtn.classList.add('hidden');
            hideMapSearchStatus();
            if (mapInstance && propertyMarkers.length) {
                propertyMarkers.forEach(({ marker }) => {
                    if (!mapInstance.hasLayer(marker)) marker.addTo(mapInstance);
                    marker.setOpacity(1);
                });
                try {
                    const group = L.featureGroup(propertyMarkers.map(pm => pm.marker));
                    mapInstance.fitBounds(group.getBounds().pad(0.15), { maxZoom: 14 });
                } catch (e) {}
            }
        }

        function showMapSearchStatus(msg, isError) {
            const el = document.getElementById('map-search-status');
            if (!el) return;
            el.textContent = msg;
            el.classList.remove('hidden');
            el.className = 'mt-2 text-center text-sm rounded-xl px-3 py-1.5 ' + (isError ? 'text-red-200 bg-red-900/80' : 'text-white/90 bg-slate-900/80');
            clearTimeout(showMapSearchStatus._t);
            showMapSearchStatus._t = setTimeout(hideMapSearchStatus, 4000);
        }
        function hideMapSearchStatus() {
            const el = document.getElementById('map-search-status');
            if (el) el.classList.add('hidden');
        }

        function flyToNeighborhood(neighborhood, districtName) {
            if (!mapInstance) {
                initMap();
                setTimeout(() => flyToNeighborhood(neighborhood, districtName), 300);
                return;
            }

            const nq = normalizeSearchQuery(neighborhood);
            const matched = properties.filter(p => {
                const hay = normalizeSearchQuery([p.title, p.address].join(' '));
                return p.district === districtName && hay.includes(nq);
            });

            // فقط پلاک‌های همان محله را برجسته کن.
            propertyMarkers.forEach(({ marker, prop }) => {
                const isMatch = matched.some(p => p.id === prop.id);
                if (isMatch) {
                    if (!mapInstance.hasLayer(marker)) marker.addTo(mapInstance);
                    marker.setOpacity(1);
                    marker.setZIndexOffset(3000);
                } else {
                    marker.setOpacity(0.18);
                    marker.setZIndexOffset(100);
                }
            });

            if (matched.length) {
                const markers = propertyMarkers.filter(pm => matched.some(p => p.id === pm.prop.id)).map(pm => pm.marker);
                try {
                    const group = L.featureGroup(markers);
                    // فیت روی خودِ نتایج محله؛ بنابراین نقشه دقیقاً همان محدوده را نشان می‌دهد.
                    mapInstance.fitBounds(group.getBounds().pad(0.35), { maxZoom: 16, animate: true });
                } catch (e) {
                    const first = matched.find(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
                    if (first) mapInstance.flyTo([first.lat, first.lng], 15, { duration: 0.8 });
                    else flyToDistrict(districtName);
                }
                showMapSearchStatus(neighborhood + ' — ' + toPersianNum(matched.length) + ' ملک', false);
                return;
            }

            // اگر برای محله ملکی ثبت نشده، حداقل مرکز منطقه مربوطه نمایش داده شود.
            const c = DISTRICT_CENTERS[districtName];
            if (c) mapInstance.flyTo(c, 14, { duration: 0.8 });
            showMapSearchStatus(neighborhood + ' — مختصات دقیق ثبت نشده؛ محدوده منطقه نمایش داده شد', false);
        }

        function flyToDistrict(districtName) {
            if (!mapInstance) {
                initMap();
                setTimeout(() => flyToDistrict(districtName), 300);
                return;
            }
            const matched = properties.filter(p => p.district === districtName);
            propertyMarkers.forEach(({ marker, prop }) => {
                if (prop.district === districtName) {
                    if (!mapInstance.hasLayer(marker)) marker.addTo(mapInstance);
                    marker.setOpacity(1);
                    marker.setZIndexOffset(2000);
                } else {
                    marker.setOpacity(0.25);
                    marker.setZIndexOffset(100);
                }
            });
            if (matched.length) {
                const markers = propertyMarkers.filter(pm => pm.prop.district === districtName).map(pm => pm.marker);
                try {
                    const group = L.featureGroup(markers);
                    mapInstance.fitBounds(group.getBounds().pad(0.25), { maxZoom: 15, animate: true });
                } catch (e) {
                    const c = DISTRICT_CENTERS[districtName];
                    if (c) mapInstance.flyTo(c, 14, { duration: 0.8 });
                }
                showMapSearchStatus(districtName + ' — ' + toPersianNum(matched.length) + ' ملک', false);
            } else {
                const c = DISTRICT_CENTERS[districtName];
                if (c) {
                    mapInstance.flyTo(c, 13, { duration: 0.8 });
                    showMapSearchStatus(districtName + ' — ملکی ثبت نشده، مرکز منطقه نمایش داده شد', false);
                } else {
                    showMapSearchStatus('منطقه یافت نشد', true);
                }
            }
        }

        function flyToProperty(id) {
            if (!mapInstance) {
                initMap();
                setTimeout(() => flyToProperty(id), 300);
                return;
            }
            const p = properties.find(x => String(x.id) === String(id));
            if (!p) return;
            propertyMarkers.forEach(({ marker, prop }) => {
                if (String(prop.id) === String(id)) {
                    if (!mapInstance.hasLayer(marker)) marker.addTo(mapInstance);
                    marker.setOpacity(1);
                    marker.setZIndexOffset(3000);
                } else {
                    marker.setOpacity(0.3);
                    marker.setZIndexOffset(100);
                }
            });
            mapInstance.flyTo([p.lat, p.lng], 16, { duration: 0.7 });
            const pm = propertyMarkers.find(m => String(m.prop.id) === String(id));
            if (pm) setTimeout(() => pm.marker.openPopup(), 750);
            showMapSearchStatus('پلاک ' + p.plaque + ' — ' + p.title, false);
        }

        function makePlaqueIcon(p, zoomLevel) {
            const typeClass = plaqueTypeClass(p);
            let fontSize, h, minW, iconW, iconH;
            // پلاک‌ها در همه زوم‌ها بزرگ و خوانا
            if (zoomLevel >= 17) {
                fontSize = 20; h = 32; minW = 48; iconW = 100; iconH = 56;
            } else if (zoomLevel >= 15) {
                fontSize = 18; h = 28; minW = 42; iconW = 88; iconH = 52;
            } else if (zoomLevel >= 13) {
                fontSize = 16; h = 26; minW = 38; iconW = 76; iconH = 48;
            } else if (zoomLevel >= 11) {
                fontSize = 15; h = 24; minW = 34; iconW = 68; iconH = 46;
            } else {
                fontSize = 14; h = 22; minW = 30; iconW = 58; iconH = 44;
            }
            const digits = String(p.plaque).replace(/[^\d۰-۹]/g, '').length || 2;
            const extra = Math.max(0, digits - 2) * (fontSize * 0.55);
            const plateW = Math.round(minW + extra);
            iconW = Math.max(iconW, plateW + 10);
            return L.divIcon({
                className: 'plaque-marker',
                html: `<div class="plaque-badge ${typeClass}" data-id="${p.id}" style="${(p.status==='sold')?'opacity:0.45;':(p.status==='reserved'?'opacity:0.85;':'')}">
                    <span class="file-num" style="font-size:${Math.max(11, fontSize-4)}px;line-height:16px;display:block;font-weight:900;">#${toPersianNum(Number(p.fileNumber) || Number(p.id) || '')}</span>
                    <span class="num" style="font-size:${fontSize}px;height:${h}px;min-width:${plateW}px;padding:0 ${Math.round(fontSize*0.4)}px">${escapeHtml(p.plaque)}</span>
                </div>`,
                iconSize: [iconW, iconH],
                iconAnchor: [iconW / 2, iconH / 2],
                popupAnchor: [0, -iconH / 2 - 4]
            });
        }

        function updatePlaqueVisibility() {
            if (!mapInstance) return;
            const z = mapInstance.getZoom();
            propertyMarkers.forEach(({ marker, prop }) => {
                marker.setIcon(makePlaqueIcon(prop, z));
            });
        }

        function addMarkerForProperty(p) {
            if (!mapInstance) return;
            const m = L.marker([p.lat, p.lng], {
                icon: makePlaqueIcon(p, mapInstance.getZoom()),
                zIndexOffset: 1000,
                riseOnHover: true
            }).addTo(mapInstance);

            m.on('click', () => openDetail(p.id));

            m.bindPopup(`
                <div style="direction:rtl;text-align:right;min-width:200px;font-family:Vazirmatn,Tahoma;">
                    <div style="margin-bottom:6px;"><span style="background:#f59e0b;color:#0f172a;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:bold;">پلاک ${escapeHtml(p.plaque)}</span></div>
                    <strong style="font-size:15px;">${escapeHtml(p.title)}</strong><br>
                    <span style="color:#64748b;font-size:12px;">${escapeHtml(p.address)}</span><br>
                    <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center;">
                        <b>${escapeHtml(p.price)}</b>
                        <span style="background:#e2e8f0;color:#0f172a;padding:2px 8px;border-radius:999px;font-size:11px;margin-left:4px;">${categoryLabel(p.category||'residential')}</span>
                        <span style="background:${p.type==='sale'?'#dcfce7':(p.type==='rent'?'#dbeafe':'#fef3c7')};color:${p.type==='sale'?'#166534':(p.type==='rent'?'#1e40af':'#92400e')};padding:2px 10px;border-radius:999px;font-size:12px;">${dealTypeLabel(p.type)}</span>
                    </div>
                    <button onclick="openDetail(decodeJsArg('${safeJsArg(p.id)}'))" style="margin-top:12px;width:100%;padding:10px;background:#2563eb;color:white;border:none;border-radius:10px;font-size:14px;font-weight:bold;cursor:pointer;">
                        مشاهده جزئیات
                    </button>
                </div>
            `);

            propertyMarkers.push({ marker: m, prop: p });
        }

        function clearLongPress() {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            longPressStartLatLng = null;
            longPressStartXY = null;
            longPressMoved = false;
        }

        function showTempPin(latlng) {
            if (!mapInstance) return;
            if (tempLocationMarker) {
                mapInstance.removeLayer(tempLocationMarker);
            }
            tempLocationMarker = L.circleMarker(latlng, {
                radius: 14,
                color: '#22c55e',
                fillColor: '#4ade80',
                fillOpacity: 0.9,
                weight: 3
            }).addTo(mapInstance);
            tempLocationMarker.bindPopup('<div style="direction:rtl;font-family:Vazirmatn,Tahoma;text-align:center;font-weight:bold;">موقعیت انتخاب‌شده<br><span style="font-size:12px;color:#64748b;">در حال باز کردن فرم…</span></div>').openPopup();
        }

        function clearImagePreviews() {
            ['preview-facade', 'preview-alley', 'preview-plan', 'preview-unit'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = '';
            });
        }

        function openAddBlank() {
            if (!requireSubscriptionForAdd()) return;
            goTo('add');
            document.getElementById('add-property-form').reset();
            document.getElementById('f-edit-id').value = '';
            window._editKeepImages = null;
            const title = document.getElementById('add-screen-title');
            const sub = document.getElementById('add-screen-sub');
            if (title) title.textContent = 'افزودن ملک جدید';
            if (sub) sub.textContent = 'مشخصات و عکس را وارد کنید';
            fillAgentSelect(agents[0] ? agents[0].name : 'مهندس شیرنگی');
            document.getElementById('f-lat').value = '';
            document.getElementById('f-lng').value = '';
            clearImagePreviews();
        }

        function openAddAtLocation(lat, lng) {
            if (!requireSubscriptionForAdd()) return;
            goTo('add');
                document.getElementById('add-property-form').reset();
                document.getElementById('f-edit-id').value = '';
                window._editKeepImages = null;
                const title = document.getElementById('add-screen-title');
                const sub = document.getElementById('add-screen-sub');
                if (title) title.textContent = 'افزودن ملک جدید';
                if (sub) sub.textContent = 'موقعیت از نقشه انتخاب شد';
                fillAgentSelect(agents[0] ? agents[0].name : 'مهندس شیرنگی');
                document.getElementById('f-lat').value = Number(lat).toFixed(6);
                document.getElementById('f-lng').value = Number(lng).toFixed(6);
                clearImagePreviews();
            setTimeout(() => {
                const latEl = document.getElementById('f-lat');
                if (latEl) latEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 200);
        }

        function onMapLongPress(latlng) {
            if (!latlng) return;
            // افزودن دستی روی نقشه برای کاربر مجاز به ثبت فایل آزاد است؛
            // حذف فایل همچنان فقط از مسیر requireAdmin انجام می‌شود.
            if (navigator.vibrate) {
                try { navigator.vibrate(40); } catch (e) {}
            }
            cancelPickLocationMode();
            showTempPin(latlng);
            openAddAtLocation(latlng.lat, latlng.lng);
        }

        function startPickLocationMode() {
            if (!requireSubscriptionForAdd()) return;
            // انتخاب نقطه و افزودن دستی ملک روی نقشه دیگر نیاز به رمز ادمین ندارد.
            pickLocationMode = true;
            const banner = document.getElementById('map-pick-banner');
            const btn = document.getElementById('btn-pick-location');
            if (banner) banner.classList.remove('hidden');
            if (btn) {
                btn.classList.add('ring-4', 'ring-green-300');
                btn.innerHTML = '<i class="fas fa-hand-pointer"></i> منتظر لمس نقشه…';
            }
            if (mapInstance && mapInstance.getContainer()) {
                mapInstance.getContainer().style.cursor = 'crosshair';
            }
        }

        function cancelPickLocationMode() {
            pickLocationMode = false;
            const banner = document.getElementById('map-pick-banner');
            const btn = document.getElementById('btn-pick-location');
            if (banner) banner.classList.add('hidden');
            if (btn) {
                btn.classList.remove('ring-4', 'ring-green-300');
                btn.innerHTML = '<i class="fas fa-plus-circle"></i> افزودن روی نقشه';
            }
            if (mapInstance && mapInstance.getContainer()) {
                mapInstance.getContainer().style.cursor = '';
            }
        }

        function clientPointFromEvent(e) {
            if (e.touches && e.touches.length) {
                return { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
            if (e.changedTouches && e.changedTouches.length) {
                return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
            }
            return { x: e.clientX, y: e.clientY };
        }

        function latLngFromClientPoint(mapEl, clientX, clientY) {
            const rect = mapEl.getBoundingClientRect();
            const x = clientX - rect.left;
            const y = clientY - rect.top;
            return mapInstance.containerPointToLatLng(L.point(x, y));
        }

        function isIgnoredLongPressTarget(t) {
            if (!t || !t.closest) return false;
            return !!(
                t.closest('.leaflet-control') ||
                t.closest('.leaflet-popup') ||
                t.closest('.plaque-badge') ||
                t.closest('.leaflet-marker-icon') ||
                t.closest('.leaflet-control-zoom') ||
                t.closest('#btn-pick-location') ||
                t.closest('#map-pick-banner') ||
                t.closest('#map-search-input') ||
                t.closest('#map-search-results')
            );
        }

        function setupMapLongPress() {
            if (!mapInstance || longPressSetupDone) return;
            longPressSetupDone = true;
            const mapEl = mapInstance.getContainer();
            let pressActive = false;
            let pressPointerId = null;

            function endPress() {
                clearLongPress();
                pressActive = false;
                pressPointerId = null;
            }

            // رویداد رسمی Leaflet: راست‌کلیک و long-press در بسیاری از موبایل‌ها
            mapInstance.on('contextmenu', (e) => {
                if (e.originalEvent) {
                    e.originalEvent.preventDefault();
                    e.originalEvent.stopPropagation();
                }
                if (e.latlng) onMapLongPress(e.latlng);
            });

            // حالت «افزودن روی نقشه»: یک لمس ساده روی نقطه
            mapInstance.on('click', (e) => {
                if (!pickLocationMode) return;
                if (!e.latlng) return;
                onMapLongPress(e.latlng);
            });

            // جلوگیری از منوی مرورگر
            mapEl.addEventListener('contextmenu', (e) => {
                e.preventDefault();
            }, { capture: true });

            function onPressStart(e) {
                if (pickLocationMode) return; // در حالت انتخاب نقطه، click کافی است
                if (isIgnoredLongPressTarget(e.target)) return;
                if (e.touches && e.touches.length > 1) return;
                if (e.type === 'mousedown' && e.button !== 0) return;
                if (e.type === 'pointerdown' && e.button !== 0 && e.pointerType === 'mouse') return;

                endPress();
                pressActive = true;
                longPressMoved = false;
                if (e.pointerId != null) pressPointerId = e.pointerId;
                const pt = clientPointFromEvent(e);
                longPressStartXY = pt;
                try {
                    longPressStartLatLng = latLngFromClientPoint(mapEl, pt.x, pt.y);
                } catch (err) {
                    longPressStartLatLng = null;
                }

                longPressTimer = setTimeout(() => {
                    if (!longPressMoved && longPressStartLatLng && pressActive) {
                        const ll = longPressStartLatLng;
                        // نقشه در حال drag نباشد
                        try {
                            if (mapInstance.dragging && mapInstance.dragging.enabled()) {
                                mapInstance.dragging.disable();
                                setTimeout(() => {
                                    try { mapInstance.dragging.enable(); } catch (e2) {}
                                }, 300);
                            }
                        } catch (err) {}
                        endPress();
                        onMapLongPress(ll);
                    } else {
                        endPress();
                    }
                }, LONG_PRESS_MS);
            }

            function onPressMove(e) {
                if (!pressActive || !longPressStartXY) return;
                if (pressPointerId != null && e.pointerId != null && e.pointerId !== pressPointerId) return;
                const pt = clientPointFromEvent(e);
                if (!pt) return;
                const dx = Math.abs(pt.x - longPressStartXY.x);
                const dy = Math.abs(pt.y - longPressStartXY.y);
                if (dx > LONG_PRESS_MOVE_PX || dy > LONG_PRESS_MOVE_PX) {
                    longPressMoved = true;
                    endPress();
                }
            }

            function onPressEnd() {
                endPress();
            }

            // Pointer Events (قابل‌اعتمادتر روی کیوسک/تبلت)
            if (window.PointerEvent) {
                mapEl.addEventListener('pointerdown', onPressStart, { capture: true });
                mapEl.addEventListener('pointermove', onPressMove, { capture: true });
                mapEl.addEventListener('pointerup', onPressEnd, { capture: true });
                mapEl.addEventListener('pointercancel', onPressEnd, { capture: true });
            } else {
                mapEl.addEventListener('touchstart', onPressStart, { passive: true, capture: true });
                mapEl.addEventListener('touchmove', onPressMove, { passive: true, capture: true });
                mapEl.addEventListener('touchend', onPressEnd, { capture: true });
                mapEl.addEventListener('touchcancel', onPressEnd, { capture: true });
                mapEl.addEventListener('mousedown', onPressStart, { capture: true });
                mapEl.addEventListener('mousemove', onPressMove, { capture: true });
                mapEl.addEventListener('mouseup', onPressEnd, { capture: true });
            }

            mapInstance.on('dragstart movestart zoomstart', () => {
                if (pressActive) {
                    longPressMoved = true;
                    endPress();
                }
            });
        }

        window.startPickLocationMode = startPickLocationMode;
        window.cancelPickLocationMode = cancelPickLocationMode;

        function initMap() {
            if (mapInstance) {
                mapInstance.invalidateSize();
                return;
            }

            mapInstance = L.map('map', {
                zoomControl: false,
                preferCanvas: true,
                dragging: true,
                tap: true,
                touchZoom: true,
                doubleClickZoom: true,
                scrollWheelZoom: true,
                boxZoom: true,
                keyboard: true
            }).setView([35.7200, 51.4000], 11);
            window.__shirangiMapInstance = mapInstance;

            // تحمل بیشتر حرکت انگشت قبل از شروع drag (کمک به long-press روی کیوسک لمسی)
            try {
                if (mapInstance.dragging && mapInstance.dragging._draggable) {
                    mapInstance.dragging._draggable.options.clickTolerance = 25;
                }
            } catch (e) {}

            L.control.zoom({ position: 'bottomright' }).addTo(mapInstance);

            // لایه برای رسم محدوده جستجو — اگر افزونه Draw در WebView در دسترس نبود،
            // نباید کل نقشه از کار بیفتد؛ خود نقشه و پلاک‌ها مستقل اجرا می‌شوند.
            window.drawnItems = new L.FeatureGroup();
            mapInstance.addLayer(window.drawnItems);
            if (L.Control && L.Control.Draw && L.Draw && L.Draw.Event) {
                try {
                    window.drawControl = new L.Control.Draw({
                        position: 'topleft',
                        draw: {
                            polygon: { allowIntersection: false, showArea: true, shapeOptions: { color: '#0ea5e9', weight: 3, fillOpacity: 0.15 } },
                            polyline: false,
                            rectangle: { shapeOptions: { color: '#0ea5e9', weight: 3, fillOpacity: 0.15 } },
                            circle: false, marker: false, circlemarker: false
                        },
                        edit: { featureGroup: window.drawnItems, remove: true }
                    });
                    mapInstance.addControl(window.drawControl);
                    mapInstance.on(L.Draw.Event.CREATED, function (e) {
                        window.drawnItems.clearLayers(); window.drawnItems.addLayer(e.layer); window.searchPolygon = e.layer; applyPolygonFilter();
                    });
                    mapInstance.on(L.Draw.Event.DELETED, function () { window.searchPolygon = null; applyPolygonFilter(); });
                    mapInstance.on(L.Draw.Event.EDITED, function () { applyPolygonFilter(); });
                } catch (drawError) {
                    console.warn('[Shirangi] Leaflet Draw unavailable; continuing without drawing controls.', drawError);
                    window.drawControl = null;
                }
            } else {
                console.warn('[Shirangi] Leaflet Draw runtime not available; continuing with map only.');
                window.drawControl = null;
            }

            // لایه پایه رسمی OpenStreetMap؛ نام لایه و برند پروژه صریحاً ثبت می‌شود.
            const shirangiBaseLayer = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Sources: Esri, HERE, Garmin, (c) OpenStreetMap contributors, and the GIS User Community · Shirangi',
                maxZoom: 19,
                minZoom: 10,
                crossOrigin: true
            });
            shirangiBaseLayer.options.shirangiLayerName = 'Shirangi — نقشه پایه';
            shirangiBaseLayer.addTo(mapInstance);
            // در محیط‌های آفلاین/قدیمی، خطای Tile نباید نقشه را سفید و شکسته نشان دهد.
            // یک پس‌زمینه محلی موقت نمایش می‌دهیم تا پلاک‌ها و ابزارهای نقشه همچنان قابل استفاده باشند.
            let fallbackShown = false;
            const showMapFallback = () => {
                if (fallbackShown || !mapInstance) return;
                fallbackShown = true;
                try {
                    if (!window.SHIRANGI_MAP_LAYERS) window.SHIRANGI_MAP_LAYERS = {};
                    const bounds = [[35.45, 51.05], [35.98, 51.85]];
                    const fallback = L.imageOverlay('./vendor/runtime/map-placeholder.svg', bounds, { opacity: 0.95, interactive: false });
                    fallback.options.shirangiLayerName = 'Shirangi — پس‌زمینه موقت تا اتصال نقشه شهرداری';
                    fallback.addTo(mapInstance);
                    window.SHIRANGI_MAP_LAYERS.fallback = fallback;
                } catch (fallbackError) {
                    console.warn('[Shirangi] local map fallback failed', fallbackError);
                }
            };
            shirangiBaseLayer.on('tileerror', showMapFallback);
            setTimeout(() => {
                const tiles = mapInstance.getContainer().querySelectorAll('.leaflet-tile');
                if (!tiles.length || !Array.from(tiles).some(t => t.complete && t.naturalWidth > 0)) showMapFallback();
            }, 2200);

            // لایه تصویری شخص ثالث عمداً از بسته حذف شده است تا مالکیت/مجوز داده مبهم وارد محصول نشود.
            // داده‌های شهرداری فقط از منبع رسمی و مجاز در آداپتور Shirangi Municipal Plaque Layer وارد می‌شوند.
            window.SHIRANGI_MAP_LAYERS = window.SHIRANGI_MAP_LAYERS || {};
            window.SHIRANGI_MAP_LAYERS.base = shirangiBaseLayer;
            window.SHIRANGI_MAP_LAYERS.search = window.drawnItems;
            if (window.drawnItems) window.drawnItems.options.shirangiLayerName = 'Shirangi — محدوده جستجو';

            propertyMarkers = [];
            properties.forEach(p => addMarkerForProperty(p));

            let plaqueZoomTimer = null;
            let lastPlaqueZoomBand = -1;
            mapInstance.on('zoomend', function() {
                if (plaqueZoomTimer) clearTimeout(plaqueZoomTimer);
                plaqueZoomTimer = setTimeout(function() {
                    const z = mapInstance.getZoom();
                    const band = z >= 17 ? 4 : (z >= 15 ? 3 : (z >= 13 ? 2 : (z >= 11 ? 1 : 0)));
                    if (band !== lastPlaqueZoomBand) {
                        lastPlaqueZoomBand = band;
                        updatePlaqueVisibility();
                    }
                }, 80);
            });
            updatePlaqueVisibility();
            setupMapLongPress();

            if (propertyMarkers.length) {
                const group = L.featureGroup(propertyMarkers.map(pm => pm.marker));
                try {
                    mapInstance.fitBounds(group.getBounds().pad(0.15), { maxZoom: 14 });
                } catch (e) {}
            }
        }

        // ========== LIST ==========
        function renderList(list = properties) {
            currentList = list;
            const grid = document.getElementById('property-grid');
            if (!list.length) {
                grid.innerHTML = '<div class="col-span-full text-center py-20 text-slate-400 text-xl">ملکی در این منطقه ثبت نشده</div>';
                return;
            }
            grid.innerHTML = list.map(p => {
                const st = p.status || 'available';
                const stLabel = st === 'reserved' ? 'رزرو' : (st === 'sold' ? 'فروخته' : (st === 'archived' ? 'بایگانی' : 'موجود'));
                const stCls = st === 'reserved' ? 'bg-amber-500 text-slate-900' : (st === 'sold' ? 'bg-slate-500' : (st === 'archived' ? 'bg-violet-600' : 'bg-emerald-600'));
                const opacity = (st === 'sold' || st === 'archived') ? 'opacity-75' : '';
                return `
                <div onclick="openDetail(decodeJsArg('${safeJsArg(p.id)}'))" class="prop-card bg-slate-800 rounded-2xl overflow-hidden cursor-pointer border border-slate-700 hover:border-primary-500 transition-all shadow-lg ${opacity}">
                    <div class="h-48 relative">
                        <img src="${safeImageSrc((p.images?.unit && p.images.unit[0]) || (p.images?.facade && p.images.facade[0]) || '')}" class="w-full h-full object-cover" alt="">
                        <span class="absolute top-3 right-3 px-3 py-1 rounded-full text-sm font-medium ${dealTypeClass(p.type)}">
                            ${dealTypeLabel(p.type)}
                        </span>
                        <span class="absolute top-12 right-3 px-3 py-1 rounded-full text-xs font-bold bg-indigo-600 text-white shadow-lg">
                            فایل ${Number(p.fileNumber) || Number(p.id)}
                        </span>
                        <span class="absolute top-3 left-3 px-3 py-1 rounded-full text-sm font-bold bg-amber-500 text-slate-900">
                            پلاک ${escapeHtml(p.plaque)}
                        </span>
                        <span class="absolute bottom-3 left-3 px-3 py-1 rounded-full text-xs font-bold ${categoryClass(p.category||'residential')}">${categoryLabel(p.category||'residential')}</span>
                        <span class="absolute bottom-3 right-3 px-3 py-1 rounded-full text-xs font-bold ${stCls}">${stLabel}</span>
                    </div>
                    <div class="p-5">
                        <h3 class="font-bold text-lg mb-1 line-clamp-1">${escapeHtml(p.title)}</h3>
                        <p class="text-slate-400 text-sm mb-3"><i class="fas fa-map-marker-alt ml-1"></i>${escapeHtml(p.address)}</p>
                        <div class="flex items-center justify-between gap-2 mb-3">
                            <span class="text-primary-400 font-bold text-lg">${escapeHtml(p.price)}</span>
                            <span class="text-slate-400 text-sm">${escapeHtml(p.area)}</span>
                        </div>
                        <div class="grid grid-cols-2 gap-2" onclick="event.stopPropagation()">
                            <button type="button" onclick="openPropertyPlaqueMode(decodeJsArg('${safeJsArg(p.id)}'))" class="touch-btn py-2.5 rounded-xl bg-amber-500 text-slate-900 font-bold text-sm flex items-center justify-center gap-1.5" title="شروع مشاهده پلاک‌به‌پلاک از این ملک">
                                <i class="fas fa-hashtag"></i> پلاک‌به‌پلاک
                            </button>
                            <button type="button" onclick="locatePropertyFromList(decodeJsArg('${safeJsArg(p.id)}'))" class="touch-btn py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm flex items-center justify-center gap-1.5" title="جانمایی ملک روی نقشه">
                                <i class="fas fa-map-marker-alt"></i> جانمایی
                            </button>
                        </div>
                    </div>
                </div>`;
            }).join('');
        }

        // ========== DETAIL ==========
        function openPropertyPlaqueMode(id) {
            const idx = currentList.findIndex(p => String(p.id) === String(id));
            if (idx < 0) currentList = properties.slice();
            currentIndex = currentList.findIndex(p => String(p.id) === String(id));
            if (currentIndex < 0) return;
            currentProperty = currentList[currentIndex];
            plaqueModeActive = true;
            fillDetail(currentProperty);
            updatePlaqueNav();
            showGallery('facade');
            goTo('detail');
        }

        function locatePropertyFromList(id) {
            const p = properties.find(x => String(x.id) === String(id));
            if (!p) return;
            if (p.lat == null || p.lng == null || !Number.isFinite(Number(p.lat)) || !Number.isFinite(Number(p.lng))) {
                alert('برای این ملک هنوز مختصات جانمایی ثبت نشده است.');
                return;
            }
            goTo('map');
            setTimeout(() => flyToProperty(p.id), 350);
        }

        function openDetail(id) {
            currentProperty = properties.find(p => String(p.id) === String(id));
            if (!currentProperty) return;
            
            // پیدا کردن ایندکس در لیست فعلی برای ناوبری پلاک‌به‌پلاک
            currentIndex = currentList.findIndex(p => String(p.id) === String(id));
            if (currentIndex < 0) {
                currentList = properties;
                currentIndex = properties.findIndex(p => String(p.id) === String(id));
            }
            
            fillDetail(currentProperty);
            updatePlaqueNav();
            showGallery('facade');
            goTo('detail');
        }

        function dealTypeLabel(t) {
            if (t === 'rent') return 'اجاره';
            if (t === 'mortgage') return 'رهن';
            if (t === 'mortgage_rent') return 'رهن و اجاره';
            return 'خرید و فروش';
        }
        function dealTypeClass(t) {
            if (t === 'rent') return 'bg-blue-500';
            if (t === 'mortgage') return 'bg-amber-600';
            if (t === 'mortgage_rent') return 'bg-orange-500';
            return 'bg-green-500';
        }
        function categoryLabel(c) {
            if (c === 'office') return 'اداری';
            if (c === 'commercial') return 'تجاری';
            if (c === 'partnership') return 'مشارکت در ساخت';
            if (c === 'kolangi') return 'فروش کلنگی';
            return 'مسکونی';
        }
        function categoryClass(c) {
            if (c === 'office') return 'bg-sky-600';
            if (c === 'commercial') return 'bg-rose-600';
            if (c === 'partnership') return 'bg-violet-600';
            if (c === 'kolangi') return 'bg-orange-600';
            return 'bg-teal-600';
        }
        function plaqueTypeClass(p) {
            if (p.category === 'partnership') return 'partnership';
            if (p.category === 'kolangi') return 'kolangi';
            if (p.type === 'rent') return 'rent';
            if (p.type === 'mortgage' || p.type === 'mortgage_rent') return 'mortgage';
            return 'sale';
        }
        function statusLabel(s) {
            if (s === 'reserved') return 'رزرو';
            if (s === 'sold') return 'فروخته / اجاره داده شده';
            if (s === 'archived') return 'بایگانی';
            return 'موجود';
        }
        function statusClass(s) {
            if (s === 'reserved') return 'bg-amber-500 text-slate-900';
            if (s === 'sold') return 'bg-slate-500 text-white';
            if (s === 'archived') return 'bg-violet-600 text-white';
            return 'bg-emerald-500 text-white';
        }
        function agentPhoneFor(name) {
            const a = agents.find(x => x.name === name);
            return (a && a.phone) ? a.phone : CONTACT_TEL;
        }

        function fillDetail(p) {
            document.getElementById('detail-title').textContent = p.title;
            document.getElementById('detail-plaque-header').textContent = 'پلاک ' + p.plaque;
            const mainSrc = (p.images && p.images.unit && p.images.unit[0]) || (p.images && p.images.facade && p.images.facade[0]) || '';
            document.getElementById('detail-main-img').src = mainSrc;
            document.getElementById('detail-type').textContent = dealTypeLabel(p.type);
            document.getElementById('detail-type').className = 'px-3 py-1 rounded-full text-sm font-medium ' + dealTypeClass(p.type);
            let catBadge = document.getElementById('detail-category-badge');
            if (!catBadge) {
                catBadge = document.createElement('span');
                catBadge.id = 'detail-category-badge';
                const typeEl = document.getElementById('detail-type');
                if (typeEl && typeEl.parentNode) typeEl.parentNode.insertBefore(catBadge, typeEl.nextSibling);
            }
            catBadge.textContent = categoryLabel(p.category || 'residential');
            catBadge.className = 'px-3 py-1 rounded-full text-sm font-medium ' + categoryClass(p.category || 'residential');
            document.getElementById('detail-plaque-badge').textContent = 'پلاک ' + p.plaque;
            document.getElementById('detail-price').textContent = p.price;
            document.getElementById('detail-address').textContent = p.address;
            document.getElementById('detail-plaque').textContent = p.plaque;
            document.getElementById('detail-area').textContent = p.area;
            document.getElementById('detail-rooms').textContent = p.rooms;
            document.getElementById('detail-year').textContent = p.year;
            document.getElementById('detail-district').textContent = 'منطقه ' + toPersianNum(String(p.district).replace('منطقه ', ''));
            document.getElementById('detail-desc').textContent = p.desc;
            document.getElementById('detail-agent').textContent = p.agent;
            const st = p.status || 'available';
            const badge = document.getElementById('detail-status-badge');
            if (badge) {
                badge.textContent = statusLabel(st);
                badge.className = 'inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold ' + statusClass(st);
            }
            const phone = agentPhoneFor(p.agent);
            const phoneEl = document.getElementById('detail-agent-phone');
            if (phoneEl) {
                if (phone) {
                    phoneEl.textContent = phone;
                    phoneEl.classList.remove('hidden');
                } else phoneEl.classList.add('hidden');
            }
            updateAdminUI();
        }

        function callPropertyAgent() {
            if (!currentProperty) return;
            const phone = agentPhoneFor(currentProperty.agent) || CONTACT_TEL;
            const digits = toEnglishDigits(String(phone)).replace(/\D/g, '');
            if (!digits) return;
            try { window.location.href = 'tel:' + digits; } catch (e) {}
        }

        function openEditProperty() {
            if (!currentProperty) return;
            requireAdmin(() => {
                const p = currentProperty;
                goTo('add');
                const title = document.getElementById('add-screen-title');
                const sub = document.getElementById('add-screen-sub');
                if (title) title.textContent = 'ویرایش ملک';
                if (sub) sub.textContent = 'تغییر مشخصات پلاک ' + p.plaque;
                document.getElementById('f-edit-id').value = String(p.id);
                document.getElementById('f-plaque').value = p.plaque || '';
                document.getElementById('f-type').value = p.type || 'sale';
                const cat = document.getElementById('f-category');
                if (cat) cat.value = p.category || 'residential';
                const st = document.getElementById('f-status');
                if (st) st.value = p.status || 'available';
                document.getElementById('f-title').value = p.title || '';
                document.getElementById('f-address').value = p.address || '';
                document.getElementById('f-district').value = p.district || 'منطقه ۱';
                document.getElementById('f-price').value = p.price || '';
                document.getElementById('f-area').value = p.area || '';
                document.getElementById('f-rooms').value = p.rooms || '';
                document.getElementById('f-year').value = p.year || '';
                fillAgentSelect(p.agent);
                document.getElementById('f-lat').value = p.lat != null ? Number(p.lat).toFixed(6) : '';
                document.getElementById('f-lng').value = p.lng != null ? Number(p.lng).toFixed(6) : '';
                document.getElementById('f-desc').value = p.desc || '';
                clearImagePreviews();
                // نگه داشتن عکس‌های قبلی در حافظه موقت فرم
                window._editKeepImages = p.images ? JSON.parse(JSON.stringify(p.images)) : null;
            });
        }

        function deleteCurrentProperty() {
            if (!currentProperty) return;
            requireAdmin(async () => {
                const p = currentProperty;
                if (!confirm('حذف قطعی ملک «' + p.title + '» (پلاک ' + p.plaque + ')؟')) return;
                const id = p.id;
                const previous = properties;
                const wasPlaqueMode = plaqueModeActive;
                const oldIndex = currentIndex;
                properties = properties.filter(x => x.id !== id);
                if (Array.isArray(currentList)) currentList = currentList.filter(x => x && x.id !== id);
                const saved = await saveProperties();
                if (!saved?.ok) {
                    properties = previous;
                    currentList = wasPlaqueMode ? previous.slice() : currentList;
                    currentIndex = Math.min(oldIndex, Math.max(0, currentList.length - 1));
                    alert('حذف انجام نشد؛ ذخیره اطلاعات روی هارد/مرورگر ناموفق بود.');
                    return;
                }
                if (mapInstance) {
                    const idx = propertyMarkers.findIndex(pm => String(pm.prop.id) === String(id));
                    if (idx >= 0) {
                        try { mapInstance.removeLayer(propertyMarkers[idx].marker); } catch (e) {}
                        propertyMarkers.splice(idx, 1);
                    }
                }

                if (wasPlaqueMode && currentList.length) {
                    // پلاک‌به‌پلاک: حذف پشت‌سرهم، بدون خروج از صفحه جزئیات.
                    currentIndex = Math.min(oldIndex, currentList.length - 1);
                    currentProperty = currentList[currentIndex];
                    fillDetail(currentProperty);
                    updatePlaqueNav();
                    showGallery('facade');
                    const detailScroll = document.querySelector('#screen-detail .overflow-y-auto');
                    if (detailScroll) detailScroll.scrollTop = 0;
                    return;
                }

                currentProperty = null;
                clearFilters();
                goTo('list');
                alert('ملک حذف شد.');
            });
        }

        function updatePlaqueNav() {
            const total = currentList.length;
            const info = document.getElementById('plaque-nav-info');
            const p = currentList[currentIndex];
            const fileNo = p ? (Number(p.fileNumber) || Number(p.id) || (currentIndex + 1)) : (currentIndex + 1);
            const plaque = p ? String(p.plaque || '—') : '—';
            info.textContent = 'شماره ' + toPersianNum(fileNo) + ' · پلاک ' + toPersianNum(plaque) + ' · ' + toPersianNum(currentIndex + 1) + ' از ' + toPersianNum(total);
            document.getElementById('btn-prev-plaque').disabled = currentIndex <= 0;
            document.getElementById('btn-next-plaque').disabled = currentIndex >= total - 1;
        }

        function navigatePlaque(dir) {
            const next = currentIndex + dir;
            if (next < 0 || next >= currentList.length) return;
            currentIndex = next;
            currentProperty = currentList[currentIndex];
            fillDetail(currentProperty);
            updatePlaqueNav();
            showGallery('facade');
            // اسکرول به بالا
            const detailScroll = document.querySelector('#screen-detail .overflow-y-auto');
            if (detailScroll) detailScroll.scrollTop = 0;
        }

        function startPlaqueByPlaque() {
            if (!properties.length) {
                alert('هنوز ملکی برای مشاهده پلاک‌به‌پلاک ثبت نشده است.');
                return;
            }
            plaqueModeActive = true;
            if (!currentList || !currentList.length) {
                currentList = properties.slice();
            }
            currentIndex = 0;
            currentProperty = currentList[0];
            if (!currentProperty) return;
            fillDetail(currentProperty);
            updatePlaqueNav();
            showGallery('facade');
            goTo('detail');
        }

        function showGallery(type) {
            currentGallery = type;
            document.querySelectorAll('.gallery-tab').forEach(t => {
                t.classList.remove('bg-primary-600', 'text-white');
                t.classList.add('bg-slate-700', 'text-slate-300');
                if (t.dataset.tab === type) {
                    t.classList.remove('bg-slate-700', 'text-slate-300');
                    t.classList.add('bg-primary-600', 'text-white');
                }
            });
            
            const imgs = currentProperty.images[type] || [];
            const labels = { facade: 'نما ساختمان', alley: 'کوچه و دسترسی', plan: 'پلان واحد', unit: 'عکس‌های داخلی' };
            
            const container = document.getElementById('gallery-container');
            if (!imgs.length) {
                container.innerHTML = '<p class="text-slate-400 col-span-2 text-center py-10">تصویری موجود نیست</p>';
                return;
            }
            container.innerHTML = imgs.map((src, i) => `
                <div data-gallery-idx="${i}" class="gallery-item relative cursor-pointer group overflow-hidden rounded-2xl h-56 md:h-64 bg-slate-800">
                    <img src="${safeImageSrc(src)}" class="w-full h-full object-cover group-active:scale-105 transition-transform" alt="">
                    <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <i class="fas fa-search-plus text-3xl text-white opacity-0 group-hover:opacity-100 transition-opacity"></i>
                    </div>
                    ${i === 0 ? `<span class="absolute top-3 right-3 bg-black/60 px-3 py-1 rounded-lg text-sm">${labels[type]}</span>` : ''}
                </div>
            `).join('');
            container.querySelectorAll('.gallery-item').forEach(el => {
                el.addEventListener('click', () => {
                    const idx = parseInt(el.getAttribute('data-gallery-idx'), 10);
                    openLightbox(imgs[idx]);
                });
            });
        }

        function openLightbox(src) {
            document.getElementById('lightbox-img').src = src;
            document.getElementById('lightbox').classList.add('show');
        }
        function closeLightbox() {
            document.getElementById('lightbox').classList.remove('show');
        }

        // شماره حروفی 099999Amlak → روی کی‌پد: A=2 M=6 L=5 A=2 K=5 → 09999926525
        const CONTACT_TEL = '09999926525';
        const CONTACT_DISPLAY = '099999Amlak';

        function dialContact() {
            try {
                window.location.href = 'tel:' + CONTACT_TEL;
            } catch (e) {}
        }

        function requestVisit() {
            document.getElementById('visit-modal').classList.remove('hidden');
            document.getElementById('visit-modal').classList.add('flex');
            // روی کیوسک/موبایل بلافاصله شماره‌گیر را با شماره واقعی باز می‌کند
            setTimeout(dialContact, 150);
        }
        function closeVisitModal() {
            document.getElementById('visit-modal').classList.add('hidden');
            document.getElementById('visit-modal').classList.remove('flex');
        }

        // ========== جستجو و فیلتر ==========
        /** تبدیل قیمت ملک به تومان؛ واحدهای میلیون/میلیارد را هم تشخیص می‌دهد. */
        function priceToToman(str) {
            if (str == null || String(str).trim() === '') return null;
            const raw = toEnglishDigits(String(str)).replace(/[٬،]/g, ',').replace(/٫/g, '.').trim();
            // اول اعدادِ کامل با جداکننده هزارگان و اعشار را بخوان؛
            // مثلاً 16.5/000/000/000 باید دقیقاً 16,500,000,000 تومان شود.
            const unitIsBillion = /میلیارد|بليون|billion/i.test(raw) || /هزار\s*میلیون/i.test(raw);
            const unitIsMillion = /میلیون|million/i.test(raw) && !unitIsBillion;
            const numericPart = raw.replace(/میلیارد|بليون|billion|هزار\s*میلیون|میلیون|million|تومان|tomans?/gi, ' ').trim();
            const parsed = parseNumericField(numericPart);
            if (parsed != null) {
                if (unitIsBillion) return parsed * 1e9;
                if (unitIsMillion) return parsed * 1e6;
                return parsed;
            }
            return null;
        }

        function priceToMillionToman(str) {
            const t = priceToToman(str);
            return t == null ? null : t / 1e6;
        }

        function valNum(id) {
            return parseNumericField(document.getElementById(id)?.value);
        }

        function updateFilterPanels() {
            const cat = document.getElementById('filter-category')?.value || '';
            const type = document.getElementById('filter-type')?.value || '';
            const show = (id, on) => {
                const el = document.getElementById(id);
                if (el) el.classList.toggle('hidden', !on);
            };

            // پنل‌های اصلی بر اساس کاربری
            const isRes = !cat || cat === 'residential' || cat === 'office';
            const isPart = cat === 'partnership';
            const isCom = cat === 'commercial';
            const isKol = cat === 'kolangi';

            show('panel-res-office', isRes || (!cat && !isPart && !isCom && !isKol));
            // وقتی همه کاربری‌ها: پنل مسکونی را نشان بده (پیش‌فرض)
            if (!cat) {
                show('panel-res-office', true);
                show('panel-partnership', false);
                show('panel-commercial', false);
                show('panel-kolangi', false);
                show('panel-price-res', true);
            } else {
                show('panel-res-office', cat === 'residential' || cat === 'office');
                show('panel-partnership', isPart);
                show('panel-commercial', isCom);
                show('panel-kolangi', isKol);
                show('panel-price-res', cat === 'residential' || cat === 'office');
            }

            // نوع معامله برای کلنگی و مشارکت: فقط فروش منطقی است ولی مخفی نکنیم مگر کلنگی
            const wrapType = document.getElementById('wrap-filter-type');
            if (wrapType) {
                if (isKol) {
                    // کلنگی = فروش
                    const ft = document.getElementById('filter-type');
                    if (ft && ft.value !== 'sale') ft.value = 'sale';
                }
            }

            // مبالغ مسکونی/اداری بر اساس نوع معامله
            const showSale = !type || type === 'sale';
            const showMort = !type || type === 'mortgage' || type === 'mortgage_rent';
            const showRent = !type || type === 'rent' || type === 'mortgage_rent';
            show('wrap-sale-price', showSale);
            show('wrap-mortgage-price', showMort);
            show('wrap-rent-price', showRent);

            // راهنما
            const hint = document.getElementById('filter-hint');
            if (hint) {
                if (cat === 'residential') {
                    hint.innerHTML = '<i class="fas fa-info-circle ml-1"></i> مسکونی: متراژ، تعداد خواب، سال ساخت + مبلغ بر اساس نوع معامله (فروش / رهن / اجاره). مبلغ را به <strong class="text-slate-400">تومان</strong> وارد کنید.';
                } else if (cat === 'office') {
                    hint.innerHTML = '<i class="fas fa-info-circle ml-1"></i> اداری: متراژ، اتاق، سال ساخت + مبلغ فروش / رهن / اجاره. مبلغ را به <strong class="text-slate-400">تومان</strong> وارد کنید.';
                } else if (cat === 'partnership') {
                    hint.innerHTML = '<i class="fas fa-info-circle ml-1"></i> مشارکت در ساخت: فقط بازه <strong class="text-slate-400">متراژ</strong> (زمین یا بنا).';
                } else if (cat === 'commercial') {
                    hint.innerHTML = '<i class="fas fa-info-circle ml-1"></i> تجاری: متراژ + مبلغ فروش و اجاره. مبلغ را به <strong class="text-slate-400">تومان</strong> وارد کنید.';
                } else if (cat === 'kolangi') {
                    hint.innerHTML = '<i class="fas fa-info-circle ml-1"></i> فروش کلنگی: متراژ زمین/بنا + قیمت فروش (میلیون تومان).';
                } else {
                    hint.innerHTML = '<i class="fas fa-info-circle ml-1"></i> ابتدا <strong class="text-slate-400">کاربری</strong> را انتخاب کنید تا فیلترهای مربوط نمایش داده شود. مبالغ را به <strong class="text-slate-400">تومان</strong> وارد کنید؛ جداکننده هزارگان `/` و اعشار (`.` یا `٫`) در همه فیلدهای عددی قابل استفاده است.';
                }
            }
        }

        function onFilterCategoryChange() {
            updateFilterPanels();
            applyFilters();
        }
        function onFilterTypeChange() {
            updateFilterPanels();
            applyFilters();
        }

        function applyFilters() {
            const qRaw = (document.getElementById('search-input')?.value || '').trim();
            const q = normalizeSearchQuery(qRaw);
            const district = document.getElementById('filter-district')?.value || '';
            const type = document.getElementById('filter-type')?.value || '';
            const category = document.getElementById('filter-category')?.value || '';
            const status = document.getElementById('filter-status')?.value || '';

            // فیلدهای مسکونی/اداری
            const areaMin = valNum('filter-area-min');
            const areaMax = valNum('filter-area-max');
            const roomsMin = valNum('filter-rooms-min');
            const roomsMax = valNum('filter-rooms-max');
            const yearMin = valNum('filter-year-min');
            const yearMax = valNum('filter-year-max');
            const saleMin = valNum('filter-sale-min');
            const saleMax = valNum('filter-sale-max');
            const mortgageMin = valNum('filter-mortgage-min');
            const mortgageMax = valNum('filter-mortgage-max');
            const rentMin = valNum('filter-rent-min');
            const rentMax = valNum('filter-rent-max');

            // مشارکت
            const partAreaMin = valNum('filter-part-area-min');
            const partAreaMax = valNum('filter-part-area-max');

            // تجاری
            const comAreaMin = valNum('filter-com-area-min');
            const comAreaMax = valNum('filter-com-area-max');
            const comSaleMin = valNum('filter-com-sale-min');
            const comSaleMax = valNum('filter-com-sale-max');
            const comRentMin = valNum('filter-com-rent-min');
            const comRentMax = valNum('filter-com-rent-max');

            // کلنگی
            const kolAreaMin = valNum('filter-kol-area-min');
            const kolAreaMax = valNum('filter-kol-area-max');
            const kolSaleMin = valNum('filter-kol-sale-min');
            const kolSaleMax = valNum('filter-kol-sale-max');

            let filtered = properties.slice();

            if (district) filtered = filtered.filter(p => p.district === district);
            if (type) filtered = filtered.filter(p => p.type === type);
            if (category) filtered = filtered.filter(p => (p.category || 'residential') === category);
            if (status) filtered = filtered.filter(p => (p.status || 'available') === status);

            // --- مسکونی / اداری (یا همه بدون کاربری) ---
            if (!category || category === 'residential' || category === 'office') {
                if (areaMin != null) filtered = filtered.filter(p => { const a = parseNumericField(p.area); return a == null || a >= areaMin; });
                if (areaMax != null) filtered = filtered.filter(p => { const a = parseNumericField(p.area); return a == null || a <= areaMax; });
                if (roomsMin != null) filtered = filtered.filter(p => { const r = parseNumericField(p.rooms); return r == null || r >= roomsMin; });
                if (roomsMax != null) filtered = filtered.filter(p => { const r = parseNumericField(p.rooms); return r == null || r <= roomsMax; });
                if (yearMin != null) filtered = filtered.filter(p => { const y = parseNumericField(p.year); return y == null || y >= yearMin; });
                if (yearMax != null) filtered = filtered.filter(p => { const y = parseNumericField(p.year); return y == null || y <= yearMax; });

                if (saleMin != null || saleMax != null) {
                    filtered = filtered.filter(p => {
                        if (p.type !== 'sale') return false;
                        const v = priceToToman(p.price);
                        if (v == null) return false;
                        if (saleMin != null && v < saleMin) return false;
                        if (saleMax != null && v > saleMax) return false;
                        return true;
                    });
                }
                if (mortgageMin != null || mortgageMax != null) {
                    filtered = filtered.filter(p => {
                        if (p.type !== 'mortgage' && p.type !== 'mortgage_rent') return false;
                        const v = priceToToman(p.price);
                        if (v == null) return false;
                        if (mortgageMin != null && v < mortgageMin) return false;
                        if (mortgageMax != null && v > mortgageMax) return false;
                        return true;
                    });
                }
                if (rentMin != null || rentMax != null) {
                    filtered = filtered.filter(p => {
                        if (p.type !== 'rent' && p.type !== 'mortgage_rent') return false;
                        const v = priceToToman(p.price);
                        if (v == null) return false;
                        if (rentMin != null && v < rentMin) return false;
                        if (rentMax != null && v > rentMax) return false;
                        return true;
                    });
                }
            }

            // --- مشارکت ---
            if (category === 'partnership') {
                if (partAreaMin != null) filtered = filtered.filter(p => { const a = parseNumericField(p.area); return a == null || a >= partAreaMin; });
                if (partAreaMax != null) filtered = filtered.filter(p => { const a = parseNumericField(p.area); return a == null || a <= partAreaMax; });
            }

            // --- تجاری ---
            if (category === 'commercial') {
                if (comAreaMin != null) filtered = filtered.filter(p => { const a = parseNumericField(p.area); return a == null || a >= comAreaMin; });
                if (comAreaMax != null) filtered = filtered.filter(p => { const a = parseNumericField(p.area); return a == null || a <= comAreaMax; });
                if (comSaleMin != null || comSaleMax != null) {
                    filtered = filtered.filter(p => {
                        if (p.type !== 'sale') return false;
                        const v = priceToToman(p.price);
                        if (v == null) return false;
                        if (comSaleMin != null && v < comSaleMin) return false;
                        if (comSaleMax != null && v > comSaleMax) return false;
                        return true;
                    });
                }
                if (comRentMin != null || comRentMax != null) {
                    filtered = filtered.filter(p => {
                        if (p.type !== 'rent' && p.type !== 'mortgage_rent') return false;
                        const v = priceToToman(p.price);
                        if (v == null) return false;
                        if (comRentMin != null && v < comRentMin) return false;
                        if (comRentMax != null && v > comRentMax) return false;
                        return true;
                    });
                }
            }

            // --- کلنگی ---
            if (category === 'kolangi') {
                if (kolAreaMin != null) filtered = filtered.filter(p => { const a = parseNumericField(p.area); return a == null || a >= kolAreaMin; });
                if (kolAreaMax != null) filtered = filtered.filter(p => { const a = parseNumericField(p.area); return a == null || a <= kolAreaMax; });
                if (kolSaleMin != null || kolSaleMax != null) {
                    filtered = filtered.filter(p => {
                        const v = priceToToman(p.price);
                        if (v == null) return false;
                        if (kolSaleMin != null && v < kolSaleMin) return false;
                        if (kolSaleMax != null && v > kolSaleMax) return false;
                        return true;
                    });
                }
            }

            if (q) {
                filtered = filtered.filter(p => {
                    const hay = normalizeSearchQuery([
                        p.title, p.address, p.plaque, p.district, p.price, p.area, p.desc, p.agent,
                        statusLabel(p.status || 'available'), categoryLabel(p.category||'residential'), dealTypeLabel(p.type)
                    ].join(' '));
                    return hay.includes(q);
                });
                // شماره پلاک دقیق اول بیاد
                filtered.sort((a, b) => {
                    const aExact = normalizeSearchQuery(a.plaque) === q ? 0 : 1;
                    const bExact = normalizeSearchQuery(b.plaque) === q ? 0 : 1;
                    if (aExact !== bExact) return aExact - bExact;
                    const aStart = normalizeSearchQuery(a.plaque).startsWith(q) ? 0 : 1;
                    const bStart = normalizeSearchQuery(b.plaque).startsWith(q) ? 0 : 1;
                    return aStart - bStart;
                });
            }

            const titleEl = document.getElementById('list-title');
            const countEl = document.getElementById('list-count');
            const hasFilter = !!(district || type || category || status || q ||
                areaMin != null || areaMax != null || roomsMin != null || roomsMax != null ||
                yearMin != null || yearMax != null ||
                saleMin != null || saleMax != null || mortgageMin != null || mortgageMax != null ||
                rentMin != null || rentMax != null ||
                partAreaMin != null || partAreaMax != null ||
                comAreaMin != null || comAreaMax != null || comSaleMin != null || comSaleMax != null ||
                comRentMin != null || comRentMax != null ||
                kolAreaMin != null || kolAreaMax != null || kolSaleMin != null || kolSaleMax != null);
            // فیلتر محدوده رسم‌شده روی نقشه
            if (window.searchPolygon) {
                filtered = filtered.filter(p => {
                    if (p.lat == null || p.lng == null) return false;
                    try {
                        const latLngs = typeof window.searchPolygon.getLatLngs === 'function'
                            ? window.searchPolygon.getLatLngs()
                            : null;
                        if (latLngs && Array.isArray(latLngs) && latLngs.length) {
                            const ring = Array.isArray(latLngs[0]) ? latLngs[0] : latLngs;
                            return isPointInPolygon([Number(p.lat), Number(p.lng)], ring);
                        }
                        return window.searchPolygon.getBounds().contains([p.lat, p.lng]);
                    } catch (e) {
                        return false;
                    }
                });
            }
            currentList = filtered;
            const hasPoly = !!window.searchPolygon;
            if (hasFilter || hasPoly) {
                titleEl.textContent = 'نتایج جستجو';
                countEl.textContent = toPersianNum(filtered.length) + ' ملک از ' + toPersianNum(properties.length);
            } else {
                titleEl.textContent = 'همه املاک';
                countEl.textContent = toPersianNum(properties.length) + ' ملک';
            }
            renderList(filtered);
            // به‌روزرسانی مارکرهای نقشه بر اساس فیلتر
            updateMapMarkersVisibility(filtered);
        }

        function isPointInPolygon(point, vs) {
            if (!vs || !vs.length) return false;
            const x = point[0], y = point[1];
            let inside = false;
            for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
                const xi = vs[i].lat !== undefined ? vs[i].lat : vs[i][0];
                const yi = vs[i].lng !== undefined ? vs[i].lng : vs[i][1];
                const xj = vs[j].lat !== undefined ? vs[j].lat : vs[j][0];
                const yj = vs[j].lng !== undefined ? vs[j].lng : vs[j][1];
                const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi);
                if (intersect) inside = !inside;
            }
            return inside;
        }

        function applyPolygonFilter() {
            applyFilters();
        }

        function updateMapMarkersVisibility(visibleList) {
            if (!propertyMarkers || !propertyMarkers.length) return;
            const ids = new Set((visibleList || properties).map(p => p.id));
            propertyMarkers.forEach(({ marker, prop }) => {
                if (ids.has(prop.id)) {
                    if (mapInstance && !mapInstance.hasLayer(marker)) marker.addTo(mapInstance);
                    try { marker.setOpacity(1); } catch(e) {}
                } else {
                    try { marker.setOpacity(0.15); } catch(e) {}
                }
            });
        }

        function updateSearchClearBtn() {
            const input = document.getElementById('search-input');
            const btn = document.getElementById('search-clear-btn');
            if (!input || !btn) return;
            const has = !!(input.value && input.value.trim());
            btn.classList.toggle('show', has);
            input.classList.toggle('has-clear', has);
        }

        function onSearchInput() {
            updateSearchClearBtn();
            applyFilters();
        }

        /** فقط متن جستجو را پاک می‌کند (فیلترهای دیگر می‌مانند) */
        function clearSearchOnly() {
            const input = document.getElementById('search-input');
            if (input) {
                input.value = '';
                input.focus();
            }
            updateSearchClearBtn();
            applyFilters();
        }

        function clearFilters() {
            const ids = [
                'search-input','filter-district','filter-type','filter-category','filter-status',
                'filter-area-min','filter-area-max',
                'filter-rooms-min','filter-rooms-max',
                'filter-year-min','filter-year-max',
                'filter-sale-min','filter-sale-max',
                'filter-mortgage-min','filter-mortgage-max',
                'filter-rent-min','filter-rent-max',
                'filter-part-area-min','filter-part-area-max',
                'filter-com-area-min','filter-com-area-max',
                'filter-com-sale-min','filter-com-sale-max',
                'filter-com-rent-min','filter-com-rent-max',
                'filter-kol-area-min','filter-kol-area-max',
                'filter-kol-sale-min','filter-kol-sale-max'
            ];
            ids.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            // پاک کردن محدوده رسم‌شده روی نقشه
            if (window.drawnItems) window.drawnItems.clearLayers();
            window.searchPolygon = null;
            updateSearchClearBtn();
            updateFilterPanels();
            applyFilters();
        }

        // ========== آپلود و پیش‌نمایش عکس ==========
        function fileToDataURL(file) {
            return new Promise((resolve, reject) => {
                if (!file || !file.type.startsWith('image/')) {
                    resolve(null);
                    return;
                }
                // در مرورگر ۵ مگابایت؛ در Electron (هارد) تا ۲۵ مگابایت
                const maxBytes = isElectron ? (8 * 1024 * 1024) : (5 * 1024 * 1024);
                if (file.size > maxBytes) {
                    const mb = Math.round(maxBytes / (1024 * 1024));
                    alert('حجم عکس «' + file.name + '» بیش از ' + mb + ' مگابایت است. لطفاً عکس کوچک‌تری انتخاب کنید.');
                    resolve(null);
                    return;
                }
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(file);
            });
        }

        /** در Electron عکس base64 را روی دیسک ذخیره و URL فایل برمی‌گرداند */
        async function persistImagesToDisk(images, propId) {
            if (!isElectron || !window.electronAPI || !window.electronAPI.saveImage) return images;
            const out = { facade: [], alley: [], plan: [], unit: [] };
            for (const key of ['facade', 'alley', 'plan', 'unit']) {
                const arr = images[key] || [];
                for (let i = 0; i < arr.length; i++) {
                    const src = arr[i];
                    if (typeof src === 'string' && src.startsWith('data:image')) {
                        try {
                            const res = await window.electronAPI.saveImage({
                                id: propId,
                                key: key,
                                index: i,
                                dataUrl: src
                            });
                            if (res && res.ok && res.assetUrl) {
                                out[key].push(res.assetUrl);
                            } else {
                                throw new Error((res && res.error) || 'SAVE_IMAGE_FAILED');
                            }
                        } catch (e) {
                            console.error('saveImage failed', key, i, e);
                            throw e;
                        }
                    } else {
                        out[key].push(src);
                    }
                }
                if (!out[key].length) out[key] = arr.slice();
            }
            return out;
        }

        function previewImage(input, previewId, multiple) {
            const box = document.getElementById(previewId);
            if (!box) return;
            box.innerHTML = '';
            const files = multiple ? Array.from(input.files || []) : (input.files[0] ? [input.files[0]] : []);
            files.forEach(file => {
                if (!file.type.startsWith('image/')) return;
                const url = URL.createObjectURL(file);
                const img = document.createElement('img');
                img.src = url;
                img.className = 'w-24 h-24 object-cover rounded-xl border border-slate-600';
                img.alt = file.name;
                box.appendChild(img);
            });
        }

        async function readImagesFromInputs() {
            const facadeFile = document.getElementById('f-img-facade').files[0];
            const alleyFile = document.getElementById('f-img-alley').files[0];
            const planFile = document.getElementById('f-img-plan').files[0];
            const unitFiles = Array.from(document.getElementById('f-img-unit').files || []);

            const [facade, alley, plan, ...units] = await Promise.all([
                fileToDataURL(facadeFile),
                fileToDataURL(alleyFile),
                fileToDataURL(planFile),
                ...unitFiles.map(f => fileToDataURL(f))
            ]);

            const unitImgs = units.filter(Boolean);
            return {
                facade: facade ? [facade] : [],
                alley: alley ? [alley] : [],
                plan: plan ? [plan] : [],
                unit: unitImgs
            };
        }

        // ========== افزودن ملک جدید ==========
        async function submitNewProperty(e) {
            e.preventDefault();
            if (!canAddProperty()) {
                requireSubscriptionForAdd();
                return false;
            }

            const submitBtn = e.target.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin ml-2"></i> در حال ذخیره...';
            }

            try {
                let images = await readImagesFromInputs();
                // اگر در حالت ویرایش عکس جدید نداد، عکس قبلی بماند
                const editIdRaw = document.getElementById('f-edit-id').value;
                const editId = editIdRaw ? parseInt(editIdRaw, 10) : null;
                if (editId && window._editKeepImages) {
                    const hasNew = (key) => {
                        const arr = images[key];
                        return Array.isArray(arr) && arr.length > 0;
                    };
                    // اگر فقط فایل جدید انتخاب شده باشد جایگزین شود؛ در غیر این صورت keep
                    ['facade','alley','plan','unit'].forEach(key => {
                        const inputId = key === 'unit' ? 'f-img-unit' : 'f-img-' + key;
                        const inp = document.getElementById(inputId);
                        const hasFile = inp && inp.files && inp.files.length;
                        if (!hasFile && window._editKeepImages[key]) {
                            images[key] = window._editKeepImages[key];
                        }
                    });
                }

                // در Electron عکس‌های base64 را روی هارد ذخیره کن
                const persistId = editId || (properties.length ? Math.max(...properties.map(p => p.id)) + 1 : 1);
                images = await persistImagesToDisk(images, persistId);

                const payload = {
                    plaque: document.getElementById('f-plaque').value.trim(),
                    type: document.getElementById('f-type').value,
                    category: (document.getElementById('f-category') && document.getElementById('f-category').value) || 'residential',
                    status: (document.getElementById('f-status') && document.getElementById('f-status').value) || 'available',
                    title: document.getElementById('f-title').value.trim(),
                    address: document.getElementById('f-address').value.trim(),
                    district: document.getElementById('f-district').value,
                    price: document.getElementById('f-price').value.trim(),
                    area: document.getElementById('f-area').value.trim(),
                    rooms: document.getElementById('f-rooms').value.trim(),
                    year: document.getElementById('f-year').value.trim(),
                    lat: parseNumericField(document.getElementById('f-lat').value),
                    lng: parseNumericField(document.getElementById('f-lng').value),
                    agent: document.getElementById('f-agent').value.trim() || 'مهندس شیرنگی',
                    desc: document.getElementById('f-desc').value.trim() || 'بدون توضیحات',
                    images: images
                };

                if (editId) {
                    const idx = properties.findIndex(p => p.id === editId);
                    if (idx < 0) throw new Error('ملک یافت نشد');
                    const previousProperty = properties[idx];
                    properties[idx] = Object.assign({}, previousProperty, payload, { id: editId });
                    const saved = await saveProperties();
                    if (!saved?.ok) {
                        properties[idx] = previousProperty;
                        throw new Error('SAVE_PROPERTIES_FAILED');
                    }
                    // به‌روزرسانی مارکر
                    if (mapInstance) {
                        const midx = propertyMarkers.findIndex(pm => pm.prop.id === editId);
                        if (midx >= 0) {
                            try { mapInstance.removeLayer(propertyMarkers[midx].marker); } catch (e) {}
                            propertyMarkers.splice(midx, 1);
                        }
                        addMarkerForProperty(properties[idx]);
                    }
                    window._editKeepImages = null;
                    document.getElementById('f-edit-id').value = '';
                    clearFilters();
                    goTo('list');
                    alert('تغییرات ذخیره شد.');
                } else {
                    const newId = properties.length ? Math.max(...properties.map(p => p.id)) + 1 : 1;
                    const newFileNumber = properties.length ? Math.max(...properties.map(p => Number(p.fileNumber) || 0)) + 1 : 1;
                    const newProp = Object.assign({ id: newId, fileNumber: newFileNumber }, payload);
                    properties.push(newProp);
                    const saved = await saveProperties();
                    if (!saved?.ok) {
                        properties.pop();
                        throw new Error('SAVE_PROPERTIES_FAILED');
                    }
                    if (mapInstance) addMarkerForProperty(newProp);
                    clearFilters();
                    goTo('list');
                    alert('ملک با موفقیت اضافه شد!');
                }
            } catch (err) {
                console.error(err);
                alert('خطا در ذخیره. لطفاً دوباره تلاش کنید.');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fas fa-check ml-2"></i> ذخیره ملک';
                }
            }
            return false;
        }

        // پارسر عمومی اعداد: فارسی/انگلیسی + جداکننده هزارگان / , ٬ + اعشار . یا ٫
        // مثال‌های معتبر: ۲۵/۰۰۰/۰۰۰/۰۰۰ ، 25,000,000,000 ، 25.5 ، ۲۵٫۵
        function normalizeNumericString(str) {
            if (str == null) return null;
            let s = toEnglishDigits(String(str)).trim();
            if (!s) return null;
            s = s.replace(/[\u00a0\u2009\u202f ]/g, '')
                .replace(/[٬،]/g, ',')
                .replace(/٫/g, '.')
                .replace(/\//g, '');

            // فقط یک علامت منفی در ابتدای عدد مجاز است.
            const negative = s.startsWith('-');
            if (s.includes('-') && !(negative && s.indexOf('-') === 0)) return null;
            s = negative ? s.slice(1) : s;
            if (!s || !/^\d[\d,]*(?:\.\d+)?$/.test(s)) return null;

            // کاما: 1,234 = هزارگان، اما 123,45 = اعشار.
            const commas = (s.match(/,/g) || []).length;
            if (commas) {
                if (commas === 1 && /,\d{1,2}$/.test(s) && !s.includes('.')) {
                    s = s.replace(',', '.');
                } else {
                    // جداکننده‌های هزارگان باید گروه‌های سه‌رقمی معتبر داشته باشند.
                    const groups = s.split(',');
                    if (groups.slice(1).some(g => g.length !== 3)) return null;
                    s = groups.join('');
                }
            }
            if ((s.match(/\./g) || []).length > 1) return null;
            if (!/^\d+(?:\.\d+)?$/.test(s)) return null;
            return (negative ? '-' : '') + s;
        }

        function parseNumericField(str) {
            const normalized = normalizeNumericString(str);
            if (normalized == null) return null;
            const n = Number(normalized);
            return Number.isFinite(n) ? n : null;
        }

        function parseIntegerField(str) {
            const n = parseNumericField(str);
            return n == null || !Number.isInteger(n) ? null : n;
        }

        function parseAmountInput(str) {
            return parseNumericField(str);
        }

        function formatNumericInputValue(str) {
            if (str == null || String(str).trim() === '') return '';
            let s = toEnglishDigits(String(str)).trim().replace(/[٬،]/g, ',').replace(/٫/g, '.').replace(/\//g, '');
            const commaMatches = (s.match(/,/g) || []).length;
            if (commaMatches === 1 && /,\d{1,2}$/.test(s)) s = s.replace(',', '.');
            else s = s.replace(/,/g, '');
            s = s.replace(/[^0-9.\-]/g, '');
            const negative = /^-/.test(s);
            s = s.replace(/-/g, '');
            const parts = s.split('.');
            let intPart = (parts.shift() || '').replace(/\D/g, '');
            const decPart = parts.join('').replace(/\D/g, '');
            if (!intPart && !decPart) return '';
            intPart = intPart.replace(/^0+(?=\d)/, '');
            const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '/');
            return toPersianNum((negative ? '-' : '') + grouped + (decPart ? '.' + decPart : ''));
        }

        function setupNumericInputs() {
            document.querySelectorAll('input[type="text"][inputmode="decimal"], input[type="text"][inputmode="decimal"]').forEach(el => {
                if (el.dataset.numericReady) return;
                el.dataset.numericReady = '1';
                const isAmount = /^(?:f-price|f-area|builder-budget|filter-(?:kol-)?sale-(?:min|max)|filter-(?:com-)?rent-(?:min|max)|filter-mortgage-(?:min|max)|comm-amount|convert-(?:rahn|ejare)|ppm-price|loan-amount|crm-fin-amount|cust-budget-(?:min|max))$/i.test(el.id || '');
                // برای قیمت و مبلغ، جداکننده هزارگان به شکل / در خودِ تایپ هم اعمال می‌شود.
                if (isAmount) el.addEventListener('input', () => {
                    const raw = toEnglishDigits(String(el.value || '')).replace(/[\/٬،,]/g, '').replace(/[^0-9.\-]/g, '');
                    const parts = raw.split('.');
                    const intPart = (parts.shift() || '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');
                    const decPart = parts.join('').replace(/\D/g, '');
                    el.value = toPersianNum(intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '/') + (decPart ? '.' + decPart : ''));
                });
                // همه فیلدهای عددی امکان اعشار دارند؛ هنگام تایپ اعشار را حذف نکن.
                el.addEventListener('input', () => {
                    const pos = el.selectionStart;
                    let v = toEnglishDigits(String(el.value || ''))
                        .replace(/[٫]/g, '.')
                        .replace(/[^0-9.\/\-]/g, '');
                    // فقط یک نقطه اعشار؛ اسلش برای جداکننده هزارگان آزاد است.
                    const firstDot = v.indexOf('.');
                    if (firstDot !== -1) {
                        v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '');
                    }
                    el.value = toPersianNum(v);
                    try {
                        const next = Math.min(pos ?? el.value.length, el.value.length);
                        el.setSelectionRange(next, next);
                    } catch (_) {}
                });
                el.addEventListener('blur', () => {
                    if (el.value.trim()) el.value = formatNumericInputValue(el.value);
                });
                el.addEventListener('paste', () => setTimeout(() => {
                    el.value = formatNumericInputValue(el.value);
                }, 0));
            });
        }

        // ورودی یکپارچه تاریخ/ساعت در کل پروژه: فقط عدد؛ جداکننده‌ها خودکار.
        function setupDateTimeInputs() {
            const isDateField = el => {
                const id = String(el?.id || '');
                const ph = String(el?.placeholder || '');
                const aria = String(el?.getAttribute?.('aria-label') || '');
                return /(?:date|تاریخ)/i.test(id + ' ' + ph + ' ' + aria);
            };
            const isTimeField = el => {
                const id = String(el?.id || '');
                const ph = String(el?.placeholder || '');
                const aria = String(el?.getAttribute?.('aria-label') || '');
                return el?.type === 'time' || /(?:time|ساعت)/i.test(id + ' ' + ph + ' ' + aria);
            };
            document.querySelectorAll('input').forEach(el => {
                if (el.dataset.dateTimeReady || (!isDateField(el) && !isTimeField(el))) return;
                el.dataset.dateTimeReady = '1';
                if (isTimeField(el)) {
                    try { el.type = 'text'; } catch (_) {}
                    el.setAttribute('inputmode', 'numeric');
                    el.setAttribute('autocomplete', 'off');
                    el.setAttribute('maxlength', '5');
                    el.addEventListener('input', () => {
                        let v = toEnglishDigits(String(el.value || '')).replace(/\D/g, '').slice(0, 4);
                        if (v.length > 2) v = v.slice(0,2) + ':' + v.slice(2);
                        el.value = toPersianNum(v);
                    });
                    el.addEventListener('blur', () => {
                        const raw = toEnglishDigits(String(el.value || '')).replace(/\D/g, '');
                        if (!raw) return;
                        const v = raw.padStart(4, '0').slice(0,4);
                        const hh = Number(v.slice(0,2)), mm = Number(v.slice(2,4));
                        if (hh > 23 || mm > 59) { el.value = ''; return; }
                        el.value = toPersianNum(v.slice(0,2) + ':' + v.slice(2,4));
                    });
                } else {
                    el.setAttribute('inputmode', 'numeric');
                    el.setAttribute('autocomplete', 'off');
                    el.setAttribute('maxlength', '10');
                    el.addEventListener('input', () => {
                        let v = toEnglishDigits(String(el.value || '')).replace(/\D/g, '').slice(0, 8);
                        if (v.length > 4) v = v.slice(0,4) + '/' + v.slice(4);
                        if (v.length > 7) v = v.slice(0,7) + '/' + v.slice(7);
                        el.value = toPersianNum(v);
                    });
                    el.addEventListener('blur', () => {
                        const normalized = normalizeJalaliDate(el.value);
                        if (normalized) el.value = toPersianNum(normalized);
                    });
                }
            });
        }

        // فیلدهای پویا هم همان قوانین را می‌گیرند.
        const _shirangiSetupNumericInputs = setupNumericInputs;
        setupNumericInputs = function() {
            _shirangiSetupNumericInputs();
            setupDateTimeInputs();
        };

        if (typeof MutationObserver !== 'undefined') {
            new MutationObserver(() => setupDateTimeInputs()).observe(document.body, { childList: true, subtree: true });
        }

        function normalizeTimeInput(value, fallback='') {
            const raw = toEnglishDigits(String(value || '')).replace(/\D/g, '');
            if (!raw) return fallback;
            const digits = raw.padStart(4, '0').slice(0,4);
            const hh = Number(digits.slice(0,2)), mm = Number(digits.slice(2,4));
            if (hh > 23 || mm > 59) return null;
            return digits.slice(0,2) + ':' + digits.slice(2,4);
        }

        async function _backupDeriveKey(password, salt) {
            if (!window.crypto?.subtle) throw new Error('WebCrypto unavailable');
            const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
            return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:210000,hash:'SHA-256'}, base, {name:'AES-GCM',length:256}, false, ['encrypt','decrypt']);
        }
        function _backupB64(bytes) {
            let s=''; for(const b of bytes)s+=String.fromCharCode(b); return btoa(s);
        }
        function _backupBytes(b64) {
            const bin=atob(b64), out=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i); return out;
        }
        async function _encryptBackupObject(data,password) {
            if(String(password||'').length<12) throw new Error('BACKUP_PASSWORD_TOO_SHORT');
            const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
            const key=await _backupDeriveKey(password,salt);
            const plain=new TextEncoder().encode(JSON.stringify(data));
            const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,plain));
            return {format:'shirangi-encrypted-backup',version:1,kdf:'PBKDF2-SHA256',iterations:210000,cipher:'AES-256-GCM',salt:_backupB64(salt),iv:_backupB64(iv),data:_backupB64(cipher)};
        }
        async function _decryptBackupObject(envelope,password) {
            if(!envelope||envelope.format!=='shirangi-encrypted-backup'||envelope.version!==1) throw new Error('BACKUP_ENVELOPE_INVALID');
            if(String(password||'').length<1) throw new Error('BACKUP_PASSWORD_REQUIRED');
            const key=await _backupDeriveKey(password,_backupBytes(envelope.salt));
            const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:_backupBytes(envelope.iv)},key,_backupBytes(envelope.data));
            return JSON.parse(new TextDecoder().decode(plain));
        }
        async function exportBackup() {
            if (!isAdminUnlocked()) { requireAdmin(() => exportBackup()); return; }
            const password = prompt('برای رمزگذاری بکاپ یک رمز حداقل ۱۲ کاراکتری وارد کنید:');
            if (password === null) return;
            if (password.length < 12) { alert('رمز بکاپ باید حداقل ۱۲ کاراکتر باشد.'); return; }
            const data = {
                format:'shirangi-backup', version:3,
                appVersion:'1.9.1', exportedAt:new Date().toISOString(),
                properties:properties, agents:agents, customers:customers, owners:assistantOwners, routines:assistantRoutines,
                crm:{pipeline:crmPipeline,visits:crmVisits,activities:crmActivities,finance:crmFinance,profiles:crmProfiles}
            };
            const envelope = await _encryptBackupObject(data,password);
            const blob = new Blob([JSON.stringify(envelope)], {type:'application/json'});
            const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
            a.download='shirangi-backup-'+new Date().toISOString().slice(0,10)+'.sbackup'; a.click();
            const objectUrl=a.href; setTimeout(()=>URL.revokeObjectURL(objectUrl),2000);
            const msg=document.getElementById('backup-msg');
            if(msg){msg.textContent='بکاپ رمزگذاری‌شده دانلود شد';msg.className='text-sm text-center mt-3 text-green-400';msg.classList.remove('hidden');}
        }

        function importBackup(ev) {
            if (!isAdminUnlocked()) { requireAdmin(); return; }
            const file = ev.target.files && ev.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async () => {
                try {
                    if (file.size > 100 * 1024 * 1024) throw new Error('BACKUP_TOO_LARGE');
                    let data = JSON.parse(reader.result);
                    if (data?.format === 'shirangi-encrypted-backup') {
                        const password = prompt('رمز بکاپ را وارد کنید:');
                        if (password === null) return;
                        data = await _decryptBackupObject(data,password);
                    }
                    if (!data || !Array.isArray(data.properties)) {
                        alert('فایل بکاپ نامعتبر است.');
                        return;
                    }
                    const importedProperties = validateBackupArray(data.properties, 100000, 'لیست املاک').filter(p => {
                        const lat = Number(p.lat), lng = Number(p.lng);
                        if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
                        if (p.images && typeof p.images === 'object') {
                            for (const key of ['facade','alley','plan','unit']) {
                                if (p.images[key] != null && (!Array.isArray(p.images[key]) || p.images[key].length > 20 || p.images[key].some(x => typeof x !== 'string' || x.length > 4 * 1024 * 1024))) return false;
                            }
                        }
                        return true;
                    });
                    if (importedProperties.length !== data.properties.length) throw new Error('BACKUP_PROPERTY_INVALID');
                    const importedAgents = Array.isArray(data.agents) ? validateBackupArray(data.agents, 10000, 'لیست مشاوران').filter(a => typeof a.name === 'string' && a.name.length <= 200 && (!a.phone || String(a.phone).length <= 50)) : null;
                    const importedCustomers = Array.isArray(data.customers) ? validateBackupArray(data.customers, 10000, 'لیست مشتریان').filter(c => typeof c.name === 'string' && c.name.length <= 200 && (!c.phone || String(c.phone).length <= 50) && (!c.note || String(c.note).length <= 2000)) : null;
                    const importedOwners = Array.isArray(data.owners) ? validateBackupArray(data.owners, 10000, 'لیست مالکین').filter(o => typeof o.name === 'string' && o.name.length <= 200 && (!o.phone || String(o.phone).length <= 50) && (!o.note || String(o.note).length <= 1000)) : null;
                    const importedRoutines = Array.isArray(data.routines) ? validateBackupArray(data.routines, 10000, 'برنامه‌های روتین').filter(t => ROUTINE_PERIODS.includes(t.period) && typeof t.title === 'string' && t.title.length <= 200) : null;
                    if (!confirm('بازیابی باعث جایگزینی اطلاعات فعلی (املاک، مشاوران، مشتریان، مالکین و روتین‌ها) می‌شود. ادامه؟')) return;
                    properties = importedProperties.map(p => Object.assign({ status: 'available' }, p));
                    properties = typeof normalizePropertiesList === 'function' ? normalizePropertiesList(properties) : properties;
                    if (importedAgents !== null) agents = normalizeAgentsList(importedAgents);
                    if (importedCustomers !== null) customers = normalizeCustomersList(importedCustomers);
                    if (importedOwners !== null) assistantOwners = normalizeOwnersList(importedOwners);
                    if (importedRoutines !== null) assistantRoutines = normalizeRoutinesList(importedRoutines);
                    if (data.crm) {
                        const crm = data.crm;
                        const validList = (v,max,label)=>{ if(!Array.isArray(v)||v.length>max||v.some(x=>!x||typeof x!=='object'||Array.isArray(x))) throw new Error('BACKUP_CRM_INVALID_'+label); return v; };
                        crmPipeline=validList(crm.pipeline||[],50000,'PIPELINE'); crmVisits=validList(crm.visits||[],50000,'VISITS');
                        crmActivities=validList(crm.activities||[],100000,'ACTIVITIES'); crmFinance=validList(crm.finance||[],50000,'FINANCE');
                        crmProfiles=validList(crm.profiles||[],10000,'PROFILES'); await crmSave();
                    }
                    await saveProperties();
                    await saveAgents();
                    await saveCustomers();
                    await saveAssistantPlannerData();
                    // رفرش نقشه
                    if (mapInstance) {
                        propertyMarkers.forEach(pm => { try { mapInstance.removeLayer(pm.marker); } catch (e) {} });
                        propertyMarkers = [];
                        properties.forEach(p => addMarkerForProperty(p));
                    }
                    fillAgentSelect();
                    renderAgentsList();
                    renderCustomers();
                    clearFilters();
                    const msg = document.getElementById('backup-msg');
                    if (msg) {
                        msg.textContent = 'بازیابی موفق — ' + properties.length + ' ملک، ' + customers.length + ' مشتری، ' + assistantOwners.length + ' مالک و ' + assistantRoutines.length + ' روتین';
                        msg.className = 'text-sm text-center mt-3 text-green-400';
                        msg.classList.remove('hidden');
                    }
                    alert('بازیابی انجام شد.');
                } catch (err) {
                    console.error(err);
                    alert('فایل بکاپ نامعتبر، بیش از حد بزرگ، یا دارای داده ناسالم است.');
                }
                ev.target.value = '';
            };
            reader.readAsText(file);
        }

        // حالت کیوسک: بازگشت به خوش‌آمد بعد از بیکاری
        let _idleTimer = null;
        const IDLE_MS = 3 * 60 * 1000;
        function resetIdleTimer() {
            if (_idleTimer) clearTimeout(_idleTimer);
            _idleTimer = setTimeout(() => {
                if (typeof cancelPickLocationMode === 'function') cancelPickLocationMode();
                const active = document.querySelector('.screen.active');
                if (active && active.id === 'screen-welcome') return;
                // اگر ادمین باز است، از پنل خارج نشو مگر بیکاری طولانی — فقط به welcome
                goTo('welcome');
            }, IDLE_MS);
        }
        ['pointerdown','touchstart','keydown','mousemove','click'].forEach(evt => {
            document.addEventListener(evt, () => resetIdleTimer(), { passive: true });
        });
        resetIdleTimer();

        // ========== ابزارهای مشاور (کمیسیون + تبدیل رهن/اجاره) ==========
        function formatToman(n) {
            if (n == null || isNaN(n)) return '—';
            return Math.round(n).toLocaleString('fa-IR') + ' تومان';
        }
        function calcCommission() {
            const type = document.getElementById('comm-type')?.value || 'sale';
            const amount = parseAmountInput(document.getElementById('comm-amount')?.value);
            let sellerPct = parseNumericField(document.getElementById('comm-seller-pct')?.value) ?? 0;
            let buyerPct = parseNumericField(document.getElementById('comm-buyer-pct')?.value) ?? 0;
            const sellerEl = document.getElementById('comm-seller-res');
            const buyerEl = document.getElementById('comm-buyer-res');
            const totalEl = document.getElementById('comm-total-res');
            if (!amount) {
                if (sellerEl) sellerEl.textContent = '—';
                if (buyerEl) buyerEl.textContent = '—';
                if (totalEl) totalEl.textContent = '—';
                return;
            }
            if (type === 'rent') {
                // برای اجاره: معمولاً یک ماه اجاره از هر طرف یا جمع
                const oneMonth = amount; // اگر مبلغ ماهانه وارد شده
                const seller = oneMonth * (sellerPct / 100 || 1); // اگر درصد ۰ باشد فرض ۱ ماه
                const buyer = oneMonth * (buyerPct / 100 || 1);
                // اگر درصدها ۰٫۵ باشند، بهتر است برای اجاره درصد را ۱۰۰ در نظر بگیریم یا راهنمایی کنیم
                // ساده‌سازی: اگر کاربر درصد را تغییر نداده، یک ماه کامل از هر طرف
                const sPct = parseNumericField(document.getElementById('comm-seller-pct')?.value);
                const bPct = parseNumericField(document.getElementById('comm-buyer-pct')?.value);
                const s = (sPct === 0.5 && bPct === 0.5) ? oneMonth : (oneMonth * sellerPct / 100);
                const b = (sPct === 0.5 && bPct === 0.5) ? oneMonth : (oneMonth * buyerPct / 100);
                if (sellerEl) sellerEl.textContent = formatToman(s);
                if (buyerEl) buyerEl.textContent = formatToman(b);
                if (totalEl) totalEl.textContent = formatToman(s + b);
            } else {
                const s = amount * sellerPct / 100;
                const b = amount * buyerPct / 100;
                if (sellerEl) sellerEl.textContent = formatToman(s);
                if (buyerEl) buyerEl.textContent = formatToman(b);
                if (totalEl) totalEl.textContent = formatToman(s + b);
            }
        }
        function calcConvertFromRahn() {
            const rate = parseNumericField(document.getElementById('convert-rate')?.value) || 30;
            const rahnMil = parseAmountInput(document.getElementById('convert-rahn')?.value);
            if (rahnMil == null) {
                document.getElementById('convert-ejare').value = '';
                document.getElementById('convert-result').textContent = '—';
                return;
            }
            // هر ۱ میلیون رهن = rate هزار تومان اجاره
            const ejareHezar = rahnMil * rate;
            document.getElementById('convert-ejare').value = formatNumericInputValue(String(ejareHezar));
            document.getElementById('convert-result').textContent =
                `${rahnMil.toLocaleString('fa-IR')} میلیون رهن ≈ ${(ejareHezar / 1000).toLocaleString('fa-IR')} میلیون تومان اجاره ماهانه`;
        }
        function calcConvertFromEjare() {
            const rate = parseNumericField(document.getElementById('convert-rate')?.value) || 30;
            const ejareHezar = parseAmountInput(document.getElementById('convert-ejare')?.value);
            if (ejareHezar == null || rate <= 0) {
                document.getElementById('convert-rahn').value = '';
                document.getElementById('convert-result').textContent = '—';
                return;
            }
            const rahnMil = ejareHezar / rate;
            document.getElementById('convert-rahn').value = formatNumericInputValue(String(rahnMil));
            document.getElementById('convert-result').textContent =
                `${(ejareHezar / 1000).toLocaleString('fa-IR')} میلیون اجاره ≈ ${rahnMil.toLocaleString('fa-IR')} میلیون تومان رهن`;
        }
        function calcConvert() {
            // فقط وقتی نرخ عوض می‌شود، از رهن محاسبه کن اگر مقدار دارد
            if (document.getElementById('convert-rahn')?.value) calcConvertFromRahn();
            else if (document.getElementById('convert-ejare')?.value) calcConvertFromEjare();
        }

        function calcPricePerMeter() {
            const price = parseAmountInput(document.getElementById('ppm-price')?.value);
            const area = parseAmountInput(document.getElementById('ppm-area')?.value);
            const el = document.getElementById('ppm-result');
            if (!el) return;
            if (!price || !area || area <= 0) {
                el.textContent = '—';
                return;
            }
            const ppm = (window.ShirangiPricing && typeof window.ShirangiPricing.pricePerMeter === 'function')
                ? window.ShirangiPricing.pricePerMeter(price, area)
                : Math.round(price / area);
            el.textContent = formatToman(ppm) + ' / متر';
        }

        function calcLoan() {
            const amount = parseAmountInput(document.getElementById('loan-amount')?.value);
            const annualRate = parseNumericField(document.getElementById('loan-rate')?.value) || 0;
            const months = parseIntegerField(document.getElementById('loan-months')?.value) || 0;
            const mEl = document.getElementById('loan-monthly');
            const tEl = document.getElementById('loan-total');
            const iEl = document.getElementById('loan-interest');
            if (!amount || months <= 0) {
                if (mEl) mEl.textContent = '—';
                if (tEl) tEl.textContent = '—';
                if (iEl) iEl.textContent = '—';
                return;
            }
            let monthly, total, interest;
            if (window.ShirangiPricing && typeof window.ShirangiPricing.loanInstallment === 'function') {
                const r = window.ShirangiPricing.loanInstallment({ principal: amount, annualRatePercent: annualRate, months });
                if (!r) {
                    if (mEl) mEl.textContent = '—';
                    if (tEl) tEl.textContent = '—';
                    if (iEl) iEl.textContent = '—';
                    return;
                }
                monthly = r.monthly; total = r.totalPayment; interest = r.totalInterest;
            } else {
                const r = (annualRate / 100) / 12;
                if (r === 0) monthly = amount / months;
                else monthly = amount * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
                total = monthly * months;
                interest = total - amount;
            }
            if (mEl) mEl.textContent = formatToman(monthly);
            if (tEl) tEl.textContent = formatToman(total);
            if (iEl) iEl.textContent = formatToman(interest);
        }

        function crmToday(){ return todayJalali(); }
        function crmSave(){
            const data={pipeline:crmPipeline,visits:crmVisits,activities:crmActivities,finance:crmFinance,profiles:crmProfiles};
            if(isElectron && window.electronAPI?.writeJson) return window.electronAPI.writeJson('crm.json',data).catch(e=>({ok:false,error:String(e?.message||e)}));
            try{ShirangiRuntimeStorage.setItem('shirangi_crm',JSON.stringify(data));return Promise.resolve({ok:true});}catch(e){return Promise.resolve({ok:false,error:'LOCAL_STORAGE_FULL'});}
        }
        function crmRequireAdmin(actionFn){
            if (isAdminUnlocked()) { return Promise.resolve().then(actionFn); }
            requireAdmin(() => { Promise.resolve().then(actionFn).catch(e => { console.error('CRM action',e); alert('عملیات CRM انجام نشد.'); }); });
            return Promise.resolve(false);
        }
        async function crmLoad(){
            try{
                let d=null;
                if(isElectron && window.electronAPI?.readJson) d=await window.electronAPI.readJson('crm.json');
                else {const raw=ShirangiRuntimeStorage.getItem('shirangi_crm'); d=raw?JSON.parse(raw):null;}
                if(d){crmPipeline=Array.isArray(d.pipeline)?d.pipeline:[];crmVisits=Array.isArray(d.visits)?d.visits:[];crmActivities=Array.isArray(d.activities)?d.activities:[];crmFinance=Array.isArray(d.finance)?d.finance:[];crmProfiles=Array.isArray(d.profiles)?d.profiles:[];}
            }catch(e){}
        }
        function crmContactKey(type,id){return type+':'+id;}
        function crmContacts(){
            return [...assistantOwners.map(o=>({key:crmContactKey('owner',o.id),type:'owner',id:o.id,name:o.name,number:o.ownerNumber,phone:o.phone})),...customers.map(c=>({key:crmContactKey('customer',c.id),type:'customer',id:c.id,name:c.name,number:c.customerNumber,phone:c.phone}))];
        }
        function crmFillSelect(id, includeProperties){
            const el=document.getElementById(id); if(!el)return;
            if(includeProperties){el.innerHTML='<option value="">فایل...</option>'+properties.map(p=>`<option value="${safeJsArg(p.id)}">${escapeHtml(p.title||p.address||'بدون عنوان')} — ${escapeHtml(p.district||'')}</option>`).join('');return;}
            const cs=crmContacts(); el.innerHTML='<option value="">مخاطب...</option>'+cs.map(c=>`<option value="${c.key}">${escapeHtml(c.name)} — ${c.type==='owner'?'مالک':'مشتری'} #${c.number||'—'}</option>`).join('');
        }
        function crmRefreshSelectors(){['crm-pipeline-contact','crm-visit-contact','crm-activity-contact'].forEach(id=>crmFillSelect(id,false));crmFillSelect('crm-visit-property',true);}
        function saveCRMPipeline(){
            return crmRequireAdmin(async () => {
                const key=document.getElementById('crm-pipeline-contact')?.value;if(!key)return alert('مخاطب را انتخاب کنید.');
                const stage=document.getElementById('crm-pipeline-stage')?.value||'new';
                if(!Object.prototype.hasOwnProperty.call(CRM_STAGES, stage)) return alert('مرحله نامعتبر است.');
                const note=(document.getElementById('crm-pipeline-note')?.value||'').trim().slice(0,2000);
                const item={id:crypto.randomUUID(),key,stage,note,createdAt:Date.now()};
                crmPipeline.unshift(item); const r=await crmSave();
                if(!r?.ok){crmPipeline=crmPipeline.filter(x=>x!==item);alert('ذخیره مرحله ناموفق بود.');return;}
                document.getElementById('crm-pipeline-note').value='';renderCRM();
            });
        }
        function addCRMVisit(){
            return crmRequireAdmin(async () => {
                const contact=document.getElementById('crm-visit-contact')?.value, property=document.getElementById('crm-visit-property')?.value;
                if(!contact||!property)return alert('مشتری و فایل را انتخاب کنید.');
                if(!crmContactFromKey(contact)||!crmResolveProperty(property))return alert('مخاطب یا فایل نامعتبر است.');
                const date=normalizeJalaliDate(document.getElementById('crm-visit-date')?.value||'')||crmToday();
                const item={id:crypto.randomUUID(),contact,propertyId:String(property),date,result:document.getElementById('crm-visit-result')?.value||'نامشخص',note:(document.getElementById('crm-visit-note')?.value||'').trim().slice(0,2000)};
                crmVisits.unshift(item); const r=await crmSave();
                if(!r?.ok){crmVisits=crmVisits.filter(x=>x!==item);alert('ذخیره بازدید ناموفق بود.');return;}
                document.getElementById('crm-visit-note').value='';renderCRM();
            });
        }
        function addCRMActivity(){
            return crmRequireAdmin(async () => {
                const contact=document.getElementById('crm-activity-contact')?.value;if(!contact)return alert('مخاطب را انتخاب کنید.');
                if(!crmContactFromKey(contact))return alert('مخاطب نامعتبر است.');
                const rawNext=document.getElementById('crm-activity-next')?.value||'';
                if(rawNext && !normalizeJalaliDate(rawNext))return alert('تاریخ پیگیری نامعتبر است.');
                const item={id:crypto.randomUUID(),contact,result:document.getElementById('crm-activity-result')?.value||'پاسخ داد',nextDate:normalizeJalaliDate(rawNext)||'',note:(document.getElementById('crm-activity-note')?.value||'').trim().slice(0,2000),date:crmToday(),createdAt:Date.now()};
                crmActivities.unshift(item); const r=await crmSave();
                if(!r?.ok){crmActivities=crmActivities.filter(x=>x!==item);alert('ذخیره تماس ناموفق بود.');return;}
                document.getElementById('crm-activity-note').value='';document.getElementById('crm-activity-next').value='';renderCRM();
            });
        }
        function crmResolveContact(key){const c=crmContacts().find(x=>x.key===key);return c||{name:'مخاطب حذف‌شده',type:'',number:''};}
        function crmResolveProperty(id){return properties.find(p=>String(p.id)===String(id));}
        function renderCRMGlobalSearch(){
            const q=normalizeSearchQuery(document.getElementById('crm-global-search')?.value||''),box=document.getElementById('crm-global-results');if(!box)return;if(!q){box.innerHTML='';return;}
            const arr=[];crmContacts().forEach(c=>{if(normalizeSearchQuery([c.name,c.phone,c.number].join(' ')).includes(q))arr.push({label:c.name,sub:(c.type==='owner'?'مالک':'مشتری')+' #'+c.number+' · '+(c.phone||'بدون شماره'),phone:c.phone});});
            properties.filter(p=>normalizeSearchQuery([p.title,p.address,p.district,p.id].join(' ')).includes(q)).slice(0,8).forEach(p=>arr.push({label:p.title||p.address||'فایل',sub:'فایل '+(p.id||'')+' · '+(p.district||''),property:true,id:p.id}));
            box.innerHTML=arr.slice(0,15).map(x=>`<div class="p-2 rounded-lg bg-slate-800 border border-slate-700 flex justify-between gap-2"><div><b>${escapeHtml(x.label)}</b><div class="text-xs text-slate-400">${escapeHtml(x.sub)}</div></div>${x.phone?`<a href="tel:${escapeHtml(x.phone)}" class="px-2 py-1 bg-emerald-600 rounded-lg text-xs">تماس</a>`:''}</div>`).join('')||'<p class="text-slate-500">نتیجه‌ای پیدا نشد.</p>';
        }
        function crmStaleProperties(){
            const cutoff=Date.now()-30*86400000;return properties.filter(p=>{const t=p.updatedAt||p.createdAt;return t&&new Date(t).getTime()<cutoff&&p.status!=='archived';});
        }
        function crmDuplicateProperties(){
            const seen=new Map(),dups=[];properties.forEach(p=>{const k=normalizeSearchQuery([p.phone,p.address,p.district,p.area].filter(Boolean).join('|'));if(!k)return;if(seen.has(k))dups.push(p);else seen.set(k,p);});return dups;
        }
        function crmAmount(v){return Number(toEnglishDigits(String(v||'')).replace(/[^0-9.-]/g,''))||0;}
        function crmContactFromKey(key){return crmContacts().find(c=>c.key===key)||null;}
        function crmOpenContact360(key){
            if(!key){ const first=crmContacts()[0]; if(!first)return alert('هنوز مالک یا مشتری ثبت نشده است.'); key=first.key; }
            const c=crmContactFromKey(key); if(!c)return;
            const box=document.getElementById('crm-contact360-modal'), body=document.getElementById('crm-360-body'); if(!box||!body)return;
            const acts=crmActivities.filter(a=>a.contact===key), visits=crmVisits.filter(v=>v.contact===key), pipe=crmPipeline.filter(x=>x.key===key);
            const related=properties.filter(p=>String(p.ownerId||p.owner)==String(c.id)||String(p.customerId||p.customer)==String(c.id));
            const calls=acts.map(a=>({ts:a.createdAt||0,html:`تماس · ${escapeHtml(a.result)} · ${escapeHtml(toPersianNum(a.date))} ${a.note?'· '+escapeHtml(a.note):''}`}));
            const vs=visits.map(v=>({ts:v.id||0,html:`بازدید · ${escapeHtml(crmResolveProperty(v.propertyId)?.title||'فایل')} · ${escapeHtml(v.result)} · ${escapeHtml(toPersianNum(v.date))}`}));
            const ps=pipe.map(x=>({ts:x.createdAt||0,html:`قیف · ${escapeHtml(CRM_STAGES[x.stage]||x.stage)}${x.note?' · '+escapeHtml(x.note):''}`}));
            const timeline=[...calls,...vs,...ps].sort((a,b)=>b.ts-a.ts).slice(0,30);
            document.getElementById('crm-360-title').textContent=`${c.name} · ${c.type==='owner'?'مالک':'مشتری'} #${c.number||'—'}`;
            document.getElementById('crm-360-sub').textContent=`${c.phone||'بدون شماره'} · ${related.length.toLocaleString('fa-IR')} فایل مرتبط`;
            body.innerHTML=`<div class="grid md:grid-cols-3 gap-3 mb-4"><div class="p-3 rounded-xl bg-slate-800"><b>تماس‌ها</b><div class="text-2xl font-black">${acts.length.toLocaleString('fa-IR')}</div></div><div class="p-3 rounded-xl bg-slate-800"><b>بازدیدها</b><div class="text-2xl font-black">${visits.length.toLocaleString('fa-IR')}</div></div><div class="p-3 rounded-xl bg-slate-800"><b>مراحل</b><div class="text-2xl font-black">${pipe.length.toLocaleString('fa-IR')}</div></div></div><div class="grid lg:grid-cols-2 gap-4"><div><h4 class="font-bold text-emerald-300 mb-2">فایل‌های مرتبط</h4>${related.slice(0,20).map(p=>`<div class="p-2 mb-2 rounded-lg bg-slate-800 text-sm">${escapeHtml(p.title||p.address||'فایل')} · ${escapeHtml(p.district||'')}</div>`).join('')||'<p class="text-slate-500">فایلی ثبت نشده.</p>'}</div><div><h4 class="font-bold text-sky-300 mb-2">تایم‌لاین</h4>${timeline.map(x=>`<div class="p-2 mb-2 rounded-lg bg-slate-800 text-sm">${x.html}</div>`).join('')||'<p class="text-slate-500">فعالیتی ثبت نشده.</p>'}</div></div><div class="mt-4 flex gap-2">${c.phone?`<a href="tel:${escapeHtml(c.phone)}" class="touch-btn px-4 py-2 rounded-xl bg-emerald-600 font-bold">تماس با مخاطب</a>`:''}<button onclick="crmClose360()" class="touch-btn px-4 py-2 rounded-xl bg-slate-700">بازگشت</button></div>`;
            box.classList.remove('hidden');
        }
        function crmClose360(){document.getElementById('crm-contact360-modal')?.classList.add('hidden');}
        function crmTodayWork(){
            const today=crmToday(), list=[];
            [...customers.map(x=>({...x,_type:'مشتری'})),...assistantOwners.map(x=>({...x,_type:'مالک'}))].forEach(x=>{if(x.callDate&&!x.callDone&&normalizeJalaliDate(x.callDate)===today)list.push({kind:'تماس',name:x.name,type:x._type,phone:x.phone,key:crmContactKey(x._type==='مالک'?'owner':'customer',x.id),note:x.callNote||x.note||'',time:x.callTime||''});});
            crmActivities.filter(a=>a.nextDate===today).forEach(a=>{const c=crmResolveContact(a.contact);list.push({kind:'پیگیری',name:c.name,type:c.type==='owner'?'مالک':'مشتری',phone:c.phone,key:a.contact,note:a.note||'',time:''});});
            crmVisits.filter(v=>v.date===today).forEach(v=>{const c=crmResolveContact(v.contact),p=crmResolveProperty(v.propertyId);list.push({kind:'بازدید',name:c.name,type:c.type==='owner'?'مالک':'مشتری',phone:c.phone,key:v.contact,note:p?.title||p?.address||'فایل',time:''});});
            return list;
        }
        function crmRenderToday(){
            const work=crmTodayWork(), hot=customers.filter(c=>['داغ','hot'].includes(String(c.temperature||c.priority||'').toLowerCase())||String(c.note||'').includes('داغ')).slice(0,12);
            const stats=[['تماس امروز',work.filter(x=>x.kind==='تماس').length],['پیگیری',work.filter(x=>x.kind==='پیگیری').length],['بازدید',work.filter(x=>x.kind==='بازدید').length],['عقب‌افتاده',[...customers,...assistantOwners].filter(x=>x.callDate&&!x.callDone&&normalizeJalaliDate(x.callDate)!==crmToday()).length],['مشتری داغ',hot.length],['فایل جدید',properties.filter(p=>p.createdAt&&new Date(p.createdAt).toDateString()===new Date().toDateString()).length],['فایل قدیمی',crmStaleProperties().length],['مراحل باز',crmPipeline.filter(x=>x.stage!=='done').length]];
            const st=document.getElementById('crm-today-stats');if(st)st.innerHTML=stats.map(([l,v])=>`<div class="p-3 rounded-xl bg-slate-900 border border-slate-700 text-center"><div class="text-xl font-black">${Number(v).toLocaleString('fa-IR')}</div><div class="text-[11px] text-slate-400">${l}</div></div>`).join('');
            const wl=document.getElementById('crm-today-worklist');if(wl)wl.innerHTML=work.map(x=>`<div class="p-3 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-between gap-2"><div><b>${escapeHtml(x.name)}</b><span class="text-xs text-slate-400 mr-2">${x.type} · ${x.kind}${x.time?' · '+escapeHtml(x.time):''}</span><div class="text-xs text-slate-500 mt-1">${escapeHtml(x.note||'بدون یادداشت')}</div></div><div class="flex gap-1">${x.phone?`<a href="tel:${escapeHtml(x.phone)}" class="px-2 py-1 rounded-lg bg-emerald-600 text-xs">تماس</a>`:''}<button onclick="crmOpenContact360('${safeJsArg(x.key)}')" class="px-2 py-1 rounded-lg bg-sky-600 text-xs">۳۶۰</button></div></div>`).join('')||'<p class="text-slate-500 text-sm">امروز کاری ثبت نشده است.</p>';
            const hc=document.getElementById('crm-hot-customers');if(hc)hc.innerHTML=hot.map(c=>`<div class="p-2 rounded-lg bg-slate-800 flex justify-between items-center"><div><b>${escapeHtml(c.name)}</b><div class="text-xs text-slate-500">${escapeHtml(c.phone||'بدون شماره')}</div></div><button onclick="crmOpenContact360('customer:${safeJsArg(c.id)}')" class="px-2 py-1 rounded-lg bg-fuchsia-600 text-xs">پروفایل</button></div>`).join('')||'<p class="text-slate-500 text-sm">مشتری داغی مشخص نشده.</p>';
            const tc=document.getElementById('crm-today-count');if(tc)tc.textContent=work.length.toLocaleString('fa-IR')+' کار';
        }
        function crmNotifyToday(){
            const work=crmTodayWork();
            if(!work.length)return alert('برای امروز کاری ثبت نشده است.');
            const msg='امروز '+work.length.toLocaleString('fa-IR')+' کار داری: '+work.slice(0,3).map(x=>x.name+' ('+x.kind+')').join('، ')+(work.length>3?' و ...':'');
            if('Notification' in window && Notification.permission==='granted') new Notification('شیرنگی · برنامه امروز',{body:msg}); else if('Notification' in window && Notification.permission!=='denied') Notification.requestPermission().then(p=>{if(p==='granted')new Notification('شیرنگی · برنامه امروز',{body:msg});});
            alert(msg);
        }
        async function crmAddFinance(){
            return crmRequireAdmin(async () => {
                const type=document.getElementById('crm-fin-type')?.value,amount=crmAmount(document.getElementById('crm-fin-amount')?.value);
                if(!['income','expense','commission'].includes(type)||!Number.isFinite(amount)||amount<=0)return alert('مبلغ و نوع تراکنش معتبر وارد کنید.');
                const item={id:crypto.randomUUID(),type,amount,title:(document.getElementById('crm-fin-title')?.value||'بدون عنوان').trim().slice(0,200),note:(document.getElementById('crm-fin-note')?.value||'').trim().slice(0,2000),date:crmToday(),createdAt:Date.now()};
                crmFinance.unshift(item); const r=await crmSave(); if(!r?.ok){crmFinance=crmFinance.filter(x=>x!==item);alert('ذخیره تراکنش ناموفق بود.');return;}
                document.getElementById('crm-fin-amount').value='';document.getElementById('crm-fin-title').value='';document.getElementById('crm-fin-note').value='';renderCRM();
            });
        }
        function crmRenderFinance(){const income=crmFinance.filter(x=>x.type==='income'||x.type==='commission').reduce((a,x)=>a+x.amount,0),expense=crmFinance.filter(x=>x.type==='expense').reduce((a,x)=>a+x.amount,0),commission=crmFinance.filter(x=>x.type==='commission').reduce((a,x)=>a+x.amount,0);const sm=document.getElementById('crm-fin-summary');if(sm)sm.innerHTML=[['درآمد',income],['هزینه',expense],['کمیسیون',commission],['خالص',income-expense]].map(([l,v])=>`<div class="p-3 rounded-xl bg-slate-800 text-center"><div class="font-black text-lg">${Number(v).toLocaleString('fa-IR')} تومان</div><div class="text-xs text-slate-400">${l}</div></div>`).join('');const list=document.getElementById('crm-fin-list');if(list)list.innerHTML=crmFinance.slice(0,30).map(x=>`<div class="p-2 rounded-lg bg-slate-800 flex justify-between text-sm"><span>${escapeHtml(x.title)} · ${escapeHtml(x.date)}</span><b>${Number(x.amount).toLocaleString('fa-IR')} تومان</b></div>`).join('')||'<p class="text-slate-500">رکورد مالی نداریم.</p>';}
        async function crmAddProfile(){
            return crmRequireAdmin(async () => {
                const name=prompt('نام کاربر/مشاور را وارد کنید:');if(!name)return; const clean=name.trim().slice(0,200);if(!clean)return;
                const roleRaw=prompt('نقش: مدیر / مشاور / کارمند','مشاور')||'مشاور', role=['مدیر','مشاور','کارمند'].includes(roleRaw)?roleRaw:'مشاور';
                const item={id:crypto.randomUUID(),name:clean,role,active:true};crmProfiles.push(item);const r=await crmSave();if(!r?.ok){crmProfiles=crmProfiles.filter(x=>x!==item);alert('ذخیره کاربر ناموفق بود.');return;}renderCRM();
            });
        }
        function crmRenderProfiles(){const el=document.getElementById('crm-profiles-list');if(!el)return;el.innerHTML=(crmProfiles.length?crmProfiles:[{id:'local',name:'کاربر فعلی',role:'مدیر',active:true}]).map(x=>`<div class="p-3 rounded-xl bg-slate-800 border border-slate-700 flex justify-between"><div><b>${escapeHtml(x.name)}</b><div class="text-xs text-slate-400">${escapeHtml(x.role)}</div></div><span class="text-xs ${x.active?'text-emerald-400':'text-slate-500'}">${x.active?'فعال':'غیرفعال'}</span></div>`).join('');}
        function crmCsvEscape(value){
            return '"' + String(value ?? '').replace(/"/g,'""') + '"';
        }
        function crmParseCsv(text){
            const rows=[]; let row=[], field='', quoted=false;
            const input=String(text ?? '').replace(/^\ufeff/,'');
            for(let i=0;i<input.length;i++){
                const ch=input[i];
                if(quoted){
                    if(ch==='"' && input[i+1]==='"'){ field+='"'; i++; }
                    else if(ch==='"') quoted=false;
                    else field+=ch;
                }else if(ch==='"' && field===''){
                    quoted=true;
                }else if(ch===','){
                    row.push(field); field='';
                }else if(ch==='\n'){
                    row.push(field); field='';
                    if(row.some(v=>v!=='')) rows.push(row);
                    row=[];
                }else if(ch==='\r'){
                }else{
                    field+=ch;
                }
            }
            if(field!=='' || row.length){
                row.push(field);
                if(row.some(v=>v!=='')) rows.push(row);
            }
            return rows;
        }
        function crmExportExcel(){
            const rows=[
                ['نوع','شناسه','نام','شماره','تلفن','تاریخ','یادداشت'],
                ...crmContacts().map(c=>[c.type,c.id,c.name,c.number,c.phone||'','','']),
                ...crmActivities.map(a=>{const c=crmResolveContact(a.contact);return ['تماس',c.id,c.name,c.number,c.phone||'',a.date,a.note||''];})
            ];
            const csv='\ufeff'+rows.map(r=>r.map(crmCsvEscape).join(',')).join('\r\n');
            const a=document.createElement('a');
            a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
            a.download='shirangi-crm-export.csv';
            a.click();
            setTimeout(()=>URL.revokeObjectURL(a.href),1000);
        }
        function crmImportExcel(ev){
            const f=ev.target.files?.[0]; if(!f)return;
            const r=new FileReader();
            r.onload=()=>{
                const rows=crmParseCsv(r.result);
                if(rows.length<2)return alert('فایل خالی است.');
                let n=0, imported=0;
                for(const c of rows.slice(1)){
                    if(c[0]==='تماس'&&c[2]){
                        const found=crmContacts().find(x=>x.name===c[2] && (!c[4] || x.phone===c[4]));
                        if(found){
                            crmActivities.unshift({
                                id:Date.now()+n,
                                contact:found.key,
                                result:'پاسخ داد',
                                nextDate:'',
                                note:c[6]||'',
                                date:normalizeJalaliDate(c[5])||crmToday(),
                                createdAt:Date.now()
                            });
                            imported++;
                        }
                        n++;
                    }
                }
                crmSave().then(renderCRM);
                alert(imported.toLocaleString('fa-IR')+' تماس وارد شد؛ '+n.toLocaleString('fa-IR')+' ردیف بررسی شد.');
            };
            r.readAsText(f); ev.target.value='';
        }
        function renderCRM(){
            crmRefreshSelectors();
            const pipe=document.getElementById('crm-pipeline-list');if(pipe){pipe.innerHTML=crmPipeline.slice(0,30).map(x=>{const c=crmResolveContact(x.key);return `<div class="p-3 rounded-xl bg-slate-800 border border-slate-700"><div class="flex justify-between gap-2"><b>${escapeHtml(c.name)}</b><span class="text-xs text-violet-300">${CRM_STAGES[x.stage]||x.stage}</span></div><p class="text-xs text-slate-400 mt-1">${escapeHtml(x.note||'بدون یادداشت')}</p></div>`}).join('')||'<p class="text-slate-500 text-sm">هنوز مرحله‌ای ثبت نشده است.</p>';const pc=document.getElementById('crm-pipeline-count');if(pc)pc.textContent=crmPipeline.length.toLocaleString('fa-IR')+' مرحله';}
            const visits=document.getElementById('crm-visits-list');if(visits)visits.innerHTML=crmVisits.slice(0,10).map(v=>{const c=crmResolveContact(v.contact),p=crmResolveProperty(v.propertyId);return `<div class="p-2 rounded-lg bg-slate-800 border border-slate-700 text-xs"><b>${escapeHtml(c.name)}</b> · ${escapeHtml(p?.title||p?.address||'فایل حذف‌شده')} · ${escapeHtml(toPersianNum(v.date))}<div class="text-slate-400">${escapeHtml(v.result)}${v.note?' · '+escapeHtml(v.note):''}</div></div>`}).join('')||'<p class="text-slate-500 text-xs">بازدیدی ثبت نشده است.</p>';
            const acts=document.getElementById('crm-activities-list');if(acts)acts.innerHTML=crmActivities.slice(0,10).map(a=>{const c=crmResolveContact(a.contact);return `<div class="p-2 rounded-lg bg-slate-800 border border-slate-700 text-xs"><b>${escapeHtml(c.name)}</b> · ${escapeHtml(a.result)} · ${escapeHtml(toPersianNum(a.date))}<div class="text-slate-400">${escapeHtml(a.note||'بدون یادداشت')}${a.nextDate?' · پیگیری '+escapeHtml(toPersianNum(a.nextDate)):''}</div></div>`}).join('')||'<p class="text-slate-500 text-xs">سابقه تماسی ثبت نشده است.</p>';
            const stale=crmStaleProperties().length,dup=crmDuplicateProperties().length,overdue=[...customers,...assistantOwners].filter(x=>x.callDate&&!x.callDone&&normalizeJalaliDate(x.callDate)!==crmToday()).length;const al=document.getElementById('crm-alerts');if(al)al.innerHTML=`<div class="p-2 rounded-lg bg-amber-500/10">📌 ${overdue.toLocaleString('fa-IR')} پیگیری عقب‌افتاده</div><div class="p-2 rounded-lg bg-rose-500/10">🏠 ${stale.toLocaleString('fa-IR')} فایل قدیمی‌تر از ۳۰ روز</div><div class="p-2 rounded-lg bg-orange-500/10">⚠️ ${dup.toLocaleString('fa-IR')} مورد مشکوک به فایل تکراری</div>`;
            const today=crmToday(), report=[['تماس',crmActivities.filter(a=>a.date===today).length],['بازدید',crmVisits.filter(v=>v.date===today).length],['مخاطب جدید',crmContacts().length],['فایل فعال',properties.filter(p=>p.status!=='archived').length],['پیگیری باز',customers.filter(c=>c.callDate&&!c.callDone).length+assistantOwners.filter(o=>o.callDate&&!o.callDone).length],['مراحل قیف',crmPipeline.length]];const rb=document.getElementById('crm-daily-report');if(rb)rb.innerHTML=report.map(([l,v])=>`<div class="p-3 rounded-xl bg-slate-800 border border-slate-700 text-center"><div class="text-xl font-black text-white">${Number(v).toLocaleString('fa-IR')}</div><div class="text-xs text-slate-400">${l}</div></div>`).join('');
        }
        function initCRM(){crmLoad().then(()=>renderCRM());}

        // توابع سراسری برای دکمه‌ها و popup
        window.openDetail = openDetail;
        window.submitNewProperty = submitNewProperty;
        window.goTo = goTo;
        window.openAddBlank = openAddBlank;
        window.startPlaqueByPlaque = startPlaqueByPlaque;
        window.openPropertyPlaqueMode = openPropertyPlaqueMode;
        window.locatePropertyFromList = locatePropertyFromList;
        window.navigatePlaque = navigatePlaque;
        window.requestVisit = requestVisit;
        window.closeVisitModal = closeVisitModal;
        window.calcCommission = calcCommission;
        window.calcConvert = calcConvert;
        window.calcConvertFromRahn = calcConvertFromRahn;
        window.calcConvertFromEjare = calcConvertFromEjare;
        window.calcPricePerMeter = calcPricePerMeter;
        window.calcLoan = calcLoan;
        window.addCustomer = addCustomer;
        window.deleteCustomer = deleteCustomer;
        window.addAssistantOwner = addAssistantOwner;
        window.deleteAssistantOwner = deleteAssistantOwner;
        window.setOwnerReminder = setOwnerReminder;
        window.completeOwnerReminder = completeOwnerReminder;
        window.matchCustomer = matchCustomer;
        window.renderCustomers = renderCustomers;
        window.showGallery = showGallery;
        window.openLightbox = openLightbox;
        window.closeLightbox = closeLightbox;
        window.applyFilters = applyFilters;
        window.clearFilters = clearFilters;
        window.clearSearchOnly = clearSearchOnly;
        window.onSearchInput = onSearchInput;
        window.updateSearchClearBtn = updateSearchClearBtn;
        window.onFilterCategoryChange = onFilterCategoryChange;
        window.onFilterTypeChange = onFilterTypeChange;
        window.updateFilterPanels = updateFilterPanels;
        window.previewImage = previewImage;
        window.onMapSearchInput = onMapSearchInput;
        window.runMapDistrictSearch = runMapDistrictSearch;
        window.clearMapSearch = clearMapSearch;
        window.selectMapSearchResult = selectMapSearchResult;
        window.flyToDistrict = flyToDistrict;
        window.flyToProperty = flyToProperty;
        window.isAdminUnlocked = isAdminUnlocked;
        window.openEditProperty = openEditProperty;
        window.deleteCurrentProperty = deleteCurrentProperty;
        window.callPropertyAgent = callPropertyAgent;
        window.exportBackup = exportBackup;
        window.importBackup = importBackup;

        document.addEventListener('click', (e) => {
            const wrap = e.target.closest && e.target.closest('#map-search-input, #map-search-results, #map-search-clear, button[onclick="runMapDistrictSearch()"]');
            if (wrap) return;
            // also keep open if clicking inside search panel
            if (e.target.closest && e.target.closest('.absolute.top-4')) return;
            const box = document.getElementById('map-search-results');
            if (box && !box.classList.contains('hidden')) box.classList.add('hidden');
        });

        // Init list on load (hidden)
        async function bootApp() {
            if (isElectron) {
                await loadFromDisk();
                const et = document.getElementById('electron-tools');
                if (et) et.classList.remove('hidden');
            }
            if (getSupabase()) { try { await pullSubscriptionFromCloud(); } catch (_) {} }
            updateSubscriptionUI();
            renderList();
            fillAgentSelect();
            await initAdminSecurity();
            updateFilterPanels();
            updateSearchClearBtn();
            // اگر روی نقشه بودیم و مارکرها از قبل ساخته نشده‌اند، بعداً initMap صدا زده می‌شود
            if (isElectron && typeof mapInstance !== 'undefined' && mapInstance) {
                propertyMarkers.forEach(pm => { try { mapInstance.removeLayer(pm.marker); } catch (e) {} });
                propertyMarkers = [];
                properties.forEach(p => addMarkerForProperty(p));
            }
        }
        window.saveCRMPipeline = saveCRMPipeline; window.addCRMVisit = addCRMVisit; window.addCRMActivity = addCRMActivity; window.renderCRMGlobalSearch = renderCRMGlobalSearch;
        // Deal Engine bridge: expose read-only CRM views + controlled stage write.
        window.ShirangiDealEngineData = {
            contacts: () => crmContacts(),
            pipeline: () => crmPipeline,
            activities: () => crmActivities,
            visits: () => crmVisits,
            properties: () => properties,
            saveStage: async (key, stage, note) => crmRequireAdmin(async () => {
                if (!Object.prototype.hasOwnProperty.call(CRM_STAGES, stage)) return {ok:false};
                const item={id:crypto.randomUUID(),key,stage,note:String(note||'').slice(0,500),createdAt:Date.now()};
                crmPipeline.unshift(item); const r=await crmSave();
                if(!r?.ok){crmPipeline=crmPipeline.filter(x=>x!==item);return {ok:false};}
                renderCRM(); window.dispatchEvent(new CustomEvent('shirangi:crm-updated')); return {ok:true};
            })
        };
        setupNumericInputs();
        bootApp().then(() => initCRM());

        // دکمه تمام‌صفحه برای Electron (کیوسک)
        if (isElectron) {
            window.toggleKioskFullscreen = async function () {
                const on = await window.electronAPI.toggleFullscreen();
                return on;
            };
            window.openKioskDataFolder = function () {
                window.electronAPI.openDataFolder();
            };
        }

/* ===== 11: js/shirangi-deal-engine.js ===== */
/* SHIRANGI PROJECT LAYER — project-owned integration marker.
 * Runtime layer registry: identifies this module as part of Shirangi Real Estate Kiosk.
 * Third-party libraries/data remain subject to their own licenses and attribution.
 */
(function () {
  if (typeof window === 'undefined') return;
  window.__SHIRANGI_BRAND__ = window.__SHIRANGI_BRAND__ || Object.freeze({
    product: 'Shirangi Real Estate Kiosk', owner: 'Shirangi', namespace: 'shirangi'
  });
  window.__SHIRANGI_LAYERS__ = window.__SHIRANGI_LAYERS__ || [];
  var id = 'shirangi-deal-engine';
  if (!window.__SHIRANGI_LAYERS__.some(function (x) { return x.id === id; })) {
    window.__SHIRANGI_LAYERS__.push({ id: id, name: 'Shirangi — ' + id, product: 'Shirangi Real Estate Kiosk' });
  }
}());
/* Shirangi Deal Engine 1.9.1 — local-first sales next-action engine */
(function(){'use strict';
  const STAGES={new:'جدید',negotiation:'مذاکره',visit:'بازدید',agreement:'توافق',contract:'قرارداد',done:'انجام شد'};
  const ORDER=['new','negotiation','visit','agreement','contract','done'];
  const $=id=>document.getElementById(id);
  const fa=n=>Number(n||0).toLocaleString('fa-IR');
  const esc=s=>window.escapeHtml?escapeHtml(String(s??'')):String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const api=()=>window.ShirangiDealEngineData;
  function contacts(){return api()?.contacts?.()||[]}
  function pipeline(){return api()?.pipeline?.()||[]}
  function activities(){return api()?.activities?.()||[]}
  function visits(){return api()?.visits?.()||[]}
  function properties(){return api()?.properties?.()||[]}
  function scoreContact(c){
    const ps=pipeline().filter(x=>x.key===c.key), acts=activities().filter(x=>x.contact===c.key), vs=visits().filter(x=>x.contact===c.key);
    const latest=ps.slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))[0];
    const stage=latest?.stage||'new';
    let score={new:18,negotiation:48,visit:62,agreement:78,contract:92,done:100}[stage]||18;
    score+=Math.min(18,vs.filter(v=>v.result==='مثبت').length*7);
    score+=Math.min(12,acts.length*2);
    const overdue=(c.callDate&& !c.callDone && window.reminderStatus)?window.reminderStatus(c)==='معوق':false;
    if(overdue) score+=7;
    if(!c.phone) score-=5;
    return {score:Math.max(0,Math.min(99,Math.round(score))),stage,latest,acts,vs};
  }
  function nextAction(c,meta){
    if(meta.stage==='done') return {title:'معامله انجام شده',detail:'نیاز به اقدام فروش ندارد.',kind:'done'};
    if(c.callDate&&!c.callDone){
      const st=window.reminderStatus?window.reminderStatus(c):'';
      if(st==='معوق') return {title:'همین حالا تماس بگیر',detail:'پیگیری این مخاطب عقب افتاده است.',kind:'urgent'};
      if(st==='امروز') return {title:'تماس برنامه‌ریزی‌شده امروز',detail:`ساعت ${c.callTime||'10:00'}`,kind:'call'};
    }
    const map={new:['تماس اولیه','نیاز مشتری را تأیید و یک فایل مناسب پیشنهاد کن.','call'],negotiation:['پیگیری مذاکره','آخرین مانع خرید را مشخص کن و اقدام بعدی را قطعی کن.','follow'],visit:['پیگیری بازدید','نظر مشتری را بگیر و نتیجه را به مرحله بعد ببر.','visit'],agreement:['نهایی‌سازی توافق','قیمت و شرایط را جمع‌بندی و زمان قرارداد را مشخص کن.','close'],contract:['پیگیری قرارداد','مدارک و زمان امضا/تسویه را بررسی کن.','contract']};
    const x=map[meta.stage]||map.new; return {title:x[0],detail:x[1],kind:x[2]};
  }
  function candidates(){return contacts().filter(c=>c.type==='customer').map(c=>{const m=scoreContact(c);return {...c,...m,action:nextAction(c,m)}}).filter(x=>x.stage!=='done').sort((a,b)=>b.score-a.score)}
  function advance(key){
    const c=contacts().find(x=>x.key===key); if(!c||!api()?.saveStage)return;
    const m=scoreContact(c), idx=ORDER.indexOf(m.stage), next=ORDER[Math.min(ORDER.length-1,Math.max(0,idx+1))];
    if(next===m.stage)return;
    api().saveStage(key,next,'اقدام سریع Deal Engine').then(()=>render());
  }
  function schedule(key){
    const c=contacts().find(x=>x.key===key); if(!c)return;
    if(c.type==='customer'&&window.setCustomerReminder) window.setCustomerReminder(c.id);
    else if(c.type==='owner'&&window.setOwnerReminder) window.setOwnerReminder(c.id);
    setTimeout(render,250);
  }
  function open360(key){if(window.crmOpenContact360)window.crmOpenContact360(key)}
  function inject(){
    if($('shirangi-deal-engine')) return;
    const anchor=$('crm-today-worklist')?.closest('.lg\\:col-span-2') || $('crm-today-worklist')?.parentElement;
    if(!anchor) return;
    const sec=document.createElement('section'); sec.id='shirangi-deal-engine'; sec.className='bg-slate-800 rounded-2xl border border-violet-500/40 p-5 mt-4';
    sec.innerHTML=`<div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4"><div><h3 class="text-xl font-black text-violet-300"><i class="fas fa-bullseye ml-2"></i>Deal Engine</h3><p class="text-xs text-slate-400 mt-1">موتور اقدام بعدی؛ مشتری‌هایی که بیشترین احتمال پیشرفت معامله را دارند</p></div><div class="flex gap-2"><span id="de-score-badge" class="px-3 py-2 rounded-xl bg-violet-500/10 text-violet-300 text-xs font-bold"></span><button onclick="shirangiDealRefresh()" class="touch-btn px-3 py-2 rounded-xl bg-slate-700 text-sm font-bold"><i class="fas fa-rotate ml-1"></i>به‌روزرسانی</button></div></div><div id="de-mission" class="grid md:grid-cols-3 gap-2 mb-4"></div><div id="de-cards" class="grid lg:grid-cols-2 gap-3"></div>`;
    anchor.parentElement.insertBefore(sec,anchor.nextSibling);
  }
  function render(){
    inject(); const cards=$('de-cards'), mission=$('de-mission'), badge=$('de-score-badge'); if(!cards)return;
    const list=candidates().slice(0,6); const hot=list.filter(x=>x.score>=70).length;
    if(badge)badge.textContent=`${fa(hot)} مشتری داغ · ${fa(list.length)} فرصت باز`;
    const counts={call:list.filter(x=>x.action.kind==='call'||x.action.kind==='urgent').length,follow:list.filter(x=>x.action.kind==='follow').length,close:list.filter(x=>['close','contract'].includes(x.action.kind)).length};
    if(mission)mission.innerHTML=[['تماس فوری',counts.call,'bg-rose-500/10 text-rose-300'],['پیگیری مذاکره',counts.follow,'bg-amber-500/10 text-amber-300'],['نهایی‌سازی',counts.close,'bg-emerald-500/10 text-emerald-300']].map(x=>`<div class="p-3 rounded-xl border border-slate-700 ${x[2]}"><div class="text-xl font-black">${fa(x[1])}</div><div class="text-xs mt-1">${x[0]}</div></div>`).join('');
    if(!list.length){cards.innerHTML='<div class="lg:col-span-2 p-6 rounded-xl bg-slate-900/70 text-center text-slate-500">هنوز فرصت فروشی برای تحلیل وجود ندارد. مشتری و مرحله قیف را ثبت کنید.</div>';return}
    cards.innerHTML=list.map(x=>{const pct=x.score>=80?'داغ':x.score>=60?'گرم':'در حال شکل‌گیری'; const prop=properties().find(p=>x.latest?.propertyId&&String(p.id)===String(x.latest.propertyId)); return `<div class="rounded-xl border border-slate-700 bg-slate-900/80 p-4"><div class="flex items-start gap-3"><div class="w-12 h-12 rounded-xl bg-violet-600 flex items-center justify-center font-black text-lg">${fa(x.number||'—')}</div><div class="flex-1 min-w-0"><div class="flex flex-wrap gap-2 items-center"><b>${esc(x.name)}</b><span class="text-xs px-2 py-1 rounded-lg bg-slate-700">${STAGES[x.stage]}</span><span class="text-xs px-2 py-1 rounded-lg ${x.score>=80?'bg-rose-500/15 text-rose-300':x.score>=60?'bg-amber-500/15 text-amber-300':'bg-slate-700 text-slate-300'}">${pct} · ${fa(x.score)}٪</span></div><p class="text-sm text-violet-300 mt-2"><i class="fas fa-bolt ml-1"></i>${esc(x.action.title)}</p><p class="text-xs text-slate-400 mt-1">${esc(x.action.detail)}</p>${prop?`<p class="text-xs text-slate-500 mt-1">فایل: ${esc(prop.title||prop.address||'—')}</p>`:''}</div></div><div class="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-700"><button onclick="shirangiDealSchedule('${encodeURIComponent(x.key)}')" class="touch-btn px-3 py-2 bg-amber-600 rounded-lg text-xs font-bold">برنامه تماس</button><button onclick="shirangiDealAdvance('${encodeURIComponent(x.key)}')" class="touch-btn px-3 py-2 bg-emerald-600 rounded-lg text-xs font-bold">مرحله بعد</button><button onclick="shirangiDeal360('${encodeURIComponent(x.key)}')" class="touch-btn px-3 py-2 bg-sky-600 rounded-lg text-xs font-bold">۳۶۰ درجه</button></div></div>`}).join('');
  }
  window.shirangiDealRefresh=render;
  window.shirangiDealAdvance=k=>advance(decodeURIComponent(k));
  window.shirangiDealSchedule=k=>schedule(decodeURIComponent(k));
  window.shirangiDeal360=k=>open360(decodeURIComponent(k));
  window.addEventListener('shirangi:crm-updated',render);
  document.addEventListener('DOMContentLoaded',()=>setTimeout(render,50));
  setTimeout(render,300);
})();


/* ===== 12: js/shirangi-platform-core.js ===== */
/* SHIRANGI PROJECT LAYER — project-owned integration marker.
 * Runtime layer registry: identifies this module as part of Shirangi Real Estate Kiosk.
 * Third-party libraries/data remain subject to their own licenses and attribution.
 */
(function () {
  if (typeof window === 'undefined') return;
  window.__SHIRANGI_BRAND__ = window.__SHIRANGI_BRAND__ || Object.freeze({
    product: 'Shirangi Real Estate Kiosk', owner: 'Shirangi', namespace: 'shirangi'
  });
  window.__SHIRANGI_LAYERS__ = window.__SHIRANGI_LAYERS__ || [];
  var id = 'shirangi-platform-core';
  if (!window.__SHIRANGI_LAYERS__.some(function (x) { return x.id === id; })) {
    window.__SHIRANGI_LAYERS__.push({ id: id, name: 'Shirangi — ' + id, product: 'Shirangi Real Estate Kiosk' });
  }
}());
/* Shirangi Platform Core 13.0 — unified infrastructure layer
 * Local-first, deterministic, approval-safe. Provides schema versioning, event bus,
 * feature flags, RBAC, validated import/export, backup/restore, migrations,
 * observability, conflict-safe sync primitives, audit and health diagnostics.
 */
(function(){'use strict';
const VERSION='13.0.0', KEY='shirangi_platform_core_v130';
const now=()=>new Date().toISOString();
const uid=p=>(p||'sp')+'_'+crypto.randomUUID();
const clone=o=>JSON.parse(JSON.stringify(o));
function load(){try{return JSON.parse(ShirangiRuntimeStorage.getItem(KEY)||'{}')}catch(_){return {}}}
let state=Object.assign({schemaVersion:1,features:{platformCore:true,observability:true,importStudio:true,backup:true},role:'admin',audit:[],metrics:{events:0,errors:0},outbox:[],snapshots:[],migrations:[]},load());
function persist(){try{ShirangiRuntimeStorage.setItem(KEY,JSON.stringify(state));return true}catch(_){return false}}
function audit(type,data){state.audit.unshift({id:uid('audit'),at:now(),type,data:clone(data||{})});state.audit=state.audit.slice(0,500);persist()}
const listeners={};
function emit(type,payload){state.metrics.events++;(listeners[type]||[]).slice().forEach(fn=>{try{fn(payload)}catch(e){state.metrics.errors++;audit('event.error',{type,message:e.message})}});persist();return true}
function on(type,fn){(listeners[type]||(listeners[type]=[])).push(fn);return()=>{listeners[type]=(listeners[type]||[]).filter(x=>x!==fn)}}
function setFeature(name,enabled){state.features[name]=!!enabled;audit('feature.changed',{name,enabled});emit('feature.changed',{name,enabled});return !!enabled}
function feature(name){return state.features[name]!==false}
const permissions={admin:['*'],manager:['read','write','approve','export','backup'],consultant:['read','write'],accountant:['read','finance','export'],viewer:['read']};
function can(action,role=state.role){const p=permissions[role]||[];return p.includes('*')||p.includes(action)}
function setRole(role){if(!permissions[role])throw Error('ROLE_NOT_FOUND');if(state.role&&state.role!=='admin'&&role!==state.role)throw Error('PERMISSION_DENIED');state.role=role;audit('role.changed',{role});return role}
function checksum(obj){let s=JSON.stringify(obj),h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16)}
function validateRecord(type,r){if(!r||typeof r!=='object')return {ok:false,errors:['record_not_object']};const errors=[];if(type==='customer'&&!String(r.name||r.phone||r.mobile||'').trim())errors.push('customer_identity_missing');if(type==='property'&&!String(r.title||r.address||r.code||'').trim())errors.push('property_identity_missing');return {ok:errors.length===0,errors}}
function importRecords(type,records,{dryRun=true}={}){if(!Array.isArray(records))return {ok:false,errors:['records_not_array']};const accepted=[],errors=[];records.forEach((r,i)=>{const v=validateRecord(type,r);if(v.ok)accepted.push(clone(r));else errors.push({index:i,errors:v.errors})});const result={ok:errors.length===0,accepted:accepted.length,errors,records:accepted,dryRun};if(!dryRun){if(!can('write'))throw Error('PERMISSION_DENIED');const key=type==='customer'?'customers':type==='property'?'properties':type+'s';const existing=Array.isArray(window[key])?window[key]:[];accepted.forEach(r=>existing.push(r));audit('import.commit',{type,count:accepted.length});emit('data.changed',{type,count:accepted.length})}return result}
function exportRecords(type,records){if(!can('export'))throw Error('PERMISSION_DENIED');const data={format:'shirangi-export',version:VERSION,type,createdAt:now(),records:Array.isArray(records)?clone(records):[],checksum:checksum(records||[])};audit('export.created',{type,count:data.records.length});return data}
function backup(payload){if(!can('backup'))throw Error('PERMISSION_DENIED');const data={format:'shirangi-backup',version:VERSION,createdAt:now(),payload:clone(payload||{}),checksum:checksum(payload||{})};state.snapshots.unshift({id:uid('snap'),createdAt:data.createdAt,checksum:data.checksum,size:JSON.stringify(data).length});state.snapshots=state.snapshots.slice(0,30);audit('backup.created',{checksum:data.checksum});persist();return data}
function restore(bundle,{dryRun=true}={}){if(!bundle||bundle.format!=='shirangi-backup')return {ok:false,errors:['invalid_backup']};if(checksum(bundle.payload)!==bundle.checksum)return {ok:false,errors:['checksum_mismatch']};if(!dryRun){if(!can('backup'))throw Error('PERMISSION_DENIED');Object.keys(bundle.payload||{}).forEach(k=>{try{ShirangiRuntimeStorage.setItem(k,JSON.stringify(bundle.payload[k]))}catch(_){}});audit('backup.restored',{checksum:bundle.checksum})}return {ok:true,dryRun,checksum:bundle.checksum}}
function migrate(from,to,data){if(from>to)throw Error('DOWNGRADE_NOT_SUPPORTED');let out=clone(data||{});for(let v=from;v<to;v++){if(v===1){out._platform={initializedAt:out._platform?.initializedAt||now(),schema:2};state.migrations.push({from:1,to:2,at:now()})}}persist();return out}
function recordMetric(name,value=1){state.metrics[name]=(state.metrics[name]||0)+Number(value||0);persist();return state.metrics[name]}
function queueSync(op){const item={id:uid('sync'),at:now(),op:clone(op),status:'pending'};state.outbox.push(item);state.outbox=state.outbox.slice(-300);audit('sync.queued',{id:item.id});persist();return item}
function resolveConflict(local,remote){const lt=new Date(local?.updatedAt||0).getTime(),rt=new Date(remote?.updatedAt||0).getTime();if(rt>lt)return {winner:'remote',record:clone(remote)};return {winner:'local',record:clone(local)}}
function health(){let storage=true;try{const t='__sp_h';ShirangiRuntimeStorage.setItem(t,'1');ShirangiRuntimeStorage.removeItem(t)}catch(_){storage=false}return {version:VERSION,schema:state.schemaVersion,storage,role:state.role,features:Object.keys(state.features).filter(k=>state.features[k]),pendingSync:state.outbox.filter(x=>x.status==='pending').length,auditEntries:state.audit.length,events:state.metrics.events,errors:state.metrics.errors,online:typeof navigator!=='undefined'?navigator.onLine:true}}
function diagnostics(){return {health:health(),checks:{dealEngine:!!window.ShirangiDealEngineData,dealOperations:!!window.ShirangiDealOperations,platformCore:true,core:!!window.ShirangiCore,commission:!!window.ShirangiCommission,pricing:!!window.ShirangiPricing,matching:!!window.ShirangiMatching},storageKeys:ShirangiRuntimeStorage.keys().filter(k=>/^shirangi_/i.test(k)).length}}
const api={version:VERSION,get state(){return clone(state)},on,emit,audit,feature,setFeature,can,setRole,permissions,validateRecord,importRecords,exportRecords,backup,restore,migrate,recordMetric,queueSync,resolveConflict,health,diagnostics,checksum};
window.ShirangiPlatformCore=api;
document.addEventListener('DOMContentLoaded',()=>{const host=document.querySelector('#app')||document.querySelector('main');if(!host||document.getElementById('shirangi-platform-core-panel'))return;const e=document.createElement('section');e.id='shirangi-platform-core-panel';e.dir='rtl';e.style.cssText='margin:16px;padding:16px;border:1px solid rgba(127,127,127,.25);border-radius:18px;background:rgba(127,127,127,.04);font-family:inherit';const h=health();e.innerHTML='<div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap"><div><b>🏗️ Shirangi Platform Core 13.0</b><div style="opacity:.7;font-size:12px;margin-top:4px">هسته زیرساختی: سلامت، دسترسی، Backup، Import، Audit و Sync</div></div><div style="display:flex;gap:8px;flex-wrap:wrap"><span style="padding:6px 10px;border-radius:10px;background:rgba(127,127,127,.12)">نقش: <b>'+h.role+'</b></span><span style="padding:6px 10px;border-radius:10px;background:rgba(127,127,127,.12)">Sync: <b>'+h.pendingSync+'</b></span><span style="padding:6px 10px;border-radius:10px;background:rgba(127,127,127,.12)">Audit: <b>'+h.auditEntries+'</b></span></div></div>';host.appendChild(e)});
})();


/* ===== 13: js/shirangi-security-guard.js ===== */
/* SHIRANGI PROJECT LAYER — project-owned integration marker.
 * Runtime layer registry: identifies this module as part of Shirangi Real Estate Kiosk.
 * Third-party libraries/data remain subject to their own licenses and attribution.
 */
(function () {
  if (typeof window === 'undefined') return;
  window.__SHIRANGI_BRAND__ = window.__SHIRANGI_BRAND__ || Object.freeze({
    product: 'Shirangi Real Estate Kiosk', owner: 'Shirangi', namespace: 'shirangi'
  });
  window.__SHIRANGI_LAYERS__ = window.__SHIRANGI_LAYERS__ || [];
  var id = 'shirangi-security-guard';
  if (!window.__SHIRANGI_LAYERS__.some(function (x) { return x.id === id; })) {
    window.__SHIRANGI_LAYERS__.push({ id: id, name: 'Shirangi — ' + id, product: 'Shirangi Real Estate Kiosk' });
  }
}());
/* Shirangi Security Guard 24.0.1 — client-side hardening / kiosk privacy */
(function(){'use strict';
const KEY='shirangi_security_guard_v1';
const now=()=>Date.now();
const safe=(fn)=>{try{return fn()}catch(_){return null}};
function state(){return safe(()=>JSON.parse(ShirangiRuntimeStorage.getItem(KEY)||'{}'))||{}};
function save(s){safe(()=>ShirangiRuntimeStorage.setItem(KEY,JSON.stringify(s)));}
function touch(){const s=state();s.lastActivity=now();s.sessionStarted=s.sessionStarted||now();save(s);}
function privacy(){
  if(!window.electronAPI || !window.electronAPI.adminLogout) return;
  const s=state();
  if(s.lastActivity && now()-s.lastActivity>15*60*1000){ safe(()=>window.electronAPI.adminLogout()); s.lastActivity=0; save(s); }
}
['pointerdown','keydown','touchstart','mousemove'].forEach(e=>document.addEventListener(e,touch,{passive:true}));
setInterval(privacy,30000);
// Prevent accidental kiosk escape paths in packaged Electron.
if(window.electronAPI?.isElectron){
  document.addEventListener('contextmenu',e=>e.preventDefault());
  document.addEventListener('dragstart',e=>{ if(e.target?.tagName==='IMG') e.preventDefault(); });
}
window.shirangiSecurityStatus=()=>({lastActivity:state().lastActivity||0,sessionAge:state().sessionStarted?now()-state().sessionStarted:0});
touch();
})();



/* ===== 14: js/shirangi-enterprise-cloud-bridge.js ===== */
/* SHIRANGI — Enterprise Cloud Bridge (hardened)
 * Cloud-preferred document sync via RPC shirangi_enterprise_upsert / fetch.
 * Always mirrors locally; outbox drains when session + network return.
 */
(function (global) {
  'use strict';
  const OUTBOX_KEY = 'shirangi_enterprise_outbox_v1';
  const META_KEY = 'shirangi_enterprise_cloud_meta_v1';
  const LOCAL_PREFIX = 'shirangi_enterprise_';

  function cfg() { return global.SHIRANGI_CONFIG || {}; }
  function cloudReady() {
    return global.ShirangiConfigGuard ? global.ShirangiConfigGuard.isCloudReady() : false;
  }
  function preferCloud() {
    return !!cfg().useSupabase && cfg().enterpriseCloudPreferred !== false && cloudReady();
  }
  function localKey(table) {
    return LOCAL_PREFIX + String(table || 'blob').replace(/[^a-z0-9_]/gi, '_').slice(0, 64);
  }
  function readOutbox() {
    try { return JSON.parse(ShirangiRuntimeStorage.getItem(OUTBOX_KEY) || '[]'); } catch { return []; }
  }
  function writeOutbox(list) {
    try { ShirangiRuntimeStorage.setItem(OUTBOX_KEY, JSON.stringify((list || []).slice(0, 500))); } catch (_) {}
  }
  function enqueue(op) {
    const list = readOutbox();
    const item = Object.assign({
      id: 'ob_' + crypto.randomUUID(),
      at: new Date().toISOString(),
      status: 'pending',
      attempts: 0
    }, op);
    list.unshift(item);
    writeOutbox(list);
    return item;
  }
  async function ensureAnonSession() {
    try {
      if (!global.supabase || !cfg().useSupabase) return null;
      const { data } = await global.supabase.auth.getSession();
      if (data?.session) return data.session;
      const { data: signed, error } = await global.supabase.auth.signInAnonymously();
      if (error) throw error;
      return signed?.session || null;
    } catch (e) {
      global.ShirangiCore?.reportError?.('enterprise-cloud:anon', e);
      return null;
    }
  }
  function mirrorLocal(table, payload) {
    const key = localKey(table);
    const next = typeof payload === 'function'
      ? payload((() => { try { return JSON.parse(ShirangiRuntimeStorage.getItem(key) || 'null'); } catch { return null; } })())
      : payload;
    ShirangiRuntimeStorage.setItem(key, JSON.stringify(next));
    return next;
  }
  async function rpcFetchMeta(table, docId) {
    const { data, error } = await global.supabase.rpc('shirangi_enterprise_fetch_meta', {
      p_table: table,
      p_doc_id: docId || '_root'
    });
    return { data, error };
  }
  async function rpcUpsert(table, payload, docId, expectedVersion = 0) {
    const { data, error } = await global.supabase.rpc('shirangi_enterprise_upsert', {
      p_table: table,
      p_payload: payload,
      p_doc_id: docId || '_root',
      p_expected_version: Number.isInteger(expectedVersion) ? expectedVersion : 0
    });
    return { data, error };
  }
  function cloudVersionKey(table, docId) { return META_KEY + ':version:' + table + ':' + (docId || '_root'); }
  function readCloudVersion(table, docId) {
    try { return Math.max(0, Number.parseInt(ShirangiRuntimeStorage.getItem(cloudVersionKey(table, docId)) || '0', 10) || 0); } catch { return 0; }
  }
  function writeCloudVersion(table, docId, version) {
    try { ShirangiRuntimeStorage.setItem(cloudVersionKey(table, docId), String(Math.max(0, Number(version) || 0))); } catch {}
  }
  async function rpcFetch(table, docId) {
    const args = { p_table: table };
    if (docId) args.p_doc_id = docId;
    const { data, error } = await global.supabase.rpc('shirangi_enterprise_fetch', args);
    return { data, error };
  }
  async function writeEnterprise(table, payload, { requireAuth = true, docId = '_root' } = {}) {
    let local;
    try {
      local = mirrorLocal(table, payload);
    } catch (e) {
      return { ok: false, error: 'LOCAL_WRITE_FAILED', detail: String(e?.message || e) };
    }
    if (!preferCloud()) {
      return { ok: true, mode: 'local', data: local };
    }
    const session = await ensureAnonSession();
    if (requireAuth && !session) {
      enqueue({ table, action: 'write', docId, payload: local, reason: 'no_session' });
      return { ok: true, mode: 'local_outbox', data: local, warning: 'AUTH_REQUIRED_FOR_CLOUD' };
    }
    try {
      const meta = await rpcFetchMeta(table, docId);
      if (meta.error) throw meta.error;
      const expectedVersion = Number(meta.data?.version || readCloudVersion(table, docId) || 0);
      const { data: upserted, error } = await rpcUpsert(table, local, docId, expectedVersion);
      if (error) {
        const msg = String(error.message || error);
        const conflict = /SYNC_CONFLICT|40001|conflict/i.test(msg);
        enqueue({ table, action: 'write', docId, payload: local, expectedVersion, error: msg, status: conflict ? 'conflict' : 'pending' });
        const missing = /could not find|schema cache|PGRST|404|function/i.test(msg);
        return { ok: true, mode: 'local_outbox', data: local, warning: conflict ? 'SYNC_CONFLICT' : (missing ? 'RPC_NOT_DEPLOYED' : msg) };
      }
      writeCloudVersion(table, docId, Number(upserted?.version || expectedVersion + 1));
      try {
        ShirangiRuntimeStorage.setItem(META_KEY, JSON.stringify({ lastCloudSync: new Date().toISOString(), table, docId }));
        await global.supabase.rpc('shirangi_enterprise_touch_sync', {
          p_pending: readOutbox().filter(x => x.status === 'pending').length,
          p_client_version: '36.2.2'
        });
      } catch (_) {}
      return { ok: true, mode: 'cloud', data: local };
    } catch (e) {
      enqueue({ table, action: 'write', docId, payload: local });
      return { ok: true, mode: 'local_outbox', data: local, warning: String(e?.message || e) };
    }
  }
  async function readEnterprise(table, fallback, { docId } = {}) {
    let local = fallback;
    try {
      const raw = ShirangiRuntimeStorage.getItem(localKey(table));
      if (raw) local = JSON.parse(raw);
    } catch {}
    if (!preferCloud() || !global.supabase) {
      return { ok: true, mode: 'local', data: local };
    }
    try {
      await ensureAnonSession();
      const meta = await rpcFetchMeta(table, docId);
      if (!meta.error && meta.data?.exists) {
        const data = meta.data.payload;
        writeCloudVersion(table, docId, Number(meta.data.version || 0));
        try { ShirangiRuntimeStorage.setItem(localKey(table), JSON.stringify(data)); } catch {}
        return { ok: true, mode: 'cloud', data, version: Number(meta.data.version || 0) };
      }
      const { data, error } = await rpcFetch(table, docId);
      if (error || data == null) return { ok: true, mode: 'local', data: local, warning: error?.message || meta.error?.message };
      try { ShirangiRuntimeStorage.setItem(localKey(table), JSON.stringify(data)); } catch {}
      return { ok: true, mode: 'cloud', data, version: 0 };
    } catch (e) {
      return { ok: true, mode: 'local', data: local, warning: String(e?.message || e) };
    }
  }
  async function flushOutbox({ max = 20 } = {}) {
    if (!preferCloud() || !global.supabase) {
      return { ok: false, flushed: 0, reason: 'cloud_not_ready' };
    }
    const session = await ensureAnonSession();
    if (!session) return { ok: false, flushed: 0, reason: 'no_session' };
    const list = readOutbox();
    let flushed = 0;
    const remain = [];
    for (const item of list) {
      if (item.status !== 'pending' || flushed >= max) {
        remain.push(item);
        continue;
      }
      if (item.action !== 'write') {
        remain.push(item);
        continue;
      }
      try {
        let expectedVersion = Number.isInteger(item.expectedVersion) ? item.expectedVersion : readCloudVersion(item.table, item.docId || '_root');
        if (!Number.isInteger(item.expectedVersion)) {
          const meta = await rpcFetchMeta(item.table, item.docId || '_root');
          if (meta.error) throw meta.error;
          expectedVersion = Number(meta.data?.version || 0);
        }
        const { data: upserted, error } = await rpcUpsert(item.table, item.payload, item.docId || '_root', expectedVersion);
        if (error) {
          const msg = String(error.message || error);
          item.attempts = (item.attempts || 0) + 1;
          item.lastError = msg;
          if (/SYNC_CONFLICT|40001|conflict/i.test(msg)) { item.status = 'conflict'; remain.push(item); }
          else if (item.attempts < 8) remain.push(item);
          continue;
        }
        writeCloudVersion(item.table, item.docId || '_root', Number(upserted?.version || expectedVersion + 1));
        flushed++;
      } catch (e) {
        item.attempts = (item.attempts || 0) + 1;
        item.lastError = String(e?.message || e);
        if (item.attempts < 8) remain.push(item);
      }
    }
    writeOutbox(remain);
    try {
      await global.supabase.rpc('shirangi_enterprise_touch_sync', {
        p_pending: remain.filter(x => x.status === 'pending').length,
        p_client_version: '36.2.2'
      });
    } catch (_) {}
    return { ok: true, flushed, pending: remain.filter(x => x.status === 'pending').length };
  }
  function outboxStatus() {
    const list = readOutbox();
    return {
      pending: list.filter(x => x.status === 'pending').length,
      total: list.length,
      items: list.slice(0, 20)
    };
  }
  function bindLocalStorageKey(storageKey, tableKey) {
    return {
      async load(fallback) {
        const r = await readEnterprise(tableKey, fallback);
        return r.data != null ? r.data : fallback;
      },
      async save(value) {
        return writeEnterprise(tableKey, value);
      },
      readSync(fallback) {
        try {
          const raw = ShirangiRuntimeStorage.getItem(storageKey);
          return raw ? JSON.parse(raw) : fallback;
        } catch {
          return fallback;
        }
      },
      writeSync(value) {
        ShirangiRuntimeStorage.setItem(storageKey, JSON.stringify(value));
        // fire-and-forget cloud mirror
        try { writeEnterprise(tableKey, value); } catch (_) {}
        return value;
      }
    };
  }
  global.ShirangiEnterpriseCloud = Object.freeze({
    preferCloud,
    cloudReady,
    writeEnterprise,
    readEnterprise,
    flushOutbox,
    outboxStatus,
    enqueue,
    bindLocalStorageKey,
    localKey
  });
  // Opportunistic outbox flush when back online
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      try { global.ShirangiEnterpriseCloud.flushOutbox({ max: 30 }); } catch (_) {}
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);

/* ===== 15: js/shirangi-enterprise-platform-v29.js ===== */
/* SHIRANGI PROJECT LAYER — project-owned integration marker.
 * Runtime layer registry: identifies this module as part of Shirangi Real Estate Kiosk.
 * Third-party libraries/data remain subject to their own licenses and attribution.
 */
(function () {
  if (typeof window === 'undefined') return;
  window.__SHIRANGI_BRAND__ = window.__SHIRANGI_BRAND__ || Object.freeze({
    product: 'Shirangi Real Estate Kiosk', owner: 'Shirangi', namespace: 'shirangi'
  });
  window.__SHIRANGI_LAYERS__ = window.__SHIRANGI_LAYERS__ || [];
  var id = 'shirangi-enterprise-platform-v29';
  if (!window.__SHIRANGI_LAYERS__.some(function (x) { return x.id === id; })) {
    window.__SHIRANGI_LAYERS__.push({ id: id, name: 'Shirangi — ' + id, product: 'Shirangi Real Estate Kiosk' });
  }
}());
/* Shirangi Enterprise Platform v29
 * Cloud-preferred when SHIRANGI_CONFIG.useSupabase + enterpriseCloudPreferred + credentials ready.
 * Falls back to local + outbox via ShirangiEnterpriseCloud. Still safe offline.
 * Local-first implementation of the enterprise layers:
 * cloud adapter, billing, identity/2FA/session model, fleet, OTA,
 * AI copilot adapter, Persian voice/OCR adapters, market data adapter,
 * security operations, E2E scenario registry, white-label, multi-tenant
 * SaaS boundaries, executive BI, compliance, DR, marketplace, mobile
 * companion contract, digital twin and an executive command center.
 *
 * Security boundary: secrets, payment capture, identity verification,
 * authorization and AI/OCR/market truth must be enforced server-side.
 */
(function(){
'use strict';
const KEY='shirangi_enterprise_platform_v29';
const iso=()=>new Date().toISOString();
const uid=p=>p+'_'+crypto.randomUUID();
const clone=o=>JSON.parse(JSON.stringify(o));
const cloudBinder=()=>window.ShirangiEnterpriseCloud?.bindLocalStorageKey?.(KEY,'platform_v29');

const PLANS={
 starter:{name:'Starter',seats:3,branches:1,kiosks:1,features:['crm','map','files','bi.basic']},
 pro:{name:'Pro',seats:10,branches:3,kiosks:5,features:['*']},
 enterprise:{name:'Enterprise',seats:1000,branches:1000,kiosks:1000,features:['*']}
};
const ROLES={
 owner:['*'],
 admin:['org.*','branch.*','kiosk.*','user.*','billing.*','security.*','support.*','market.*','bi.*'],
 manager:['org.read','branch.*','kiosk.read','kiosk.write','user.read','crm.*','files.*','bi.*','support.*'],
 agent:['org.read','branch.read','kiosk.read','crm.*','files.*','map.*','market.read'],
 viewer:['org.read','branch.read','kiosk.read','crm.read','bi.read']
};

function load(){
 try{
   const b=cloudBinder();
   if(b) return b.readSync({})||{};
   return JSON.parse(ShirangiRuntimeStorage.getItem(KEY)||'{}');
 }catch(e){return{}}
}
function save(s){
 try{
   const b=cloudBinder();
   if(b){ b.writeSync(s); return s; }
 }catch(_){}
 ShirangiRuntimeStorage.setItem(KEY,JSON.stringify(s));
 return s;
}
function st(){
 const s=load();
 s.orgs??={}; s.branches??={}; s.kiosks??={}; s.users??={};
 s.subscriptions??={}; s.sessions??={}; s.billing??=[];
 s.audit??=[]; s.tickets??={}; s.devices??={}; s.updates??=[];
 s.branding??={}; s.market??={}; s.deals??=[]; s.marketplace??=[];
 s.compliance??={}; s.security??={events:[],alerts:[],remoteLock:{}};
 s.dr??={snapshots:[]}; s.e2e??={runs:[]}; s.voice??={history:[]};
 s.ocr??={history:[]}; s.copilot??={history:[]}; s.mobile??={};
 s.current??={}; return s;
}
function audit(action,data={}){
 const s=st(); s.audit.unshift({id:uid('aud'),at:iso(),action,...data});
 s.audit=s.audit.slice(0,10000); save(s);
}
function activePrincipal(s){
 const c=s.current||{},u=c.userId?s.users[c.userId]:null,ss=c.sessionId?s.sessions[c.sessionId]:null;
 if(!u||u.status!=='active'||!ss||ss.revoked||ss.userId!==u.id||new Date(ss.expiresAt).getTime()<=Date.now())return null;
 return u;
}
function requireOrg(s,orgId){if(!s.orgs[orgId])throw Error('org_not_found')}
function requireAccess(s,orgId,permission){
 requireOrg(s,orgId);
 const u=activePrincipal(s);
 if(!u)throw Error('AUTH_REQUIRED');
 if(u.orgId!==orgId)throw Error('ORG_ACCESS_DENIED');
 if(!allows(u.role,permission))throw Error('PERMISSION_DENIED');
 return u;
}
function requireSelfOrAdmin(s,userId,permission='user.write'){
 const u=activePrincipal(s);
 if(!u)throw Error('AUTH_REQUIRED');
 if(u.id===userId)return u;
 if(allows(u.role,permission))return u;
 throw Error('PERMISSION_DENIED');
}
function validMoney(value){
 const n=typeof value==='number'?value:Number(String(value).replace(/,/g,'').trim());
 if(!Number.isFinite(n)||n<0||n>Number.MAX_SAFE_INTEGER)return null;
 return Math.round(n*100)/100;
}
function validCurrency(value){
 const c=String(value||'').trim().toUpperCase();
 return /^[A-Z]{3}$/.test(c)?c:null;
}
function requireFeature(orgId,f){
 const s=st(), sub=s.subscriptions[orgId];
 if(!sub)return false;
 const p=PLANS[sub.plan]||PLANS.starter;
 return p.features.includes('*')||p.features.includes(f);
}

/* 1) Cloud / sync */
function cloudConfig(cfg={}){
 const s=st(),raw=String(cfg.baseUrl||'').trim();
 let baseUrl='';
 try{const u=new URL(raw);if(u.protocol==='https:'&&typeof ShirangiSecurityPolicy!=='undefined'&&ShirangiSecurityPolicy.isAllowedExternalUrl(raw))baseUrl=u.origin+u.pathname.replace(/\/$/,'');}catch(_){}
 s.cloud={baseUrl,tenantHeader:String(cfg.tenantHeader||'X-Shirangi-Tenant').slice(0,100),configured:!!baseUrl,updatedAt:iso()};
 save(s);return clone(s.cloud)
}
function cloudRequest(path,body,opts={}){
 const s=st(); if(!s.cloud?.configured) return Promise.resolve({ok:false,offline:true,error:'cloud_not_configured'});
 const url=s.cloud.baseUrl.replace(/\/$/,'')+'/'+String(path).replace(/^\//,'');
 const payload=body&&typeof body==='object'?{...body}:{};
 const headers={'content-type':'application/json'};
 // Tenant headers are informational only. Server authorization must come from a
 // signed license/session capability; never treat a client-supplied org id as identity.
 const authToken=String(opts.token||s.current?.licenseToken||''); delete payload.token;
 if(authToken) headers.authorization='Bearer '+authToken;
 return fetch(url,{method:opts.method||'POST',headers,body:JSON.stringify(payload)})
   .then(r=>r.json().catch(()=>({})).then(data=>({ok:r.ok,status:r.status,data})))
   .catch(error=>({ok:false,error:String(error)}));
}
function sync(orgId,items=[]){const s=st();requireAccess(s,orgId,'files.write');s.devices[orgId]??={queue:[]};s.devices[orgId].queue.push(...items.map(x=>({...x,queuedAt:iso()})));save(s);audit('cloud.sync.queued',{orgId,count:items.length});return {queued:items.length,online:navigator.onLine!==false}}

/* 2) Billing / subscriptions */
function subscribe(orgId,plan='pro',status='trial',opts={}){
 const s=st();requireAccess(s,orgId,'billing.write');if(!PLANS[plan])throw Error('plan_not_found');
 const sub={id:uid('sub'),orgId,plan,status,startedAt:opts.startedAt||iso(),renewsAt:opts.renewsAt||null,cancelAt:null,provider:null};
 s.subscriptions[orgId]=sub;save(s);audit('subscription.changed',{orgId,plan,status});return clone(sub)
}
function invoice(orgId,amount,currency='IRR',meta={}){
 const s=st(),money=validMoney(amount),ccy=validCurrency(currency);requireAccess(s,orgId,'billing.write');if(money===null)throw Error('INVALID_AMOUNT');if(!ccy)throw Error('INVALID_CURRENCY');const i={id:uid('inv'),orgId,amount:money,currency:ccy,status:'draft',createdAt:iso(),meta};s.billing.unshift(i);save(s);audit('billing.invoice.created',{orgId,invoiceId:i.id});return clone(i)
}
function paymentAdapter(orgId,provider,externalRef,amount){
 const s=st();requireAccess(s,orgId,'billing.write');const money=validMoney(amount);if(money===null)throw Error('INVALID_AMOUNT');const providerName=String(provider||'').trim().slice(0,100),ref=String(externalRef||'').trim().slice(0,200);if(!providerName||!ref)throw Error('INVALID_PAYMENT_REFERENCE');const p={id:uid('pay'),orgId,provider:providerName,externalRef:ref,amount:money,status:'pending_verification',createdAt:iso()};s.billing.unshift(p);save(s);audit('billing.payment.pending',{orgId,paymentId:p.id});return clone(p)
}

/* 3) Identity / 2FA / sessions */
function user(orgId,name,email,role='agent'){
 const s=st();requireOrg(s,orgId);const hasUsers=Object.values(s.users).some(x=>x.orgId===orgId);if(hasUsers)requireAccess(s,orgId,'user.write');if(!ROLES[role])throw Error('role_not_found');if(!hasUsers&&role!=='owner')throw Error('first_user_must_be_owner');
 const u={id:uid('usr'),orgId,name,email,role,status:'active',twoFactorEnabled:false,createdAt:iso()};
 s.users[u.id]=u;save(s);audit('user.created',{orgId,userId:u.id,role});return clone(u)
}
function enable2FA(userId){const s=st(),u=s.users[userId];if(!u)throw Error('user_not_found');requireSelfOrAdmin(s,userId,'security.write');u.twoFactorEnabled=true;u.twoFactorConfiguredAt=iso();save(s);audit('identity.2fa.enabled',{userId});return clone(u)}
function session(userId,deviceId){
 const s=st(),u=s.users[userId];if(!u)throw Error('user_not_found');
 const p=activePrincipal(s);if(p&&p.id!==userId&&!allows(p.role,'security.write'))throw Error('PERMISSION_DENIED');
 const x={id:uid('ses'),userId,orgId:u.orgId,deviceId:String(deviceId||'').slice(0,200),createdAt:iso(),lastSeen:iso(),expiresAt:new Date(Date.now()+8*3600000).toISOString(),revoked:false};
 s.sessions[x.id]=x;s.current={orgId:u.orgId,userId:u.id,sessionId:x.id,at:iso()};save(s);audit('identity.session.created',{userId,sessionId:x.id});return clone(x)
}
function revokeSession(sessionId){const s=st(),target=s.sessions[sessionId];if(!target)throw Error('session_not_found');const p=activePrincipal(s);if(!p)throw Error('AUTH_REQUIRED');if(p.id!==target.userId&&!allows(p.role,'security.write'))throw Error('PERMISSION_DENIED');target.revoked=true;target.revokedAt=iso();if(s.current?.sessionId===sessionId)s.current={};save(s);audit('identity.session.revoked',{sessionId});return true}
function allows(role,permission){const r=ROLES[role]||[];return r.includes('*')||r.some(x=>x.endsWith('.*')?permission.startsWith(x.slice(0,-1)):x===permission)}

/* 4) Fleet */
function registerDevice(orgId,type,name,meta={}){
 const s=st();requireAccess(s,orgId,'kiosk.write');const d={id:uid('dev'),orgId,type,name,status:'offline',registeredAt:iso(),lastSeen:null,meta};s.devices[d.id]=d;save(s);audit('fleet.device.registered',{orgId,deviceId:d.id});return clone(d)
}
function heartbeat(deviceId,telemetry={}){
 const s=st(),d=s.devices[deviceId];if(!d)throw Error('device_not_found');
 d.status='online';d.lastSeen=iso();d.telemetry=telemetry;save(s);audit('fleet.heartbeat',{orgId:d.orgId,deviceId});return clone(d)
}
function remoteLock(deviceId,reason='security'){
 const s=st(),d=s.devices[deviceId];if(!d)throw Error('device_not_found');requireAccess(s,d.orgId,'security.write');
 s.security.remoteLock[deviceId]={locked:true,reason,at:iso()};d.status='locked';save(s);audit('fleet.remote_lock',{orgId:d.orgId,deviceId,reason});return true
}

/* 5) OTA */
function stageUpdate(orgId,version,sha256,url){
 const s=st();requireAccess(s,orgId,'kiosk.write');if(!/^https:\/\//i.test(String(url||'')))throw Error('https_required');if(typeof ShirangiSecurityPolicy!=='undefined'&&!ShirangiSecurityPolicy.isAllowedExternalUrl(String(url||'')))throw Error('external_url_not_allowed');
 const u={id:uid('upd'),orgId,version,sha256,url,status:'staged',createdAt:iso(),rollBackTo:null};
 s.updates.unshift(u);save(s);audit('ota.staged',{orgId,version});return clone(u)
}
function promoteUpdate(id){const s=st(),u=s.updates.find(x=>x.id===id);if(!u)throw Error('update_not_found');requireAccess(s,u.orgId,'kiosk.write');u.status='approved';u.approvedAt=iso();save(s);audit('ota.approved',{orgId:u.orgId,updateId:id});return clone(u)}
function rollbackUpdate(id){const s=st(),u=s.updates.find(x=>x.id===id);if(!u)throw Error('update_not_found');requireAccess(s,u.orgId,'kiosk.write');u.status='rollback_requested';u.rollbackAt=iso();save(s);audit('ota.rollback_requested',{orgId:u.orgId,updateId:id});return clone(u)}

/* 6) AI server adapter / copilot */
function copilot(orgId,question,context={}){
 const s=st();requireAccess(s,orgId,'crm.read');
 const q=String(question||'').trim();let answer='برای پاسخ واقعی، AI Server باید متصل باشد.';
 if(/امروز|اولویت|اول/.test(q))answer='اولویت پیشنهادی: مشتریان داغ، پرونده‌های نزدیک به انقضا و معاملات با اقدام معوق را بررسی کن.';
 if(/قیمت|ارزش/.test(q))answer='برای قیمت‌گذاری از داده بازار متصل و فایل‌های تاییدشده استفاده کن؛ این لایه به‌تنهایی قیمت بازار را جعل نمی‌کند.';
 const x={id:uid('ai'),orgId,question:q,answer,at:iso(),serverBacked:false};s.copilot[orgId]??=[];s.copilot[orgId].push(x);save(s);return clone(x)
}

/* 7) Persian voice */
function parseVoice(text){
 const t=String(text||'').replace(/[‌]/g,' ').trim();const actions=[];
 if(/مشتری|مشتری جدید/.test(t))actions.push({intent:'customer_search',confidence:.78});
 if(/ملک|فایل/.test(t))actions.push({intent:'property_search',confidence:.8});
 if(/تماس|زنگ/.test(t))actions.push({intent:'contact_customer',confidence:.72});
 if(/اضافه|ثبت/.test(t))actions.push({intent:'create_record',confidence:.7});
 if(/گزارش|داشبورد/.test(t))actions.push({intent:'open_bi',confidence:.83});
 const out={text:t,actions,at:iso()};const s=st();s.voice.history.unshift(out);save(s);return out
}

/* 8) OCR text adapter */
function parseOCR(orgId,text){
 const s=st();requireAccess(s,orgId,'crm.read');const t=String(text||'');
 const pick=(re)=>{const m=t.match(re);return m?m[1].trim():null};
 const out={orgId,at:iso(),source:'text_adapter',fields:{
   phone:pick(/(?:تلفن|موبایل|همراه)\s*[:：]?\s*([0-9۰-۹+\-\s]{7,})/i),
   nationalId:pick(/(?:کد ملی)\s*[:：]?\s*([0-9۰-۹]{10})/i),
   address:pick(/(?:آدرس)\s*[:：]?\s*(.+)/i),
   amount:pick(/(?:قیمت|مبلغ)\s*[:：]?\s*([0-9۰-۹,.\s]+)/i)
 },confidence:{phone:.82,nationalId:.92,address:.66,amount:.74}};
 s.ocr.history.unshift(out);save(s);return clone(out)
}

/* 9) Market adapter */
function marketConfig(orgId,source,url){
 const s=st();requireAccess(s,orgId,'market.write');if(url&&!/^https:\/\//i.test(url))throw Error('https_required');if(url&&typeof ShirangiSecurityPolicy!=='undefined'&&!ShirangiSecurityPolicy.isAllowedExternalUrl(url))throw Error('external_url_not_allowed');
 s.market[orgId]={source,url:url||'',configured:!!url,updatedAt:iso()};save(s);return clone(s.market[orgId])
}
function addMarketObservation(orgId,region,type,area,price,source='manual'){
 const s=st();requireAccess(s,orgId,'market.write');const a=validMoney(area),p=validMoney(price);if(a===null||p===null)throw Error('INVALID_MARKET_VALUE');const x={id:uid('mkt'),orgId,region,type,area:a,price:p,priceM2:a?p/a:0,source,at:iso()};s.market[orgId]??={observations:[]};s.market[orgId].observations??=[];s.market[orgId].observations.push(x);save(s);return clone(x)
}
function marketInsights(orgId){
 const s=st(),m=s.market[orgId]?.observations||[];const vals=m.map(x=>x.priceM2).filter(x=>x>0).sort((a,b)=>a-b);
 const median=vals.length?vals[Math.floor(vals.length/2)]:0;return {orgId,samples:vals.length,medianPriceM2:median,generatedAt:iso(),source:'connected/manual observations only'}
}

/* 10) Security operations */
function securityEvent(orgId,type,severity='info',meta={}){
 const s=st();requireAccess(s,orgId,'security.write');const e={id:uid('sec'),orgId,type,severity,meta,at:iso()};s.security.events.unshift(e);
 if(['high','critical'].includes(severity))s.security.alerts.unshift({...e,status:'open'});
 s.security.events=s.security.events.slice(0,20000);s.security.alerts=s.security.alerts.slice(0,5000);save(s);audit('security.event',{orgId,type,severity});return clone(e)
}
function securitySnapshot(orgId){
 const s=st();requireAccess(s,orgId,'security.read');return {orgId,events:s.security.events.filter(x=>x.orgId===orgId).slice(0,100),alerts:s.security.alerts.filter(x=>x.orgId===orgId).slice(0,100),remoteLocks:Object.keys(s.security.remoteLock).filter(k=>s.devices[k]?.orgId===orgId),generatedAt:iso()}
}

/* 11) E2E scenario registry */
function e2eRun(orgId){
 const s=st();requireOrg(s,orgId);
 const scenarios=['login/session','RBAC','customer→property match','property file archive','map property pin','offline queue','sync conflict','subscription expiry','remote lock','backup/restore'];
 const result={id:uid('e2e'),orgId,at:iso(),scenarios:scenarios.map(name=>({name,status:'simulated-pass'})),note:'Registry/smoke layer; device/browser automation must run in CI.'};
 s.e2e.runs.unshift(result);save(s);audit('qa.e2e.run',{orgId,runId:result.id});return clone(result)
}

/* 12) White label */
function branding(orgId,data={}){
 const s=st();requireOrg(s,orgId);s.branding[orgId]={orgId,name:data.name||s.orgs[orgId].name,logoUrl:data.logoUrl||'',primary:data.primary||'',supportPhone:data.supportPhone||'',updatedAt:iso()};save(s);audit('branding.updated',{orgId});return clone(s.branding[orgId])
}

/* 13) Tenant SaaS */
function tenant(orgId){
 const s=st();requireOrg(s,orgId);
 return {orgId,isolated:true,plan:s.subscriptions[orgId]?.plan||null,branches:Object.values(s.branches).filter(x=>x.orgId===orgId).length,kiosks:Object.values(s.devices).filter(x=>x.orgId===orgId).length}
}

/* 14) Executive BI */
function deal(orgId,stage,value,owner=''){
 const s=st();requireOrg(s,orgId);const d={id:uid('deal'),orgId,stage,value:Number(value)||0,owner,createdAt:iso()};s.deals.push(d);save(s);return clone(d)
}
function bi(orgId){
 const s=st(),d=s.deals.filter(x=>x.orgId===orgId),total=d.reduce((a,x)=>a+x.value,0);
 const byStage={};d.forEach(x=>byStage[x.stage]=(byStage[x.stage]||0)+x.value);
 return {orgId,deals:d.length,pipelineValue:total,byStage,generatedAt:iso()}
}

/* 15) Compliance */
function compliance(orgId,subject,kind,expiresAt=null){
 const s=st();requireOrg(s,orgId);s.compliance[orgId]??=[];const c={id:uid('cmp'),orgId,subject,kind,expiresAt,status:expiresAt&&new Date(expiresAt)<new Date()?'expired':'valid',createdAt:iso()};s.compliance[orgId].push(c);save(s);audit('compliance.recorded',{orgId,complianceId:c.id});return clone(c)
}
function complianceDue(orgId,days=30){
 const s=st(),cut=Date.now()+days*86400000;return (s.compliance[orgId]||[]).filter(x=>x.expiresAt&&new Date(x.expiresAt).getTime()<=cut)
}

/* 16) Disaster recovery */
function backup(orgId){
 const s=st();requireOrg(s,orgId);const snap={id:uid('bkp'),orgId,createdAt:iso(),data:{
   org:s.orgs[orgId],branches:Object.values(s.branches).filter(x=>x.orgId===orgId),
   kiosks:Object.values(s.kiosks).filter(x=>x.orgId===orgId),users:Object.values(s.users).filter(x=>x.orgId===orgId),
   subscription:s.subscriptions[orgId]||null,deals:s.deals.filter(x=>x.orgId===orgId),billing:s.billing.filter(x=>x.orgId===orgId)
 }};snap.sha256='browser-local-integrity-'+btoa(unescape(encodeURIComponent(JSON.stringify(snap.data)))).slice(0,32);s.dr.snapshots.unshift(snap);save(s);audit('dr.backup.created',{orgId,backupId:snap.id});return clone(snap)
}

/* 17) Marketplace */
function listing(orgId,title,price,meta={}){
 const s=st();requireAccess(s,orgId,'market.write');const x={id:uid('lst'),orgId,title,price:Number(price)||0,status:'published',createdAt:iso(),meta};s.marketplace.unshift(x);save(s);audit('marketplace.listing.created',{orgId,listingId:x.id});return clone(x)
}
function marketplace(orgId){const s=st();return s.marketplace.filter(x=>x.orgId===orgId&&x.status==='published')}

/* 18) Mobile companion contract */
function mobileLink(orgId,deviceId){
 const s=st();requireAccess(s,orgId,'kiosk.write');const x={id:uid('mob'),orgId,deviceId,pairedAt:iso(),status:'paired',capabilities:['crm','map','files','voice','notifications']};s.mobile[orgId]??=[];s.mobile[orgId].push(x);save(s);audit('mobile.paired',{orgId,deviceId});return clone(x)
}

/* 19) Digital twin */
function digitalTwin(orgId,scenario={}){
 const b=bi(orgId),m=marketInsights(orgId),s=st();
 const factor=Number(scenario.priceFactor||1), conversion=Number(scenario.conversionFactor||1);
 return {orgId,scenario:{priceFactor:factor,conversionFactor:conversion},baseline:b,simulation:{pipelineValue:Math.round(b.pipelineValue*factor),estimatedClosedValue:Math.round(b.pipelineValue*0.25*conversion),medianPriceM2:m.medianPriceM2},generatedAt:iso()}
}

/* 20) Unified executive command center */
function command(orgId){
 const s=st();requireAccess(s,orgId,'bi.read');
 const openTickets=Object.values(s.tickets).filter(x=>x.orgId===orgId&&x.status==='open').length;
 const due=complianceDue(orgId,30).length;
 const alerts=s.security.alerts.filter(x=>x.orgId===orgId&&x.status==='open').length;
 const online=Object.values(s.devices).filter(x=>x.orgId===orgId&&x.status==='online').length;
 const b=bi(orgId);
 const actions=[];
 if(alerts)actions.push({priority:'critical',action:'رسیدگی به هشدارهای امنیتی'});
 if(due)actions.push({priority:'high',action:'تکمیل مدارک نزدیک به انقضا'});
 if(openTickets)actions.push({priority:'medium',action:'رسیدگی به تیکت‌های باز'});
 if(!online)actions.push({priority:'medium',action:'بررسی وضعیت کیوسک‌ها'});
 if(!actions.length)actions.push({priority:'normal',action:'پیگیری مشتریان داغ و فرصت‌های فروش'});
 return {orgId,subscription:s.subscriptions[orgId]||null,bi:b,onlineDevices:online,openTickets,complianceDue:due,securityAlerts:alerts,nextActions:actions,generatedAt:iso()}
}

/* Existing V28 compatibility */
function org(name,meta={}){
 const s=st(),o={id:uid('org'),name:String(name||'Organization').trim(),createdAt:iso(),status:'active',meta};s.orgs[o.id]=o;save(s);audit('org.created',{orgId:o.id});return clone(o)
}
function branch(orgId,name,meta={}){
 const s=st();requireOrg(s,orgId);const b={id:uid('br'),orgId,name,createdAt:iso(),status:'active',meta};s.branches[b.id]=b;save(s);audit('branch.created',{orgId,branchId:b.id});return clone(b)
}
function kiosk(orgId,branchId,name,meta={}){
 const s=st();requireOrg(s,orgId);const k=registerDevice(orgId,'kiosk',name,{branchId,...meta});return k
}
function setCurrent(orgId,userId,sessionId){
 const s=st();if(!orgId||!userId||!sessionId)throw Error('SESSION_REQUIRED');requireOrg(s,orgId);
 const ss=s.sessions[sessionId],u=s.users[userId];if(!ss||ss.revoked||ss.userId!==userId||ss.orgId!==orgId||new Date(ss.expiresAt).getTime()<=Date.now()||!u||u.status!=='active')throw Error('INVALID_SESSION');
 s.current={orgId,userId,sessionId,at:iso()};save(s);return clone(s.current)
}
function dashboard(orgId){return command(orgId)}

window.shirangiEnterprisePlatform={
 version:'29.0.0',plans:PLANS,roles:ROLES,
 cloudConfig,cloudRequest,sync,org,branch,kiosk,user,enable2FA,session,revokeSession,allows,
 subscribe,invoice,paymentAdapter,registerDevice,heartbeat,remoteLock,stageUpdate,promoteUpdate,rollbackUpdate,
 copilot,parseVoice,parseOCR,marketConfig,addMarketObservation,marketInsights,securityEvent,securitySnapshot,e2eRun,
 branding,tenant,deal,bi,compliance,complianceDue,backup,listing,marketplace,mobileLink,digitalTwin,command,setCurrent,dashboard
};

function render(){
 const h=document.querySelector('#shirangi-enterprise-platform');if(!h)return;
 const s=st(),o=s.current.orgId?s.orgs[s.current.orgId]:null;
 h.innerHTML=`<section style="padding:18px;margin:12px 0;border:1px solid #ddd;border-radius:18px;background:#fff">
 <h2>Shirangi Enterprise Platform — OS 29</h2>
 <p>لایه تجاری/Enterprise یکپارچه برای سازمان، شعب، کیوسک، امنیت، BI، Cloud و عملیات.</p>
 <div style="display:flex;gap:8px;flex-wrap:wrap">
 <button data-e="org">+ سازمان</button><button data-e="branch" ${o?'':'disabled'}>+ شعبه</button>
 <button data-e="kiosk" ${o?'':'disabled'}>+ کیوسک</button><button data-e="dashboard" ${o?'':'disabled'}>Command Center</button>
 <button data-e="backup" ${o?'':'disabled'}>Backup</button><button data-e="e2e" ${o?'':'disabled'}>E2E Smoke</button>
 </div><p><b>سازمان فعال:</b> ${o?o.name:'انتخاب نشده'}</p>
 </section>`;
 h.querySelectorAll('[data-e]').forEach(b=>b.onclick=()=>{
  const a=b.dataset.e;
  if(a==='org'){const n=prompt('نام سازمان');if(n){const x=org(n);setCurrent(x.id);render()}}
  if(a==='branch'&&o){const n=prompt('نام شعبه');if(n){branch(o.id,n);render()}}
  if(a==='kiosk'&&o){const n=prompt('نام کیوسک');if(n){kiosk(o.id,null,n);render()}}
  if(a==='dashboard'&&o)alert(JSON.stringify(command(o.id),null,2));
  if(a==='backup'&&o){const x=backup(o.id);alert('Backup ساخته شد: '+x.id)}
  if(a==='e2e'&&o)alert(JSON.stringify(e2eRun(o.id),null,2));
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render);else render();
})();

/* ===== 16: js/shirangi-municipal-plaque-layer.js ===== */
/* SHIRANGI PROJECT LAYER — project-owned integration marker.
 * Runtime layer registry: identifies this module as part of Shirangi Real Estate Kiosk.
 * Third-party libraries/data remain subject to their own licenses and attribution.
 */
(function () {
  if (typeof window === 'undefined') return;
  window.__SHIRANGI_BRAND__ = window.__SHIRANGI_BRAND__ || Object.freeze({
    product: 'Shirangi Real Estate Kiosk', owner: 'Shirangi', namespace: 'shirangi'
  });
  window.__SHIRANGI_LAYERS__ = window.__SHIRANGI_LAYERS__ || [];
  var id = 'shirangi-municipal-plaque-layer';
  if (!window.__SHIRANGI_LAYERS__.some(function (x) { return x.id === id; })) {
    window.__SHIRANGI_LAYERS__.push({ id: id, name: 'Shirangi — ' + id, product: 'Shirangi Real Estate Kiosk' });
  }
}());
/* Shirangi Municipal Plaque Layer — project-owned adapter.
 * Official plaque data is optional and must be supplied from an authorized source.
 */
(function () {
  'use strict';
  const CONFIG = Object.freeze({
    dataUrl: '../../shared/map-data/municipal-plaques.geojson',
    minZoom: 16,
    maxZoom: 22
  });
  const fa = value => String(value ?? '').replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  let layer = null;

  async function load(map) {
    if (!map || !window.L) return false;
    try {
      const response = await fetch(CONFIG.dataUrl, { cache: 'no-store' });
      if (!response.ok) return false;
      const data = await response.json();
      if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features)) return false;
      if (layer) map.removeLayer(layer);
      if (!data.features.length) return false;
      layer = L.geoJSON(data, {
        pointToLayer: (_feature, latlng) => L.circleMarker(latlng, { radius: 1, opacity: 0, fillOpacity: 0 }),
        style: () => ({ weight: 1, opacity: 0, fillOpacity: 0 }),
        onEachFeature: (feature, featureLayer) => {
          const plaque = fa(feature?.properties?.plaque_number);
          if (plaque) featureLayer.bindTooltip(plaque, { permanent: true, direction: 'center', className: 'shirangi-plaque-label' });
        }
      });
      layer.options.shirangiLayerName = 'Shirangi — پلاک شهرداری';
      layer.addTo(map);
      window.ShirangiMunicipalPlaquesLayer = layer;
      const sync = () => {
        const z = map.getZoom();
        const visible = z >= CONFIG.minZoom && z <= CONFIG.maxZoom;
        if (layer) layer[visible ? 'addTo' : 'removeFrom'](map);
      };
      map.on('zoomend', sync);
      sync();
      return true;
    } catch (_) {
      return false;
    }
  }

  function boot() {
    const tryBoot = () => {
      const map = window.__shirangiMapInstance;
      if (!map) return setTimeout(tryBoot, 250);
      load(map);
    };
    tryBoot();
  }

  window.ShirangiMunicipalPlaques = Object.freeze({ config: CONFIG, load, boot });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();


/* ===== 17: js/shirangi-enterprise-typed-tables.js ===== */
/* Typed Supabase table adapters for enterprise domain (crm_contacts, deals, ...).
 * Falls back to document-store / local when tables or session are unavailable.
 */
(function (global) {
  'use strict';

  const TABLE_MAP = {
    contacts: { table: 'crm_contacts', fields: ['name', 'phone', 'email', 'type', 'budget_rial', 'area', 'source', 'score', 'metadata'] },
    leads: { table: 'crm_leads', fields: ['contact_id', 'status', 'source', 'score', 'owner_uid', 'next_followup_at', 'metadata'] },
    deals: { table: 'real_estate_deals', fields: ['title', 'contact_id', 'property_id', 'value_rial', 'stage', 'agent_uid', 'close_date', 'metadata'] },
    leases: { table: 'lease_contracts', fields: ['property_id', 'tenant_name', 'rent_rial', 'deposit_rial', 'start_date', 'end_date', 'next_due', 'balance_rial', 'status', 'metadata'] },
    maintenance: { table: 'maintenance_tickets', fields: ['property_id', 'title', 'requester', 'priority', 'vendor', 'estimated_cost_rial', 'status', 'due_date', 'metadata'] },
    contracts: { table: 'real_estate_contracts', fields: ['contract_number', 'contract_type', 'party_a', 'party_b', 'value_rial', 'start_date', 'end_date', 'status', 'template_key', 'document_url', 'metadata'] },
    units: { table: 'property_units', fields: ['project_id', 'unit_code', 'title', 'area_m2', 'price_rial', 'status', 'owner_name', 'metadata'] },
    tasks: { table: 'real_estate_tasks', fields: ['title', 'owner_uid', 'due_date', 'priority', 'entity_type', 'entity_id', 'status', 'notes'] }
  };

  function cfg() { return global.SHIRANGI_CONFIG || {}; }
  function ready() {
    return !!(cfg().useSupabase && global.ShirangiConfigGuard?.isCloudReady?.() && global.supabase);
  }
  async function session() {
    try {
      if (!global.supabase) return null;
      const { data } = await global.supabase.auth.getSession();
      const sess = data?.session || null;
      // Typed enterprise tables are tenant-scoped and their RLS is tied to auth.uid().
      // Never promote an anonymous session into an organization identity.
      if (!sess?.user || sess.user.is_anonymous) return null;
      return sess;
    } catch { return null; }
  }
  function orgIdFromSession(sess) {
    const uid = sess?.user?.id;
    return /^[0-9a-f-]{36}$/i.test(String(uid || '')) ? uid : null;
  }
  function toRow(kind, item, orgId) {
    const spec = TABLE_MAP[kind];
    if (!spec || !item) return null;
    const row = { org_id: orgId };
    if (item.id && /^[0-9a-f-]{36}$/i.test(String(item.id))) row.id = item.id;
    for (const f of spec.fields) {
      if (item[f] !== undefined) row[f] = item[f];
    }
    // common client field aliases
    if (kind === 'contacts') {
      if (item.budget != null && row.budget_rial == null) row.budget_rial = Number(item.budget) || 0;
      if (item.notes && !row.metadata) row.metadata = { notes: item.notes };
    }
    if (kind === 'deals') {
      if (item.value != null && row.value_rial == null) row.value_rial = Number(item.value) || 0;
      if (item.stage) row.stage = item.stage;
    }
    return row;
  }
  function fromRow(kind, row) {
    if (!row) return null;
    const out = { id: row.id, ...row };
    if (kind === 'contacts' && row.budget_rial != null) out.budget = row.budget_rial;
    if (kind === 'deals' && row.value_rial != null) out.value = row.value_rial;
    return out;
  }

  async function listTyped(kind) {
    const spec = TABLE_MAP[kind];
    if (!spec || !ready()) return { ok: false, mode: 'unavailable', data: [] };
    const sess = await session();
    if (!sess) return { ok: false, mode: 'no_session', data: [] };
    try {
      const { data, error } = await global.supabase.from(spec.table).select('*').order('created_at', { ascending: false }).limit(500);
      if (error) return { ok: false, mode: 'error', error: error.message, data: [] };
      return { ok: true, mode: 'typed', data: (data || []).map(r => fromRow(kind, r)) };
    } catch (e) {
      return { ok: false, mode: 'error', error: String(e?.message || e), data: [] };
    }
  }

  async function upsertTyped(kind, item) {
    const spec = TABLE_MAP[kind];
    if (!spec || !ready()) {
      // document-store fallback
      if (global.ShirangiEnterpriseCloud) {
        return global.ShirangiEnterpriseCloud.writeEnterprise('typed_' + kind, item, { docId: String(item?.id || '_anon') });
      }
      return { ok: false, mode: 'unavailable' };
    }
    const sess = await session();
    if (!sess) {
      global.ShirangiEnterpriseCloud?.enqueue?.({ table: 'typed_' + kind, action: 'write', payload: item, reason: 'no_session' });
      return { ok: true, mode: 'local_outbox', warning: 'AUTH_REQUIRED' };
    }
    const orgId = orgIdFromSession(sess);
    const row = toRow(kind, item, orgId);
    try {
      const { data, error } = await global.supabase.from(spec.table).upsert(row).select().maybeSingle();
      if (error) {
        // fallback document store
        global.ShirangiEnterpriseCloud?.enqueue?.({ table: 'typed_' + kind, action: 'write', payload: item, error: error.message });
        return { ok: true, mode: 'local_outbox', warning: error.message };
      }
      return { ok: true, mode: 'typed', data: fromRow(kind, data || row) };
    } catch (e) {
      global.ShirangiEnterpriseCloud?.enqueue?.({ table: 'typed_' + kind, action: 'write', payload: item });
      return { ok: true, mode: 'local_outbox', warning: String(e?.message || e) };
    }
  }

  async function pullSuiteCollections(st) {
    if (!st || !ready()) return { ok: false, st };
    const kinds = ['contacts', 'leads', 'deals', 'leases', 'maintenance', 'contracts', 'units', 'tasks'];
    let any = false;
    for (const k of kinds) {
      const r = await listTyped(k);
      if (r.ok && Array.isArray(r.data) && r.data.length) {
        // merge by id, prefer remote
        const map = new Map((st[k] || []).map(x => [x.id, x]));
        for (const row of r.data) map.set(row.id, { ...map.get(row.id), ...row });
        st[k] = [...map.values()];
        any = true;
      }
    }
    return { ok: any, st, mode: any ? 'typed-merge' : 'local' };
  }

  async function pushSuiteItem(kind, item) {
    return upsertTyped(kind, item);
  }

  global.ShirangiEnterpriseTyped = Object.freeze({
    TABLE_MAP,
    listTyped,
    upsertTyped,
    pullSuiteCollections,
    pushSuiteItem,
    ready
  });
})(typeof window !== 'undefined' ? window : globalThis);

/* ===== 18: js/shirangi-cloud-status-ui.js ===== */
/* Floating cloud/outbox status panel + production readiness view */
(function (global) {
  'use strict';


  function statusColor(ok) { return ok ? 'text-emerald-300' : 'text-amber-300'; }
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  async function collect() {
    const guard = global.ShirangiConfigGuard;
    const cloud = global.ShirangiEnterpriseCloud;
    const typed = global.ShirangiEnterpriseTyped;
    const readiness = guard?.runProductionReadinessCheck ? await guard.runProductionReadinessCheck() : null;
    const outbox = cloud?.outboxStatus ? cloud.outboxStatus() : { pending: 0, total: 0, items: [] };
    return {
      readiness,
      outbox,
      preferCloud: !!cloud?.preferCloud?.(),
      cloudReady: !!cloud?.cloudReady?.(),
      typedReady: !!typed?.ready?.(),
      cfg: global.SHIRANGI_CONFIG || {}
    };
  }

  async function renderPanel(root) {
    const data = await collect();
    const r = data.readiness;
    const checksHtml = (r?.checks || []).map(c =>
      `<div class="flex justify-between gap-2 py-1 border-b border-slate-800 text-xs">
        <span class="text-slate-300">${esc(c.id)}</span>
        <span class="${c.ok ? 'text-emerald-400' : 'text-rose-400'}">${c.ok ? '✓' : '✗'} ${esc(c.detail)}</span>
      </div>`
    ).join('') || '<div class="text-slate-500 text-sm">گزارشی نیست</div>';
    const items = (data.outbox.items || []).slice(0, 8).map(i =>
      `<div class="text-xs text-slate-400 py-1 border-b border-slate-800/80">${esc(i.table || '?')} · ${esc(i.action || '')} · ${esc(i.status || '')} ${i.lastError ? '· ' + esc(String(i.lastError).slice(0, 40)) : ''}</div>`
    ).join('') || '<div class="text-slate-500 text-xs">صف خالی است</div>';

    root.innerHTML = `
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-2">
          <div class="rounded-xl bg-slate-900 border border-slate-700 p-3">
            <div class="text-xs text-slate-400">Cloud Ready</div>
            <div class="text-lg font-black ${statusColor(data.cloudReady)}">${data.cloudReady ? 'آماده' : 'ناقص'}</div>
          </div>
          <div class="rounded-xl bg-slate-900 border border-slate-700 p-3">
            <div class="text-xs text-slate-400">Typed Tables</div>
            <div class="text-lg font-black ${statusColor(data.typedReady)}">${data.typedReady ? 'فعال' : 'آفلاین'}</div>
          </div>
          <div class="rounded-xl bg-slate-900 border border-slate-700 p-3">
            <div class="text-xs text-slate-400">Outbox</div>
            <div class="text-lg font-black ${data.outbox.pending ? 'text-amber-300' : 'text-emerald-300'}">${data.outbox.pending} در انتظار</div>
          </div>
          <div class="rounded-xl bg-slate-900 border border-slate-700 p-3">
            <div class="text-xs text-slate-400">Readiness</div>
            <div class="text-lg font-black ${statusColor(r?.ok)}">${r?.ok ? 'PASS' : 'FAIL'}</div>
          </div>
        </div>
        <div>
          <div class="flex items-center justify-between mb-2">
            <h3 class="font-bold text-sky-300">Production Readiness</h3>
            <button id="shirangi-cloud-refresh" class="px-3 py-1 rounded-lg bg-slate-800 text-xs">بروزرسانی</button>
          </div>
          <div class="rounded-xl border border-slate-700 bg-slate-950 p-3 max-h-48 overflow-auto">${checksHtml}</div>
        </div>
        <div>
          <div class="flex items-center justify-between mb-2">
            <h3 class="font-bold text-amber-300">صف همگام‌سازی (Outbox)</h3>
            <button id="shirangi-cloud-flush" class="px-3 py-1 rounded-lg bg-amber-700 text-xs font-bold">ارسال صف</button>
          </div>
          <div class="rounded-xl border border-slate-700 bg-slate-950 p-3 max-h-40 overflow-auto">${items}</div>
        </div>
        <p class="text-[11px] text-slate-500 leading-5">قبل از productionMode=true همه ردیف‌های Readiness باید سبز باشند. جداول typed پس از اجرای migrationهای enterprise روی Supabase فعال می‌شوند.</p>
      </div>`;

    root.querySelector('#shirangi-cloud-refresh')?.addEventListener('click', () => renderPanel(root));
    root.querySelector('#shirangi-cloud-flush')?.addEventListener('click', async () => {
      const btn = root.querySelector('#shirangi-cloud-flush');
      if (btn) btn.textContent = '...';
      try {
        const res = await global.ShirangiEnterpriseCloud?.flushOutbox?.({ max: 40 });
        alert(res?.ok ? ('ارسال شد: ' + (res.flushed || 0) + ' · باقی‌مانده: ' + (res.pending || 0)) : ('ناموفق: ' + (res?.reason || 'unknown')));
      } catch (e) {
        alert('خطا: ' + (e?.message || e));
      }
      renderPanel(root);
    });
  }

  function openPanel() {
    document.getElementById('shirangi-cloud-panel')?.remove();
    const shell = el(`<div id="shirangi-cloud-panel" class="fixed inset-0 z-[99995] bg-slate-950/85 backdrop-blur-sm overflow-auto" dir="rtl">
      <div class="max-w-lg mx-auto p-4 md:p-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <div class="text-xl font-black text-sky-300">وضعیت ابر و همگام‌سازی</div>
            <div class="text-xs text-slate-400">Cloud · Outbox · Typed tables · Readiness</div>
          </div>
          <button id="shirangi-cloud-close" class="px-3 py-2 rounded-xl bg-red-700 text-sm font-bold">بستن</button>
        </div>
        <div id="shirangi-cloud-body" class="rounded-2xl border border-slate-700 bg-slate-900/80 p-4"></div>
      </div>
    </div>`);
    document.body.appendChild(shell);
    shell.querySelector('#shirangi-cloud-close').onclick = () => shell.remove();
    renderPanel(shell.querySelector('#shirangi-cloud-body'));
  }

  function bootLauncher() {
    if (document.getElementById('shirangi-cloud-launcher')) return;
    const b = document.createElement('button');
    b.id = 'shirangi-cloud-launcher';
    b.type = 'button';
    b.textContent = '☁ ابر';
    b.title = 'وضعیت ابر و Outbox';
    b.style.cssText = 'position:fixed;bottom:18px;left:18px;z-index:99980;padding:12px 14px;border-radius:14px;background:#0369a1;color:#fff;font-weight:800;box-shadow:0 10px 30px rgba(0,0,0,.3);border:0;cursor:pointer';
    b.onclick = openPanel;
    document.body.appendChild(b);
  }

  global.ShirangiCloudStatusUI = Object.freeze({ openPanel, collect, renderPanel });

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootLauncher);
    else setTimeout(bootLauncher, 0);
  }
})(typeof window !== 'undefined' ? window : globalThis);

/* ===== 19: Enterprise legacy baseline removed ===== */
/* v36.1 implementation was retired from the runtime bundle.
 * v41.1.0 below is the sole Enterprise UI/runtime. Its loader still reads
 * the historical v36 storage key so existing customer data remains compatible.
 */

/* ===== 20: js/shirangi-enterprise-completion-v362.js ===== */
/* SHIRANGI 36.2 — Enterprise Completion Layer
 * Deepens the business-critical modules missing from the v36 baseline.
 * Local-first, dependency-free, shared across Web/Android/Desktop.
 */
(function(){'use strict';
const KEY='shirangi.enterprise-suite.v36';
const EXTRA='shirangi.enterprise-suite.v362';
const uid=()=>crypto?.randomUUID?.()||`${Date.now()}-${crypto.randomUUID()}`;
const now=()=>new Date().toISOString();
const today=()=>new Date().toISOString().slice(0,10);
const num=v=>{const s=String(v??'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/,/g,'');const n=Number(s);return Number.isFinite(n)?n:0};
const txt=v=>String(v??'').trim().slice(0,2000);
const esc=v=>txt(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>num(v).toLocaleString('fa-IR')+' ریال';
const clone=x=>JSON.parse(JSON.stringify(x));
const empty={accounts:[
{id:'1000',code:'1000',name:'بانک/صندوق',type:'asset'},
{id:'1100',code:'1100',name:'حساب‌های دریافتنی',type:'asset'},
{id:'2000',code:'2000',name:'حساب‌های پرداختنی',type:'liability'},
{id:'2100',code:'2100',name:'بستانکاران',type:'liability'},
{id:'4000',code:'4000',name:'درآمد فروش/اجاره',type:'income'},
{id:'4100',code:'4100',name:'درآمد کمیسیون',type:'income'},
{id:'5000',code:'5000',name:'هزینه‌ها',type:'expense'}],
journals:[],contracts:[],messages:[],campaigns:[],maintenance:[],leases:[],workflows:[],tasks:[],audit:[],settings:{fiscalYear:'1405',company:'شیرنگی',slaHours:24},
};
function load(){let old={};try{old=JSON.parse(ShirangiRuntimeStorage.getItem(KEY)||'{}')}catch{};let ex={};try{ex=JSON.parse(ShirangiRuntimeStorage.getItem(EXTRA)||'{}')}catch{};const base=clone(empty);Object.keys(base).forEach(k=>{if(Array.isArray(base[k])){const seen=new Set();base[k]=[...(old[k]||[]),...(ex[k]||[])].filter(x=>{const key=x?.id||JSON.stringify(x);if(seen.has(key))return false;seen.add(key);return true})}else base[k]={...base[k],...(old[k]||{}),...(ex[k]||{})}});return base}
let st=load(),tab='home';
const cloudBinderV362=()=>window.ShirangiEnterpriseCloud?.bindLocalStorageKey?.(EXTRA,'suite_v36');
function save(){
  const binder=cloudBinderV362();
  try { if (binder) binder.writeSync(st); else ShirangiRuntimeStorage.setItem(EXTRA,JSON.stringify(st)); }
  catch (_) { try { ShirangiRuntimeStorage.setItem(EXTRA,JSON.stringify(st)); } catch(__) {} }
}
let txDepth=0;
function atomic(fn){
  const before=clone(st);
  txDepth++;
  try {
    const result=fn();
    txDepth--;
    if(txDepth===0) save();
    return result;
  } catch(e) {
    st=before;
    txDepth--;
    if(txDepth===0) save();
    throw e;
  }
}
function audit(action,entity,id,detail=''){st.audit.unshift({id:uid(),action,entity,entityId:id,detail,at:now()});st.audit=st.audit.slice(0,2000);if(txDepth===0)save()}
async function syncTypedFromCloud(){try{if(!window.ShirangiEnterpriseTyped?.ready?.())return;const r=await window.ShirangiEnterpriseTyped.pullSuiteCollections(st);if(r?.ok){st=r.st;save();}}catch(_){}}
async function pushTyped(kind,item){try{return window.ShirangiEnterpriseTyped?.pushSuiteItem?.(kind,item)||{ok:false,mode:'unavailable'}}catch(e){return {ok:false,error:String(e?.message||e)}}}
function toast(m){let e=document.getElementById('v362-toast');if(!e){e=document.createElement('div');e.id='v362-toast';e.style='position:fixed;bottom:22px;left:22px;z-index:100002';document.body.appendChild(e)}const x=document.createElement('div');x.textContent=m;x.style='margin-top:8px;padding:12px 16px;border-radius:14px;background:#0f172a;color:#fff;border:1px solid #334155;box-shadow:0 12px 30px rgba(0,0,0,.25)';e.appendChild(x);setTimeout(()=>x.remove(),3000)}
function card(t,v,s=''){return `<div class="p-4 rounded-2xl bg-slate-900 border border-slate-800"><div class="text-xs text-slate-400">${t}</div><div class="text-2xl font-black mt-1">${v}</div><div class="text-xs text-slate-500 mt-1">${s}</div></div>`}
function btn(a,t,c='bg-sky-700'){return `<button data-v362-action="${a}" class="px-3 py-2 rounded-xl ${c}">${t}</button>`}
function input(n,l,t='text',v='',req=false){return `<label class="text-xs text-slate-300">${l}<input name="${n}" type="${t}" value="${esc(v)}" ${req?'required':''} class="mt-1 w-full rounded-xl bg-slate-950 border border-slate-700 p-2.5"></label>`}
function form(fields,action,submit='ذخیره'){return `<form data-v362-form="${action}" class="grid md:grid-cols-2 xl:grid-cols-3 gap-3">${fields.join('')}<div class="flex items-end">${btn('noop',submit,'bg-emerald-700')}</div></form>`}
function table(title,heads,rows,actions=''){return `<section class="p-4 rounded-2xl bg-slate-900 border border-slate-800"><div class="flex items-center justify-between gap-2 mb-3"><h3 class="font-black">${title}</h3><div>${actions}</div></div><div class="overflow-auto"><table class="w-full text-sm"><thead><tr>${heads.map(h=>`<th class="text-right p-2 border-b border-slate-800">${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')||`<tr><td colspan="${heads.length}" class="p-4 text-slate-500">داده‌ای وجود ندارد.</td></tr>`}</tbody></table></div></section>`}
function home(){const income=st.journals.reduce((a,j)=>a+(j.lines||[]).filter(l=>l.account==='4000'||l.account==='4100').reduce((s,l)=>s+num(l.credit),0),0),expense=st.journals.reduce((a,j)=>a+(j.lines||[]).filter(l=>l.account==='5000').reduce((s,l)=>s+num(l.debit),0),0);return `<div class="space-y-4"><div class="grid grid-cols-2 lg:grid-cols-6 gap-3">${card('حساب‌ها',st.accounts.length)}${card('اسناد',st.journals.length)}${card('قرارداد',st.contracts.length)}${card('ارتباطات',st.messages.length)}${card('کمپین',st.campaigns.length)}${card('تعمیرات باز',st.maintenance.filter(x=>!['done','cancelled'].includes(x.status)).length)}</div><div class="grid lg:grid-cols-2 gap-4"><section class="p-4 rounded-2xl bg-slate-900 border border-slate-800"><h3 class="font-black mb-3">سلامت عملیاتی</h3><div class="grid grid-cols-2 gap-3">${card('درآمد',money(income))}${card('هزینه',money(expense))}${card('خالص',money(income-expense))}${card('قراردادهای نزدیک انقضا',st.contracts.filter(x=>x.end&&x.end<=addDays(today(),30)).length)}</div></section><section class="p-4 rounded-2xl bg-slate-900 border border-slate-800"><h3 class="font-black mb-3">یکپارچگی E2E</h3><div class="text-sm text-slate-300 leading-8">Lead → Deal → Contract → Payment → Journal → Commission → Follow-up</div><div class="text-xs text-emerald-300">موتور Workflow فعال و رویدادمحور است.</div></section></div></div>`}
function accounting(){const balanced=st.journals.filter(j=>j.balanced).length;return `<div class="space-y-4">${form([input('date','تاریخ','date',today(),true),input('memo','شرح', 'text','',true),input('d1','حساب بدهکار','text','1000',true),input('a1','مبلغ بدهکار','number','',true),input('c1','حساب بستانکار','text','4000',true),input('a2','مبلغ بستانکار','number','',true),input('ref','مرجع')],'journal','ثبت سند متوازن')} ${table('دفتر حسابداری',['تاریخ','شرح','بدهکار','بستانکار','وضعیت'],st.journals.map(j=>{const d=(j.lines||[]).reduce((a,l)=>a+num(l.debit),0),c=(j.lines||[]).reduce((a,l)=>a+num(l.credit),0);return `<tr><td class="p-2">${esc(j.date)}</td><td>${esc(j.memo)}</td><td>${money(d)}</td><td>${money(c)}</td><td class="${d===c?'text-emerald-300':'text-red-300'}">${d===c?'متوازن':'نامتوازن'}</td></tr>`}),btn('accounting-seed','ایجاد حساب‌های پایه','bg-indigo-700'))}<div class="grid md:grid-cols-4 gap-3">${card('اسناد متوازن',balanced)}${card('کل بدهکار',money(st.journals.reduce((a,j)=>a+(j.lines||[]).reduce((s,l)=>s+num(l.debit),0),0)))}${card('کل بستانکار',money(st.journals.reduce((a,j)=>a+(j.lines||[]).reduce((s,l)=>s+num(l.credit),0),0)))}${card('کنترل',balanced===st.journals.length?'PASS':'REVIEW')}</div></div>`}
function contracts(){return `<div class="space-y-4">${form([input('number','شماره قرارداد', 'text','',true),input('type','نوع قرارداد','text','فروش/اجاره',true),input('partyA','طرف اول','text','',true),input('partyB','طرف دوم','text','',true),input('value','مبلغ','number','',true),input('start','شروع','date',today(),true),input('end','پایان','date',''),input('version','نسخه','number','1'),input('signature','وضعیت امضا','text','unsigned'),input('notes','توضیحات')],'contract','ثبت قرارداد')} ${table('Contract Vault',['شماره','نوع','طرفین','مبلغ','بازه','امضا','نسخه','عملیات'],st.contracts.map(x=>`<tr><td class="p-2">${esc(x.number)}</td><td>${esc(x.type)}</td><td>${esc(x.partyA)} / ${esc(x.partyB)}</td><td>${money(x.value)}</td><td>${esc(x.start)} → ${esc(x.end)}</td><td>${esc(x.signature)}</td><td>${esc(x.version)}</td><td>${btn(`sign:${x.id}`,'تأیید امضا','bg-emerald-700')} ${btn(`contract-version:${x.id}`,'نسخه بعد','bg-slate-700')}</td></tr>`))}</div>`}
function communication(){return `<div class="space-y-4">${form([input('contact','مخاطب','text','',true),input('channel','کانال','text','SMS / WhatsApp / Email / Call',true),input('subject','موضوع'),input('body','متن پیام','text','',true),input('followup','پیگیری بعدی','date','')],'message','ثبت تعامل')} ${table('Conversation Hub',['زمان','مخاطب','کانال','موضوع','پیام','پیگیری'],st.messages.map(x=>`<tr><td class="p-2">${esc(x.at.slice(0,16).replace('T',' '))}</td><td>${esc(x.contact)}</td><td>${esc(x.channel)}</td><td>${esc(x.subject)}</td><td class="max-w-md">${esc(x.body)}</td><td>${esc(x.followup||'-')}</td></tr>`))}</div>`}
function propertyMgmt(){const active=st.leases.filter(x=>x.status==='active').length;const rent=st.leases.reduce((a,x)=>a+num(x.rent),0);return `<div class="space-y-4"><div class="grid md:grid-cols-3 gap-3">${card('قرارداد فعال',active)}${card('اجاره ماهانه',money(rent))}${card('مانده مطالبات',money(st.leases.reduce((a,x)=>a+num(x.balance),0)))}</div>${form([input('property','ملک/واحد','text','',true),input('owner','مالک','text','',true),input('tenant','مستأجر','text','',true),input('rent','اجاره ماهانه','number','',true),input('deposit','ودیعه','number',''),input('start','شروع','date',today(),true),input('end','پایان','date',''),input('nextDue','سررسید بعدی','date',today()),input('balance','مانده بدهی','number','0')],'lease360','ثبت قرارداد اجاره')} ${table('Property Management',['ملک','مالک','مستأجر','اجاره','ودیعه','سررسید','مانده','وضعیت','عملیات'],st.leases.map(x=>`<tr><td class="p-2">${esc(x.property)}</td><td>${esc(x.owner)}</td><td>${esc(x.tenant)}</td><td>${money(x.rent)}</td><td>${money(x.deposit)}</td><td>${esc(x.nextDue)}</td><td>${money(x.balance)}</td><td>${esc(x.status)}</td><td>${btn(`rent-paid:${x.id}`,'ثبت وصول','bg-emerald-700')}</td></tr>`))}</div>`}
function maintenance(){return `<div class="space-y-4">${form([input('property','ملک/واحد','text','',true),input('title','عنوان درخواست','text','',true),input('priority','اولویت','text','high'),input('vendor','پیمانکار'),input('cost','برآورد هزینه','number','0'),input('due','موعد انجام','date',addDays(today(),1)),input('sla','SLA ساعت','number',String(st.settings.slaHours))],'maintenance360','ثبت تیکت تعمیرات')} ${table('Maintenance Command Center',['ملک','درخواست','اولویت','پیمانکار','هزینه','موعد','SLA','وضعیت','عملیات'],st.maintenance.map(x=>`<tr><td class="p-2">${esc(x.property)}</td><td>${esc(x.title)}</td><td>${esc(x.priority)}</td><td>${esc(x.vendor||'-')}</td><td>${money(x.cost)}</td><td>${esc(x.due)}</td><td>${x.sla}h</td><td>${esc(x.status)}</td><td>${btn(`maint-done:${x.id}`,'بستن','bg-emerald-700')}</td></tr>`))}</div>`}
function marketing(){const spend=st.campaigns.reduce((a,x)=>a+num(x.spend),0),leads=st.campaigns.reduce((a,x)=>a+num(x.leads),0),conv=st.campaigns.reduce((a,x)=>a+num(x.conversions),0);return `<div class="space-y-4"><div class="grid md:grid-cols-4 gap-3">${card('هزینه تبلیغات',money(spend))}${card('Lead',leads)}${card('Conversion',conv)}${card('CPL',leads?money(spend/leads):'-')}</div>${form([input('name','نام کمپین','text','',true),input('channel','کانال','text','Instagram / SMS / Website'),input('budget','بودجه','number','0'),input('spend','هزینه مصرف‌شده','number','0'),input('leads','لید','number','0'),input('conversions','تبدیل','number','0'),input('revenue','درآمد منتسب','number','0'),input('utm','UTM / منبع')],'campaign','ثبت کمپین')} ${table('Marketing ROI',['کمپین','کانال','بودجه','هزینه','Lead','تبدیل','درآمد','ROI'],st.campaigns.map(x=>{const roi=num(x.spend)?((num(x.revenue)-num(x.spend))/num(x.spend)*100):0;return `<tr><td class="p-2">${esc(x.name)}</td><td>${esc(x.channel)}</td><td>${money(x.budget)}</td><td>${money(x.spend)}</td><td>${x.leads}</td><td>${x.conversions}</td><td>${money(x.revenue)}</td><td>${roi.toFixed(1)}%</td></tr>`}))}</div>`}
function bi(){const sources={};st.leads?.forEach(l=>{const k=l.source||'unknown';sources[k]=(sources[k]||0)+1});const deals=st.deals||[];return `<div class="space-y-4"><div class="grid grid-cols-2 lg:grid-cols-5 gap-3">${card('Lead',st.leads?.length||0)}${card('Deal',deals.length)}${card('Closed',deals.filter(x=>x.stage==='closed').length)}${card('Win Rate',deals.length?((deals.filter(x=>x.stage==='closed').length/deals.length)*100).toFixed(1)+'%':'-')}${card('Pipeline',money(deals.reduce((a,x)=>a+num(x.value),0)))}</div>${table('Lead Source Attribution',['منبع','Lead','سهم'],Object.entries(sources).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<tr><td class="p-2">${esc(k)}</td><td>${v}</td><td>${st.leads.length?((v/st.leads.length)*100).toFixed(1):0}%</td></tr>`))}<section class="p-4 rounded-2xl bg-slate-900 border border-slate-800"><h3 class="font-black mb-2">کنترل‌های مدیریتی</h3><div class="grid md:grid-cols-3 gap-3 text-sm"><div>قراردادهای ۳۰ روزه: <b>${st.contracts.filter(x=>x.end&&x.end<=addDays(today(),30)).length}</b></div><div>اجاره معوق: <b>${st.leases.filter(x=>num(x.balance)>0).length}</b></div><div>تعمیرات پرریسک: <b>${st.maintenance.filter(x=>x.priority==='high'&&x.status!=='done').length}</b></div></div></section></div>`}
function workflows(){return `<div class="space-y-4">${form([input('name','نام Workflow','text','',true),input('trigger','Trigger','text','lead_created / deal_closed / payment_paid',true),input('condition','Condition','text','always'),input('action','Action','text','create_task / notify / journal',true),input('value','مقدار Action','text','',true)],'workflow360','ساخت Workflow')} ${table('Workflow Engine',['نام','Trigger','Condition','Action','Value','وضعیت'],st.workflows.map(x=>`<tr><td class="p-2">${esc(x.name)}</td><td>${esc(x.trigger)}</td><td>${esc(x.condition)}</td><td>${esc(x.action)}</td><td>${esc(x.value)}</td><td>${x.enabled?'فعال':'خاموش'}</td></tr>`))}<section class="p-4 rounded-2xl bg-slate-900 border border-slate-800"><h3 class="font-black">سناریوی E2E استاندارد</h3><p class="text-sm text-slate-300 leading-7">ایجاد Lead → ساخت Task پیگیری → تبدیل به Deal → قرارداد → ثبت Payment → Journal → کمیسیون → پیام پیگیری. هر رویداد Audit می‌شود.</p></section></div>`}
function integration(){return `<div class="space-y-4"><section class="p-4 rounded-2xl bg-slate-900 border border-slate-800"><h3 class="font-black mb-2">Backend / Integration Readiness</h3><div class="grid md:grid-cols-2 gap-3 text-sm"><div class="p-3 rounded-xl bg-slate-950">Local Domain Engine <b class="text-emerald-300">READY</b></div><div class="p-3 rounded-xl bg-slate-950">Audit Event Stream <b class="text-emerald-300">READY</b></div><div class="p-3 rounded-xl bg-slate-950">Supabase config <b class="text-amber-300">نیازمند credential محیط</b></div><div class="p-3 rounded-xl bg-slate-950">E2E browser test <b class="text-amber-300">نیازمند اجرای محیطی</b></div></div></section>${table('Audit Trail',['زمان','عملیات','Entity','جزئیات'],st.audit.slice(0,50).map(x=>`<tr><td class="p-2">${esc(x.at.slice(0,19).replace('T',' '))}</td><td>${esc(x.action)}</td><td>${esc(x.entity)}</td><td>${esc(x.detail)}</td></tr>`))}</div>`}
const nav=[['home','مرکز تکمیل ۱۰/۱۰'],['accounting','حسابداری Enterprise'],['contracts','قرارداد و امضای دیجیتال'],['communication','Communication Hub'],['pm','Property Management'],['maintenance','Maintenance'],['marketing','Marketing & ROI'],['bi','BI و گزارش مدیریتی'],['workflows','Workflow E2E'],['integration','Backend / E2E / Audit']];
const views={home,accounting,contracts,communication,pm,maintenance,marketing,bi,workflows,integration};
function addDays(d,k){const x=new Date(d+'T00:00:00');x.setDate(x.getDate()+k);return x.toISOString().slice(0,10)}
function open(){document.getElementById('v362-shell')?.remove();const m=document.createElement('div');m.id='v362-shell';m.innerHTML=`<div class="fixed inset-0 z-[99999] bg-slate-950/95 overflow-auto" dir="rtl"><div class="max-w-[1550px] mx-auto p-3 md:p-6"><div class="flex items-center justify-between gap-3 mb-4"><div><div class="text-2xl font-black">شیرنگی • لایه تکمیل Enterprise 36.2</div><div class="text-xs text-slate-400">عمق عملیاتی: Accounting • Contract • Communication • Property Management • Maintenance • Marketing • BI • Workflow</div></div><div class="flex gap-2">${btn('migrate','همگام‌سازی داده‌های قبلی','bg-indigo-700')}${btn('close','بستن','bg-red-700')}</div></div><div class="grid md:grid-cols-[250px_1fr] gap-4"><aside id="v362-nav" class="bg-slate-900 border border-slate-800 rounded-2xl p-2 h-fit"></aside><main id="v362-main"></main></div></div></div>`;document.body.appendChild(m);m.querySelector('[data-v362-action="close"]').onclick=()=>m.remove();m.querySelector('[data-v362-action="migrate"]').onclick=()=>{st=load();save();audit('sync','data','', 'مهاجرت داده‌های v36.1');toast('داده‌ها همگام شد');render()};render()}
function render(){const n=document.getElementById('v362-nav'),main=document.getElementById('v362-main');if(!n||!main)return;n.innerHTML=nav.map(([k,t])=>`<button data-v362-tab="${k}" class="w-full text-right px-3 py-2 rounded-xl mb-1 ${tab===k?'bg-emerald-700':'hover:bg-slate-800'}">${t}</button>`).join('');n.onclick=e=>{const b=e.target.closest('[data-v362-tab]');if(b){tab=b.dataset.v362Tab;render()}};main.innerHTML=views[tab]();bind(main)}
function bind(root){root.querySelectorAll('form[data-v362-form]').forEach(f=>f.addEventListener('submit',e=>{e.preventDefault();handle(f.dataset.v362Form,new FormData(f))}));root.onclick=e=>{const b=e.target.closest('[data-v362-action]');if(b)action(b.dataset.v362Action)}}
function get(f,k){return f.get(k)?.toString()||''}
function validRange(a,b){return !b||!a||new Date(b)>=new Date(a)}
function handle(kind,f){try{const base={id:uid(),createdAt:now()};if(kind==='journal'){const d=num(get(f,'a1')),c=num(get(f,'a2'));if(d<=0||c<=0||d!==c)throw Error('سند باید دقیقاً متوازن باشد');const j={...base,date:get(f,'date')||today(),memo:txt(get(f,'memo')),ref:txt(get(f,'ref')),balanced:true,lines:[{account:txt(get(f,'d1')),debit:d,credit:0},{account:txt(get(f,'c1')),debit:0,credit:c}]};st.journals.unshift(j);audit('post','journal',j.id,j.memo);toast('سند متوازن ثبت شد')}
else if(kind==='contract'){const start=get(f,'start'),end=get(f,'end');if(!validRange(start,end))throw Error('بازه قرارداد نامعتبر است');const x={...base,number:txt(get(f,'number')),type:txt(get(f,'type')),partyA:txt(get(f,'partyA')),partyB:txt(get(f,'partyB')),value:num(get(f,'value')),start,end,version:Math.max(1,num(get(f,'version'))),signature:txt(get(f,'signature'))||'unsigned',notes:txt(get(f,'notes')),status:'active'};if(st.contracts.some(c=>c.number===x.number))throw Error('شماره قرارداد تکراری است');st.contracts.unshift(x);audit('create','contract',x.id,x.number);toast('قرارداد ثبت شد')}
else if(kind==='message'){const x={...base,contact:txt(get(f,'contact')),channel:txt(get(f,'channel')),subject:txt(get(f,'subject')),body:txt(get(f,'body')),followup:get(f,'followup'),at:now()};st.messages.unshift(x);audit('communication','message',x.id,x.channel);toast('تعامل ثبت شد')}
else if(kind==='lease360'){const start=get(f,'start'),end=get(f,'end');if(!validRange(start,end))throw Error('تاریخ اجاره نامعتبر است');const x={...base,property:txt(get(f,'property')),owner:txt(get(f,'owner')),tenant:txt(get(f,'tenant')),rent:num(get(f,'rent')),deposit:num(get(f,'deposit')),start,end,nextDue:get(f,'nextDue')||start,balance:num(get(f,'balance')),status:'active'};st.leases.unshift(x);audit('create','lease',x.id,x.property);run('lease_created',x);toast('قرارداد اجاره ثبت شد')}
else if(kind==='maintenance360'){const x={...base,property:txt(get(f,'property')),title:txt(get(f,'title')),priority:txt(get(f,'priority'))||'medium',vendor:txt(get(f,'vendor')),cost:num(get(f,'cost')),due:get(f,'due')||addDays(today(),1),sla:num(get(f,'sla'))||24,status:'open'};st.maintenance.unshift(x);audit('create','maintenance',x.id,x.title);run('maintenance_created',x);toast('تیکت تعمیرات ثبت شد')}
else if(kind==='campaign'){const x={...base,name:txt(get(f,'name')),channel:txt(get(f,'channel')),budget:num(get(f,'budget')),spend:num(get(f,'spend')),leads:num(get(f,'leads')),conversions:num(get(f,'conversions')),revenue:num(get(f,'revenue')),utm:txt(get(f,'utm'))};if(x.spend>x.budget&&x.budget>0)throw Error('هزینه کمپین از بودجه بیشتر است');st.campaigns.unshift(x);audit('create','campaign',x.id,x.name);toast('کمپین ثبت شد')}
else if(kind==='workflow360'){const x={...base,name:txt(get(f,'name')),trigger:txt(get(f,'trigger')),condition:txt(get(f,'condition'))||'always',action:txt(get(f,'action')),value:txt(get(f,'value')),enabled:true};st.workflows.unshift(x);audit('create','workflow',x.id,x.name);toast('Workflow فعال شد')}
else throw Error('فرم ناشناخته');save();render()}catch(e){toast(e.message||'ورودی نامعتبر است')}}
function action(a){if(a==='noop')return;if(a==='accounting-seed'){for(const a of empty.accounts)if(!st.accounts.some(x=>x.id===a.id))st.accounts.push(clone(a));save();toast('سرفصل‌های پایه آماده شد');render();return}if(a.startsWith('sign:')){const x=st.contracts.find(x=>x.id===a.slice(5));if(x){x.signature='signed';x.signedAt=now();audit('sign','contract',x.id,x.number);save();render();toast('قرارداد امضا شد')}}else if(a.startsWith('contract-version:')){const x=st.contracts.find(x=>x.id===a.slice(17));if(x){x.version=num(x.version)+1;x.updatedAt=now();audit('version','contract',x.id,String(x.version));save();render()}}else if(a.startsWith('rent-paid:')){const x=st.leases.find(x=>x.id===a.slice(10));if(x){try{atomic(()=>{const amt=num(x.rent);if(amt<=0)throw Error('مبلغ اجاره نامعتبر است');const before=x.balance;x.balance=Math.max(0,num(x.balance)-amt);x.lastPaid=today();x.nextDue=addDays(x.nextDue||today(),30);audit('payment','lease',x.id,String(amt));try{run('payment_paid',x)}catch(e){x.balance=before;throw e}});render();toast('وصول اجاره ثبت شد')}catch(e){toast(e.message||'ثبت اجاره ناموفق بود')}}}else if(a.startsWith('maint-done:')){const x=st.maintenance.find(x=>x.id===a.slice(11));if(x){x.status='done';x.completedAt=now();audit('close','maintenance',x.id,x.title);save();render();toast('تیکت بسته شد')}}else if(a==='migrate'){st=load();save();render();toast('داده‌ها همگام شد')}}
function run(trigger,payload){for(const w of st.workflows.filter(x=>x.enabled&&x.trigger===trigger)){if(w.action==='create_task'){try{const old=JSON.parse(ShirangiRuntimeStorage.getItem(KEY)||'{}');st.tasks=st.tasks||[];st.tasks.unshift({id:uid(),title:w.value||`پیگیری ${trigger}`,due:addDays(today(),1),status:'open',entity:payload.id,createdAt:now()});save()}catch{}}if(w.action==='notify')toast(w.value||`رویداد ${trigger}`);audit('workflow',trigger,payload.id,w.name)}}
// Canonical Enterprise API: 36.2.2 is the only user-facing suite.
const Enterprise36_2_2=Object.freeze({open,version:36.2,state:()=>clone(st)});
window.shirangiEnterpriseCompletion=Enterprise36_2_2;
window.shirangiEnterpriseSuite=Enterprise36_2_2;
function boot(){
  if(document.getElementById('v362-launcher')) return;
  ensureOneLineShellUI?.();
  const b=document.createElement('button');
  b.id='v362-launcher';
  b.textContent='مرکز عملیات حرفه‌ای';
  b.style='position:fixed;bottom:18px;right:18px;z-index:99980;padding:12px 16px;border-radius:14px;background:#0f766e;color:#fff;font-weight:800;box-shadow:0 10px 30px rgba(0,0,0,.3)';
  b.onclick=open;
  document.body.appendChild(b);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();


/* ===== 18: js/shirangi-tehran-22-regions-layer.js ===== */
/* Full-resolution user-supplied Tehran GIS integration.
 * Source archives are preserved in shared/map-data/source-gis/.
 * GeoJSON is served per region and loaded lazily so mobile WebViews are not forced
 * to parse the entire Tehran dataset at startup. No geometry simplification is used.
 */
(function () {
  'use strict';
  const CONFIG = Object.freeze({
    indexUrl: '../../shared/map-data/tehran-regions/index.json',
    dataDir: '../../shared/map-data/tehran-regions/',
    minZoom: 13,
    unloadOutsideViewport: true
  });
  let index = null;
  let map = null;
  const layers = new Map();
  const loading = new Map();
  let selected = null;

  const regionStyle = (id) => ({
    color: '#f59e0b',
    weight: 1,
    opacity: 0.72,
    fillColor: '#f59e0b',
    fillOpacity: 0.035,
    interactive: true
  });

  function regionInView(featureCollection) {
    if (!map || !featureCollection?.features?.length) return false;
    try {
      const b = L.geoJSON(featureCollection).getBounds();
      return map.getBounds().pad(0.05).intersects(b);
    } catch (_) { return true; }
  }

  async function loadRegion(region) {
    if (!map || !region || layers.has(region.id) || loading.has(region.id)) return;
    loading.set(region.id, true);
    try {
      const response = await fetch(CONFIG.dataDir + region.file, { cache: 'force-cache' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      if (!data || data.type !== 'FeatureCollection') throw new Error('Invalid GeoJSON');
      const layer = L.geoJSON(data, {
        style: () => regionStyle(region.id),
        onEachFeature: (feature, featureLayer) => {
          featureLayer.on('click', () => {
            selected = region.id;
            try { featureLayer.setStyle({ weight: 2, opacity: 1, fillOpacity: 0.10 }); } catch (_) {}
          });
        }
      });
      layer.options.shirangiLayerName = 'Shirangi — قطعات GIS منطقه ' + region.id;
      layers.set(region.id, layer);
      if (map.getZoom() >= CONFIG.minZoom && regionInView(data)) layer.addTo(map);
    } catch (error) {
      console.warn('[Shirangi] Tehran GIS region ' + region.id + ' failed to load', error);
    } finally {
      loading.delete(region.id);
    }
  }

  function syncVisibleRegions() {
    if (!map || !index) return;
    const zoom = map.getZoom();
    if (zoom < CONFIG.minZoom) {
      layers.forEach(layer => { if (map.hasLayer(layer)) map.removeLayer(layer); });
      return;
    }
    index.regions.forEach(loadRegion);
    if (CONFIG.unloadOutsideViewport) {
      const bounds = map.getBounds().pad(0.15);
      layers.forEach((layer, id) => {
        try {
          const visible = bounds.intersects(layer.getBounds());
          if (visible && !map.hasLayer(layer)) layer.addTo(map);
          if (!visible && map.hasLayer(layer)) map.removeLayer(layer);
        } catch (_) {}
      });
    }
  }

  function focusRegion(id) {
    if (!map || !index) return false;
    const region = index.regions.find(r => Number(r.id) === Number(id));
    if (!region) return false;
    const layer = layers.get(region.id);
    if (layer) {
      try { map.fitBounds(layer.getBounds(), { padding: [20, 20], maxZoom: 16 }); } catch (_) {}
    } else {
      // Load first, then fit exactly to its real geometry.
      loadRegion(region).then(() => {
        const loaded = layers.get(region.id);
        if (loaded) try { loaded.addTo(map); map.fitBounds(loaded.getBounds(), { padding: [20, 20], maxZoom: 16 }); } catch (_) {}
      });
    }
    return true;
  }

  function addRegionControl() {
    if (!map || !index || document.getElementById('shirangi-tehran-region-control')) return;
    const Control = L.Control.extend({
      options: { position: 'topleft' },
      onAdd: function () {
        const div = L.DomUtil.create('div', 'leaflet-bar');
        div.id = 'shirangi-tehran-region-control';
        div.style.background = '#0f172a';
        div.style.padding = '4px';
        div.style.borderRadius = '10px';
        div.title = 'انتخاب منطقه تهران';
        const select = document.createElement('select');
        select.setAttribute('aria-label', 'انتخاب منطقه تهران');
        select.style.cssText = 'background:#0f172a;color:#fff;border:0;border-radius:7px;padding:7px 8px;font-weight:700;max-width:150px;';
        const first = document.createElement('option'); first.value = ''; first.textContent = '۲۲ منطقه تهران'; select.appendChild(first);
        index.regions.forEach(r => { const o = document.createElement('option'); o.value = String(r.id); o.textContent = r.name; select.appendChild(o); });
        select.addEventListener('change', () => { if (select.value) focusRegion(Number(select.value)); });
        div.appendChild(select);
        L.DomEvent.disableClickPropagation(div); L.DomEvent.disableScrollPropagation(div);
        return div;
      }
    });
    map.addControl(new Control());
  }

  async function boot() {
    const tryBoot = async () => {
      map = window.__shirangiMapInstance;
      if (!map) return setTimeout(tryBoot, 250);
      try {
        const response = await fetch(CONFIG.indexUrl, { cache: 'force-cache' });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        index = await response.json();
        addRegionControl();
        map.on('zoomend moveend', syncVisibleRegions);
        syncVisibleRegions();
      } catch (error) {
        console.warn('[Shirangi] Tehran 22-region GIS index failed', error);
      }
    };
    tryBoot();
  }

  window.ShirangiTehran22Regions = Object.freeze({ config: CONFIG, boot, focusRegion, syncVisibleRegions });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}());

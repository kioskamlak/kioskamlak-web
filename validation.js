/* Copyright (c) 2026 Shirangi. All rights reserved. */
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

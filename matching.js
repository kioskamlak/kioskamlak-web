/* Copyright (c) 2026 Shirangi. All rights reserved. */
/**
 * Shirangi Core — Customer ↔ Property Matching (canonical)
 * Pure scoring. No DOM, no network.
 */
(function (global) {
  'use strict';

  const V = global.ShirangiValidation;

  function num(v) {
    if (V?.rejectUnhealthyNumber) {
      const r = V.rejectUnhealthyNumber(v);
      return r.ok ? r.value : 0;
    }
    const n = Number(String(v ?? '').replace(/[٬،,\s]/g, ''));
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

  function parseNumericToken(raw) {
    let s = toAsciiDigits(raw).trim().replace(/\s/g, '').replace(/[٬،]/g, '');
    s = s.replace(/٫/g, '.');
    // Slash and comma are accepted as thousands separators when they are not decimal points.
    if (/^[+-]?\d{1,3}(?:[\/,]\d{3})+$/.test(s)) s = s.replace(/[\/,]/g, '');
    else if ((s.match(/\./g) || []).length > 1) {
      const last = s.lastIndexOf('.');
      s = s.slice(0, last).replace(/\./g, '') + s.slice(last);
    }
    const n = Number(s.replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  function parseNeed(text) {
    const raw = String(text || '').trim();
    const t = toAsciiDigits(raw).replace(/٫/g, '.');
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

    const numberPattern = '(?:\\d+(?:[.,/]\\d{3})*(?:\\.\\d+)?)';
    const areaMatch = t.match(new RegExp('(' + numberPattern + ')\\s*تا\\s*(' + numberPattern + ')\\s*متر'));
    if (areaMatch) {
      const a = parseNumericToken(areaMatch[1]), b = parseNumericToken(areaMatch[2]);
      if (a != null && b != null) { out.areaMin = Math.min(a,b); out.areaMax = Math.max(a,b); }
    } else {
      const single = t.match(new RegExp('(' + numberPattern + ')\\s*متر'));
      if (single) {
        const n = parseNumericToken(single[1]);
        if (n != null) { out.areaMin = Math.round(n * 0.85); out.areaMax = Math.round(n * 1.15); }
      }
    }

    // Prefer explicit میلیارد / میلیون units to avoid matching area numbers.
    const priceMatch =
      t.match(/تا\s*([\d٬،,\/\.\s]+)\s*(میلیارد)/) ||
      t.match(/تا\s*([\d٬،,\/\.\s]+)\s*(میلیون)/) ||
      t.match(/(?:بودجه|قیمت|مبلغ)\s*([\d٬،,\/\.\s]+)\s*(میلیارد|میلیون)?/);
    if (priceMatch) {
      let n = parseNumericToken(priceMatch[1]);
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

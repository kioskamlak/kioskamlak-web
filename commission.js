/* Copyright (c) 2026 Shirangi. All rights reserved. */
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

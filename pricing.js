/* Copyright (c) 2026 Shirangi. All rights reserved. */
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

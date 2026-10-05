/* Copyright (c) 2026 Shirangi. All rights reserved. */
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

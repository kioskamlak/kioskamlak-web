/* Copyright (c) 2026 Shirangi. All rights reserved. */
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

  /** Legacy experimental OS layers — kept in bundle for data compatibility, UI suppressed. */
  const LEGACY_LAYER_IDS = Object.freeze([
    'os4', 'os5', 'os6', 'os7', 'os8', 'os10', 'os12', 'os13', 'os14', 'os15',
    'os16', 'os17', 'os18', 'os19', 'os20', 'os21', 'os22', 'os24', 'os25',
    'os26', 'os27', 'os30', 'os50', 'os60', 'autopilot', 'mission-control',
    'digital-twin', 'executive-brain', 'self-improving', 'command-intelligence'
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
    LEGACY_LAYER_IDS,
    isAllowedExternalUrl,
    isSensitiveStorageKey,
    freezeDeep,
    assertSafeNavigation
  });
})(typeof window !== 'undefined' ? window : globalThis);

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

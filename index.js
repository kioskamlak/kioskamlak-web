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

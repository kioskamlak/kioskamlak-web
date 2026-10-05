/* Copyright (c) 2026 Shirangi. All rights reserved. */
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

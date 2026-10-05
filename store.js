/* Copyright (c) 2026 Shirangi. All rights reserved. */
/**
 * Shirangi Core — Bounded namespaced storage (canonical) v41.1.0
 * Browser localStorage wrapper with size limits, events, and light schema versioning.
 * Desktop uses encrypted file storage via Electron main; this is the web/android path.
 */
(function (global) {
  'use strict';

  const PREFIX = 'shirangi_core_';
  const MAX_VALUE_BYTES = 1_500_000; // hard per-key bound
  const META_KEY = '__meta__';
  const MAX_BATCH_OPS = 32;
  const MAX_STORE_NAME = 80;

  const byteLength = (value) => {
    const text = String(value ?? '');
    try {
      if (typeof TextEncoder === 'function') return new TextEncoder().encode(text).length;
    } catch (_) {}
    try { return unescape(encodeURIComponent(text)).length; } catch (_) { return text.length; }
  };

  const assertName = (name) => {
    const raw = String(name || '').trim();
    if (!raw || raw.length > MAX_STORE_NAME) throw new Error('INVALID_STORE_NAME');
    const policy = global.ShirangiSecurityPolicy;
    if (policy?.isSensitiveStorageKey?.(raw)) throw new Error('SENSITIVE_STORAGE_KEY_FORBIDDEN');
    return raw;
  };

  const keyOf = (name) => PREFIX + assertName(name).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, MAX_STORE_NAME);

  const clone = (v) => {
    try {
      return typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v));
    } catch {
      return v;
    }
  };

  const read = (name, fallback = null) => {
    try {
      const raw = localStorage.getItem(keyOf(name));
      return raw == null ? clone(fallback) : JSON.parse(raw);
    } catch {
      return clone(fallback);
    }
  };

  const write = (name, value) => {
    const key = keyOf(name);
    const serialized = JSON.stringify(value);
    if (byteLength(serialized) > MAX_VALUE_BYTES) {
      throw new Error('STORAGE_VALUE_TOO_LARGE');
    }
    localStorage.setItem(key, serialized);
    global.ShirangiEvents?.emit('storage:write', { name });
    return true;
  };

  const remove = (name) => {
    localStorage.removeItem(keyOf(name));
    global.ShirangiEvents?.emit('storage:remove', { name });
  };

  const transaction = (name, fn, fallback = null) => {
    const current = read(name, fallback);
    const next = fn(clone(current));
    write(name, next);
    return next;
  };

  /**
   * Multi-key transaction: read several, compute, write several atomically-ish.
   * (localStorage is sync; still best-effort if quota throws mid-way.)
   */
  const batch = (ops) => {
    // Best-effort atomic batch with rollback if a later write fails.
    if (!Array.isArray(ops) || !ops.length || ops.length > MAX_BATCH_OPS) throw new Error('INVALID_BATCH');
    const prepared = [];
    const names = new Set();
    for (const op of ops) {
      if (!op || typeof op.fn !== 'function') throw new Error('INVALID_BATCH_OP');
      const name = assertName(op.name);
      if (names.has(name)) throw new Error('DUPLICATE_BATCH_KEY');
      names.add(name);
      const storageKey = keyOf(name);
      let beforeRaw = null;
      let existed = false;
      try {
        beforeRaw = global.localStorage.getItem(storageKey);
        existed = beforeRaw !== null;
      } catch (_) {}
      const before = existed ? parseStoredValue(beforeRaw, op.fallback ?? null) : clone(op.fallback ?? null);
      const next = op.fn(clone(before));
      prepared.push({ name, before, beforeRaw, existed, next });
    }
    const written = [];
    try {
      for (const item of prepared) {
        write(item.name, item.next);
        written.push(item);
      }
    } catch (err) {
      for (let i = written.length - 1; i >= 0; i--) {
        const item = written[i];
        try {
          if (item.existed) write(item.name, item.before);
          else remove(item.name);
        } catch (_) {}
      }
      throw err;
    }
    return Object.fromEntries(prepared.map(x => [x.name, x.next]));
  };

  const keys = () =>
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .map((k) => k.slice(PREFIX.length));

  /** Soft total usage estimate (characters). */
  const usage = () => {
    let total = 0;
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(PREFIX)) {
        total += (localStorage.getItem(k) || '').length + k.length;
      }
    }
    return { bytesApprox: total, keys: keys().length };
  };

  /**
   * Lightweight schema versioning per store name.
   * migrate(name, targetVersion, migrators)
   * migrators: { [fromVersion]: (data) => nextData }
   */
  const getMeta = () => read(META_KEY, { versions: {} });
  const setMeta = (meta) => write(META_KEY, meta);

  const getVersion = (name) => {
    const meta = getMeta();
    return Number(meta.versions?.[name] || 0);
  };

  const setVersion = (name, version) => {
    const meta = getMeta();
    meta.versions = meta.versions || {};
    meta.versions[name] = Number(version) || 0;
    setMeta(meta);
  };

  /**
   * One-way import of legacy un-namespaced data into canonical core storage.
   * Feature modules may request migration through this API; only Core touches
   * the underlying browser storage primitive.
   */
  const parseStoredValue = (raw, fallback = null) => {
    if (raw == null) return clone(fallback);
    try { return JSON.parse(raw); } catch (_) { return String(raw); }
  };

  const readLegacyValue = (name, legacyKey, fallback = null) => {
    const canonical = read(name, undefined);
    if (canonical !== undefined) return canonical;
    try {
      const rawKey = String(legacyKey || '').trim();
      if (!rawKey || rawKey === keyOf(name)) return clone(fallback);
      const raw = global.localStorage?.getItem(rawKey);
      if (raw == null) return clone(fallback);
      const value = parseStoredValue(raw, fallback);
      write(name, value);
      try { global.localStorage.removeItem(rawKey); } catch (_) {}
      return clone(value);
    } catch (_) {
      return clone(fallback);
    }
  };

  const readLegacy = (name, legacyKey, fallback = null) =>
    readLegacyValue(name, legacyKey, fallback);

  const migrate = (name, targetVersion, migrators = {}, fallback = null) => {
    let version = getVersion(name);
    let data = read(name, fallback);
    const target = Number(targetVersion) || 0;
    while (version < target) {
      const fn = migrators[version];
      if (typeof fn !== 'function') throw new Error(`MIGRATION_MISSING:${name}:${version}->${target}`);
      const next = fn(clone(data));
      if (next === undefined) throw new Error(`MIGRATION_RETURNED_UNDEFINED:${name}:${version}`);
      data = next;
      version += 1;
      write(name, data);
      setVersion(name, version);
    }
    return { data, version: getVersion(name) };
  };

  global.ShirangiStore = Object.freeze({
    PREFIX,
    keyOf,
    clone,
    read,
    write,
    remove,
    transaction,
    batch,
    keys,
    usage,
    getVersion,
    setVersion,
    migrate,
    readLegacy,
    readLegacyValue,
    MAX_VALUE_BYTES,
    MAX_BATCH_OPS,
    MAX_STORE_NAME
  });
})(typeof window !== 'undefined' ? window : globalThis);

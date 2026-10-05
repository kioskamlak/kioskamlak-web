/* Copyright (c) 2026 Shirangi. All rights reserved. */
/*
 * Shirangi Competitive Suite v36.4
 *
 * Purpose: turn the existing CRM into a real-estate sales operating layer.
 * Design: local-first, provider-agnostic, fail-closed cloud adapters.
 *
 * Public API is intentionally small. UI code should call ShirangiCompetitive
 * instead of touching this module's storage keys directly.
 */
(function (global) {
  'use strict';

  const VERSION = '36.9.2-hardened';
  const NS = 'shirangi.competitive.v2';
  const LIMIT = 500;
  const MAX_TEXT = 8000;
  const CHANNELS = new Set(['website', 'mobile', 'instagram', 'telegram', 'whatsapp', 'portal']);

  const KEYS = Object.freeze({
    leads: `${NS}.leads`,
    conversations: `${NS}.conversations`,
    messages: `${NS}.messages`,
    campaigns: `${NS}.campaigns`,
    network: `${NS}.network`,
    market: `${NS}.market`,
    publishing: `${NS}.publishing`,
    notifications: `${NS}.notifications`,
    viewings: `${NS}.viewings`,
    owners: `${NS}.owners`,
    contracts: `${NS}.contracts`,
    deals: `${NS}.deals`
  });

  const now = () => Date.now();
  const text = (value, max = MAX_TEXT) => String(value ?? '').trim().slice(0, max);
  const id = () => global.crypto?.randomUUID?.() || `sh_${Date.now()}`;

  function read(key, fallback) {
    try {
      const value = global.ShirangiStore?.readLegacy(key,key,undefined);
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    if (!global.ShirangiStore) return false;
    global.ShirangiStore.write(key, value);
    return true;
  }

  function list(key) {
    const value = read(key, []);
    return Array.isArray(value) ? value : [];
  }

  function append(key, value, limit = LIMIT) {
    const rows = list(key);
    rows.unshift(value);
    write(key, rows.slice(0, limit));
    return value;
  }

  function update(key, itemId, mutate) {
    const rows = list(key);
    const item = rows.find(row => row.id === itemId);
    if (!item) return null;
    mutate(item);
    write(key, rows);
    return item;
  }

  function properties() {
    return Array.isArray(global.properties) ? global.properties : [];
  }

  function customers() {
    if (typeof global.shirangiProGetCustomers === 'function') {
      return global.shirangiProGetCustomers() || [];
    }
    return Array.isArray(global.customers) ? global.customers : [];
  }

  function propertyPrice(property) {
    return Number(property?.price || property?.salePrice || property?.deposit || 0) || 0;
  }

  function cloudReady() {
    return !!global.ShirangiConfigGuard?.isCloudReady?.();
  }

  async function cloud(path, body = {}) {
    if (!cloudReady()) return { ok: false, error: 'cloud_not_configured' };
    const base = text(global.SHIRANGI_CONFIG?.functionsBase, 500).replace(/\/$/, '');
    if (!/^https:\/\//i.test(base)) return { ok: false, error: 'functions_base_invalid' };
    if (!path.startsWith('/api/v1/')) return { ok: false, error: 'invalid_api_path' };

    let payload;
    try {
      payload = JSON.stringify(body);
      if (payload.length > 250000) return { ok: false, error: 'payload_too_large' };
    } catch {
      return { ok: false, error: 'payload_invalid' };
    }

    try {
      const session = await global.supabase?.auth?.getSession?.();
      const token = session?.data?.session?.access_token || '';
      if (!token) return { ok: false, error: 'authentication_required' };

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch(base + path, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: payload,
          signal: controller.signal
        });
        const raw = await response.text();
        if (raw.length > 500000) return { ok: false, error: 'response_too_large' };
        let data = {};
        try { data = raw ? JSON.parse(raw) : {}; } catch { return { ok: false, error: 'invalid_server_response' }; }
        return response.ok ? data : { ok: false, error: data.error || `http_${response.status}` };
      } finally {
        clearTimeout(timer);
      }
    } catch (error) {
      return { ok: false, error: error?.name === 'AbortError' ? 'timeout' : 'network_error' };
    }
  }

  // -------------------------------------------------------------------------
  // Market intelligence / AVM
  // -------------------------------------------------------------------------
  function valuation(input = {}) {
    const src = (input && typeof input === 'object') ? input : {};
    const rawText = String(src.raw || src.title || src.text || src.description || '');
    const rawNormalized = rawText
      .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
      .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
    const areaFromText = (rawNormalized.match(/(\d+(?:\.\d+)?)\s*(?:متر|متری|m2|sqm)/i) || [])[1];
    const moneyFromText = rawNormalized.match(/(\d+(?:[.,]\d+)?)\s*(میلیارد|میلیون|billion|million)/i);
    const priceFromText = moneyFromText
      ? Number(moneyFromText[1].replace(/,/g, '')) * (/میلیارد|billion/i.test(moneyFromText[2]) ? 1e9 : 1e6)
      : 0;
    const area = Number(src.area || areaFromText || 0);
    const age = Math.max(0, Number(src.age || src.buildingAge || 0));
    const district = text(src.district, 120);
    const baseMeter = Number(src.baseMeter || src.meter || (area > 0 && priceFromText > 0 ? priceFromText / area : 0));
    if (area <= 0) return { ok: false, error: 'area_required' };

    const comps = properties()
      .filter(p => p !== src && (!district || text(p.district || p.address, 160).includes(district)))
      .map(p => ({
        id: p.id,
        title: text(p.title || p.address || 'ملک', 100),
        area: Number(p.area || 0),
        price: propertyPrice(p)
      }))
      .filter(p => p.area > 0 && p.price > 0)
      .map(p => ({ ...p, meter: p.price / p.area }))
      .sort((a, b) => Math.abs(a.area - area) - Math.abs(b.area - area))
      .slice(0, 20);

    const meters = comps.map(c => c.meter).sort((a, b) => a - b);
    const median = meters.length ? meters[Math.floor(meters.length / 2)] : baseMeter;
    if (!median) return { ok: false, error: 'insufficient_market_data' };

    let factor = 1 - Math.min(age, 40) * 0.004;
    if (src.parking) factor *= 1.025;
    if (Number(src.floor || 0) >= 3) factor *= 1.01;

    const center = area * median * factor;
    const spread = comps.length >= 5 ? 0.07 : 0.12;
    return {
      ok: true,
      center,
      low: center * (1 - spread),
      high: center * (1 + spread),
      meter: median,
      confidence: Math.min(95, 45 + comps.length * 2 + (baseMeter ? 10 : 0)),
      comps
    };
  }

  function saveMarketSnapshot(data = {}) {
    const snapshot = {
      id: id(),
      district: text(data.district, 120),
      metric: text(data.metric || 'meter_price', 60),
      value: Number(data.value || 0),
      source: text(data.source || 'manual', 120),
      observedAt: Number(data.observedAt || now()),
      createdAt: now()
    };
    if (!snapshot.metric || snapshot.value < 0) return { ok: false, error: 'invalid_market_snapshot' };
    return append(KEYS.market, snapshot);
  }

  // -------------------------------------------------------------------------
  // AI intake + deterministic matching
  // -------------------------------------------------------------------------
  function parsePropertyText(value) {
    const raw = text(value);
    const normalized = raw
      .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
      .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
      .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
      .replace(/[\u200c\u200d]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const number = regex => {
      const match = normalized.match(regex);
      return match ? Number(String(match[1]).replace(/[,٬،]/g, '')) : null;
    };

    const wordBedrooms = {یک:1, یه:1, دو:2, سه:3, چهار:4, پنج:5, شش:6};
    const bedroomMatch = normalized.match(/(\d+)\s*(?:خواب|خوابه|اتاق)|(?:^|\s)(یک|یه|دو|سه|چهار|پنج|شش)\s*(?:خواب|خوابه|اتاق)/i);
    const bedrooms = bedroomMatch ? Number(bedroomMatch[1] || wordBedrooms[bedroomMatch[2]]) : null;

    const moneyMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(میلیارد|میلیون|هزار|billion|million|bn|mn)/i);
    let price = null;
    if (moneyMatch) {
      const n = Number(moneyMatch[1].replace(/,/g, ''));
      const unit = moneyMatch[2].toLowerCase();
      price = unit.includes('میلیارد') || unit === 'billion' || unit === 'bn' ? n * 1e9
        : unit.includes('میلیون') || unit === 'million' || unit === 'mn' ? n * 1e6
        : n * 1e3;
    }

    // Stop location extraction before construction-year / price phrases.
    let district = (normalized.match(/(?:منطقه|محله|محدوده)\s*[:：-]?\s*(.+?)(?=\s+سال(?:\s+ساخت)?\s+(?:13|14)\d{2}|\s+قیمت\b|\s+\d+(?:[.,]\d+)?\s*(?:میلیارد|میلیون|هزار)\b|[،,؛;\n]|$)/i) || [])[1]?.trim() || '';
    if (!district) district = (normalized.match(/(?:^|\s)در\s+(.+?)(?=\s+سال(?:\s+ساخت)?\s+(?:13|14)\d{2}|\s+قیمت\b|\s+\d+(?:[.,]\d+)?\s*(?:میلیارد|میلیون|هزار)\b|[،,؛;\n]|$)/i) || [])[1]?.trim() || '';

    const area = number(/(\d{2,5})\s*(?:متر|متری)/i);
    const baseMeter = area > 0 && price > 0 ? Math.round(price / area) : null;

    // Building age: accept either an explicit age or a construction year.
    // Examples: «سن بنا ۷ سال»، «۷ ساله»، «۷ سال ساخت»، «سال ساخت ۱۳۹۸»، «سال ۱۳۹۰».
    const explicitAgeMatch = normalized.match(/(?:سن\s*(?:بنا|ساختمان)?|عمر\s*(?:بنا|ساختمان)?)[\s:：-]*(\d{1,2})\s*(?:سال|ساله)?/i)
      || normalized.match(/(\d{1,2})\s*(?:سال|ساله)\s*(?:ساخت|قدمت|سن(?:\s*بنا)?)/i)
      || normalized.match(/(?:ساختمان|بنا)\s*(?:\w+\s*)?(\d{1,2})\s*ساله/i)
      || normalized.match(/(?:^|[،,؛;\s])(\d{1,2})\s*ساله(?:[،,؛;\s]|$)/i);
    const explicitAge = explicitAgeMatch ? Number(explicitAgeMatch[1]) : null;

    const yearMatch = normalized.match(/(?:سال\s*(?:ساخت|بنا)?|ساخت|بنا\s*در)\s*[:：-]?\s*((?:13|14)\d{2})/i);
    const yearBuilt = yearMatch ? Number(yearMatch[1]) : null;

    let currentPersianYear = 1405;
    try {
      const y = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric' }).format(new Date());
      const digits = y.replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
      const parsedYear = Number(digits.replace(/[^0-9]/g, ''));
      if (parsedYear >= 1300 && parsedYear <= 1500) currentPersianYear = parsedYear;
    } catch (_) {}

    const age = explicitAge != null
      ? Math.max(0, explicitAge)
      : (yearBuilt != null ? Math.max(0, currentPersianYear - yearBuilt) : null);

    return {
      title: raw.slice(0, 90),
      area,
      bedrooms,
      price,
      baseMeter,
      district,
      age,
      yearBuilt,
      parking: /پارکینگ/.test(normalized) && !/(?:بدون|فاقد)\s*پارکینگ|پارکینگ\s*(?:ندارد|نداره|نداشته|نداشتن)/.test(normalized),
      elevator: /آسانسور/.test(normalized),
      storage: /انباری/.test(normalized),
      raw
    };
  }
  function extractAndFillProperty() {
    const doc = global.document;
    if (!doc) return { ok: false, error: 'document_unavailable' };
    try {
      const input = doc.getElementById('cs-ai-text');
      const resultEl = doc.getElementById('cs-ai-result');
      const value = input?.value || '';
      if (!value.trim()) {
        if (resultEl) resultEl.textContent = 'متن ملک را وارد کنید.';
        return { ok: false, error: 'text_required' };
      }
      const x = parsePropertyText(value);
      const set = (id, v) => { const el = doc.getElementById(id); if (el && v != null && v !== '') el.value = String(v); };
      set('cs-val-area', x.area);
      set('cs-val-age', x.age);
      set('cs-val-district', x.district);
      set('cs-val-meter', x.baseMeter);
      const parking = doc.getElementById('cs-val-parking');
      if (parking && x.parking) parking.checked = true;
      if (resultEl) resultEl.textContent = JSON.stringify(x, null, 2);
      return { ok: true, data: x };
    } catch (error) {
      if (resultEl) resultEl.textContent = 'خطا در استخراج مشخصات: ' + String(error?.message || error);
      return { ok: false, error: String(error?.message || error) };
    }
  }


  function matchCustomer(customer = {}, limit = 10) {
    const wanted = text(customer.district || customer.area || customer.needs || customer.description, 300);
    const budget = Number(customer.budget || customer.maxBudget || 0);
    return properties()
      .map(property => {
        let score = 0;
        const location = text(property.district || property.address, 300);
        const price = propertyPrice(property);
        if (wanted && location.includes(wanted)) score += 40;
        if (budget && price) score += Math.max(0, 40 - Math.abs(price - budget) / budget * 80);
        if (customer.type && text(property.type, 100).includes(text(customer.type, 100))) score += 10;
        if (customer.bedrooms && Number(property.bedrooms) === Number(customer.bedrooms)) score += 10;
        return { ...property, _matchScore: Math.max(0, Math.min(100, Math.round(score))) };
      })
      .filter(property => property._matchScore > 0)
      .sort((a, b) => b._matchScore - a._matchScore)
      .slice(0, limit);
  }

  function nextActions() {
    const actions = [];
    for (const customer of customers()) {
      const due = Number(customer.reminderAt || customer.nextContactAt || 0);
      if (due && due <= now()) actions.push({
        priority: 92,
        title: `پیگیری مشتری ${text(customer.name || customer.fullName || customer.phone, 80)}`,
        reason: 'پیگیری سررسید شده',
        customerId: customer.id
      });
      const match = matchCustomer(customer, 1)[0];
      if (match) actions.push({
        priority: 84,
        title: `ارسال فایل مناسب برای ${text(customer.name || customer.fullName || 'مشتری', 80)}`,
        reason: `امتیاز تطبیق ${match._matchScore}٪`,
        propertyId: match.id,
        customerId: customer.id
      });
    }
    for (const property of properties()) {
      const updated = Number(property.updatedAt || property.createdAt || 0);
      if (updated && now() - updated > 30 * 86400000) actions.push({
        priority: 76,
        title: `بازبینی فایل ${text(property.title || property.address || property.id, 90)}`,
        reason: 'فایل قدیمی است',
        propertyId: property.id
      });
    }
    return actions.sort((a, b) => b.priority - a.priority).slice(0, 20);
  }

  async function aiCopilot(input, context = {}) {
    const source = text(input);
    if (!source) return { ok: false, error: 'input_required' };
    const parsed = parsePropertyText(source);
    if (!cloudReady()) return { ok: true, mode: 'local', result: { intent: 'property_intake', parsed, nextActions: nextActions().slice(0, 5) } };
    return cloud('/api/v1/ai/copilot', { input: source, context: { ...context, parsed } });
  }

  // -------------------------------------------------------------------------
  // Lead generation + lifecycle
  // -------------------------------------------------------------------------
  function createLead(data = {}) {
    const source = text(data.source || 'manual', 60).toLowerCase();
    if (!CHANNELS.has(source) && source !== 'manual') return { ok: false, error: 'invalid_lead_source' };
    const lead = append(KEYS.leads, {
      id: id(),
      name: text(data.name, 120),
      phone: text(data.phone, 40),
      source,
      status: text(data.status || 'new', 40),
      budget: Number(data.budget || 0),
      district: text(data.district, 120),
      propertyId: data.propertyId || null,
      score: Math.max(0, Math.min(100, Number(data.score || 0))),
      notes: text(data.notes, 1000),
      createdAt: now(),
      updatedAt: now()
    });
    notify('lead', 'لید جدید', `لید از ${source} ثبت شد.`, { leadId: lead.id });
    return lead;
  }

  function updateLead(leadId, patch = {}) {
    return update(KEYS.leads, leadId, lead => {
      Object.assign(lead, {
        ...(patch.name !== undefined ? { name: text(patch.name, 120) } : {}),
        ...(patch.status !== undefined ? { status: text(patch.status, 40) } : {}),
        ...(patch.score !== undefined ? { score: Math.max(0, Math.min(100, Number(patch.score) || 0)) } : {}),
        ...(patch.notes !== undefined ? { notes: text(patch.notes, 1000) } : {}),
        updatedAt: now()
      });
    });
  }

  // -------------------------------------------------------------------------
  // Omnichannel inbox
  // -------------------------------------------------------------------------
  function openConversation(data = {}) {
    const channel = text(data.channel || 'internal', 40).toLowerCase();
    if (channel !== 'internal' && !CHANNELS.has(channel)) return { ok: false, error: 'invalid_channel' };
    return append(KEYS.conversations, {
      id: id(),
      leadId: data.leadId || null,
      customerId: data.customerId || null,
      channel,
      subject: text(data.subject, 160),
      status: 'open',
      unread: 0,
      createdAt: now(),
      updatedAt: now()
    });
  }

  function sendMessage(data = {}) {
    const body = text(data.body);
    if (!body) return { ok: false, error: 'message_required' };
    const message = append(KEYS.messages, {
      id: id(),
      conversationId: data.conversationId || null,
      direction: data.direction === 'inbound' ? 'inbound' : 'outbound',
      channel: text(data.channel || 'internal', 40),
      body,
      status: 'queued',
      createdAt: now()
    });
    if (data.conversationId) update(KEYS.conversations, data.conversationId, conversation => {
      conversation.unread = message.direction === 'inbound' ? Number(conversation.unread || 0) + 1 : 0;
      conversation.updatedAt = now();
    });
    return message;
  }

  async function deliverMessage(messageId) {
    const message = list(KEYS.messages).find(item => item.id === messageId);
    if (!message) return { ok: false, error: 'message_not_found' };
    if (!CHANNELS.has(message.channel)) return update(KEYS.messages, messageId, item => { item.status = 'sent_local'; });
    if (!cloudReady()) return update(KEYS.messages, messageId, item => { item.status = 'provider_pending'; });
    const result = await cloud('/api/v1/messaging/send', message);
    return update(KEYS.messages, messageId, item => {
      item.status = result.ok ? 'sent' : 'provider_pending';
      item.provider = result;
      item.sentAt = result.ok ? now() : null;
    });
  }

  // -------------------------------------------------------------------------
  // Network / co-broker collaboration
  // -------------------------------------------------------------------------
  function createNetworkListing(data = {}) {
    if (!data.propertyId) return { ok: false, error: 'property_required' };
    return append(KEYS.network, {
      id: id(),
      propertyId: data.propertyId,
      ownerAgentId: data.ownerAgentId || null,
      visibility: text(data.visibility || 'network', 30),
      commissionShare: Number(data.commissionShare || 0),
      status: 'available',
      createdAt: now()
    });
  }

  function requestCollaboration(data = {}) {
    if (!data.listingId) return { ok: false, error: 'listing_required' };
    return append(KEYS.network, {
      id: id(),
      type: 'collaboration_request',
      listingId: data.listingId,
      requesterId: data.requesterId || null,
      targetAgentId: data.targetAgentId || null,
      commissionShare: Number(data.commissionShare || 0),
      status: 'pending',
      note: text(data.note, 1000),
      createdAt: now()
    });
  }

  function updateCollaboration(requestId, status) {
    const allowed = new Set(['accepted', 'rejected', 'cancelled']);
    if (!allowed.has(status)) return { ok: false, error: 'invalid_collaboration_status' };
    return update(KEYS.network, requestId, item => { item.status = status; item.updatedAt = now(); });
  }

  // -------------------------------------------------------------------------
  // Marketing / publishing / notifications
  // -------------------------------------------------------------------------
  function queuePublish(propertyId, channels = []) {
    const property = properties().find(item => String(item.id) === String(propertyId));
    if (!property) return { ok: false, error: 'property_not_found' };
    const safeChannels = [...new Set(channels.map(String).map(channel => channel.toLowerCase()).filter(channel => CHANNELS.has(channel)))];
    if (!safeChannels.length) return { ok: false, error: 'valid_channel_required' };
    return append(KEYS.publishing, { id: id(), propertyId: property.id, channels: safeChannels, status: 'queued', attempts: 0, createdAt: now() });
  }

  async function publish(jobId) {
    const item = list(KEYS.publishing).find(job => job.id === jobId);
    if (!item) return { ok: false, error: 'publish_job_not_found' };
    update(KEYS.publishing, jobId, job => { job.attempts = Number(job.attempts || 0) + 1; });
    if (!cloudReady()) return update(KEYS.publishing, jobId, job => { job.status = 'local_queue'; });
    const result = await cloud('/api/v1/publishing/publish', item);
    return update(KEYS.publishing, jobId, job => {
      job.status = result.ok ? 'published' : 'provider_pending';
      job.provider = result;
    });
  }

  function createCampaign(data = {}) {
    const campaign = append(KEYS.campaigns, {
      id: id(),
      name: text(data.name || 'کمپین جدید', 160),
      channel: text(data.channel || 'website', 40),
      propertyIds: Array.isArray(data.propertyIds) ? data.propertyIds.slice(0, 200) : [],
      budget: Math.max(0, Number(data.budget || 0)),
      status: 'draft',
      createdAt: now()
    });
    return campaign;
  }

  function notify(type, title, body, meta = {}) {
    return append(KEYS.notifications, { id: id(), type: text(type, 40), title: text(title, 160), body: text(body, 1000), meta, read: false, createdAt: now() });
  }

  function runNotificationScan() {
    nextActions().slice(0, 8).forEach(action => notify('next_action', action.title, action.reason, action));
    return true;
  }

  // -------------------------------------------------------------------------
  // Viewings / owner CRM / contracts / deal room
  // -------------------------------------------------------------------------
  function createViewing(data = {}) {
    return append(KEYS.viewings, {
      id: id(), propertyId: data.propertyId || null, customerId: data.customerId || null,
      agentId: data.agentId || null, scheduledAt: Number(data.scheduledAt || now()),
      status: 'scheduled', notes: text(data.notes, 1000), createdAt: now()
    });
  }

  function updateViewing(viewingId, patch = {}) {
    return update(KEYS.viewings, viewingId, viewing => {
      if (patch.status) viewing.status = text(patch.status, 40);
      if (patch.notes !== undefined) viewing.notes = text(patch.notes, 1000);
      if (patch.scheduledAt !== undefined) viewing.scheduledAt = Number(patch.scheduledAt) || viewing.scheduledAt;
      viewing.updatedAt = now();
    });
  }

  function createOwner(data = {}) {
    return append(KEYS.owners, {
      id: id(), name: text(data.name, 120), phone: text(data.phone, 40), propertyIds: data.propertyIds || [],
      timeline: [{ id: id(), type: 'created', text: 'مالک ثبت شد', createdAt: now() }], createdAt: now()
    });
  }

  function addOwnerEvent(ownerId, type, value) {
    return update(KEYS.owners, ownerId, owner => {
      owner.timeline ||= [];
      owner.timeline.unshift({ id: id(), type: text(type, 60), text: text(value, 1000), createdAt: now() });
      owner.timeline = owner.timeline.slice(0, LIMIT);
    })?.timeline?.[0] || null;
  }

  const templates = Object.freeze({
    sale: 'قرارداد فروش\nمالک: {{owner}}\nخریدار: {{buyer}}\nملک: {{property}}\nمبلغ: {{amount}}',
    rent: 'قرارداد اجاره\nموجر: {{owner}}\nمستأجر: {{tenant}}\nملک: {{property}}\nمبلغ: {{amount}}'
  });

  function renderTemplate(template, data = {}) {
    return text(template, 50000).replace(/\{\{(\w+)\}\}/g, (_, key) => text(data[key], 2000));
  }

  async function digest(value) {
    if (!global.crypto?.subtle) return 'sha256-unavailable';
    const buffer = await global.crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value)));
    return Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async function createContract(data = {}) {
    const template = templates[data.template] || data.templateText || '';
    const contractText = renderTemplate(template, data.fields || {});
    if (!contractText) return { ok: false, error: 'contract_text_required' };
    const contract = { id: id(), template: data.template || 'custom', text: contractText, status: 'draft', hash: await digest(contractText), signers: (data.signers || []).map(signer => ({ name: text(signer.name, 120), phone: text(signer.phone, 40), status: 'pending' })), createdAt: now() };
    return append(KEYS.contracts, contract);
  }

  async function requestSignature(contractId) {
    const contract = list(KEYS.contracts).find(item => item.id === contractId);
    if (!contract) return { ok: false, error: 'contract_not_found' };
    if (!cloudReady()) return update(KEYS.contracts, contractId, item => { item.status = 'signature_pending_provider'; });
    const result = await cloud('/api/v1/contracts/sign-request', { contractId: contract.id, hash: contract.hash, signers: contract.signers });
    return update(KEYS.contracts, contractId, item => { item.status = result.ok ? 'sent' : 'provider_pending'; item.provider = result; });
  }

  function createDealRoom(data = {}) {
    return append(KEYS.deals, {
      id: id(), propertyId: data.propertyId || null, buyerId: data.buyerId || null, sellerId: data.sellerId || null,
      participants: Array.isArray(data.participants) ? data.participants : [], commission: Number(data.commission || 0),
      stage: text(data.stage || 'lead', 40), events: [{ id: id(), type: 'created', text: 'اتاق معامله ایجاد شد', createdAt: now() }], createdAt: now()
    });
  }

  function addDealEvent(dealId, type, value) {
    const deal = update(KEYS.deals, dealId, item => {
      item.events ||= [];
      item.events.unshift({ id: id(), type: text(type, 60), text: text(value, 1000), createdAt: now() });
      item.events = item.events.slice(0, LIMIT);
    });
    return deal || { ok: false, error: 'deal_not_found' };
  }

  // -------------------------------------------------------------------------
  // Dashboard / public surface
  // -------------------------------------------------------------------------
  function metrics() {
    return {
      version: VERSION,
      leads: list(KEYS.leads).length,
      openConversations: list(KEYS.conversations).filter(item => item.status === 'open').length,
      unreadMessages: list(KEYS.conversations).reduce((sum, item) => sum + Number(item.unread || 0), 0),
      networkListings: list(KEYS.network).filter(item => item.type !== 'collaboration_request').length,
      collaborationRequests: list(KEYS.network).filter(item => item.type === 'collaboration_request' && item.status === 'pending').length,
      campaigns: list(KEYS.campaigns).length,
      scheduledViewings: list(KEYS.viewings).filter(item => item.status === 'scheduled').length,
      pendingPublishing: list(KEYS.publishing).filter(item => item.status !== 'published').length,
      unreadNotifications: list(KEYS.notifications).filter(item => !item.read).length
    };
  }

  function renderNotifications() {
    const root = global.document?.getElementById('competitive-notifications');
    if (!root) return;
    const escape = value => text(value, 1000).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
    root.innerHTML = list(KEYS.notifications).slice(0, 20).map(item => `<div class="p-3 rounded-xl border border-slate-700 bg-slate-900"><div class="flex justify-between gap-2"><b>${escape(item.title)}</b><span class="text-xs text-slate-500">${new Date(item.createdAt).toLocaleString('fa-IR')}</span></div><div class="text-xs text-slate-400 mt-1">${escape(item.body)}</div></div>`).join('') || '<p class="text-slate-500">اعلانی ندارید.</p>';
  }

  function renderPublishing() {
    const root = global.document?.getElementById('competitive-publishing');
    if (!root) return;
    const escape = value => text(value, 1000).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
    root.innerHTML = list(KEYS.publishing).slice(0, 20).map(item => `<div class="p-3 rounded-xl bg-slate-900 border border-slate-700 flex justify-between gap-2"><div><b>ملک ${escape(item.propertyId)}</b><div class="text-xs text-slate-400">${escape((item.channels || []).join(' · '))}</div></div><span class="text-xs text-amber-300">${escape(item.status)}</span></div>`).join('') || '<p class="text-slate-500">صف انتشار خالی است.</p>';
  }

  function renderDashboard() {
    const root = global.document?.getElementById('competitive-suite-dashboard');
    if (!root) return;
    const m = metrics();
    const actions = nextActions();
    root.innerHTML = `<div class="grid md:grid-cols-4 gap-3">
      ${metricCard('لیدها', m.leads)}
      ${metricCard('مکالمات باز', m.openConversations)}
      ${metricCard('همکاری‌های در انتظار', m.collaborationRequests)}
      ${metricCard('بازدیدها', m.scheduledViewings)}
    </div>
    <div class="grid md:grid-cols-3 gap-3 mt-3">
      ${metricCard('صف انتشار', m.pendingPublishing)}
      ${metricCard('کمپین‌ها', m.campaigns)}
      ${metricCard('پیام‌های خوانده‌نشده', m.unreadMessages)}
    </div>
    <div class="mt-4 space-y-2">${actions.slice(0, 8).map(action => `<div class="p-3 rounded-xl bg-slate-900 border border-slate-700"><b>${escapeHtml(action.title)}</b><div class="text-xs text-slate-400 mt-1">${escapeHtml(action.reason)} · اولویت ${action.priority}</div></div>`).join('') || '<p class="text-slate-500">اقدام فوری ندارید.</p>'}</div>`;
  }

  function escapeHtml(value) {
    return text(value, 2000).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function metricCard(label, value) {
    return `<div class="p-4 rounded-xl bg-slate-800 border border-slate-700"><div class="text-xs text-slate-400">${escapeHtml(label)}</div><b class="text-2xl">${Number(value) || 0}</b></div>`;
  }

  global.ShirangiCompetitive = Object.freeze({
    VERSION,
    valuation,
    saveMarketSnapshot,
    parsePropertyText,
    extractAndFillProperty,
    matchCustomer,
    nextActions,
    aiCopilot,
    createLead,
    updateLead,
    openConversation,
    sendMessage,
    deliverMessage,
    createNetworkListing,
    requestCollaboration,
    updateCollaboration,
    queuePublish,
    publish,
    createCampaign,
    notify,
    runNotificationScan,
    createViewing,
    updateViewing,
    createOwner,
    addOwnerEvent,
    renderTemplate,
    createContract,
    requestSignature,
    createDealRoom,
    addDealEvent,
    metrics,
    renderNotifications,
    renderPublishing,
    renderDashboard,
    templates
  });

  global.document?.addEventListener('DOMContentLoaded', () => {
    renderNotifications();
    renderPublishing();
    renderDashboard();
    const extractButton = global.document.getElementById('cs-ai-extract');
    if (extractButton && !extractButton.__shirangiBound) {
      extractButton.__shirangiBound = true;
      extractButton.addEventListener('click', extractAndFillProperty);
    }
  });
  if (global.document?.readyState !== 'loading') {
    const extractButton = global.document.getElementById('cs-ai-extract');
    if (extractButton && !extractButton.__shirangiBound) {
      extractButton.__shirangiBound = true;
      extractButton.addEventListener('click', extractAndFillProperty);
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);

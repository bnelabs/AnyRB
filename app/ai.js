/**
 * AnyRB v0.2 — browser AI client.
 *
 * Talks ONLY to same-origin `/api/*` endpoints provided by the FastAPI backend
 * (server/). The API key lives on the server; the browser never sees it.
 *
 * Modes:
 *   live    — GET /api/health succeeded; Meta models are in the live path.
 *   offline — file://, no backend, or a failed health check → deterministic
 *             offline assistant with identical schemas (clearly badged).
 *   mock    — `?mock=1` demo switch: simulated Meta responses with network-free
 *             latency, for UI verification when the backend is not running.
 *
 * Every call records a provenance entry (model, latency, cached, fallback,
 * schemaOk, grounding) which the UI exposes in the AI activity drawer.
 */

import {
  OFFLINE_MODEL, OFFLINE_NOTE,
  fallbackBrief, fallbackLot, fallbackPlan, fallbackDesignReview, fallbackProofMemo,
  fallbackVoice, fallbackRenderSvg, parseLotTextHeuristics,
  normalizeBriefResponse, normalizeLotResponse, normalizePlan,
  normalizeReviewResponse, normalizeProofResponse, normalizeVoiceResponse, normalizeRenderResponse,
  sanitizeMemo, makeProvenance, validateResponse,
} from './aicore.js';
import { apiUrl, API } from './config.js';

const HEALTH_TIMEOUT_MS = 2600;
const CALL_TIMEOUT_MS = 90000;
const RETRIES = 2;

const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createAIClient(options = {}) {
  const fetchImpl = options.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  const isFile = typeof location !== 'undefined' && location.protocol === 'file:';
  const demo = options.demo || {};
  const listeners = new Set();
  const calls = [];
  let mode = 'offline';
  let health = null;
  let pending = 0;

  function snapshot() {
    return {
      mode,
      health,
      calls: calls.slice(),
      pending,
      note: mode === 'offline' ? OFFLINE_NOTE : mode === 'mock' ? 'Simulated Meta models (?mock=1)' : 'Meta models live',
    };
  }
  function emit() {
    for (const fn of listeners) {
      try { fn(snapshot()); } catch (err) { /* listener isolation */ }
    }
  }
  function onChange(fn) {
    listeners.add(fn);
    try { fn(snapshot()); } catch (err) { /* ignore */ }
    return () => listeners.delete(fn);
  }
  const endpointLabel = (u) => String(u).replace(/^https?:\/\/127\.0\.0\.1:8787/, '');

  function record(entry) {
    if (entry && entry.endpoint) entry = { ...entry, endpoint: endpointLabel(entry.endpoint) };
    const prov = makeProvenance(entry);
    calls.push(prov);
    emit();
    return prov;
  }

  async function fetchWithTimeout(url, opts, timeoutMs) {
    if (!fetchImpl) throw new Error('fetch unavailable in this environment');
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => { if (controller) controller.abort(); }, timeoutMs);
    try {
      return await fetchImpl(url, { ...opts, signal: controller ? controller.signal : undefined });
    } finally {
      clearTimeout(timer);
    }
  }

  async function detect() {
    if (demo.forceOffline) {
      mode = 'offline'; health = null; emit(); return snapshot();
    }
    if (demo.mock) {
      mode = 'mock';
      health = {
        status: 'mock',
        version: 'v0.2-mock',
        models: { brief: 'mock-muse-spark', review: 'mock-muse-spark', proof: 'mock-muse-spark', voice: 'mock-muse-voice', image: 'mock-muse-image' },
        note: '?mock=1 — simulated Meta models (no network calls)',
      };
      emit();
      return snapshot();
    }
    if (!fetchImpl) {
      mode = 'offline'; health = null; emit(); return snapshot();
    }
    // Try the configured/relative base first; if this page is served by a
    // static host (file://, IDE preview, harness UI), fall back to the local
    // backend at 127.0.0.1:8787 and remember the working base.
    const candidates = [];
    if (API.base) candidates.push(API.base);
    if (API.base !== '') candidates.push('');
    if (!candidates.includes('http://127.0.0.1:8787')) candidates.push('http://127.0.0.1:8787');
    let lastErr = null;
    for (const base of candidates) {
      try {
        const res = await fetchWithTimeout(`${base}/api/health`, { headers: { accept: 'application/json' } }, HEALTH_TIMEOUT_MS);
        if (!res.ok) throw new Error('health HTTP ' + res.status);
        const h = await res.json();
        const aiLive = h && h.ai ? (h.ai.live === true && h.ai.mock !== true) : h.ok === true;
        if (!h || (!h.ok && !h.ai)) throw new Error('health payload invalid');
        health = h;
        mode = aiLive ? 'live' : 'offline';
        API.base = base;
        emit();
        return snapshot();
      } catch (err) { lastErr = err; }
    }
    health = null;
    mode = 'offline';
    emit();
    return snapshot();
  }

  async function call(kind, endpoint, payload, { offline, timeoutMs = CALL_TIMEOUT_MS, mockModel = 'muse-spark' } = {}) {
    const t0 = now();
    pending += 1;
    emit();
    try {
      if (mode === 'live') {
        try {
          const { data, cached } = await postJson(endpoint, payload, timeoutMs);
          const meta = data._meta || {};
          const schema = validateResponse(kind, data);
          const prov = record({
            endpoint,
            model: meta.model || data.model || (health && health.ai && health.ai.models && health.ai.models.spark) || 'meta-backend',
            latencyMs: (Number(meta.latency_s) > 0 ? Number(meta.latency_s) * 1000 : now() - t0),
            cached: !!(cached || meta.cached),
            fallback: !!meta.fallback,
            schemaOk: schema.ok,
            error: schema.ok ? null : 'schema: ' + schema.errors.join('; '),
          });
          if (schema.ok) return { data, provenance: prov, live: true };
          throw new Error('schema validation failed: ' + schema.errors.join('; '));
        } catch (err) {
          const fb = offline();
          const prov = record({
            endpoint, model: OFFLINE_MODEL, latencyMs: now() - t0, cached: false,
            fallback: true, schemaOk: true, error: String((err && err.message) || err),
          });
          return { data: fb, provenance: prov, live: false, error: String((err && err.message) || err) };
        }
      }
      if (mode === 'offline') {
        // Deterministic offline assistant: identical schema, honest provenance.
        const fb = offline();
        const prov = record({
          endpoint, model: OFFLINE_MODEL, latencyMs: now() - t0, cached: false,
          fallback: true, schemaOk: true,
        });
        return { data: fb, provenance: prov, live: false, mock: false };
      }
      if (mode === 'mock') await sleep(mockLatency(endpoint, payload));
      const fb = offline();
      const prov = record({
        endpoint, model: 'mock:' + mockModel, latencyMs: now() - t0, cached: false,
        fallback: false, schemaOk: true, demo: true,
      });
      return { data: fb, provenance: prov, live: true, mock: true };
    } finally {
      pending -= 1;
      emit();
    }
  }

  // -------------------------------------------------------------------------
  // Public endpoints
  // -------------------------------------------------------------------------
  async function parseBrief(text, defaults) {
    const r = await call('brief', apiUrl('/api/brief/parse'), { text: String(text || '').slice(0, 4000) }, {
      offline: () => fallbackBrief(text, defaults),
      mockModel: 'muse-spark',
    });
    if (!r.live || r.mock) {
      const fb = r.data;
      return { brief: fb.brief, confidence: fb.confidence, model: fb.model, fallback: fb.fallback, extracted: fb.extracted, provenance: r.provenance, live: r.live && !r.mock, mock: !!r.mock };
    }
    const norm = normalizeBriefResponse(r.data, defaults);
    return { ...norm, provenance: r.provenance, live: true };
  }

  async function parseLot(text, presetKey) {
    const fallback = () => {
      // reuse the deterministic heuristic parser, shaped like the live response
      const parsed = parseLotTextHeuristics(text, presetKey);
      return { lot: parsed.material, confidence: parsed.confidence, model: parsed.model, fallback: true, extracted: parsed.extracted, note: parsed.note, source: parsed.source };
    };
    const r = await call('lot', apiUrl('/api/lot/parse'), { text: String(text || '').slice(0, 8000), preset: presetKey }, {
      offline: fallback, mockModel: 'muse-spark',
    });
    if (!r.live || r.mock) {
      const fb = r.data;
      return { lot: fb.lot || fb.material, confidence: fb.confidence, model: fb.model, fallback: true, extracted: fb.extracted, note: fb.note, source: fb.source || 'Offline heuristic', provenance: r.provenance, live: r.live && !r.mock, mock: !!r.mock };
    }
    const norm = normalizeLotResponse(r.data, { preset: presetKey });
    return { ...norm, provenance: r.provenance, live: true };
  }

  async function planDesign(brief, material, ctx) {
    const r = await call('plan', apiUrl('/api/design/plan'), {
      brief, first_pass: { feasible_uniform_width_mm: null, material: { E_mean: material.E_mean, E_cv: material.E_cv, sy_mean: material.sy_mean, sy_cv: material.sy_cv, rho: material.rho, corr: material.corr } },
    }, { offline: () => fallbackPlan(brief, material, ctx), mockModel: 'muse-spark' });
    if (!r.live || r.mock) {
      const fb = r.data;
      return { ...fb, provenance: r.provenance, live: r.live && !r.mock, mock: !!r.mock };
    }
    const norm = normalizePlan(r.data);
    if (norm.candidates.length < 3) {
      // schema-normalisation issue → deterministic fallback, honest provenance update
      r.provenance.fallback = true;
      r.provenance.schemaOk = false;
      r.provenance.model = OFFLINE_MODEL;
      const fb = fallbackPlan(brief, material, ctx);
      return { ...fb, provenance: r.provenance, live: false };
    }
    return { ...norm, provenance: r.provenance, live: true };
  }

  async function reviewDesign(payload) {
    const fallback = fallbackDesignReview(payload);
    const r = await call('review', apiUrl('/api/design/review'), payload, { offline: () => fallback, mockModel: 'muse-spark' });
    if (!r.live || r.mock) {
      return { memo: r.data.memo, nextActions: r.data.nextActions || [], grounded: true, fallback: r.mock ? false : true, provenance: r.provenance, live: r.live && !r.mock, mock: !!r.mock };
    }
    const norm = normalizeReviewResponse(r.data);
    const sanitized = sanitizeMemo(norm.memo, payload, fallback.memo);
    r.provenance.grounding = sanitized.grounded ? 'grounded' : 'fallback';
    if (!sanitized.grounded) { r.provenance.fallback = true; r.provenance.model = OFFLINE_MODEL + ' (ungrounded AI text)'; }
    return { memo: sanitized.text, nextActions: norm.nextActions.length ? norm.nextActions : fallback.nextActions, grounded: sanitized.grounded, fallback: !sanitized.grounded, ungrounded: sanitized.ungrounded, provenance: r.provenance, live: true };
  }

  async function proofMemo(payload) {
    const fallback = fallbackProofMemo(payload);
    const r = await call('proof', apiUrl('/api/proof/memo'), payload, { offline: () => fallback, mockModel: 'muse-spark' });
    if (!r.live || r.mock) {
      return { memo: r.data.memo, nextTest: r.data.nextTest || '', grounded: true, fallback: r.mock ? false : true, provenance: r.provenance, live: r.live && !r.mock, mock: !!r.mock };
    }
    const norm = normalizeProofResponse(r.data);
    const sanitized = sanitizeMemo(norm.memo, payload, fallback.memo);
    r.provenance.grounding = sanitized.grounded ? 'grounded' : 'fallback';
    if (!sanitized.grounded) { r.provenance.fallback = true; r.provenance.model = OFFLINE_MODEL + ' (ungrounded AI text)'; }
    return { memo: sanitized.text, nextTest: norm.nextTest || fallback.nextTest, grounded: sanitized.grounded, fallback: !sanitized.grounded, ungrounded: sanitized.ungrounded, provenance: r.provenance, live: true };
  }

  async function transcribe(blob) {
    const fallback = fallbackVoice();
    if (mode === 'live') {
      const t0 = now();
      try {
        const form = new FormData();
        form.append('audio', blob, 'brief.webm');
        const res = await fetchWithTimeout(apiUrl('/api/voice/transcribe'), { method: 'POST', body: form, headers: { accept: 'application/json' } }, CALL_TIMEOUT_MS);
        if (!res.ok) throw new Error('voice HTTP ' + res.status);
        const data = await res.json();
        const schema = validateResponse('voice', data);
        const prov = record({ endpoint: endpointLabel(apiUrl('/api/voice/transcribe')), model: data.model || 'muse-voice', latencyMs: now() - t0, cached: false, fallback: false, schemaOk: schema.ok });
        if (!schema.ok) throw new Error('voice schema');
        return { ...normalizeVoiceResponse(data), provenance: prov, live: true };
      } catch (err) {
        const prov = record({ endpoint: endpointLabel(apiUrl('/api/voice/transcribe')), model: OFFLINE_MODEL, latencyMs: now() - t0, cached: false, fallback: true, schemaOk: true, error: String(err.message || err) });
        return { ...fallback, provenance: prov, live: false, error: String(err.message || err) };
      }
    }
    const t0 = now();
    if (mode === 'mock') await sleep(260);
    const prov = record({ endpoint: endpointLabel(apiUrl('/api/voice/transcribe')), model: mode === 'mock' ? 'mock:muse-voice' : OFFLINE_MODEL, latencyMs: now() - t0, cached: false, fallback: mode !== 'mock', schemaOk: true, demo: mode === 'mock' });
    return { ...fallback, provenance: prov, live: mode === 'mock', mock: mode === 'mock' };
  }

  async function renderIllustration(payload) {
    const fallback = fallbackRenderSvg(payload);
    const r = await call('render', apiUrl('/api/image/render'), payload, { offline: () => fallback, mockModel: 'muse-image', timeoutMs: CALL_TIMEOUT_MS });
    if (!r.live || r.mock) {
      return { ...r.data, provenance: r.provenance, live: r.live && !r.mock, mock: !!r.mock };
    }
    return { ...normalizeRenderResponse(r.data), provenance: r.provenance, live: true };
  }

  async function refreshHealth() { return detect(); }

  return {
    detect,
    onChange,
    parseBrief,
    parseLot,
    planDesign,
    reviewDesign,
    proofMemo,
    transcribe,
    renderIllustration,
    refreshHealth,
    getProvenance: () => calls.slice(),
    getSnapshot: snapshot,
    getMode: () => mode,
  };
}

export { OFFLINE_MODEL, OFFLINE_NOTE };

/* Copyright (c) 2026 Shirangi. All rights reserved. */
/*
 * Shirangi Cloud Runtime Config
 * Public Supabase credentials only.
 * NEVER put service_role, database password, or payment secrets here.
 */
window.__SHIRANGI_SUPABASE__ = Object.freeze({
  url: 'https://ytmypiorebiudscmjpsx.supabase.co',
  anonKey: 'sb_publishable_eSZG1Dy2b_yjTZG90Pa0Eg_nr4geW2S',
  functionsBase: 'https://ytmypiorebiudscmjpsx.supabase.co/functions/v1',
  useSupabase: true,
  // Release gate: flip to true only after deployed Edge Functions + authenticated E2E smoke pass.
  productionMode: false,
  productionE2ERequired: true
});

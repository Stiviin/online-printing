#!/usr/bin/env node
/*
  Local Supabase validation script.
  - Loads environment variables (from process.env / .env if you use a loader)
  - Masks and prints presence of SUPABASE URL and anon key
  - Does a DNS lookup of the host
  - Performs a simple REST fetch to /rest/v1/ using the anon key header to detect "Invalid API key"

  Usage:
    node scripts/test-supabase.js

  Notes:
    - This script does not send secrets anywhere; it prints masked key fragments only.
    - Run from the `frankstat_site` folder so local `.env` is loaded by your shell.
*/

import { lookup } from 'dns/promises';
import { URL } from 'url';
import fetch from 'node-fetch';

function mask(s) {
  if (!s) return null;
  if (s.length <= 12) return `${s.slice(0,3)}...${s.slice(-3)}`;
  return `${s.slice(0,6)}...${s.slice(-6)}`;
}

async function main(){
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || null;
  const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || null;

  console.log('SUPABASE_URL present:', !!SUPABASE_URL);
  console.log('SUPABASE_URL:', SUPABASE_URL ? SUPABASE_URL.replace(/\s+/g,'') : null);
  console.log('ANON present:', !!ANON);
  console.log('ANON masked:', mask(ANON));
  console.log('ANON length:', ANON ? ANON.length : 0);

  if (!SUPABASE_URL) {
    console.error('No SUPABASE_URL found in environment. Aborting connectivity checks.');
    process.exit(1);
  }

  try{
    const u = new URL(SUPABASE_URL);
    const port = u.port || (u.protocol === 'https:' ? '443' : '80');
    console.log(`Resolving host ${u.hostname} (port ${port})...`);
    const r = await lookup(u.hostname);
    console.log('DNS lookup result:', r);
  } catch(err){
    console.error('DNS lookup failed:', err.message || err);
  }

  // Test 1: Health endpoint (no auth required — confirms project is up)
  try{
    const healthUrl = `${SUPABASE_URL.replace(/\/$/, '')}/health`;
    console.log('Testing health endpoint:', healthUrl);
    const res = await fetch(healthUrl, {
      headers: { apikey: ANON || '', Authorization: ANON ? `Bearer ${ANON}` : '' },
    });
    console.log('Health status:', res.status);
    const text = await res.text().catch(() => null);
    console.log('Health body:', text);
    if (res.status === 200) {
      console.log('✓ Supabase project is online.');
    } else {
      console.warn('⚠ Unexpected health response. Check project status.');
    }
  } catch(err){
    console.error('Health check failed:', err.message || err);
  }

  // Test 2: Anon key — query a known public table (or get expected 404/400)
  // The /rest/v1/ root requires service_role. Use a table path instead.
  try{
    const tableUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/User?limit=1`;
    console.log('\nTesting anon key against /rest/v1/User?limit=1 ...');
    const res = await fetch(tableUrl, {
      method: 'GET',
      headers: {
        apikey: ANON || '',
        Authorization: ANON ? `Bearer ${ANON}` : '',
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
    console.log('Response status:', res.status);
    const text = await res.text().catch(() => null);
    const snippet = text ? (text.length > 300 ? text.slice(0,300) + '...' : text) : null;
    console.log('Response body:', snippet);

    if (res.status === 200) {
      console.log('✓ Anon key is valid and table is accessible.');
    } else if (res.status === 401 && text && /invalid api key/i.test(text)) {
      console.error('✗ Anon key is invalid for this project URL. Regenerate it from the Supabase dashboard.');
      process.exitCode = 2;
    } else if (res.status === 403 || res.status === 401) {
      console.log('✓ Anon key is recognised (RLS is blocking access, which is correct behaviour).');
    } else if (res.status === 404) {
      console.log('✓ Anon key is recognised (table not found, but key was accepted).');
    } else {
      console.log('Response received — check body for details.');
    }
  } catch(err){
    console.error('Table fetch failed:', err.message || err);
  }
}

main().catch((e)=>{ console.error('Fatal error:', e); process.exit(1); });

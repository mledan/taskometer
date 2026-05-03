#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Idempotent Vercel env-var sync via the REST API.
 *
 * Reads a .env-formatted file (KEY=VALUE per line, # comments OK,
 * blank lines ignored), upserts each entry into the Vercel project's
 * environment variable list. Idempotent: existing entries with the
 * same key are updated in place; new ones are created.
 *
 * Why a script: the Vercel UI for env vars is slow and error-prone
 * once you have more than two or three. This is one command.
 *
 * Usage
 * -----
 *   # Required env:
 *   VERCEL_TOKEN          — generate at https://vercel.com/account/tokens
 *   VERCEL_PROJECT_ID     — find at https://vercel.com/<team>/<project>/settings (under General)
 *                           OR omit and pass --project=<slug>
 *
 *   # Optional:
 *   VERCEL_TEAM_ID        — required when the project is in a team scope
 *
 *   # Run:
 *   node scripts/sync-vercel-env.js path/to/file.env --target=production,preview
 *
 * --target defaults to "production,preview". Pass "production" alone
 * for production-only changes (recommended for sensitive keys).
 *
 * Trigger a redeploy after running:
 *   curl -X POST "https://api.vercel.com/v1/integrations/deploy/<hook>"
 * or via the Vercel dashboard.
 */

import fs from 'node:fs';
import path from 'node:path';

const TOKEN = process.env.VERCEL_TOKEN;
const PROJECT_ID_OR_SLUG = process.env.VERCEL_PROJECT_ID;
const TEAM_ID = process.env.VERCEL_TEAM_ID;

if (!TOKEN) {
  console.error('VERCEL_TOKEN is required. Generate one at https://vercel.com/account/tokens');
  process.exit(1);
}
if (!PROJECT_ID_OR_SLUG) {
  console.error('VERCEL_PROJECT_ID is required. Find it at Vercel project → Settings → General → Project ID.');
  process.exit(1);
}

const args = process.argv.slice(2);
const envPath = args.find(a => !a.startsWith('--'));
if (!envPath) {
  console.error('Usage: node scripts/sync-vercel-env.js path/to/file.env [--target=production,preview]');
  process.exit(1);
}

const targetArg = (args.find(a => a.startsWith('--target=')) || '--target=production,preview').slice('--target='.length);
const targets = targetArg.split(',').map(s => s.trim()).filter(Boolean);
const validTargets = ['production', 'preview', 'development'];
for (const t of targets) {
  if (!validTargets.includes(t)) {
    console.error(`Invalid target "${t}". Must be one of: ${validTargets.join(', ')}`);
    process.exit(1);
  }
}

const teamQuery = TEAM_ID ? `?teamId=${encodeURIComponent(TEAM_ID)}` : '';

function api(method, pathStr, body) {
  const url = `https://api.vercel.com${pathStr}${pathStr.includes('?') ? '&' : '?'}${TEAM_ID ? `teamId=${encodeURIComponent(TEAM_ID)}` : ''}`;
  return fetch(url.replace(/[?&]$/, ''), {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (res) => {
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`${method} ${pathStr} → ${res.status}: ${text.slice(0, 400)}`);
    }
    return text ? JSON.parse(text) : null;
  });
}

function parseEnvFile(file) {
  const out = [];
  const raw = fs.readFileSync(file, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // Strip surrounding quotes if present.
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) out.push({ key, value });
  }
  return out;
}

(async () => {
  console.log(`→ project: ${PROJECT_ID_OR_SLUG}`);
  console.log(`→ targets: ${targets.join(', ')}`);
  console.log(`→ env file: ${path.resolve(envPath)}`);
  console.log('');

  const incoming = parseEnvFile(envPath);
  if (incoming.length === 0) {
    console.error('No KEY=VALUE pairs found in the env file. Aborting.');
    process.exit(1);
  }

  // Fetch existing env entries so we can update vs create.
  const existing = await api('GET', `/v9/projects/${encodeURIComponent(PROJECT_ID_OR_SLUG)}/env`);
  const byKey = new Map();
  for (const e of existing.envs || []) byKey.set(e.key, e);

  let created = 0;
  let updated = 0;
  for (const { key, value } of incoming) {
    const existingEntry = byKey.get(key);
    if (existingEntry) {
      await api('PATCH', `/v9/projects/${encodeURIComponent(PROJECT_ID_OR_SLUG)}/env/${existingEntry.id}`, {
        value,
        target: targets,
        type: 'encrypted',
      });
      console.log(`✓ updated  ${key}  (${targets.join('+')})`);
      updated++;
    } else {
      await api('POST', `/v10/projects/${encodeURIComponent(PROJECT_ID_OR_SLUG)}/env`, {
        key,
        value,
        target: targets,
        type: 'encrypted',
      });
      console.log(`+ created  ${key}  (${targets.join('+')})`);
      created++;
    }
  }

  console.log('');
  console.log(`done — ${created} created, ${updated} updated.`);
  console.log('');
  console.log('Trigger a redeploy: Vercel dashboard → Deployments → ⋯ → Redeploy,');
  console.log('or use a deploy hook if you have one configured.');
})().catch(err => {
  console.error('failed:', err.message);
  process.exit(1);
});

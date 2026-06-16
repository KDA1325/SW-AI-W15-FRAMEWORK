const fs = require('node:fs');
const path = require('node:path');

const DEMO_EMBEDDING_DIMENSIONS = 1536;
const DEMO_EMBEDDING_MODEL = 'demo-hash-embedding-v1';

function buildDemoEmbedding(seedText) {
  let hash = 2166136261;

  for (const char of seedText) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return Array.from({ length: DEMO_EMBEDDING_DIMENSIONS }, (_, index) => {
    hash ^= index + 1;
    hash = Math.imul(hash, 16777619);

    const normalized = (hash >>> 0) / 4294967295;
    return Number((normalized * 2 - 1).toFixed(6));
  });
}

async function main() {
  const baseUrl = (
    process.env.FASTAPI_AI_COMPUTE_URL ??
    process.env.FASTAPI_AGENT_URL ??
    'http://localhost:8000'
  ).replace(/\/+$/, '');
  const samplePath = path.join(
    __dirname,
    '..',
    '..',
    'docs',
    'datasets',
    'player-preference-igdb',
    'by-persona',
    '01_rpg_sim_solo.json',
  );
  const [sample] = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
  const input = [
    `Game: ${sample.game_title}`,
    `Title: ${sample.title}`,
    `Content: ${sample.content}`,
    `Keywords: ${sample.preference_keywords.join(', ')}`,
  ].join('\n');

  const health = await fetch(`${baseUrl}/health`);
  if (!health.ok) {
    throw new Error(`FastAPI health check failed: HTTP ${health.status}`);
  }

  const response = await fetch(`${baseUrl}/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dimensions: DEMO_EMBEDDING_DIMENSIONS,
      input,
      model: DEMO_EMBEDDING_MODEL,
    }),
  });

  if (!response.ok) {
    throw new Error(`FastAPI embed failed: HTTP ${response.status}`);
  }

  const body = await response.json();
  const expected = buildDemoEmbedding(input);
  const firstMatches = expected
    .slice(0, 8)
    .every((value, index) => value === body.embedding[index]);

  if (
    body.provider !== 'demo' ||
    body.model !== DEMO_EMBEDDING_MODEL ||
    body.dimensions !== DEMO_EMBEDDING_DIMENSIONS ||
    body.embedding.length !== DEMO_EMBEDDING_DIMENSIONS ||
    !firstMatches
  ) {
    throw new Error('FastAPI embedding response did not match the demo baseline.');
  }

  console.log(
    JSON.stringify({
      ok: true,
      sampleId: sample.id,
      provider: body.provider,
      model: body.model,
      dimensions: body.dimensions,
      first3: body.embedding.slice(0, 3),
    }),
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

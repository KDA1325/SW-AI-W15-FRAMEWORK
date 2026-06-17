const path = require('node:path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const PERSONA_EMAILS = [
  'test1@test.com',
  'test2@test.com',
  'test3@test.com',
  'test4@test.com',
];

function requiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required in server/.env`);
  }

  return value;
}

function databaseConfigFromEnv() {
  const host = requiredEnv('DATABASE_HOST');

  if (host.startsWith('postgres://') || host.startsWith('postgresql://')) {
    return {
      connectionString: host,
      ssl: host.includes('sslmode=require')
        ? { rejectUnauthorized: false }
        : undefined,
    };
  }

  return {
    database: requiredEnv('DATABASE_NAME'),
    host,
    password: requiredEnv('DATABASE_PASSWORD'),
    port: Number(process.env.DATABASE_PORT ?? 5432),
    ssl:
      process.env.DATABASE_SSL === 'true'
        ? { rejectUnauthorized: false }
        : undefined,
    user: requiredEnv('DATABASE_USER'),
  };
}

async function main() {
  const client = new Client(databaseConfigFromEnv());
  await client.connect();

  try {
    const summary = await client.query(`
      SELECT
        count(DISTINCT u.id)::int AS users,
        count(p.id)::int AS posts
      FROM "User" u
      LEFT JOIN "ArchivePost" p ON p."userId" = u.id
      WHERE u.email = ANY($1::text[])
    `, [PERSONA_EMAILS]);
    const byUser = await client.query(`
      SELECT
        u.email,
        u.nickname,
        count(DISTINCT p.id)::int AS posts,
        count(DISTINCT p.id) FILTER (WHERE p.type = 'REVIEW')::int AS reviews,
        count(DISTINCT p.id) FILTER (WHERE p.type = 'JOURNAL')::int AS journals,
        count(DISTINCT p."gameId")::int AS games,
        count(apt."tagId")::int AS post_tags
      FROM "User" u
      LEFT JOIN "ArchivePost" p ON p."userId" = u.id
      LEFT JOIN "ArchivePostTag" apt ON apt."postId" = p.id
      WHERE u.email = ANY($1::text[])
      GROUP BY u.id, u.email, u.nickname
      ORDER BY u.email
    `, [PERSONA_EMAILS]);
    const samples = await client.query(`
      SELECT
        u.email,
        p.type,
        p.title,
        g.title AS "gameTitle",
        array_remove(array_agg(t.name ORDER BY t.name), NULL) AS tags
      FROM "ArchivePost" p
      INNER JOIN "User" u ON u.id = p."userId"
      INNER JOIN "Game" g ON g.id = p."gameId"
      LEFT JOIN "ArchivePostTag" apt ON apt."postId" = p.id
      LEFT JOIN "Tag" t ON t.id = apt."tagId"
      WHERE u.email = ANY($1::text[])
      GROUP BY u.email, p.id, p.type, p.title, g.title, p."createdAt"
      ORDER BY u.email, p."createdAt"
      LIMIT 8
    `, [PERSONA_EMAILS]);

    console.log(
      JSON.stringify(
        {
          summary: summary.rows[0],
          byUser: byUser.rows,
          samples: samples.rows,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

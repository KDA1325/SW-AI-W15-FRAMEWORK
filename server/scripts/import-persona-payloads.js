const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const { Client } = require('pg');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const SERVER_ROOT = path.resolve(__dirname, '..');
const DATASET_ROOT = path.join(
  PROJECT_ROOT,
  'docs',
  'datasets',
  'player-preference-igdb',
);
const DEFAULT_PAYLOAD_DIR = path.join(DATASET_ROOT, 'by-persona');

dotenv.config({ path: path.join(SERVER_ROOT, '.env') });

const CANONICAL_ACCOUNTS = {
  horror_atmosphere: {
    email: 'test4@test.com',
    nickname: '심야의손전등',
    password: 'personatest4',
  },
  multiplayer_social: {
    email: 'test3@test.com',
    nickname: '파티의작전가',
    password: 'personatest3',
  },
  puzzle_solo: {
    email: 'test2@test.com',
    nickname: '수수께끼항해자',
    password: 'personatest2',
  },
  rpg_sim_solo: {
    email: 'test1@test.com',
    nickname: '느긋한모험가',
    password: 'personatest1',
  },
};

function parseArgs(argv) {
  const args = {
    dryRun: false,
    payload: null,
    payloadDir: DEFAULT_PAYLOAD_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--payload') {
      args.payload = path.resolve(argv[++index]);
    } else if (arg === '--payload-dir') {
      args.payloadDir = path.resolve(argv[++index]);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
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

function requiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required in server/.env`);
  }

  return value;
}

function payloadPaths(args) {
  if (args.payload) {
    return [args.payload];
  }

  return fs
    .readdirSync(args.payloadDir)
    .filter((fileName) => fileName.endsWith('_import_payload.json'))
    .sort()
    .map((fileName) => path.join(args.payloadDir, fileName));
}

function readPayload(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function importPayload(client, payload) {
  const user = await upsertUser(client, canonicalAccount(payload));
  let postCount = 0;

  for (const post of payload.posts ?? []) {
    const game = await upsertGame(client, post);
    const archivePost = await upsertArchivePost(client, user.id, game.id, post);
    await replacePostTags(client, archivePost.id, post.tags ?? []);
    postCount += 1;
  }

  return {
    email: user.email,
    posts: postCount,
  };
}

function canonicalAccount(payload) {
  const override = CANONICAL_ACCOUNTS[payload.player_type?.id];

  return {
    ...payload.account,
    ...(override ?? {}),
  };
}

async function upsertUser(client, account) {
  const passwordHash = await bcrypt.hash(account.password, 12);
  const result = await client.query(
    `
      INSERT INTO "User" (
        email,
        "passwordHash",
        nickname,
        bio,
        "profileImageUrl",
        "gamerTags",
        "steamId",
        "createdAt",
        "updatedAt"
      )
      VALUES ($1, $2, $3, $4, NULL, $5, NULL, NOW(), NOW())
      ON CONFLICT (email)
      DO UPDATE SET
        "passwordHash" = EXCLUDED."passwordHash",
        nickname = EXCLUDED.nickname,
        bio = EXCLUDED.bio,
        "gamerTags" = EXCLUDED."gamerTags",
        "updatedAt" = NOW()
      RETURNING id, email
    `,
    [
      account.email,
      passwordHash,
      account.nickname,
      account.bio ?? null,
      normalizeTags(account.gamerTags ?? []),
    ],
  );

  return result.rows[0];
}

async function upsertGame(client, post) {
  const platform = normalizePlatform(post.gamePlatform);
  const existing = await client.query(
    `
      SELECT id, title, platforms
      FROM "Game"
      WHERE title = $1
      LIMIT 1
    `,
    [post.gameTitle.trim()],
  );

  if (existing.rows[0]) {
    const result = await client.query(
      `
        UPDATE "Game"
        SET
        platforms = CASE
          WHEN $2::text IS NULL THEN "Game".platforms
          WHEN $2::text = ANY("Game".platforms) THEN "Game".platforms
          ELSE array_append("Game".platforms, $2::text)
        END,
        "updatedAt" = NOW()
        WHERE id = $1
        RETURNING id, title
      `,
      [existing.rows[0].id, platform],
    );

    return result.rows[0];
  }

  const result = await client.query(
    `
      INSERT INTO "Game" (
        title,
        "imageUrl",
        description,
        genres,
        platforms,
        tags,
        "createdAt",
        "updatedAt"
      )
      VALUES ($1, NULL, NULL, ARRAY[]::text[], $2, ARRAY[]::text[], NOW(), NOW())
      RETURNING id, title
    `,
    [post.gameTitle.trim(), platform ? [platform] : []],
  );

  return result.rows[0];
}

async function upsertArchivePost(client, userId, gameId, post) {
  const existing = await findExistingPost(client, userId, gameId, post);

  if (existing) {
    const result = await client.query(
      `
        UPDATE "ArchivePost"
        SET
          title = $2,
          content = $3,
          rating = $4,
          "updatedAt" = NOW()
        WHERE id = $1
        RETURNING id
      `,
      [existing.id, post.title, post.content, ratingForPost(post)],
    );

    return result.rows[0];
  }

  const result = await client.query(
    `
      INSERT INTO "ArchivePost" (
        "userId",
        "gameId",
        type,
        title,
        content,
        rating,
        "createdAt",
        "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id
    `,
    [userId, gameId, post.type, post.title, post.content, ratingForPost(post)],
  );

  return result.rows[0];
}

async function findExistingPost(client, userId, gameId, post) {
  if (post.type === 'REVIEW') {
    const result = await client.query(
      `
        SELECT id
        FROM "ArchivePost"
        WHERE "userId" = $1
          AND "gameId" = $2
          AND type = 'REVIEW'
        LIMIT 1
      `,
      [userId, gameId],
    );

    return result.rows[0] ?? null;
  }

  const result = await client.query(
    `
      SELECT id
      FROM "ArchivePost"
      WHERE "userId" = $1
        AND "gameId" = $2
        AND type = 'JOURNAL'
        AND title = $3
      LIMIT 1
    `,
    [userId, gameId, post.title],
  );

  return result.rows[0] ?? null;
}

async function replacePostTags(client, postId, tags) {
  await client.query('DELETE FROM "ArchivePostTag" WHERE "postId" = $1', [postId]);

  for (const tagName of normalizeTags(tags)) {
    const tag = await upsertTag(client, tagName);

    await client.query(
      `
        INSERT INTO "ArchivePostTag" ("postId", "tagId")
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `,
      [postId, tag.id],
    );
  }
}

async function upsertTag(client, name) {
  const result = await client.query(
    `
      INSERT INTO "Tag" (name, "normalizedName", "createdAt", "updatedAt")
      VALUES ($1, $1, NOW(), NOW())
      ON CONFLICT ("normalizedName")
      DO UPDATE SET
        name = EXCLUDED.name,
        "updatedAt" = NOW()
      RETURNING id
    `,
    [name],
  );

  return result.rows[0];
}

function ratingForPost(post) {
  return post.type === 'REVIEW' ? post.rating ?? null : null;
}

function normalizePlatform(value) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function normalizeTags(tags) {
  return [
    ...new Set(
      tags
        .map((tag) =>
          String(tag)
            .trim()
            .replace(/^#+/, '')
            .replace(/[\s-]+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '')
            .toUpperCase(),
        )
        .filter(Boolean),
    ),
  ].slice(0, 6);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const files = payloadPaths(args);

  if (files.length === 0) {
    throw new Error('No persona import payload files found.');
  }

  console.log(`Found ${files.length} payload file(s).`);
  for (const file of files) {
    const payload = readPayload(file);
    console.log(
      `- ${path.relative(PROJECT_ROOT, file)}: ${payload.account.email}, ${payload.posts?.length ?? 0} posts`,
    );
  }

  if (args.dryRun) {
    console.log('Dry run only. No database writes performed.');
    return;
  }

  const client = new Client(databaseConfigFromEnv());
  await client.connect();

  try {
    await client.query('BEGIN');

    for (const file of files) {
      console.log(`Importing ${path.basename(file)}...`);
      const result = await importPayload(client, readPayload(file));
      console.log(`Imported ${result.email}: ${result.posts} posts`);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

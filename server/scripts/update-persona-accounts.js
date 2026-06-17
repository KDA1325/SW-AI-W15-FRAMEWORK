const path = require('node:path');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const ACCOUNT_UPDATES = [
  {
    newEmail: 'test1@test.com',
    newNickname: '느긋한모험가',
    newPassword: 'personatest1',
    oldEmail: 'persona-rpg-sim-solo@gaming-journal.club',
  },
  {
    newEmail: 'test2@test.com',
    newNickname: '수수께끼항해자',
    newPassword: 'personatest2',
    oldEmail: 'persona-puzzle-solo@gaming-journal.club',
  },
  {
    newEmail: 'test3@test.com',
    newNickname: '파티의작전가',
    newPassword: 'personatest3',
    oldEmail: 'persona-multiplayer@gaming-journal.club',
  },
  {
    newEmail: 'test4@test.com',
    newNickname: '심야의손전등',
    newPassword: 'personatest4',
    oldEmail: 'persona-horror@gaming-journal.club',
  },
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

async function updateAccount(client, account) {
  const oldUser = await findUserByEmail(client, account.oldEmail);
  const newUser = await findUserByEmail(client, account.newEmail);
  const passwordHash = await bcrypt.hash(account.newPassword, 12);

  if (oldUser && newUser && oldUser.id !== newUser.id) {
    await mergeUsers(client, oldUser.id, newUser.id);
    await client.query('DELETE FROM "User" WHERE id = $1', [oldUser.id]);
  }

  const targetUser = newUser ?? oldUser;

  if (!targetUser) {
    throw new Error(`No user found for ${account.oldEmail} or ${account.newEmail}`);
  }

  await client.query(
    `
      UPDATE "User"
      SET
        email = $2,
        "passwordHash" = $3,
        nickname = $4,
        "updatedAt" = NOW()
      WHERE id = $1
    `,
    [targetUser.id, account.newEmail, passwordHash, account.newNickname],
  );

  const countResult = await client.query(
    'SELECT count(*)::int AS posts FROM "ArchivePost" WHERE "userId" = $1',
    [targetUser.id],
  );

  return {
    email: account.newEmail,
    nickname: account.newNickname,
    posts: countResult.rows[0].posts,
  };
}

async function findUserByEmail(client, email) {
  const result = await client.query(
    'SELECT id, email FROM "User" WHERE email = $1 LIMIT 1',
    [email],
  );

  return result.rows[0] ?? null;
}

async function mergeUsers(client, fromUserId, toUserId) {
  await client.query('UPDATE "ArchivePost" SET "userId" = $2 WHERE "userId" = $1', [
    fromUserId,
    toUserId,
  ]);
  await client.query('UPDATE "Comment" SET "userId" = $2 WHERE "userId" = $1', [
    fromUserId,
    toUserId,
  ]);
  await client.query('UPDATE "UserGame" SET "userId" = $2 WHERE "userId" = $1', [
    fromUserId,
    toUserId,
  ]);
}

async function main() {
  const client = new Client(databaseConfigFromEnv());
  await client.connect();

  try {
    await client.query('BEGIN');

    for (const account of ACCOUNT_UPDATES) {
      const result = await updateAccount(client, account);
      console.log(
        `Updated ${account.oldEmail} -> ${result.email} (${result.nickname}), posts=${result.posts}`,
      );
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

# Game Archive Server

NestJS backend server for authentication and API features.

## Requirements

- Node.js
- npm
- Docker Desktop

## Environment Variables

Create `server/.env` from `server/.env.example`.

```bash
cd server
cp .env.example .env
```

Required values:

| Name | Description | Local value |
| --- | --- | --- |
| `DATABASE_HOST` | PostgreSQL host | `localhost` |
| `DATABASE_PORT` | PostgreSQL port | `5432` |
| `DATABASE_USER` | PostgreSQL user | `game_archive_user` |
| `DATABASE_PASSWORD` | PostgreSQL password | `game_archive_password` |
| `DATABASE_NAME` | PostgreSQL database name | `game_archive` |
| `JWT_SECRET` | Secret key used to sign JWT tokens | Use a long random string |
| `JWT_EXPIRES_IN` | JWT expiration time | `1d` |
| `CLIENT_URL` | Frontend origin allowed by CORS | `http://localhost:5173` |

Do not commit `server/.env`. It can contain secrets such as `JWT_SECRET`.

## Start PostgreSQL

Run this command from the repository root:

```bash
docker compose up -d
```

The Docker PostgreSQL settings are defined in `docker-compose.yml`.

| Docker setting | Server env value |
| --- | --- |
| `POSTGRES_DB=game_archive` | `DATABASE_NAME=game_archive` |
| `POSTGRES_USER=game_archive_user` | `DATABASE_USER=game_archive_user` |
| `POSTGRES_PASSWORD=game_archive_password` | `DATABASE_PASSWORD=game_archive_password` |
| `5432:5432` | `DATABASE_HOST=localhost`, `DATABASE_PORT=5432` |

## Install and Run

Run these commands from `server/`:

```bash
npm install
npm run start:dev
```

The server runs at:

```text
http://localhost:3000
```

The frontend development server is expected at:

```text
http://localhost:5173
```

## CORS, Cookies, and JWT

CORS is configured in `src/main.ts`.

- `CLIENT_URL` is the frontend origin allowed to call the API.
- `credentials: true` allows browser requests to include cookies.

Authentication uses an HTTP-only cookie named `access_token`.

- The cookie is created after login/register.
- `httpOnly: true` prevents browser JavaScript from reading the token directly.
- `sameSite: 'lax'` supports normal local development navigation.
- `secure: false` is for local HTTP development. Use HTTPS and `secure: true` in production.

JWT settings are configured in `src/auth/auth.module.ts`.

- `JWT_SECRET` is required. The server should not start without it.
- `JWT_EXPIRES_IN` controls token expiration, for example `1d`.

## TypeORM Synchronize

The current local development setting uses:

```ts
synchronize: true
```

This lets TypeORM update the local database schema from entity classes during development.
It is convenient for local work, but it should not be used in production because schema changes can cause data loss.

Before production deployment, replace this with TypeORM migrations.

## Domain Data Model

GJC-63 defines the core data model around users, games, archive posts, comments, AI profiles, recommendations, and embedding documents.

### Entities

| Entity | Purpose |
| --- | --- |
| `User` | Authenticated user profile. Stores email, password hash, nickname, bio, profile image, gamer tags, and optional Steam id. |
| `Game` | Game master data. Stores external ids, title, image, description, genres, platforms, and store/game tags. |
| `UserGame` | Join entity between `User` and `Game` with playtime, achievement rate, and last played time. |
| `ArchivePost` | Unified post table for reviews and journals. `type` is `REVIEW` or `JOURNAL`; `rating` is used only for reviews. |
| `Comment` | Comment table for archive posts. Supports nested replies through `parentCommentId`. |
| `AiProfile` | One AI-generated taste profile per user, including play style summary and favorite keywords/genres. |
| `Recommendation` | Recommended game result for a user, including reason, score, and rank. |
| `EmbeddingDocument` | RAG source document metadata for games, archive posts, and AI profiles. |

### Relationships

```text
User 1 ── N UserGame N ── 1 Game
User 1 ── N ArchivePost N ── 1 Game
ArchivePost 1 ── N Comment
User 1 ── N Comment
Comment 1 ── N Comment replies
User 1 ── 1 AiProfile
User 1 ── N Recommendation N ── 1 Game
EmbeddingDocument sourceType/sourceId -> Game | ArchivePost | AiProfile
```

### Notes

- `ArchivePost` intentionally combines reviews and journals. `rating` is nullable and should be set only when `type = REVIEW`.
- `Comment.parentCommentId` is nullable. `null` means a top-level comment; a value means the comment is a reply.
- `EmbeddingDocument.embedding` is not mapped as a TypeORM `@Column` because this project uses PostgreSQL `pgvector`. The `PgvectorSetupService` creates the actual `vector(1536)` column and HNSW index with raw SQL after TypeORM synchronization.
- User-entered gamer tags are stored on `User.gamerTags`.
- Store/game tags from Steam are currently stored on `Game.tags` as a `text[]` array. A separate `Tag` entity is not part of the current simplified schema.

## Useful Commands

```bash
# Run unit tests
npm run test

# Run e2e tests
npm run test:e2e

# Build server
npm run build
```

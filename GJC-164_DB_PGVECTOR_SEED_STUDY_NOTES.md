# GJC-164 DB pgvector Seed 구현 학습 정리

## 1. 작업 범위

이번 노트는 `GJC-164 [P0-02][DB] Postgres + pgvector 최소 스키마/시드 구성` 작업에서 변경한 아래 파일을 기준으로 정리한다.

- `server/.env.example`
- `server/README.md`
- `server/src/app.module.ts`
- `server/src/database/pgvector-setup.service.ts`
- `server/src/database/demo-seed.service.ts`

핵심 목표는 RAG MVP가 실제 DB row와 pgvector 값을 기반으로 동작할 수 있도록, 고정 demo user와 저널/리뷰/게임/AI 프로필/추천/임베딩 문서를 반복 실행 가능한 seed로 준비하는 것이다.

## 2. pgvector setup은 여러 서비스가 공유한다

`PgvectorSetupService`는 원래 앱 부트스트랩에서 pgvector extension과 vector 컬럼만 만들었다. GJC-164에서는 seed 서비스도 pgvector 준비가 끝난 뒤 실행되어야 하므로 `ensurePgvector()` 메서드로 분리했다.

```ts
async ensurePgvector(): Promise<void> {
  // Several bootstrap services may need pgvector, so the setup is shared and runs only once.
  this.setupPromise ??= this.runSetup();
  return this.setupPromise;
}
```

이 주석의 핵심은 “부트스트랩 서비스가 여러 개여도 pgvector setup은 한 번만 실행한다”는 것이다. `setupPromise`를 저장해두면 동시에 호출되더라도 같은 Promise를 기다리게 된다.

실제 pgvector 준비는 TypeORM 엔티티가 직접 표현하지 못하는 DB 전용 기능이라 raw SQL로 관리한다.

```ts
await this.dataSource.query(`CREATE EXTENSION IF NOT EXISTS vector`);

await this.dataSource.query(`
  ALTER TABLE "EmbeddingDocument"
  ADD COLUMN IF NOT EXISTS "embedding" vector(1536)
`);

await this.dataSource.query(`
  CREATE INDEX IF NOT EXISTS "IDX_EmbeddingDocument_embedding_hnsw"
  ON "EmbeddingDocument"
  USING hnsw ("embedding" vector_cosine_ops)
`);
```

## 3. seed는 부트스트랩 hook으로 실행한다

`DemoSeedService`는 `OnApplicationBootstrap`을 구현한다. 서버가 켜질 때 TypeORM synchronize 이후 실행되므로, 로컬에서 서버를 시작하면 seed가 자동으로 준비된다.

```ts
async onApplicationBootstrap(): Promise<void> {
  if (!this.isSeedEnabled()) {
    return;
  }

  await this.pgvectorSetup.ensurePgvector();

  const user = await this.seedUser();
  const games = await this.seedGames();
  const posts = await this.seedPosts(user.id, games);
  const aiProfile = await this.seedAiProfile(user.id);

  await this.seedUserGames(user.id, games);
  await this.seedRecommendations(user.id, games);
  await this.seedEmbeddingDocuments(games, posts, aiProfile);
}
```

환경변수로 켜고 끌 수 있게 했다.

```ts
private isSeedEnabled(): boolean {
  const rawValue = this.config.get<string>('DEMO_SEED_ENABLED') ?? 'true';
  return rawValue.toLowerCase() !== 'false';
}
```

`DEMO_SEED_ENABLED=false`로 두면 production-like 실행에서 demo row를 만들지 않을 수 있다.

## 4. demo user는 고정 id를 가진다

GJC-163 계약에서 고정한 demo user id를 그대로 사용한다.

```ts
import { AI_RECOMMENDATION_DEMO_USER_ID } from '../ai/recommendation-contract';

let user = await repository.findOne({
  where: [{ id: AI_RECOMMENDATION_DEMO_USER_ID }, { email }],
});
```

같은 id 또는 같은 email이 이미 있으면 새 row를 만들지 않고 갱신한다. 그래서 서버를 여러 번 켜도 중복 user가 생기지 않는다.

Steam 프로필 연동은 다음 이슈에서 구현하지만, seed user는 미리 `DEMO_STEAM_ID`를 받을 수 있게 했다.

```ts
const steamId = this.config.get<string>('DEMO_STEAM_ID') || null;
user.steamId = steamId;
```

## 5. 게임, 포스트, 프로필, 추천 row를 연결한다

seed 데이터는 이후 RAG와 추천 Agent가 바로 읽을 수 있도록 관계를 맞춘다.

```ts
post.userId = userId;
post.gameId = game.id;
post.type = seed.type;
post.title = seed.title;
post.content = seed.content;
post.rating = seed.rating;
```

추천 결과도 같은 demo user와 추천 game을 가리킨다.

```ts
recommendation.userId = userId;
recommendation.gameId = games.crossCode.id;
recommendation.rank = 1;
recommendation.score = 0.93;
recommendation.reason =
  'Seed recommendation for the AI MVP: precise combat, readable pixel art, and story-rich RPG structure match the demo player profile.';
```

이 구조 덕분에 다음 FE 작업은 임시 카드 배열이 아니라 DB/API 응답을 렌더링하는 방향으로 넘어갈 수 있다.

## 6. EmbeddingDocument와 vector 컬럼은 따로 저장한다

`EmbeddingDocument.embedding`은 TypeORM 컬럼이 아니다. 그래서 먼저 일반 엔티티 필드를 저장하고, 그 다음 raw SQL로 vector 컬럼을 갱신한다.

```ts
const savedDocument = await repository.save(document);
const embedding = this.buildDemoEmbedding(seed.content);

await this.dataSource.query(
  `
    UPDATE "EmbeddingDocument"
    SET "embedding" = $1::vector
    WHERE "id" = $2
  `,
  [this.toVectorLiteral(embedding), savedDocument.id],
);
```

여기서 `$1::vector`는 문자열로 만든 `[0.1,0.2,...]` 값을 pgvector 타입으로 캐스팅한다.

## 7. demo embedding은 결정적으로 만든다

이번 단계에서는 아직 LLM/Embedding API 키가 없다. 그래서 로컬 DB 검증용으로 같은 텍스트에서 항상 같은 1536차원 벡터를 만든다.

```ts
private buildDemoEmbedding(seedText: string): number[] {
  // This deterministic vector is only for local seed data; GJC-80 will replace it with model embeddings.
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
```

이 주석은 중요한 경계선을 남긴다. `demo-hash-embedding-v1`은 모델 임베딩이 아니라 seed 검증용 placeholder다. 실제 embedding 모델 연결은 `GJC-80`에서 담당한다.

## 8. 검증 결과

부트스트랩 seed 실행 후 DB에서 확인한 결과:

```json
{
  "demo_users": "1",
  "demo_posts": "3",
  "embedded_documents": "5",
  "demo_recommendations": "1"
}
```

검증 SQL은 README에도 남겼다.

```sql
SELECT
  ed."sourceType",
  ed."sourceId",
  ed.metadata ->> 'title' AS title,
  ed.metadata ->> 'model' AS embedding_model,
  ed."embedding" IS NOT NULL AS has_embedding
FROM "EmbeddingDocument" ed
ORDER BY ed."sourceType", title;
```

## 9. 다음 이슈로 이어지는 점

GJC-164는 외부 API를 호출하지 않는다. 새 목표에 따라 이후 MCP/API-key 작업에서는 게임 메타데이터를 IGDB에서 가져오고, Steam API는 SteamID64 기반 사용자 프로필과 플레이 기록 연결에 사용해야 한다.

필요한 입력값:

- IGDB API용 Twitch Client ID
- IGDB API용 Twitch Client Secret
- Steam Web API Key
- 테스트할 SteamID64

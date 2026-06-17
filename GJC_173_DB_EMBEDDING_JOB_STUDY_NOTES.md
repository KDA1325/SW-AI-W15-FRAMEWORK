# GJC-173 DB 기반 임베딩 Job 구조 학습 노트

## 1. 이번 대화에서 정리한 문제의식

AI 추천 품질과 시연 UX를 같이 챙기려면, 게시글 임베딩을 언제 만들지 결정하는 것이 중요합니다.

기존 흐름은 추천 페이지의 데이터 싱크 시점에 누락/변경된 게시글을 한꺼번에 임베딩하는 구조였습니다.

```text
글 작성/수정
→ ArchivePost 저장
→ 추천 페이지 데이터 싱크 클릭
→ 그때 누락/변경된 게시글 임베딩
→ RAG 분석/추천 실행
```

이 구조는 단순하지만, 사용자가 글을 많이 쌓은 뒤 첫 분석을 하면 오래 걸립니다. 그래서 처음에는 글 작성/수정 직후 in-memory queue로 백그라운드 임베딩하는 구조를 붙였습니다.

하지만 곧 다음 한계가 보였습니다.

| 방식 | 장점 | 한계 |
| --- | --- | --- |
| sync 시점 임베딩 | 구현이 단순함 | 첫 분석이 느림 |
| 작성/수정 직후 즉시 임베딩 | 추천 페이지 진입 전 임베딩 준비 가능 | 글을 여러 번 수정하면 API 호출이 잦아질 수 있음 |
| in-memory queue | 빠르고 간단함 | 서버 재시작 시 작업이 사라짐 |
| Redis/BullMQ | 운영급 queue | 현재 프로젝트에는 과할 수 있음 |
| DB job table | Redis 없이 작업 보존 가능 | scheduler/job 상태 관리가 필요함 |

결론적으로 이번 구조는 **DB 기반 EmbeddingJob outbox**로 잡았습니다.

```text
ArchivePost
= 원본 게시글

EmbeddingJob
= 임베딩해야 할 대상 예약표

EmbeddingDocument
= 실제 임베딩 결과 캐시
```

## 2. pending job의 의미

`pending job`은 "아직 처리되지 않은 임베딩 예약 건"입니다.

예를 들어 사용자가 리뷰를 작성하면, 바로 OpenAI embeddings API를 호출하지 않고 DB에 다음과 같은 예약만 남깁니다.

```text
EmbeddingJob
id: job-1
userId: user-1
sourceType: ARCHIVE_POST
sourceId: post-123
status: PENDING
scheduledAt: now()
```

의미는 단순합니다.

```text
post-123이 새로 생기거나 수정됐으니,
다음 임베딩 배치 때 이 게시글을 확인해 주세요.
```

상태 흐름은 다음과 같습니다.

```text
PENDING
→ PROCESSING
→ COMPLETED

또는

PENDING
→ PROCESSING
→ FAILED
```

## 3. 왜 posts와 job에 같은 데이터를 중복 저장하지 않았나

대화 중 "posts, job 테이블을 나눠서 똑같은 데이터를 저장하고 job 데이터를 주기적으로 임베딩하자"는 의견이 나왔습니다.

이번 구현에서는 게시글 본문을 `EmbeddingJob`에 복사하지 않았습니다. 대신 `sourceType`, `sourceId`만 저장합니다.

이유는 다음과 같습니다.

| 선택지 | 문제 |
| --- | --- |
| job에 게시글 본문 중복 저장 | 원본과 복사본의 불일치 가능 |
| job에는 sourceId만 저장 | 처리 시점에 최신 ArchivePost를 다시 읽을 수 있음 |

즉 `EmbeddingJob`은 데이터 복사본이 아니라 **작업 예약표**입니다.

```ts
@Unique('UQ_embedding_job_source', ['sourceType', 'sourceId'])
@Entity('EmbeddingJob')
export class EmbeddingJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @Column({ type: 'enum', enum: EmbeddingSourceType })
  sourceType!: EmbeddingSourceType;

  @Column('uuid')
  sourceId!: string;

  @Column({ type: 'enum', enum: EmbeddingJobStatus })
  status!: EmbeddingJobStatus;
}
```

`sourceType + sourceId`에 unique 제약을 둔 이유도 중요합니다. 같은 게시글을 여러 번 수정해도 job row가 계속 늘어나지 않고, 하나의 job이 다시 `PENDING`으로 갱신됩니다.

## 4. isUpdated boolean을 쓰지 않은 이유

`ArchivePost`에 `isUpdated` 같은 boolean을 넣고 true인 것만 임베딩하자는 의견도 있었습니다.

이번 구현에서는 그 방식을 쓰지 않았습니다. boolean은 "무엇 기준으로 최신인지"를 표현하기 어렵기 때문입니다.

예를 들어 다음 상황이 가능합니다.

```text
글 수정됨 → isUpdated = true
임베딩 시작
임베딩 중 글이 다시 수정됨
임베딩 완료 → isUpdated = false
```

이 경우 두 번째 수정 내용이 아직 임베딩되지 않았는데도 `false`가 될 수 있습니다.

그래서 현재 구조는 기존처럼 timestamp 비교를 유지합니다.

```text
ArchivePost.updatedAt
vs
EmbeddingDocument.metadata.updatedAt
```

판단 기준은 다음과 같습니다.

```text
EmbeddingDocument가 없음
→ 임베딩 필요

content가 달라짐
→ 임베딩 필요

post.updatedAt이 embedding metadata.updatedAt보다 최신
→ 임베딩 필요

이미 최신임
→ 임베딩 생략
```

이 로직은 [rag.service.ts](server/src/ai/rag.service.ts)의 `isArchiveEmbeddingFresh`에서 담당합니다.

```ts
if (!document || document.content !== content) {
  return false;
}

const embeddedUpdatedAt = this.toEpochMilliseconds(
  document.metadata.updatedAt,
);
const postUpdatedAt = this.toEpochMilliseconds(post.updatedAt);

return (
  embeddedUpdatedAt !== null &&
  postUpdatedAt !== null &&
  embeddedUpdatedAt >= postUpdatedAt
);
```

## 5. 현재 최종 구조

요청한 최종 구조는 다음과 같습니다.

```text
평소:
글 작성/수정
→ EmbeddingJob PENDING 저장
→ 1분마다 배치 처리

추천 sync 클릭:
해당 유저 PENDING job 즉시 flush
→ 최신 임베딩으로 분석/추천
```

### 5.1 글 작성/수정 시점

[posts.service.ts](server/src/posts/posts.service.ts)에서 글 저장 후 `ArchiveEmbeddingQueueService.enqueue`를 호출합니다.

```ts
const savedPost = await this.savePostOrConflict(post, dto.type);
await this.archiveEmbeddingQueue?.enqueue(userId, savedPost.id);
```

수정 시점도 동일합니다.

```ts
await this.postRepository.save(post);
await this.archiveEmbeddingQueue?.enqueue(userId, id);
```

이때 OpenAI API를 호출하지 않습니다. DB에 job 예약만 남기므로 글 저장 요청은 비교적 가볍습니다.

### 5.2 enqueue는 DB upsert

[archive-embedding-queue.service.ts](server/src/ai/archive-embedding-queue.service.ts)의 `enqueue`는 `EmbeddingJob`에 pending job을 upsert합니다.

```ts
await this.dataSource.query(
  `
    INSERT INTO "EmbeddingJob"
      ("userId", "sourceType", "sourceId", "status", "attempts", "lastError", "scheduledAt", "processingStartedAt")
    VALUES
      ($1, $2, $3, $4, 0, NULL, now(), NULL)
    ON CONFLICT ("sourceType", "sourceId")
    DO UPDATE SET
      "userId" = EXCLUDED."userId",
      "status" = $4,
      "attempts" = 0,
      "lastError" = NULL,
      "scheduledAt" = now(),
      "processingStartedAt" = NULL,
      "updatedAt" = now()
  `,
  [
    userId,
    EmbeddingSourceType.ARCHIVE_POST,
    postId,
    EmbeddingJobStatus.PENDING,
  ],
);
```

핵심은 `ON CONFLICT ("sourceType", "sourceId")`입니다. 같은 게시글에 대한 job이 이미 있으면 새 row를 만들지 않고 기존 row를 다시 pending 상태로 갱신합니다.

## 6. 1분 주기 배치 처리

`ArchiveEmbeddingQueueService`는 `OnModuleInit`에서 1분마다 flush를 예약합니다.

```ts
const ARCHIVE_EMBEDDING_BATCH_INTERVAL_MS = 60_000;

onModuleInit() {
  this.interval = setInterval(
    () => void this.flushPendingJobs(),
    ARCHIVE_EMBEDDING_BATCH_INTERVAL_MS,
  );
  this.interval.unref?.();
}
```

`unref`를 호출한 이유는 이 타이머 하나 때문에 Node 프로세스가 종료되지 못하는 상황을 피하기 위해서입니다.

처리 단위는 최대 64개입니다.

```ts
const MAX_ARCHIVE_EMBEDDING_BATCH_POSTS = 64;
```

이 숫자는 OpenAI embeddings batch input과 맞물려, 여러 게시글을 한 번에 처리하기 위한 상한입니다.

## 7. 추천 sync 전 즉시 flush

평소 배치는 1분마다 돌지만, 사용자가 추천 페이지에서 데이터 동기화를 눌렀을 때는 최신성을 더 중요하게 봅니다.

그래서 [agent.service.ts](server/src/ai/agent.service.ts)에서 추천 sync 시작 전에 해당 유저의 pending job을 먼저 처리합니다.

```ts
const requestId = options.requestId ?? `gjc-sync-${Date.now()}`;
await this.archiveEmbeddingQueue?.flushPendingForUser(userId);

const cachedProfile = await this.dataSource
  .getRepository(AiProfile)
  .findOne({
    where: { userId },
  });
```

이 순서가 중요한 이유는 캐시 때문입니다.

추천 결과 캐시는 `ArchivePost`와 `UserGame`의 count/max(updatedAt) 등을 기준으로 key를 만듭니다. sync 전에 pending job을 flush해야 "게시글은 바뀌었지만 임베딩은 아직 예전"인 상태를 줄일 수 있습니다.

## 8. DB job claim과 동시성

DB 기반 job queue에서 중요한 부분은 "여러 worker가 같은 job을 동시에 잡지 않게 하는 것"입니다.

이번 구현은 PostgreSQL의 `FOR UPDATE SKIP LOCKED` 패턴을 사용합니다.

```sql
WITH picked AS (
  SELECT "id"
  FROM "EmbeddingJob"
  WHERE "status" = $4
    AND "sourceType" = $5
    AND "scheduledAt" <= now()
    AND ($2::uuid IS NULL OR "userId" = $2::uuid)
  ORDER BY "scheduledAt" ASC
  LIMIT $1
  FOR UPDATE SKIP LOCKED
)
UPDATE "EmbeddingJob"
SET
  "status" = $3,
  "attempts" = "attempts" + 1,
  "processingStartedAt" = now(),
  "updatedAt" = now()
FROM picked
WHERE "EmbeddingJob"."id" = picked."id"
RETURNING "EmbeddingJob"."id", "EmbeddingJob"."userId", "EmbeddingJob"."sourceId"
```

의미는 다음과 같습니다.

```text
1. PENDING job 중 처리할 row를 고름
2. 고른 row를 lock
3. 이미 다른 처리자가 lock한 row는 skip
4. 고른 row를 PROCESSING으로 바꿈
5. sourceId를 반환해서 임베딩 처리
```

이 패턴 덕분에 1분 배치와 추천 sync 전 flush가 겹쳐도 같은 job을 중복 처리할 가능성을 낮출 수 있습니다.

## 9. stuck PROCESSING 복구

DB job queue는 서버가 중간에 죽었을 때 `PROCESSING` 상태의 job이 남을 수 있습니다.

예를 들어:

```text
PENDING job claim
→ PROCESSING으로 변경
→ 임베딩 API 호출 중 서버 종료
→ COMPLETED/FAILED로 바꾸지 못함
```

이런 job은 그대로 두면 영원히 처리되지 않을 수 있습니다.

그래서 flush 시작 전에 10분 이상 `PROCESSING`에 남은 job을 다시 `PENDING`으로 돌립니다.

```ts
await this.dataSource.query(
  `
    UPDATE "EmbeddingJob"
    SET
      "status" = $1,
      "processingStartedAt" = NULL,
      "updatedAt" = now()
    WHERE "status" = $2
      AND "processingStartedAt" < now() - interval '10 minutes'
      AND ($3::uuid IS NULL OR "userId" = $3::uuid)
  `,
  [EmbeddingJobStatus.PENDING, EmbeddingJobStatus.PROCESSING, userId ?? null],
);
```

## 10. 실제 임베딩은 기존 RAG 로직 재사용

`EmbeddingJob`은 어떤 게시글을 확인할지 알려줄 뿐입니다. 실제로 임베딩이 필요한지 판단하고 OpenAI batch embedding을 호출하는 부분은 기존 `RagService`가 담당합니다.

```ts
async refreshArchiveEmbeddingsForPosts(
  userId: string,
  postIds: string[],
): Promise<number> {
  const uniquePostIds = [...new Set(postIds.filter(Boolean))];

  if (uniquePostIds.length === 0) {
    return 0;
  }

  const posts = await this.loadUserArchivePosts(userId, uniquePostIds);
  return this.refreshArchiveEmbeddings(posts);
}
```

이 구조의 장점은 두 가지입니다.

```text
EmbeddingJob은 예약/상태 관리만 담당
RagService는 임베딩 freshness 판단과 생성만 담당
```

역할이 분리되어 유지보수가 쉬워집니다.

## 11. 전체 흐름

```text
사용자 글 작성/수정
  ↓
ArchivePost 저장
  ↓
EmbeddingJob upsert
  status = PENDING
  ↓
1분 주기 배치 또는 추천 sync 전 flush
  ↓
PENDING job claim
  status = PROCESSING
  ↓
RagService.refreshArchiveEmbeddingsForPosts(userId, postIds)
  ↓
ArchivePost.updatedAt vs EmbeddingDocument.metadata.updatedAt 비교
  ↓
stale/missing 게시글만 batch embedding
  ↓
EmbeddingDocument 저장/갱신
  ↓
EmbeddingJob COMPLETED
```

추천 sync는 다음 흐름입니다.

```text
데이터 동기화 클릭
  ↓
해당 유저 pending EmbeddingJob 즉시 flush
  ↓
최신 EmbeddingDocument 기준 RAG 분석
  ↓
추천 후보 탐색
  ↓
LLM 추천 근거 생성
  ↓
AiProfile.lastRecommendationSync 저장
```

## 12. 테스트로 확인한 것

이번 변경 후 다음 테스트를 통과했습니다.

```text
npm test -- --runInBand archive-embedding-queue.service.spec.ts posts.service.spec.ts rag.service.spec.ts agent.service.spec.ts
```

확인 범위:

| 테스트 | 확인 내용 |
| --- | --- |
| archive-embedding-queue.service.spec.ts | `EmbeddingJob` upsert, 유저별 flush, completed 처리 |
| posts.service.spec.ts | 글 생성 후 임베딩 job enqueue |
| rag.service.spec.ts | stale/missing 임베딩 판단, batch embedding |
| agent.service.spec.ts | 추천 sync 흐름이 기존 추천 로직을 깨지 않음 |

서버 빌드도 통과했습니다.

```text
npm run build
```

## 13. 현재 구조의 장점과 남은 한계

장점:

```text
글 저장 시 OpenAI API를 바로 호출하지 않음
같은 게시글을 여러 번 수정해도 job 하나로 합쳐짐
서버 재시작 후에도 pending job이 DB에 남음
추천 sync 전 해당 유저 job을 즉시 처리해 최신성 확보
기존 updatedAt 기반 freshness 판단을 그대로 활용
Redis 없이 job queue에 가까운 구조 구현
```

남은 한계:

```text
완전한 운영급 queue는 아님
retry backoff 정책이 단순함
FAILED job 재시도 UI/API는 아직 없음
여러 서버 인스턴스에서는 DB lock 패턴으로 중복 claim은 줄였지만, 모니터링/운영 도구는 부족함
```

그래도 현재 프로젝트와 시연 요구에는 Redis/BullMQ보다 가벼우면서, 단순 in-memory queue보다 훨씬 안정적인 중간 지점입니다.


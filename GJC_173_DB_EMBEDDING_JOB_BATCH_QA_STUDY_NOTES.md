# GJC-173 DB 기반 배치 임베딩 구조 학습 노트

## 1. 이번 대화의 핵심 질문

이번 대화의 주제는 "글 작성/수정 직후 바로 임베딩하는 방식"과 "DB에 임베딩 작업을 예약해두고 일정 시간마다 처리하는 방식"의 차이였습니다.

결론부터 말하면, DB 테이블을 나누어 `EmbeddingJob`에 처리 대상을 쌓고 일정 시간마다 임베딩하는 구조는 **DB 기반 배치 임베딩** 또는 **outbox 기반 배치 임베딩**에 가깝습니다.

```text
글 작성/수정
→ EmbeddingJob에 PENDING 예약
→ 1분마다 PENDING job을 모아서 처리
→ 기존 batch embedding 로직으로 여러 문서를 한 번에 임베딩
→ EmbeddingDocument 갱신
```

여기서 중요한 점은 기존에 만들어둔 "여러 문서를 OpenAI embeddings API에 한 번에 보내는 로직"을 버리는 것이 아니라, 새 구조의 실행 단계에서 그대로 재사용한다는 것입니다.

## 2. 배치라는 말의 두 가지 의미

이번 구조에서 "배치"는 두 층위로 쓰입니다.

| 구분 | 의미 | 예시 |
| --- | --- | --- |
| 배치 처리 | 일정 시간마다 처리 대상을 모아서 실행 | 1분마다 `PENDING` job 조회 |
| 배치 API 호출 | 여러 문서를 한 API 요청에 묶어서 전송 | `input: string[]`으로 OpenAI embeddings 호출 |

따라서 새 구조는 다음 두 가지를 모두 포함합니다.

```text
DB job scheduler
→ 어떤 게시글을 언제 임베딩할지 결정

OpenAI batch embedding
→ 실제 여러 문서를 한 번에 벡터화
```

## 3. 테이블 역할 분리

테이블을 둘로 나눈다는 말은 게시글 데이터를 중복 저장한다는 뜻이 아닙니다. 더 좋은 구조는 원본과 작업 예약, 결과 캐시를 분리하는 것입니다.

```text
ArchivePost
= 원본 리뷰/저널

EmbeddingJob
= 임베딩이 필요한 sourceId 목록

EmbeddingDocument
= 실제 임베딩 결과 캐시
```

`EmbeddingJob`에는 본문 전체를 복사하지 않고, 어떤 원본을 처리해야 하는지 식별할 수 있는 정보만 저장합니다.

```ts
export enum EmbeddingJobStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Unique('UQ_embedding_job_source', ['sourceType', 'sourceId'])
@Entity('EmbeddingJob')
export class EmbeddingJob {
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

`sourceType + sourceId`에 unique 제약을 두는 이유는 같은 게시글을 여러 번 수정해도 job을 무한히 늘리지 않고, 기존 job을 다시 `PENDING`으로 돌리기 위해서입니다.

## 4. Pending Job이란?

`pending job`은 아직 처리되지 않은 임베딩 예약 건입니다.

```text
PENDING
= 이 게시글은 임베딩 확인이 필요하지만 아직 처리되지 않음

PROCESSING
= 지금 worker가 잡아서 처리 중

COMPLETED
= 처리 완료

FAILED
= 처리 실패
```

사용자가 글을 작성하거나 수정하면 바로 OpenAI API를 호출하지 않고, job만 예약합니다.

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
  [userId, EmbeddingSourceType.ARCHIVE_POST, postId, EmbeddingJobStatus.PENDING],
);
```

이 구조에서는 글 작성/수정 요청이 OpenAI 응답을 기다리지 않습니다. 대신 DB에 "이 글은 나중에 임베딩 확인 필요"라고 표시만 합니다.

## 5. 1분마다 처리하는 이유

시연 목적이라면 1분 간격이 적절합니다.

| 간격 | 장점 | 단점 |
| --- | --- | --- |
| 1분 | 시연에서 반영이 빠름 | 운영 규모가 커지면 호출 빈도가 높을 수 있음 |
| 3분 | 초기 서비스에서 균형 좋음 | 바로 반영되는 느낌은 약함 |
| 5~10분 | 비용/부하 제어에 유리 | 사용자가 최신 반영을 느끼기 어려움 |

현재 시연 요구에서는 다음 조합이 가장 자연스럽습니다.

```text
평소:
글 작성/수정 → EmbeddingJob PENDING 저장 → 1분마다 배치 처리

추천 sync 클릭:
해당 유저 PENDING job 즉시 flush → 최신 임베딩으로 분석/추천
```

## 6. 추천 Sync 직전 Flush

1분 배치만 두면 사용자가 글을 작성한 직후 추천 페이지에서 sync를 눌렀을 때, 방금 쓴 글이 아직 반영되지 않았을 수 있습니다.

그래서 추천 sync 시작 전에 해당 유저의 pending job을 먼저 처리합니다.

```ts
async syncRecommendations(
  userId: string,
  options: AgentSyncOptions = {},
): Promise<AiRecommendationSyncResponse> {
  const requestId = options.requestId ?? `gjc-sync-${Date.now()}`;
  await this.archiveEmbeddingQueue?.flushPendingForUser(userId);

  // 이후 캐시 확인, RAG 분석, 추천 생성 진행
}
```

이 순서가 중요한 이유는 추천 결과 캐시 판단 전에 임베딩 상태를 최신화해야 하기 때문입니다.

```text
pending flush 먼저
→ EmbeddingDocument 최신화
→ 추천 캐시 키/분석 결과 판단
```

## 7. 기존 배치 임베딩 로직은 버리지 않는다

새 DB job 구조를 만든다고 해서 기존 배치 임베딩 로직을 버리는 것이 아닙니다.

기존 로직은 실제 임베딩 생성 엔진입니다.

```ts
private async createEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
  if (texts.length === 0) {
    return [];
  }

  const apiKey = this.config.get<string>('OPENAI_API_KEY');

  if (!apiKey) {
    return Promise.all(texts.map((text) => this.createEmbedding(text)));
  }

  for (let start = 0; start < texts.length; start += OPENAI_EMBEDDING_BATCH_SIZE) {
    const chunk = texts.slice(start, start + OPENAI_EMBEDDING_BATCH_SIZE);

    const payload: Record<string, unknown> = {
      encoding_format: 'float',
      input: chunk.map((text) => this.truncateEmbeddingInput(text)),
      model,
    };

    // OpenAI embeddings API 호출
  }
}
```

새 구조는 이 엔진 앞에 "언제 어떤 문서를 넣을지 결정하는 예약 시스템"을 붙이는 것입니다.

```text
기존:
추천 sync 클릭 → 변경 문서 수집 → batch embedding

새 구조:
글 작성/수정 → EmbeddingJob 예약
1분 배치 또는 sync 전 flush → job 수집 → 기존 batch embedding
```

즉 버리는 것은 기존 batch API 호출이 아니라, "추천 sync 시점에만 임베딩 대상을 찾는 방식"입니다.

## 8. UpdatedAt 비교 로직은 유지한다

`isUpdated` 같은 boolean 값을 `ArchivePost`에 추가하는 방식은 단순하지만, 임베딩 중에 글이 다시 수정되는 상황에서 부정확해질 수 있습니다.

더 안전한 기준은 이미 있는 timestamp 비교입니다.

```text
ArchivePost.updatedAt
vs
EmbeddingDocument.metadata.updatedAt
```

현재 stale 판정은 이 방향입니다.

```ts
if (this.isArchiveEmbeddingFresh(document, post, content)) {
  continue;
}

staleDocuments.push({ content, document, post });
```

즉 `EmbeddingJob`은 "확인해볼 대상"을 알려주는 예약표이고, 실제로 임베딩이 필요한지는 처리 시점에 다시 판단합니다.

```text
EmbeddingJob에 PENDING이 있음
→ 해당 ArchivePost 조회
→ 기존 EmbeddingDocument 조회
→ content / model / dimensions / updatedAt 비교
→ 진짜 stale이면 임베딩
→ 이미 최신이면 API 호출 없이 완료 처리
```

이 구조가 boolean flag보다 안전합니다.

## 9. 전체 흐름

```text
1. 글 작성/수정
   PostsService가 ArchivePost 저장

2. 임베딩 작업 예약
   ArchiveEmbeddingQueueService.enqueue(userId, postId)
   EmbeddingJob에 PENDING upsert

3. 평소 배치 처리
   1분마다 flushPendingJobs()
   PENDING job을 PROCESSING으로 claim

4. 사용자별 임베딩 처리
   userId별로 sourceId를 묶음
   RagService.refreshArchiveEmbeddingsForPosts(userId, postIds)

5. stale/missing 문서만 실제 임베딩
   기존 EmbeddingDocument가 최신이면 skip
   아니면 createEmbeddings(text[])

6. 결과 저장
   EmbeddingDocument 갱신
   EmbeddingJob COMPLETED 또는 FAILED 처리

7. 추천 sync
   sync 시작 전에 flushPendingForUser(userId)
   최신 임베딩 기준으로 RAG/추천 진행
```

## 10. 이 구조의 장점과 주의점

장점:

- 글 작성/수정 요청에서 OpenAI API를 기다리지 않습니다.
- 같은 글을 여러 번 수정해도 `sourceType + sourceId` unique 제약으로 job을 하나로 합칠 수 있습니다.
- 주기적 배치와 OpenAI batch API 호출을 함께 사용해 비용과 속도를 제어할 수 있습니다.
- job이 DB에 남기 때문에 단순 in-memory queue보다 서버 재시작에 강합니다.
- 추천 sync 직전 flush로 시연 중 최신 데이터 반영을 보장하기 쉽습니다.

주의점:

- `EmbeddingJob` 테이블이 계속 커질 수 있으므로, 나중에는 오래된 `COMPLETED` job 정리 정책이 필요할 수 있습니다.
- `PROCESSING` 상태에서 서버가 죽는 경우를 대비해 stale processing job 복구 로직이 필요합니다.
- 여러 서버 인스턴스를 운영한다면 `FOR UPDATE SKIP LOCKED`처럼 중복 claim을 막는 쿼리가 중요합니다.
- 현재 구조는 Redis 없이도 충분하지만, 트래픽이 커지면 BullMQ 같은 전용 큐로 확장할 수 있습니다.

## 11. 한 줄 정리

이번에 논의한 구조는 **기존 OpenAI batch embedding 로직을 유지하면서, 그 앞에 DB 기반 `EmbeddingJob` 예약 테이블과 1분 주기 scheduler를 붙이는 방식**입니다.

```text
EmbeddingJob = 처리할 대상 예약
EmbeddingDocument = 처리 결과 캐시
RagService.createEmbeddings = 실제 batch embedding 엔진
```

따라서 기존 배치 임베딩은 버리는 것이 아니라, 새 DB job 구조 안에서 더 명확한 역할을 갖고 재사용됩니다.

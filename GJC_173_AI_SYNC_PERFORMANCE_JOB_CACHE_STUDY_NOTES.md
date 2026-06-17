# GJC-173 AI Sync 성능/Job Queue/캐시 학습 정리

## 1. 추가로 해결한 문제

이 노트는 이전 `GJC_173_AI_ANALYSIS_LOGIC_IMPROVEMENT_STUDY_NOTES.md` 작성 이후 추가로 바꾼 내용을 정리한다.

후속 대화에서 다룬 문제는 세 가지였다.

| 문제 | 원인 | 처리 |
| --- | --- | --- |
| 임베딩 문서가 없을 때 첫 sync가 1분 가까이 걸림 | 게시글별 OpenAI embedding을 순차 호출 | OpenAI embeddings batch input 사용 |
| sync 중 페이지 이동/새로고침 시 진행 상태 유지가 약함 | sync 요청이 페이지 로컬 상태에 묶임 | 서버 job queue + 프론트 polling 구조 |
| 임베딩이 최신이어도 재-sync가 26초 정도 걸림 | RAG/LLM/IGDB/추천 근거를 매번 재생성 | 분석/추천 결과 cache key 도입 |

핵심은 **임베딩 캐시만으로는 충분하지 않다**는 점이다. 임베딩 문서가 최신이어도 sync 버튼을 누르면 RAG 분석, agent planning, IGDB 검색, 추천 근거 LLM 생성이 다시 실행되면 여전히 오래 걸린다.

## 2. 배치 임베딩

### 2.1 기존 병목

기존 `refreshArchiveEmbeddings()`는 누락/오래된 게시글마다 `createEmbedding()`을 호출했다. 게시글이 140개라면 최대 140번의 OpenAI embedding 요청이 발생할 수 있었다.

### 2.2 변경 구조

이제 먼저 stale/missing 문서를 모은 뒤, 한 번에 여러 문서를 임베딩한다.

```ts
private async refreshArchiveEmbeddings(
  posts: ArchivePostRow[],
): Promise<number> {
  const repository = this.dataSource.getRepository(EmbeddingDocument);
  const staleDocuments: Array<{
    content: string;
    document: EmbeddingDocument | null;
    post: ArchivePostRow;
  }> = [];

  for (const post of posts) {
    const content = this.buildArchiveEmbeddingContent(post);
    let document = await repository.findOne({
      where: {
        sourceType: EmbeddingSourceType.ARCHIVE_POST,
        sourceId: post.id,
      },
    });

    if (this.isArchiveEmbeddingFresh(document, post, content)) {
      continue;
    }

    staleDocuments.push({ content, document, post });
  }

  if (staleDocuments.length === 0) {
    return 0;
  }

  const embeddings = await this.createEmbeddings(
    staleDocuments.map((item) => item.content),
  );
  ...
}
```

OpenAI batch size는 64개로 잡았다.

```ts
const OPENAI_EMBEDDING_BATCH_SIZE = 64;
```

배치 요청은 `input`에 문자열 배열을 넣는 방식이다.

```ts
private async createEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
  ...
  for (let start = 0; start < texts.length; start += OPENAI_EMBEDDING_BATCH_SIZE) {
    const chunk = texts.slice(start, start + OPENAI_EMBEDDING_BATCH_SIZE);

    const payload: Record<string, unknown> = {
      encoding_format: 'float',
      input: chunk.map((text) => this.truncateEmbeddingInput(text)),
      model,
    };

    if (model.startsWith('text-embedding-3')) {
      payload.dimensions = dimensions;
    }

    const response = await axios.post<OpenAiEmbeddingResponse>(
      'https://api.openai.com/v1/embeddings',
      payload,
      ...
    );
    ...
  }
}
```

### 2.3 fallback

배치 요청 실패 시 전체 sync를 실패시키지 않고 문서별 임베딩 경로로 내려간다.

```ts
catch (error) {
  this.logger.warn(
    `OpenAI batch embedding failed; falling back to per-document embeddings. ${this.errorMessage(error)}`,
  );
  results.push(
    ...(await Promise.all(chunk.map((text) => this.createEmbedding(text)))),
  );
}
```

이 fallback은 OpenAI를 안 쓰겠다는 뜻이 아니라, batch 호출 실패 시 기존 단건 경로로 복구하기 위한 방어 코드다.

## 3. 서버 Job Queue 구조

### 3.1 왜 필요했는가

전역 프론트 provider로 페이지 이동 중 요청 유지는 어느 정도 가능했지만, 새로고침이나 탭 상태 변화까지 안정적으로 처리하려면 서버가 job 상태를 알아야 한다.

그래서 `POST /ai/recommendations/sync`가 추천 결과를 끝까지 기다리지 않고 즉시 job snapshot을 반환하도록 바꿨다.

```txt
POST /ai/recommendations/sync
  -> job 생성
  -> 즉시 { jobId, status: pending/running } 반환
  -> 서버에서 background로 AgentService.syncRecommendations 실행

GET /ai/recommendations/sync/:jobId
  -> job 상태 polling

GET /ai/recommendations/sync/active
  -> 현재 로그인 유저의 진행 중 job 조회
```

### 3.2 서버 Job Service

파일: `server/src/ai/recommendation-sync-job.service.ts`

```ts
type RecommendationSyncJobStatus = 'completed' | 'failed' | 'pending' | 'running';

export type RecommendationSyncJobSnapshot = {
  completedAt: string | null;
  error: string | null;
  jobId: string;
  requestId: string;
  result: AiRecommendationSyncResponse | null;
  startedAt: string | null;
  status: RecommendationSyncJobStatus;
  userId: string;
};
```

메모리 기반 job 저장소를 둔다.

```ts
@Injectable()
export class RecommendationSyncJobService {
  private readonly jobs = new Map<string, RecommendationSyncJob>();
  private readonly logger = new Logger(RecommendationSyncJobService.name);

  constructor(private readonly agentService: AgentService) {}
  ...
}
```

job 시작 시 이미 진행 중인 job이 있으면 새 job을 만들지 않고 기존 active job을 반환한다.

```ts
startJob(userId: string, options: AgentSyncOptions = {}) {
  const activeJob = this.getLatestActiveJob(userId);

  if (activeJob) {
    return activeJob;
  }

  const requestId = options.requestId ?? `gjc-sync-${Date.now()}`;
  const jobId = `${requestId}-${Math.random().toString(36).slice(2, 10)}`;
  ...

  void this.runJob(job);

  return this.toSnapshot(job);
}
```

실제 추천 분석은 background에서 수행한다.

```ts
private async runJob(job: RecommendationSyncJob) {
  job.status = 'running';
  job.startedAt = new Date().toISOString();

  try {
    job.result = await this.agentService.syncRecommendations(
      job.userId,
      job.options,
    );
    job.status = 'completed';
  } catch (error) {
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : 'Unknown sync error';
    this.logger.error(
      `Recommendation sync job failed (${job.jobId}). ${job.error}`,
    );
  } finally {
    job.completedAt = new Date().toISOString();
  }
}
```

현재 구현은 서버 메모리 기반이다. 서버 프로세스가 재시작되면 진행 중 job 상태는 사라진다. 운영형 영속 job queue로 확장하려면 Redis + BullMQ 같은 외부 queue 저장소가 필요하다.

### 3.3 Controller 변경

파일: `server/src/ai/recommendations.controller.ts`

```ts
@Post('sync')
sync(@Req() req: AuthedRequest, @Body() body: SyncRecommendationBody) {
  return this.syncJobs.startJob(req.user.userId, {
    forceRefresh: body?.forceRefresh,
    requestId: body?.requestId,
    topK: body?.topK,
  });
}

@Get('sync/active')
activeSync(@Req() req: AuthedRequest) {
  return this.syncJobs.getLatestActiveJob(req.user.userId);
}

@Get('sync/:jobId')
syncStatus(@Req() req: AuthedRequest, @Param('jobId') jobId: string) {
  const job = this.syncJobs.getJob(req.user.userId, jobId);
  ...
}
```

`getJob()`은 userId를 같이 검사한다. 다른 사용자의 jobId를 알아도 조회할 수 없게 하기 위한 최소 권한 체크다.

## 4. 프론트 전역 Sync Provider와 Polling

### 4.1 페이지 로컬 상태의 한계

기존 구조에서는 `Recommend` 페이지 hook이 sync 요청 상태를 들고 있었다. 페이지를 이동하면 컴포넌트가 언마운트되어 상태를 잃을 수 있었다.

이를 해결하기 위해 `RecommendationSyncProvider`를 `main.tsx`에서 `App` 바깥에 배치했다.

```tsx
<AuthProvider>
  <RecommendationSyncProvider>
    <App />
  </RecommendationSyncProvider>
</AuthProvider>
```

### 4.2 Polling 상태

파일: `client/src/features/recommendations/useRecommendationSync.tsx`

```ts
const ACTIVE_SYNC_JOB_STORAGE_KEY = 'gjc.activeRecommendationSyncJobId'
const SYNC_JOB_POLL_INTERVAL_MS = 1500
```

진행 중 job id는 `localStorage`에도 저장한다. 새로고침 후에도 같은 서버 프로세스가 살아 있으면 polling을 재개할 수 있다.

```ts
const resumeSyncJob = useCallback(
  (jobId: string) => {
    const requestOrder = syncRequestIdRef.current + 1
    syncRequestIdRef.current = requestOrder
    activeJobIdRef.current = jobId
    window.localStorage.setItem(ACTIVE_SYNC_JOB_STORAGE_KEY, jobId)
    setIsSyncing(true)
    setSyncError(null)
    void pollSyncJob(jobId, requestOrder)
  },
  [pollSyncJob],
)
```

polling은 job이 완료되거나 실패할 때까지 반복된다.

```ts
const pollSyncJob = useCallback(
  async (jobId: string, requestOrder: number) => {
    const response = await api.get<unknown>(
      `/ai/recommendations/sync/${jobId}`,
    )
    const job = normalizeSyncJob(response.data)

    if (job.status === 'completed' || job.status === 'failed') {
      finishJob(job, requestOrder)
      return
    }

    if (requestOrder === syncRequestIdRef.current) {
      pollTimeoutRef.current = window.setTimeout(() => {
        void pollSyncJob(jobId, requestOrder)
      }, SYNC_JOB_POLL_INTERVAL_MS)
    }
  },
  ...
)
```

완료 시 result를 화면 상태에 반영한다.

```ts
const finishJob = useCallback(
  (job: AiRecommendationSyncJob, requestOrder: number) => {
    ...
    setIsSyncing(false)

    if (job.status === 'completed') {
      setSyncData(job.result)
      setSyncError(job.result ? null : 'AI SYNC RESPONSE INVALID')
      return
    }

    setSyncError(job.error ?? 'AI SYNC FAILED')
  },
  ...
)
```

### 4.3 작은 진행 팝업

전체 화면 모달 대신 우하단 작은 팝업으로 바꿨다.

```tsx
function RecommendationSyncStatusPopup({ isSyncing }: { isSyncing: boolean }) {
  if (!isSyncing) {
    return null
  }

  return (
    <div className="fixed bottom-5 right-5 z-[120] w-[min(320px,calc(100vw-2rem))] border-2 border-primary bg-white p-4 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
      ...
    </div>
  )
}
```

이 팝업은 provider가 렌더링하므로 페이지 이동 후에도 유지된다.

## 5. 분석/추천 결과 캐시

### 5.1 임베딩 캐시와 결과 캐시는 다르다

임베딩 문서는 이미 캐싱되고 있었다. 하지만 sync 버튼을 누르면 그 뒤의 작업이 매번 실행됐다.

```txt
임베딩 문서 캐시됨
하지만
RAG 분석 LLM 다시 호출
Agent planning LLM 다시 호출
IGDB 검색 다시 호출
추천 근거 LLM 다시 호출
```

따라서 26초 병목은 임베딩이 아니라 **추천 파이프라인 결과 재생성**이었다.

### 5.2 Cache Key

파일: `server/src/ai/agent.service.ts`

```ts
const RECOMMENDATION_CACHE_VERSION = 'gjc-recommendation-cache-v2';
```

sync 시작 시 `AiProfile.lastRecommendationSync`를 먼저 확인한다.

```ts
const cachedProfile = await this.dataSource
  .getRepository(AiProfile)
  .findOne({
    where: { userId },
  });
const cachedResponse = await this.getCachedRecommendationSync(
  userId,
  options,
  requestId,
  cachedProfile?.lastRecommendationSync ?? null,
);

if (cachedResponse) {
  await this.saveLatestRecommendationSync(userId, cachedResponse);
  return cachedResponse;
}
```

캐시 키는 사용자 입력 데이터와 추천 로직 설정을 hash로 만든다.

```ts
private async buildRecommendationCacheKey(
  userId: string,
  options: AgentSyncOptions,
): Promise<string> {
  const rows = await this.dataSource.query(...);
  const signature = Array.isArray(rows) ? rows[0] : null;
  const payload = {
    archiveCount: Number(signature?.archiveCount ?? 0),
    archiveLatest: signature?.archiveLatest ?? null,
    chatModel: this.config.get<string>('OPENAI_CHAT_MODEL') ?? 'gpt-4o-mini',
    embeddingDimensions:
      this.config.get<string>('OPENAI_EMBEDDING_DIMENSIONS') ?? '1536',
    embeddingModel:
      this.config.get<string>('OPENAI_EMBEDDING_MODEL') ??
      'text-embedding-3-small',
    maxIterations: this.maxIterations(),
    minRecommendations: MIN_RECOMMENDATION_COUNT,
    topK: options.topK ?? null,
    userGameCount: Number(signature?.userGameCount ?? 0),
    userGameLatest: signature?.userGameLatest ?? null,
    version: RECOMMENDATION_CACHE_VERSION,
  };

  return createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
}
```

캐시 키에 포함된 값:

| 값 | 이유 |
| --- | --- |
| `ArchivePost` count | 게시글 추가/삭제 감지 |
| `ArchivePost.max(updatedAt)` | 게시글 수정 감지 |
| `UserGame` count | 플레이 기록 추가/삭제 감지 |
| `UserGame.max(updatedAt)` | 플레이 기록 변경 감지 |
| embedding model/dimensions | 벡터 기준 변경 감지 |
| chat model | LLM 분석 기준 변경 감지 |
| topK | RAG 검색 범위 변경 감지 |
| maxIterations | agent 검색 반복 수 변경 감지 |
| cache version | 코드 로직 변경 시 강제 무효화 |

### 5.3 Cache Hit

캐시 hit이면 전체 파이프라인을 건너뛰고 기존 결과를 반환한다.

```ts
private async getCachedRecommendationSync(
  userId: string,
  options: AgentSyncOptions,
  requestId: string,
  cached: AiRecommendationSyncResponse | null,
): Promise<AiRecommendationSyncResponse | null> {
  if (!cached) {
    return null;
  }

  const cacheKey = await this.buildRecommendationCacheKey(userId, options);

  if (
    cached.pipeline.cache?.key !== cacheKey ||
    cached.pipeline.cache.version !== RECOMMENDATION_CACHE_VERSION
  ) {
    return null;
  }

  const now = new Date().toISOString();

  return {
    ...cached,
    lastSyncAt: now,
    requestId,
    pipeline: {
      ...cached.pipeline,
      cache: {
        hit: true,
        key: cacheKey,
        version: RECOMMENDATION_CACHE_VERSION,
      },
    },
  };
}
```

캐시 hit 시 생략되는 작업:

```txt
RAG 분석 LLM
Agent planning LLM
IGDB 검색
추천 후보 생성
추천 근거 LLM
AiProfile에 새 결과 전체 재생성
```

단, `lastSyncAt`과 `requestId`는 새 요청 기준으로 갱신한다. 사용자가 sync를 눌렀다는 UI 상태는 유지하되, 실제 계산은 재사용한다.

## 6. API 응답 타입 변경

### 6.1 서버 pipeline cache metadata

파일: `server/src/ai/recommendation-contract.ts`

```ts
export type AiPipelineTrace = {
  cache?: {
    hit: boolean;
    key: string;
    version: string;
  };
  rag: {
    topK: number;
    sourceCount: number;
  };
  ...
};
```

### 6.2 프론트 job 타입

파일: `client/src/features/recommendations/types.ts`

```ts
export type AiRecommendationSyncJob = {
  completedAt: string | null
  error: string | null
  jobId: string
  requestId: string
  result: AiRecommendationSyncResponse | null
  startedAt: string | null
  status: 'completed' | 'failed' | 'pending' | 'running'
  userId: string
}
```

프론트는 `normalizeSyncJob()`으로 job 응답을 검증한다.

```ts
export function normalizeSyncJob(value: unknown): AiRecommendationSyncJob | null {
  if (!isJsonRecord(value)) {
    return null
  }

  const status = readString(value.status)

  if (
    status !== 'completed' &&
    status !== 'failed' &&
    status !== 'pending' &&
    status !== 'running'
  ) {
    return null
  }

  return {
    ...
    result: normalizeSyncResponse(value.result),
    status,
    ...
  }
}
```

## 7. 현재 구조의 한계

현재 job queue는 메모리 기반이다.

| 상황 | 현재 동작 |
| --- | --- |
| 페이지 이동 | 진행 유지 |
| 브라우저 새로고침 | `localStorage` job id로 polling 재개 |
| 서버 프로세스 유지 | job 상태 유지 |
| 서버 재시작 | 진행 중 job 상태 사라짐 |
| 여러 서버 인스턴스 | job 상태 공유 안 됨 |

운영형 구조로 확장하려면 Redis/BullMQ 같은 영속 queue가 필요하다.

또한 결과 캐시는 `ArchivePost`와 `UserGame` 변화 중심이다. IGDB 외부 데이터가 바뀌어도 즉시 캐시 무효화되지는 않는다. 시연/프로젝트 요구에는 적합하지만, 운영 서비스에서는 TTL도 함께 두는 편이 낫다.

## 8. 검증

수정 후 실행한 검증:

```bash
npm.cmd test -- --runInBand agent.service.spec.ts rag.service.spec.ts
npm.cmd run build
```

결과:

```txt
server tests passed
server build passed
client build passed
```

클라이언트 빌드는 일반 sandbox에서 `node_modules/.tmp`의 tsbuildinfo 쓰기 권한 문제로 실패했고, 동일 명령을 권한 상승으로 재실행해 통과했다. 코드 타입 오류는 없었다.

## 9. 전체 흐름

최종 sync 구조는 다음과 같다.

```txt
SYNC_DATA 클릭
  -> POST /ai/recommendations/sync
  -> 서버 job 생성 또는 기존 active job 반환
  -> 프론트는 jobId 저장 후 polling
  -> 서버 background job 실행
      -> AgentService.syncRecommendations
      -> lastRecommendationSync cache key 확인
      -> cache hit이면 즉시 cached result 반환
      -> cache miss이면 RAG/IGDB/LLM 전체 파이프라인 실행
      -> 결과 저장
  -> polling 완료
  -> 프론트 syncData 갱신
```

성능 관점에서 각 레이어 역할은 다음과 같다.

| 레이어 | 줄인 병목 |
| --- | --- |
| 임베딩 fresh 체크 | 최신 게시글 임베딩 재생성 방지 |
| batch embedding | 첫 sync에서 OpenAI embedding 요청 수 감소 |
| server job queue | 긴 sync 동안 UI/라우팅 블로킹 방지 |
| result cache | 데이터 변경 없는 재-sync에서 RAG/IGDB/LLM 전체 생략 |

## 10. 소스 범위

이 노트는 아래 파일을 기준으로 작성했다.

| 파일 | 내용 |
| --- | --- |
| `server/src/ai/rag.service.ts` | batch embedding, stale document 선별 |
| `server/src/ai/recommendation-sync-job.service.ts` | 메모리 기반 sync job queue |
| `server/src/ai/recommendations.controller.ts` | sync job API |
| `server/src/ai/ai.module.ts` | job service provider 등록 |
| `server/src/ai/agent.service.ts` | 분석/추천 결과 cache key 및 cache hit 처리 |
| `server/src/ai/recommendation-contract.ts` | pipeline cache metadata |
| `client/src/features/recommendations/useRecommendationSync.tsx` | polling, localStorage resume, 작은 진행 팝업 |
| `client/src/features/recommendations/types.ts` | sync job 타입 |
| `client/src/features/recommendations/normalize.ts` | sync job 응답 정규화 |
| `client/src/main.tsx` | 전역 RecommendationSyncProvider 연결 |

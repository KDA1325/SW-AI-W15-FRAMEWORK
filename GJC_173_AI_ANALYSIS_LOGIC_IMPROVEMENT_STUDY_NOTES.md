# GJC-173 AI 분석 로직 개선 학습 정리

## 1. 문제 상황

이번 대화에서 확인한 핵심 문제는 추천 페이지의 AI 분석 결과가 상황에 따라 일관되지 않다는 점이었다.

대표 증상은 다음과 같았다.

| 상황 | 관찰된 결과 |
| --- | --- |
| `EmbeddingDocument`를 삭제하고 첫 분석 | 한국어 분석 키워드가 비교적 정상적으로 나옴 |
| 임베딩 문서를 유지한 채 `SYNC_DATA` 재실행 | 플레이스타일/게임 요소 태그가 영어 키워드처럼 튀거나 품질이 낮아짐 |
| OpenAI 키가 있음 | 그래도 demo embedding 또는 fallback 경로가 섞일 수 있었음 |

결론적으로 문제는 단순히 프롬프트만의 문제가 아니라, **RAG 입력 범위**, **임베딩 fresh 판정**, **FastAPI demo embedding 우선 사용**, **fallback 조건 이해 부족**이 합쳐진 구조 문제였다.

## 2. 전체 분석 흐름

현재 추천 동기화는 다음 순서로 동작한다.

```txt
추천 페이지 SYNC_DATA
  -> POST /ai/recommendations/sync
  -> AgentService.syncRecommendations()
  -> RagService.analyzeForUser()
  -> ArchivePost 임베딩 생성 또는 재사용
  -> pgvector top-k 검색
  -> 전체 아카이브 요약 digest 추가
  -> OpenAI Chat Completions 분석
  -> 실패 시 deterministic fallback 분석
  -> Agent가 IGDB 후보 검색 및 추천 카드 생성
  -> LLM이 추천 근거 문장 생성
  -> AiProfile.lastRecommendationSync 저장
```

핵심 진입점은 `RagService.analyzeForUser()`다.

```ts
async analyzeForUser(
  userId: string,
  options: RagOptions = {},
): Promise<AiRagAnalysisResponse> {
  const topK = this.normalizeTopK(options.topK);
  const posts = await this.loadUserArchivePosts(userId);
  const playedGames = await this.loadUserGameRecords(userId);
  const refreshedDocuments =
    options.refreshEmbeddings === false
      ? 0
      : await this.refreshArchiveEmbeddings(posts);

  const queryText = this.buildPreferenceQuery(posts, playedGames);
  const queryEmbedding = await this.createEmbedding(queryText);
  const searchRows = await this.searchContextRows(
    userId,
    queryEmbedding.values,
    topK,
  );
  const archiveProfileRow = this.toArchiveProfileContextRow(userId, posts);
  const contextRows = [
    ...(archiveProfileRow ? [archiveProfileRow] : []),
    ...searchRows,
    ...playedGames.map((game) => this.toUserGameContextRow(game)),
  ];
  const analysis = await this.createAnalysis(contextRows);

  return {
    userId,
    generatedAt: new Date().toISOString(),
    ...analysis,
    contextSources: contextRows.map((row) => this.toContextSource(row)),
    embedding: {
      provider: queryEmbedding.provider,
      model: queryEmbedding.model,
      dimensions: queryEmbedding.dimensions,
      refreshedDocuments,
    },
  };
}
```

## 3. 첫 분석과 재분석의 차이

### 3.1 첫 분석

`EmbeddingDocument`가 없으면 `refreshArchiveEmbeddings(posts)`가 모든 게시글을 순회하면서 임베딩 문서를 만든다.

```ts
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

  const embedding = await this.createEmbedding(content);
  ...
}
```

첫 분석에서는 기존 문서가 없으므로 모든 게시글이 임베딩 대상이 된다.

### 3.2 재분석

재분석에서는 기존 문서를 재사용할 수 있다. 이때 fresh 판정이 정확해야 한다. 기존에는 글 내용과 `updatedAt`만 비교했기 때문에 demo embedding이 남아 있어도 재사용될 수 있었다.

수정 후 fresh 판정은 다음 조건까지 확인한다.

```ts
private isArchiveEmbeddingFresh(
  document: EmbeddingDocument | null,
  post: ArchivePostRow,
  content: string,
): document is EmbeddingDocument {
  if (!document || document.content !== content) {
    return false;
  }

  const expectedModel =
    this.config.get<string>('OPENAI_EMBEDDING_MODEL') ??
    'text-embedding-3-small';
  const expectedDimensions = Number(
    this.config.get<string>('OPENAI_EMBEDDING_DIMENSIONS') ??
      DEMO_EMBEDDING_DIMENSIONS,
  );
  const hasOpenAiKey = Boolean(this.config.get<string>('OPENAI_API_KEY'));

  if (hasOpenAiKey && document.metadata.provider === 'demo') {
    return false;
  }

  if (
    document.metadata.model !== expectedModel ||
    document.metadata.dimensions !== expectedDimensions
  ) {
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
}
```

이제 OpenAI 키가 있는데 기존 문서가 `provider: demo`이면 최신 문서로 보지 않는다. 즉 재동기화 때 OpenAI embedding으로 다시 만든다.

## 4. Demo Embedding이 섞이던 원인

`demo-hash-embedding-v1`은 OpenAI 없이 로컬 시연을 하기 위한 deterministic hash vector다.

```ts
export const DEMO_EMBEDDING_DIMENSIONS = 1536;
export const DEMO_EMBEDDING_MODEL = 'demo-hash-embedding-v1';

export function buildDemoEmbedding(seedText: string): number[] {
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

문제는 수정 전 `createEmbedding()`이 FastAPI `ai-compute` 응답을 OpenAI 키 여부와 상관없이 우선 채택했다는 점이다.

수정 전 개념:

```ts
const fastApiEmbedding = await this.aiComputeClient?.createEmbedding(...);

if (fastApiEmbedding) {
  return fastApiEmbedding;
}

if (!apiKey) {
  return this.createDemoEmbedding(text);
}
```

이 구조에서는 FastAPI가 `provider: demo`를 반환하면, Nest 서버에 OpenAI 키가 있어도 demo embedding을 그대로 저장할 수 있었다.

수정 후:

```ts
const fastApiEmbedding = await this.aiComputeClient?.createEmbedding({
  dimensions,
  input: embeddingInput,
  model,
});

if (fastApiEmbedding && !(apiKey && fastApiEmbedding.provider === 'demo')) {
  return {
    dimensions: fastApiEmbedding.dimensions,
    model: fastApiEmbedding.model,
    provider: fastApiEmbedding.provider,
    values: fastApiEmbedding.values,
  };
}

if (!apiKey) {
  return this.createDemoEmbedding(text);
}
```

의미:

| 조건 | 동작 |
| --- | --- |
| OpenAI 키 없음 + FastAPI demo 반환 | demo embedding 사용 |
| OpenAI 키 있음 + FastAPI openai 반환 | FastAPI 결과 사용 |
| OpenAI 키 있음 + FastAPI demo 반환 | FastAPI demo 버리고 Nest에서 OpenAI 직접 호출 |
| OpenAI 호출 실패 | demo embedding fallback |

이 변경으로 OpenAI 키가 있는 시연 환경에서 demo embedding이 조용히 섞이는 경로를 막았다.

## 5. Fallback의 의미

`fallback`은 OpenAI를 안 쓰겠다는 의미가 아니다. OpenAI 호출이 실패했을 때 서비스가 깨지지 않도록 둔 안전 경로다.

```ts
private async createAnalysis(
  searchRows: RagSearchRow[],
): Promise<RagAnalysisDraft> {
  const openAiAnalysis = await this.createOpenAiAnalysis(searchRows);
  return openAiAnalysis ?? this.createFallbackAnalysis(searchRows);
}
```

OpenAI 분석을 먼저 시도한다.

```ts
private async createOpenAiAnalysis(
  searchRows: RagSearchRow[],
): Promise<RagAnalysisDraft | null> {
  const apiKey = this.config.get<string>('OPENAI_API_KEY');

  if (!apiKey || searchRows.length === 0) {
    return null;
  }

  try {
    const response = await axios.post<OpenAiChatCompletionResponse>(
      'https://api.openai.com/v1/chat/completions',
      {
        messages: [
          {
            content:
              'You analyze one player profile from game reviews, journals, and play records. Return concise JSON...',
            role: 'system',
          },
          {
            content: this.analysisPrompt(searchRows),
            role: 'user',
          },
        ],
        model: this.config.get<string>('OPENAI_CHAT_MODEL') ?? 'gpt-4o-mini',
        response_format: this.analysisJsonSchema(),
      },
      ...
    );

    const content = response.data.choices?.[0]?.message?.content;

    if (!content) {
      return null;
    }

    return this.normalizeAnalysis(JSON.parse(content) as RagAnalysisDraft);
  } catch (error) {
    this.logger.warn(
      `OpenAI analysis failed; falling back to deterministic analysis. ${this.errorMessage(error)}`,
    );
    return null;
  }
}
```

fallback이 실행되는 경우:

| 조건 | 이유 |
| --- | --- |
| `OPENAI_API_KEY` 없음 | OpenAI 호출 불가 |
| 분석할 context row가 0개 | LLM에 줄 근거 없음 |
| OpenAI API 실패 | 네트워크, 인증, billing, 모델 오류 등 |
| 응답 content 없음 | 구조화 응답 실패 |
| JSON parse 실패 | LLM 응답 형식 오류 |

즉 정상 상황에서는 OpenAI 분석 결과를 사용한다. fallback은 시연 안정성을 위한 방어 코드다.

## 6. Top-k만 보던 문제와 전체 아카이브 Digest

처음에는 RAG 검색 결과 `topK: 6`만 LLM 분석에 강하게 들어갔다. 사용자가 40개 가까이 게시글을 쓴 경우에도 6개 문서만 보면 전체 반복 성향을 놓칠 수 있다.

그래서 `topK`를 12로 늘렸다.

```ts
const DEFAULT_TOP_K = 12;
const MAX_TOP_K = 12;
```

클라이언트 요청도 같이 수정했다.

```ts
const response = await api.post<unknown>('/ai/recommendations/sync', {
  forceRefresh: true,
  requestId: `gjc-web-sync-${Date.now()}`,
  topK: 12,
});
```

하지만 top-k를 늘리는 것만으로는 충분하지 않다. 벡터 검색은 “질의와 가까운 문서”를 고르기 때문에 전체 반복 패턴을 보장하지 않는다. 그래서 모든 게시글을 요약한 `ARCHIVE_PROFILE_DIGEST`를 분석 컨텍스트 앞에 추가했다.

```ts
const archiveProfileRow = this.toArchiveProfileContextRow(userId, posts);
const contextRows = [
  ...(archiveProfileRow ? [archiveProfileRow] : []),
  ...searchRows,
  ...playedGames.map((game) => this.toUserGameContextRow(game)),
];
```

digest 생성 로직:

```ts
private toArchiveProfileContextRow(
  userId: string,
  posts: ArchivePostRow[],
): RagSearchRow | null {
  if (posts.length === 0) {
    return null;
  }

  const positivePosts = posts.filter(
    (post) => post.type === 'JOURNAL' || (post.rating ?? 0) >= 3.5,
  );
  const evidencePosts = (positivePosts.length > 0 ? positivePosts : posts)
    .slice()
    .sort((left, right) => {
      const ratingDelta = (right.rating ?? 0) - (left.rating ?? 0);
      return ratingDelta !== 0
        ? ratingDelta
        : right.updatedAt.getTime() - left.updatedAt.getTime();
    });

  const content = [
    'ARCHIVE_PROFILE_DIGEST',
    `Total archive posts: ${posts.length}`,
    `Positive/relevant posts summarized: ${evidencePosts.length}`,
    `Repeated genres: ${genreCounts.join(', ') || 'none'}`,
    `Repeated game tags: ${tagCounts.join(', ') || 'none'}`,
    'Use this digest to identify broad repeated player patterns across every archive post.',
    'Evidence:',
    ...evidenceLines,
  ].join('\n');

  return {
    content:
      content.length > MAX_ARCHIVE_DIGEST_CHARS
        ? content.slice(0, MAX_ARCHIVE_DIGEST_CHARS)
        : content,
    metadata: {
      gameTitle: null,
      title: 'Archive profile digest',
    },
    similarity: 1,
    sourceId: userId,
    sourceType: 'AI_PROFILE',
  };
}
```

이 digest는 top-k 문서가 놓치는 전체 취향 반복 신호를 보완한다.

## 7. 플레이스타일과 게임 요소 태그 분리

분석 결과에서 `wordCloud`와 `preferenceTags`가 비슷하게 나오는 문제가 있었다. 개념을 다음처럼 분리했다.

| 필드 | 의미 | 예시 |
| --- | --- | --- |
| `wordCloud` | 사용자가 어떻게 플레이하는지 | 파밍 루프, 사냥 중심, 탱커 역할, 솔로 문제 해결 |
| `preferenceTags` | 어떤 게임 요소를 좋아했는지 | 제작/장비 성장, 스토리 중심, 공포 분위기, 전술 전투 |

프롬프트에서도 이 구분을 명시했다.

```ts
return [
  'Extract two different analysis layers.',
  '- First read ARCHIVE_PROFILE_DIGEST if present; it summarizes the user across all archive posts, not only top-k vector hits.',
  '- preferenceTags: enjoyed game features from positively rated/repeated games, for example STORY_RICH, CRAFTING, HORROR_ATMOSPHERE, COZY_SIM.',
  '- wordCloud: player behavior from review/journal wording, for example FARMING_LOOP, TANK_ROLE, AESTHETIC_EXPLORER, SOLO_PLANNER, COOP_TEAMPLAYER.',
  '- Prefer concrete actions, roles, pace, and motivations for wordCloud; prefer game mechanics, genre, theme, mood, and presentation for preferenceTags.',
  'Do not copy the same labels into both arrays unless the evidence truly names both a game feature and a play behavior. Avoid generic labels when specific evidence exists.',
  'Write playStyleSummary as one polite formal Korean sentence. Do not use 반말, 해요체, or casual endings.',
  '',
  sourceText,
].join('\n');
```

## 8. 한국어 fallback 키워드 보강

OpenAI 분석이 실패하면 deterministic fallback이 실행된다. 기존 fallback은 영어 키워드 중심이라 한국어 리뷰/저널에 약했다.

예시 수정:

```ts
{
  category: 'mechanic',
  label: 'FARMING_LOOP',
  terms: ['farming', 'grind', 'routine', 'harvest', 'repeat', '파밍', '반복', '수확', '노가다'],
},
{
  category: 'mechanic',
  label: 'HUNTING_LOOP',
  terms: ['hunt', 'boss', 'monster', 'pattern', 'gear progression', '사냥', '보스', '몬스터', '패턴', '장비 성장'],
},
{
  category: 'mechanic',
  label: 'TANK_ROLE',
  terms: ['tank', 'defense', 'shield', 'frontline', 'aggro', '탱커', '방어', '방패', '전열', '어그로'],
},
```

이 변경은 OpenAI를 대체하려는 목적이 아니라, OpenAI 실패 시에도 결과가 지나치게 무의미해지는 것을 막기 위한 방어다.

## 9. 시연 초기화 SQL과 의미

완전 첫 분석 상태를 재현하려면 다음 SQL을 사용할 수 있다.

```sql
DELETE FROM "EmbeddingDocument";

UPDATE "AiProfile"
SET
  "lastRecommendationSync" = NULL,
  "playStyleSummary" = NULL,
  "favoriteKeywords" = ARRAY[]::text[],
  "favoriteGenres" = ARRAY[]::text[],
  "lastAnalyzedAt" = NULL,
  "updatedAt" = now();
```

의미:

| SQL | 효과 |
| --- | --- |
| `DELETE FROM "EmbeddingDocument"` | 기존 RAG 벡터 문서를 모두 제거하고 첫 분석처럼 다시 임베딩하게 함 |
| `lastRecommendationSync = NULL` | 추천 페이지 첫 진입 시 이전 추천 스냅샷이 보이지 않게 함 |
| `playStyleSummary = NULL` | 이전 분석 요약 제거 |
| `favoriteKeywords`, `favoriteGenres` 초기화 | 이전 분석 태그 제거 |
| `lastAnalyzedAt = NULL` | 아직 분석하지 않은 상태처럼 표시 |

일반 운영에서는 `EmbeddingDocument`를 삭제하지 않는 것이 효율적이다. 다만 시연에서 “처음부터 임베딩하고 분석하는 흐름”을 보여주려면 삭제해도 된다.

## 10. 검증 테스트

이번 개선은 테스트로 고정했다.

```ts
it('refreshes old demo embeddings when OpenAI embeddings are configured', async () => {
  ...
  const config = {
    get: jest.fn((key: string) =>
      key === 'OPENAI_API_KEY' ? 'test-key' : undefined,
    ),
  };
  ...
  expect(refreshed).toBe(1);
  expect(aiComputeClient.createEmbedding).toHaveBeenCalledTimes(1);
  expect(repository.save).toHaveBeenCalledTimes(1);
});
```

이 테스트는 OpenAI 키가 있는 상태에서 기존 demo embedding이 fresh로 재사용되지 않고 갱신되는지 확인한다.

전체 아카이브 digest도 테스트했다.

```ts
it('summarizes every archive post into a profile digest for analysis', () => {
  ...
  expect(row?.sourceType).toBe('AI_PROFILE');
  expect(row?.content).toContain('ARCHIVE_PROFILE_DIGEST');
  expect(row?.content).toContain('Total archive posts: 2');
  expect(row?.content).toContain('Monster Hunter');
  expect(row?.content).toContain('Disco Elysium');
});
```

한국어 fallback 키워드도 테스트했다.

```ts
it('uses Korean review wording in deterministic fallback analysis', () => {
  ...
  expect(preferenceLabels).toEqual(expect.arrayContaining(['CRAFTING']));
  expect(styleLabels).toEqual(
    expect.arrayContaining(['FARMING_LOOP', 'HUNTING_LOOP']),
  );
});
```

실행한 검증:

```bash
npm.cmd test -- --runInBand rag.service.spec.ts
npm.cmd run build
```

결과:

```txt
rag.service.spec.ts passed
server build passed
```

## 11. 핵심 결론

이번 개선의 핵심은 다음이다.

1. OpenAI 키가 있더라도 FastAPI가 demo embedding을 반환하면 품질이 깨질 수 있었다.
2. 기존 `EmbeddingDocument` fresh 판정이 provider/model/dimensions를 보지 않아 demo 벡터가 계속 재사용될 수 있었다.
3. RAG top-k만으로는 사용자의 전체 게시글 취향을 대표하기 어렵다.
4. `ARCHIVE_PROFILE_DIGEST`를 추가해 전체 게시글 반복 신호를 LLM 분석에 넣었다.
5. `wordCloud`는 플레이 행동, `preferenceTags`는 좋아한 게임 요소로 분리해야 한다.
6. fallback은 OpenAI를 안 쓰기 위한 로직이 아니라 장애 시 시연이 깨지지 않도록 하는 안전장치다.

## 12. 소스 범위

이 노트는 다음 파일과 이번 대화에서 설명한 코드 조각을 기준으로 작성했다.

| 파일 | 사용한 내용 |
| --- | --- |
| `server/src/ai/rag.service.ts` | RAG 분석 흐름, embedding 생성, fresh 판정, OpenAI/fallback 분석, archive digest |
| `server/src/ai/ai-compute.client.ts` | FastAPI `/embed` 응답 구조와 provider 기본값 |
| `server/src/ai/demo-embedding.ts` | demo hash embedding 생성 방식 |
| `client/src/features/recommendations/useRecommendationSync.ts` | `forceRefresh: true`, `topK: 12` 요청 |
| `server/src/ai/rag.service.spec.ts` | demo embedding 갱신, archive digest, 한국어 fallback 회귀 테스트 |

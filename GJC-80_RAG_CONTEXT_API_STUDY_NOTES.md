# GJC-80 RAG Context API 구현 학습 정리

## 1. 작업 범위

이번 노트는 `GJC-80 [P0-03][RAG] 일지/리뷰 임베딩 검색 및 취향 분석 API 구현` 작업에서 변경한 아래 파일을 기준으로 정리한다.

- `server/.env.example`
- `server/README.md`
- `server/src/app.module.ts`
- `server/src/ai/ai.module.ts`
- `server/src/ai/demo-embedding.ts`
- `server/src/ai/rag.controller.ts`
- `server/src/ai/rag.service.ts`
- `server/src/ai/recommendation-contract.ts`
- `server/src/database/demo-seed.service.ts`

핵심 목표는 로그인 사용자의 저널/리뷰를 RAG source로 만들고, pgvector top-k 검색 결과를 `preferenceTags`, `playStyleSummary`, `wordCloud`, `contextSources` JSON으로 반환하는 것이다.

## 2. demo embedding 유틸을 공용화했다

GJC-164 seed와 GJC-80 RAG fallback이 같은 벡터 규칙을 써야 로컬 검색이 안정적으로 재현된다. 그래서 deterministic embedding 함수를 `server/src/ai/demo-embedding.ts`로 분리했다.

```ts
export function buildDemoEmbedding(seedText: string): number[] {
  // This deterministic vector is only for local fallback data; real RAG uses the configured embedding model.
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

이 함수는 실제 임베딩 모델이 아니다. `OPENAI_API_KEY`가 없을 때도 pgvector 컬럼과 top-k 검색 흐름을 로컬에서 검증하기 위한 fallback이다.

## 3. RAG API는 userId를 쿼리로 받지 않는다

컨트롤러는 `/ai/rag/context`를 제공한다.

```ts
@UseGuards(JwtAuthGuard)
@Controller('ai/rag')
export class RagController {
  @Get('context')
  getContext(
    @Req() req: AuthedRequest,
    @Query('refreshEmbeddings') refreshEmbeddings?: string,
    @Query('topK') topK?: string,
  ) {
    // Agent and React callers use the same user-scoped RAG context, while JWT keeps userId out of the public query string.
    return this.ragService.analyzeForUser(req.user.userId, {
      refreshEmbeddings: refreshEmbeddings !== 'false',
      topK: this.parseTopK(topK),
    });
  }
}
```

주석의 핵심은 보안 경계다. 프론트나 Agent caller가 `userId`를 보내면 다른 사용자의 데이터 요청을 시도할 수 있다. 그래서 기존 게시글 API처럼 JWT에서 현재 사용자만 읽는다.

## 4. RAG 처리 흐름

`RagService.analyzeForUser()`는 한 요청 안에서 네 단계를 실행한다.

```ts
const posts = await this.loadUserArchivePosts(userId);
const refreshedDocuments =
  options.refreshEmbeddings === false
    ? 0
    : await this.refreshArchiveEmbeddings(posts);

const queryText = this.buildPreferenceQuery(posts);
const queryEmbedding = await this.createEmbedding(queryText);
const searchRows = await this.searchContextRows(
  userId,
  queryEmbedding.values,
  topK,
);
const analysis = await this.createAnalysis(searchRows);
```

전체 흐름:

```text
ArchivePost + Game 조회
  -> EmbeddingDocument 동기화
  -> query embedding 생성
  -> pgvector top-k 검색
  -> OpenAI structured analysis 또는 fallback analysis
  -> AiRagAnalysisResponse 반환
```

## 5. archive post를 EmbeddingDocument로 동기화한다

저널/리뷰 원문은 `EmbeddingDocument`에 저장되고, 실제 vector 컬럼은 pgvector raw SQL로 갱신한다.

```ts
document.sourceType = EmbeddingSourceType.ARCHIVE_POST;
document.sourceId = post.id;
document.content = content;
document.metadata = {
  dimensions: embedding.dimensions,
  gameTitle: post.gameTitle,
  model: embedding.model,
  provider: embedding.provider,
  title: post.title,
  updatedAt: post.updatedAt,
};

const savedDocument = await repository.save(document);

await this.dataSource.query(
  `
    UPDATE "EmbeddingDocument"
    SET "embedding" = $1::vector
    WHERE "id" = $2
  `,
  [toPgVectorLiteral(embedding.values), savedDocument.id],
);
```

TypeORM 엔티티는 `embedding` 컬럼을 직접 매핑하지 않는다. 그래서 일반 컬럼은 repository로 저장하고, vector 컬럼만 raw SQL로 처리한다.

## 6. OpenAI가 없으면 demo embedding으로 fallback한다

OpenAI key가 있으면 공식 Embeddings API에 맞춰 `text-embedding-3-small`을 호출한다. key가 없거나 호출에 실패하면 demo embedding을 사용한다.

```ts
private async createEmbedding(text: string): Promise<EmbeddingResult> {
  const apiKey = this.config.get<string>('OPENAI_API_KEY');
  const model =
    this.config.get<string>('OPENAI_EMBEDDING_MODEL') ??
    'text-embedding-3-small';

  if (!apiKey) {
    return this.createDemoEmbedding(text);
  }

  try {
    const response = await axios.post<OpenAiEmbeddingResponse>(
      'https://api.openai.com/v1/embeddings',
      payload,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );

    return {
      dimensions: values.length,
      model: response.data.model ?? model,
      provider: 'openai',
      values,
    };
  } catch {
    return this.createDemoEmbedding(text);
  }
}
```

이 구조 덕분에 API key가 없는 팀원도 DB/RAG 흐름을 검증할 수 있고, key가 있는 환경에서는 같은 endpoint가 실제 임베딩으로 갱신된다.

## 7. pgvector top-k 검색

사용자의 `ArchivePost`와 연결된 embedding 문서만 검색한다.

```ts
SELECT
  ed."sourceType",
  ed."sourceId",
  ed.content,
  ed.metadata,
  1 - (ed.embedding <=> $1::vector) AS similarity
FROM "EmbeddingDocument" ed
INNER JOIN "ArchivePost" post
  ON ed."sourceType" = 'ARCHIVE_POST'
  AND ed."sourceId" = post.id
WHERE post."userId" = $2
  AND ed.embedding IS NOT NULL
ORDER BY ed.embedding <=> $1::vector ASC
LIMIT $3
```

`<=>`는 cosine distance 연산자다. 거리가 작을수록 비슷하므로 `ORDER BY ed.embedding <=> query ASC`로 top-k를 구한다. 응답에서는 보기 쉽게 `1 - distance`를 similarity로 내려준다.

## 8. 분석 JSON은 OpenAI structured output 또는 fallback으로 만든다

OpenAI key가 있으면 `response_format.type = json_schema`로 구조화된 JSON을 요청한다.

```ts
response_format: {
  type: 'json_schema',
  json_schema: {
    name: 'gjc_rag_taste_analysis',
    strict: true,
    schema: {
      type: 'object',
      required: ['preferenceTags', 'playStyleSummary', 'wordCloud'],
      properties: {
        preferenceTags: { type: 'array' },
        playStyleSummary: { type: 'string' },
        wordCloud: { type: 'array' },
      },
    },
  },
}
```

OpenAI 호출이 없거나 실패하면 rule-based fallback이 context source의 단어를 세어 태그와 워드클라우드를 만든다.

```ts
const preferenceTags = fallback.slice(0, 6).map((item) => ({
  label: item.label,
  sourceCount: item.sourceCount,
  weight: item.weight,
}));

const wordCloud = fallback.slice(0, 10).map((item) => ({
  category: item.category,
  label: item.label.replaceAll('_', ' '),
  sourceCount: item.sourceCount,
  weight: item.weight,
}));
```

## 9. 응답 계약

GJC-80은 `AiRagAnalysisResponse` 타입을 추가했다.

```ts
export type AiRagAnalysisResponse = {
  userId: string;
  generatedAt: string;
  preferenceTags: AiPreferenceTag[];
  playStyleSummary: string;
  wordCloud: AiWordCloudTerm[];
  contextSources: AiRagContextSource[];
  embedding: {
    provider: AiRagEmbeddingProvider;
    model: string;
    dimensions: number;
    refreshedDocuments: number;
  };
};
```

`preferenceTags`, `playStyleSummary`, `wordCloud`, `contextSources`는 다음 Agent 이슈에서 그대로 입력으로 쓸 수 있다. `embedding` 필드는 디버그와 데모 설명용이다.

## 10. 검증 결과

빌드와 테스트:

```text
npm.cmd run build
npm.cmd test -- --runInBand
```

RAG service 직접 호출 결과:

```json
{
  "tags": 6,
  "words": 6,
  "sources": 3,
  "provider": "demo",
  "refreshed": 3,
  "firstSource": "Boss patterns feel fair when the rules are visible"
}
```

현재 `.env`에 `OPENAI_API_KEY`가 없기 때문에 provider는 `demo`로 확인됐다. key를 넣으면 같은 API가 OpenAI embedding과 structured JSON analysis를 시도한다.

# GJC-173 AI 추천 세션 학습 정리

## 1. 이번 세션의 전체 흐름

이번 세션에서는 추천 페이지를 시연 가능한 상태로 만들기 위해 데이터 초기화, 데이터셋 검증, RAG 분석 분리, IGDB 추천 품질 개선, LLM 응답 생성, 화면 표시 개선, OpenAI 오류 대응까지 순서대로 점검했다.

핵심 목표는 단순히 추천 카드가 뜨는 것이 아니라, 다음 네 가지가 사용자가 보기에 설득력 있게 동작하도록 만드는 것이었다.

| 영역 | 목표 |
| --- | --- |
| RAG | 유저의 리뷰/저널/플레이 기록에서 분석 근거를 가져온다. |
| LLM 모델 | 분석 요약과 추천 근거 문장을 생성한다. |
| AI Agent | 분석 결과를 바탕으로 IGDB 검색 후보를 반복적으로 수집하고 추천 목록을 만든다. |
| MCP/외부 도구 개념 | IGDB 같은 외부 게임 데이터 소스를 도구처럼 사용해 추천 후보를 가져온다. |

## 2. 시연 초기화 SQL

시연을 위해 기존 임베딩 문서와 AI 프로필 분석 결과를 초기화했다.

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

이 초기화는 추천 결과를 새로 생성하게 만들기 위한 작업이다. `EmbeddingDocument`를 비우면 RAG 검색에 쓰는 벡터 문서를 다시 만들 수 있고, `AiProfile`의 동기화 결과를 비우면 추천 페이지에서 최신 분석을 다시 수행하게 된다.

## 3. 데이터셋 평점 검증

처음에는 데이터셋에 `0.2`, `0.8` 같은 점수 리뷰가 남아 있는지 의심했다. 점검 결과 파일 데이터는 1~5점 또는 0.5 단위에 맞춰져 있었지만, DB의 `ArchivePost.rating`에는 예전 값인 `1.8`, `2.2`, `3.2`, `4.2`, `4.8` 같은 값이 남아 있었다.

따라서 파일만 볼 것이 아니라 실제 시연 DB 상태까지 확인해야 한다는 점이 중요했다. 추천 분석은 파일이 아니라 DB에 적재된 리뷰/저널을 기준으로 동작하기 때문이다.

## 4. 플레이 스타일과 게임 요소 태그 분리

사용자가 지적한 문제는 추천 페이지의 두 분석 영역이 사실상 같은 결과를 보여준다는 점이었다.

### 4.1 개념 차이

| 항목 | 의미 | 예시 |
| --- | --- | --- |
| 플레이 스타일 | 사용자가 게임을 어떻게 플레이하는지 | 탱커 역할 선호, 파밍 루프, 솔로 문제 해결, 미적 탐험 |
| 게임 요소 태그 | 사용자가 어떤 게임 요소를 좋아했는지 | 스토리 중심, 제작/장비 성장, 공포 분위기, 전술 전투 |

즉, 같은 리뷰를 보더라도 "이 게임의 제작 시스템이 좋았다"는 게임 요소 태그이고, "반복적으로 재료를 모으고 장비를 성장시키는 플레이를 즐긴다"는 플레이 스타일이다.

### 4.2 RAG 분석 프롬프트 수정

`server/src/ai/rag.service.ts`에서 LLM에게 두 필드의 의미를 명확히 구분하도록 지시했다.

```ts
// server/src/ai/rag.service.ts
content:
  'You analyze video game journal and review excerpts. Return concise JSON for a recommendation RAG context. ' +
  'Write playStyleSummary in polite formal Korean only, ending naturally with 합니다, 습니다, or 니다. ' +
  'Never use casual speech or 반말. ' +
  'Keep preferenceTags and wordCloud distinct: preferenceTags are enjoyed game elements such as genre, theme, mechanics, and presentation; ' +
  'wordCloud terms are player behavior/style patterns such as role, activity, pace, motivation, and social pattern.';
```

또한 사용자 프롬프트에도 같은 구분을 반복했다.

```ts
return [
  'Analyze the retrieved sources into two different Korean recommendation signals.',
  '- preferenceTags: why positively rated/repeated games were enjoyable, for example STORY_RICH, CRAFTING, HORROR_ATMOSPHERE, COZY_SIM.',
  '- wordCloud: how the user tends to play, for example FARMING_LOOP, TANK_ROLE, AESTHETIC_EXPLORER, SOLO_PLANNER, COOP_TEAMPLAYER.',
  'Do not copy the same labels into both arrays unless the evidence truly names both a game feature and a play behavior.',
  'Write playStyleSummary as one polite formal Korean sentence. Do not use 반말, 해요체, or casual endings.',
  '',
  sourceText,
].join('\n');
```

## 5. 한글 표시 개선

추천 페이지에서 내부 분석 라벨이 영어 코드처럼 보이면 시연 때 이해가 어렵다. 그래서 클라이언트에서 분석 라벨을 한글로 매핑했다.

```tsx
// client/src/pages/Recommend.tsx
function analysisLabelKo(label: string) {
  const normalized = label.trim().replaceAll(' ', '_').toUpperCase()
  const labels: Record<string, string> = {
    AESTHETIC_EXPLORER: '미적 탐험 성향',
    CRAFTING: '제작과 장비 성장',
    FARMING_LOOP: '파밍 루프',
    STORY_DRIVEN: '스토리 중심 구성',
    TANK_ROLE: '탱커 역할 선호',
  }

  return labels[normalized] ?? normalizeLabel(label)
}
```

실제 파일에는 더 많은 라벨이 들어 있다. 핵심은 서버가 `FARMING_LOOP`처럼 안정적인 분석 코드를 내려주고, 화면에서는 사용자가 읽기 쉬운 한글 표현으로 바꾼다는 점이다.

## 6. 게임 요소 태그 개수와 추천 카드 태그

게임 요소 태그가 너무 적게 보이는 문제도 있었다. 추천 페이지에서는 `preferenceTags`를 최대 14개까지 보여주도록 하고, 추천 카드 하단 태그도 항상 더 잘 보이도록 보완했다.

```tsx
// client/src/pages/Recommend.tsx
const visibleTags = useMemo(
  () => syncData?.preferenceTags.slice(0, 14) ?? [],
  [syncData?.preferenceTags],
)
```

추천 카드 하단 태그는 우선 `matchedTags`를 사용한다. 그런데 매칭 태그가 없는 게임은 하단 태그가 비어 보일 수 있으므로, 이 경우 게임 자체의 `tags`와 `genres`를 fallback으로 사용한다.

```tsx
// client/src/pages/Recommend.tsx
function recommendationCardTags(card: AiRecommendationCard) {
  const labels =
    card.matchedTags.length > 0
      ? card.matchedTags
      : [...card.tags, ...card.genres]

  return [...new Set(labels)].slice(0, 3)
}
```

이 태그들은 "왜 이 게임이 추천 카드에 올라왔는지"를 짧게 보여주는 근거 태그다. 붙는 게임과 안 붙는 게임이 있었던 이유는 기존에는 `matchedTags`가 없는 경우 화면에 표시할 fallback이 없었기 때문이다.

## 7. 추천 근거 문장: 템플릿에서 LLM 생성으로

처음에는 추천 근거를 단순 템플릿으로 만들었다.

```ts
return `분석 결과 ${title}은(는) ${nickname}님의 ${signal || '플레이 성향'}와 잘 맞는 게임이라 추천합니다.`;
```

하지만 사용자는 추천 게임마다 문장이 다르게 나오기를 원했다. 그래서 `AgentService`에서 추천 카드 목록을 만든 뒤, OpenAI Chat Completions로 각 카드의 추천 이유를 다시 생성하도록 바꿨다.

```ts
// server/src/ai/agent.service.ts
const rankedRecommendations = state.recommendations
  .slice(0, MIN_RECOMMENDATION_COUNT)
  .map((recommendation, index) => ({
    ...recommendation,
    rank: index + 1,
  }));

const recommendations = await this.generateRecommendationReasons(
  rankedRecommendations,
  ragContext,
  nickname,
);
```

LLM 호출은 실패해도 추천 기능 전체가 깨지지 않도록 fallback을 유지한다.

```ts
private async generateRecommendationReasons(
  recommendations: AiRecommendationCard[],
  ragContext: AiRagAnalysisResponse,
  nickname: string,
): Promise<AiRecommendationCard[]> {
  const apiKey = this.config.get<string>('OPENAI_API_KEY');

  if (!apiKey || recommendations.length === 0) {
    return recommendations;
  }

  try {
    // OpenAI chat completions call
    // rank별 reason JSON을 받아 카드 reason에 반영한다.
  } catch {
    return recommendations;
  }
}
```

여기서 중요한 설계는 "추천 후보 선정"과 "추천 근거 문장 생성"을 분리한 것이다. IGDB 후보를 고르고 랭킹을 매기는 로직은 Agent가 담당하고, 자연스러운 한국어 문장은 LLM이 담당한다.

## 8. 말투 통일: 항상 격식체

추천 페이지 상단의 한 줄 AI 분석 결과와 추천 카드 문장이 갑자기 반말로 나오면 서비스 톤이 깨진다. 그래서 RAG 분석과 추천 근거 생성 프롬프트 모두에 격식체 제약을 추가했다.

```ts
// server/src/ai/agent.service.ts
content:
  'You write short Korean recommendation comments for a game recommendation UI. ' +
  'Return only JSON. Make each reason distinct, warm, concise, and polite formal Korean. ' +
  'Every reason must end naturally with 합니다, 습니다, or 니다. ' +
  'Never use casual speech or 반말.';
```

프롬프트 레벨에서 말투를 강하게 제한해도 LLM이 항상 100% 지키는 것은 아니지만, 시연 품질을 높이는 데 효과적이다. 더 엄격하게 하려면 후처리 검증으로 문장 끝을 검사하는 방법도 가능하다.

## 9. IGDB 추천 품질 검증

추천 결과에 IGDB 평가도 없고 태그도 거의 없는 무명 게임이 섞이는 문제가 있었다. 이는 추천 후보를 가져온 뒤 품질 필터가 약하면 발생할 수 있다.

세션에서 정리한 기준은 다음과 같다.

| 기준 | 이유 |
| --- | --- |
| cover 존재 | 시연 카드가 비어 보이지 않게 한다. |
| sourceUrl 존재 | IGDB에서 확인 가능한 게임이어야 한다. |
| summary 길이 | 설명이 거의 없는 게임은 추천 근거가 약하다. |
| genres/platforms/tags 존재 | 분석 태그와 매칭할 정보가 있어야 한다. |
| totalRating 기준 | 다른 사용자 평가가 너무 부족한 게임을 줄인다. |

이 작업의 목적은 "AI가 추천했다"가 아니라, "검증 가능한 외부 데이터와 사용자의 분석 결과를 연결했다"는 설득력을 만드는 것이다.

## 10. OpenAI 키 추가 후 동작 방식

OpenAI 키가 없을 때는 다음 기능들이 fallback으로 동작했다.

| 기능 | 키가 없을 때 | 키가 있을 때 |
| --- | --- | --- |
| Embedding | demo embedding 사용 | OpenAI embeddings 사용 |
| 분석 요약 | deterministic fallback 분석 | LLM 분석 JSON 사용 |
| 추천 근거 | 기존 reason/fallback 문장 | LLM이 카드별 문장 생성 |

따라서 `.env`에 `OPENAI_API_KEY`가 추가되면 추천 결과 분석과 추천 근거 생성에 LLM이 실제로 개입한다. 다만 외부 API 호출이 실패하면 시연이 완전히 깨지지 않도록 fallback 경로가 유지된다.

## 11. OpenAI Embedding 400 오류 대응

마지막에 서버 로그에서 다음 경고가 나왔다.

```txt
WARN [RagService] OpenAI embedding failed; falling back to demo embedding. Request failed with status code 400
```

이는 키가 없다는 의미가 아니라, OpenAI Embeddings API가 요청을 400으로 거절했다는 뜻이다. 원인으로 가장 가능성이 높았던 것은 리뷰/저널/플레이 기록을 한 번에 합친 긴 query text가 임베딩 입력 제한을 넘는 경우였다.

그래서 OpenAI로 보내기 전에 공백을 정규화하고 길이를 제한했다.

```ts
// server/src/ai/rag.service.ts
const MAX_EMBEDDING_INPUT_CHARS = 12000;

private truncateEmbeddingInput(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized.length > MAX_EMBEDDING_INPUT_CHARS
    ? normalized.slice(0, MAX_EMBEDDING_INPUT_CHARS)
    : normalized;
}
```

그리고 실제 요청에는 원문 대신 잘린 입력을 사용한다.

```ts
const embeddingInput = this.truncateEmbeddingInput(text);
const payload: Record<string, unknown> = {
  encoding_format: 'float',
  input: embeddingInput,
  model,
};
```

오류 메시지도 더 자세히 남기도록 바꿨다.

```ts
private errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const apiMessage = (
      error.response?.data as
        | { error?: { message?: string } }
        | undefined
    )?.error?.message;
    const message = apiMessage ?? error.message;

    return status ? `HTTP ${status}: ${message}` : message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
}
```

이제 같은 문제가 다시 나면 `HTTP 400: ...` 형태로 OpenAI가 준 실제 이유까지 확인할 수 있다.

## 12. 페르소나 3 데이터 표시 문제

페르소나 3만 리뷰/저널 데이터가 표시되지 않는다는 문제도 확인했다. DB에는 페르소나 3 데이터가 존재했고, 계정 정보 혼동 가능성이 있었다.

정리된 시연 계정은 다음 기준으로 봐야 한다.

| 항목 | 값 |
| --- | --- |
| 이메일 | `test3@test.com` |
| 비밀번호 | `personatest3` |
| 닉네임 | `콜사인랠리포인트` |
| 데이터 | 리뷰 13개, 저널 7개 |

예전 QA 메모나 import payload에 다른 이메일/비밀번호가 남아 있으면, 그 계정으로 로그인했을 때 데이터가 없는 것처럼 보일 수 있다. 데이터 자체가 사라진 문제라기보다는 시연 계정 기준을 맞춰야 하는 문제였다.

## 13. 전체 데이터 흐름

```txt
리뷰/저널/플레이 기록
  -> ArchivePost, UserGameRecord
  -> EmbeddingDocument 생성
  -> 현재 유저 기준 RAG 검색
  -> LLM 또는 fallback 분석
      - playStyleSummary
      - wordCloud: 플레이 스타일
      - preferenceTags: 게임 요소 태그
  -> AgentService가 IGDB 후보 검색
  -> 품질 필터 및 랭킹
  -> LLM이 카드별 추천 근거 생성
  -> AiProfile.lastRecommendationSync 저장
  -> Recommend 페이지 표시
```

## 14. 검증한 명령

이번 세션의 마지막 코드 수정 후 다음 검증을 통과했다.

```bash
npm.cmd test -- --runInBand agent.service.spec.ts rag.service.spec.ts
npm.cmd run build
```

결과:

```txt
Test Suites: 2 passed, 2 total
Tests: 5 passed, 5 total
server build passed
```

## 15. 남은 주의점

1. LLM 출력은 프롬프트로 제어하고 있으므로, 정말 엄격한 말투 보장이 필요하면 후처리 검증을 추가하는 것이 좋다.
2. OpenAI API 400이 다시 발생하면 이제 더 구체적인 로그가 남으므로, 그 메시지 기준으로 모델명, dimensions, 입력 크기, billing 상태 등을 추가 확인해야 한다.
3. 추천 카드의 태그는 `matchedTags`가 가장 강한 근거이고, 없을 때만 게임 메타데이터의 `tags`/`genres`를 fallback으로 보여준다.
4. 시연 전에는 항상 `EmbeddingDocument`와 `AiProfile` 초기화 후, 올바른 페르소나 계정으로 로그인했는지 확인해야 한다.

## 16. 소스 범위

이 노트는 이번 세션의 대화 내용과 아래 변경/점검 범위를 기준으로 작성했다.

| 파일 또는 영역 | 사용한 내용 |
| --- | --- |
| `server/src/ai/rag.service.ts` | RAG 분석, OpenAI embedding, fallback 분석, 격식체 프롬프트, 오류 로그 개선 |
| `server/src/ai/agent.service.ts` | 추천 Agent 흐름, LLM 추천 근거 생성, JSON schema 응답 |
| `client/src/pages/Recommend.tsx` | 한글 라벨 표시, 게임 요소 태그 개수, 추천 카드 하단 태그 |
| DB 초기화 SQL | 시연 초기 상태 복구 |
| 페르소나 3 DB 점검 | 로그인 계정과 데이터 존재 여부 확인 |

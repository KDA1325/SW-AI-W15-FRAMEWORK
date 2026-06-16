# GJC-183 FastAPI AI Compute 분리 학습 노트

## 1. 구현 범위

GJC-183은 NestJS 백엔드를 FastAPI로 전체 이전하는 작업이 아니라, AI 임베딩처럼 계산 중심인 부분만 FastAPI 서비스로 분리하는 작업이다. 이번 구현은 다음 경계를 기준으로 잡았다.

| 영역 | 담당 |
| --- | --- |
| NestJS | 인증, 사용자 데이터 조회, RAG 오케스트레이션, pgvector 저장, 기존 API 응답 |
| FastAPI | `/health`, `/embed`, embedding vector 계산 |

## 2. FastAPI compute service

FastAPI 서비스는 `ai-compute` 디렉터리에 별도 런타임으로 추가했다. 초기 서비스는 DB에 접근하지 않는 stateless 구조이며, NestJS가 넘긴 텍스트와 모델 설정만 받아 embedding vector를 반환한다.

```python
@app.post("/embed", response_model=EmbedResponse)
async def embed(request: EmbedRequest) -> EmbedResponse:
    result = await create_embedding(
        request.input,
        request.model,
        request.dimensions,
    )
    return EmbedResponse(
        dimensions=result.dimensions,
        embedding=result.embedding,
        model=result.model,
        provider=result.provider,
        usage={"inputCharacters": len(request.input)},
    )
```

로컬 기본값은 기존 NestJS demo embedding과 같은 `demo-hash-embedding-v1` 알고리즘이다. 따라서 FastAPI가 붙어도 개발 환경의 RAG/pgvector smoke는 외부 API 키 없이 재현 가능하다.

```python
def build_demo_embedding(
    seed_text: str,
    dimensions: int = DEMO_EMBEDDING_DIMENSIONS,
) -> list[float]:
    hash_value = 2166136261

    for char in seed_text:
        hash_value ^= ord(char)
        hash_value = (hash_value * 16777619) & 0xFFFFFFFF
```

## 3. NestJS에서 FastAPI로 넘긴 부분

`RagService.createEmbedding()`은 기존에 OpenAI 직접 호출과 demo fallback을 모두 처리했다. 이번 변경에서는 FastAPI client를 먼저 호출하고, FastAPI가 없거나 실패하면 기존 NestJS 경로로 fallback한다.

```ts
// GJC-183: NestJS는 인증, 데이터 조회, pgvector 저장을 계속 담당하고,
// 임베딩 벡터 계산만 FastAPI AI compute service의 /embed 경계로 위임합니다.
const fastApiEmbedding = await this.aiComputeClient?.createEmbedding({
  dimensions,
  input: embeddingInput,
  model,
});

if (fastApiEmbedding) {
  return {
    dimensions: fastApiEmbedding.dimensions,
    model: fastApiEmbedding.model,
    provider: fastApiEmbedding.provider,
    values: fastApiEmbedding.values,
  };
}
```

이 구조의 장점은 FastAPI 분리가 배포 전환을 강제하지 않는다는 점이다. 로컬에서 FastAPI를 끄면 NestJS가 기존처럼 OpenAI 또는 demo embedding을 사용한다.

## 4. Client/provider 경계

`AiComputeClient`는 NestJS 내부에서 FastAPI 호출을 캡슐화한다. 환경변수는 `FASTAPI_AI_COMPUTE_URL`과 `FASTAPI_AI_COMPUTE_TIMEOUT_MS`를 우선 사용하고, 기존 예약 값인 `FASTAPI_AGENT_URL`도 fallback으로 읽는다.

```ts
private baseUrl(): string | null {
  const configured =
    this.config.get<string>('FASTAPI_AI_COMPUTE_URL') ??
    this.config.get<string>('FASTAPI_AGENT_URL');

  return configured ? configured.replace(/\/+$/, '') : null;
}
```

FastAPI 응답이 올바른 vector를 포함하지 않거나 네트워크 오류가 나면 예외를 전파하지 않고 `null`을 반환한다. RAG 흐름 전체가 FastAPI 장애 때문에 깨지지 않도록 하기 위해서다.

## 5. 검증 흐름

샘플 검증은 `docs/datasets/player-preference-igdb`의 persona 데이터를 사용한다. FastAPI와 NestJS smoke script 모두 첫 샘플의 텍스트를 embedding input으로 만들고, demo baseline의 차원과 앞부분 vector 값을 비교한다.

```js
const firstMatches = expected
  .slice(0, 8)
  .every((value, index) => value === body.embedding[index]);
```

이번 작업에서 확인한 명령은 다음과 같다.

```bash
python ai-compute/scripts/compare_embed.py
npm.cmd run build
npm.cmd test -- --runInBand src/ai/rag.service.spec.ts
npm.cmd run smoke:ai-compute
```

## 6. 이후 확장 포인트

- `/similarity`는 FastAPI에서 cosine similarity를 계산하고 NestJS는 결과 저장만 담당하도록 확장할 수 있다.
- `/rerank`는 RAG 후보군과 추천 후보군을 입력 DTO로 받아 Python 모델 생태계에서 점수를 계산하도록 분리할 수 있다.
- 대량 embedding은 현재 sync HTTP 호출 대신 queue/worker 구조로 옮기는 편이 적합하다.
- FastAPI가 DB를 직접 읽기 시작하면 인증/권한 경계가 흐려지므로, 초기 원칙처럼 NestJS가 필요한 payload를 모아서 넘기는 구조를 유지하는 것이 안전하다.

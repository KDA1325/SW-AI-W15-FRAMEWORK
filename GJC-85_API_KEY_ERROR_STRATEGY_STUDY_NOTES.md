# GJC-85 API Key 오류 처리 전략 구현 학습 정리

## 1. 작업 범위

이번 노트는 `GJC-85 [P0-05][MCP] API Key/권한/오류 처리 전략 문서화` 작업에서 변경한 아래 파일을 기준으로 정리한다.

- `server/.env.example`
- `server/README.md`
- `server/src/ai/igdb.service.ts`
- `server/src/ai/mcp.service.ts`

핵심 목표는 OpenAI, IGDB, Steam, FastAPI Agent 연동에 필요한 환경변수 이름과 실패 처리 기준을 정하고, MCP tool이 외부 API 실패를 Agent가 이해 가능한 구조로 반환하게 하는 것이다.

## 2. 비밀값은 값이 아니라 이름만 커밋한다

`.env.example`에는 실제 key 값을 넣지 않고 변수 이름만 넣는다.

```env
OPENAI_API_KEY=
OPENAI_CHAT_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_EMBEDDING_DIMENSIONS=1536

IGDB_CLIENT_ID=
IGDB_CLIENT_SECRET=

STEAM_WEB_API_KEY=
FASTAPI_AGENT_URL=http://localhost:8000
FASTAPI_AGENT_TIMEOUT_MS=30000
```

실제 값은 `server/.env`나 배포 플랫폼의 secret storage에 둔다. 이렇게 해야 API key가 git history에 남는 사고를 막을 수 있다.

## 3. README에 보안 규칙을 명시한다

README에는 MVP 기준 보안 규칙을 명시했다.

```markdown
- Never hardcode API keys, access tokens, client secrets, JWT secrets, or database passwords in source code.
- Keep local secrets only in `server/.env`, which must stay untracked.
- Commit only variable names and safe defaults in `server/.env.example`.
- Production secrets must be configured in the deployment platform or a secrets manager, not in git.
- Do not log full request headers, `Authorization` values, `client_secret`, access tokens, or `.env` contents.
```

이 규칙은 코드 리뷰 기준이기도 하다. 새 외부 API를 추가할 때도 같은 방식으로 `.env.example`에 이름만 추가해야 한다.

## 4. 외부 API 실패는 errorCode로 분류한다

IGDB service에는 외부 API 오류 코드를 추가했다.

```ts
export type ExternalApiErrorCode =
  | 'missing_credentials'
  | 'unauthorized'
  | 'rate_limited'
  | 'network_error'
  | 'external_api_error';
```

이 값은 Agent가 다음 행동을 고르는 데 도움을 준다.

| 오류 코드 | 의미 | Agent 대응 |
| --- | --- | --- |
| `missing_credentials` | 키가 설정되지 않음 | fallback 추천 또는 관리자 안내 |
| `unauthorized` | 키가 틀렸거나 권한 없음 | 재시도보다 설정 점검 |
| `rate_limited` | 쿼터/요청 제한 | 나중에 재시도 |
| `network_error` | 타임아웃/DNS/연결 문제 | fallback 후 재시도 가능 |
| `external_api_error` | 그 외 제공자 오류 | 일반 fallback |

## 5. 키 누락은 예외가 아니라 구조화된 결과로 반환한다

IGDB 키가 없으면 서버 예외를 던지지 않고 빈 결과와 명확한 오류 코드를 반환한다.

```ts
if (!clientId || !clientSecret) {
  return {
    error:
      'IGDB credentials are missing. Set IGDB_CLIENT_ID and IGDB_CLIENT_SECRET.',
    errorCode: 'missing_credentials',
    games: [],
    provider: 'igdb',
  };
}
```

이렇게 하면 전체 AI 추천 SYNC가 IGDB 키 하나 때문에 완전히 중단되지 않는다.

## 6. Axios 오류를 안전한 메시지로 바꾼다

외부 API 오류를 그대로 클라이언트에 내보내면 stack trace나 내부 상태가 새어 나갈 수 있다. 그래서 status code만 보고 안전한 메시지로 변환한다.

```ts
private toSafeExternalApiError(error: unknown): {
  error: string;
  errorCode: ExternalApiErrorCode;
} {
  if (!axios.isAxiosError(error)) {
    return {
      error: 'IGDB request failed before a response was returned.',
      errorCode: 'external_api_error',
    };
  }

  const status = error.response?.status;

  if (status === 401 || status === 403) {
    return {
      error:
        'IGDB authorization failed. Check IGDB_CLIENT_ID and IGDB_CLIENT_SECRET.',
      errorCode: 'unauthorized',
    };
  }

  if (status === 429) {
    return {
      error: 'IGDB rate limit was exceeded. Retry later or reduce requests.',
      errorCode: 'rate_limited',
    };
  }

  if (!error.response) {
    return {
      error: 'IGDB network request failed or timed out.',
      errorCode: 'network_error',
    };
  }

  return {
    error: `IGDB returned HTTP ${status ?? 'unknown'} while searching games.`,
    errorCode: 'external_api_error',
  };
}
```

중요한 점은 원본 `Authorization` header, `client_secret`, token 값은 응답에도 로그에도 넣지 않는다는 것이다.

## 7. MCP tool result는 Agent가 읽기 쉬워야 한다

MCP `search_games` output schema에 `errorCode`를 추가했다.

```ts
outputSchema: {
  additionalProperties: false,
  properties: {
    error: { type: ['string', 'null'] },
    errorCode: {
      enum: [
        'missing_credentials',
        'unauthorized',
        'rate_limited',
        'network_error',
        'external_api_error',
        null,
      ],
    },
    games: { type: 'array' },
    provider: { const: 'igdb', type: 'string' },
  },
  required: ['provider', 'games', 'error', 'errorCode'],
  type: 'object',
}
```

Agent는 `isError`만 보는 대신 `errorCode`까지 읽어서 다음 행동을 정할 수 있다.

## 8. 검증 결과

빌드와 테스트:

```text
npm.cmd run build
npm.cmd test -- --runInBand
git diff --check
```

MCP missing credentials 직접 호출 결과:

```json
{
  "isError": true,
  "provider": "igdb",
  "games": 0,
  "errorCode": "missing_credentials"
}
```

하드코딩 스캔:

```text
rg -n "sk-" server --glob '!package-lock.json'
rg -n "ghp_|xoxb-|xoxp-|xoxa-|xoxr-" server --glob '!package-lock.json'
rg -n "client_secret|api_key|API_KEY|CLIENT_SECRET|Authorization" server/src server/README.md server/.env.example
```

실제 secret 패턴은 발견되지 않았고, 환경변수 이름과 안전한 헤더 사용 위치만 확인됐다.

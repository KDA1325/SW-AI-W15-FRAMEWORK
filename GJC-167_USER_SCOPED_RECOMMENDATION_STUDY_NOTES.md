# GJC-167 User-Scoped Recommendation Study Notes

## 1. 작업 요약

`GJC-167`의 목표는 AI 추천 입력이 전체 사용자 데이터가 아니라 현재 로그인한 사용자 데이터만 보도록 제한하는 것이다. 이번 작업에서는 기존 추천 UI를 바꾸지 않고 서버의 RAG/Agent 흐름만 보강했다.

변경 파일:

- `server/src/ai/rag.service.ts`
- `server/src/ai/agent.service.ts`
- `server/src/ai/agent.service.spec.ts`

## 2. RAG 입력을 현재 사용자 기록으로 제한

RAG 분석은 이미 `ArchivePost`를 `userId`로 제한하고 있었다. 여기에 `UserGame` 플레이 기록도 현재 사용자 기준으로 추가했다.

```ts
const posts = await this.loadUserArchivePosts(userId);
const playedGames = await this.loadUserGameRecords(userId);

const queryText = this.buildPreferenceQuery(posts, playedGames);
```

`loadUserGameRecords`는 반드시 `user_game."userId" = $1` 조건을 사용한다. 이 조건이 빠지면 다른 사용자의 Steam/플레이 기록이 추천 분석에 섞일 수 있다.

```ts
private async loadUserGameRecords(userId: string): Promise<UserGameRow[]> {
  return this.dataSource.query<UserGameRow[]>(
    `
      SELECT
        user_game."gameId",
        user_game."totalPlaytimeMinutes",
        user_game."recentPlaytimeMinutes",
        user_game."achievementRate",
        user_game."lastPlayedAt",
        game.title AS "gameTitle",
        game.description AS "gameDescription",
        game.genres AS "gameGenres",
        game.platforms AS "gamePlatforms",
        game.tags AS "gameTags"
      FROM "UserGame" user_game
      INNER JOIN "Game" game ON game.id = user_game."gameId"
      WHERE user_game."userId" = $1
      ORDER BY user_game."lastPlayedAt" DESC NULLS LAST, user_game."updatedAt" DESC
    `,
    [userId],
  );
}
```

## 3. 주석이 설명하는 핵심 의도

이번 작업에서 가장 중요한 주석은 RAG query text가 현재 사용자 기록만 포함해야 한다는 점을 코드 옆에 직접 남긴 것이다.

```ts
// Only current-user writing and play records become the RAG query text, so another player's history cannot affect this analysis.
const postSignals = posts.map((post) =>
  [
    post.gameTitle,
    post.title,
    post.content,
    post.gameGenres.join(', '),
    post.gameTags.join(', '),
  ].join('\n'),
);
```

이 주석의 학습 포인트:

- 인증된 `userId`는 controller에서 service로만 전달한다.
- RAG query text는 LLM/embedding 입력이므로 보안 경계처럼 다뤄야 한다.
- SQL에서 `userId`를 제한해도 query text 조합 단계에서 전체 데이터를 섞으면 다시 오염될 수 있다.

## 4. UserGame 기록을 RAG 근거로 변환

`UserGame`은 벡터 검색 문서가 아닐 수 있으므로, 현재 사용자의 플레이 기록을 RAG context source 형태로 변환해 분석 입력에 추가했다.

```ts
private toUserGameContextRow(game: UserGameRow): RagSearchRow {
  return {
    content: [
      `Steam/UserGame play record for ${game.gameTitle}.`,
      `Total playtime minutes: ${game.totalPlaytimeMinutes}.`,
      `Recent playtime minutes: ${game.recentPlaytimeMinutes}.`,
      `Achievement rate: ${game.achievementRate ?? 'unknown'}.`,
      `Genres: ${game.gameGenres.join(', ')}.`,
      `Tags: ${game.gameTags.join(', ')}.`,
    ].join('\n'),
    metadata: {
      gameTitle: game.gameTitle,
      title: `${game.gameTitle} play record`,
    },
    similarity: 1,
    sourceId: game.gameId,
    sourceType: 'GAME',
  };
}
```

여기서 `sourceType: 'GAME'`을 사용한 이유는 프론트 응답 계약의 `AiSourceType`이 이미 `GAME`을 지원하기 때문이다. 새 타입을 추가하지 않아 응답 계약과 UI를 흔들지 않는다.

## 5. Agent fallback 후보도 사용자 신호로 제한

기존 fallback은 `Game` 테이블 전체를 최신순으로 가져왔다. 이 방식은 다른 사용자의 로그를 직접 읽지는 않지만, 추천 후보가 현재 사용자 신호와 무관하게 섞일 수 있다.

변경 후 fallback은 현재 사용자의 `ArchivePost`와 `UserGame`에서 나온 태그/장르/플랫폼만 신호로 모은다.

```ts
WITH user_signal_terms AS (
  SELECT array_agg(DISTINCT lower(signal.term)) AS terms
  FROM (
    SELECT unnest(game.tags || game.genres || game.platforms) AS term
    FROM "ArchivePost" post
    INNER JOIN "Game" game ON game.id = post."gameId"
    WHERE post."userId" = $1

    UNION

    SELECT unnest(game.tags || game.genres || game.platforms) AS term
    FROM "UserGame" user_game
    INNER JOIN "Game" game ON game.id = user_game."gameId"
    WHERE user_game."userId" = $1
  ) signal
)
```

그 다음 `Game` 후보는 이 사용자 신호와 겹치는 경우만 남긴다.

```ts
WHERE COALESCE(array_length(signals.terms, 1), 0) > 0
  AND EXISTS (
    SELECT 1
    FROM unnest(game.tags || game.genres || game.platforms) AS candidate(term)
    WHERE lower(candidate.term) = ANY(signals.terms)
  )
```

## 6. 테스트로 확인한 계약

새 테스트는 fallback SQL이 `post."userId" = $1`, `user_game."userId" = $1`을 모두 포함하고, 파라미터가 현재 사용자 id인지 확인한다.

```ts
expect(query).toContain('post."userId" = $1');
expect(query).toContain('user_game."userId" = $1');
expect(params).toEqual(['current-user-id']);
```

또한 추천 사유도 현재 사용자 기록 기반임을 명시한다.

```ts
expect(result.recommendations[0].reason).toContain(
  "this user's own journal, review, and Steam play signals",
);
```

## 7. 검증 결과

```bash
cd server
npm test -- agent.service.spec.ts --runInBand
npm run build
npm test -- --runInBand
git diff --check
```

결과:

- 대상 테스트 통과
- 서버 빌드 통과
- 전체 서버 테스트 통과
- diff check 통과

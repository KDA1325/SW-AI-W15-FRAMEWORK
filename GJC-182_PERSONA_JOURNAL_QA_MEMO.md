# GJC-182 Persona Journal QA Memo

## Scope

3번 페르소나 `MULTIPLAYER_TEST`의 import payload와 `GET /posts?type=JOURNAL&mine=true` 목록 계약을 확인했다.

## Findings

- `docs/datasets/player-preference-igdb/by-persona/03_multiplayer_social_import_payload.json`은 JSON 파싱에 성공한다.
- payload 기준 총 20건이며 `JOURNAL` 7건, `REVIEW` 13건이다.
- `REVIEW` 게임 제목 중복은 없어 중복 리뷰 차단이 import 전체를 막는 구조가 아니다.
- 서버 목록 API는 `limit`을 생략하면 기본 10건을 반환하므로 3번 페르소나의 JOURNAL 7건은 첫 페이지에 모두 들어와야 한다.

## Regression Check

`server/src/posts/posts.service.spec.ts`에 기본 목록 페이징으로 7개 JOURNAL이 모두 보이는지 확인하는 테스트를 추가했다.

```ts
await expect(
    service.findAll(
        'persona-multiplayer',
        ArchivePostType.JOURNAL,
        true,
    ),
).resolves.toMatchObject({
    limit: 10,
    page: 1,
    total: 7,
    totalPages: 1,
});
```

## Manual QA

1. `persona-multiplayer@gaming-journal.club`로 로그인한다.
2. `/journals`에 진입한다.
3. `JOURNAL_LOGS`가 7건 기준으로 탐색 가능한지 확인한다.
4. API 문제를 분리할 때는 `GET /posts?type=JOURNAL&mine=true` 응답의 `total`, `items.length`, `totalPages`를 먼저 확인한다.

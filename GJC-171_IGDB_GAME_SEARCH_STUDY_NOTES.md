# GJC-171 IGDB 게임 검색/선택 UI 학습 정리

## 1. 작업 범위

- 백엔드: `/posts/games/search` 검색 API 추가
- 백엔드: `gameTitle`과 함께 `igdbGameId`를 포스트 생성 payload로 받아 `Game.igdbId`에 저장
- 프론트엔드: 저널/리뷰 작성 화면의 게임 제목 입력을 IGDB 실시간 검색 입력으로 교체
- 예외 처리: 검색어 짧음, 검색 중, 결과 없음, IGDB API 실패 상태 처리

## 2. 서버에서 IGDB를 호출하는 이유

IGDB는 Twitch OAuth token과 client secret이 필요하므로 프론트에서 직접 호출하면 키가 노출된다. 그래서 클라이언트는 `/posts/games/search?q=...`만 호출하고, 서버가 기존 `IgdbService`를 통해 IGDB에 접근한다.

```ts
@Get('games/search')
searchGames(@Query('q') q?: string) {
    return this.postsService.searchGames(q);
}
```

`GET /posts/:id`보다 위에 두어야 `games/search`가 게시글 id로 해석되지 않는다.

## 3. 짧은 검색어 차단

프론트에서도 debounce를 하지만, 서버에서도 2글자 미만 검색어는 IGDB를 호출하지 않는다. 이렇게 하면 잘못된 클라이언트 호출이나 빠른 입력 중복에 대해 서버가 한 번 더 방어한다.

```ts
async searchGames(query?: string) {
    const normalizedQuery = query?.trim() ?? '';

    if (normalizedQuery.length < 2) {
        return {
            error: null,
            errorCode: null,
            games: [],
            provider: 'igdb' as const,
        };
    }

    return this.igdbService.searchGames({
        limit: 8,
        query: normalizedQuery,
    });
}
```

## 4. IGDB 응답 확장

드롭다운에서 게임을 식별하기 쉽도록 기존 검색 결과에 `aliases`를 추가했다. IGDB APICalypse query의 `fields`에 `alternative_names.name`을 포함하고, 응답 변환 시 최대 3개 별칭을 내려준다.

```ts
return [
    'fields name,slug,summary,first_release_date,total_rating,alternative_names.name,cover.image_id,genres.name,platforms.name,themes.name;',
    `search "${search}";`,
    'where version_parent = null;',
    `limit ${limit};`,
].join('\n');
```

```ts
return {
    aliases: this.names(game.alternative_names).slice(0, 3),
    externalId: {
        id: String(game.id),
        provider: 'igdb',
    },
    title: game.name,
};
```

## 5. canonical IGDB id 저장

기존에는 `gameTitle`만 보고 `Game`을 찾았다. 이제 사용자가 IGDB 결과를 선택하면 `igdbGameId`도 함께 보내고, 서버는 제목보다 canonical id를 먼저 기준으로 게임을 연결한다.

```ts
// IGDB 선택값이 있으면 자유 입력 제목보다 canonical id를 우선해 Game을 연결합니다.
const game = await this.findOrCreateGame(dto.gameTitle, dto.igdbGameId);
```

```ts
private async findOrCreateGame(gameTitle: string, igdbGameId?: string) {
    const title = gameTitle.trim();
    const igdbId = this.normalizeIgdbGameId(igdbGameId);

    let game = igdbId
        ? await this.gameRepository.findOne({
              where: { igdbId },
          })
        : null;

    if (!game) {
        game = await this.gameRepository.findOne({
            where: { title },
        });
    }

    if (!game) {
        game = this.gameRepository.create({
            igdbId,
            title,
        });

        game = await this.gameRepository.save(game);
    }

    return game;
}
```

이 구조는 다음 GJC-172 중복 리뷰 차단에서 같은 게임을 제목 문자열이 아니라 `Game.igdbId` 기준으로 판별할 수 있게 해준다.

## 6. 프론트 디바운스 검색

`GameSearchInput`은 입력값이 바뀔 때 바로 API를 호출하지 않고 350ms 뒤 검색한다. React 19 lint 규칙 때문에 effect 본문에서는 즉시 setState하지 않고, 타이머 콜백에서 외부 동기화를 수행한다.

```tsx
useEffect(() => {
  const query = value.trim()

  if (query.length < 2) {
    return
  }

  let isCancelled = false
  // The effect only schedules the debounced external sync; immediate clearing happens in the input event.
  const timeoutId = window.setTimeout(async () => {
    setStatus('loading')
    setMessage(null)

    const response = await api.get<IgdbGameSearchResponse>(
      `/posts/games/search?q=${encodeURIComponent(query)}`,
    )

    if (isCancelled) {
      return
    }

    setGames(response.data.games)
    setStatus('ready')
  }, 350)

  return () => {
    isCancelled = true
    window.clearTimeout(timeoutId)
  }
}, [value])
```

## 7. 결과 선택과 payload

사용자가 검색 결과를 선택하면 화면에는 canonical 게임명이 들어가고, payload에는 `igdbGameId`가 함께 포함된다. 사용자가 다시 타이핑하면 선택 id를 비워서 제목과 id가 엇갈리지 않게 했다.

```tsx
<GameSearchInput
  inputClassName="w-full border-2 border-primary bg-surface p-4 font-body-lg text-body-lg"
  onChange={(value) => {
    setGameTitle(value)
    setIgdbGameId(null)
  }}
  onSelect={(game) => {
    setGameTitle(game.title)
    setIgdbGameId(game.externalId.id)
  }}
  placeholder="ENTER_GAME_TITLE"
  selectedIgdbGameId={igdbGameId}
  value={gameTitle}
/>
```

```ts
await api.post('/posts', {
  type: 'REVIEW',
  gameTitle,
  igdbGameId: igdbGameId ?? undefined,
  title: reviewTitle,
  content: review,
  rating: parseFloat(rating),
})
```

## 8. 검증

```bash
npm.cmd test -- posts.service.spec.ts --runInBand
npm.cmd run lint
npm.cmd run build
npm.cmd test -- --runInBand
npm.cmd run build
git diff --check
```

핵심 테스트는 포스트 생성 시 `igdbGameId`가 `Game.igdbId`로 저장되는지, 숫자가 아닌 IGDB id가 거부되는지, 2글자 미만 검색어가 IGDB 호출을 생략하는지 확인한다.

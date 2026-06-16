# GJC-168 SYNC 결과 저장 및 복원 학습 정리

## 1. 이슈 목표

GJC-168은 추천 페이지에서 `SYNC_DATA`를 실행한 결과가 새로고침 뒤에도 유지되도록 만드는 작업입니다. 핵심은 AI 분석을 페이지 진입 때마다 다시 실행하지 않고, 마지막으로 성공한 SYNC 응답을 DB에 저장한 뒤 React가 그 스냅샷을 읽어 화면을 복원하는 것입니다.

이번 변경 범위는 다음 파일입니다.

- `server/src/auth/entities/aiProfile.entity.ts`
- `server/src/ai/agent.service.ts`
- `server/src/ai/recommendations.controller.ts`
- `client/src/pages/Recommend.tsx`
- `server/src/ai/agent.service.spec.ts`

## 2. DB에는 "계산 결과 스냅샷"을 저장한다

`AiProfile`은 이미 사용자의 AI 취향 요약을 저장하는 1:1 프로필 엔티티입니다. 그래서 추천 SYNC 결과도 같은 사용자 프로필에 붙여 저장했습니다.

```ts
// 마지막 SYNC 응답 전체를 저장해 새로고침해도 추천 페이지가 같은 결과를 다시 보여줄 수 있게 합니다.
@Column({ type: 'jsonb', nullable: true })
lastRecommendationSync!: AiRecommendationSyncResponse | null;
```

여기서 `jsonb`를 선택한 이유는 추천 응답이 카드 목록, 워드 클라우드, 파이프라인 메타데이터처럼 중첩 구조를 가진 객체이기 때문입니다. 개별 테이블로 쪼개면 검색과 통계에는 유리하지만, 이번 이슈의 요구사항인 "마지막 결과를 그대로 복원"에는 전체 응답 스냅샷 저장이 더 단순합니다.

## 3. SYNC 성공 시점에만 저장한다

추천 생성 로직은 먼저 RAG, MCP, Agent 결과를 모아 `AiRecommendationSyncResponse`를 만든 뒤 저장합니다.

```ts
const response: AiRecommendationSyncResponse = {
  requestId,
  userId,
  generatedAt: now,
  lastSyncAt: now,
  playStyleSummary: ragContext.playStyleSummary,
  preferenceTags: ragContext.preferenceTags,
  wordCloud: ragContext.wordCloud,
  recommendations,
  contextSources: ragContext.contextSources,
  pipeline: {
    rag: { topK: ragContext.topK, sourceCount: ragContext.contextSources.length },
    mcp: { toolName: 'search_games', resultCount: toolResultCount },
    agent: {
      maxIterations: MAX_AGENT_ITERATIONS,
      iterations: Math.max(1, searchQueries.length),
      stoppedReason,
    },
  },
};

await this.saveLatestRecommendationSync(userId, response);

return response;
```

저장 함수는 프로필이 없으면 새로 만들고, 있으면 기존 행을 갱신합니다.

```ts
private async saveLatestRecommendationSync(
  userId: string,
  response: AiRecommendationSyncResponse,
): Promise<void> {
  const repository = this.dataSource.getRepository(AiProfile);
  let profile = await repository.findOne({ where: { userId } });

  if (!profile) {
    profile = repository.create({ userId });
  }

  // The page reload path reads this exact snapshot, so only an explicit SYNC click changes what React displays.
  profile.lastRecommendationSync = response;
  profile.playStyleSummary = response.playStyleSummary;
  profile.favoriteKeywords = response.preferenceTags.map((tag) => tag.label);
  profile.favoriteGenres = response.wordCloud
    .filter((term) => term.category === 'genre')
    .map((term) => term.label);
  profile.lastAnalyzedAt = new Date(response.generatedAt);

  await repository.save(profile);
}
```

주석의 핵심은 "화면 복원 경로는 이 스냅샷만 읽는다"입니다. 즉 페이지를 열었다는 이유만으로 비용이 큰 AI 분석을 다시 돌리지 않고, 사용자가 명시적으로 SYNC를 누를 때만 결과가 바뀝니다.

## 4. 조회 API는 AI 분석을 실행하지 않는다

새 엔드포인트는 로그인 사용자의 마지막 스냅샷만 반환합니다.

```ts
@Get('latest')
latest(@Req() req: AuthedRequest) {
  return this.agentService.getLatestRecommendations(req.user.userId);
}
```

서비스 조회 함수도 단순하게 `AiProfile.lastRecommendationSync`만 읽습니다.

```ts
async getLatestRecommendations(
  userId: string,
): Promise<AiRecommendationSyncResponse | null> {
  const profile = await this.dataSource.getRepository(AiProfile).findOne({
    where: { userId },
  });

  return profile?.lastRecommendationSync ?? null;
}
```

이 설계 덕분에 `GET /ai/recommendations/latest`는 no data 상태에서는 `null`을 반환하고, 저장된 결과가 있을 때는 동일한 추천 카드와 워드 클라우드를 다시 보여줍니다.

## 5. React는 페이지 진입 때 마지막 결과만 복원한다

추천 페이지는 마운트 시 `latest` API를 호출해서 `syncData`를 채웁니다. 실패하면 기존 에러 UI를 재사용합니다.

```tsx
useEffect(() => {
  let isMounted = true

  async function loadLatestSync() {
    try {
      const response = await api.get<AiRecommendationSyncResponse | null>(
        '/ai/recommendations/latest',
      )

      // Page entry only restores the last saved snapshot; it never triggers a new AI analysis by itself.
      if (isMounted) {
        setSyncData(response.data)
      }
    } catch (error) {
      if (isMounted) {
        setSyncError(getApiErrorMessage(error, 'AI LAST SYNC LOAD FAILED'))
      }
    }
  }

  void loadLatestSync()

  return () => {
    isMounted = false
  }
}, [])
```

`isMounted` 플래그는 비동기 요청이 끝나기 전에 컴포넌트가 사라진 경우 상태 업데이트를 막기 위한 방어 코드입니다. 그리고 주석처럼 이 effect는 "복원"만 담당하고, 새 분석은 기존 `SYNC_DATA` 버튼의 `POST /ai/recommendations/sync` 경로에 남겨 둡니다.

## 6. 테스트에서 확인한 동작

테스트는 두 가지를 확인합니다.

1. SYNC 결과가 생성된 뒤 `AiProfile.lastRecommendationSync`로 저장된다.
2. 최신 결과 조회는 새 SYNC를 돌리지 않고 저장된 스냅샷을 반환한다.

```ts
expect(aiProfileRepository.save).toHaveBeenCalledWith(
  expect.objectContaining({
    lastRecommendationSync: result,
    userId: 'current-user-id',
  }),
);
```

```ts
await expect(
  service.getLatestRecommendations('current-user-id'),
).resolves.toBe(latestSync);

expect(aiProfileRepository.findOne).toHaveBeenCalledWith({
  where: { userId: 'current-user-id' },
});
```

## 7. 전체 흐름

```text
사용자가 SYNC_DATA 클릭
  -> POST /ai/recommendations/sync
  -> RAG context + MCP game search + Agent ranking
  -> AiProfile.lastRecommendationSync 저장
  -> React syncData 갱신

사용자가 새로고침 또는 재방문
  -> GET /ai/recommendations/latest
  -> 저장된 lastRecommendationSync 반환
  -> React syncData 복원
  -> AI 분석은 자동 실행하지 않음
```

이 구조는 비용이 큰 AI 파이프라인과 가벼운 화면 복원 경로를 분리합니다. 그래서 사용자는 새로고침 뒤에도 no data로 돌아가지 않고, 서버는 불필요한 LLM/MCP 호출을 줄일 수 있습니다.

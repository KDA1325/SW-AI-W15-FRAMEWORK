# GJC-172 사용자별 중복 리뷰 차단 학습 정리

## 1. 작업 범위

- 백엔드: 사용자별 같은 게임 REVIEW 중복 생성 차단
- 백엔드: 작성 전 중복 여부 확인 API 추가
- DB: `userId + gameId` 기준 REVIEW partial unique index 추가
- 프론트엔드: 리뷰 작성 화면에서 inline 중복 체크 및 제출 차단

## 2. DB 레벨 방어

프론트에서 중복을 막아도 동시에 두 요청이 들어오면 race condition이 생길 수 있다. 그래서 `ArchivePost`에 REVIEW에만 적용되는 partial unique index를 추가했다.

```ts
@Index('IDX_archive_post_unique_review_per_user_game', ['userId', 'gameId'], {
  unique: true,
  where: `"type" = 'REVIEW'`,
})
@Entity('ArchivePost')
export class ArchivePost {
  // ...
}
```

이 인덱스는 같은 사용자가 같은 `gameId`로 REVIEW를 두 번 저장하는 것을 DB 단계에서 막는다. JOURNAL은 여러 개 작성할 수 있어야 하므로 `where: "type" = 'REVIEW'` 조건을 둔다.

## 3. 서버 생성 흐름의 중복 검사

포스트 생성 시 `Game`을 찾거나 만든 직후 REVIEW이면 중복을 먼저 검사한다.

```ts
const game = await this.findOrCreateGame(dto.gameTitle, dto.igdbGameId);

if (dto.type === ArchivePostType.REVIEW) {
    await this.assertReviewNotDuplicated(userId, game);
}
```

중복이 있으면 `409 Conflict`로 변환한다.

```ts
private async assertReviewNotDuplicated(userId: string, game: Game) {
    const duplicate = await this.findDuplicateReview(userId, {
        gameId: game.id,
        igdbId: game.igdbId,
        normalizedTitle: this.normalizeGameTitle(game.title),
    });

    if (duplicate) {
        throw new ConflictException('이미 리뷰가 존재합니다.');
    }
}
```

## 4. IGDB id와 제목 fallback

새 데이터는 `Game.igdbId`가 있으므로 canonical id로 비교할 수 있다. 하지만 기존 데이터에는 IGDB id가 없을 수 있으므로 title fallback도 같이 둔다.

```ts
private async findDuplicateReview(
    userId: string,
    candidates: {
        gameId?: string | null;
        igdbId?: string | null;
        normalizedTitle?: string | null;
    },
) {
    return this.postRepository
        .createQueryBuilder('post')
        .innerJoinAndSelect('post.game', 'game')
        .where('post.userId = :userId', { userId })
        .andWhere('post.type = :type', { type: ArchivePostType.REVIEW })
        .andWhere(
            new Brackets((qb) => {
                let hasCondition = false;
                const addCondition = (
                    condition: string,
                    params: Record<string, string>,
                ) => {
                    if (hasCondition) {
                        qb.orWhere(condition, params);
                    } else {
                        qb.where(condition, params);
                        hasCondition = true;
                    }
                };

                if (candidates.gameId) {
                    addCondition('post.gameId = :gameId', {
                        gameId: candidates.gameId,
                    });
                }

                if (candidates.igdbId) {
                    addCondition('game.igdbId = :igdbId', {
                        igdbId: candidates.igdbId,
                    });
                }

                if (candidates.normalizedTitle) {
                    addCondition(
                        "REGEXP_REPLACE(LOWER(TRIM(game.title)), '\\s+', ' ', 'g') = :normalizedTitle",
                        { normalizedTitle: candidates.normalizedTitle },
                    );
                }
            }),
        )
        .getOne();
}
```

정규화 함수는 앞뒤 공백, 중복 공백, 대소문자 차이를 줄인다.

```ts
private normalizeGameTitle(gameTitle: string) {
    return gameTitle.trim().replace(/\s+/g, ' ').toLowerCase();
}
```

## 5. 저장 race condition 처리

서비스 레벨 검사 후에도 동시 요청이 들어오면 둘 다 검사 시점에는 중복이 없다고 볼 수 있다. 이때 DB unique index가 마지막 방어선이고, PostgreSQL unique violation `23505`를 `409 Conflict`로 바꾼다.

```ts
private async savePostOrConflict(post: ArchivePost, type: ArchivePostType) {
    try {
        return await this.postRepository.save(post);
    } catch (error) {
        if (type === ArchivePostType.REVIEW && this.isUniqueViolation(error)) {
            throw new ConflictException('이미 리뷰가 존재합니다.');
        }

        throw error;
    }
}
```

## 6. 작성 전 확인 API

리뷰 작성 화면은 제출 전에 중복 여부를 확인한다.

```ts
@Get('reviews/duplicate')
checkReviewDuplicate(
    @Req() req: AuthedRequest,
    @Query('gameTitle') gameTitle?: string,
    @Query('igdbGameId') igdbGameId?: string,
) {
    return this.postsService.checkReviewDuplicate(
        req.user.userId,
        gameTitle,
        igdbGameId,
    );
}
```

응답은 UI가 바로 쓰기 쉬운 모양이다.

```ts
return {
    duplicate: Boolean(duplicate),
    gameId: duplicate?.gameId ?? null,
    matchedBy: duplicate ? this.duplicateMatchedBy(...) : null,
    message: duplicate ? '이미 리뷰가 존재합니다.' : null,
    postId: duplicate?.id ?? null,
};
```

## 7. 프론트 inline 차단

리뷰 작성 화면은 `gameTitle` 또는 `igdbGameId`가 바뀌면 debounce 후 `/posts/reviews/duplicate`를 호출한다. 중복이면 inline 메시지를 표시하고 POST 버튼을 비활성화한다.

```tsx
const isSubmitBlocked =
  duplicateReview.status === 'checking' || duplicateReview.duplicate
```

```tsx
{duplicateReview.duplicate ? (
  <span className="font-label-caps text-[10px] text-primary">
    {duplicateReview.message ?? '이미 리뷰가 존재합니다.'}
  </span>
) : null}
```

```tsx
<button
  disabled={isSubmitBlocked}
  type="submit"
>
  {duplicateReview.status === 'checking' ? 'CHECKING' : 'POST'}
</button>
```

서버에서 409가 돌아온 경우도 같은 메시지 경로로 처리한다.

```tsx
if (duplicateReview.duplicate) {
  setMessage(duplicateReview.message ?? '이미 리뷰가 존재합니다.')
  return
}
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

핵심 테스트는 중복 리뷰가 있을 때 저장 전에 `ConflictException`이 발생하는지, 작성 화면용 duplicate API 응답이 `duplicate: true`와 메시지를 반환하는지 확인한다.

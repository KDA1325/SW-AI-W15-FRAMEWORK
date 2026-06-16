# GJC-125 글 작성/수정 태그 입력 UI 학습 정리

## 1. 작업 범위

- 백엔드: 게시글 생성/수정 DTO에 `tags` 배열 추가
- 백엔드: 생성/수정 시 태그를 정규화하고 `ArchivePost.tags` 관계로 저장
- 프론트엔드: 재사용 가능한 `PostTagInput` 컴포넌트 추가
- 프론트엔드: 저널/리뷰 작성 화면과 수정 모달에 태그 입력 UI 연결
- 검증: 태그 개수, 글자 수, 빈 값, 중복 입력 처리

## 2. DTO 검증

게시글 생성과 수정 요청은 `tags?: string[]`를 받을 수 있다. 최대 6개, 각 태그는 40자 이하로 제한한다.

```ts
@IsOptional()
@IsArray()
@ArrayMaxSize(6)
@IsString({ each: true })
@MaxLength(40, { each: true })
tags?: string[];
```

DTO 검증은 요청 body 형태를 1차로 막고, 서비스에서는 정규화 후 비어 있는 값이나 중복을 한 번 더 처리한다.

## 3. 생성 시 태그 저장

게시글 생성에서는 요청으로 받은 태그 문자열을 `Tag` 엔티티 배열로 바꾼 뒤 `ArchivePost.tags` 관계에 연결한다.

```ts
const tags = await this.findOrCreateTags(dto.tags ?? []);

const post = this.postRepository.create({
    userId,
    gameId: game.id,
    type: dto.type,
    title: dto.title,
    content: dto.content,
    rating: dto.type === ArchivePostType.REVIEW ? dto.rating! : null,
    tags,
});
```

`findOne()` 응답에는 GJC-124에서 이미 `tags: true` relation을 포함했기 때문에 저장 직후 상세 응답에도 태그가 포함된다.

## 4. 수정 시 태그 교체

PATCH 요청에서 `tags`가 들어오면 기존 태그 관계를 요청 값으로 교체한다. `tags`가 아예 없으면 기존 관계를 유지한다.

```ts
if (dto.tags !== undefined) {
    // PATCH에서 tags가 들어오면 기존 태그 관계를 요청 값으로 교체합니다.
    post.tags = await this.findOrCreateTags(dto.tags);
}
```

이 구조는 제목/본문만 수정하는 요청이 태그를 지워버리는 사고를 막는다.

## 5. 태그 정규화와 중복 제거

입력 태그는 서버에서 한 번 더 정규화한다.

```ts
private async findOrCreateTags(names: string[]) {
    const normalizedNames = this.normalizePostTagNames(names);

    return Promise.all(
        normalizedNames.map((normalizedName) =>
            this.findOrCreateTag(normalizedName),
        ),
    );
}
```

```ts
private normalizePostTagNames(names: string[]) {
    if (names.length > POST_TAG_LIMIT) {
        throw new BadRequestException('tags must contain at most 6 items.');
    }

    const normalizedNames = names.map((name) => {
        const normalizedName = this.normalizeTagName(name);

        if (!normalizedName) {
            throw new BadRequestException('tag name is required.');
        }

        if (normalizedName.length > POST_TAG_NAME_LIMIT) {
            throw new BadRequestException(
                'tag name must be 40 characters or less.',
            );
        }

        return normalizedName;
    });

    return [...new Set(normalizedNames)];
}
```

중복 태그는 `Set`으로 제거해서 `['TACTICAL_RPG', 'TACTICAL_RPG']`가 한 번만 저장된다.

## 6. PostTagInput 컴포넌트

프론트는 작성/수정 화면 모두 같은 `PostTagInput`을 사용한다. 클라이언트에서도 서버와 같은 정규화 규칙을 적용해서 사용자가 실제 저장될 값을 미리 볼 수 있게 했다.

```tsx
function normalizePostTagInput(value: string) {
  return value
    .trim()
    .replace(/^#+/, '')
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()
}
```

```tsx
const addTag = () => {
  const normalizedTag = normalizePostTagInput(draft)

  if (!normalizedTag) {
    setMessage('TAG_REQUIRED')
    return
  }

  if (normalizedTag.length > POST_TAG_NAME_LIMIT) {
    setMessage('TAG_TOO_LONG')
    return
  }

  if (tags.includes(normalizedTag)) {
    setMessage('TAG_ALREADY_ADDED')
    setDraft('')
    return
  }

  if (tags.length >= POST_TAG_LIMIT) {
    setMessage('TAG_LIMIT_6')
    setDraft('')
    return
  }

  // The client mirrors the server normalization, so users see the exact tag value that will be persisted.
  onChange([...tags, normalizedTag])
  setDraft('')
  setMessage('')
}
```

## 7. 작성 화면 연결

저널/리뷰 작성 화면은 `tags` state를 두고 POST payload에 포함한다.

```tsx
const [tags, setTags] = useState<string[]>([])
```

```tsx
await api.post('/posts', {
  type: 'JOURNAL',
  gameTitle,
  igdbGameId: igdbGameId ?? undefined,
  title: logTitle,
  content: logContent,
  tags,
})
```

```tsx
<PostTagInput
  className="col-span-12"
  onChange={setTags}
  tags={tags}
/>
```

## 8. 수정 모달 연결

수정 모달은 기존 게시글 응답의 `post.tags`를 초기값으로 사용한다.

```tsx
setTags(post.tags?.map((tag) => tag.name) ?? [])
```

PATCH payload에도 `tags`를 포함한다.

```tsx
await api.patch(`/posts/${post.id}`, {
  gameTitle,
  title: logTitle,
  content,
  tags,
})
```

## 9. 검증

```bash
npm.cmd test -- posts.service.spec.ts --runInBand
npm.cmd run build
npm.cmd run lint
npm.cmd run build
git diff --check
```

서비스 테스트는 작성 시 태그 저장, 수정 시 태그 교체, 태그 정규화/중복 제거를 확인한다. 클라이언트 lint와 production build도 통과했다.

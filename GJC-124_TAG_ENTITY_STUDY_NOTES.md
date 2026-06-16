# GJC-124 Tag 엔티티 및 게시글 관계 학습 정리

## 1. 작업 범위

- 백엔드: `Tag` 엔티티 추가
- 백엔드: `ArchivePost`와 `Tag`의 다대다 관계 및 조인 테이블 추가
- 백엔드: 태그 목록 조회/생성 기본 API 추가
- 백엔드: 태그 이름 정규화 및 중복 방지 기준 추가
- 프론트엔드: 게시글 목록/상세 응답이 `tags`를 받을 수 있도록 타입 보강

## 2. Tag 엔티티

태그는 사용자에게 보이는 `name`과 중복 판단에 쓰는 `normalizedName`을 분리해서 저장한다.

```ts
@Entity('Tag')
export class Tag {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  // 같은 의미의 태그가 대소문자/공백/하이픈 차이로 중복 생성되지 않게 unique 기준으로 사용합니다.
  @Index('IDX_tag_normalized_name_unique', { unique: true })
  @Column()
  normalizedName!: string;

  // 여러 태그는 여러 게시글에 붙을 수 있으므로 ArchivePost와 다대다 관계를 맺습니다.
  @ManyToMany(() => ArchivePost, (post) => post.tags)
  posts!: ArchivePost[];
}
```

`normalizedName`은 `tactical rpg`, `TACTICAL-RPG`, `#tactical_rpg`를 모두 `TACTICAL_RPG`로 맞추기 위한 값이다.

## 3. 게시글과 태그 다대다 관계

게시글 하나에는 여러 태그가 붙을 수 있고, 같은 태그는 여러 게시글에서 재사용될 수 있다. 그래서 `ArchivePost`에 `ManyToMany`와 `JoinTable`을 추가했다.

```ts
// 자유 태그는 게시글과 다대다 관계입니다.
// 조인 테이블 이름과 컬럼명을 고정해두면 이후 마이그레이션/쿼리에서 구조를 읽기 쉽습니다.
@ManyToMany(() => Tag, (tag) => tag.posts)
@JoinTable({
  name: 'ArchivePostTag',
  joinColumn: { name: 'postId', referencedColumnName: 'id' },
  inverseJoinColumn: { name: 'tagId', referencedColumnName: 'id' },
})
tags!: Tag[];
```

조인 테이블 이름을 `ArchivePostTag`로 고정했기 때문에 DB에서 `postId`, `tagId` 관계를 바로 파악할 수 있다.

## 4. 태그 정규화

서비스 계층에서 태그 이름을 저장 전에 한 번 정규화한다.

```ts
private normalizeTagName(name: string) {
    return name
        .trim()
        .replace(/^#+/, '')
        .replace(/[\s-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toUpperCase();
}
```

이 규칙은 다음과 같은 입력을 같은 태그로 취급한다.

```ts
'#tactical-rpg'  -> 'TACTICAL_RPG'
'tactical rpg'   -> 'TACTICAL_RPG'
'TACTICAL__RPG'  -> 'TACTICAL_RPG'
```

## 5. 중복 생성 방지

먼저 `normalizedName`으로 기존 태그를 찾고, 없을 때만 생성한다. 동시에 두 요청이 들어오는 상황은 DB unique violation을 한 번 더 처리한다.

```ts
private async findOrCreateTag(name: string) {
    const normalizedName = this.normalizeTagName(name);

    if (!normalizedName) {
        throw new BadRequestException('tag name is required.');
    }

    const existingTag = await this.tagRepository.findOne({
        where: { normalizedName },
    });

    if (existingTag) {
        return existingTag;
    }

    const tag = this.tagRepository.create({
        name: normalizedName,
        normalizedName,
    });

    try {
        return await this.tagRepository.save(tag);
    } catch (error) {
        if (this.isUniqueViolation(error)) {
            const duplicateTag = await this.tagRepository.findOne({
                where: { normalizedName },
            });

            if (duplicateTag) {
                return duplicateTag;
            }
        }

        throw error;
    }
}
```

## 6. 기본 태그 API

컨트롤러에 태그 목록 조회와 생성 API를 추가했다. 클래스 전체에 `JwtAuthGuard`가 적용되어 있으므로 태그 API도 로그인 사용자만 접근할 수 있다.

```ts
@Get('tags')
listTags(@Query('q') q?: string) {
    return this.postsService.listTags(q);
}

@Post('tags')
createTag(@Body() dto: CreateTagDto) {
    return this.postsService.createTag(dto.name);
}
```

생성 요청 DTO는 가장 작은 형태로 시작한다.

```ts
export default class CreateTagDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  name!: string;
}
```

## 7. 목록/상세 조회에서 태그 포함

목록 조회는 `post.tags`를 함께 join한다.

```ts
const postsQuery = this.postRepository
    .createQueryBuilder('post')
    .leftJoinAndSelect('post.game', 'game')
    .leftJoinAndSelect('post.user', 'user')
    .leftJoinAndSelect('post.tags', 'postTag');
```

검색 조건에도 게시글 태그를 포함했다.

```ts
qb.orWhere('postTag.name ILIKE :keyword', {
    keyword: keywordPattern,
});
qb.orWhere('postTag.normalizedName ILIKE :normalizedTag', {
    normalizedTag: `%${this.normalizeTagName(keyword)}%`,
});
```

상세 조회는 relation 옵션에 `tags: true`를 추가했다.

```ts
relations: {
    game: true,
    user: true,
    comments: {
        user: true,
        replies: {
            user: true,
        },
    },
    tags: true,
}
```

## 8. 검증

```bash
npm.cmd test -- posts.service.spec.ts --runInBand
npm.cmd run build
npm.cmd run lint
npm.cmd run build
git diff --check
```

서비스 테스트는 태그 정규화 저장, 기존 태그 재사용, normalized query 검색을 확인한다. 서버 빌드와 클라이언트 lint/build도 통과했다.

# GJC-67 프로필 DB 연동 및 수정 모달 학습 정리

## 1. 이슈 목표

GJC-67은 프로필 화면의 `PLAYER`, bio, gamer tag 더미 값을 로그인 사용자 DB 값으로 바꾸고, 수정 모달에서 저장한 값이 새로고침 뒤에도 유지되도록 연결한 작업입니다. UI의 큰 레이아웃은 유지하고, 데이터 흐름만 실제 API와 DB 기준으로 바꿨습니다.

이번 변경 범위는 다음 파일입니다.

- `server/src/auth/dto/update-profile.dto.ts`
- `server/src/auth/auth.controller.ts`
- `server/src/auth/auth.service.ts`
- `server/src/auth/auth.service.spec.ts`
- `client/src/auth/AuthContext.tsx`
- `client/src/pages/Profile.tsx`
- `client/src/pages/EditProfileModal.tsx`

## 2. 서버 입력 DTO

프로필 수정 API는 nickname, bio, gamerTags만 허용합니다. 전역 `ValidationPipe`가 `whitelist`와 `forbidNonWhitelisted`를 사용하므로 DTO에 없는 필드는 요청에서 거절됩니다.

```ts
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  nickname?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  gamerTags?: string[]
}
```

중요한 점은 `@IsOptional()`입니다. 사용자가 일부 필드만 수정하더라도 나머지 DB 값이 유지되어야 하므로, 모든 수정 필드는 optional로 열어두었습니다.

## 3. PATCH /auth/me API

로그인한 사용자만 자기 프로필을 수정할 수 있도록 기존 `JwtAuthGuard`를 그대로 사용했습니다.

```ts
@UseGuards(JwtAuthGuard)
@Patch('me')
updateMe(@Req() req: AuthedRequest, @Body() dto: UpdateProfileDto) {
  return this.authService.updateProfile(req.user.userId, dto)
}
```

프론트는 userId를 직접 보내지 않습니다. 인증 쿠키에서 검증된 `req.user.userId`를 서버가 사용하므로, 다른 사용자의 프로필을 수정하는 입력을 만들 수 없습니다.

## 4. 저장 전 정규화

서비스는 사용자 행을 조회한 뒤 들어온 필드만 갱신합니다.

```ts
async updateProfile(userId: string, dto: UpdateProfileDto) {
  const user = await this.userRepository.findOneBy({ id: userId })

  if (!user) {
    throw new UnauthorizedException()
  }

  if (dto.nickname !== undefined) {
    const trimmedNickname = dto.nickname.trim()

    if (trimmedNickname.length < 2) {
      throw new BadRequestException('닉네임은 2글자 이상이어야 합니다.')
    }

    user.nickname = trimmedNickname
  }

  if (dto.bio !== undefined) {
    const trimmedBio = dto.bio.trim()
    user.bio = trimmedBio.length > 0 ? trimmedBio : null
  }

  if (dto.gamerTags !== undefined) {
    // Gamer tags are user-facing badges, so normalize them once before saving and rendering.
    user.gamerTags = this.normalizeGamerTags(dto.gamerTags)
  }

  const savedUser = await this.userRepository.save(user)

  return this.safeUser(savedUser)
}
```

닉네임은 trim 이후에도 2글자 이상인지 확인합니다. DTO의 `MinLength`는 공백 포함 문자열을 통과시킬 수 있으므로, 실제 저장 직전에 한 번 더 검사했습니다.

## 5. 게이머 태그 저장 규칙

태그는 화면에 `#HARDCORE_GAMER`처럼 표시되는 badge 데이터입니다. 그래서 서버에서 한 번 정규화해 저장합니다.

```ts
private normalizeGamerTags(tags: string[]) {
  const normalizedTags = tags
    .map((tag) =>
      tag
        .trim()
        .replace(/^#+/, '')
        .replace(/[\s-]+/g, '_')
        .toUpperCase(),
    )
    .filter((tag) => tag.length > 0)

  return [...new Set(normalizedTags)].slice(0, 6)
}
```

이 규칙으로 `#hardcore gamer`, `hardcore-gamer`, `HARDCORE_GAMER`는 같은 `HARDCORE_GAMER`로 저장됩니다. 빈 값은 제거하고, 중복도 제거합니다.

## 6. safeUser 응답 확장

프론트가 DB 값을 표시하려면 `/auth/me` 응답에 필요한 필드가 포함되어야 합니다. 단, `passwordHash` 같은 민감한 값은 계속 제외합니다.

```ts
private safeUser(user: User) {
  return {
    bio: user.bio,
    id: user.id,
    email: user.email,
    gamerTags: user.gamerTags,
    nickname: user.nickname,
    profileImageUrl: user.profileImageUrl,
    steamId: user.steamId,
  }
}
```

이 변경으로 로그인, 회원가입, `/auth/me`, `PATCH /auth/me`가 모두 같은 사용자 응답 모양을 반환합니다.

## 7. 프론트 사용자 타입

AuthContext의 User 타입도 서버 응답과 맞췄습니다.

```ts
type User = {
  bio: string | null
  id: string
  email: string
  gamerTags: string[]
  nickname: string
  profileImageUrl: string | null
  steamId: string | null
}
```

이 타입이 맞아야 Profile 페이지와 EditProfileModal이 더미 값 대신 `user.bio`, `user.gamerTags`, `user.profileImageUrl`를 안전하게 읽을 수 있습니다.

## 8. 프로필 화면 값 연결

Profile 페이지는 기존 레이아웃을 유지하면서 실제 사용자 값을 표시합니다.

```tsx
const gamerTags = user?.gamerTags?.length ? user.gamerTags : ['NO_TAGS']

<img
  alt="Pixelated retro monitor portrait"
  className="w-full h-full object-cover filter grayscale contrast-125 mix-blend-multiply opacity-80"
  src={user?.profileImageUrl ?? profileImage}
/>

<h1 className="font-headline-lg-mobile text-headline-lg-mobile text-[var(--gjc-primary)]">
  {user?.nickname || 'PLAYER'}
</h1>

<p className="font-body-md text-[var(--gjc-on-surface)] leading-relaxed">
  {user?.bio ?? fallbackBio}
  <span className="animate-pulse">_</span>
</p>
```

`PLAYER`는 이제 DB 닉네임이 없거나 빈 문자열인 경우의 fallback으로만 남습니다. 태그는 저장된 배열을 `#{tag}` 형태로 렌더링합니다.

## 9. 깨진 수정 아이콘 교체

기존 수정 버튼은 외부 이미지 URL을 사용하고 있어 깨질 수 있었습니다. 이미 프로젝트에서 쓰는 Material Symbols 아이콘으로 바꿨습니다.

```tsx
<button
  className="w-5 h-5 flex items-center justify-center bg-transparent border-none hover:opacity-70 active:scale-95 transition-all duration-100"
  onClick={() => setIsEditProfileOpen(true)}
  title="Edit Profile"
  type="button"
>
  <span className="material-symbols-outlined text-xl text-[var(--gjc-primary)]">
    edit_square
  </span>
</button>
```

외부 이미지 의존을 제거하면 네트워크/권한/만료 문제 없이 같은 디자인 시스템 안에서 안정적으로 표시됩니다.

## 10. 모달 저장 흐름

모달은 열려 있을 때만 내부 form 컴포넌트를 마운트합니다. 그래서 `useEffect`로 state를 억지로 맞추지 않아도, 열릴 때마다 최신 auth user 값으로 초기화됩니다.

```tsx
function EditProfileModalContent({
  currentUser,
  onClose,
  onSaved,
}: Omit<EditProfileModalProps, 'isOpen'>) {
  // The form mounts only while open, so initial state always comes from the latest DB-backed auth user.
  const [nickname, setNickname] = useState(currentUser?.nickname ?? 'PLAYER')
  const [bio, setBio] = useState(currentUser?.bio ?? '')
  const [gamerTags, setGamerTags] = useState<string[]>(
    currentUser?.gamerTags ?? [],
  )
}
```

저장 버튼은 `PATCH /auth/me`를 호출하고, 성공하면 `onSaved()`로 `/auth/me`를 다시 읽습니다.

```tsx
const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault()
  setIsSaving(true)
  setErrorMessage(null)

  try {
    await api.patch('/auth/me', {
      bio,
      gamerTags,
      nickname,
    })
    await onSaved()
    onClose()
  } catch (error) {
    setErrorMessage(getApiErrorMessage(error, 'PROFILE SAVE FAILED'))
  } finally {
    setIsSaving(false)
  }
}
```

`onSaved()`는 Profile에서 넘긴 `refreshUser`입니다. 이 방식 덕분에 저장 직후 화면이 서버 응답 기준으로 다시 맞춰집니다.

## 11. 테스트 포인트

서비스 테스트는 두 가지를 확인합니다.

```ts
expect(userRepository.save).toHaveBeenCalledWith(
  expect.objectContaining({
    bio: 'Loves long-form RPG critique.',
    gamerTags: ['HARDCORE_GAMER', 'RETRO_PIXEL'],
    nickname: 'DEMO_PLAYER',
  }),
)
```

```ts
await expect(
  service.updateProfile('user-id', { nickname: '   ' }),
).rejects.toBeInstanceOf(BadRequestException)

expect(userRepository.save).not.toHaveBeenCalled()
```

첫 번째는 저장 값 정규화, 두 번째는 공백 닉네임 방어를 검증합니다.

## 12. 전체 흐름

```text
프로필 페이지 진입
  -> AuthProvider가 GET /auth/me 호출
  -> Profile이 user.nickname, user.bio, user.gamerTags 표시

수정 버튼 클릭
  -> EditProfileModalContent가 현재 user 값으로 form 초기화
  -> 사용자 nickname/bio/gamerTags 수정
  -> PATCH /auth/me
  -> AuthService가 trim/normalize 후 User 저장
  -> refreshUser()로 GET /auth/me 재조회
  -> Profile 화면에 저장된 DB 값 반영
```

이 구조는 하드코딩된 프로필 표시를 제거하면서도, 기존 UI 레이아웃과 8-bit 스타일을 유지합니다.

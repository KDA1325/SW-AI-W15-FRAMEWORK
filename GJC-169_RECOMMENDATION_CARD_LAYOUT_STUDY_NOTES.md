# GJC-169 추천 카드 레이아웃 학습 정리

## 1. 이슈 목표

GJC-169는 AI 추천 이유가 길어질 때 카드 안에서 텍스트가 잘리거나 추천 섹션 내부 스크롤바가 생기는 문제를 해결하는 작업입니다. 기존 8-bit 카드 시각 스타일은 유지하되, 추천 카드 목록을 페이지 흐름에 맞는 그리드로 바꿔 페이지 전체 세로 스크롤로 모든 내용을 읽을 수 있게 했습니다.

이번 변경 범위는 다음 파일입니다.

- `client/src/pages/Recommend.tsx`
- `client/src/styles/Recommend.css`

## 2. 고정 높이 카드의 문제

기존 추천 카드는 가로 캐러셀 안에서 고정 높이를 사용했습니다.

```tsx
<article className="w-[300px] h-[460px] ...">
  ...
  <p className="recommend-card-reason ...">
    {card.reason}
  </p>
</article>
```

그리고 추천 이유 문단은 CSS line clamp로 4줄까지만 보이게 되어 있었습니다.

```css
.recommend-card-reason {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
  overflow: hidden;
}
```

이 조합은 카드 높이를 일정하게 유지하기에는 좋지만, AI가 만든 추천 이유가 길어지면 중요한 설명이 잘립니다. GJC-169의 수용 기준은 "긴 추천 설명이 카드 내부에서 잘리지 않는다"이므로, 고정 높이와 line clamp를 제거해야 합니다.

## 3. 내부 스크롤 대신 페이지 흐름에 태운다

추천 목록은 가로 스크롤 컨테이너와 좌우 버튼을 제거하고, 반응형 그리드로 렌더링하도록 바꿨습니다.

```tsx
{syncData?.recommendations.length ? (
  /* Cards flow into the page so long AI reasons expand vertically without a section scrollbar. */
  <div className="recommend-card-grid">
    {syncData.recommendations.map((card) => (
      <article
        className="recommend-card bg-[var(--gjc-surface-container-lowest)] flex flex-col border-2 border-[var(--gjc-primary)] transition-all group shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-4px]"
        key={`${card.externalId.provider}-${card.externalId.id}-${card.rank}`}
      >
        ...
      </article>
    ))}
  </div>
) : (
  <div className="min-h-[260px] border-2 border-dashed border-[var(--gjc-outline-variant)] flex items-center justify-center bg-[var(--gjc-surface-container-lowest)]">
    <span className="font-label-caps text-xs text-[var(--gjc-secondary)] uppercase">
      NO_RECOMMENDATIONS_SYNC_REQUIRED
    </span>
  </div>
)}
```

주석의 핵심은 "추천 카드 섹션 자체가 스크롤 영역이 되지 않는다"입니다. 카드가 많거나 텍스트가 길면 섹션 내부가 아니라 문서 전체 높이가 늘어나고, 사용자는 페이지 스크롤로 내용을 읽습니다.

## 4. 그리드의 반응형 폭 설계

CSS에서는 카드 목록을 `grid`로 만들고, 화면 폭에 맞춰 열 수가 자동으로 바뀌게 했습니다.

```css
.recommend-card-grid {
  align-items: stretch;
  display: grid;
  gap: 1.5rem;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
}
```

여기서 `minmax(min(100%, 280px), 1fr)`가 중요합니다.

- 넓은 화면에서는 카드가 최소 280px 이상을 확보하며 여러 열로 배치됩니다.
- 좁은 화면에서는 `min(100%, 280px)` 덕분에 카드가 컨테이너보다 넓어지지 않습니다.
- `1fr`로 남은 공간을 나눠 가지므로 기존 카드 느낌을 유지하면서도 불필요한 가로 스크롤을 줄입니다.

## 5. 높이는 최소값만 두고 내용에 따라 늘린다

기존 `h-[460px]` 고정 높이는 제거하고, CSS에서 최소 높이만 유지했습니다.

```css
.recommend-card {
  min-height: 460px;
}
```

이렇게 하면 짧은 카드도 기존 카드의 밀도를 유지하고, 긴 추천 이유가 있는 카드는 자연스럽게 더 길어집니다. `grid`의 `align-items: stretch` 덕분에 같은 행의 카드들은 균형 있게 늘어나 카드 목록이 지저분하게 흔들리지 않습니다.

## 6. AI 텍스트는 자르지 않고 줄바꿈한다

추천 이유 문단은 clamp를 제거하고 긴 단어/URL 같은 문자열도 카드 밖으로 밀리지 않도록 했습니다.

```css
.recommend-card-reason {
  /* Recommendation reasons are AI-generated, so cards must grow instead of clipping long text. */
  overflow-wrap: anywhere;
}
```

AI 응답은 사람이 직접 쓴 문구보다 길이와 형태가 예측하기 어렵습니다. 그래서 UI가 특정 줄 수를 강제하기보다, 카드가 커지고 텍스트가 안전하게 줄바꿈되도록 두는 편이 이번 요구사항에 맞습니다.

## 7. 전체 흐름

```text
추천 API 응답 수신
  -> recommendations 배열 렌더링
  -> recommend-card-grid가 카드들을 반응형 열로 배치
  -> 각 recommend-card는 최소 460px 높이 유지
  -> 긴 reason은 clamp 없이 줄바꿈
  -> 섹션 내부 스크롤 없이 페이지 전체 높이가 증가
```

이 구조는 기존 카드의 보더, 그림자, grayscale hover 같은 시각 언어는 유지하면서도, AI 생성 텍스트를 숨기지 않는 레이아웃으로 바꿉니다.

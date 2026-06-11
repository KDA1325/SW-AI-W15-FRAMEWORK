import { useState } from 'react'
import PageChrome from './PageChrome'

function ReviewDetail() {
  const [liked, setLiked] = useState(false)

  return (
    <PageChrome active="journals">
      <main className="mx-auto grid w-full max-w-container-max grid-cols-1 gap-gutter px-margin py-20 md:grid-cols-12">
        <aside className="md:col-span-4">
          <div className="flex aspect-[3/4] items-center justify-center border-4 border-primary bg-surface-variant font-headline-xl text-6xl">
            SS
          </div>
          <div className="mt-6 border-2 border-primary p-4">
            <p className="font-label-caps text-label-caps text-secondary">RATING</p>
            <div className="mt-2 flex gap-1 text-primary">
              {Array.from({ length: 5 }).map((_, index) => (
                <span className="material-symbols-outlined" key={index}>
                  star
                </span>
              ))}
            </div>
          </div>
        </aside>

        <article className="md:col-span-8">
          <p className="mb-2 font-label-caps text-label-caps uppercase text-secondary">
            #SYSTEM_SHOCK
          </p>
          <h1 className="font-headline-xl text-headline-xl uppercase">
            RE-EVALUATING THE INTERFACE
          </h1>
          <div className="my-8 h-1 w-full bg-primary" />
          <p className="font-body-lg text-body-lg leading-relaxed text-on-surface">
            Looking back, what was criticized as cluttered is actually incredibly
            utilitarian. The lack of hand-holding forced cognitive mapping that modern
            games often bypass completely.
          </p>

          <div className="mt-10 flex gap-4 border-t-2 border-primary pt-6">
            <button
              className={`flex items-center gap-2 border border-primary px-3 py-2 font-label-caps text-label-caps ${
                liked ? 'bg-primary text-on-primary' : 'text-primary'
              }`}
              onClick={() => setLiked((current) => !current)}
              type="button"
            >
              {/* 원본 favorite 버튼은 React boolean state로 눌림 상태를 표현하게 바꿨습니다. */}
              <span className="material-symbols-outlined text-[18px]">favorite</span>
              {liked ? 129 : 128}
            </button>
            <button
              className="flex items-center gap-2 border border-primary px-3 py-2 font-label-caps text-label-caps text-primary"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">chat_bubble</span>
              42
            </button>
          </div>
        </article>
      </main>
    </PageChrome>
  )
}

export default ReviewDetail

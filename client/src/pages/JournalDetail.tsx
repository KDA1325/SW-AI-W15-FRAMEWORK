import { useState } from 'react'
import PageChrome from './PageChrome'

const comments = [
  ['PLAYER2', 'Great analysis of the visual fidelity. The subtractive design is indeed a masterpiece.'],
  ['PLAYER3', 'Totally agree. The limited palette makes the atmosphere much more intense.'],
]

function JournalDetail() {
  const [comment, setComment] = useState('')

  return (
    <PageChrome active="journals">
      <main className="mx-auto grid w-full max-w-container-max grid-cols-1 gap-gutter px-margin py-20 md:grid-cols-12">
        <aside className="md:col-span-4">
          <div className="flex aspect-[0.75] items-center justify-center border-4 border-primary bg-surface-variant font-headline-xl text-6xl">
            SOA
          </div>
          <div className="mt-6 border-2 border-primary p-4">
            <p className="mb-1 font-label-caps text-label-caps text-secondary">AUTHOR</p>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center border-2 border-primary bg-surface-variant">
                <span className="material-symbols-outlined">person</span>
              </div>
              <span className="font-ui-button text-ui-button">PLAYER1</span>
            </div>
          </div>
        </aside>

        <article className="md:col-span-8">
          <p className="mb-2 font-label-caps text-label-caps uppercase text-secondary">
            #SHADOWS OF AETERNA
          </p>
          <h1 className="font-headline-xl text-headline-xl uppercase">
            ATTEMPT #44: FINAL SECTOR NOTES
          </h1>
          <div className="my-8 h-1 w-full bg-primary" />
          <p className="font-body-lg text-body-lg leading-relaxed text-on-surface">
            The patterns are becoming clear. Expecting to clear the final sector by
            tonight. Documentation to follow upon success.
          </p>
          <p className="mt-6 font-body-md text-body-md leading-relaxed text-on-surface">
            This detail page was converted from static article HTML into JSX sections,
            with comments represented as data and rendered through `map`.
          </p>

          <section className="mt-12 border-t-2 border-primary pt-8">
            <h2 className="mb-6 font-headline-lg text-headline-lg uppercase">COMMENTS</h2>
            <form
              className="mb-8 flex gap-3"
              onSubmit={(event) => {
                // 원본의 댓글 input 구조를 React form 이벤트로 바꿔 새로고침을 막습니다.
                event.preventDefault()
                setComment('')
              }}
            >
              <input
                className="flex-1 border-2 border-primary bg-surface-container-lowest p-3 font-body-md"
                onChange={(event) => setComment(event.target.value)}
                placeholder="TYPE_COMMENT..."
                value={comment}
              />
              <button
                className="border-2 border-primary bg-primary px-6 font-ui-button text-on-primary hover:bg-surface-container-lowest hover:text-primary"
                type="submit"
              >
                POST
              </button>
            </form>

            <div className="flex flex-col gap-4">
              {comments.map(([author, body]) => (
                <div className="border border-primary bg-white p-4" key={author}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-xs">person</span>
                    <span className="font-label-caps text-label-caps font-bold">{author}</span>
                  </div>
                  <p className="font-body-md text-body-md">{body}</p>
                </div>
              ))}
            </div>
          </section>
        </article>
      </main>
    </PageChrome>
  )
}

export default JournalDetail

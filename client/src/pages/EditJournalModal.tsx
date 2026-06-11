import { useState } from 'react'
import type { FormEvent } from 'react'

type EditJournalModalProps = {
  isOpen: boolean
  onClose: () => void
}

function EditJournalModal({ isOpen, onClose }: EditJournalModalProps) {
  const [gameTitle, setGameTitle] = useState('CYBERNETIC DRIFT')
  const [logTitle, setLogTitle] = useState('NEO-SEOUL REFLECTIONS')
  const [content, setContent] = useState(
    'A deep dive into the neon-soaked streets of Neo-Seoul. The narrative pacing is impeccable, though combat feels dated.',
  )

  if (!isOpen) {
    return null
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    // 원본 form submit 동작을 React onSubmit으로 옮겨 페이지 새로고침을 막습니다.
    event.preventDefault()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-primary/50 p-4">
      <div className="w-full max-w-2xl border-4 border-primary bg-surface-container-lowest p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <div className="mb-8 flex items-center justify-between border-b-4 border-primary pb-4">
          <h2 className="font-headline-lg text-3xl uppercase tracking-widest">
            EDIT_JOURNAL
          </h2>
          <button
            className="p-1 text-primary transition-colors hover:bg-primary hover:text-on-primary"
            onClick={onClose}
            type="button"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2">
            <span className="font-label-caps text-sm uppercase tracking-widest">
              GAME_TITLE
            </span>
            <input
              className="w-full border-2 border-primary bg-surface-container-low p-3 font-label-caps uppercase tracking-wider focus:outline-none focus:ring-0"
              // HTML의 value 속성은 React state와 onChange로 연결해야 수정 가능한 입력칸이 됩니다.
              onChange={(event) => setGameTitle(event.target.value)}
              type="text"
              value={gameTitle}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="font-label-caps text-sm uppercase tracking-widest">
              LOG_TITLE
            </span>
            <input
              className="w-full border-2 border-primary bg-surface-container-low p-3 font-label-caps uppercase tracking-wider focus:outline-none focus:ring-0"
              onChange={(event) => setLogTitle(event.target.value)}
              type="text"
              value={logTitle}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="font-label-caps text-sm uppercase tracking-widest">
              LOG_CONTENT
            </span>
            <div className="flex flex-col border-2 border-primary bg-surface-container-low">
              <div className="flex gap-1 border-b-2 border-primary bg-surface-container-high p-1">
                {['format_bold', 'format_italic', 'format_h1', 'link', 'format_quote', 'image'].map(
                  (icon) => (
                    <button
                      className="flex h-8 w-8 items-center justify-center border border-transparent hover:border-primary hover:bg-surface-container-lowest"
                      key={icon}
                      type="button"
                    >
                      <span className="material-symbols-outlined text-lg">{icon}</span>
                    </button>
                  ),
                )}
              </div>
              <textarea
                className="h-48 w-full border-none bg-transparent p-3 font-body-md text-sm focus:outline-none focus:ring-0"
                onChange={(event) => setContent(event.target.value)}
                placeholder="Enter your journal entry here..."
                value={content}
              />
            </div>
          </label>

          <div className="mt-4 flex flex-col gap-4 md:flex-row">
            <button
              className="flex-grow border-2 border-primary bg-primary py-4 font-ui-button uppercase tracking-widest text-on-primary transition-colors hover:bg-surface-variant hover:text-primary"
              type="submit"
            >
              SAVE
            </button>
            <button
              className="flex-grow border-2 border-primary bg-surface-container-lowest py-4 font-ui-button uppercase tracking-widest text-primary transition-colors hover:bg-surface-variant"
              onClick={onClose}
              type="button"
            >
              CANCEL
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditJournalModal

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { FormEvent } from 'react'
import PageChrome from './PageChrome'
import { api } from '../api'
  
function WriteJournal() {
  const navigate = useNavigate()
  const [gameTitle, setGameTitle] = useState('')
  const [logTitle, setLogTitle] = useState('')
  const [logContent, setContent] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    // 원본 HTML의 submit script를 React onSubmit으로 바꿔 화면 새로고침 없이 상태만 갱신합니다.
    event.preventDefault()
    //setMessage('CHRONICLE_SYNCED')
    try {
        await api.post('/posts', {
          type: 'JOURNAL',
          gameTitle,
          title: logTitle,
          content: logContent,
        })
        
        navigate('/journals')
      } catch {
        setMessage('POST FAILED')
      }
  }

  return (
    <PageChrome active="journals">
      <main className="write-journal-page flex-grow w-full max-w-[1200px] mx-auto px-8 py-20 flex flex-col gap-[80px]">
        <div className="mb-16">
          <h1 className="font-headline-xl text-headline-xl uppercase">#JOURNAL</h1>
          <div className="w-24 h-2 bg-[var(--gjc-primary)] mt-4"></div>
        </div>
        <form className="grid grid-cols-12 gap-x-gutter gap-y-12" onSubmit={handleSubmit}>
          <label className="col-span-12 flex flex-col gap-2">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
              GAME_TITLE *
            </span>
            <input
              className="w-full border-2 border-primary bg-surface p-4 font-body-lg text-body-lg focus:bg-surface focus:text-on-background"
              onChange={(event) => setGameTitle(event.target.value)}
              placeholder="ENTER_GAME_TITLE"
              required
              type="text"
              value={gameTitle}
            />
          </label>

          <label className="col-span-12 flex flex-col gap-2">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
              LOG_TITLE *
            </span>
            <input
              className="w-full border-2 border-primary bg-surface p-4 font-body-md text-body-md focus:bg-surface focus:text-on-background"
              maxLength={120}
              onChange={(event) => setLogTitle(event.target.value)}
              placeholder="ENTER_LOG_TITLE"
              required
              type="text"
              value={logTitle}
            />
          </label>

          <label className="col-span-12 flex flex-col gap-2">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
              LOG_CONTENT *
            </span>
            <div className="flex flex-col border-2 border-primary bg-surface">
              <div className="flex gap-4 border-b-2 border-primary bg-surface-container-low p-2">
                {/* 원본 toolbar 버튼들은 실제 editor 연결 전까지 type="button" 아이콘 버튼으로 유지합니다. */}
                {['format_bold', 'format_italic', 'image'].map((icon) => (
                  <button
                    className="flex items-center justify-center p-1 transition-colors hover:bg-primary hover:text-on-primary"
                    key={icon}
                    type="button"
                  >
                    <span className="material-symbols-outlined">{icon}</span>
                  </button>
                ))}
                <span className="ml-auto self-center pr-2 font-label-caps text-[10px]">
                  MARKDOWN_SUPPORTED
                </span>
              </div>
              <textarea
                className="min-h-[400px] w-full resize-none border-none bg-surface p-6 font-body-md text-body-md focus:bg-surface focus:text-on-background focus:ring-0"
                onChange={(event) => setContent(event.target.value)}
                placeholder="INITIATE_CHRONICLE_ENTRY..."
                required
                value={logContent}
              />
            </div>
          </label>

          <div className="col-span-12 flex flex-col gap-gutter pt-8 md:flex-row">
            <button
              className="flex-grow border-2 border-[var(--gjc-primary)] bg-[var(--gjc-primary)] py-6 font-ui-button text-ui-button uppercase text-[var(--gjc-on-primary)] transition-all duration-75 hover:bg-[var(--gjc-surface)] hover:text-[var(--gjc-primary)] md:min-w-[240px] md:flex-grow-0"
              type="submit"
            >
              POST
            </button>
            <button
              className="flex-grow border-2 border-[var(--gjc-primary)] bg-[var(--gjc-surface)] py-6 font-ui-button text-ui-button uppercase text-[var(--gjc-primary)] transition-all duration-75 hover:bg-[var(--gjc-surface-container)] md:min-w-[240px] md:flex-grow-0"
              type="button"
              onClick={() => navigate('/journals')}
            >
              CANCEL
            </button>
          </div>
        </form>

        {message ? <p className="mt-8 font-label-caps text-primary">{message}</p> : null}
      </main>
    </PageChrome>
  )
}

export default WriteJournal

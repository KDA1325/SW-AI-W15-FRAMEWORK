import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import PageChrome from './PageChrome'
import '../styles/JournalDetail.css'

const coverImage =
  'https://lh3.googleusercontent.com/aida/AP1WRLtN78s0MTEBQJt6pcz19wlnO9zBlj4tZh1c_Ukpc5XsO8-130lWQVPIyXHrpuQcbPdtVnwzmEWBDNfT8N4pMvjlRhETHgWUVf2IEiOw7O-i6KnfBIQB5FXzrOfeE-5zL8KAVwESN7Y1RFsyfSYKpKiq5L7kJu-9ueB9-U9MGmnSQ4klu3KtNomegGIrAykGBrvrQRdTApeXfuHHzSz49E6D7L9AxzJxKpfKGsgX9BtZ26xsmOd332HZsCc'

const captureImage =
  'https://lh3.googleusercontent.com/aida/AP1WRLssxg_Md0VzJ9Ogvg-S_w69wAnblBLFkSwk6GSePzd5xaz7O6PtcztQgm3NIrJRea0D9lrkwktoKzeeOeIowjw0wVKPCtZ9RESe-ll9ajGNhU3N6OQ1I9pRuFKLjYuZRtnoL5M3wvKTnqxhGoIuG1XjFJP7nrHysAzTsGdhYQ_oXjWBLMLvO8gI6TkpqzEmnQTlpXhExhizOjz4vfHa-q1ok2j21iGJJPOPJ6JpPN64NCRGA6ZyCVOrXHSM'

const analysisPoints = [
  'The procedural fog system creates a sense of claustrophobia rarely seen in isometric RPGs.',
  'NPC interactions are sharp, concise, and devoid of modern "quest-marker" handholding.',
  'Combat rhythm mirrors 16-bit classics but demands modern precision.',
]

const comments = [
  {
    author: 'PLAYER2',
    body: 'Great analysis of the visual fidelity. The subtractive design is indeed a masterpiece.',
    date: '2024.10.13',
    replies: [
      {
        author: 'PLAYER3',
        body: 'Totally agree. The limited palette actually makes the atmosphere much more intense.',
        date: '2024.10.14',
      },
    ],
  },
]

const tableOfContents = [
  { label: 'CRITICAL ANALYSIS_01', active: true },
  { label: 'SYSTEM_ANALYSIS' },
  { label: 'NPC_INTERACTIONS' },
  { label: 'COMBAT_RHYTHM' },
  { label: 'VISUAL FIDELITY', active: true },
  { label: 'FINAL REFLECTIONS', active: true },
]

function JournalDetail() {
  const [comment, setComment] = useState('')

  const submitComment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setComment('')
  }

  return (
    <PageChrome active="journals">
      <main className="journal-detail-page mx-auto w-full max-w-[1200px] px-8 py-12">
        <div className="mb-8">
          <Link
            className="inline-flex items-center gap-2 border-2 border-primary bg-background px-4 py-2 font-ui-button text-ui-button uppercase tracking-widest text-primary transition-colors duration-75 hover:bg-primary hover:text-on-primary"
            to="/journals"
          >
            <span aria-hidden="true">&lt;-</span>
            BACK_TO_LIST
          </Link>
        </div>

        <section className="mb-16 grid grid-cols-1 gap-gutter md:grid-cols-12">
          <div className="flex flex-col justify-end md:col-span-8 md:order-1">
            <div className="mb-4">
              <p className="mb-1 font-label-caps text-label-caps text-secondary">AUTHOR</p>
              <a className="group flex items-center gap-3" href="#profile">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden border-2 border-primary bg-surface-variant">
                  <span className="material-symbols-outlined text-primary">person</span>
                </div>
                <span className="font-ui-button text-ui-button group-hover:underline">PLAYER1</span>
              </a>
            </div>

            <p className="mb-2 font-label-caps text-label-caps uppercase text-secondary">
              #SHADOWS OF AETERNA
            </p>
            <h1 className="mb-6 font-headline-xl text-[40px] uppercase leading-none md:text-headline-xl">
              NEO-SEOUL REFLECTIONS
            </h1>

            <div className="grid w-fit grid-cols-1 gap-6 border border-primary bg-white p-6 sm:grid-cols-2">
              <div>
                <p className="mb-1 font-label-caps text-label-caps text-secondary">PLATFORM</p>
                <p className="font-ui-button text-ui-button">PC</p>
              </div>
              <div>
                <p className="mb-1 font-label-caps text-label-caps text-secondary">LOGGED</p>
                <p className="font-ui-button text-ui-button">2024.10.12</p>
              </div>
            </div>
          </div>

          <div className="aspect-[0.75] overflow-hidden border-4 border-primary bg-surface-variant md:order-2 md:col-span-4">
            <img
              alt="Game cover for Shadows of Aeterna"
              className="h-full w-full object-cover grayscale contrast-125"
              src={coverImage}
            />
          </div>
        </section>

        <div className="grid grid-cols-1 gap-16 md:grid-cols-12">
          <article className="space-y-8 font-body-lg text-body-lg md:col-span-8">
            <div>
              <h2 className="mb-6 border-b-2 border-primary pb-2 font-headline-lg text-headline-lg uppercase">
                CRITICAL ANALYSIS_01
              </h2>
              <p className="mb-6 leading-relaxed">
                Walking through the neon-drenched districts of Neo-Seoul in{' '}
                <span className="font-bold italic underline">Shadows of Aeterna</span> feels like
                leafing through a discarded motherboard. The 8-bit aesthetic is not just a
                stylistic choice here; it is a thematic anchor. Every pixel feels heavy, burdened
                by the narrative's bleak outlook on digital consciousness and corporate hegemony.
              </p>

              <ul className="mb-8 list-none space-y-4">
                {analysisPoints.map((point) => (
                  <li className="flex items-start gap-4" key={point}>
                    <span className="material-symbols-outlined mt-1 text-primary">pixel_6</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>

              <h3 className="mb-4 font-headline-lg text-headline-lg-mobile uppercase">
                VISUAL FIDELITY AND ATMOSPHERE
              </h3>
              <p className="mb-8">
                The "Aeterna" engine manages to render complex lighting effects using only a
                4-color palette per sprite. This technical constraint forces the player to engage
                their imagination, filling the gaps between the pixels with their own dread. It is a
                masterpiece of subtractive design.
              </p>

              <figure className="mb-12">
                <div className="border-2 border-primary bg-black p-1">
                  <img
                    alt="Journal capture from a monochrome action platformer scene"
                    className="h-auto w-full grayscale contrast-125"
                    src={captureImage}
                  />
                </div>
                <figcaption className="mt-4 text-center font-label-caps text-label-caps uppercase italic text-secondary">
                  [Fig 1.2] The Desolation of the High Castle - Engine Capture
                </figcaption>
              </figure>

              <p>
                Final reflections: This is not just a game; it is a digital artifact that demands
                to be documented. The Club should prioritize this for the Q4 archive.
              </p>
            </div>

            <section className="mt-12 space-y-8 border-t-2 border-primary pt-12">
              <h2 className="font-headline-lg text-headline-lg uppercase">#COMMENTS</h2>

              <form className="space-y-4 border-2 border-primary bg-white p-6" onSubmit={submitComment}>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">person</span>
                  <span className="font-label-caps text-label-caps uppercase">USER_ID: PLAYER1</span>
                </div>
                <textarea
                  className="h-32 w-full resize-none border border-primary bg-surface-container-lowest p-4 font-body-md focus:border-primary focus:outline-none focus:ring-0"
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="INITIATE_RESPONSE..."
                  value={comment}
                />
                <div className="flex justify-end">
                  <button
                    className="border-2 border-primary bg-primary px-6 py-2 font-ui-button text-ui-button uppercase text-on-primary transition-colors hover:bg-white hover:text-black"
                    type="submit"
                  >
                    POST_COMMENT
                  </button>
                </div>
              </form>

              <div className="space-y-6">
                {comments.map((entry) => (
                  <div className="border border-primary bg-surface-container-lowest p-4" key={entry.author}>
                    <div className="mb-2 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-xs">person</span>
                        <span className="font-label-caps text-label-caps font-bold">{entry.author}</span>
                      </div>
                      <span className="font-label-caps text-xs text-secondary">{entry.date}</span>
                    </div>
                    <p className="font-body-md text-body-md">{entry.body}</p>
                    <div className="mt-4 flex flex-col gap-4">
                      <button
                        className="w-fit font-ui-button text-xs uppercase tracking-widest text-primary hover:underline"
                        type="button"
                      >
                        [ REPLY ]
                      </button>
                      {entry.replies.map((reply) => (
                        <div
                          className="ml-8 mt-4 border-t-2 border-surface-container-highest pt-4"
                          key={reply.author}
                        >
                          <div className="border border-primary bg-white p-4">
                            <div className="mb-2 flex items-center justify-between gap-4">
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-xs">person</span>
                                <span className="font-label-caps text-label-caps font-bold">
                                  {reply.author}
                                </span>
                              </div>
                              <span className="font-label-caps text-xs text-secondary">{reply.date}</span>
                            </div>
                            <p className="font-body-md text-body-md">{reply.body}</p>
                            <button
                              className="mt-4 w-fit font-ui-button text-xs uppercase tracking-widest text-primary hover:underline"
                              type="button"
                            >
                              [ REPLY ]
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </article>

          <aside className="space-y-12 md:col-span-4">
            <section className="border-2 border-primary bg-white">
              <div className="h-10 border-b-2 border-primary journal-hatch-pattern px-4 flex items-center">
                <h4 className="font-label-caps text-label-caps font-bold">TABLE_OF_CONTENTS</h4>
              </div>
              <ul className="space-y-2 p-4 font-label-caps">
                {tableOfContents.map((item) => (
                  <li
                    className={`flex cursor-pointer items-center gap-2 hover:text-primary ${
                      item.active ? 'text-primary hover:underline' : 'pl-4 text-secondary'
                    }`}
                    key={item.label}
                  >
                    {item.active ? (
                      <span className="text-xs">&gt;</span>
                    ) : (
                      <span className="material-symbols-outlined text-xs">pixel_6</span>
                    )}
                    {item.label}
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      </main>
    </PageChrome>
  )
}

export default JournalDetail

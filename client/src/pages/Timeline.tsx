import PageChrome from './PageChrome'

const timelineItems = [
  ['2024.10.25', '14:32:00', 'REVIEW', 'Re-evaluating the Interface', 'DR_CRITIQUE'],
  ['2024.10.24', '09:15:22', 'JOURNAL', 'Attempt #44', 'USER_99'],
  ['2024.10.23', '23:59:59', 'REVIEW', 'System Shock Notes', 'DR_CRITIQUE'],
  ['2024.10.22', '12:00:00', 'JOURNAL', 'Hidden Gems', 'RETRO_FAN'],
]

function Timeline() {
  return (
    <PageChrome active="timeline">
      <main className="timeline-page flex-grow w-full max-w-[1200px] mx-auto px-8 py-20 flex flex-col gap-[80px]">
        <div className="mb-6 flex items-center justify-between border-b-2 border-[var(--gjc-primary)] pb-3">
          <h2 className="mb-16 flex items-center gap-4 font-headline-xl text-headline-xl uppercase">
            {/* <span className="w-2 h-8 bg-[var(--gjc-primary)]"></span> */}
            TIMELINE
          </h2>
        </div>

        <div className="relative flex flex-col gap-10">
          <div className="absolute bottom-0 top-0 hidden border-l-2 border-dashed border-primary opacity-60 md:block" />

          {timelineItems.map(([date, time, type, title, user]) => (
            <article className="group relative flex flex-col gap-6 md:flex-row" key={`${date}-${time}`}>
              <div className="relative flex flex-shrink-0 items-center gap-4 pt-1 md:w-32 md:flex-col md:items-end md:gap-1">
                <div className="hidden font-label-caps text-label-caps text-secondary md:block">
                  {date}
                </div>
                <div className="hidden font-label-caps text-label-caps font-bold text-primary md:block">
                  {time}
                </div>
                <div className="z-20 h-4 w-4 border-2 border-primary bg-on-primary transition-colors duration-0 group-hover:bg-primary md:absolute md:-left-2 md:top-2" />
                <div className="ml-4 font-label-caps text-label-caps text-secondary md:hidden">
                  {date} // {time}
                </div>
              </div>

              <div className="flex-1 border-2 border-primary bg-surface p-6 transition-shadow duration-0 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <div className="mb-6 flex items-center gap-4 border-b border-dashed border-primary pb-4">
                  <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden border-2 border-primary bg-surface">
                    <div className="pixel-hatch absolute inset-0 bg-primary opacity-10" />
                    <span className="material-symbols-outlined z-10 text-primary">
                      {type === 'REVIEW' ? 'science' : 'videogame_asset'}
                    </span>
                  </div>
                  <div>
                    <div className="font-ui-button text-ui-button text-primary">{user}</div>
                    <div className="font-label-caps text-label-caps text-secondary">
                      #GAME TITLE
                    </div>
                  </div>
                  <div className="ml-auto border border-primary bg-surface px-3 py-1 font-label-caps text-label-caps text-primary">
                    {type}
                  </div>
                </div>

                <h2 className="mb-2 font-headline-lg text-headline-lg uppercase text-primary">
                  {title}
                </h2>
                <p className="font-body-md text-body-md text-on-surface">
                  Timeline cards are converted from repeated article HTML into mapped JSX
                  data, preserving the original vertical log layout.
                </p>
              </div>
            </article>
          ))}
        </div>
      </main>
    </PageChrome>
  )
}

export default Timeline

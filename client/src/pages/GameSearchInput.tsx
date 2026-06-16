import { useEffect, useState } from 'react'
import { api, getApiErrorMessage } from '../api'

export type IgdbGameSearchResult = {
  aliases: string[]
  externalId: {
    id: string
    provider: 'igdb'
  }
  genres: string[]
  imageUrl: string | null
  platforms: string[]
  releaseDate: string | null
  sourceUrl: string | null
  summary: string | null
  tags: string[]
  title: string
}

type IgdbGameSearchResponse = {
  error: string | null
  errorCode: string | null
  games: IgdbGameSearchResult[]
  provider: 'igdb'
}

type GameSearchInputProps = {
  inputClassName: string
  onChange: (value: string) => void
  onSelect: (game: IgdbGameSearchResult) => void
  placeholder: string
  selectedIgdbGameId: string | null
  value: string
}

function releaseYear(releaseDate: string | null) {
  return releaseDate ? releaseDate.slice(0, 4) : 'YEAR_UNKNOWN'
}

function secondaryLine(game: IgdbGameSearchResult) {
  const parts = [
    game.aliases[0] ? `AKA ${game.aliases[0]}` : null,
    game.platforms.slice(0, 3).join(' / '),
    releaseYear(game.releaseDate),
  ].filter(Boolean)

  return parts.length ? parts.join(' // ') : 'IGDB_MATCH'
}

function GameSearchInput({
  inputClassName,
  onChange,
  onSelect,
  placeholder,
  selectedIgdbGameId,
  value,
}: GameSearchInputProps) {
  const [games, setGames] = useState<IgdbGameSearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready'>('idle')

  useEffect(() => {
    const query = value.trim()

    if (query.length < 2) {
      return
    }

    let isCancelled = false
    // The effect only schedules the debounced external sync; immediate clearing happens in the input event.
    const timeoutId = window.setTimeout(async () => {
      setStatus('loading')
      setMessage(null)

      try {
        const response = await api.get<IgdbGameSearchResponse>(
          `/posts/games/search?q=${encodeURIComponent(query)}`,
        )

        if (isCancelled) {
          return
        }

        setGames(response.data.games)
        setMessage(
          response.data.error ??
            (response.data.games.length === 0 ? 'NO_IGDB_RESULTS' : null),
        )
        setStatus('ready')
      } catch (error) {
        if (isCancelled) {
          return
        }

        setGames([])
        setMessage(getApiErrorMessage(error, 'IGDB_SEARCH_FAILED'))
        setStatus('ready')
      }
    }, 350)

    return () => {
      isCancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [value])

  const selectGame = (game: IgdbGameSearchResult) => {
    onSelect(game)
    setIsOpen(false)
    setMessage(`IGDB_ID_${game.externalId.id}`)
  }

  return (
    <div className="relative">
      <input
        className={inputClassName}
        onChange={(event) => {
          const nextValue = event.target.value

          onChange(nextValue)
          setIsOpen(true)

          if (nextValue.trim().length < 2) {
            setGames([])
            setMessage(null)
            setStatus('idle')
          }
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        required
        type="text"
        value={value}
      />

      <div className="mt-2 flex min-h-5 items-center justify-between gap-3 font-label-caps text-[10px] uppercase text-on-surface-variant">
        <span>{status === 'loading' ? 'SEARCHING_IGDB' : message}</span>
        {selectedIgdbGameId ? <span>IGDB_ID_{selectedIgdbGameId}</span> : null}
      </div>

      {isOpen && (games.length > 0 || status === 'loading' || message) ? (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 border-2 border-primary bg-[var(--gjc-surface)] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          {games.map((game) => (
            <button
              className="grid w-full grid-cols-[56px_1fr] gap-3 border-b-2 border-primary p-3 text-left transition-colors last:border-b-0 hover:bg-[var(--gjc-primary)] hover:text-[var(--gjc-on-primary)]"
              key={game.externalId.id}
              onClick={() => selectGame(game)}
              type="button"
            >
              {game.imageUrl ? (
                <img
                  alt={`${game.title} cover`}
                  className="h-16 w-14 border-2 border-primary object-cover contrast-125"
                  src={game.imageUrl}
                />
              ) : (
                <span className="flex h-16 w-14 items-center justify-center border-2 border-primary font-headline-lg-mobile text-xl">
                  {game.title.slice(0, 2).toUpperCase()}
                </span>
              )}
              <span className="flex min-w-0 flex-col gap-1">
                <span className="font-headline-lg-mobile text-xl uppercase leading-tight">
                  {game.title}
                </span>
                <span className="font-label-caps text-[10px] uppercase">
                  {secondaryLine(game)}
                </span>
                <span className="line-clamp-2 font-body-md text-xs">
                  {game.summary ?? 'NO_SUMMARY'}
                </span>
              </span>
            </button>
          ))}

          {games.length === 0 ? (
            <div className="p-3 font-label-caps text-[10px] uppercase">
              {status === 'loading' ? 'SEARCHING_IGDB' : message}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default GameSearchInput

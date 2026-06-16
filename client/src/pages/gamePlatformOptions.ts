export const GAME_PLATFORM_OPTIONS = [
  'PC',
  'Steam Deck',
  'PlayStation',
  'Xbox',
  'Nintendo Switch',
  'Nintendo',
  'Mobile',
  'Other',
] as const

export function normalizeGamePlatformOption(value?: string | null) {
  return GAME_PLATFORM_OPTIONS.find((option) => option === value) ?? ''
}

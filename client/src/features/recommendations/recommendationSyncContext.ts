import { createContext, useContext } from 'react'
import type { RecommendArchiveSignalCounts } from '../../pages/RecommendDataNoticeModal'
import type { AiRecommendationSyncResponse } from './types'

export type RecommendationSyncContextValue = {
  archiveSignalCounts: RecommendArchiveSignalCounts
  isDataNoticeOpen: boolean
  isSyncing: boolean
  setIsDataNoticeOpen: (isOpen: boolean) => void
  syncData: AiRecommendationSyncResponse | null
  syncError: string | null
  syncRecommendations: () => Promise<void>
  visibleTags: AiRecommendationSyncResponse['preferenceTags']
  visibleWords: AiRecommendationSyncResponse['wordCloud']
}

export const RecommendationSyncContext =
  createContext<RecommendationSyncContextValue | null>(null)

export function useRecommendationSync() {
  const context = useContext(RecommendationSyncContext)

  if (!context) {
    throw new Error(
      'useRecommendationSync must be used inside RecommendationSyncProvider',
    )
  }

  return context
}

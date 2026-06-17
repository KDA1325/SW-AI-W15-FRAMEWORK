import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { api, getApiErrorMessage } from '../../api'
import { useAuth } from '../../auth/AuthContext'
import type { PostListResponse } from '../../types/posts'
import type { RecommendArchiveSignalCounts } from '../../pages/RecommendDataNoticeModal'
import { normalizeSyncResponse } from './normalize'
import type { AiRecommendationSyncResponse } from './types'
import { RecommendationSyncContext } from './recommendationSyncContext'

export function RecommendationSyncProvider({
  children,
}: {
  children: ReactNode
}) {
  const { isAuthenticated } = useAuth()
  const [isDataNoticeOpen, setIsDataNoticeOpen] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [archiveSignalCounts, setArchiveSignalCounts] =
    useState<RecommendArchiveSignalCounts>({
      isLoading: true,
      journalCount: null,
      reviewCount: null,
    })
  const [syncData, setSyncData] = useState<AiRecommendationSyncResponse | null>(
    null,
  )
  const [syncError, setSyncError] = useState<string | null>(null)
  const syncRequestIdRef = useRef(0)

  const visibleWords = useMemo(
    () => syncData?.wordCloud.slice(0, 16) ?? [],
    [syncData],
  )
  const visibleTags = useMemo(
    () => syncData?.preferenceTags.slice(0, 14) ?? [],
    [syncData],
  )

  useEffect(() => {
    if (!isAuthenticated) {
      const timeoutId = window.setTimeout(() => {
        setSyncData(null)
        setSyncError(null)
      }, 0)

      return () => window.clearTimeout(timeoutId)
    }

    let isMounted = true

    async function loadArchiveSignalCounts() {
      try {
        const countParams = {
          limit: '5',
          mine: 'true',
          page: '1',
          sort: 'latest',
        }
        const reviewParams = new URLSearchParams({
          ...countParams,
          type: 'REVIEW',
        })
        const journalParams = new URLSearchParams({
          ...countParams,
          type: 'JOURNAL',
        })
        const [reviewResponse, journalResponse] = await Promise.all([
          api.get<PostListResponse>(`/posts?${reviewParams.toString()}`),
          api.get<PostListResponse>(`/posts?${journalParams.toString()}`),
        ])

        if (isMounted) {
          setArchiveSignalCounts({
            isLoading: false,
            journalCount: journalResponse.data.total,
            reviewCount: reviewResponse.data.total,
          })
        }
      } catch {
        if (isMounted) {
          setArchiveSignalCounts({
            isLoading: false,
            journalCount: null,
            reviewCount: null,
          })
        }
      }
    }

    async function loadLatestSync() {
      try {
        const response = await api.get<unknown>('/ai/recommendations/latest')
        const latestSync = normalizeSyncResponse(response.data)

        if (isMounted) {
          setSyncData(latestSync)

          if (response.data && !latestSync) {
            setSyncError('AI LAST SYNC DATA INVALID - PLEASE SYNC AGAIN')
          }
        }
      } catch (error) {
        if (isMounted) {
          setSyncError(getApiErrorMessage(error, 'AI LAST SYNC LOAD FAILED'))
        }
      }
    }

    void loadArchiveSignalCounts()
    void loadLatestSync()

    return () => {
      isMounted = false
    }
  }, [isAuthenticated])

  const syncRecommendations = useCallback(async () => {
    const requestOrder = syncRequestIdRef.current + 1
    syncRequestIdRef.current = requestOrder
    setIsSyncing(true)
    setIsDataNoticeOpen(false)
    setSyncError(null)

    try {
      const response = await api.post<unknown>('/ai/recommendations/sync', {
        forceRefresh: true,
        requestId: `gjc-web-sync-${Date.now()}`,
        topK: 12,
      })
      const nextSync = normalizeSyncResponse(response.data)

      if (requestOrder === syncRequestIdRef.current) {
        setSyncData(nextSync)
        setSyncError(nextSync ? null : 'AI SYNC RESPONSE INVALID')
      }
    } catch (error) {
      if (requestOrder === syncRequestIdRef.current) {
        setSyncError(getApiErrorMessage(error, 'AI SYNC FAILED'))
      }
    } finally {
      if (requestOrder === syncRequestIdRef.current) {
        setIsSyncing(false)
      }
    }
  }, [])

  const value = useMemo(
    () => ({
      archiveSignalCounts,
      isDataNoticeOpen,
      isSyncing,
      setIsDataNoticeOpen,
      syncData,
      syncError,
      syncRecommendations,
      visibleTags,
      visibleWords,
    }),
    [
      archiveSignalCounts,
      isDataNoticeOpen,
      isSyncing,
      syncData,
      syncError,
      syncRecommendations,
      visibleTags,
      visibleWords,
    ],
  )

  return (
    <RecommendationSyncContext.Provider value={value}>
      {children}
      <RecommendationSyncStatusPopup isSyncing={isSyncing} />
    </RecommendationSyncContext.Provider>
  )
}

function RecommendationSyncStatusPopup({ isSyncing }: { isSyncing: boolean }) {
  if (!isSyncing) {
    return null
  }

  return (
    <div className="fixed bottom-5 right-5 z-[120] w-[min(320px,calc(100vw-2rem))] border-2 border-primary bg-white p-4 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined syncing-icon text-2xl text-primary">
          sync
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-label-caps text-[10px] uppercase text-primary">
            AI_ANALYSIS_RUNNING
          </p>
          <p className="mt-1 font-body-md text-xs leading-relaxed text-[var(--gjc-secondary)]">
            다른 페이지로 이동해도 추천 분석은 계속 진행됩니다.
          </p>
          <div className="mt-3 h-2 border border-primary p-[2px]">
            <div className="recommend-analyzing-progress h-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

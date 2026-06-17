import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, getApiErrorMessage } from '../../api'
import type { JournalPost, PostListResponse, PostSort } from '../../types/posts'

export type JournalsModal =
  | 'delete-journal'
  | 'delete-review'
  | 'edit-journal'
  | 'edit-review'
  | null

export type JournalLimit = 5 | 10 | 15

const DEFAULT_REVIEW_SORT: PostSort = 'rating'
const DEFAULT_REVIEW_LIMIT: JournalLimit = 10
const DEFAULT_JOURNAL_SORT: PostSort = 'latest'
const DEFAULT_JOURNAL_LIMIT: JournalLimit = 5
const EMPTY_PAGE_INFO = {
  hasNextPage: false,
  hasPreviousPage: false,
  total: 0,
  totalPages: 0,
}

type PageInfo = typeof EMPTY_PAGE_INFO

type JournalsPageSnapshot = {
  journals: JournalPost[]
  journalPageInfo: PageInfo
  reviews: JournalPost[]
  reviewPageInfo: PageInfo
}

const journalsPageCache = new Map<string, JournalsPageSnapshot>()

function parsePostSort(value: string | null, fallback: PostSort): PostSort {
  return value === 'latest' || value === 'oldest' || value === 'rating'
    ? value
    : fallback
}

function parseJournalSort(value: string | null): PostSort {
  return value === 'latest' || value === 'oldest'
    ? value
    : DEFAULT_JOURNAL_SORT
}

function parseJournalLimit(value: string | null): JournalLimit {
  const parsed = Number(value)

  return parsed === 5 || parsed === 10 || parsed === 15
    ? parsed
    : DEFAULT_JOURNAL_LIMIT
}

function parseJournalPage(value: string | null) {
  const parsed = Number(value)

  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1
}

function paginationWindow(currentPage: number, totalPages: number) {
  const lastPage = Math.max(1, totalPages)
  const start = Math.max(1, currentPage - 2)
  const end = Math.min(lastPage, currentPage + 2)

  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
}

function journalsCacheKey({
  journalLimit,
  journalPage,
  journalSort,
  reviewPage,
  reviewSort,
  searchQuery,
}: {
  journalLimit: JournalLimit
  journalPage: number
  journalSort: PostSort
  reviewPage: number
  reviewSort: PostSort
  searchQuery: string
}) {
  return JSON.stringify({
    journalLimit,
    journalPage,
    journalSort,
    reviewPage,
    reviewSort,
    searchQuery,
  })
}

function applySnapshot(
  snapshot: JournalsPageSnapshot,
  setters: {
    setJournalPageInfo: (pageInfo: PageInfo) => void
    setJournals: (posts: JournalPost[]) => void
    setReviewPageInfo: (pageInfo: PageInfo) => void
    setReviews: (posts: JournalPost[]) => void
  },
) {
  setters.setReviews(snapshot.reviews)
  setters.setJournals(snapshot.journals)
  setters.setReviewPageInfo(snapshot.reviewPageInfo)
  setters.setJournalPageInfo(snapshot.journalPageInfo)
}

export function useJournalsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialSearchQuery = searchParams.get('q')?.trim() ?? ''
  const initialReviewSort = parsePostSort(searchParams.get('reviewSort'), DEFAULT_REVIEW_SORT)
  const initialReviewPage = parseJournalPage(searchParams.get('reviewPage'))
  const initialJournalSort = parseJournalSort(searchParams.get('journalSort'))
  const initialJournalLimit = parseJournalLimit(searchParams.get('limit'))
  const initialJournalPage = parseJournalPage(searchParams.get('page'))
  const initialCacheKey = journalsCacheKey({
    journalLimit: initialJournalLimit,
    journalPage: initialJournalPage,
    journalSort: initialJournalSort,
    reviewPage: initialReviewPage,
    reviewSort: initialReviewSort,
    searchQuery: initialSearchQuery,
  })
  const initialSnapshot = journalsPageCache.get(initialCacheKey)
  const [activeModal, setActiveModal] = useState<JournalsModal>(null)
  const [reviews, setReviews] = useState<JournalPost[]>(() => initialSnapshot?.reviews ?? [])
  const [journals, setJournals] = useState<JournalPost[]>(() => initialSnapshot?.journals ?? [])
  const [isLoading, setIsLoading] = useState(!initialSnapshot)
  const [message, setMessage] = useState('')
  const [searchInput, setSearchInput] = useState(initialSearchQuery)
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery)
  const [selectedPost, setSelectedPost] = useState<JournalPost | null>(null)
  const [reviewSort, setReviewSort] = useState<PostSort>(initialReviewSort)
  const [reviewPage, setReviewPage] = useState(initialReviewPage)
  const [journalSort, setJournalSort] = useState<PostSort>(initialJournalSort)
  const [journalLimit, setJournalLimit] = useState<JournalLimit>(initialJournalLimit)
  const [journalPage, setJournalPage] = useState(initialJournalPage)
  const [journalPageInfo, setJournalPageInfo] = useState<PageInfo>(
    () => initialSnapshot?.journalPageInfo ?? EMPTY_PAGE_INFO,
  )
  const [reviewPageInfo, setReviewPageInfo] = useState<PageInfo>(
    () => initialSnapshot?.reviewPageInfo ?? EMPTY_PAGE_INFO,
  )

  const fetchPosts = useCallback(async () => {
    const cacheKey = journalsCacheKey({
      journalLimit,
      journalPage,
      journalSort,
      reviewPage,
      reviewSort,
      searchQuery,
    })
    const cachedSnapshot = journalsPageCache.get(cacheKey)

    if (cachedSnapshot) {
      applySnapshot(cachedSnapshot, {
        setJournalPageInfo,
        setJournals,
        setReviewPageInfo,
        setReviews,
      })
    }

    try {
      setMessage('')
      setIsLoading(true)
      const reviewParams = new URLSearchParams({
        limit: String(DEFAULT_REVIEW_LIMIT),
        page: String(reviewPage),
        type: 'REVIEW',
        mine: 'true',
        sort: reviewSort,
      })
      const journalParams = new URLSearchParams({
        type: 'JOURNAL',
        mine: 'true',
        sort: journalSort,
        limit: String(journalLimit),
        page: String(journalPage),
      })

      if (searchQuery) {
        reviewParams.set('q', searchQuery)
        journalParams.set('q', searchQuery)
      }

      const [reviewResponse, journalResponse] = await Promise.all([
        api.get<PostListResponse>(`/posts?${reviewParams.toString()}`),
        api.get<PostListResponse>(`/posts?${journalParams.toString()}`),
      ])
      const reviewPageData = reviewResponse.data
      const journalPageData = journalResponse.data

      const nextSnapshot = {
        reviews: reviewPageData.items,
        journals: journalPageData.items,
        reviewPageInfo: {
          hasNextPage: reviewPageData.hasNextPage,
          hasPreviousPage: reviewPageData.hasPreviousPage,
          total: reviewPageData.total,
          totalPages: reviewPageData.totalPages,
        },
        journalPageInfo: {
          hasNextPage: journalPageData.hasNextPage,
          hasPreviousPage: journalPageData.hasPreviousPage,
          total: journalPageData.total,
          totalPages: journalPageData.totalPages,
        },
      }

      journalsPageCache.set(cacheKey, nextSnapshot)
      setReviews(reviewPageData.items)
      setJournals(journalPageData.items)
      setReviewPageInfo(nextSnapshot.reviewPageInfo)
      setJournalPageInfo(nextSnapshot.journalPageInfo)

      if (journalPageData.totalPages > 0 && journalPage > journalPageData.totalPages) {
        setJournalPage(journalPageData.totalPages)
      }
      if (reviewPageData.totalPages > 0 && reviewPage > reviewPageData.totalPages) {
        setReviewPage(reviewPageData.totalPages)
      }
    } catch (error) {
      setMessage(getApiErrorMessage(error, 'POSTS LOAD FAILED'))
    } finally {
      setIsLoading(false)
    }
  }, [journalLimit, journalPage, journalSort, reviewPage, reviewSort, searchQuery])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const nextSearchQuery = searchParams.get('q')?.trim() ?? ''

      setSearchInput(nextSearchQuery)
      setSearchQuery(nextSearchQuery)
      setReviewSort(parsePostSort(searchParams.get('reviewSort'), DEFAULT_REVIEW_SORT))
      setReviewPage(parseJournalPage(searchParams.get('reviewPage')))
      setJournalSort(parseJournalSort(searchParams.get('journalSort')))
      setJournalLimit(parseJournalLimit(searchParams.get('limit')))
      setJournalPage(parseJournalPage(searchParams.get('page')))
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [searchParams])

  useEffect(() => {
    const nextParams = new URLSearchParams()

    if (searchQuery) {
      nextParams.set('q', searchQuery)
    }

    if (reviewSort !== DEFAULT_REVIEW_SORT) {
      nextParams.set('reviewSort', reviewSort)
    }

    if (reviewPage !== 1) {
      nextParams.set('reviewPage', String(reviewPage))
    }

    if (journalSort !== DEFAULT_JOURNAL_SORT) {
      nextParams.set('journalSort', journalSort)
    }

    if (journalLimit !== DEFAULT_JOURNAL_LIMIT) {
      nextParams.set('limit', String(journalLimit))
    }

    if (journalPage !== 1) {
      nextParams.set('page', String(journalPage))
    }

    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true })
    }
  }, [journalLimit, journalPage, journalSort, reviewPage, reviewSort, searchParams, searchQuery, setSearchParams])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchPosts()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [fetchPosts])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setReviewPage(1)
      setJournalPage(1)
      setSearchQuery(searchInput.trim())
    }, 350)

    return () => window.clearTimeout(timeoutId)
  }, [searchInput])

  const closeModal = () => {
    setActiveModal(null)
    setSelectedPost(null)
  }

  const openModal = (modal: Exclude<JournalsModal, null>, post: JournalPost) => {
    setSelectedPost(post)
    setActiveModal(modal)
  }

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setReviewPage(1)
    setJournalPage(1)
    setSearchQuery(searchInput.trim())
  }

  const resetFilters = () => {
    setSearchInput('')
    setSearchQuery('')
    setReviewSort(DEFAULT_REVIEW_SORT)
    setReviewPage(1)
    setJournalSort(DEFAULT_JOURNAL_SORT)
    setJournalLimit(DEFAULT_JOURNAL_LIMIT)
    setJournalPage(1)
  }

  return {
    activeModal,
    closeModal,
    fetchPosts,
    handleSearch,
    isLoading,
    journalLimit,
    journalPage,
    journalPageInfo,
    journalPageNumbers: paginationWindow(journalPage, journalPageInfo.totalPages),
    journalSort,
    journals,
    message,
    openModal,
    resetFilters,
    reviewPage,
    reviewPageInfo,
    reviewSort,
    reviews,
    searchInput,
    searchQuery,
    selectedPost,
    setJournalLimit,
    setJournalPage,
    setJournalSort,
    setReviewPage,
    setReviewSort,
    setSearchInput,
  }
}

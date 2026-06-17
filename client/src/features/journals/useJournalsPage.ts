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

export function useJournalsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialSearchQuery = searchParams.get('q')?.trim() ?? ''
  const [activeModal, setActiveModal] = useState<JournalsModal>(null)
  const [reviews, setReviews] = useState<JournalPost[]>([])
  const [journals, setJournals] = useState<JournalPost[]>([])
  const [message, setMessage] = useState('')
  const [searchInput, setSearchInput] = useState(initialSearchQuery)
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery)
  const [selectedPost, setSelectedPost] = useState<JournalPost | null>(null)
  const [reviewSort, setReviewSort] = useState<PostSort>(() =>
    parsePostSort(searchParams.get('reviewSort'), DEFAULT_REVIEW_SORT),
  )
  const [reviewPage, setReviewPage] = useState(() =>
    parseJournalPage(searchParams.get('reviewPage')),
  )
  const [journalSort, setJournalSort] = useState<PostSort>(() =>
    parseJournalSort(searchParams.get('journalSort')),
  )
  const [journalLimit, setJournalLimit] = useState<JournalLimit>(() =>
    parseJournalLimit(searchParams.get('limit')),
  )
  const [journalPage, setJournalPage] = useState(() =>
    parseJournalPage(searchParams.get('page')),
  )
  const [journalPageInfo, setJournalPageInfo] = useState({
    hasNextPage: false,
    hasPreviousPage: false,
    total: 0,
    totalPages: 0,
  })
  const [reviewPageInfo, setReviewPageInfo] = useState({
    hasNextPage: false,
    hasPreviousPage: false,
    total: 0,
    totalPages: 0,
  })

  const fetchPosts = useCallback(async () => {
    try {
      setMessage('')
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

      setReviews(reviewPageData.items)
      setJournals(journalPageData.items)
      setReviewPageInfo({
        hasNextPage: reviewPageData.hasNextPage,
        hasPreviousPage: reviewPageData.hasPreviousPage,
        total: reviewPageData.total,
        totalPages: reviewPageData.totalPages,
      })
      setJournalPageInfo({
        hasNextPage: journalPageData.hasNextPage,
        hasPreviousPage: journalPageData.hasPreviousPage,
        total: journalPageData.total,
        totalPages: journalPageData.totalPages,
      })

      if (journalPageData.totalPages > 0 && journalPage > journalPageData.totalPages) {
        setJournalPage(journalPageData.totalPages)
      }
      if (reviewPageData.totalPages > 0 && reviewPage > reviewPageData.totalPages) {
        setReviewPage(reviewPageData.totalPages)
      }
    } catch (error) {
      setMessage(getApiErrorMessage(error, 'POSTS LOAD FAILED'))
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

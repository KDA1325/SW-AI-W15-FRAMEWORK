export type PostType = 'REVIEW' | 'JOURNAL'

export type PostSort = 'latest' | 'oldest' | 'rating'

export type PostTag = {
  id: string
  name: string
  normalizedName: string
}

export type JournalPost = {
  id: string
  type: PostType
  title: string
  content: string
  rating: number | null
  createdAt: string
  updatedAt: string
  userId: string
  canEdit?: boolean
  game: {
    id: string
    title: string
    imageUrl?: string | null
    platforms?: string[]
  }
  user: {
    id: string
    nickname: string
    profileImageUrl?: string | null
  }
  tags?: PostTag[]
}

export type PostListResponse<TPost = JournalPost> = {
  hasNextPage: boolean
  hasPreviousPage: boolean
  items: TPost[]
  limit: number
  page: number
  sort: PostSort
  total: number
  totalPages: number
}

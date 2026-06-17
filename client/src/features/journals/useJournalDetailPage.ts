import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { api, getApiErrorMessage } from '../../api'
import { useAuth } from '../../auth/AuthContext'
import type { JournalPost } from '../../types/posts'

export type DetailComment = {
  id: string
  postId: string
  userId: string
  content: string
  parentCommentId: string | null
  createdAt: string
  user: {
    nickname: string
    profileImageUrl?: string | null
  }
  replies?: DetailComment[]
}

export type JournalDetailPost = JournalPost & {
  game: JournalPost['game'] & {
    description?: string | null
    genres?: string[]
    platforms?: string[]
    tags?: string[]
  }
  comments?: DetailComment[]
}

export type DetailModal = 'edit-journal' | 'delete-journal' | null

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('ko-KR')
}

export function useJournalDetailPage() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const { postId } = useParams()
  const [post, setPost] = useState<JournalDetailPost | null>(null)
  const [comment, setComment] = useState('')
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingCommentContent, setEditingCommentContent] = useState('')
  const [commentActionId, setCommentActionId] = useState<string | null>(null)
  const [activeModal, setActiveModal] = useState<DetailModal>(null)

  const fetchPost = useCallback(async () => {
    if (!postId) {
      return
    }

    try {
      setIsLoading(true)
      setMessage('')

      const response = await api.get<JournalDetailPost>(`/posts/${postId}`)
      if (response.data.type !== 'JOURNAL') {
        setPost(null)
        setMessage('POST ID NOT FOUND')
        return
      }

      setPost(response.data)
    } catch (error) {
      setPost(null)
      setMessage(getApiErrorMessage(error, 'POST LOAD FAILED'))
    } finally {
      setIsLoading(false)
    }
  }, [postId])

  useEffect(() => {
    if (!postId) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void fetchPost()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [fetchPost, postId])

  const closeModal = () => {
    setActiveModal(null)
  }

  const submitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const content = comment.trim()

    if (!post || !content) {
      return
    }

    try {
      setIsSubmittingComment(true)
      setMessage('')

      const response = await api.post<JournalDetailPost>(`/posts/${post.id}/comments`, {
        content,
      })

      setPost(response.data)
      setComment('')
    } catch (error) {
      setMessage(getApiErrorMessage(error, 'COMMENT SAVE FAILED'))
    } finally {
      setIsSubmittingComment(false)
    }
  }

  const startEditComment = (entry: DetailComment) => {
    setEditingCommentId(entry.id)
    setEditingCommentContent(entry.content)
    setMessage('')
  }

  const cancelEditComment = () => {
    setEditingCommentId(null)
    setEditingCommentContent('')
  }

  const submitCommentEdit = async (entry: DetailComment) => {
    if (!post) {
      return
    }

    const content = editingCommentContent.trim()

    if (!content) {
      setMessage('COMMENT CONTENT REQUIRED')
      return
    }

    try {
      setCommentActionId(entry.id)
      setMessage('')

      const response = await api.patch<JournalDetailPost>(
        `/posts/${post.id}/comments/${entry.id}`,
        { content },
      )

      setPost(response.data)
      cancelEditComment()
    } catch (error) {
      setMessage(getApiErrorMessage(error, 'COMMENT UPDATE FAILED'))
    } finally {
      setCommentActionId(null)
    }
  }

  const deleteComment = async (entry: DetailComment) => {
    if (!post) {
      return
    }

    const confirmed = window.confirm('댓글을 삭제할까요?')

    if (!confirmed) {
      return
    }

    try {
      setCommentActionId(entry.id)
      setMessage('')

      await api.delete(`/posts/${post.id}/comments/${entry.id}`)

      setPost((currentPost) => {
        if (!currentPost) {
          return currentPost
        }

        const removeFromTree = (comments: DetailComment[]): DetailComment[] =>
          comments
            .filter((commentEntry) => commentEntry.id !== entry.id)
            .map((commentEntry) => ({
              ...commentEntry,
              replies: commentEntry.replies
                ? removeFromTree(commentEntry.replies)
                : commentEntry.replies,
            }))

        return {
          ...currentPost,
          comments: removeFromTree(currentPost.comments ?? []),
        }
      })

      if (editingCommentId === entry.id) {
        cancelEditComment()
      }
    } catch (error) {
      setMessage(getApiErrorMessage(error, 'COMMENT DELETE FAILED'))
    } finally {
      setCommentActionId(null)
    }
  }

  const topLevelComments = (post?.comments ?? [])
    .filter((entry) => entry.postId === post?.id && entry.parentCommentId === null)
    .sort((first, second) => first.createdAt.localeCompare(second.createdAt))

  const gameTitle = post?.game.title ?? 'UNKNOWN_GAME'
  const platform = post?.game.platforms?.[0] ?? 'UNKNOWN'
  const author = post?.user.nickname ?? 'PLAYER'
  const authorProfileImageUrl = post?.user.profileImageUrl ?? null
  const currentUserName = user?.nickname ?? 'PLAYER'
  const currentUserProfileImageUrl = user?.profileImageUrl ?? null
  const loggedAt = post ? formatDate(post.createdAt) : '-'
  const statusMessage = postId ? message : 'POST ID NOT FOUND'
  const returnPath = (location.state as { from?: string } | null)?.from ?? '/journals'

  return {
    activeModal,
    author,
    authorProfileImageUrl,
    cancelEditComment,
    closeModal,
    comment,
    commentActionId,
    currentUserName,
    currentUserProfileImageUrl,
    deleteComment,
    editingCommentContent,
    editingCommentId,
    fetchPost,
    gameTitle,
    isLoading,
    isSubmittingComment,
    loggedAt,
    navigateAfterDelete: () => navigate(returnPath),
    platform,
    post,
    postId,
    returnPath,
    setActiveModal,
    setComment,
    setEditingCommentContent,
    startEditComment,
    statusMessage,
    submitComment,
    submitCommentEdit,
    topLevelComments,
    user,
  }
}

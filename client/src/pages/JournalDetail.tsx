import { Link } from 'react-router-dom'
import {
  type DetailComment,
  useJournalDetailPage,
} from '../features/journals/useJournalDetailPage'
import DeleteJournalModal from './DeleteJournalModal'
import EditJournalModal from './EditJournalModal'
import PageChrome from './PageChrome'
import ProfileAvatar, {
  PROFILE_AVATAR_COLOR_IMAGE_CLASS,
} from './ProfileAvatar'
import '../styles/JournalDetail.css'

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('ko-KR')
}

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

function JournalDetail() {
  const {
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
    navigateAfterDelete,
    platform,
    post,
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
  } = useJournalDetailPage()

  const renderCommentActions = (entry: DetailComment) => {
    const canManageComment = user?.id === entry.userId

    if (!canManageComment) {
      return null
    }

    const isEditing = editingCommentId === entry.id
    const isProcessing = commentActionId === entry.id

    return (
      <div className="flex flex-wrap justify-end gap-2">
        {isEditing ? (
          <>
            <button
              className="border border-primary bg-[var(--gjc-primary)] px-3 py-1 font-label-caps text-[10px] font-bold uppercase text-[var(--gjc-on-primary)] transition-colors hover:bg-white hover:text-[var(--gjc-primary)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isProcessing}
              onClick={() => void submitCommentEdit(entry)}
              type="button"
            >
              SAVE
            </button>
            <button
              className="border border-primary bg-white px-3 py-1 font-label-caps text-[10px] font-bold uppercase transition-colors hover:bg-surface-variant disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isProcessing}
              onClick={cancelEditComment}
              type="button"
            >
              CANCEL
            </button>
          </>
        ) : (
          <>
            <button
              className="border border-primary bg-white px-3 py-1 font-label-caps text-[10px] font-bold uppercase transition-colors hover:bg-surface-variant disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isProcessing}
              onClick={() => startEditComment(entry)}
              type="button"
            >
              EDIT
            </button>
            <button
              className="border border-primary bg-[var(--gjc-on-error-fixed)] px-3 py-1 font-label-caps text-[10px] font-bold uppercase text-[var(--gjc-on-primary)] transition-colors hover:bg-surface-variant disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isProcessing}
              onClick={() => void deleteComment(entry)}
              type="button"
            >
              DELETE
            </button>
          </>
        )}
      </div>
    )
  }

  const renderCommentContent = (entry: DetailComment) => {
    if (editingCommentId !== entry.id) {
      return <p className="font-body-md text-body-md">{entry.content}</p>
    }

    return (
      <textarea
        className="min-h-24 w-full resize-none border border-primary bg-white p-3 font-body-md text-body-md focus:border-primary focus:outline-none focus:ring-0"
        onChange={(event) => setEditingCommentContent(event.target.value)}
        value={editingCommentContent}
      />
    )
  }

  return (
    <PageChrome active="journals">
      <main className="journal-detail-page mx-auto w-full max-w-[1200px] px-8 py-12">
        <div className="mb-8">
          <Link
            className="inline-flex items-center gap-2 border-2 border-primary bg-background px-4 py-2 font-ui-button text-ui-button uppercase tracking-widest text-primary transition-colors duration-75 hover:bg-primary hover:text-on-primary"
            to={returnPath}
          >
            <span aria-hidden="true">&lt;-</span>
            BACK_TO_LIST
          </Link>
        </div>

        {statusMessage ? (
          <div className="mb-8 border-2 border-primary bg-surface-container-lowest p-6 font-label-caps text-sm uppercase tracking-widest">
            {statusMessage}
          </div>
        ) : null}

        {isLoading ? (
          <div className="border-2 border-primary bg-surface-container-lowest p-8 font-headline-lg text-2xl uppercase">
            LOADING_JOURNAL...
          </div>
        ) : null}

        {post ? (
          <>
            <section className="mb-16 grid grid-cols-1 gap-gutter md:grid-cols-12">
              <div className="flex flex-col justify-end md:order-1 md:col-span-8">
                {/* 이 태그는 Steam/게임 메타 태그가 아니라 게시글 타입 태그입니다.
                    타임라인 카드 오른쪽에 붙는 REVIEW/JOURNAL 배지와 같은 의미, 같은 디자인을 사용합니다. */}
                <div className="mb-4 w-fit border border-primary bg-surface px-3 py-1 font-label-caps text-label-caps text-primary">
                  {post.type}
                </div>
                <div className="mb-4">
                  <p className="mb-1 font-label-caps text-label-caps text-secondary">AUTHOR</p>
                  <a className="group flex items-center gap-3" href="#profile">
                    <ProfileAvatar
                      alt={`${author} profile`}
                      className="flex h-10 w-10 items-center justify-center overflow-hidden border-2 border-primary bg-surface-variant"
                      imageClassName={PROFILE_AVATAR_COLOR_IMAGE_CLASS}
                      profileImageUrl={authorProfileImageUrl}
                    />
                    <span className="font-ui-button text-ui-button group-hover:underline">{author}</span>
                  </a>
                </div>

                <p className="mb-2 font-label-caps text-label-caps uppercase text-secondary">#{gameTitle}</p>
                <h1 className="mb-6 font-headline-xl text-[40px] uppercase leading-none md:text-headline-xl">
                  {post.title}
                </h1>

                {post.canEdit ? (
                  <div className="mb-6 flex flex-wrap gap-3">
                    {/* canEdit은 서버에서 계산된 "현재 로그인 사용자가 이 글의 작성자인가" 값입니다.
                        타임라인에서 들어온 글이어도 상세 API가 canEdit을 다시 내려주므로
                        내 글이면 여기서 수정/삭제 버튼을 보여줄 수 있습니다. */}
                    <button
                      className="border-2 border-primary bg-surface-container-lowest px-5 py-2 font-ui-button text-xs uppercase tracking-widest text-primary transition-colors hover:bg-primary hover:text-on-primary"
                      onClick={() => setActiveModal('edit-journal')}
                      type="button"
                    >
                      EDIT
                    </button>
                    <button
                      className="border-2 border-primary bg-[var(--gjc-on-error-fixed)] px-5 py-2 font-ui-button text-xs uppercase tracking-widest text-[var(--gjc-on-primary)] transition-colors hover:bg-[var(--gjc-on-primary)] hover:text-[var(--gjc-primary)]"
                      onClick={() => setActiveModal('delete-journal')}
                      type="button"
                    >
                      DELETE
                    </button>
                  </div>
                ) : null}

                <div className="grid w-fit grid-cols-1 gap-6 border border-primary bg-white p-6 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 font-label-caps text-label-caps text-secondary">PLATFORM</p>
                    <p className="font-ui-button text-ui-button">{platform}</p>
                  </div>
                  <div>
                    <p className="mb-1 font-label-caps text-label-caps text-secondary">LOGGED</p>
                    <p className="font-ui-button text-ui-button">{loggedAt}</p>
                  </div>
                </div>
              </div>

              <div className="aspect-[0.75] overflow-hidden border-4 border-primary bg-surface-variant md:order-2 md:col-span-4">
                {post.game.imageUrl ? (
                  <img
                    alt={`${gameTitle} cover`}
                    className="h-full w-full object-cover contrast-125"
                    src={post.game.imageUrl}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-headline-xl text-6xl">
                    {getInitials(gameTitle)}
                  </div>
                )}
              </div>
            </section>

            <div className="grid grid-cols-1 gap-16 md:grid-cols-12">
              <article className="space-y-8 font-body-lg text-body-lg md:col-span-8">
                <div>
                  <p className="whitespace-pre-wrap leading-relaxed">{post.content}</p>

                  {/*
                  {post.game.imageUrl ? (
                    <figure className="mb-12 mt-8">
                       <div className="border-2 border-primary bg-black p-1">
                        <img
                          alt={`${gameTitle} capture`}
                          className="h-auto w-full grayscale contrast-125"
                          src={post.game.imageUrl}
                        />
                      </div> 
                      <figcaption className="mt-4 text-center font-label-caps text-label-caps uppercase italic text-secondary">
                        [Game Archive] {gameTitle}
                      </figcaption>
                    </figure> 
                  ) : null}*/}
                </div>

                <section className="mt-12 space-y-8 border-t-2 border-primary pt-12">
                  <h2 className="font-headline-lg text-headline-lg uppercase">댓글</h2>

                  <form className="space-y-4 border-2 border-primary bg-white p-6" onSubmit={submitComment}>
                    <div className="flex items-center gap-2">
                      <ProfileAvatar
                        alt={`${currentUserName} profile`}
                        className="flex h-6 w-6 items-center justify-center overflow-hidden border border-primary bg-surface-variant"
                        imageClassName={PROFILE_AVATAR_COLOR_IMAGE_CLASS}
                        profileImageUrl={currentUserProfileImageUrl}
                      />
                      <span className="font-label-caps text-label-caps uppercase">USER_ID: {currentUserName}</span>
                    </div>
                    <textarea
                      className="h-32 w-full resize-none border border-primary bg-surface-container-lowest p-4 font-body-md focus:border-primary focus:outline-none focus:ring-0"
                      onChange={(event) => setComment(event.target.value)}
                      placeholder="INITIATE_RESPONSE..."
                      value={comment}
                    />
                    <div className="flex justify-end">
                      <button
                        className="border-2 border-primary bg-[var(--gjc-primary)] px-6 py-2 font-ui-button text-ui-button uppercase text-[var(--gjc-on-primary)] transition-colors hover:bg-[var(--gjc-white)] hover:text-black"
                        disabled={isSubmittingComment}
                        type="submit"
                      >
                        {isSubmittingComment ? '등록중...' : '등록'}
                      </button>
                    </div>
                  </form>

                  <div className="space-y-6">
                    {topLevelComments.length ? (
                      topLevelComments.map((entry) => (
                        <div className="border border-primary bg-surface-container-lowest p-4" key={entry.id}>
                          <div className="mb-2 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                              <ProfileAvatar
                                alt={`${entry.user.nickname} profile`}
                                className="flex h-6 w-6 items-center justify-center overflow-hidden border border-primary bg-surface-variant"
                                imageClassName={PROFILE_AVATAR_COLOR_IMAGE_CLASS}
                                profileImageUrl={entry.user.profileImageUrl}
                              />
                              <span className="font-label-caps text-label-caps font-bold">
                                {entry.user.nickname}
                              </span>
                            </div>
                            <span className="font-label-caps text-xs text-secondary">
                              {formatDate(entry.createdAt)}
                            </span>
                          </div>
                          {renderCommentContent(entry)}
                          <div className="mt-3">{renderCommentActions(entry)}</div>
                          <div className="mt-4 flex flex-col gap-4">
                            <button
                              className="w-fit font-ui-button text-xs uppercase tracking-widest text-primary hover:underline"
                              type="button"
                            >
                              [ REPLY ]
                            </button>
                            {(entry.replies ?? [])
                              // replies는 특정 댓글의 대댓글 목록입니다.
                              // 대댓글도 Comment 테이블의 한 행이므로 postId를 가지고 있습니다.
                              // 혹시 다른 게시글의 대댓글이 섞여 들어오는 상황을 막기 위해
                              // 현재 post.id와 같은 데이터만 한 번 더 필터링합니다.
                              .filter((reply) => reply.postId === post.id)
                              .sort((first, second) => first.createdAt.localeCompare(second.createdAt))
                              .map((reply) => (
                                <div
                                  className="ml-8 mt-4 border-t-2 border-surface-container-highest pt-4"
                                  key={reply.id}
                                >
                                  <div className="border border-primary bg-white p-4">
                                    <div className="mb-2 flex items-center justify-between gap-4">
                                      <div className="flex items-center gap-2">
                                        <ProfileAvatar
                                          alt={`${reply.user.nickname} profile`}
                                          className="flex h-6 w-6 items-center justify-center overflow-hidden border border-primary bg-surface-variant"
                                          imageClassName={PROFILE_AVATAR_COLOR_IMAGE_CLASS}
                                          profileImageUrl={reply.user.profileImageUrl}
                                        />
                                        <span className="font-label-caps text-label-caps font-bold">
                                          {reply.user.nickname}
                                        </span>
                                      </div>
                                      <span className="font-label-caps text-xs text-secondary">
                                        {formatDate(reply.createdAt)}
                                      </span>
                                    </div>
                                    {renderCommentContent(reply)}
                                    <div className="mt-3">{renderCommentActions(reply)}</div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="border border-primary bg-surface-container-lowest p-4 font-label-caps text-xs uppercase text-secondary">
                        NO_COMMENTS_YET
                      </p>
                    )}
                  </div>
                </section>
              </article>

              {/* <aside className="space-y-12 md:col-span-4">
                <section className="border-2 border-primary bg-white">
                  <div className="flex h-10 items-center border-b-2 border-primary px-4 journal-hatch-pattern">
                    <h4 className="font-label-caps text-label-caps font-bold">목차</h4>
                  </div>
                  <ul className="space-y-2 p-4 font-label-caps">
                    {tableOfContents.map((item) => (
                      <li
                        className={`flex cursor-pointer items-center gap-2 hover:text-primary ${
                          item.active ? 'text-primary hover:underline' : 'pl-4 text-secondary'
                        }`}
                        key={item.label}
                      >
                        {item.label}
                      </li>
                    ))}
                  </ul>
                </section>
              </aside> */}
            </div>
          </>
        ) : null}
      </main>

      <EditJournalModal
        isOpen={activeModal === 'edit-journal'}
        post={post}
        onClose={closeModal}
        // 수정 저장이 끝나면 같은 상세 API를 다시 호출합니다.
        // 이렇게 해야 제목, 본문, 게임 제목처럼 수정된 값이 상세 화면에 즉시 반영됩니다.
        onSaved={fetchPost}
      />
      <DeleteJournalModal
        isOpen={activeModal === 'delete-journal'}
        post={post}
        onClose={closeModal}
        // 삭제가 끝나면 현재 상세 페이지의 게시글은 더 이상 존재하지 않습니다.
        // 그래서 모달 안에서 삭제 API가 성공한 뒤, 진입 경로에 맞춰 목록 화면으로 이동합니다.
        // 타임라인에서 들어온 경우 returnPath는 /timeline이고, 기본값은 /journals입니다.
        onDeleted={navigateAfterDelete}
      />
    </PageChrome>
  )
}

export default JournalDetail

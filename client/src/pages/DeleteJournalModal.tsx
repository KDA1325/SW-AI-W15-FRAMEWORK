type DeleteJournalModalProps = {
  isOpen: boolean
  onClose: () => void
}

function DeleteJournalModal({ isOpen, onClose }: DeleteJournalModalProps) {
  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-primary/50 p-4">
      <div className="w-full max-w-md border-4 border-primary bg-surface-container-lowest p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <div className="mb-6 flex items-center justify-between border-b-4 border-primary pb-4">
          {/* 원본 h2 텍스트와 Material Symbol close 버튼을 JSX className 구조로 변환했습니다. */}
          <h2 className="font-headline-lg text-2xl uppercase tracking-widest">
            DELETE_CONFIRMATION
          </h2>
          <button
            className="p-1 text-primary transition-colors hover:bg-primary hover:text-on-primary"
            onClick={onClose}
            type="button"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="mb-8">
          <p className="font-body-md text-sm uppercase leading-relaxed tracking-wider">
            정말로 이 저널 항목을 영구적으로 삭제하시겠습니까?
          </p>
          <div>이 작업은 취소할 수 없습니다.</div>
        </div>

        <div className="flex flex-col gap-4 md:flex-row">
          <button
            className="flex-grow border-2 border-primary bg-primary py-4 font-ui-button uppercase tracking-widest text-on-primary transition-colors hover:bg-surface-container-lowest hover:text-primary"
            onClick={onClose}
            type="button"
          >
            CANCEL
          </button>
          <button
            className="flex-grow border-2 border-primary bg-surface-container-lowest py-4 font-ui-button uppercase tracking-widest text-primary transition-colors hover:border-error hover:bg-error hover:text-on-primary"
            onClick={onClose}
            type="button"
          >
            DELETE
          </button>
        </div>
      </div>
    </div>
  )
}

export default DeleteJournalModal

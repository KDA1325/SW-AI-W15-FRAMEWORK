type RecommendAnalyzingModalProps = {
  isOpen: boolean
  onClose: () => void
}

function RecommendAnalyzingModal({ isOpen, onClose }: RecommendAnalyzingModalProps) {
  if (!isOpen) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="flex flex-col items-center gap-4 border-4 border-primary bg-white p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
        onClick={(event) => event.stopPropagation()}
      >
        {/* 원본 HTML의 cursor-blink 클래스와 progress bar 구조를 JSX로 그대로 옮겼습니다. */}
        <span className="cursor-blink font-headline-xl text-primary uppercase">
          ANALYZING...
        </span>
        <div className="h-4 w-64 border-2 border-primary p-1">
          <div className="recommend-analyzing-progress h-full" />
        </div>
      </div>
    </div>
  )
}

export default RecommendAnalyzingModal

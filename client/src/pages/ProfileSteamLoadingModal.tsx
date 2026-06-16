type ProfileSteamLoadingModalProps = {
  isOpen: boolean
}

function ProfileSteamLoadingModal({ isOpen }: ProfileSteamLoadingModalProps) {
  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/85 px-4 backdrop-blur-[2px]">
      <div className="profile-steam-loading-panel w-full max-w-md border-4 border-primary bg-white p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <div className="mb-5 flex items-start justify-between gap-4 border-b-4 border-primary pb-4">
          <div>
            <p className="mb-2 font-label-caps text-[10px] uppercase tracking-widest text-secondary">
              STEAM_GATEWAY
            </p>
            <h2 className="profile-steam-loading-title font-headline-lg uppercase text-primary">
              SYNCING...
            </h2>
          </div>
          <div className="profile-steam-loading-chip border-2 border-primary px-2 py-1 font-label-caps text-[10px] uppercase text-primary">
            API
          </div>
        </div>

        <div className="mb-5 grid grid-cols-8 gap-1" aria-hidden="true">
          {Array.from({ length: 32 }).map((_, index) => (
            <span
              className="profile-steam-loading-dot block aspect-square border border-primary bg-white"
              key={index}
              style={{ animationDelay: `${(index % 8) * 90}ms` }}
            />
          ))}
        </div>

        <div className="h-4 border-2 border-primary p-1">
          <div className="profile-steam-loading-bar h-full bg-primary" />
        </div>

        <p className="mt-4 font-label-caps text-[10px] uppercase tracking-widest text-secondary">
          FETCHING_PROFILE // FETCHING_STATS
        </p>
      </div>
    </div>
  )
}

export default ProfileSteamLoadingModal

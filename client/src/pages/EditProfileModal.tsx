import { useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { api, getApiErrorMessage } from '../api'
import { resolveProfileImageUrl } from './profileImage'
import '../styles/EditProfileModal.css'

type ProfileUser = {
  bio: string | null
  gamerTags: string[]
  nickname: string
  profileImageUrl: string | null
}

type EditProfileModalProps = {
  currentUser: ProfileUser | null
  isOpen: boolean
  onClose: () => void
  onSaved: () => Promise<void>
}

const MAX_PROFILE_IMAGE_FILE_SIZE_BYTES = 2 * 1024 * 1024
const ALLOWED_PROFILE_IMAGE_TYPES = new Set([
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
])

function normalizeTagInput(value: string) {
  return value
    .trim()
    .replace(/^#+/, '')
    .replace(/[\s-]+/g, '_')
    .toUpperCase()
}

function EditProfileModal({
  currentUser,
  isOpen,
  onClose,
  onSaved,
}: EditProfileModalProps) {
  if (!isOpen) {
    return null
  }

  return (
    <EditProfileModalContent
      currentUser={currentUser}
      onClose={onClose}
      onSaved={onSaved}
    />
  )
}

function EditProfileModalContent({
  currentUser,
  onClose,
  onSaved,
}: Omit<EditProfileModalProps, 'isOpen'>) {
  // The form mounts only while open, so initial state always comes from the latest DB-backed auth user.
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [nickname, setNickname] = useState(currentUser?.nickname ?? 'PLAYER')
  const [bio, setBio] = useState(currentUser?.bio ?? '')
  const [gamerTags, setGamerTags] = useState<string[]>(
    currentUser?.gamerTags ?? [],
  )
  const [newTag, setNewTag] = useState('')
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null)
  const [profileImagePreviewUrl, setProfileImagePreviewUrl] = useState<
    string | null
  >(currentUser?.profileImageUrl ?? null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const addTag = () => {
    const nextTag = normalizeTagInput(newTag)

    if (!nextTag || gamerTags.includes(nextTag) || gamerTags.length >= 6) {
      setNewTag('')
      return
    }

    setGamerTags((currentTags) => [...currentTags, nextTag])
    setNewTag('')
  }

  const removeTag = (tagToRemove: string) => {
    setGamerTags((currentTags) =>
      currentTags.filter((tag) => tag !== tagToRemove),
    )
  }

  const handleProfileImageChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    setErrorMessage(null)

    if (!ALLOWED_PROFILE_IMAGE_TYPES.has(file.type)) {
      setErrorMessage('PNG, JPG, WEBP, GIF IMAGE REQUIRED')
      return
    }

    if (file.size > MAX_PROFILE_IMAGE_FILE_SIZE_BYTES) {
      setErrorMessage('PROFILE IMAGE MUST BE 2MB OR LESS')
      return
    }

    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setErrorMessage('PROFILE IMAGE PREVIEW FAILED')
        return
      }

      setProfileImageFile(file)
      setProfileImagePreviewUrl(reader.result)
    }

    reader.onerror = () => {
      setErrorMessage('PROFILE IMAGE PREVIEW FAILED')
    }

    reader.readAsDataURL(file)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    setErrorMessage(null)

    try {
      await api.patch('/auth/me', {
        bio,
        gamerTags,
        nickname,
      })

      if (profileImageFile) {
        const formData = new FormData()
        formData.append('profileImage', profileImageFile)

        await api.post('/auth/me/profile-image', formData)
      }

      await onSaved()
      onClose()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'PROFILE SAVE FAILED'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="edit-profile-stage bg-background font-body-md text-on-background selection:bg-primary selection:text-on-primary">
      <div className="fixed inset-0 z-50 bg-primary/80 backdrop-blur-sm flex items-center justify-center px-4">
        <div className="bg-surface w-full max-w-xl border-[4px] border-primary relative">
          <div className="h-4 w-full border-b-2 border-primary pixel-hatch" />

          <div className="p-gutter md:p-10">
            <div className="flex items-center gap-4 mb-10">
              <span
                className="material-symbols-outlined text-4xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                edit_square
              </span>
              <h1 className="font-headline-xl text-headline-xl uppercase tracking-tighter">
                EDIT_PROFILE
              </h1>
            </div>

            <form className="space-y-8" onSubmit={handleSubmit}>
              <div className="space-y-4 mb-8">
                <h3 className="font-label-caps text-label-caps text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg">
                    image
                  </span>
                  PROFILE_PICTURE
                </h3>
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 border-2 border-primary bg-surface-dim overflow-hidden flex items-center justify-center p-1">
                    <img
                      alt="Current Profile Picture"
                      className="w-full h-full object-cover filter grayscale contrast-125"
                      src={resolveProfileImageUrl(profileImagePreviewUrl)}
                    />
                  </div>
                  <input
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={handleProfileImageChange}
                    ref={fileInputRef}
                    type="file"
                  />
                  <button
                    className="bg-transparent text-primary px-4 py-2 border border-primary border-dashed hover:bg-primary hover:text-on-primary transition-all group"
                    onClick={() => fileInputRef.current?.click()}
                    type="button"
                  >
                    <span className="font-label-caps text-[12px] flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">
                        upload
                      </span>
                      UPLOAD
                    </span>
                  </button>
                </div>
                {profileImageFile ? (
                  <p className="font-label-caps text-[12px] text-secondary uppercase">
                    SELECTED: {profileImageFile.name}
                  </p>
                ) : null}
              </div>

              <div className="relative">
                <label className="absolute -top-3 left-4 bg-surface px-2 font-label-caps text-label-caps text-primary">
                  NICKNAME
                </label>
                <div className="border-2 border-primary p-4 flex items-center">
                  <span className="font-ui-button text-ui-button text-primary mr-2">
                    &gt;
                  </span>
                  <input
                    className="w-full bg-transparent font-ui-button text-ui-button uppercase text-primary border-none p-0 focus:ring-0"
                    minLength={2}
                    onChange={(event) => setNickname(event.target.value)}
                    type="text"
                    value={nickname}
                  />
                  <span className="blinking-cursor text-primary" />
                </div>
              </div>

              <div className="relative">
                <label className="absolute -top-3 left-4 bg-surface px-2 font-label-caps text-label-caps text-primary">
                  SYSTEM_BIO
                </label>
                <textarea
                  className="w-full border-2 border-primary p-4 bg-transparent font-body-md text-body-md text-on-surface focus:border-primary resize-none placeholder:text-secondary-fixed-dim"
                  onChange={(event) => setBio(event.target.value)}
                  placeholder="INITIALIZING BIOGRAPHY SEQUENCE..."
                  rows={4}
                  value={bio}
                />
              </div>

              <div className="space-y-4">
                <h3 className="font-label-caps text-label-caps text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg">
                    terminal
                  </span>
                  GAMER_TAGS
                </h3>
                <div className="flex flex-wrap gap-3">
                  {gamerTags.map((tag) => (
                    <div
                      className="bg-primary text-on-primary px-3 py-1 border border-primary flex items-center gap-2"
                      key={tag}
                    >
                      <span className="font-label-caps text-[12px]">{tag}</span>
                      <button
                        aria-label={`Remove ${tag}`}
                        className="bg-transparent border-none text-on-primary p-0 cursor-pointer"
                        onClick={() => removeTag(tag)}
                        type="button"
                      >
                        <span className="material-symbols-outlined text-sm hover:text-error transition-colors">
                          close
                        </span>
                      </button>
                    </div>
                  ))}
                  <input
                    className="min-w-[150px] bg-transparent text-primary px-3 py-1 border border-primary border-dashed font-label-caps text-[12px] uppercase focus:ring-0"
                    disabled={gamerTags.length >= 6}
                    onChange={(event) => setNewTag(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        addTag()
                      }
                    }}
                    placeholder="NEW_TAG"
                    type="text"
                    value={newTag}
                  />
                  <button
                    className="bg-transparent text-primary px-3 py-1 border border-primary border-dashed hover:bg-primary hover:text-on-primary transition-all group"
                    disabled={gamerTags.length >= 6}
                    onClick={addTag}
                    type="button"
                  >
                    <span className="font-label-caps text-[12px] flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">
                        add
                      </span>
                      ADD_TAG
                    </span>
                  </button>
                </div>
              </div>

              {errorMessage ? (
                <p className="font-label-caps text-[12px] text-primary uppercase">
                  {errorMessage}
                </p>
              ) : null}

              <div className="pt-6 flex flex-col md:flex-row gap-4">
                <button
                  className="flex-1 border-2 border-primary bg-primary text-on-primary font-ui-button text-ui-button py-4 uppercase hover:bg-surface hover:text-primary transition-all duration-75 active:scale-[0.98]"
                  disabled={isSaving}
                >
                  {isSaving ? 'SAVING' : 'SAVE'}
                </button>
                <button
                  className="flex-1 border-2 border-primary bg-surface text-primary font-ui-button text-ui-button py-4 uppercase hover:bg-primary-fixed hover:text-primary transition-all duration-75 active:scale-[0.98]"
                  onClick={onClose}
                  type="button"
                >
                  CANCEL
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EditProfileModal

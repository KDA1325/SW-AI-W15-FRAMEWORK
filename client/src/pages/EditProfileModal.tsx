import { useState } from 'react'
import type { FormEvent } from 'react'
import '../styles/EditProfileModal.css'

type EditProfileModalProps = {
  isOpen: boolean
  onClose: () => void
}

const profileImageUrl =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuB2INfqYDy75U9V3EX90R4EVkkD1_HaUwUv8FtkImhBQBzInCho3Qs90M5KMn8BVDWnL6Q_2wcM3igbt7dpC0WOZ2Iefo5FZGkIbZEnmyB3ByvC98bl--faX-AfhY3_KZkFnbNfai1gnQwDNkE1uA0qo5as3JD8wSdy3a_8pK3ABjd2UXs5dJMuObGcJJYwNU2zGsDgLZladYk41fFUUMwP8JCqBLaZWxmMiS5QaRxzn5WvVInQYKw33pCwk4HUbkQOEdp_Q7Tx7d8y'

function EditProfileModal({ isOpen, onClose }: EditProfileModalProps) {
  const [nickname, setNickname] = useState('PLAYER1')
  const [bio, setBio] = useState('')

  if (!isOpen) {
    return null
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onClose()
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
                  <span className="material-symbols-outlined text-lg">image</span>
                  PROFILE_PICTURE
                </h3>
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 border-2 border-primary bg-surface-dim overflow-hidden flex items-center justify-center p-1">
                    <img
                      alt="Current Profile Picture"
                      className="w-full h-full object-cover filter grayscale contrast-125"
                      src={profileImageUrl}
                    />
                  </div>
                  <button
                    className="bg-transparent text-primary px-4 py-2 border border-primary border-dashed hover:bg-primary hover:text-on-primary transition-all group"
                    type="button"
                  >
                    <span className="font-label-caps text-[12px] flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">upload</span>
                      UPLOAD
                    </span>
                  </button>
                </div>
              </div>

              <div className="relative">
                <label className="absolute -top-3 left-4 bg-surface px-2 font-label-caps text-label-caps text-primary">
                  NICKNAME
                </label>
                <div className="border-2 border-primary p-4 flex items-center">
                  <span className="font-ui-button text-ui-button text-primary mr-2">&gt;</span>
                  <input
                    className="w-full bg-transparent font-ui-button text-ui-button uppercase text-primary border-none p-0 focus:ring-0"
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
                  <span className="material-symbols-outlined text-lg">terminal</span>
                  GAMER_TAGS
                </h3>
                <div className="flex flex-wrap gap-3">
                  <div className="bg-primary text-on-primary px-3 py-1 border border-primary flex items-center gap-2">
                    <span className="font-label-caps text-[12px]">HARDCORE_GAMER</span>
                    <span className="material-symbols-outlined text-sm cursor-pointer hover:text-error transition-colors">
                      close
                    </span>
                  </div>
                  <div className="bg-primary text-on-primary px-3 py-1 border border-primary flex items-center gap-2">
                    <span className="font-label-caps text-[12px]">NARRATIVE_FOCUSED</span>
                    <span className="material-symbols-outlined text-sm cursor-pointer hover:text-error transition-colors">
                      close
                    </span>
                  </div>
                  <button
                    className="bg-transparent text-primary px-3 py-1 border border-primary border-dashed hover:bg-primary hover:text-on-primary transition-all group"
                    type="button"
                  >
                    <span className="font-label-caps text-[12px] flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">add</span>
                      ADD_TAG
                    </span>
                  </button>
                </div>
              </div>

              <div className="pt-6 flex flex-col md:flex-row gap-4">
                <button className="flex-1 border-2 border-primary bg-primary text-on-primary font-ui-button text-ui-button py-4 uppercase hover:bg-surface hover:text-primary transition-all duration-75 active:scale-[0.98]">
                  SAVE
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

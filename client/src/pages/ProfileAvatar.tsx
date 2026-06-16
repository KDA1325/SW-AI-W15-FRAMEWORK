import { resolveProfileImageUrl } from './profileImage'

export const PROFILE_AVATAR_COLOR_IMAGE_CLASS =
  'h-full w-full object-cover contrast-125'

export const PROFILE_AVATAR_GRAYSCALE_HOVER_IMAGE_CLASS =
  'h-full w-full object-cover grayscale contrast-125 transition-all duration-200 group-hover:grayscale-0'

export const PROFILE_AVATAR_GRAYSCALE_IMAGE_CLASS =
  'h-full w-full object-cover grayscale contrast-125'

type ProfileAvatarProps = {
  alt: string
  className: string
  imageClassName?: string
  profileImageUrl?: string | null
}

function ProfileAvatar({
  alt,
  className,
  imageClassName = PROFILE_AVATAR_GRAYSCALE_IMAGE_CLASS,
  profileImageUrl,
}: ProfileAvatarProps) {
  return (
    <div className={className}>
      <img
        alt={alt}
        className={imageClassName}
        src={resolveProfileImageUrl(profileImageUrl)}
      />
    </div>
  )
}

export default ProfileAvatar

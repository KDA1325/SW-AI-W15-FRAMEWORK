import { resolveProfileImageUrl } from './profileImage'

type ProfileAvatarProps = {
  alt: string
  className: string
  imageClassName?: string
  profileImageUrl?: string | null
}

function ProfileAvatar({
  alt,
  className,
  imageClassName = 'h-full w-full object-cover grayscale contrast-125',
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

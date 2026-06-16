import { join } from 'node:path'

export const PROFILE_IMAGE_MAX_BYTES = 2 * 1024 * 1024
export const PROFILE_IMAGE_PUBLIC_PATH = '/uploads/profile-images'
export const PROFILE_IMAGE_UPLOAD_DIR = join(
  process.cwd(),
  'uploads',
  'profile-images',
)

const PROFILE_IMAGE_EXTENSIONS = {
  'image/gif': '.gif',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
} as const

export type UploadedProfileImage = {
  buffer: Buffer
  mimetype: string
  originalname: string
  size: number
}

export function isAllowedProfileImageMimeType(value: string) {
  return value in PROFILE_IMAGE_EXTENSIONS
}

export function getProfileImageExtension(mimetype: string) {
  if (!isAllowedProfileImageMimeType(mimetype)) {
    return null
  }

  return PROFILE_IMAGE_EXTENSIONS[
    mimetype as keyof typeof PROFILE_IMAGE_EXTENSIONS
  ]
}

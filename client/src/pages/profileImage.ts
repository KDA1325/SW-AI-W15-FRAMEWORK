export const DEFAULT_PROFILE_IMAGE_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuB2INfqYDy75U9V3EX90R4EVkkD1_HaUwUv8FtkImhBQBzInCho3Qs90M5KMn8BVDWnL6Q_2wcM3igbt7dpC0WOZ2Iefo5FZGkIbZEnmyB3ByvC98bl--faX-AfhY3_KZkFnbNfai1gnQwDNkE1uA0qo5as3JD8wSdy3a_8pK3ABjd2UXs5dJMuObGcJJYwNU2zGsDgLZladYk41fFUUMwP8JCqBLaZWxmMiS5QaRxzn5WvVInQYKw33pCwk4HUbkQOEdp_Q7Tx7d8y'

const apiBaseUrl = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000')
  .replace(/\/$/, '')

export function resolveProfileImageUrl(profileImageUrl?: string | null) {
  if (!profileImageUrl) {
    return DEFAULT_PROFILE_IMAGE_URL
  }

  if (
    profileImageUrl.startsWith('http://') ||
    profileImageUrl.startsWith('https://') ||
    profileImageUrl.startsWith('data:')
  ) {
    return profileImageUrl
  }

  if (profileImageUrl.startsWith('/')) {
    return `${apiBaseUrl}${profileImageUrl}`
  }

  return profileImageUrl
}

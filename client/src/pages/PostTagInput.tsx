import { useState } from 'react'

const POST_TAG_LIMIT = 6
const POST_TAG_NAME_LIMIT = 40

type PostTagInputProps = {
  className?: string
  onChange: (tags: string[]) => void
  tags: string[]
}

function normalizePostTagInput(value: string) {
  return value
    .trim()
    .replace(/^#+/, '')
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()
}

function PostTagInput({ className = '', onChange, tags }: PostTagInputProps) {
  const [draft, setDraft] = useState('')
  const [message, setMessage] = useState('')

  const addTag = () => {
    const normalizedTag = normalizePostTagInput(draft)

    if (!normalizedTag) {
      setMessage('TAG_REQUIRED')
      return
    }

    if (normalizedTag.length > POST_TAG_NAME_LIMIT) {
      setMessage('TAG_TOO_LONG')
      return
    }

    if (tags.includes(normalizedTag)) {
      setMessage('TAG_ALREADY_ADDED')
      setDraft('')
      return
    }

    if (tags.length >= POST_TAG_LIMIT) {
      setMessage('TAG_LIMIT_6')
      setDraft('')
      return
    }

    // The client mirrors the server normalization, so users see the exact tag value that will be persisted.
    onChange([...tags, normalizedTag])
    setDraft('')
    setMessage('')
  }

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter((tag) => tag !== tagToRemove))
    setMessage('')
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
        POST_TAGS
      </span>

      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <button
              className="flex items-center gap-2 border-2 border-primary bg-surface-container-low px-3 py-2 font-label-caps text-[10px] uppercase tracking-wider text-primary transition-colors hover:bg-primary hover:text-on-primary"
              key={tag}
              onClick={() => removeTag(tag)}
              type="button"
            >
              #{tag}
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 md:flex-row">
        <input
          className="min-w-0 flex-1 border-2 border-primary bg-surface p-3 font-label-caps uppercase tracking-wider focus:bg-surface focus:text-on-background focus:outline-none focus:ring-0"
          maxLength={POST_TAG_NAME_LIMIT}
          onChange={(event) => {
            setDraft(event.target.value)
            setMessage('')
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              addTag()
            }
          }}
          placeholder="ADD_TAG"
          type="text"
          value={draft}
        />
        <button
          className="border-2 border-primary bg-surface-container-lowest px-5 py-3 font-ui-button text-xs uppercase tracking-widest text-primary transition-colors hover:bg-primary hover:text-on-primary"
          onClick={addTag}
          type="button"
        >
          ADD
        </button>
      </div>

      {message ? (
        <span className="font-label-caps text-[10px] uppercase text-primary">
          {message}
        </span>
      ) : null}
    </div>
  )
}

export default PostTagInput

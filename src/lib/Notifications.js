const NOTIFICATION_EVENT = 'rorisk:notification'

export function notify({ type = 'error', title, message }) {
  window.dispatchEvent(new CustomEvent(NOTIFICATION_EVENT, {
    detail: {
      id: crypto.randomUUID(),
      type,
      title: title || (type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Notification'),
      message: message || 'An unknown error occurred',
    },
  }))
}

export async function copyText(value) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value)
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'absolute'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)
  if (!copied) throw new Error('Copy failed')
}

export { NOTIFICATION_EVENT }

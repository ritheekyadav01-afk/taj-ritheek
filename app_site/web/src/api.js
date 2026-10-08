// api.js: the only place that talks to the Flask API.
import { ApiError } from './errors'

export { ApiError }

// Demo build (GitHub Pages): the same API answered in the browser from sample data.
export const DEMO = import.meta.env.VITE_DEMO === '1'

export async function api(path, { method = 'GET', body } = {}) {
  if (DEMO) {
    const { demoRequest } = await import('./demo')
    return demoRequest(path, method, body)
  }
  let res
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, {
      error: 'network',
      message: "The Taj Ritheek server isn't answering. Check that the API is running.",
    })
  }
  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  if (res.status === 401 && data && data.error === 'login' && !path.startsWith('/login')) {
    window.dispatchEvent(new Event('taj-auth'))   // the session ended: show the sign-in screen
  }
  if (!res.ok) throw new ApiError(res.status, data || { message: res.statusText })
  return data
}

export const get = (p) => api(p)
export const post = (p, body = {}) => api(p, { method: 'POST', body })
export const put = (p, body) => api(p, { method: 'PUT', body })
export const patch = (p, body) => api(p, { method: 'PATCH', body })
export const del = (p) => api(p, { method: 'DELETE' })

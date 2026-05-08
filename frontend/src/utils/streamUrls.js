/**
 * Derive MediaMTX HLS + WHEP pair from stored playback URL and optional stream key.
 * Standard layout: http://host:8888/live/<key>/index.m3u8 and http://host:8889/live/<key>/whep
 *
 * @param {string} [streamUrl]
 * @param {string|null} [streamKey]
 * @returns {{ hls: string, whep: string }}
 */
export function deriveMediaMtxPair(streamUrl, streamKey) {
  let hls = ''
  let whep = ''

  if (streamUrl && typeof streamUrl === 'string') {
    const t = streamUrl.trim()
    if (t) {
      try {
        const u = new URL(t)
        const p = u.pathname

        if (/\/whep\/?$/i.test(p)) {
          whep = t
          const copy = new URL(t)
          copy.port = '8888'
          const base = p.replace(/\/whep\/?$/i, '')
          copy.pathname = `${base}/index.m3u8`
          hls = copy.href
        } else if (/\.m3u8/i.test(p) || /index\.m3u8/i.test(p)) {
          hls = t
          const copy = new URL(t)
          copy.port = '8889'
          const base = p.replace(/\/index\.m3u8.*$/i, '')
          copy.pathname = `${base}/whep`
          whep = copy.href
        }
      } catch {
        /* ignore */
      }
    }
  }

  const envHost =
    (import.meta.env.VITE_MEDIAMTX_HOST && String(import.meta.env.VITE_MEDIAMTX_HOST).trim()) || ''

  if (streamKey && envHost && (!hls || !whep)) {
    const host = envHost.replace(/^https?:\/\//, '').replace(/\/$/, '')
    if (!hls) hls = `http://${host}:8888/live/${streamKey}/index.m3u8`
    if (!whep) whep = `http://${host}:8889/live/${streamKey}/whep`
  }

  return { hls, whep }
}

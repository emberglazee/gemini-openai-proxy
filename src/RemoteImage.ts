export async function fetchAndEncode(url: string, fetchFn: typeof fetch = fetch) {
    const res = await fetchFn(url)
    if (!res.ok) throw new Error(`Failed to fetch image: ${url}`)
    const buf = Buffer.from(await res.arrayBuffer())
    const mimeType = res.headers.get('content-type') || 'image/png'
    return { mimeType, data: buf.toString('base64') }
}

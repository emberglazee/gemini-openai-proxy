import { fetchAndEncode } from '../src/RemoteImage'
import { describe, it, expect, mock } from 'bun:test'

describe('fetchAndEncode', () => {
    it('should fetch and encode an image', async () => {
        const mockFetch = mock(async (_url: string) => {
            return new Response(Buffer.from('test'), {
                headers: { 'content-type': 'image/png' }
            })
        })

        const result = await fetchAndEncode('http://example.com/test.png', mockFetch as any)

        expect(result).toEqual({
            mimeType: 'image/png',
            data: 'dGVzdA=='
        })
    })

    it('should throw an error if the fetch fails', async () => {
        const mockFetch = mock(async (_url: string) => {
            return new Response('Not Found', { status: 404 })
        })

        expect(fetchAndEncode('http://example.com/test.png', mockFetch as any)).rejects.toThrow(
            'Failed to fetch image: http://example.com/test.png'
        )
    })
})

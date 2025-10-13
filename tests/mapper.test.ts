import { mapRequest, mapResponse, mapStreamChunk } from '../src/Mapper'
import { describe, it, expect, mock } from 'bun:test'

describe('mapper', () => {
    describe('mapRequest', () => {
        it('should map an OpenAI request to a Gemini request', async () => {
            const body = {
                messages: [{ content: 'test' }],
                temperature: 0.5,
                max_tokens: 100,
                top_p: 0.9
            }

            const { geminiReq } = await mapRequest(body)

            expect(geminiReq).toEqual({
                contents: [{ role: 'user', parts: [{ text: 'test' }] }],
                generationConfig: {
                    temperature: 0.5,
                    maxOutputTokens: 100,
                    topP: 0.9,
                    maxInputTokens: 1000000
                },
                stream: undefined
            })
        })

        it('should handle image URLs', async () => {
            const body = {
                messages: [
                    {
                        content: [
                            { type: 'text', text: 'test' },
                            { type: 'image_url', image_url: { url: 'http://example.com/test.png' } }
                        ]
                    }
                ]
            }

            const mockFetch = mock(async (_url: string) => {
                return new Response(Buffer.from('test'), {
                    headers: { 'content-type': 'image/png' }
                })
            })

            const { geminiReq } = await mapRequest(body, mockFetch as any)

            expect(geminiReq.contents[0].parts).toEqual([
                { text: 'test' },
                { inlineData: { mimeType: 'image/png', data: 'dGVzdA==' } }
            ])
        })
    })

    describe('mapResponse', () => {
        it('should map a Gemini response to an OpenAI response', () => {
            const gResp = {
                text: 'test',
                usageMetadata: {
                    promptTokens: 10,
                    candidatesTokens: 20,
                    totalTokens: 30
                },
                candidates: [{}]
            }

            const result = mapResponse(gResp)

            expect(result.choices?.[0].message.content).toBe('test')
            expect(result.usage).toEqual({
                prompt_tokens: 10,
                completion_tokens: 20,
                total_tokens: 30
            })
        })

        it('should handle errors', () => {
            const gResp = {
                promptFeedback: {
                    blockReason: 'test reason'
                }
            }

            const result = mapResponse(gResp)

            expect(result.error?.message).toBe('test reason')
        })
    })

    describe('mapStreamChunk', () => {
        it('should map a Gemini stream chunk to an OpenAI stream chunk', () => {
            const chunk = {
                candidates: [
                    {
                        content: {
                            parts: [{ text: 'test' }]
                        }
                    }
                ]
            }

            const result = mapStreamChunk(chunk)

            expect(result.choices[0].delta.content).toBe('test')
        })
    })
})

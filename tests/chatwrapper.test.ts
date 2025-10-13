import { init, sendChat, sendChatStream, listModels, getModel } from '../src/chatwrapper'
import { describe, it, expect, mock } from 'bun:test'
import { DEFAULT_GEMINI_MODEL } from '@google/gemini-cli-core'

mock.module('@google/gemini-cli-core', () => ({
    createContentGeneratorConfig: async () => ({ model: DEFAULT_GEMINI_MODEL }),
    createContentGenerator: async () => ({
        generateContent: async () => ({ text: 'test' }),
        generateContentStream: async function* () {
            yield { text: 'test' }
        }
    }),
    DEFAULT_GEMINI_MODEL
}))

describe('chatwrapper', () => {
    it('should initialize the content generator', async () => {
        await init()
        expect(getModel()).toBe(DEFAULT_GEMINI_MODEL)
    })

    it('should send a chat message', async () => {
        await init()
        const result = await sendChat({ contents: [] })
        expect(result.text).toBe('test')
    })

    it('should send a chat message as a stream', async () => {
        await init()
        const stream = sendChatStream({ contents: [] })
        for await (const chunk of stream) {
            expect(chunk.text).toBe('test')
        }
    })

    it('should report the Gemini 2.5 Pro model', async () => {
        await init()
        const models = listModels()
        expect(models[0]).toHaveProperty('id', 'gemini-2.5-pro')
    })
})

import { init, sendChat, sendChatStream, listModels } from '../src/ChatWrapper'
import { describe, it, expect, mock, beforeAll } from 'bun:test'

mock.module('@google/gemini-cli-core', () => ({
    createContentGeneratorConfig: async (model: string) => ({ model: `models/${model}` }),
    createContentGenerator: async () => ({
        generateContent: async () => ({ text: 'test' }),
        generateContentStream: async function* () {
            yield { text: 'test' }
        }
    })
}))

describe('chatwrapper', () => {
    beforeAll(() => {
        init()
    })

    it('should send a chat message for a supported model', async () => {
        const result = await sendChat({ model: 'gemini-2.5-pro', contents: [] })
        expect(result.text).toBe('test')
    })

    it('should send a chat message as a stream for a supported model', async () => {
        const stream = sendChatStream({ model: 'gemini-2.5-flash', contents: [] })
        for await (const chunk of stream) {
            expect(chunk.text).toBe('test')
        }
    })

    it('should list available models', () => {
        const models = listModels()
        expect(models.length).toBe(3)
        expect(models[0]).toHaveProperty('id', 'gemini-2.5-pro')
        expect(models[1]).toHaveProperty('id', 'gemini-2.5-flash')
        expect(models[2]).toHaveProperty('id', 'gemini-2.5-flash-lite')
    })

    it('should throw an error for an unsupported model in sendChat', async () => {
        await expect(sendChat({ model: 'unsupported-model', contents: [] })).rejects.toThrow(
            'Model unsupported-model not supported or initialized.'
        )
    })

    it('should throw an error for an unsupported model in sendChatStream', async () => {
        const stream = sendChatStream({ model: 'unsupported-model', contents: [] })
        await expect(stream.next()).rejects.toThrow(
            'Model unsupported-model not supported or initialized.'
        )
    })
})
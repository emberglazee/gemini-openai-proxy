/* ---------------------------------- */
/*   mapper.ts – OpenAI <==> Gemini   */
/* ---------------------------------- */

import { Logger } from './Logger'
const logger = new Logger('Mapper')

import { fetchAndEncode } from './RemoteImage'
import { z } from 'zod'
import { ToolRegistry } from '@google/gemini-cli-core/dist/src/tools/tool-registry.js'
import { getModel } from './ChatWrapper'
import { inspect } from 'util'

/* ------------------------------------------------------------------ */
type Part = { text?: string, inlineData?: { mimeType: string, data: string } }

/* ------------------------------------------------------------------ */
async function callLocalFunction(_name: string, _args: unknown) {
    return { ok: true }
}

/* ==================================== */
/*   Request mapper: OpenAI => Gemini   */
/* ==================================== */
export async function mapRequest(body: any, fetchFn: typeof fetch = fetch) {
    const parts: Part[] = []

    /* ---- convert messages & vision --------------------------------- */
    for (const m of body.messages) {
        if (Array.isArray(m.content)) {
            for (const item of m.content) {
                if (item.type === 'image_url') {
                    parts.push({ inlineData: await fetchAndEncode(item.image_url.url, fetchFn) })
                } else if (item.type === 'text') {
                    parts.push({ text: item.text })
                }
            }
        } else {
            parts.push({ text: m.content })
        }
    }

    /* ---- base generationConfig ------------------------------------- */
    const generationConfig: Record<string, unknown> = {
        temperature: body.temperature,
        maxOutputTokens: body.max_tokens,
        topP: body.top_p,
        ...(body.generationConfig ?? {}) // copy anything ST already merged
    }
    if (body.include_reasoning === true) {
        generationConfig.enable_thoughts = true   // ← current flag
        generationConfig.thinking_budget ??= 2048 // optional limit
    }

    /* ---- auto-enable reasoning & 1 M context ----------------------- */
    if (body.include_reasoning === true && generationConfig.thinking !== true) {
        generationConfig.thinking = true
        generationConfig.thinking_budget ??= 2048
    }
    generationConfig.maxInputTokens ??= 1_000_000 // lift context cap

    const geminiReq = {
        contents: [{ role: 'user', parts }],
        generationConfig,
        stream: body.stream
    }

    logger.info(`Mapped Gemini request:\n${geminiReq}`)

    /* ---- Tool / function mapping ----------------------------------- */
    const tools = new ToolRegistry({} as any)

    if (body.functions?.length) {
        const reg = tools as any
        body.functions.forEach((fn: any) =>
            reg.registerTool(
                fn.name,
                {
                    title: fn.name,
                    description: fn.description ?? '',
                    inputSchema: z.object(fn.parameters?.properties ?? {})
                },
                async (args: unknown) => callLocalFunction(fn.name, args)
            )
        )
    }

    return { geminiReq, tools }
}

/* ========================================= */
/*   Non-stream response: Gemini => OpenAI   */
/* ========================================= */
export function mapResponse(gResp: any) {
    const usage = gResp.usageMetadata ?? {}
    const hasError = typeof gResp.candidates === 'undefined'

    logger.info(`Received Gemini response:\n${inspect(gResp, true, 1, true)}`)

    if (hasError) {
        logger.warn('Invalid response. No candidates returned.')

        return {
            error: {
                message: gResp?.promptFeedback?.blockReason ?? 'No candidates returned.'
            }
        }
    }

    return {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: getModel(),
        choices: [
            {
                index: 0,
                message: { role: 'assistant', content: gResp.text },
                finish_reason: 'stop'
            }
        ],
        usage: {
            prompt_tokens: usage.promptTokens ?? 0,
            completion_tokens: usage.candidatesTokens ?? 0,
            total_tokens: usage.totalTokens ?? 0
        }
    }
}

/* ========================================= */
/*   Stream chunk mapper: Gemini ➞ OpenAI   */
/* ========================================= */

export function mapStreamChunk(chunk: any) {
    const part = chunk?.candidates?.[0]?.content?.parts?.[0] ?? {}
    const delta: any = { role: 'assistant' }

    if (part.thought === true) {
        delta.content = `<think>${part.text ?? ''}` // ST renders grey bubble
    } else if (typeof part.text === 'string') {
        delta.content = part.text
    }
    return { choices: [ { delta, index: 0 } ] }
}

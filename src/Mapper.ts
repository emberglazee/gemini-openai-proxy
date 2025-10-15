/* ---------------------------------- */
/*   mapper.ts – OpenAI <==> Gemini   */
/* ---------------------------------- */

import { Logger } from './Logger'
const logger = new Logger('Mapper')

import { fetchAndEncode } from './RemoteImage'
import { z } from 'zod'
import { ToolRegistry } from '@google/gemini-cli-core/dist/src/tools/tool-registry.js'

import { inspect } from 'util'

import { GenerateContentResponse } from '@google/genai'
import type OpenAI from 'openai'

/* ------------------------------------------------------------------ */
type Part = { text?: string, inlineData?: { mimeType: string, data: string } }

/* ------------------------------------------------------------------ */
async function callLocalFunction(_name: string, _args: unknown) {
    return { ok: true }
}

/* ==================================== */
/*   Request mapper: OpenAI => Gemini   */
/* ==================================== */
export async function mapRequest(body: OpenAI.ChatCompletionCreateParams, fetchFn: typeof fetch = fetch) {
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
            parts.push({ text: m.content ?? undefined })
        }
    }

    /* ---- base generationConfig ------------------------------------- */
    const generationConfig: Record<string, unknown> = {
        temperature: body.temperature,
        maxOutputTokens: body.max_completion_tokens,
        topP: body.top_p
    }
    if (body.reasoning_effort) {
        generationConfig.enable_thoughts = true   // ← current flag
        generationConfig.thinking_budget ??= 8092 // optional limit
    }

    generationConfig.maxInputTokens ??= 1_048_576 // Exact 2^20 input token limit

    const geminiReq = {
        model: body.model,
        contents: [{ role: 'user', parts }],
        generationConfig,
        stream: body.stream
    }

    logger.info(`Mapped Gemini request:\n${inspect(geminiReq, true, 1, true)}}`)

    /* ---- Tool / function mapping ----------------------------------- */
    const tools = new ToolRegistry({} as any)

    if (body.tools?.length) {
        const reg = tools as any
        body.tools.forEach((fn: any) =>
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
export function mapResponse(res: GenerateContentResponse, model: string): OpenAI.ChatCompletion | { error: { message: string } } {
    const hasError = typeof res.candidates === 'undefined'

    logger.info(`Received Gemini response:\n${inspect(res, true, 1, true)}`)

    if (hasError) {
        logger.warn('Invalid response. No candidates returned.')

        return {
            error: {
                message: res?.promptFeedback?.blockReason ?? 'No candidates returned.'
            }
        }
    }

    return {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: model,
        choices: [{
            index: 0,
            message: { role: 'assistant', content: res.text ?? null, refusal: null },
            finish_reason: 'stop',
            logprobs: null
        }],
        usage: {
            completion_tokens: res.usageMetadata?.candidatesTokenCount ?? 0,
            prompt_tokens: res.usageMetadata?.promptTokenCount ?? 0,
            total_tokens: res.usageMetadata?.totalTokenCount ?? 0,
            completion_tokens_details: {
                reasoning_tokens: res.usageMetadata?.thoughtsTokenCount
            },
            prompt_tokens_details: {
                cached_tokens: res.usageMetadata?.cachedContentTokenCount
            }
        }
    }
}

/* ========================================= */
/*   Stream chunk mapper: Gemini => OpenAI   */
/* ========================================= */

export function mapStreamChunk(chunk: GenerateContentResponse, model: string): OpenAI.ChatCompletionChunk {
    const part = chunk?.candidates?.[0]?.content?.parts?.[0] ?? {}
    const delta = { role: 'assistant' as const, content: '' }

    if (part.thought === true) {
        delta.content = `<think>${part.text ?? ''}` // ST renders grey bubble
    } else if (typeof part.text === 'string') {
        delta.content = part.text
    }
    return {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{
            delta, index: 0,
            finish_reason: null
        }],
        service_tier: 'default',
        usage: {
            completion_tokens: chunk.usageMetadata?.candidatesTokenCount ?? 0,
            prompt_tokens: chunk.usageMetadata?.promptTokenCount ?? 0,
            total_tokens: chunk.usageMetadata?.totalTokenCount ?? 0,
            completion_tokens_details: {
                reasoning_tokens: chunk.usageMetadata?.thoughtsTokenCount
            },
            prompt_tokens_details: {
                cached_tokens: chunk.usageMetadata?.cachedContentTokenCount
            }
        }
    }
}

// src/chatwrapper.ts
import {
    AuthType as AuthTypeEnum,
    createContentGeneratorConfig,
    createContentGenerator,
    type ContentGenerator
} from '@google/gemini-cli-core/dist/src/core/contentGenerator.js'
import { DEFAULT_GEMINI_MODEL } from '@google/gemini-cli-core'
import { OpenAI } from 'openai'

const authType: AuthTypeEnum = (process.env.AUTH_TYPE ?? 'gemini-api-key') as AuthTypeEnum

console.log(`Auth type: ${authType}`)

const model = (process.env.MODEL ?? DEFAULT_GEMINI_MODEL)

if (model) {
    console.log(`Model override: ${model}`)
}

// !  >>> This only works with @google/gemini-cli-core@0.1.10 and below <<<   !
// ! Newer versions require `gcConfig` in `createContentGenerator()` as well. !
/* -------------------------------------------------------------- */
/* 1.  Build the `ContentGenerator` like how gemini-cli does.     */
/* -------------------------------------------------------------- */
let generatorPromise: Promise<ContentGenerator>
let modelName: string

export function init() {
    generatorPromise = (async () => {
        const cfg = await createContentGeneratorConfig(
            model,
            authType
        )
        modelName = cfg.model
        console.log(`Gemini CLI returned model: ${modelName}`)

        return await createContentGenerator(cfg)
    })()
    return generatorPromise
}


/* ----------------------------------- */
/* 2.  Helpers used in ./server.ts     */
/* ----------------------------------- */
type GenConfig = Record<string, unknown>

export async function sendChat({
    contents,
    generationConfig = {}
}: {
    contents: any[]
    generationConfig?: GenConfig
    tools?: unknown // accepted but ignored for now
}) {
    const generator = await generatorPromise
    return await generator.generateContent({
        model: modelName,
        contents,
        config: generationConfig
    })
}

export async function* sendChatStream({
    contents,
    generationConfig = {}
}: {
    contents: any[]
    generationConfig?: GenConfig
    tools?: unknown
}) {
    const generator = await generatorPromise
    const stream = await generator.generateContentStream({
        model: modelName,
        contents,
        config: generationConfig
    })
    for await (const chunk of stream) yield chunk
}

/* -------------------- */
/* 3.  Minimal stubs    */
/* -------------------- */
export function listModels(): OpenAI.Models.Model[] {
    return [
        {
            id: 'gemini-2.5-pro',
            created: new Date().setFullYear(2025),
            object: 'model',
            owned_by: 'google'
        },
        {
            id: 'gemini-2.5-flash',
            created: new Date().setFullYear(2025),
            object: 'model',
            owned_by: 'google'
        },
        {
            id: 'gemini-2.5-flash-mini',
            created: new Date().setFullYear(2025),
            object: 'model',
            owned_by: 'google'
        }
    ]
}

export function getModel() {
    return modelName
}

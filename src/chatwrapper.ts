// src/chatwrapper.ts
import {
    AuthType as AuthTypeEnum,
    createContentGeneratorConfig,
    createContentGenerator
} from '@google/gemini-cli-core/dist/src/core/contentGenerator.js'
import { DEFAULT_GEMINI_MODEL } from '@google/gemini-cli-core'

const authType: AuthTypeEnum = (process.env.AUTH_TYPE ?? 'gemini-api-key') as AuthTypeEnum

console.log(`Auth type: ${authType}`)

const model = process.env.MODEL ?? DEFAULT_GEMINI_MODEL

if (model) {
    console.log(`Model override: ${model}`)
}

let modelName: string

// !  >>> This only works with @google/gemini-cli-core@0.1.10 and below <<<   !
// ! Newer versions require `gcConfig` in `createContentGenerator()` as well. !
/* -------------------------------------------------------------- */
/* 1.  Build the `ContentGenerator` like how gemini-cli does.     */
/* -------------------------------------------------------------- */
const generatorPromise = (async () => {
    const cfg = await createContentGeneratorConfig(
        model,
        authType
    )
    modelName = cfg.model
    console.log(`Gemini CLI returned model: ${modelName}`)

    return await createContentGenerator(cfg)
})()

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
    const generator: any = await generatorPromise
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
    const generator: any = await generatorPromise
    const stream = await generator.generateContentStream({
        model: modelName,
        contents,
        config: generationConfig
    })
    for await (const chunk of stream) yield chunk
}

/* --------------------------------------------------------- */
/* 3.  Minimal stubs so server.ts compiles (extend later)    */
/* --------------------------------------------------------- */
export function listModels() {
    return [{
        id: modelName,
        object: 'model',
        owned_by: 'google'
    }]
}

export function getModel() {
    return modelName
}

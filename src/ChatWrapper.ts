import { Logger, cyan, green, yellow } from './Logger'
const logger = new Logger('ChatWrapper')

import {
    AuthType,
    createContentGeneratorConfig,
    createContentGenerator,
    type ContentGenerator
} from '@google/gemini-cli-core/dist/src/core/contentGenerator.js'
import { OpenAI } from 'openai'

const { AUTH_TYPE } = process.env

const authType = (() => {
    if (AUTH_TYPE && Object.values(AuthType).includes(AUTH_TYPE as AuthType)) {
        logger.info(`Auth type choice set by "env.AUTH_TYPE": "${green(AUTH_TYPE)}".`)
        return AUTH_TYPE as AuthType
    } else {
        logger.info(`Auth type choice defaulted to: "${yellow('gemini-api-key')}".`)
        return 'gemini-api-key' as AuthType
    }
})()

const supportedModels = [
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite'
]

// !  >>> This only works with @google/gemini-cli-core@0.1.10 and below <<<   !
// ! Newer versions require `gcConfig` in `createContentGenerator()` as well. !
/* ------------------------------------------------------------- */
/* 1.  Build the `ContentGenerator` like how gemini-cli does     */
/* ------------------------------------------------------------- */
const generators = new Map<string, Promise<ContentGenerator>>()
const modelNames = new Map<string, string>()

export function init() {
    for (const model of supportedModels) {
        const generatorPromise = (async () => {
            const cfg = await createContentGeneratorConfig(
                model,
                authType
            )
            modelNames.set(model, cfg.model)
            logger.ok(`Gemini CLI returned model: "${cyan(cfg.model)}" for requested model "${green(model)}".`)

            return await createContentGenerator(cfg)
        })()
        generators.set(model, generatorPromise)
    }
}


/* ----------------------------------- */
/* 2.  Helpers used in ./server.ts     */
/* ----------------------------------- */
type GenConfig = Record<string, unknown>

export async function sendChat({
    model,
    contents,
    generationConfig = {}
}: {
    model: string
    contents: any[]
    generationConfig?: GenConfig
    tools?: unknown // accepted but ignored for now
}) {
    const generator = await generators.get(model)
    const modelName = modelNames.get(model)
    if (!generator || !modelName) {
        throw new Error(`Model ${model} not supported or initialized.`)
    }
    return await generator.generateContent({
        model: modelName,
        contents,
        config: generationConfig
    })
}

export async function* sendChatStream({
    model,
    contents,
    generationConfig = {}
}: {
    model: string
    contents: any[]
    generationConfig?: GenConfig
    tools?: unknown
}) {
    const generator = await generators.get(model)
    const modelName = modelNames.get(model)
    if (!generator || !modelName) {
        throw new Error(`Model ${model} not supported or initialized.`)
    }
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
            id: 'gemini-2.5-flash-lite',
            created: new Date().setFullYear(2025),
            object: 'model',
            owned_by: 'google'
        }
    ]
}

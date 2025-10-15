import { cyan, green, Logger, red, yellow } from './Logger'
const logger = new Logger('Server')

import http from 'http'
import { sendChat, sendChatStream, listModels, init } from './ChatWrapper'
import { mapRequest, mapResponse, mapStreamChunk } from './Mapper'
import type OpenAI from 'openai'

const { PORT } = process.env

// Basic config
const port = (() => {
    if (PORT) {
        logger.info(`Port set by "env.PORT": "${green(PORT)}".`)
        return Number(PORT)
    } else {
        logger.info(`Port defaulted to: "${yellow('11434')}".`)
        return 11434
    }
})()

// CORS helper
function allowCors(res: http.ServerResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
}

// JSON body helper
function readJSON(
    req: http.IncomingMessage,
    res: http.ServerResponse
): Promise<any | null> {
    return new Promise(resolve => {
        let data = ''
        req.on('data', c => (data += c))
        req.on('end', () => {
            try {
                resolve(data ? JSON.parse(data) : {})
            } catch {
                res.writeHead(400).end() // malformed JSON
                resolve(null)
            }
        })
    })
}

// Server
init()
http.createServer(async (req, res) => {
    allowCors(res)

    logger.info(`=> ${cyan(req.method)} ${cyan(req.url)}`)

    /* -------- pre-flight ---------- */
    if (req.method === 'OPTIONS') {
        res.writeHead(204).end()
        return
    }

    /* -------- /v1/models ---------- */
    if (req.url === '/v1/models') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
            JSON.stringify({
                data: listModels()
            })
        )
        return
    }

    /* ---- /v1/chat/completions ---- */
    if (req.url === '/v1/chat/completions' && req.method === 'POST') {
        const body: OpenAI.ChatCompletionCreateParams | null = await readJSON(req, res)
        if (!body) {
            res.writeHead(400).end()
            logger.warn(`HTTP ${red('400')} Proxy error: ${yellow('malformed JSON')}.`)

            return
        }

        try {
            const { tools, ...geminiReq } = await mapRequest(body)

            if (body.stream) {
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    Connection: 'keep-alive'
                })

                logger.info(`=> Sending HTTP ${green('200')} streamed response...`)

                for await (const chunk of sendChatStream({ ...geminiReq, tools })) {
                    res.write(`data: ${JSON.stringify(mapStreamChunk(chunk, geminiReq.model))}\n\n`)
                }
                res.end('data: [DONE]\n\n')

                logger.ok('=> Done sending streamed response.')
            } else {
                const geminiResp = await sendChat({ ...geminiReq, tools })
                const mapped = mapResponse(geminiResp, geminiReq.model)
                const code = 200
                res.writeHead(code, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify(mapped))

                logger.info(`✅ Replied HTTP ${green(code)} response:\n${mapped}`)
            }
        } catch (err) {
            const error = err instanceof Error ? err.message : String(err)
            logger.warn(`HTTP 500 Proxy error =>\n${yellow(error)}`)
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: { message: error } }))
        }

        return
    }

    /* ------- anything else ------- */
    logger.info(`=> Unknown request ${req.url}, returning HTTP 404.`)
    res.writeHead(404).end()
}).listen(port, () => logger.ok(`OpenAI proxy available at ${green(`http://localhost:${port}`)}, add "/v1" for base url.`))

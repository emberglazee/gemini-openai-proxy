import fs from 'fs'
import path from 'path'
import url from 'url'

import chalk from 'chalk'
export const { blue, cyan, green, red, yellow } = chalk

const esmodules = !!import.meta.url

export class Logger {
    file = ''
    module: string | undefined

    constructor(module?: string) {
        this._createLogFile()
        this.module = module
    }
    private _log(level: LogLevel, data: JSONResolvable) {
        console.log(logoutput(level, data, this.module, true))
        this.writeLogLine(logoutput(level, data, this.module))
    }

    error(data: JSONResolvable) {
        this._log('error', data)
    }
    warn(data: JSONResolvable) {
        this._log('warn', data)
    }
    info(data: JSONResolvable) {
        this._log('info', data)
    }
    ok(data: JSONResolvable) {
        this._log('ok', data)
    }
    debug(data: JSONResolvable) {
        this._log('debug', data)
    }

    _createLogFile(date = formatDate()) {
        const logsPath = path.join(esmodules ? path.dirname(url.fileURLToPath(import.meta.url)) : __dirname, '../../logs')
        if (!fs.existsSync(logsPath)) fs.mkdirSync(logsPath)
        const logFile = path.join(logsPath, `${date}.log`)
        fs.writeFileSync(logFile, '')
        this.file = logFile
        return logFile
    }
    writeLogLine(str: string) {
        fs.appendFileSync(this.file, `${str}\n`)
    }
}
export function formatDate() {
    const d = new Date()
    const opts: Intl.DateTimeFormatOptions = {
        timeZone: 'Europe/Moscow',
        hour12: false
    }
    return `${d.toLocaleDateString('ru-RU', opts).replace(/\//g, '.')}-${d.toLocaleTimeString('ru-RU', opts).replace(/:/g, '.')}`
}
function logoutput(level: 'error' | 'warn' | 'info' | 'ok' | 'debug', data: JSONResolvable, module?: string, formatting = false) {
    let str = ''
    const displayLevelsColored = {
        'error': red('error'),
        'warn' : yellow(' warn'),
        'info' : cyan(' info'),
        'ok'   : green('   ok'),
        'debug': blue('debug')
    }
    const displayLevels = {
        'error': 'error',
        'warn' : ' warn',
        'info' : ' info',
        'ok'   : '   ok',
        'debug': 'debug'
    }
    if (module) str += `${formatDate()} - ${formatting ? displayLevelsColored[level] : displayLevels[level]}: [${module}]`
    else str += `${formatDate()} - ${formatting ? displayLevelsColored[level] : displayLevels[level]}:`
    if (typeof data === 'string') str += ` ${data}`
    else str += ` ${JSON.stringify(data)}`
    return str
}

type JSONResolvable = string | number | boolean | {[key: string]: JSONResolvable} | {[key: string]: JSONResolvable}[] | null
type LogLevel = 'error' | 'warn' | 'info' | 'ok' | 'debug'

import { BrowserBot } from './BrowserBot'

export function createBot(): BrowserBot {
    const token = process.env.BOT_TOKEN
    if (!token) {
        throw new Error('BOT_TOKEN not set')
    }

    return new BrowserBot(token)
}

export * from './BrowserBot'
export * from './handlers'
export * from './commands'
export * from './utils'
export * from './llm'

import { createBot } from './bot'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config()

async function main() {
    console.log('Starting application...')

    // Create and start the bot
    const bot = createBot()
    await bot.start()

    console.log('Bot started successfully')

    // Handle shutdown gracefully
    process.once('SIGINT', async () => {
        console.log('SIGINT received, shutting down...')
        await bot.stop()
        process.exit(0)
    })

    process.once('SIGTERM', async () => {
        console.log('SIGTERM received, shutting down...')
        await bot.stop()
        process.exit(0)
    })
}

main().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
})

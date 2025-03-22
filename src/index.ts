import 'dotenv/config'
import { createBot } from './bot'

const bot = createBot()
bot.start()

// Handle application termination
process.on('SIGINT', async () => {
    console.log('Shutting down...')
    await bot.stop()
    process.exit(0)
})

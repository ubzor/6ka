import { Bot } from 'grammy'
import type { Browser, Page } from 'rebrowser-playwright'
import { BotState, CartItem } from '../types'
import { setupHandlers } from './handlers'
import { FileLoader } from '../utils/FileLoader'
import { QueueManager } from '../utils/QueueManager'

export class BrowserBot {
    #bot: Bot
    #browser: Browser | null = null
    #page: Page | null = null
    #state: BotState = BotState.INACTIVE
    #queueManager: QueueManager
    #cartItems: CartItem[] = [] // New private variable to store cart items
    #llmPrompt: string = '' // Store the LLM prompt here
    #productsData: any = {} // New private variable for storing data from YAML file

    constructor(token: string) {
        this.#bot = new Bot(token)
        this.#queueManager = new QueueManager()
        setupHandlers(this)
        // Load the prompt and data at initialization
        this.#llmPrompt = FileLoader.loadLlmPrompt()
        this.#productsData = FileLoader.loadProductsData()
    }

    enqueueTask(
        task: () => Promise<void>,
        description: string,
        ctx?: any
    ): void {
        this.#queueManager.enqueueTask(task, description, ctx)
    }

    async start(): Promise<void> {
        console.log('Starting bot...')
        await this.#bot.start()
    }

    async stop(): Promise<void> {
        // Clear the command queue and end it
        this.#queueManager.endQueue()

        if (this.#browser) {
            await this.#browser.close()
        }
        this.#state = BotState.INACTIVE
        this.#bot.stop()
    }

    // Get the current state description
    getState(): string {
        return this.#state
    }

    // Get current queue status
    getQueueStatus(): { length: number; running: number | undefined } {
        return this.#queueManager.getQueueStatus()
    }

    // Getters and setters
    get bot() {
        return this.#bot
    }
    get browser() {
        return this.#browser
    }
    set browser(browser: Browser | null) {
        this.#browser = browser
    }
    get page() {
        return this.#page
    }
    set page(page: Page | null) {
        this.#page = page
    }
    get state() {
        return this.#state
    }
    set state(state: BotState) {
        this.#state = state
    }
    get cartItems() {
        return this.#cartItems
    }
    set cartItems(items: CartItem[]) {
        this.#cartItems = items
    }
    get llmPrompt() {
        return this.#llmPrompt
    }
    get productsData() {
        return this.#productsData
    }
}

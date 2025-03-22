import { Bot, Context, InlineKeyboard } from 'grammy'
import type { Browser, Page } from 'rebrowser-playwright'
import Queue from 'queue'
import * as fs from 'fs'
import * as path from 'path'
import * as yaml from 'js-yaml'

// Updated imports
import * as browser from './browser'
import { BotState, BotTask, CartItem } from './types'

export class BrowserBot {
    #bot: Bot
    #browser: Browser | null = null
    #page: Page | null = null
    #state: BotState = BotState.INACTIVE
    #commandQueue: Queue = new Queue({ concurrency: 1, autostart: true })
    #cartItems: CartItem[] = [] // New private variable to store cart items
    #llmPrompt: string = '' // Store the LLM prompt here
    #productsData: any = {} // New private variable for storing data from YAML file

    constructor(token: string) {
        this.#bot = new Bot(token)
        this.setupQueue()
        this.setupHandlers()
        // Load the prompt and data at initialization
        this.loadLlmPrompt()
        this.loadProductsData()
    }

    /**
     * Loads the products data from the YAML file
     */
    private loadProductsData(): void {
        try {
            const dataPath = path.join(__dirname, '../prisma/data.yaml')
            const fileContents = fs.readFileSync(dataPath, 'utf8')
            this.#productsData = yaml.load(fileContents)
            console.log('Products data loaded successfully')
        } catch (error) {
            console.error('Error loading products data:', error)
            this.#productsData = {}
        }
    }

    /**
     * Loads the LLM prompt from the file system
     */
    private loadLlmPrompt(): void {
        try {
            const promptPath = path.join(__dirname, 'prompt.txt')
            this.#llmPrompt = fs.readFileSync(promptPath, 'utf8')
            console.log('LLM prompt loaded successfully')
        } catch (error) {
            console.error('Error loading LLM prompt:', error)
            this.#llmPrompt =
                'Failed to load prompt. Please check prompt.txt file.'
        }
    }

    private setupQueue(): void {
        // Add queue event listeners
        this.#commandQueue.addEventListener('success', (event) => {
            // console.log(`Task completed successfully: `, event)
        })

        this.#commandQueue.addEventListener('error', (event) => {
            console.error(`Task failed: `, event)
        })
    }

    private enqueueTask(
        task: () => Promise<void>,
        description: string,
        ctx?: Context
    ): void {
        const botTask: BotTask = {
            task,
            description
        }

        this.#commandQueue.push(() => {
            // console.log(`Executing task: ${description}`)
            return botTask.task()
        })

        // console.log(
        //     `Task queued: ${description}, Current queue length: ${
        //         this.#commandQueue.length
        //     }`
        // )

        if (ctx) {
            ctx.reply(
                `Task added to queue: ${description}. Will be executed in queue order.`
            )
        }
    }

    private setupHandlers(): void {
        // Replace the generic text message handler with a specific command handler
        this.#bot.command('neworder', (ctx) => {
            this.enqueueTask(
                () => this.handleNewOrderCommand(ctx),
                'Processing new order',
                ctx
            )
        })

        // Add a command to close the browser explicitly
        this.#bot.command('close', (ctx) => {
            this.enqueueTask(
                () => this.handleCloseCommand(ctx),
                'Closing browser session',
                ctx
            )
        })

        // Add a command to display current cart items
        this.#bot.command('cartitems', (ctx) => {
            this.enqueueTask(
                () => this.handleCartItemsCommand(ctx),
                'Checking cart',
                ctx
            )
        })

        // Add a handler for text messages (for verification code input)
        this.#bot.on('message:text', (ctx) => {
            this.enqueueTask(
                () => this.handleTextMessageTask(ctx),
                'Processing text message',
                ctx
            )
        })

        // Add callback handlers for cart cleaning buttons
        this.#bot.callbackQuery('clean_cart', (ctx) => {
            this.enqueueTask(
                () => this.handleCleanCart(ctx),
                'Cleaning cart',
                ctx
            )
        })

        this.#bot.callbackQuery('continue_with_cart', (ctx) => {
            this.enqueueTask(
                () => this.handleContinueWithCart(ctx),
                'Continuing with current items',
                ctx
            )
        })

        // Add status command to check bot state and queue
        this.#bot.command('status', (ctx) => {
            const stateMessage =
                `Current state: ${this.#state}\n` +
                `Tasks in queue: ${this.#commandQueue.length}\n`
            ctx.reply(stateMessage)
        })
    }

    private async handleCleanCart(ctx: Context): Promise<void> {
        if (!this.#page || this.#state !== BotState.ACTIVE) {
            await ctx.answerCallbackQuery({
                text: 'Browser session not active',
                show_alert: true
            })
            return
        }

        await ctx.answerCallbackQuery()
        await ctx.reply('Cleaning your cart...')

        const success = await browser.cleanCart(this.#page)

        if (success) {
            // Clear the cart items array when the cart is successfully cleaned
            this.#cartItems = []
            await ctx.reply(
                'Cart has been cleaned successfully. You can now proceed with your order.'
            )
        } else {
            await ctx.reply(
                'Failed to clean cart. Please try again or continue with items in cart.'
            )
        }
    }

    private async handleContinueWithCart(ctx: Context): Promise<void> {
        await ctx.answerCallbackQuery()
        await ctx.reply('Continuing with items in cart.')
        // Add any additional logic needed when continuing with items in cart
    }

    private async handleTextMessageTask(ctx: Context): Promise<void> {
        const text = ctx.message?.text

        if (!text) return

        // Process verification code if we're in the right state
        if (this.#state === BotState.AWAITING_CODE && text && this.#page) {
            await this.processVerificationCode(ctx, text)
        }
        // If bot is in ACTIVE state, send the text to LLM
        else if (this.#state === BotState.ACTIVE) {
            await this.processLlmRequest(ctx, text)
        }
        // Additional text message handling can be added here in the future
    }

    /**
     * Processes text messages by sending them to the LLM API
     * @param ctx The bot context for sending messages
     * @param text The text to process with the LLM
     */
    private async processLlmRequest(ctx: Context, text: string): Promise<void> {
        try {
            await ctx.reply('Processing your request with AI...')

            // Get the AI response with the combined prompt and user text
            const response = await this.callLlmApi(text)

            try {
                // Try to parse the response as JSON
                const parsedResponse = JSON.parse(response)

                // Send the parsed response in a more readable format
                let replyMessage = "Here's what I understood:\n\n"

                // Format the "add" items
                if (parsedResponse.add && parsedResponse.add.length > 0) {
                    replyMessage += '✅ Adding to cart:\n'
                    parsedResponse.add.forEach((item: any) => {
                        if (item.count === 'MIN') {
                            replyMessage += `• ${item.name}\n`
                        } else {
                            replyMessage += `• ${item.name}: ${item.count} ${
                                item.unit || ''
                            }\n`
                        }
                    })
                    replyMessage += '\n'
                }

                // Format the "remove" items
                if (parsedResponse.remove && parsedResponse.remove.length > 0) {
                    replyMessage += '❌ Removing from cart:\n'
                    parsedResponse.remove.forEach((item: any) => {
                        if (item.count === 'ALL') {
                            replyMessage += `• All ${item.name}\n`
                        } else {
                            replyMessage += `• ${item.name}: ${item.count} ${
                                item.unit || ''
                            }\n`
                        }
                    })
                    replyMessage += '\n'
                }

                // Format the "set" items
                if (parsedResponse.set && parsedResponse.set.length > 0) {
                    replyMessage += '⚖️ Setting quantity:\n'
                    parsedResponse.set.forEach((item: any) => {
                        replyMessage += `• ${item.name}: ${item.count} ${
                            item.unit || ''
                        }\n`
                    })
                }

                await ctx.reply(replyMessage)
            } catch (parseError) {
                // If parsing fails, send the raw response
                console.error('Error parsing LLM response:', parseError)
                await ctx.reply(
                    `I received a response but couldn't format it properly: ${response}`
                )
            }
        } catch (error) {
            console.error('Error processing LLM request:', error)
            await ctx.reply(
                'Sorry, I encountered an error while processing your request with the AI model.'
            )
        }
    }

    /**
     * Makes an API call to the LLM endpoint
     * @param userText The user's text to send to the LLM
     * @returns The response from the LLM
     */
    private async callLlmApi(userText: string): Promise<string> {
        try {
            // Combine the system prompt with the user's text
            const fullPrompt = `${this.#llmPrompt}\n${userText}`

            const response = await fetch('http://0.0.0.0:11434/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gemma3:1b-it-fp16',
                    prompt: fullPrompt,
                    stream: false
                })
            })

            if (!response.ok) {
                throw new Error(
                    `LLM API responded with status: ${response.status}`
                )
            }

            const data = await response.json()

            // Extract the response text from the API response
            if (data && data.response) {
                return data.response
            } else {
                throw new Error('Invalid response format from LLM API')
            }
        } catch (error) {
            console.error('Error calling LLM API:', error)
            throw new Error('Failed to get response from LLM API')
        }
    }

    private async processVerificationCode(
        ctx: Context,
        code: string
    ): Promise<void> {
        // Check if the code matches the format: exactly 4 digits
        if (/^\d{4}$/.test(code)) {
            try {
                await ctx.reply('Processing verification code...')

                if (!this.#page) {
                    throw new Error('Browser page not initialized')
                }

                // Input the verification code
                await browser.inputVerificationCode(this.#page, code)

                // Reset the state
                this.#state = BotState.ACTIVE

                // Check if we're logged in
                const loggedIn = await browser.isUserLoggedIn(this.#page)

                if (loggedIn) {
                    await ctx.reply('Successfully logged in!')

                    // Check cart status after successful login
                    await this.checkAndHandleCartStatus(ctx)
                } else {
                    await ctx.reply(
                        'Login attempt unsuccessful. Please try again with /neworder.'
                    )
                    this.#state = BotState.INACTIVE
                }
            } catch (error) {
                console.error('Error processing verification code:', error)
                await ctx.reply(
                    'An error occurred while processing the verification code.'
                )
                this.#state = BotState.INACTIVE
            }
        } else {
            await ctx.reply(
                'Invalid code format. Please enter exactly 4 digits.'
            )
        }
    }

    /**
     * Formats cart items into a readable message
     * @returns Formatted cart message
     */
    private formatCartMessage(): string {
        if (this.#cartItems.length === 0) {
            return 'Your cart is currently empty.'
        }

        let cartMessage = 'Your cart contains the following items:\n\n'
        let totalPrice = 0

        this.#cartItems.forEach((item, index) => {
            cartMessage += `${index + 1}. ${item.name} - ${item.quantity} - ${
                item.price
            } ₽\n`
            totalPrice += item.price
        })

        cartMessage += `\nTotal: ${totalPrice} ₽`
        return cartMessage
    }

    /**
     * Checks cart status and sends appropriate response with options
     * @param ctx The bot context for sending messages
     */
    private async checkAndHandleCartStatus(ctx: Context): Promise<void> {
        if (!this.#page) {
            await ctx.reply('Browser page not available')
            return
        }

        try {
            // Check cart status
            const cartHasItems = await browser.checkCartStatus(this.#page)

            if (cartHasItems) {
                // Parse cart items and store them in the private variable
                this.#cartItems = await browser.parseCartItems(this.#page)

                // Send the formatted message to the user
                await ctx.reply(this.formatCartMessage())

                // Create inline keyboard with two buttons
                const keyboard = new InlineKeyboard()
                    .text('Clean cart', 'clean_cart')
                    .text('Continue with items', 'continue_with_cart')

                await ctx.reply(
                    'Your cart is not empty. Do you want to clean it or continue with existing items?',
                    { reply_markup: keyboard }
                )
            } else {
                // Clear cart items array if the cart is empty
                this.#cartItems = []
                await ctx.reply('Cart is empty. Ready to process orders.')
            }
        } catch (error) {
            console.error('Error checking cart status:', error)
            await ctx.reply('Failed to check cart status')
        }
    }

    private async handleNewOrderCommand(ctx: Context): Promise<void> {
        try {
            await ctx.reply('Processing new order request...')
            this.#state = BotState.INITIALIZING

            // Ensure browser is initialized and logged in
            await this.ensureBrowserLoggedIn(ctx)
        } catch (error) {
            console.error('Error during order processing:', error)
            await ctx.reply(
                'Sorry, I encountered an error while processing your order request.'
            )
            this.#state = BotState.INACTIVE
        }
    }

    /**
     * Ensures that the browser is initialized and logged in
     * @param ctx The bot context for sending messages
     */
    private async ensureBrowserLoggedIn(ctx: Context): Promise<void> {
        // Initialize browser if it doesn't exist
        if (!this.#browser) {
            await ctx.reply('Starting browser session...')
            try {
                this.#browser = await browser.initializeBrowser()
            } catch (error) {
                console.error('Error initializing browser:', error)
                await ctx.reply(
                    'Failed to initialize browser: could not start browser session'
                )
                this.#state = BotState.INACTIVE
                return
            }
        }

        // Initialize page if it doesn't exist or is closed
        if (!this.#page || this.#page.isClosed()) {
            await ctx.reply('Initializing browser page...')
            try {
                this.#page = await browser.initializePage(this.#browser)
            } catch (error) {
                console.error('Error initializing page:', error)
                await ctx.reply('Failed to initialize browser page')
                this.#state = BotState.INACTIVE
                return
            }
        }

        // Check login status
        const loggedIn = await browser.isUserLoggedIn(this.#page)

        if (loggedIn) {
            await ctx.reply('Using existing logged-in browser session')
            this.#state = BotState.ACTIVE

            // Check cart status when user is already logged in
            await this.checkAndHandleCartStatus(ctx)
        } else {
            await ctx.reply('Not logged in. Navigating to login page...')
            await browser.login(this.#page)
            await ctx.reply(
                'Successfully navigated to login page and entered phone. Please enter the verification code (4 digits).'
            )

            // Update the state to await verification code
            this.#state = BotState.AWAITING_CODE
        }
    }

    private async handleCloseCommand(ctx: Context): Promise<void> {
        if (this.#browser) {
            await this.#browser.close()
            this.#browser = null
            this.#page = null
            this.#state = BotState.INACTIVE
            await ctx.reply('Browser session closed')
        } else {
            await ctx.reply('No active browser session')
        }
    }

    /**
     * Handles the command to display current cart items
     * @param ctx The bot context for sending messages
     */
    private async handleCartItemsCommand(ctx: Context): Promise<void> {
        try {
            await ctx.reply('Checking your shopping cart...')

            // Check if browser and page are initialized
            if (
                !this.#browser ||
                !this.#page ||
                this.#state !== BotState.ACTIVE
            ) {
                await ctx.reply(
                    'Browser session is not active. Please use /neworder first.'
                )
                return
            }

            // Check if the user is logged in
            const loggedIn = await browser.isUserLoggedIn(this.#page)
            if (!loggedIn) {
                await ctx.reply(
                    'You need to be logged in to view cart items. Please use /neworder first.'
                )
                this.#state = BotState.INACTIVE
                return
            }

            // Check cart status and update the cart items
            const cartHasItems = await browser.checkCartStatus(this.#page)

            if (!cartHasItems) {
                // Clear cart items array if the cart is empty
                this.#cartItems = []
                await ctx.reply('Your cart is currently empty.')
                return
            }

            // Update the cart items in our private variable
            this.#cartItems = await browser.parseCartItems(this.#page)

            // Display the cart items using our helper method
            await ctx.reply(this.formatCartMessage())
        } catch (error) {
            console.error('Error checking cart items:', error)
            await ctx.reply('An error occurred while checking your cart items.')
        }
    }

    async start(): Promise<void> {
        console.log('Starting bot...')
        await this.#bot.start()
    }

    async stop(): Promise<void> {
        // Clear the command queue and end it
        this.#commandQueue.end()

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
        return {
            length: this.#commandQueue.length,
            running: (this.#commandQueue as any).running // Type cast since running might not be in the type definitions
        }
    }
}

export function createBot(): BrowserBot {
    const token = process.env.BOT_TOKEN
    if (!token) {
        throw new Error('BOT_TOKEN not set')
    }

    return new BrowserBot(token)
}

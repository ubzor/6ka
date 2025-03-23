// Bot state enum
export enum BotState {
    INACTIVE = 'INACTIVE', // Inactive state
    INITIALIZING = 'INITIALIZING', // Initializing state
    AWAITING_CODE = 'AWAITING_CODE', // Awaiting code state
    ACTIVE = 'ACTIVE' // Active state
}

// Define a task type for our queue
export type BotTask = {
    task: () => Promise<void>
    description: string
}

// Cart item interface representing a product in the cart
export interface CartItem {
    name: string
    price: number
    quantity: string | number
}

// Product interface representing a product from data.yaml
export interface Product {
    aliases: string[]
    specificProducts: string[]
}

// LLM response item representing a product action from LLM
export interface LlmActionItem {
    name: string
    count: string // Optional now - can be a number, "MIN", or "ALL"
    unit: string // Optional unit (kg, pcs, etc.)
}

// LLM response interface representing the structured output from LLM
export interface LlmResponse {
    add: LlmActionItem[]
    remove: string[] // Array of strings (product names)
}

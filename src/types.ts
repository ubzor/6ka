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

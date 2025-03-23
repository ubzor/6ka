import fs from 'fs'
import path from 'path'
import { parse } from 'yaml'
import { Product } from '../types'

export class FileLoader {
    /**
     * Loads the LLM prompt from the prompt.txt file
     * @returns The prompt text
     */
    static loadLlmPrompt(): string {
        try {
            const promptPath = path.resolve(__dirname, '../../prompt.txt')
            return fs.readFileSync(promptPath, 'utf8')
        } catch (error) {
            console.error('Error loading LLM prompt:', error)
            return 'Error loading prompt. Using default empty prompt.'
        }
    }

    /**
     * Loads product data from the products.yaml file
     * @returns The parsed products data
     */
    static loadProductsData(): { products: Product[] } {
        try {
            const productsPath = path.resolve(__dirname, '../../products.yaml')
            const fileContents = fs.readFileSync(productsPath, 'utf8')
            return parse(fileContents) as { products: Product[] }
        } catch (error) {
            console.error('Error loading products data:', error)
            return { products: [] }
        }
    }
}

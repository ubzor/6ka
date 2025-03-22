import * as fs from 'fs'
import * as path from 'path'
import * as yaml from 'js-yaml'

export class FileLoader {
    /**
     * Loads the products data from the YAML file
     */
    static loadProductsData(): any {
        try {
            const dataPath = path.join(__dirname, '../../prisma/data.yaml')
            const fileContents = fs.readFileSync(dataPath, 'utf8')
            const productsData = yaml.load(fileContents)
            console.log('Products data loaded successfully')
            return productsData
        } catch (error) {
            console.error('Error loading products data:', error)
            return {}
        }
    }

    /**
     * Loads the LLM prompt from the file system
     */
    static loadLlmPrompt(): string {
        try {
            const promptPath = path.join(__dirname, '../prompt.txt')
            const prompt = fs.readFileSync(promptPath, 'utf8')
            console.log('LLM prompt loaded successfully')
            return prompt
        } catch (error) {
            console.error('Error loading LLM prompt:', error)
            return 'Failed to load prompt. Please check prompt.txt file.'
        }
    }
}

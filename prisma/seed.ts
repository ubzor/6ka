import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as yaml from 'js-yaml'
import * as path from 'path'

const prisma = new PrismaClient()

interface ProductData {
    aliases: string[]
    specificProducts: string[]
}

interface YamlData {
    products: ProductData[]
}

function loadDataFromYaml(): YamlData {
    const yamlFilePath = path.join(__dirname, '../products.yaml')
    const fileContents = fs.readFileSync(yamlFilePath, 'utf8')
    return yaml.load(fileContents) as YamlData
}

async function main() {
    console.log('Start seeding...')

    // Clear existing data
    await prisma.specificProduct.deleteMany({})
    await prisma.genericProductAlias.deleteMany({})
    await prisma.genericProduct.deleteMany({})

    // Load data from YAML file
    const data = loadDataFromYaml()

    for (const product of data.products) {
        if (!product.aliases || product.aliases.length === 0) {
            console.warn('Skipping product with no aliases')
            continue
        }

        // Calculate priorities in reverse order (higher priority for first items)
        const specificProductsCount = product.specificProducts?.length || 0
        const specificProductsWithPriority = product.specificProducts.map(
            (name, index) => {
                return {
                    name,
                    priority: specificProductsCount - index // Reverse order for priority
                }
            }
        )

        // Create the generic product
        const genericProduct = await prisma.genericProduct.create({
            data: {
                aliases: {
                    create: product.aliases.map((name) => ({ name }))
                },
                specificProducts: {
                    create: specificProductsWithPriority
                }
            }
        })

        console.log(
            `Created generic product ${genericProduct.id} with ${product.aliases[0]}`
        )
    }

    console.log('Seeding finished!')
}

async function runSeed() {
    try {
        await main()
    } catch (e) {
        console.error(e)
        process.exit(1)
    } finally {
        await prisma.$disconnect()
    }
}

runSeed()

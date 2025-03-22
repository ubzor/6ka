import Queue from 'queue'
import { BotTask } from '../types'

export class QueueManager {
    queue: Queue

    constructor() {
        this.queue = new Queue({ concurrency: 1, autostart: true })
        this.setupQueue()
    }

    private setupQueue(): void {
        // Add queue event listeners
        this.queue.addEventListener('success', (event) => {
            // console.log(`Task completed successfully: `, event)
        })

        this.queue.addEventListener('error', (event) => {
            console.error(`Task failed: `, event)
        })
    }

    enqueueTask(
        task: () => Promise<void>,
        description: string,
        ctx?: any
    ): void {
        const botTask: BotTask = {
            task,
            description
        }

        this.queue.push(() => {
            return botTask.task()
        })

        if (ctx) {
            ctx.reply(
                `Task added to queue: ${description}. Will be executed in queue order.`
            )
        }
    }

    getQueueStatus(): { length: number; running: number | undefined } {
        return {
            length: this.queue.length,
            running: (this.queue as any).running
        }
    }

    endQueue(): void {
        this.queue.end()
    }
}

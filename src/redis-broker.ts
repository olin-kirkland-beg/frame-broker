import dotenv from 'dotenv';
import { RedisClientType, createClient } from 'redis';

dotenv.config();
const ADDRESS = process.env.REDIS_URL || 'redis://localhost:6379';

export default class RedisBroker {
    private static instance: RedisBroker | null;
    private subscriber: RedisClientType | null = null;
    private publisher: RedisClientType | null = null;
    private mask: string = '*';

    public onMessage: (message: any, channel: string) => void = () => {};

    private constructor(mask: string = '*') {
        this.mask = mask;
    }

    static getInstance(mask: string = '*'): RedisBroker {
        if (!RedisBroker.instance) RedisBroker.instance = new RedisBroker(mask);
        return RedisBroker.instance;
    }

    async start() {
        if (this.subscriber) {
            console.log('RedisBroker already started');
            return;
        }

        // Establish Redis clients
        const config = { url: ADDRESS };
        this.subscriber = createClient(config);
        this.publisher = createClient(config);

        this.subscriber.on('error', (err: any) => {
            console.error('RedisBroker error:', err);
        });

        console.log(`Connecting to Redis on ${ADDRESS}...`);
        await this.subscriber.connect();
        console.log(`  ... (1/2) subscriber connected`);
        await this.publisher.connect();
        console.log(`  ... (2/2) publisher connected`);

        // Listen for changes from Redis channels
        console.log(`Subscribing to Redis channels with mask "${this.mask}"`);
        this.subscriber.pSubscribe(this.mask, this.onMessage);
    }

    /**
     * Send a message to a Redis channel.
     * @param message - The message to send, will be stringified.
     * @param channel - The Redis channel to publish the message to.
     */
    send(message: any, channel: string) {
        if (!this.publisher) throw new Error('Redis client not connected');
        this.publisher.publish(channel, JSON.stringify(message));
    }
}

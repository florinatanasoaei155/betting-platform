import amqp, { ChannelModel, Channel } from 'amqplib';
import { QueueEvent } from '../types';

let connection: ChannelModel | null = null;
let channel: Channel | null = null;

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://betting:betting123@localhost:5672';

export const QUEUES = {
  BETS: 'bets',
  ODDS: 'odds',
  EVENTS: 'events',
  NOTIFICATIONS: 'notifications',
} as const;

export const EXCHANGES = {
  BETTING: 'betting_exchange',
} as const;

export async function connectRabbitMQ(): Promise<Channel> {
  if (channel) return channel;

  try {
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();

    await channel.assertExchange(EXCHANGES.BETTING, 'topic', { durable: true });

    for (const queue of Object.values(QUEUES)) {
      await channel.assertQueue(queue, { durable: true });
      await channel.bindQueue(queue, EXCHANGES.BETTING, `${queue}.*`);
    }

    console.log('Connected to RabbitMQ');
    return channel;
  } catch (error) {
    console.error('Failed to connect to RabbitMQ:', error);
    throw error;
  }
}

export async function publishEvent(routingKey: string, event: QueueEvent): Promise<void> {
  if (!channel) {
    await connectRabbitMQ();
  }

  channel!.publish(
    EXCHANGES.BETTING,
    routingKey,
    Buffer.from(JSON.stringify(event)),
    { persistent: true }
  );
}

export async function consumeQueue(
  queue: string,
  callback: (event: QueueEvent) => Promise<void>
): Promise<void> {
  if (!channel) {
    await connectRabbitMQ();
  }

  await channel!.consume(queue, async (msg) => {
    if (msg) {
      try {
        const event = JSON.parse(msg.content.toString()) as QueueEvent;
        await callback(event);
        channel!.ack(msg);
      } catch (error) {
        console.error('Error processing message:', error);
        channel!.nack(msg, false, false);
      }
    }
  });
}

export async function closeRabbitMQ(): Promise<void> {
  if (channel) await channel.close();
  if (connection) await connection.close();
  channel = null;
  connection = null;
}

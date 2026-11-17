import { Kafka, logLevel } from 'kafkajs';
import {
  AUTHENTICATE,
  CREATE_CHARGE,
  NOTIFY_EMAIL,
} from '@app/common/constants/patterns';

export const TEST_BROKERS = (process.env.KAFKA_BROKERS ?? 'localhost:39092')
  .split(',')
  .map((broker) => broker.trim());

export const ALL_TOPICS = [
  AUTHENTICATE,
  `${AUTHENTICATE}.reply`,
  CREATE_CHARGE,
  `${CREATE_CHARGE}.reply`,
  NOTIFY_EMAIL,
];

export async function ensureTopics(brokers: string[], topics = ALL_TOPICS) {
  const admin = new Kafka({
    clientId: 'test-admin',
    brokers,
    logLevel: logLevel.NOTHING,
  }).admin();
  await admin.connect();
  try {
    const existing = new Set(await admin.listTopics());
    const missing = topics.filter((topic) => !existing.has(topic));
    if (missing.length) {
      await admin.createTopics({
        waitForLeaders: true,
        topics: missing.map((topic) => ({ topic, numPartitions: 1 })),
      });
    }
  } finally {
    await admin.disconnect();
  }
}

export async function waitFor(
  assertion: () => void,
  timeoutMs = 20_000,
  intervalMs = 200,
) {
  const start = Date.now();
  for (;;) {
    try {
      assertion();
      return;
    } catch (error) {
      if (Date.now() - start > timeoutMs) throw error;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
}

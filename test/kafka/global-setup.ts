import { execSync } from 'child_process';
import { join } from 'path';

export const TEST_COMPOSE_FILE = join(__dirname, '..', '..', 'docker-compose.test.yml');

export default function globalSetup() {
  if (process.env.KAFKA_BROKERS) {
    console.log(`\nUsing existing Kafka at ${process.env.KAFKA_BROKERS}`);
    return;
  }
  console.log('\nStarting throw-away Kafka broker (docker-compose.test.yml)...');
  execSync(`docker compose -f "${TEST_COMPOSE_FILE}" up -d --wait`, {
    stdio: 'inherit',
  });
}

import { execSync } from 'child_process';
import { TEST_COMPOSE_FILE } from './global-setup';

export default function globalTeardown() {
  if (process.env.KAFKA_BROKERS || process.env.KEEP_KAFKA === '1') {
    return;
  }
  execSync(`docker compose -f "${TEST_COMPOSE_FILE}" down -v`, {
    stdio: 'inherit',
  });
}

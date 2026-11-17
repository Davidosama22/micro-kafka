import { AUTH_URL, RESERVATIONS_URL } from './config';

const READY_TIMEOUT_MS = Number(process.env.E2E_READY_TIMEOUT_MS ?? 300_000);

async function isUp(url: string) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(3_000) });
    return true;
  } catch {
    return false;
  }
}

// The stack must already be running (`docker compose up -d --build`); this only waits for it.
export default async function globalSetup() {
  const targets = [`${AUTH_URL}/users`, `${RESERVATIONS_URL}/reservation`];
  const deadline = Date.now() + READY_TIMEOUT_MS;
  console.log(`\nWaiting for ${targets.join(' and ')} ...`);

  for (;;) {
    const results = await Promise.all(targets.map(isUp));
    if (results.every(Boolean)) {
      console.log('Services are up.');
      return;
    }
    if (Date.now() > deadline) {
      throw new Error(
        `Services not reachable after ${READY_TIMEOUT_MS / 1000}s. Start them with "docker compose up -d --build".`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }
}

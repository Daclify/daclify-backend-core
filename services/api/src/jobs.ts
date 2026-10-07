export function startPollingWorker(
  work: () => Promise<string>,
  errorCode: string,
): { stop: () => Promise<void> } {
  let stopped = false,
    timer: ReturnType<typeof setTimeout> | undefined,
    running: Promise<string> | undefined;
  async function tick() {
    if (stopped) return;
    let outcome = 'idle';
    running = work();
    try {
      outcome = await running;
    } catch {
      console.error(errorCode);
    } finally {
      running = undefined;
    }
    if (!stopped)
      timer = setTimeout(
        () => {
          void tick();
        },
        outcome === 'idle' ? 5000 : 250,
      );
  }
  void tick();
  return {
    async stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      await running?.catch(() => undefined);
    },
  };
}

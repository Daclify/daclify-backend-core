// Public RPC nodes may lag behind the node that accepted an account creation.
export async function waitForIrreversibleBlock(
  readBlock: () => Promise<number>,
  submittedBlock: number,
  attempts = 60,
): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if ((await readBlock()) >= submittedBlock) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('CHAIN_CONFIRMATION_TIMEOUT');
}

import { z } from 'zod';

export const EVM_CONTRACT = 'eosio.evm';
export const SERVICE_REFERENCE = /^svc:([A-Za-z0-9_-]{1,40})$/;

const TransferSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  quantity: z.string().regex(/^[0-9]+\.[0-9]{4} TLOS$/),
  memo: z.string().max(256),
  parentActor: z.string().min(1).nullable(),
});

export interface ServiceTransferInput {
  billingAccount: string;
  from: string;
  to: string;
  quantity: string;
  memo: string;
  parentActor: string | null;
}

export interface ClassifiedServiceTransfer {
  rail: 'telos-zero' | 'telos-evm';
  payer: string;
  reference: string | null;
  receivedMinor: bigint;
}

export function tlosMinor(quantity: string): bigint {
  const match = /^([0-9]+)\.([0-9]{4}) TLOS$/.exec(quantity);
  if (!match?.[1] || !match[2]) throw new Error('SERVICE_QUANTITY');
  return BigInt(match[1]) * 10_000n + BigInt(match[2]);
}

// A Zero payer puts the quote id in the memo. An EVM payer calls eosio.evm::withdraw,
// which has no memo field: the native transfer is sent by eosio.evm and the signer of
// withdraw is the payer. A svc memo is used when the transfer carries one.
export function classifyServiceTransfer(input: ServiceTransferInput): ClassifiedServiceTransfer {
  const transfer = TransferSchema.parse({
    from: input.from,
    to: input.to,
    quantity: input.quantity,
    memo: input.memo,
    parentActor: input.parentActor,
  });
  if (transfer.to !== input.billingAccount) throw new Error('SERVICE_DESTINATION');
  const reference = SERVICE_REFERENCE.exec(transfer.memo)?.[1] ?? null;
  const receivedMinor = tlosMinor(transfer.quantity);
  if (receivedMinor <= 0n) throw new Error('SERVICE_QUANTITY');
  if (transfer.from === EVM_CONTRACT) {
    if (!transfer.parentActor) throw new Error('SERVICE_EVM_PAYER');
    return { rail: 'telos-evm', payer: transfer.parentActor, reference, receivedMinor };
  }
  if (!reference) throw new Error('SERVICE_REFERENCE');
  return { rail: 'telos-zero', payer: transfer.from, reference, receivedMinor };
}

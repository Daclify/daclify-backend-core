import { createHash } from 'node:crypto';
import { PublicKey } from '@wharfkit/antelope';
import { z } from 'zod';
import type Stripe from 'stripe';
import { TelosNameSchema } from '../market/read.js';
import { decideStripeEvent, type ServiceDecision } from './decision.js';
import { integrationIdentifier, randomIntegrationSuffix } from './checkout.js';

export interface NamePurchase {
  accountName: string;
  ownerKey: string;
  activeKey: string;
  usdCents: number;
  reference: string;
}

export interface NameFulfiller {
  fulfillName(purchase: NamePurchase): Promise<void>;
}

const fulfillTypes = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
]);

type NameDecision =
  | { kind: 'not-name' }
  | { kind: 'invalid' }
  | { kind: 'ignore'; reason: 'UNPAID' | 'EVENT_TYPE' }
  | { kind: 'purchase'; purchase: NamePurchase };

export type StripeRoute =
  { kind: 'invalid' } | { kind: 'purchase'; purchase: NamePurchase } | ServiceDecision;

export function nameReference(checkoutId: string): string {
  return createHash('sha256').update(checkoutId).digest('hex');
}

export function nameReturnUrls(origin: string): { successUrl: string; cancelUrl: string } {
  const base = new URL(origin);
  return {
    successUrl: new URL('/marketplace?names=submitted', base).toString(),
    cancelUrl: new URL('/marketplace?names=cancelled', base).toString(),
  };
}

export function nameCheckoutParams(input: {
  accountId: string;
  accountName: string;
  ownerKey: string;
  activeKey: string;
  usdCents: number;
  successUrl: string;
  cancelUrl: string;
  integrationIdentifier: string;
}): Stripe.Checkout.SessionCreateParams {
  TelosNameSchema.parse(input.accountName);
  canonicalKey(input.ownerKey);
  canonicalKey(input.activeKey);
  if (!Number.isSafeInteger(input.usdCents) || input.usdCents < 1 || input.usdCents > 100000000) {
    throw new Error('NAME_PRICE');
  }
  return {
    mode: 'payment',
    client_reference_id: input.accountId,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: input.usdCents,
          product_data: { name: `Telos account ${input.accountName}` },
        },
      },
    ],
    metadata: {
      purpose: 'name',
      account_id: input.accountId,
      account_name: input.accountName,
      owner_key: input.ownerKey,
      active_key: input.activeKey,
      usd_cents: String(input.usdCents),
    },
    integration_identifier: input.integrationIdentifier,
  };
}

export function nameCheckoutIdentifier(): string {
  return integrationIdentifier(randomIntegrationSuffix());
}

export function classifyStripeEvent(value: unknown): StripeRoute {
  const name = decideNamePurchase(value);
  if (name.kind === 'not-name') return decideStripeEvent(value);
  return name;
}

function decideNamePurchase(value: unknown): NameDecision {
  const event = readEvent(value);
  if (!event) return { kind: 'not-name' };
  const purpose = metadataPurpose(event.object);
  if (purpose !== 'name') return { kind: 'not-name' };
  if (event.type === 'checkout.session.async_payment_failed')
    return { kind: 'ignore', reason: 'UNPAID' };
  if (!fulfillTypes.has(event.type)) return { kind: 'ignore', reason: 'EVENT_TYPE' };
  const purchase = readNameSession(event.object);
  if (!purchase) return { kind: 'invalid' };
  if (purchase.unpaid || purchase.usdCents < 1) return { kind: 'ignore', reason: 'UNPAID' };
  return {
    kind: 'purchase',
    purchase: {
      accountName: purchase.accountName,
      ownerKey: purchase.ownerKey,
      activeKey: purchase.activeKey,
      usdCents: purchase.usdCents,
      reference: nameReference(purchase.checkoutId),
    },
  };
}

function canonicalKey(value: string): string {
  try {
    const key = PublicKey.from(value).toString();
    if (key !== value) throw new Error('NAME_KEY');
    return key;
  } catch {
    throw new Error('NAME_KEY');
  }
}

function readEvent(value: unknown): { type: string; object: unknown } | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  if (!('type' in value) || typeof value.type !== 'string') return undefined;
  if (!('data' in value) || typeof value.data !== 'object' || value.data === null) return undefined;
  if (!('object' in value.data)) return undefined;
  return { type: value.type, object: value.data.object };
}

function metadataPurpose(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || !('metadata' in value)) return undefined;
  const metadata = value.metadata;
  if (typeof metadata !== 'object' || metadata === null || !('purpose' in metadata))
    return undefined;
  return typeof metadata.purpose === 'string' ? metadata.purpose : undefined;
}

function readNameSession(value: unknown):
  | {
      checkoutId: string;
      accountName: string;
      ownerKey: string;
      activeKey: string;
      usdCents: number;
      unpaid: boolean;
    }
  | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  if (!('id' in value) || typeof value.id !== 'string' || !/^cs_[A-Za-z0-9_]+$/.test(value.id)) {
    return undefined;
  }
  if (!('payment_status' in value)) return undefined;
  if (
    value.payment_status !== 'paid' &&
    value.payment_status !== 'unpaid' &&
    value.payment_status !== 'no_payment_required'
  ) {
    return undefined;
  }
  if (!('client_reference_id' in value) || typeof value.client_reference_id !== 'string')
    return undefined;
  const accountId = z.uuid().safeParse(value.client_reference_id);
  if (!accountId.success) return undefined;
  if (!('metadata' in value)) return undefined;
  const metadata = readMetadata(value.metadata);
  if (!metadata || metadata.purpose !== 'name' || metadata.account_id !== accountId.data)
    return undefined;
  const accountName = TelosNameSchema.safeParse(metadata.account_name);
  if (!accountName.success) return undefined;
  const ownerKey = optionalKey(metadata.owner_key);
  const activeKey = optionalKey(metadata.active_key);
  if (!ownerKey || !activeKey) return undefined;
  if (!('amount_total' in value) || typeof value.amount_total !== 'number') return undefined;
  if (
    !Number.isSafeInteger(value.amount_total) ||
    value.amount_total < 0 ||
    value.amount_total > 100000000
  ) {
    return undefined;
  }
  if (metadata.usd_cents !== String(value.amount_total)) return undefined;
  if (!('currency' in value) || value.currency !== 'usd') return undefined;
  return {
    checkoutId: value.id,
    accountName: accountName.data,
    ownerKey,
    activeKey,
    usdCents: value.amount_total,
    unpaid: value.payment_status !== 'paid',
  };
}

function optionalKey(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const key = PublicKey.from(value).toString();
    return key === value ? key : undefined;
  } catch {
    return undefined;
  }
}

function readMetadata(value: unknown): Record<string, string> | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const metadata: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== 'string' || entry.length > 500) return undefined;
    metadata[key] = entry;
  }
  return metadata;
}

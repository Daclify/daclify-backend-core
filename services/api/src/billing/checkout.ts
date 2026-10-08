import type Stripe from 'stripe';

export function integrationIdentifier(suffix: string): string {
  if (!/^[a-z]{8}$/.test(suffix)) throw new Error('INTEGRATION_IDENTIFIER');
  return `daclify${suffix}`;
}

export function randomIntegrationSuffix(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let suffix = '';
  for (const byte of bytes) suffix += String.fromCharCode(97 + (byte % 26));
  return suffix;
}

export function checkoutSessionParams(input: {
  priceId: string;
  accountId: string;
  successUrl: string;
  cancelUrl: string;
  integrationIdentifier: string;
}): Stripe.Checkout.SessionCreateParams {
  return {
    mode: 'payment',
    client_reference_id: input.accountId,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    line_items: [{ price: input.priceId, quantity: 1 }],
    metadata: {
      account_id: input.accountId,
      price_id: input.priceId,
      purpose: 'service',
    },
    integration_identifier: input.integrationIdentifier,
  };
}

export function requireCheckoutUrl(value: string | null): string {
  if (!value) throw new Error('CHECKOUT_URL');
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'checkout.stripe.com' ||
    url.username ||
    url.password ||
    url.port
  ) {
    throw new Error('CHECKOUT_URL');
  }
  return url.toString();
}

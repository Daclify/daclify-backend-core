export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  priceId: string;
}

const secretKeyPattern = /^(?:rk|sk)_(?:test|live)_[A-Za-z0-9]+$/;
const webhookSecretPattern = /^whsec_[A-Za-z0-9]+$/;
const priceIdPattern = /^price_[A-Za-z0-9]+$/;

export function readStripeConfig(env: {
  STRIPE_SECRET_KEY?: string | undefined;
  STRIPE_WEBHOOK_SECRET?: string | undefined;
  STRIPE_PRICE_ID?: string | undefined;
}): StripeConfig | undefined {
  const secretKey = env.STRIPE_SECRET_KEY ?? '';
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET ?? '';
  const priceId = env.STRIPE_PRICE_ID ?? '';
  if (!secretKey && !webhookSecret && !priceId) return undefined;
  if (
    secretKey.length < 20 ||
    !secretKeyPattern.test(secretKey) ||
    webhookSecret.length < 12 ||
    !webhookSecretPattern.test(webhookSecret) ||
    !priceIdPattern.test(priceId)
  ) {
    throw new Error('STRIPE_CONFIGURATION_INVALID');
  }
  return { secretKey, webhookSecret, priceId };
}

export function billingReturnUrls(origin: string): { successUrl: string; cancelUrl: string } {
  const base = new URL(origin);
  return {
    successUrl: new URL('/account?billing=submitted', base).toString(),
    cancelUrl: new URL('/account?billing=cancelled', base).toString(),
  };
}

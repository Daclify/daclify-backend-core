import { readDelphiPair, readDelphiRate } from '../../services/api/src/delphi.js';
import {
  SERVICE_PREMIUM_BPS,
  TLOS_PRECISION,
  USD_PRECISION,
  formatTlosMinor,
  requiredTlosMinor,
} from '../../services/api/src/service-price.js';
import { loadEnvironment, type DeployName } from './environment.js';

let environmentName: DeployName = 'production';
let fiatMinor: string | undefined;
for (const argument of process.argv.slice(2)) {
  if (argument === 'develop' || argument === 'production' || argument === 'testnet') {
    environmentName = argument;
  } else if (/^[1-9][0-9]*$/.test(argument)) fiatMinor = argument;
  else throw new Error('PRICE_ARGUMENT');
}
const environment = await loadEnvironment(environmentName);
const pair = await readDelphiPair(environment.oracle.rpcUrl, environment.oracle.pair);
const rate = await readDelphiRate(
  environment.oracle.rpcUrl,
  environment.oracle.pair,
  new Date(),
  environment.oracle.maxAgeSeconds,
);
const digits = rate.median.toString().padStart(pair.quotedPrecision + 1, '0');
const dollars = `${digits.slice(0, -pair.quotedPrecision)}.${digits.slice(-pair.quotedPrecision)}`;
console.log(
  `Delphi ${pair.name} median ${rate.median} at precision ${pair.quotedPrecision} (${dollars} USD per TLOS), observed ${rate.observedAt.toISOString()}.`,
);
if (fiatMinor) {
  const required = requiredTlosMinor({
    fiatMinor: BigInt(fiatMinor),
    fiatPrecision: USD_PRECISION,
    median: rate.median,
    quotedPrecision: pair.quotedPrecision,
    tlosPrecision: TLOS_PRECISION,
    premiumBps: SERVICE_PREMIUM_BPS,
  });
  console.log(
    `${fiatMinor} USD minor units require ${formatTlosMinor(required)}, including the ${SERVICE_PREMIUM_BPS / 100}% premium.`,
  );
  console.log('A larger TLOS transfer is a tip. A smaller transfer does not pay the service.');
}

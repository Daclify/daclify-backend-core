import { describe, expect, it } from 'vitest';
import { readDelphiPair, readDelphiRate } from '../services/api/src/delphi.js';
import { applyEnvFile, loadEnvFile, parseEnvFile } from '../services/api/src/env-file.js';
import { classifyServiceTransfer } from '../services/api/src/service-payment.js';
import {
  ceilDiv,
  formatTlosMinor,
  parseDelphiTimestamp,
  requiredTlosMinor,
  selectDelphiRate,
  settleServiceAmount,
} from '../services/api/src/service-price.js';

describe('service price and payment', () => {
  it('prices 10 USD from the Delphi median and keeps the extra as a tip', () => {
    const required = requiredTlosMinor({
      fiatMinor: 1000n,
      fiatPrecision: 2,
      median: 197n,
      quotedPrecision: 4,
      tlosPrecision: 4,
      premiumBps: 2000,
    });
    expect(required).toBe(6091371n);
    expect(formatTlosMinor(required)).toBe('609.1371 TLOS');
    expect(settleServiceAmount(required, 7000000n)).toEqual({
      status: 'paid',
      shortfallMinor: 0n,
      tipMinor: 908629n,
    });
    expect(settleServiceAmount(required, required - 1n).status).toBe('underpaid');
  });

  it('uses the newest Delphi row and refuses a stale median', () => {
    const now = new Date('2026-10-06T11:20:00.000Z');
    const rate = selectDelphiRate(
      [
        { id: 0, median: 100, timestamp: '2026-10-06T11:00:00.000' },
        { id: 4, median: 197, timestamp: '2026-10-06T11:18:23.000' },
      ],
      now,
      900,
    );
    expect(rate.median).toBe(197n);
    expect(() =>
      selectDelphiRate([{ id: 1, median: 197, timestamp: '2026-10-06T10:00:00.000' }], now, 900),
    ).toThrow('ORACLE_STALE');
  });

  it('reads a Delphi table response', async () => {
    const original = globalThis.fetch;
    const posted: string[] = [];
    globalThis.fetch = async (_input, init) => {
      const parsed: unknown = JSON.parse(String(init?.body));
      if (typeof parsed !== 'object' || parsed === null || !('table' in parsed)) {
        throw new Error('missing table');
      }
      const table = parsed.table;
      if (typeof table !== 'string') throw new Error('missing table');
      posted.push(table);
      const rows =
        table === 'pairs'
          ? [{ name: 'tlosusd', active: 1, quoted_precision: 4 }]
          : [{ id: 20, median: 197, timestamp: '2026-10-06T11:18:23.000' }];
      return new Response(JSON.stringify({ rows }), { status: 200 });
    };
    try {
      await expect(readDelphiPair('https://telos.example', 'tlosusd')).resolves.toEqual({
        name: 'tlosusd',
        quotedPrecision: 4,
      });
      const rate = await readDelphiRate(
        'https://telos.example',
        'tlosusd',
        new Date('2026-10-06T11:20:00.000Z'),
        900,
      );
      expect(rate.median).toBe(197n);
      expect(posted).toEqual(['pairs', 'datapoints']);
    } finally {
      globalThis.fetch = original;
    }
  });

  it('classifies a Zero memo payment and an EVM withdraw', () => {
    expect(
      classifyServiceTransfer({
        billingAccount: 'fees.we',
        from: 'alice',
        to: 'fees.we',
        quantity: '609.1371 TLOS',
        memo: 'svc:pin-2026-10',
        parentActor: null,
      }),
    ).toMatchObject({ rail: 'telos-zero', payer: 'alice', reference: 'pin-2026-10' });
    expect(
      classifyServiceTransfer({
        billingAccount: 'fees.we',
        from: 'eosio.evm',
        to: 'fees.we',
        quantity: '700.0000 TLOS',
        memo: 'Withdraw',
        parentActor: 'alice',
      }),
    ).toMatchObject({
      rail: 'telos-evm',
      payer: 'alice',
      reference: null,
      receivedMinor: 7000000n,
    });
    expect(() =>
      classifyServiceTransfer({
        billingAccount: 'fees.we',
        from: 'alice',
        to: 'fees.we',
        quantity: '1.0000 TLOS',
        memo: 'dao:1',
        parentActor: null,
      }),
    ).toThrow('SERVICE_REFERENCE');
  });

  it('parses an env file without keeping comments or replacing exported values', () => {
    expect(
      parseEnvFile('# secret\nPINATA_JWT="abc"\nexport CONTENT_FREE_STORAGE_BYTES=50\n'),
    ).toEqual({
      PINATA_JWT: 'abc',
      CONTENT_FREE_STORAGE_BYTES: '50',
    });
    expect(parseEnvFile("CONTENT_GATEWAY='https://gateway.example'")).toEqual({
      CONTENT_GATEWAY: 'https://gateway.example',
    });
    expect(() => parseEnvFile('lower=1')).toThrow('ENV_FILE_INVALID');
    expect(() => parseEnvFile('NO_SEPARATOR')).toThrow('ENV_FILE_INVALID');
    const target: NodeJS.ProcessEnv = { PINATA_JWT: 'kept' };
    applyEnvFile('PINATA_JWT=replaced\nCONTENT_GATEWAY=https://gateway.example\n', target);
    expect(target.PINATA_JWT).toBe('kept');
    expect(target.CONTENT_GATEWAY).toBe('https://gateway.example');
    expect(loadEnvFile('/tmp/daclify-missing-env-file', {})).toBe(false);
  });

  it('rejects a non-positive price, a premium outside 0 to 10000 bps, and a stale or empty oracle', () => {
    const quote = {
      fiatMinor: 1000n,
      fiatPrecision: 2,
      median: 197n,
      quotedPrecision: 4,
      tlosPrecision: 4,
      premiumBps: 2000,
    };
    expect(() => requiredTlosMinor({ ...quote, fiatMinor: 0n })).toThrow('PRICE_AMOUNT');
    expect(() => requiredTlosMinor({ ...quote, median: 0n })).toThrow('PRICE_AMOUNT');
    expect(() => requiredTlosMinor({ ...quote, premiumBps: -1 })).toThrow('PRICE_PREMIUM');
    expect(() => requiredTlosMinor({ ...quote, premiumBps: 10_001 })).toThrow('PRICE_PREMIUM');
    expect(() => requiredTlosMinor({ ...quote, quotedPrecision: 19 })).toThrow('PRICE_SCALE');
    expect(() => ceilDiv(1n, 0n)).toThrow('PRICE_DENOMINATOR');
    expect(() => ceilDiv(-1n, 2n)).toThrow('PRICE_AMOUNT');
    expect(ceilDiv(5n, 2n)).toBe(3n);
    expect(() => settleServiceAmount(0n, 1n)).toThrow('PRICE_AMOUNT');
    expect(() => settleServiceAmount(1n, 0n)).toThrow('PRICE_AMOUNT');
    expect(settleServiceAmount(10n, 10n)).toEqual({
      status: 'paid',
      shortfallMinor: 0n,
      tipMinor: 0n,
    });
    expect(() => formatTlosMinor(-1n)).toThrow('PRICE_AMOUNT');
    expect(formatTlosMinor(0n)).toBe('0.0000 TLOS');
    const now = new Date('2026-10-06T11:20:00.000Z');
    expect(() => selectDelphiRate([], now, 900)).toThrow('ORACLE_EMPTY');
    expect(() =>
      selectDelphiRate([{ id: 1, median: 0, timestamp: '2026-10-06T11:19:00.000' }], now, 900),
    ).toThrow('ORACLE_EMPTY');
    expect(() =>
      selectDelphiRate([{ id: 1, median: 197, timestamp: '2026-10-06T11:19:00.000' }], now, 0),
    ).toThrow('ORACLE_AGE');
    expect(() => parseDelphiTimestamp('not-a-date')).toThrow('ORACLE_TIMESTAMP');
  });

  it('rejects a service transfer that is not a positive payment to the billing account', () => {
    const payment = {
      billingAccount: 'fees',
      from: 'alice',
      to: 'fees',
      quantity: '1.0000 TLOS',
      memo: 'svc:pin_2026-10',
      parentActor: null,
    };
    expect(classifyServiceTransfer(payment)).toMatchObject({
      rail: 'telos-zero',
      payer: 'alice',
      reference: 'pin_2026-10',
      receivedMinor: 10000n,
    });
    expect(
      classifyServiceTransfer({
        ...payment,
        from: 'eosio.evm',
        memo: 'svc:withdraw-1',
        parentActor: 'carol',
      }),
    ).toMatchObject({ rail: 'telos-evm', payer: 'carol', reference: 'withdraw-1' });
    expect(() => classifyServiceTransfer({ ...payment, to: 'alice' })).toThrow(
      'SERVICE_DESTINATION',
    );
    expect(() => classifyServiceTransfer({ ...payment, quantity: '0.0000 TLOS' })).toThrow(
      'SERVICE_QUANTITY',
    );
    expect(() => classifyServiceTransfer({ ...payment, quantity: '1 TLOS' })).toThrow();
    expect(() => classifyServiceTransfer({ ...payment, memo: 'stake:1' })).toThrow(
      'SERVICE_REFERENCE',
    );
    expect(() => classifyServiceTransfer({ ...payment, memo: `svc:${'a'.repeat(41)}` })).toThrow(
      'SERVICE_REFERENCE',
    );
    expect(() =>
      classifyServiceTransfer({ ...payment, from: 'eosio.evm', memo: '', parentActor: null }),
    ).toThrow('SERVICE_EVM_PAYER');
  });

  it('refuses an inactive Delphi pair and an unreadable oracle response', async () => {
    const original = globalThis.fetch;
    const respond = (body: unknown, status = 200) => {
      globalThis.fetch = async () => new Response(JSON.stringify(body), { status });
    };
    try {
      respond({ rows: [{ name: 'tlosusd', active: 0, quoted_precision: 4 }] });
      await expect(readDelphiPair('https://telos.example', 'tlosusd')).rejects.toThrow(
        'ORACLE_PAIR',
      );
      respond({ rows: [{ name: 'tlosusd', active: false, quoted_precision: 4 }] });
      await expect(readDelphiPair('https://telos.example', 'tlosusd')).rejects.toThrow(
        'ORACLE_PAIR',
      );
      respond({ rows: [] });
      await expect(readDelphiPair('https://telos.example', 'tlosusd')).rejects.toThrow(
        'ORACLE_PAIR',
      );
      respond({ unexpected: true });
      await expect(readDelphiPair('https://telos.example', 'tlosusd')).rejects.toThrow(
        'ORACLE_RESPONSE',
      );
      globalThis.fetch = async () => new Response('down', { status: 503 });
      await expect(
        readDelphiRate('https://telos.example', 'tlosusd', new Date(), 900),
      ).rejects.toThrow('ORACLE_UNAVAILABLE');
    } finally {
      globalThis.fetch = original;
    }
  });
});

it('rejects a future oracle observation instead of accepting a negative age', () => {
  expect(() =>
    selectDelphiRate(
      [{ id: 1, median: 10000, timestamp: '2026-10-07T00:00:01' }],
      new Date('2026-10-07T00:00:00Z'),
      900,
    ),
  ).toThrow('ORACLE_FUTURE');
});

import type { ModuleState } from '@daclify/modules';
import type { DaoSummary } from '../../../../protocol/api.js';
import type { DaoContent } from '../../../../protocol/content.js';
import type { Treasury } from '../../../../protocol/treasury.js';
import { SpendingReportSchema, type SpendingReport } from '../../../../protocol/reporting.js';
import { MAX_ASSET_UNITS } from '../../../../protocol/base.js';
import { parseAsset } from '../market/read.js';
import { ApiError } from '../errors.js';
import type { ChainGateway } from '../chain.js';
const sameDao = (a: SpendingReport['dao'], b: SpendingReport['dao']) =>
  a.chainId === b.chainId &&
  a.contract === b.contract &&
  a.daoId === b.daoId &&
  a.interfaceVersion === b.interfaceVersion;
export function buildSpendingReport(input: {
  dao: DaoSummary;
  treasury?: Treasury;
  content?: DaoContent;
  modules?: ModuleState;
  read: SpendingReport['read'];
  issues: SpendingReport['issues'];
}): SpendingReport {
  const { dao, treasury, content, modules, read } = input,
    issues = [...input.issues];
  for (const source of [treasury, content, modules])
    if (source && !sameDao(source.dao, dao.reference)) throw new ApiError('DAO_REFERENCE', 502);
  if (!treasury && !issues.includes('treasury-unavailable')) issues.push('treasury-unavailable');
  if (
    (!content || Object.values(content.next).some((value) => value !== null)) &&
    !issues.includes('content-unavailable')
  )
    issues.push('content-unavailable');
  if (
    (!modules || Object.values(modules.next).some((value) => value !== null)) &&
    !issues.includes('modules-unavailable')
  )
    issues.push('modules-unavailable');
  if (
    modules?.modules.some(
      (m) => m.installed && ['works', 'payroll'].includes(m.deployment.id) && !m.codeVerified,
    )
  )
    issues.push('module-records-unavailable');
  function amount(quantity: string): bigint {
    try {
      const parsed = parseAsset(quantity);
      if (
        parsed.precision !== dao.token.precision ||
        parsed.symbol !== dao.token.symbol ||
        parsed.minor <= 0n ||
        parsed.minor > MAX_ASSET_UNITS
      )
        throw new Error('Asset');
      return parsed.minor;
    } catch {
      throw new ApiError('CHAIN_RESPONSE_INVALID', 502);
    }
  }
  const receipts = treasury?.receipts ?? [],
    settlements = new Map<string, (typeof receipts)[number]>(),
    receiptIds = new Set<string>();
  for (const receipt of receipts) {
    if (
      receiptIds.has(receipt.id) ||
      receipt.kind > 2 ||
      receipt.token_contract !== dao.token.contract ||
      (receipt.kind === 0 && receipt.destination !== '') ||
      (receipt.kind !== 0 && receipt.destination === '') ||
      (receipt.kind === 2 && receipt.obligation_id !== '0') ||
      (receipt.kind !== 2 && receipt.obligation_id === '0')
    )
      throw new ApiError('CHAIN_RESPONSE_INVALID', 502);
    receiptIds.add(receipt.id);
    amount(receipt.quantity);
    if (receipt.kind !== 2) {
      if (settlements.has(receipt.obligation_id)) throw new ApiError('CHAIN_RESPONSE_INVALID', 502);
      settlements.set(receipt.obligation_id, receipt);
    }
  }
  const obligationIds = new Set<string>();
  const obligations = (treasury?.obligations ?? []).map((obligation) => {
    if (obligation.status > 3 || obligationIds.has(obligation.id))
      throw new ApiError('CHAIN_RESPONSE_INVALID', 502);
    obligationIds.add(obligation.id);
    const receipt = settlements.get(obligation.id);
    if (
      receipt &&
      (obligation.status !== 2 ||
        receipt.recipient !== obligation.recipient ||
        receipt.quantity !== obligation.quantity)
    )
      throw new ApiError('CHAIN_RESPONSE_INVALID', 502);
    const works = modules?.modules.find((m) => m.deployment.id === 'works')?.deployment.account,
      payroll = modules?.modules.find((m) => m.deployment.id === 'payroll')?.deployment.account;
    const milestone =
      obligation.source === works
        ? modules?.milestones.find(
            (m) => m.id === obligation.source_id && m.dao_id === dao.reference.daoId,
          )
        : undefined;
    const project = milestone
      ? modules?.projects.find(
          (p) => p.id === milestone.project_id && p.dao_id === dao.reference.daoId,
        )
      : undefined;
    const refs = [
      ...(project ? [{ id: project.document_id, version: project.document_version }] : []),
      ...(milestone
        ? [
            { id: milestone.submission_doc, version: milestone.submission_version },
            { id: milestone.review_doc, version: milestone.review_version },
          ]
        : []),
    ];
    const documents = refs
      .flatMap((reference) => {
        if (reference.id === '0') return [];
        const doc = content?.documents.find(
          (d) => d.document_id === reference.id && d.version === reference.version,
        );
        if (!doc && content) issues.push('document-reference-unavailable');
        return doc
          ? [
              {
                id: doc.document_id,
                version: doc.version,
                cid: doc.cid,
                commitment: doc.commitment,
                encrypted: doc.envelope_version !== 0,
              },
            ]
          : [];
      })
      .filter(
        (doc, index, all) =>
          all.findIndex((other) => other.id === doc.id && other.version === doc.version) === index,
      );
    const statements = (treasury?.evidence ?? []).filter((e) => e.obligation_id === obligation.id);
    if (
      statements.some(
        (e) =>
          e.dao_id !== dao.reference.daoId ||
          e.recipient !== obligation.recipient ||
          e.quantity !== obligation.quantity ||
          e.mode !== 1,
      )
    )
      throw new ApiError('CHAIN_RESPONSE_INVALID', 502);
    return {
      id: obligation.id,
      source: obligation.source,
      sourceId: obligation.source_id,
      beneficiary: obligation.recipient,
      amount: amount(obligation.quantity).toString(),
      due: obligation.due,
      state: ['reserved', 'approved', 'settled', 'cancelled'][obligation.status],
      settlement:
        obligation.status !== 2
          ? 'pending'
          : receipt
            ? receipt.kind === 0
              ? 'internal-claim'
              : 'native-payment'
            : 'legacy-unknown',
      receiptId: receipt?.id ?? null,
      category:
        obligation.source === works ? 'works' : obligation.source === payroll ? 'payroll' : 'other',
      projectId: project?.id ?? null,
      agreementTerms: project
        ? (modules?.agreements.find(
            (a) => a.project_id === project.id && a.dao_id === dao.reference.daoId,
          )?.terms ?? null)
        : null,
      documents,
      statements,
    };
  });
  if ([...settlements.keys()].some((id) => !obligationIds.has(id)))
    throw new ApiError('CHAIN_RESPONSE_INVALID', 502);
  if (
    treasury?.evidence.some(
      (e) => e.dao_id !== dao.reference.daoId || !obligationIds.has(e.obligation_id),
    )
  )
    throw new ApiError('CHAIN_RESPONSE_INVALID', 502);
  const claimBalances = (content?.members ?? [])
    .filter((m) => m.claim !== '0')
    .map((m) => ({ member: m.id, amount: m.claim }));
  const sum = (rows: { amount: string }[]) =>
    rows.reduce((total, row) => total + BigInt(row.amount), 0n);
  if (
    (treasury &&
      sum(obligations.filter((o) => o.state === 'reserved' || o.state === 'approved')) !==
        BigInt(dao.reserved)) ||
    (content && sum(claimBalances) !== BigInt(dao.claims))
  )
    issues.push('reconciliation-changed');
  return SpendingReportSchema.parse({
    schemaVersion: 1,
    dao: dao.reference,
    asset: dao.token,
    read,
    complete: issues.length === 0,
    issues: [...new Set(issues)],
    receiptCoverage: treasury?.receiptsAvailable ? 'since-receipt-upgrade' : 'unavailable',
    summary: treasury
      ? {
          available: dao.available,
          reserved: dao.reserved,
          claims: dao.claims,
          settledObligations: sum(obligations.filter((o) => o.state === 'settled')).toString(),
          externalCashflow: receipts
            .filter((r) => r.kind !== 0)
            .reduce((total, r) => total + amount(r.quantity), 0n)
            .toString(),
          legacyUnknownSettlements: sum(
            obligations.filter((o) => o.settlement === 'legacy-unknown'),
          ).toString(),
        }
      : null,
    obligations,
    claimBalances,
    receipts,
  });
}
export async function spendingReport(chain: ChainGateway, daoId: string): Promise<SpendingReport> {
  const startedAt = new Date().toISOString(),
    dao = await chain.dao(daoId),
    issues: SpendingReport['issues'] = [];
  const [treasury, content, modules] = await Promise.allSettled([
    chain.treasury(daoId),
    chain.content(daoId),
    chain.moduleState(daoId),
  ]);
  if (treasury.status === 'rejected') issues.push('treasury-unavailable');
  if (content.status === 'rejected') issues.push('content-unavailable');
  if (modules.status === 'rejected') issues.push('modules-unavailable');
  return buildSpendingReport({
    dao,
    read: { startedAt, completedAt: new Date().toISOString(), atomic: false },
    issues,
    ...(treasury.status === 'fulfilled' ? { treasury: treasury.value } : {}),
    ...(content.status === 'fulfilled' ? { content: content.value } : {}),
    ...(modules.status === 'fulfilled' ? { modules: modules.value } : {}),
  });
}
export function spendingCsv(input: SpendingReport): string {
  const report = SpendingReportSchema.parse(input);
  function cell(value: string | number | boolean) {
    const raw = String(value),
      safe = /^[=+\-@]/.test(raw.trimStart()) || /^[\t\r\n]/.test(raw) ? "'" + raw : raw;
    return '"' + safe.replaceAll('"', '""') + '"';
  }
  const rows: (string | number | boolean)[][] = [
    [
      'record',
      'chain',
      'runtime',
      'dao',
      'token-contract',
      'symbol',
      'precision',
      'id',
      'source',
      'source-id',
      'beneficiary',
      'amount-base-units',
      'state',
      'destination-or-chain',
      'payer-or-transaction',
      'documents',
      'read-start',
      'read-end',
      'complete',
      'receipt-coverage',
    ],
  ];
  function row(
    type: string,
    id: string,
    source: string,
    sourceId: string,
    beneficiary: string,
    amount: string,
    state: string,
    destination: string,
    reference: string,
    docs: string,
  ) {
    rows.push([
      type,
      report.dao.chainId,
      report.dao.contract,
      report.dao.daoId,
      report.asset.contract,
      report.asset.symbol,
      report.asset.precision,
      id,
      source,
      sourceId,
      beneficiary,
      amount,
      state,
      destination,
      reference,
      docs,
      report.read.startedAt,
      report.read.completedAt,
      report.complete,
      report.receiptCoverage,
    ]);
  }
  for (const obligation of report.obligations) {
    row(
      'obligation',
      obligation.id,
      obligation.source,
      obligation.sourceId,
      obligation.beneficiary,
      obligation.amount,
      obligation.state + ' / ' + obligation.settlement,
      '',
      '',
      JSON.stringify(obligation.documents),
    );
    for (const statement of obligation.statements)
      row(
        'dao-confirmed-statement',
        statement.id,
        obligation.source,
        obligation.sourceId,
        obligation.beneficiary,
        obligation.amount,
        'not-verified-external-settlement',
        statement.chain,
        statement.payer + ' / ' + statement.reference,
        '',
      );
  }
  for (const receipt of report.receipts)
    row(
      'receipt',
      receipt.id,
      '',
      receipt.obligation_id,
      receipt.recipient,
      parseAsset(receipt.quantity).minor.toString(),
      ['internal-claim-credit', 'native-payment', 'claim-withdrawal'][receipt.kind] ?? 'invalid',
      receipt.destination,
      receipt.transaction_id,
      '',
    );
  return rows.map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';
}

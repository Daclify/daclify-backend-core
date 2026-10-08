import {
  ArchiveRoutes,
  verifyAnchoredArchive,
  decodeArchiveManifest,
  ArchiveBundleSchema,
  archiveHistoryPage,
} from '@daclify/modules/archive';
import type { Account } from '../../../../protocol/api.js';
import type { DaoRef } from '../../../../protocol/base.js';
import type { ChainGateway } from '../chain.js';
import type { ContentProvider } from '../content/provider.js';
import { contentDaoKey } from '../content/ledger.js';
import { ApiError } from '../errors.js';
// History depends on chain authority and verified pins, never on the lost export index or billing receipts.
export class ArchiveHistory {
  constructor(
    private readonly chain: ChainGateway,
    private readonly provider: ContentProvider,
  ) {}
  private async member(account: Account, dao: DaoRef) {
    const network = await this.chain.network();
    if (
      network.chainId !== dao.chainId ||
      network.runtime !== dao.contract ||
      network.interfaceVersion !== dao.interfaceVersion
    )
      throw new ApiError('DAO_REFERENCE');
    if (
      !(await this.chain.memberships(account)).some(
        (m) => m.active && contentDaoKey(m.dao) === contentDaoKey(dao),
      )
    )
      throw new ApiError('MEMBER_REQUIRED', 403);
  }
  async list(account: Account, value: unknown) {
    const input = ArchiveRoutes.history.input.parse(value);
    await this.member(account, input.dao);
    if (!this.chain.archiveHistory) throw new ApiError('ARCHIVE_HISTORY_UNAVAILABLE', 503);
    const result = ArchiveRoutes.history.response.parse(await this.chain.archiveHistory(input));
    if (
      contentDaoKey(result.dao) !== contentDaoKey(input.dao) ||
      result.anchors.some(
        (a) =>
          a.dao_id !== input.dao.daoId ||
          a.manifest.runtime !== input.dao.contract ||
          a.manifest.chain_id !== input.dao.chainId,
      )
    )
      throw new ApiError('ARCHIVE_ANCHOR_INVALID', 503);
    return result;
  }
  async recover(account: Account, value: unknown) {
    const input = ArchiveRoutes.recover.input.parse(value);
    await this.member(account, input.dao);
    if (!this.chain.archiveAnchor) throw new ApiError('ARCHIVE_HISTORY_UNAVAILABLE', 503);
    const anchor = await this.chain.archiveAnchor(input.dao, input.manifestCommitment);
    if (!anchor) throw new ApiError('ARCHIVE_ANCHOR_UNKNOWN', 404);
    try {
      const bytes = await this.provider.retrieve(anchor.manifest_cid, anchor.manifest_bytes),
        m = decodeArchiveManifest(bytes, input.manifestCommitment),
        descriptors = m.families.flatMap((f) => f.chunks);
      if (descriptors.reduce((n, c) => n + c.bytes, bytes.length) > 64 * 1024 * 1024)
        throw new ApiError('ARCHIVE_RESTORE_LIMIT', 409);
      const chunks = [];
      for (const chunk of descriptors)
        chunks.push({
          cid: chunk.cid,
          content: Buffer.from(await this.provider.retrieve(chunk.cid, chunk.bytes)).toString(
            'base64',
          ),
        });
      // A recovery download has a stable ID even when the original SQL export UUID has been lost.
      const h = input.manifestCommitment,
        id = `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
      const bundle = ArchiveBundleSchema.parse({
        id,
        manifest: m,
        manifestFile: {
          cid: anchor.manifest_cid,
          bytes: anchor.manifest_bytes,
          commitment: input.manifestCommitment,
          content: Buffer.from(bytes).toString('base64'),
        },
        chunks,
      });
      return verifyAnchoredArchive(bundle, anchor);
    } catch (cause) {
      if (cause instanceof ApiError) throw cause;
      throw new ApiError('ARCHIVE_BUNDLE_UNAVAILABLE', 503);
    }
  }
  async page(account: Account, value: unknown) {
    const input = ArchiveRoutes.historyPage.input.parse(value);
    return archiveHistoryPage(await this.recover(account, input), input);
  }
}

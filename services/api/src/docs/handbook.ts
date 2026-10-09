import { ModulesHelpBundle } from '@daclify/modules/help';
import { HelpBundleSchema, type HelpBundle } from '../../../../protocol/docs.js';
import { CoreHelpBundle } from '../../../../protocol/generated/help.js';

export type HandbookTopic = HelpBundle['topics'][number];

export function handbookTopics(): HandbookTopic[] {
  const bundles = [CoreHelpBundle, ModulesHelpBundle].map((bundle) =>
    HelpBundleSchema.parse(bundle),
  );
  const topics = bundles.flatMap((bundle) => bundle.topics);
  const ids = topics.map((topic) => topic.id);
  if (
    new Set(ids).size !== ids.length ||
    ids.includes('unlisted') ||
    JSON.stringify(topics).length > 256_000
  )
    throw new Error('HANDBOOK_INVALID');
  return topics;
}

import { ModulesHelpBundle } from '@daclify/modules/help';
import { HelpBundleSchema } from '../../../../protocol/docs.js';
import { CoreHelpBundle } from '../../../../protocol/generated/help.js';

export interface HandbookTopic {
  id: string;
  title: string;
  paragraphs: readonly string[];
}

export function handbookTopics(): HandbookTopic[] {
  const bundles = [CoreHelpBundle, ModulesHelpBundle].map((bundle) =>
    HelpBundleSchema.parse(bundle),
  );
  const topics = bundles.flatMap((bundle) =>
    bundle.topics.map((topic) => ({
      id: topic.id,
      title: topic.title,
      paragraphs: topic.paragraphs,
    })),
  );
  const ids = topics.map((topic) => topic.id);
  if (
    new Set(ids).size !== ids.length ||
    ids.includes('unlisted') ||
    topics.reduce(
      (size, topic) => size + topic.title.length + topic.paragraphs.join('').length,
      0,
    ) > 256_000
  )
    throw new Error('HANDBOOK_INVALID');
  return topics;
}

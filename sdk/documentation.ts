import { z } from 'zod';
import { Checksum256 } from '@wharfkit/antelope';
import {
  DocumentationSourceSchema,
  HelpBundleSchema,
  type HelpBundle,
  type ApiReference,
  type ModuleReference,
} from '../protocol/docs.js';
const Field = z.strictObject({
  name: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
  type: z.string().min(1).max(80),
});
const Abi = z.object({
  version: z.string(),
  types: z.array(z.object({ new_type_name: z.string(), type: z.string() })),
  structs: z.array(z.object({ name: z.string(), base: z.string(), fields: z.array(Field) })),
  actions: z.array(z.object({ name: z.string(), type: z.string() })),
  tables: z.array(z.object({ name: z.string(), type: z.string() })),
});
export function generateDocumentation(
  sourceInput: unknown,
  contracts: ReadonlyArray<{ name: string; abi: string }>,
  api: ReadonlyArray<ApiReference>,
  modules: ReadonlyArray<ModuleReference> = [],
): { bundle: HelpBundle; markdown: string } {
  const source = DocumentationSourceSchema.parse(sourceInput);
  if (new Set(source.topics.map((t) => t.id)).size !== source.topics.length)
    throw new Error('Duplicate documentation topic');
  if (new Set(contracts.map((c) => c.name)).size !== contracts.length)
    throw new Error('Duplicate documentation contract');
  for (const endpoint of api)
    if (!source.topics.some((t) => t.id === endpoint.helpTopic))
      throw new Error('Unknown API help topic');
  for (const module of modules)
    if (!source.topics.some((t) => t.id === module.manifest.helpTopic))
      throw new Error('Unknown module help topic');
  if (new Set(modules.map((m) => m.manifest.id)).size !== modules.length)
    throw new Error('Duplicate documentation module');
  const references = contracts.map((contract) => {
    if (!/^[a-z][a-z0-9]{1,31}$/.test(contract.name)) throw new Error('Invalid reference contract');
    const abi = Abi.parse(JSON.parse(contract.abi));
    function fields(
      type: string,
      parents: ReadonlySet<string> = new Set(),
    ): z.infer<typeof Field>[] {
      if (parents.has(type)) throw new Error('Cyclic ABI reference');
      const visited = new Set([...parents, type]);
      const alias = abi.types.find((t) => t.new_type_name === type);
      if (alias) return fields(alias.type, visited);
      const structure = abi.structs.find((s) => s.name === type);
      if (!structure) throw new Error('Undocumented ABI structure');
      const result = [
        ...(structure.base ? fields(structure.base, visited) : []),
        ...structure.fields,
      ];
      if (new Set(result.map((f) => f.name)).size !== result.length)
        throw new Error('Duplicate ABI reference field');
      return result;
    }
    return {
      name: contract.name,
      abiVersion: abi.version,
      sourceAbiHash: Checksum256.hash(new TextEncoder().encode(contract.abi)).toString(),
      actions: abi.actions.map((action) => ({ name: action.name, fields: fields(action.type) })),
      tables: abi.tables.map((table) => ({ name: table.name, fields: fields(table.type) })),
    };
  });
  const bundle = HelpBundleSchema.parse({
    ...source,
    schemaVersion: 1,
    contracts: references,
    api,
    modules,
  });
  const sections = [
    `# Daclify ${source.producer} reference\n\nPackage ${source.packageVersion} · interface ${source.interfaceVersion}.\n\nGenerated from compiled ABI and canonical API schemas. Field layout does not describe all contract business rules; read the matching explanatory guides.`,
    ...source.topics.map((t) => `## ${t.title}\n\n${t.paragraphs.join('\n\n')}`),
  ];
  for (const contract of references) {
    sections.push(
      `## ${contract.name} contract\n\nSource ABI JSON SHA-256: \`${contract.sourceAbiHash}\`.`,
    );
    for (const [label, entries] of [
      ['Action', contract.actions],
      ['Table', contract.tables],
    ] as const) {
      for (const entry of entries)
        sections.push(
          `### ${label}: ${entry.name}\n\n| Field | ABI type |\n| --- | --- |\n${entry.fields.map((field) => `| ${field.name} | ${field.type} |`).join('\n')}`,
        );
    }
  }
  for (const endpoint of api)
    sections.push(
      `## ${endpoint.method} ${endpoint.path}\n\nGuide: ${endpoint.helpTopic}.\n\n${endpoint.input === undefined ? 'No request body.' : `Request:\n\n\`\`\`json\n${JSON.stringify(endpoint.input, null, 2)}\n\`\`\``}\n\nResponse:\n\n\`\`\`json\n${JSON.stringify(endpoint.response, null, 2)}\n\`\`\``,
    );
  for (const module of bundle.modules)
    sections.push(
      `## ${module.manifest.id} configuration\n\nModule ${module.manifest.version} · config ${module.manifest.configVersion} · core ${module.manifest.coreRange}.\n\nCapabilities: ${module.manifest.capabilities.join(', ')}.\n\nGuide: ${module.manifest.helpTopic}.\n\n\`\`\`json\n${JSON.stringify(module.configuration, null, 2)}\n\`\`\``,
    );
  return { bundle, markdown: sections.join('\n\n') + '\n' };
}

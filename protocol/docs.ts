import { z } from 'zod';
import { valid } from 'semver';
import { ChainIdSchema, ModuleManifestSchema } from './base.js';
const TopicSchema = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9.-]{1,63}$/),
  title: z.string().min(1).max(160),
  paragraphs: z.array(z.string().min(1).max(4000)).min(1).max(16),
});
const FieldSchema = z.strictObject({
  name: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
  type: z.string().min(1).max(80),
});
const EntrySchema = z.strictObject({ name: z.string(), fields: z.array(FieldSchema) });
export const DocumentationSourceSchema = z.strictObject({
  producer: z.enum(['core', 'modules']),
  packageVersion: z.string().refine((v) => valid(v) !== null),
  interfaceVersion: z.literal(1),
  topics: z.array(TopicSchema).min(1).max(64),
});
export const ApiReferenceSchema = z.strictObject({
  method: z.enum(['GET', 'POST']),
  path: z.string().startsWith('/v1/'),
  input: z.unknown().optional(),
  response: z.unknown(),
  helpTopic: z.string(),
});
export const ModuleReferenceSchema = z.strictObject({
  manifest: ModuleManifestSchema,
  configuration: z.unknown(),
});
export const HelpBundleSchema = DocumentationSourceSchema.extend({
  schemaVersion: z.literal(1),
  contracts: z.array(
    z.strictObject({
      name: z.string(),
      abiVersion: z.string(),
      sourceAbiHash: ChainIdSchema,
      actions: z.array(EntrySchema),
      tables: z.array(EntrySchema),
    }),
  ),
  api: z.array(ApiReferenceSchema),
  modules: z.array(ModuleReferenceSchema),
});
export type HelpBundle = z.infer<typeof HelpBundleSchema>;
export type ApiReference = z.infer<typeof ApiReferenceSchema>;
export type ModuleReference = z.infer<typeof ModuleReferenceSchema>;

import { z } from 'zod';
import { ABI, Checksum256 } from '@wharfkit/antelope';
const Field = z.object({ name: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/), type: z.string() });
const Abi = z.object({
  structs: z.array(z.object({ name: Field.shape.name, base: z.string(), fields: z.array(Field) })),
  actions: z.array(z.object({ name: Field.shape.name, type: z.string() })),
});
export function generateContract(
  json: string,
  name: string,
  protocolImport: string,
): { types: string; schemas: string } {
  if (!/^[a-z][a-z0-9]{1,31}$/.test(name)) throw new Error('Invalid contract');
  if (!/^[@a-zA-Z0-9/_.-]+$/.test(protocolImport)) throw new Error('Invalid protocol import');
  const title = name.slice(0, 1).toUpperCase() + name.slice(1);
  const abi = Abi.parse(JSON.parse(json));
  const names = new Set(abi.structs.map((struct) => struct.name));
  function typeOf(type: string): string {
    if (type.endsWith('[]')) return `${typeOf(type.slice(0, -2))}[]`;
    if (type.endsWith('?') || type.endsWith('$')) return `${typeOf(type.slice(0, -1))} | undefined`;
    if (names.has(type)) return type;
    if (['uint8', 'uint16', 'uint32', 'int8', 'int16', 'int32', 'varuint32'].includes(type))
      return 'number';
    if (type === 'bool') return 'boolean';
    if (
      [
        'uint64',
        'int64',
        'uint128',
        'int128',
        'name',
        'asset',
        'symbol',
        'symbol_code',
        'string',
        'bytes',
        'checksum256',
        'public_key',
        'signature',
        'time_point_sec',
      ].includes(type)
    )
      return 'string';
    throw new Error(`Unsupported ABI type ${type}; do not silently weaken generated types`);
  }
  let output =
    '// Generated from compiled C++ ABI. Regenerate with npm run codegen; do not edit.\n';
  const parsed = ABI.from(json);
  const definition = {
    version: parsed.version,
    types: parsed.types,
    structs: parsed.structs,
    actions: parsed.actions,
    tables: parsed.tables,
    variants: parsed.variants,
    ricardian_clauses: parsed.ricardian_clauses,
    action_results: parsed.action_results,
  };
  output += `import type { ABI } from '@wharfkit/antelope';\nexport const ${name}AbiHash = '${Checksum256.hash(new TextEncoder().encode(json))}';\nexport const ${name}Abi = ${JSON.stringify(definition, null, 2)} satisfies ABI.Def;\n`;
  for (const struct of abi.structs)
    output += `export interface ${struct.name}${struct.base ? ` extends ${struct.base}` : ''} {\n${struct.fields.map((field) => `  ${field.name}: ${typeOf(field.type)};`).join('\n')}\n}\n`;
  output += `export interface ${title}Actions {\n${abi.actions.map((action) => `  ${action.name}: ${action.type};`).join('\n')}\n}\n`;
  function schemaOf(type: string, table: boolean): string {
    if (type.endsWith('[]')) return `z.array(${schemaOf(type.slice(0, -2), table)}).max(64)`;
    if (type.endsWith('?') || type.endsWith('$'))
      return `${schemaOf(type.slice(0, -1), table)}.optional()`;
    const struct = abi.structs.find((record) => record.name === type);
    if (struct) {
      if (struct.base) throw new Error('Base struct schemas require explicit support');
      return `z.strictObject({${struct.fields.map((field) => `${field.name}:${schemaOf(field.type, table)}`).join(',')}})`;
    }
    if (['uint8', 'uint16', 'uint32', 'varuint32'].includes(type))
      return `z.int().min(0).max(${type === 'uint8' ? 255 : type === 'uint16' ? 65535 : 4294967295})`;
    if (['int8', 'int16', 'int32'].includes(type))
      return `z.int().min(${type === 'int8' ? -128 : type === 'int16' ? -32768 : -2147483648}).max(${type === 'int8' ? 127 : type === 'int16' ? 32767 : 2147483647})`;
    if (type === 'bool') return table ? 'TransportBoolean' : 'z.boolean()';
    if (type === 'uint64') return table ? 'TransportUint64' : 'Uint64Schema';
    if (type === 'int64') return table ? 'TransportInt64' : 'Int64Schema';
    if (type === 'uint128' || type === 'int128') return 'z.string().regex(/^-?[0-9]+$/).max(40)';
    if (type === 'name')
      return "z.string().max(13).refine(value=>value===''||NativeAccountSchema.safeParse(value).success)";
    if (type === 'bytes') return 'z.string().max(32768).regex(/^(?:[0-9a-f]{2})*$/)';
    if (type === 'string') return 'z.string().max(16384)';
    if (type === 'checksum256') return 'ChainIdSchema';
    if (type === 'asset')
      return 'z.string().max(64).regex(/^-?(0|[1-9][0-9]*)(\\.[0-9]+)? [A-Z]{1,7}$/)';
    if (type === 'symbol') return 'z.string().regex(/^(0|[1-9][0-9]?),[A-Z]{1,7}$/)';
    if (type === 'public_key') return table ? 'TransportPublicKey' : 'PublicKeySchema';
    if (type === 'signature') return 'SignatureSchema';
    throw new Error(`No runtime schema for ${type}`);
  }
  const tables = z
    .object({ tables: z.array(z.object({ name: Field.shape.name, type: z.string() })) })
    .parse(JSON.parse(json)).tables;
  let schemas = `// Generated runtime boundaries from the same compiled ABI.\nimport {z} from 'zod';\nimport {PublicKey,Signature} from '@wharfkit/antelope';\nimport {Uint64Schema,ChainIdSchema,NativeAccountSchema} from ${JSON.stringify(protocolImport)};\n`;
  schemas += `const Int64Schema=z.string().max(20).refine(value=>/^(0|-?[1-9][0-9]*)$/.test(value)&&BigInt(value)>=-(1n<<63n)&&BigInt(value)<(1n<<63n));\nconst numericTransport=(value:unknown):unknown=>typeof value==='number'&&Number.isSafeInteger(value)?String(value):value;\nconst TransportUint64=z.preprocess(numericTransport,Uint64Schema);\nconst TransportInt64=z.preprocess(numericTransport,Int64Schema);\nconst PublicKeySchema=z.string().max(128).refine(value=>{try{return PublicKey.from(value).toString()===value;}catch{return false;}});\nconst SignatureSchema=z.string().max(160).refine(value=>{try{return Signature.from(value).toString()===value;}catch{return false;}});\n`;
  schemas += `const TransportBoolean=z.preprocess(value=>value===0?false:value===1?true:value,z.boolean());\nconst TransportPublicKey=z.preprocess(value=>{if(typeof value!=="string")return value;try{return PublicKey.from(value).toString();}catch{return value;}},PublicKeySchema);\n`;
  schemas += `export const ${title}ActionSchemas={${abi.actions.map((action) => `${action.name}:${schemaOf(action.type, false)}`).join(',')}};\n`;
  schemas += `export const ${title}TableSchemas={${tables.map((table) => `${table.name}:${schemaOf(table.type, true)}`).join(',')}};\n`;
  const lines = schemas.split('\n');
  const declarations = lines.flatMap((line) => {
    const match = /^const ([A-Za-z0-9_]+)=/.exec(line);
    return match?.[1] ? [{ name: match[1], line }] : [];
  });
  const body = lines.filter((line) => line.startsWith('export const ')).join('\n');
  const required = new Set<string>();
  let referenced = body;
  let changed = true;
  while (changed) {
    changed = false;
    for (const declaration of declarations) {
      if (
        !required.has(declaration.name) &&
        new RegExp(`\\b${declaration.name}\\b`).test(referenced)
      ) {
        required.add(declaration.name);
        referenced += '\n' + declaration.line;
        changed = true;
      }
    }
  }
  const definitions = declarations
    .filter((declaration) => required.has(declaration.name))
    .map((declaration) => declaration.line)
    .join('\n');
  const publicImports = ['Uint64Schema', 'ChainIdSchema', 'NativeAccountSchema'].filter((symbol) =>
    new RegExp(`\\b${symbol}\\b`).test(referenced),
  );
  const antelopeImports = ['PublicKey', 'Signature'].filter((symbol) =>
    new RegExp(`\\b${symbol}\\b`).test(referenced),
  );
  schemas = `// Generated from the compiled ABI; input and RPC transport are validated separately.\nimport {z} from 'zod';\n${antelopeImports.length ? `import {${antelopeImports.join(',')}} from '@wharfkit/antelope';\n` : ''}${publicImports.length ? `import {${publicImports.join(',')}} from ${JSON.stringify(protocolImport)};\n` : ''}${definitions}\n${body}\n`;
  return { types: output, schemas };
}

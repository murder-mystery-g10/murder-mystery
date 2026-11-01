// Generates src/contracts/*.ts from docs/contracts. Run: npm run gen:contracts
// Never edit the generated files by hand; change the Pydantic models instead.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { compileFromFile } from 'json-schema-to-typescript'
import * as prettier from 'prettier'

const contractsDir = new URL('../../docs/contracts/', import.meta.url)
const outDir = new URL('../src/contracts/', import.meta.url)
const banner = `/* eslint-disable */
/** Generated from docs/contracts by scripts/gen-contracts.mjs. Do not edit by hand. */`

async function write(name, code) {
  const file = fileURLToPath(new URL(name, outDir))
  const options = (await prettier.resolveConfig(file)) ?? {}
  await writeFile(file, await prettier.format(code, { ...options, parser: 'typescript' }))
  console.log(`wrote src/contracts/${name}`)
}

await mkdir(outDir, { recursive: true })

for (const name of ['theme-map', 'game-api']) {
  const schema = fileURLToPath(new URL(`${name}.schema.json`, contractsDir))
  const code = await compileFromFile(schema, {
    bannerComment: banner,
    unreachableDefinitions: true,
    cwd: fileURLToPath(contractsDir),
  })
  await write(`${name}.ts`, code)
}

const manifest = JSON.parse(
  await readFile(fileURLToPath(new URL('socket-events.json', contractsDir)), 'utf8'),
)
const lines = [banner, "import type * as Api from './game-api'", '']
lines.push('/** Events the client emits; the server answers each one with an ack. */')
lines.push('export interface ClientToServerEvents {')
for (const [name, event] of Object.entries(manifest.client_to_server)) {
  lines.push(`  /** ${event.description} */`)
  lines.push(
    `  '${name}': (payload: Api.${event.payload}, ack: (response: Api.${event.ack}) => void) => void`,
  )
}
lines.push('}', '', '/** Events the server emits. */', 'export interface ServerToClientEvents {')
for (const [name, event] of Object.entries(manifest.server_to_client)) {
  lines.push(`  /** ${event.description} */`)
  lines.push(`  '${name}': (payload: Api.${event.payload}) => void`)
}
lines.push('}')
await write('socket-events.ts', lines.join('\n'))

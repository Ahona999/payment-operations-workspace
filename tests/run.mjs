import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

for (const suite of ['overview-regression', 'queue-check', 'investigation-check', 'reconciliation-check', 'data-audit', 'polish-check']) {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./' + suite + '.mjs', import.meta.url))], { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

// Canonical JSON stays in public/bank.json. Keep old clients working while the
// current application imports the same data as a module, without a fetch call.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export async function prepareBank(root = fileURLToPath(new URL('../', import.meta.url))) {
  const raw = await readFile(resolve(root, 'public/bank.json'), 'utf8');
  const bank = JSON.parse(raw);
  if (bank.questions?.length !== 329 || bank.topics?.length !== 7) throw Error('Unexpected source bank; refusing to publish incomplete data.');
  await writeFile(resolve(root, 'bank.json'), raw);
  await writeFile(resolve(root, 'public/bank-data.js'), '// Generated from public/bank.json by scripts/prepare-bank.mjs.\nexport default ' + JSON.stringify(bank) + ';\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await prepareBank();
  console.log('Prepared bundled bank and backward-compatible /bank.json (329 questions).');
}

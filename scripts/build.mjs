import { rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = fileURLToPath(new URL('../dist/', import.meta.url));
if (!output.startsWith(root) || output === root) throw new Error('Invalid build output');
rmSync(output, { recursive: true, force: true });
const build = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc'], { cwd: root, stdio: 'inherit' });
process.exitCode = build.status ?? 1;

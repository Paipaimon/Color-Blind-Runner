import { spawn, spawnSync } from 'node:child_process';
const build = spawnSync(process.execPath, ['scripts/build.mjs'], { stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);
const children = [
  spawn(process.execPath, ['node_modules/typescript/bin/tsc', '--watch', '--preserveWatchOutput'], { stdio: 'inherit' }),
  spawn(process.execPath, ['--watch', 'dist/server/index.js'], { stdio: 'inherit' })
];
const stop = () => children.forEach(child => child.kill());
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, stop);
for (const child of children) child.once('exit', stop);

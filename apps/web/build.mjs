import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const webDir = fileURLToPath(new URL('.', import.meta.url));
const sourceDir = fileURLToPath(new URL('./src', import.meta.url));
const outputDir = fileURLToPath(new URL('./dist', import.meta.url));
const apiBaseUrl = process.env.WEB_API_BASE_URL ?? 'https://api.hnnt.app';

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
await cp(sourceDir, outputDir, { recursive: true });
await writeFile(
  new URL('./config.js', `file://${outputDir}/`),
  `window.HINTO_API_BASE_URL = ${JSON.stringify(apiBaseUrl)};\n`,
);

console.log(`Built HINTO web assets in ${outputDir.replace(`${webDir}`, 'apps/web/')}`);
console.log(`Configured API base URL: ${apiBaseUrl}`);

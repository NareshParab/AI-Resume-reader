import { parseResumeText } from './src/lib/parser.js';
import { extractText, getDocumentProxy } from 'unpdf';
import fs from 'fs';

async function run(file: string) {
  const buffer = fs.readFileSync('../../test-resumes/' + file);
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text: rawText } = await extractText(pdf, { mergePages: true });
  const cleaned = rawText.replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim();
  const profile = parseResumeText(cleaned);
  console.log('=== ' + file + ' ===');
  console.log(JSON.stringify(profile, null, 2));
}

await run('sample1.pdf');
await run('sample3.pdf');

// Convert the repository's existing Pretendard WOFF2 files to PDF-compatible TTF.
// Run only when updating those font assets: node scripts/build-pdf-fonts.js
const fs = require('node:fs/promises');
const path = require('node:path');
const { decompress } = require('wawoff2');

async function main() {
  for (const weight of ['Regular', 'Bold']) {
    const base = path.join(__dirname, '../src/assets/fonts', `Pretendard-${weight}`);
    await fs.writeFile(`${base}.ttf`, await decompress(await fs.readFile(`${base}.woff2`)));
    console.log(`Converted Pretendard-${weight}.ttf`);
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

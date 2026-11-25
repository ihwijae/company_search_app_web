// Synthetic prices only; validates the supplied fractional bid-price form.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const load = (file) => import(pathToFileURL(path.join(__dirname, '..', file)).href);

async function main() {
  const { PDFDocument, rgb } = require('pdf-lib');
  const fontkit = require('@pdf-lib/fontkit');
  const { appendLhBidPricePage } = await load('src/shared/documents/lhBidPricePdf.js');
  const { evaluateLhBidPrice, LH_BID_PRICE_RULES } = await load('src/shared/agreements/calculations/lhBidPrice.js');
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const regular = await fs.readFile(path.join(__dirname, '../src/assets/fonts/Pretendard-Regular.ttf'));
  const boldBytes = await fs.readFile(path.join(__dirname, '../src/assets/fonts/Pretendard-Bold.ttf'));
  const example = { bidAmount: '9,293,373,771', expectedPrice: '10,520,624,000', aValue: '704,658,655' };
  const cases = [example,
    { bidAmount: '900', expectedPrice: '1000', aValue: '0' },
    { bidAmount: '925', expectedPrice: '1000', aValue: '0' },
    { bidAmount: '875051', expectedPrice: '1000000', aValue: '0' },
    { ...example, bidAmount: '' }, { ...example, expectedPrice: '' }, { ...example, aValue: '' },
    { bidAmount: '900', expectedPrice: '700', aValue: '700' },
    { bidAmount: '87500000000000', expectedPrice: '100000000000000', aValue: '5000000000000' },
  ];
  for (const [index, inputs] of cases.entries()) {
    const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit);
    const font = await pdf.embedFont(regular, { subset: true }); const bold = await pdf.embedFont(boldBytes, { subset: true });
    const criteria = { ...LH_BID_PRICE_RULES, ...(index === cases.length - 1 ? { maxScore: 47 } : {}) };
    const result = evaluateLhBidPrice(inputs, criteria);
    appendLhBidPricePage(pdf, { inputs, criteria, result, score: result.score }, { font, bold, color: rgb(0, 0, 0) });
    const bytes = await pdf.save();
    const parsed = await getDocument({ data: bytes.slice(), standardFontDataUrl: `${path.join(__dirname, '../public/pdf-standard-fonts')}${path.sep}` }).promise;
    assert.equal(parsed.numPages, 1);
    const items = (await (await parsed.getPage(1)).getTextContent()).items;
    const text = items.map((item) => item.str).join('').replace(/\s/g, '');
    assert.ok(text.includes('7.입찰가격점수'));
    assert.ok(!text.includes('NaN'));
    assert.ok(items.every((item) => item.transform[4] >= 56 && item.transform[4] + item.width <= 541), 'All formula and footnote text must stay inside the source margins');
    if (result.status === 'complete') {
      assert.ok(text.includes(`${result.score.toFixed(criteria.scoreDigits)}점`));
      assert.ok(text.includes(result.ratioRounded.toFixed(criteria.ratioDigits)));
      assert.ok(!text.includes('확인해주세요'));
    } else {
      assert.ok(text.includes('확인해주세요'));
      assert.ok(!text.includes('45.00점'));
    }
    if (index === 0) {
      assert.equal(result.score, 45);
      for (const fragment of ['9,293,373,771-704,658,655', '10,520,624,000-704,658,655', '8,588,715,116', '9,815,965,345', '0.8750', '5.00', '₩704,658,655']) assert.ok(text.includes(fragment), fragment);
      const numerator = items.find((item) => item.str === '8,588,715,116');
      const denominator = items.find((item) => item.str === '9,815,965,345');
      assert.ok(numerator.transform[5] > denominator.transform[5]);
      assert.ok(Math.abs(numerator.transform[4] + numerator.width / 2 - denominator.transform[4] - denominator.width / 2) < 1);
      await fs.writeFile('/tmp/lh-bid-price-preview.pdf', bytes);
    }
    await parsed.destroy();
  }
  console.log(`PASS: ${cases.length} bid-price form cases, stacked fractions, sample 45.00 points, A=0, missing/invalid inputs, long amounts and captured criteria`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });

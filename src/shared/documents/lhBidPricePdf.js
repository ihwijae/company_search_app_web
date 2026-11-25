import { StandardFonts } from 'pdf-lib';
import { parseLhEvaluationNumber } from '../agreements/calculations/lhQualification.js';

const amount = (value) => value == null ? '—' : value.toLocaleString('ko-KR', { maximumFractionDigits: 2 });

// Reproduce the supplied page's fraction geometry and six equation baselines.
// Use the captured bid result; this renderer never recalculates the bid score.
export function appendLhBidPricePage(pdf, model, { font, bold, color }) {
  const page = pdf.addPage([595.28, 841.89]);
  const math = pdf.embedStandardFont(StandardFonts.TimesRoman);
  const mathBold = pdf.embedStandardFont(StandardFonts.TimesRomanBold);
  const { inputs, criteria: rules, result, score: evaluatedScore } = model;
  const ready = result?.status === 'complete' && Number.isFinite(evaluatedScore);
  const bid = parseLhEvaluationNumber(inputs.bidAmount);
  const expected = parseLhEvaluationNumber(inputs.expectedPrice);
  const a = parseLhEvaluationNumber(inputs.aValue);
  const bidLessA = bid != null && a != null ? bid - a : null;
  const expectedLessA = expected != null && a != null ? expected - a : null;
  const write = (value, x, y, selectedFont = math, size = 12) => page.drawText(value, { x, y, size, font: selectedFont, color });
  const verticalBar = (x, y) => page.drawLine({ start: { x, y: y - 1 }, end: { x, y: y + 11 }, thickness: .65, color });
  const fraction = (numerator, denominator, x, y, minimumWidth, selectedFont = math) => {
    let size = 12;
    const maximumWidth = 538 - x - 52;
    while (Math.max(selectedFont.widthOfTextAtSize(numerator, size), selectedFont.widthOfTextAtSize(denominator, size)) + 8 > maximumWidth && size > 8) size -= .25;
    const width = Math.max(minimumWidth, selectedFont.widthOfTextAtSize(numerator, size) + 8, selectedFont.widthOfTextAtSize(denominator, size) + 8);
    if (width > maximumWidth) throw new Error('입찰가격점수 양식의 금액이 너무 깁니다. 입력 금액을 확인해 주세요.');
    write(numerator, x + (width - selectedFont.widthOfTextAtSize(numerator, size)) / 2, y + 7.44, selectedFont, size);
    page.drawLine({ start: { x, y: y + 3.7 }, end: { x: x + width, y: y + 3.7 }, thickness: .55, color });
    write(denominator, x + (width - selectedFont.widthOfTextAtSize(denominator, size)) / 2, y - 7.44, selectedFont, size);
    return x + width;
  };
  const prefix = (y, shift = 0) => {
    write(`= ${rules.maxScore} - ${rules.coefficient} × `, 137.4 + shift, y);
    verticalBar(210 + shift, y);
    write('(', 218 + shift, y);
  };
  const suffix = (x, y) => {
    const text = ') × 100';
    write(text, x + 3, y);
    verticalBar(x + 9 + math.widthOfTextAtSize(text, 12), y);
  };
  const fractionRow = (y, numerator, denominator, width, selectedFont = math, shift = 0) => {
    prefix(y, shift);
    fraction(String(rules.targetRatio * 100), '100', 228.28 + shift, y, 28);
    write('-', 263.64 + shift, y);
    const end = fraction(numerator, denominator, 278.16 + shift, y, width, selectedFont);
    suffix(end, y);
  };

  write('7. 입찰가격점수', 56.64, 747.28, bold);
  write('평점(점)', 82.44, 717.88, font);
  fractionRow(717.88, '입찰가격 - A', '예정가격 - A', 82, font, -3.72);
  fractionRow(678.16, `${amount(bid)} - ${amount(a)}`, `${amount(expected)} - ${amount(a)}`, 172);
  fractionRow(638.56, amount(bidLessA), amount(expectedLessA), 84);
  prefix(598.96);
  write(String(rules.targetRatio), 235.08, 598.96);
  write('-', 263.88, 598.96);
  const ratio = ready ? result.ratioRounded.toFixed(rules.ratioDigits) : '—';
  write(ratio, 284.16, 598.96);
  suffix(284.16 + math.widthOfTextAtSize(ratio, 12) + 4, 598.96);
  const deduction = ready ? (rules.maxScore - evaluatedScore).toFixed(rules.scoreDigits) : '—';
  write(`= ${rules.maxScore} – ${deduction}`, 137.4, 566.68);
  write('=', 137.4, 541);
  const score = ready ? evaluatedScore.toFixed(rules.scoreDigits) : '—';
  write(score, 150.24, 541, mathBold, 13);
  const unitX = 150.24 + mathBold.widthOfTextAtSize(score, 13) + 6;
  write('점', unitX, 541, bold, 13);
  page.drawLine({ start: { x: 150.24, y: 538.5 }, end: { x: unitX + bold.widthOfTextAtSize('점', 13), y: 538.5 }, thickness: .6, color });
  write('※ A : 국민연금, 건강보험, 퇴직공제부금비, 노인장기요양보험, 산업안전', 128.64, 499.72, font);
  write(`보건관리비, 안전관리비, 품질관리비의 합산액(₩${amount(a)})`, 170.16, 480.52, font);
  if (!ready) write('※ 입찰가격·예정가격·A값을 확인해 주세요.', 82.44, 442, font, 10);
}

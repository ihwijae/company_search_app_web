import { rgb } from 'pdf-lib';

const number = (value, digits = 2) => value == null ? '—' : value.toLocaleString('ko-KR', { maximumFractionDigits: digits });

// Presentation only: scores, denominator and rounding come from the saved evaluator.
export function appendLhExperiencePage(pdf, model, { font, bold, color }) {
  const { criteria, result } = model;
  const members = result.members;
  const ready = result.status === 'complete';
  const page = pdf.addPage([595.28, 841.89]);
  const widths = [106, 90, 32, 237, 55];
  const left = (595.28 - widths.reduce((sum, width) => sum + width, 0)) / 2;
  const xs = widths.reduce((positions, width) => [...positions, positions[positions.length - 1] + width], [left]);
  const wrap = (value, width, size, selectedFont = font) => {
    const lines = [];
    for (const paragraph of String(value).split('\n')) {
      let line = '';
      for (const character of paragraph) {
        if (line && selectedFont.widthOfTextAtSize(line + character, size) > width) {
          const breakAt = line.lastIndexOf(' ');
          if (breakAt > 0) { lines.push(line.slice(0, breakAt)); line = line.slice(breakAt + 1); }
          else { lines.push(line); line = ''; }
        }
        line += character;
      }
      lines.push(line);
    }
    return lines;
  };
  const write = (value, x, y, size = 10, selectedFont = font) => page.drawText(value, { x, y, size, font: selectedFont, color });
  const cell = (value, x, top, width, height, { size = 10, align = 'center', selectedFont = font, fill = null } = {}) => {
    const lines = wrap(value, width - 8, size, selectedFont);
    if (lines.length * size * 1.12 > height - 4) throw new Error('시공경험평가 내용이 셀 높이를 초과합니다. 업체명과 입력 내용을 확인해 주세요.');
    page.drawRectangle({ x, y: top - height, width, height, borderColor: color, borderWidth: .6, ...(fill ? { color: fill } : {}) });
    const startY = top - (height - lines.length * size * 1.12) / 2 - size;
    lines.forEach((line, index) => write(line, align === 'left' ? x + 6 : x + (width - selectedFont.widthOfTextAtSize(line, size)) / 2, startY - index * size * 1.12, size, selectedFont));
  };
  write('2. 시공경험평가 [공사종류 또는 입찰방법에 따라 해당하는 항목 작성]', left, 766, 11, bold);
  write('다. 가목 및 나목 이외 경우', left + 6, 747);
  const memberWidth = widths[3] / members.length;
  const contentSize = members.length >= 4 ? 8.5 : 9.5;
  const lineHeight = contentSize * 1.12;
  const nameSize = members.length >= 4 ? 7 : 8;
  const nameHeight = Math.max(14, ...members.map((member) => wrap(member.name || '미선택', memberWidth - 8, nameSize).length * nameSize * 1.12 + 5));
  const headerHeight = nameHeight + 13;
  const headerFill = rgb(.9, .9, .9);
  let top = 737;
  ['심사항목', '등 급', '배점\n한도'].forEach((label, index) => cell(label, xs[index], top, widths[index], headerHeight, { fill: headerFill }));
  cell('입찰자\n평 점', xs[4], top, widths[4], headerHeight, { fill: headerFill });
  members.forEach((member, index) => {
    const x = xs[3] + index * memberWidth;
    cell(member.name || '미선택', x, top, memberWidth, nameHeight, { size: nameSize, fill: headerFill });
    cell(`${number(member.share, 4)}%`, x, top - nameHeight, memberWidth, 13, { size: 8, fill: headerFill });
  });
  top -= headerHeight;

  const contentX = xs[3] + 3;
  const contentWidth = widths[3] - 6;
  const performanceNames = members.map((member) => `${member.name || '미선택'} ${criteria.performanceYears}년 실적 : ${number(member.performance5y)}`);
  const sumPrefix = '*실적합계액 = ';
  const sumIndent = font.widthOfTextAtSize(sumPrefix, contentSize);
  const sumRows = members.map((member, index) => ({
    prefix: index === 0 ? sumPrefix : '+ ',
    indent: index === 0 ? 0 : sumIndent - font.widthOfTextAtSize('+ ', contentSize),
    text: `(${number(member.performance5y)}*${number(member.share, 4)}%)`,
  }));
  sumRows.push({ prefix: '= ', indent: sumIndent - font.widthOfTextAtSize('= ', contentSize), text: ready ? number(result.performanceAmount) : '—' });
  const namesHeight = performanceNames.reduce((sum, value) => sum + wrap(value, contentWidth, contentSize).length * lineHeight, 0);
  const sumHeight = sumRows.reduce((sum, row) => sum + wrap(row.prefix + row.text, contentWidth - row.indent, contentSize).length * lineHeight, 0);
  const performanceHeight = Math.max(210, namesHeight + 18 + sumHeight + 12 + 28 + 6 + 28 + 18 + 20 + lineHeight + 13);

  const allDefaulted = members.every((member) => member.qualityDefaulted);
  const weightedGrade = criteria.qualityAggregation === 'weighted-grade';
  const qualityNames = weightedGrade
    ? members.map((member) => `${member.name || '미선택'}: ${number(member.qualityApplied)}점(${member.qualityGrade}등급 ${number(member.qualityPoints)}점)${member.qualityDefaulted ? ' (미평가 적용)' : ''}`)
    : allDefaulted
    ? [`전 업체 최근 3년간 해당 평가결과 없음\n→ ${criteria.qualityDefault}점 적용`]
    : members.map((member) => `${member.name || '미선택'}: ${number(member.qualityApplied)}점${member.qualityDefaulted ? ' (미평가 적용)' : ''}`);
  const qualityExpression = members.map((member) => `(${number(weightedGrade ? member.qualityPoints : member.qualityApplied)}*${number(member.share, 4)}%)`).join('+');
  const thresholdIndex = ready ? criteria.qualityThresholds.findIndex((threshold) => result.qualityTotal >= threshold.gte) : -1;
  const thresholdLabel = (threshold, index) => threshold.gte === 0 && index > 0
    ? `${criteria.qualityThresholds[index - 1].gte}점 미만`
    : `${threshold.gte}점 이상`;
  const qualityConclusion = weightedGrade ? `▶ 품질평가 평점: ${ready ? number(result.qualityPoints) : '—'}점`
    : thresholdIndex < 0 ? '▶ 품질평가 평점: —'
    : `▶ ${String.fromCharCode(65 + thresholdIndex)}: ${thresholdLabel(criteria.qualityThresholds[thresholdIndex], thresholdIndex)}(${number(result.qualityPoints)})`;
  const qualityText = [...qualityNames, '', qualityExpression, `= ${ready ? number(weightedGrade ? result.qualityPoints : result.qualityTotal, 4) : '—'}`].join('\n');
  const qualityHeight = Math.max(101, wrap(qualityText, contentWidth, contentSize).length * lineHeight + 26 + lineHeight);
  const notes = [`※ 실적부문과 품질평가부문으로 평가하되, 시공경험의 배점한도(${criteria.constructionMax})를 초과할 수 없다.`];
  if (!ready) notes.push(`※ 작성 중: ${result.missing.join(', ')} 입력이 필요합니다.`);
  else if (!result.shareComplete) notes.push('※ 작성 중: 참여비율 합계가 100%인지 확인해 주세요.');
  if (top - performanceHeight - qualityHeight - 27 - 20 - notes.length * 16 < 57) throw new Error('시공경험평가가 한 페이지를 초과합니다. 업체명 등 입력 길이를 확인해 주세요.');

  cell(`최근 ${criteria.performanceYears}년간 당해공사\n업종의 공사실적금액`, xs[0], top, widths[0], performanceHeight);
  cell(`점수\n=실적계수×${criteria.performanceMultiplier}`, xs[1], top, widths[1], performanceHeight);
  cell(number(criteria.performanceMax), xs[2], top, widths[2], performanceHeight);
  cell('', xs[3], top, widths[3], performanceHeight);
  cell(ready ? number(result.performanceScore) : '—', xs[4], top, widths[4], performanceHeight, { selectedFont: bold });
  let cursor = top - 7;
  const block = (value, x = contentX, width = contentWidth, selectedFont = font) => {
    for (const line of wrap(value, width, contentSize, selectedFont)) {
      write(line, x, cursor - contentSize, contentSize, selectedFont);
      cursor -= lineHeight;
    }
  };
  const nameLines = performanceNames.flatMap((value) => wrap(value, contentWidth, contentSize));
  const namesWidth = Math.max(...nameLines.map((value) => font.widthOfTextAtSize(value, contentSize)));
  const namesX = contentX + (contentWidth - namesWidth) / 2;
  nameLines.forEach((value) => block(value, namesX, namesWidth + .01));
  cursor -= 18;
  const sumWidth = Math.min(contentWidth, Math.max(...sumRows.map((row) => row.indent + font.widthOfTextAtSize(row.prefix + row.text, contentSize))));
  const sumX = contentX + (contentWidth - sumWidth) / 2;
  sumRows.forEach((row) => block(row.prefix + row.text, sumX + row.indent, sumWidth - row.indent + .01));
  cursor -= 12;

  const fractionPrefix = '*실적계수 = ';
  const numeratorText = `${ready ? number(result.performanceAmount) : '—'}원`;
  const multiplier = criteria.denominatorMultiplier;
  const symbolicDenominator = `(공사예정금액 × ${multiplier})`;
  const denominatorText = `(${result.denominator > 0 ? number(result.denominator / multiplier) : '—'}원 × ${multiplier})`;
  const prefixWidth = font.widthOfTextAtSize(fractionPrefix, contentSize);
  const fractionWidth = Math.min(contentWidth - prefixWidth - 10, Math.max(...['실적합계액', symbolicDenominator, numeratorText, denominatorText].map((value) => font.widthOfTextAtSize(value, contentSize))) + 8);
  const equationX = contentX + (contentWidth - prefixWidth - 6 - fractionWidth) / 2;
  const fractionX = equationX + prefixWidth + 6;
  const fraction = (numerator, denominator, symbolic = false) => {
    let size = contentSize;
    while (Math.max(font.widthOfTextAtSize(numerator, size), font.widthOfTextAtSize(denominator, size)) > fractionWidth - 4 && size > 6) size -= .25;
    if (size <= 6) throw new Error('시공경험평가 분수의 금액이 너무 깁니다. 입력 금액을 확인해 주세요.');
    const lineWidth = Math.max(font.widthOfTextAtSize(numerator, size), font.widthOfTextAtSize(denominator, size)) + 4;
    const startX = fractionX + (fractionWidth - lineWidth) / 2;
    const centerX = fractionX + fractionWidth / 2;
    const lineY = cursor - 13;
    write(symbolic ? fractionPrefix : '= ', symbolic ? equationX : fractionX - font.widthOfTextAtSize('= ', contentSize) - 6, lineY - contentSize / 3, contentSize);
    write(numerator, centerX - font.widthOfTextAtSize(numerator, size) / 2, lineY + 3, size);
    page.drawLine({ start: { x: startX, y: lineY }, end: { x: startX + lineWidth, y: lineY }, thickness: .55, color });
    write(denominator, centerX - font.widthOfTextAtSize(denominator, size) / 2, lineY - size - 3, size);
    cursor -= 28;
  };
  fraction('실적합계액', symbolicDenominator, true);
  cursor -= 6;
  fraction(numeratorText, denominatorText);
  cursor -= 4;
  block(`= ${ready ? result.ratioRounded.toFixed(criteria.ratioDigits) : '—'}`, fractionX - font.widthOfTextAtSize('= ', contentSize), fractionWidth + 12);
  const performanceConclusion = `▶ 평점 : ${ready ? result.ratioRounded.toFixed(criteria.ratioDigits) : '—'} × ${criteria.performanceMultiplier}점 = ${ready ? number(result.performanceScore) : '—'}점`;
  cursor = top - performanceHeight + lineHeight + 10;
  block(performanceConclusion, contentX + Math.max(0, (contentWidth - bold.widthOfTextAtSize(performanceConclusion, contentSize)) / 2), contentWidth, bold);

  top -= performanceHeight;
  const thresholds = criteria.qualityThresholds.map((threshold, index) => `${String.fromCharCode(65 + index)}: ${thresholdLabel(threshold, index)}(${number(threshold.score)}점)`);
  cell('품질평가점수\n(LH의 품질평가 결과)', xs[0], top, widths[0], qualityHeight);
  cell(thresholds.join('\n'), xs[1], top, widths[1], qualityHeight, { size: 8.5, align: 'left' });
  cell(number(Math.max(...criteria.qualityThresholds.map((threshold) => threshold.score))), xs[2], top, widths[2], qualityHeight);
  cell('', xs[3], top, widths[3], qualityHeight);
  cell(ready ? number(result.qualityPoints) : '—', xs[4], top, widths[4], qualityHeight, { selectedFont: bold });
  cursor = top - 10;
  block(qualityText);
  cursor = top - qualityHeight + lineHeight + 10;
  block(qualityConclusion, contentX + 3, contentWidth - 6, bold);
  top -= qualityHeight;
  cell('평가합계', left, top, xs[4] - left, 27, { align: 'center' });
  cell(ready ? result.score.toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: criteria.scoreDigits }) : '—', xs[4], top, widths[4], 27, { selectedFont: bold });
  notes.forEach((note, index) => write(note, left, top - 47 - index * 16, 9));
}

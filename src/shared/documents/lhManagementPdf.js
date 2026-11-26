import { documentFontSize } from './documentTypography.js';
import { rgb } from 'pdf-lib';
import { formatLhManagementFormula } from './lhManagementFormula.js';

const numeric = (value, digits = 2) => value == null ? '-' : Number(value).toLocaleString('ko-KR', { maximumFractionDigits: digits });

function createTable(pdf, fonts) {
  const { font, bold, color } = fonts;
  const page = pdf.addPage([595.28, 841.89]);
  const left = (595.28 - 520) / 2;
  const wrap = (value, width, size) => {
    const lines = [];
    for (const paragraph of String(value).split('\n')) {
      let line = '';
      for (const character of paragraph) {
        if (line && font.widthOfTextAtSize(line + character, size) > width) { lines.push(line); line = ''; }
        line += character;
      }
      lines.push(line);
    }
    return lines;
  };
  const write = (value, x, y, size = documentFontSize(10), selectedFont = font) => page.drawText(value, { x, y, size, font: selectedFont, color });
  const cell = (value, x, top, width, height, { size = documentFontSize(9), fill = false, strong = false, align = 'center' } = {}) => {
    const lines = wrap(value, width - 8, size);
    if (top - height < 55 || lines.length * size * 1.2 > height - 6) throw new Error('경영상태평가 내용이 한 페이지를 초과합니다. 업체명 등 입력 길이를 확인해 주세요.');
    page.drawRectangle({ x, y: top - height, width, height, borderColor: color, borderWidth: .6, ...(fill ? { color: rgb(.9, .9, .9) } : {}) });
    const selectedFont = strong ? bold : font;
    const startY = top - (height - lines.length * size * 1.2) / 2 - size;
    lines.forEach((line, index) => write(line, align === 'left' ? x + 4 : x + (width - selectedFont.widthOfTextAtSize(line, size)) / 2, startY - index * size * 1.2, size, selectedFont));
  };
  const heightFor = (value, width, size = documentFontSize(9)) => wrap(value, width - 8, size).length * size * 1.2 + 9;
  return { page, left, cell, write, heightFor, bold };
}

function financialGrade(company, key, definition, scale, industryAvg) {
  if (company.method === 'credit') return '-';
  if (company.method !== 'composite') return '미산정';
  const details = company.financialDetails;
  const partKey = { debtRatio: 'debtScore', currentRatio: 'currentScore', bizYears: 'yearsScore' }[key];
  const score = details.parts[partKey];
  const gradeIndex = definition.thresholds.findIndex((item) => Math.abs(item.score - score) < 1e-8);
  const grade = gradeIndex < 0 ? '' : String.fromCharCode(65 + gradeIndex);
  if (key === 'bizYears') {
    const threshold = definition.thresholds[gradeIndex];
    const years = threshold?.gteYears != null ? `${threshold.gteYears}년 이상` : threshold?.ltYears != null ? `${threshold.ltYears}년 미만` : `${numeric(details.bizYears)}년`;
    return `${company.bizYearsText || '-'}\n= ${years}\n${grade}: ${numeric(score * scale)}점`;
  }
  const ratio = details[key];
  const average = industryAvg[key];
  return definition.against === 'industryAverage'
    ? `${numeric(ratio)}%/${numeric(average)}%\n= ${numeric(ratio / average * 100)}%\n${grade}: ${numeric(score * scale)}점`
    : `${numeric(ratio)}%\n${grade}: ${numeric(score * scale)}점`;
}

function gradeLabels(definition, isYears = false) {
  return definition.thresholds.map((item, index) => {
    const boundary = isYears ? item.gteYears ?? item.ltYears : (item.gte ?? item.lt) * 100;
    return `${String.fromCharCode(65 + index)}: ${numeric(boundary)}${isYears ? '년' : '%'} ${item.gte != null || item.gteYears != null ? '이상' : '미만'}`;
  }).join('\n');
}

const CREDIT_GROUPS = [
  ['A+이상', 'A2+이상', ['AAA', 'AA+', 'AA0', 'AA-', 'A+']],
  ['A0', 'A20', ['A0']], ['A-', 'A2-', ['A-']], ['BBB+', 'A3+', ['BBB+']],
  ['BBB0', 'A30', ['BBB0']], ['BBB-', 'A3-', ['BBB-']], ['BB+, BB0', 'B+', ['BB+', 'BB0']],
  ['BB-', 'B0', ['BB-']], ['B+, B0, B-', 'B-', ['B+', 'B0', 'B-']],
  ['CCC+이하', 'C 이하', ['CCC+', 'CCC0', 'CCC-', 'CC', 'C', 'D']],
];

export function appendLhManagementPages(pdf, model, fonts) {
  const { companies, financial, credit, financialFormScale: scale } = model;
  const financialTable = createTable(pdf, fonts);
  const { left } = financialTable;
  const companySize = companies.length >= 4 ? documentFontSize(7.5) : documentFontSize(9);
  const widths = [150, 65, 52];
  const dataX = left + widths.reduce((sum, width) => sum + width, 0);
  const companyWidth = (520 - (dataX - left)) / companies.length;
  let top = 737;
  financialTable.write('3. 경영상태평가 [가목 및 나목 중 택일하여 작성]', left, 766, documentFontSize(12), fonts.bold);
  financialTable.write('가. 부채비율, 유동비율, 영업기간으로 평가하는 경우', left, 747);
  const header = (table, labels, labelWidths, firstTop, memberWidth) => {
    const nameHeight = Math.max(24, ...companies.map((company) => table.heightFor(company.name || '미선택', memberWidth, companySize)));
    const height = nameHeight + 18;
    let x = left;
    labels.forEach((label, index) => { table.cell(label, x, firstTop, labelWidths[index], height, { fill: true }); x += labelWidths[index]; });
    companies.forEach((company, index) => {
      table.cell(company.name || '미선택', x + index * memberWidth, firstTop, memberWidth, nameHeight, { size: companySize, fill: true });
      table.cell(`${numeric(company.share, 4)}%`, x + index * memberWidth, firstTop - nameHeight, memberWidth, 18, { size: documentFontSize(8), fill: true });
    });
    return firstTop - height;
  };
  top = header(financialTable, ['심사항목', '등급', '배점한도'], widths, top, companyWidth);
  for (const [key, label] of [['debtRatio', '최근년도부채비율'], ['currentRatio', '최근년도유동비율'], ['bizYears', '영업기간']]) {
    const definition = financial.components[key];
    const grades = gradeLabels(definition, key === 'bizYears');
    const points = definition.thresholds.map((item) => numeric(item.score * scale, 1)).join('\n');
    const values = companies.map((company) => financialGrade(company, key, definition, scale, model.industryAvg));
    const height = Math.max(60, financialTable.heightFor(grades, widths[1], documentFontSize(8.5)), ...values.map((value) => financialTable.heightFor(value, companyWidth, companySize)));
    financialTable.cell(label, left, top, widths[0], height);
    financialTable.cell(grades, left + widths[0], top, widths[1], height, { size: documentFontSize(8.5) });
    financialTable.cell(points, left + widths[0] + widths[1], top, widths[2], height, { size: documentFontSize(8.5) });
    values.forEach((value, index) => financialTable.cell(value, dataX + index * companyWidth, top, companyWidth, height, { size: companySize }));
    top -= height;
  }
  const financialFormula = formatLhManagementFormula(model, 'composite');
  const financialFormulaHeight = Math.max(55, financialTable.heightFor(financialFormula, 520 - (dataX - left), documentFontSize(8.5)));
  financialTable.cell('계산식', left, top, dataX - left, financialFormulaHeight);
  financialTable.cell(financialFormula, dataX, top, 520 - (dataX - left), financialFormulaHeight, { size: documentFontSize(8.5), align: 'left' });
  top -= financialFormulaHeight;
  financialTable.cell('평가합계', left, top, dataX - left, 24);
  financialTable.cell(model.missing.length ? '-' : numeric(model.financialSubtotal, 4), dataX, top, 520 - (dataX - left), 24, { strong: true });

  const creditTable = createTable(pdf, fonts);
  creditTable.write('나. 회사채, 기업어음, 기업의 신용평가등급으로 평가하는 경우', left, 790);
  const creditWidths = [66, 66, 174, 32];
  const creditX = left + creditWidths.reduce((sum, width) => sum + width, 0);
  const creditCompanyWidth = (520 - (creditX - left)) / companies.length;
  top = header(creditTable, ['회사채에 대한\n신용평가등급', '기업어음에 대한\n신용평가등급', '기업신용평가등급', '평점'], creditWidths, 766, creditCompanyWidth);
  for (const [bond, paper, grades] of CREDIT_GROUPS) {
    const gradeRow = credit.gradeTable.find((row) => grades.includes(row.grade));
    if (!gradeRow) continue;
    const label = `회사채에 대한 신용평가등급 ${bond}에 준하는 등급`;
    const values = companies.map((company) => company.method === 'credit' && grades.includes(company.creditGrade) ? `○\n(${company.creditGrade})` : company.method ? '-' : '미산정');
    const height = Math.max(28, creditTable.heightFor(label, creditWidths[2], documentFontSize(8)), ...values.map((value) => creditTable.heightFor(value, creditCompanyWidth, companySize)));
    let x = left;
    [bond, paper, label, numeric(gradeRow.base, 1)].forEach((value, index) => { creditTable.cell(value, x, top, creditWidths[index], height, { size: documentFontSize(8) }); x += creditWidths[index]; });
    values.forEach((value, index) => creditTable.cell(value, creditX + index * creditCompanyWidth, top, creditCompanyWidth, height, { size: companySize }));
    top -= height;
  }
  const creditFormula = formatLhManagementFormula(model, 'credit');
  const creditFormulaHeight = Math.max(55, creditTable.heightFor(creditFormula, 520 - (creditX - left), documentFontSize(8)));
  creditTable.cell('계산식', left, top, creditX - left, creditFormulaHeight);
  creditTable.cell(creditFormula, creditX, top, 520 - (creditX - left), creditFormulaHeight, { size: documentFontSize(8), align: 'left' });
  top -= creditFormulaHeight;
  creditTable.cell('평가합계', left, top, creditX - left, 24);
  creditTable.cell(model.missing.length ? '-' : numeric(model.creditSubtotal, 4), creditX, top, 520 - (creditX - left), 24, { strong: true });
  top -= 24;
  creditTable.cell('총합계', left, top, creditX - left, 26);
  creditTable.cell(model.totalScore == null ? '-' : `${numeric(model.financialSubtotal, 4)} + ${numeric(model.creditSubtotal, 4)} = ${numeric(model.totalScore)}`, creditX, top, 520 - (creditX - left), 26, { size: documentFontSize(8.5), strong: true });
  if (model.missing.length) creditTable.write('※ 작성 중: 경영상태 평가정보와 참여비율을 확인해 주세요.', left, top - 46, documentFontSize(9));
}

import { rgb } from 'pdf-lib';

export function appendLhFixedSectionsPage(pdf, model, { font, bold, color }) {
  const page = pdf.addPage([595.28, 841.89]);
  const left = 57;
  const widths = [216, 114, 92, 59];
  const xs = widths.reduce((positions, width) => [...positions, positions[positions.length - 1] + width], [left]);
  const write = (value, x, y, size = 10.5, selectedFont = font) => page.drawText(value, { x, y, size, font: selectedFont, color });
  const cell = (value, x, top, width, height, { selectedFont = font, size = 10, fill = false } = {}) => {
    page.drawRectangle({ x, y: top - height, width, height, borderColor: color, borderWidth: .6, ...(fill ? { color: rgb(.9, .9, .9) } : {}) });
    const lines = value.split('\n');
    const startY = top - (height - lines.length * size * 1.2) / 2 - size;
    lines.forEach((line, index) => write(line, x + (width - selectedFont.widthOfTextAtSize(line, size)) / 2, startY - index * size * 1.2, size, selectedFont));
  };
  write('5. 하도급 관리계획 적정성 평가', left, 766, 12, bold);
  let top = 747;
  const headerHeight = 32;
  ['심사항목', '등 급', '배점한도', '입찰자\n평 점'].forEach((label, index) => cell(label, xs[index], top, widths[index], headerHeight, { fill: true }));
  top -= headerHeight;
  const rowHeight = 26;
  ['하도급 시행비율', '하도급 금액비율'].forEach((label, index) => {
    cell(label, xs[0], top - index * rowHeight, widths[0], rowHeight);
    cell('', xs[1], top - index * rowHeight, widths[1], rowHeight);
    cell('5', xs[2], top - index * rowHeight, widths[2], rowHeight);
  });
  cell('평가합계', left, top - rowHeight * 2, widths[0] + widths[1] + widths[2], rowHeight);
  const score = model.scores.subcontract;
  cell(score == null ? '—' : `${score} 점`, xs[3], top, widths[3], rowHeight * 3, { selectedFont: bold });
  top -= rowHeight * 3;
  write('다. 전문, 전기, 정보통신, 소방시설, 문화재공사 등의 하도급관리계획 적정성은 만점', left, top - 23);
  write('으로 평가한다.', left + 24, top - 41);
  write('6. 자재 및 인력조달 가격의 적정성 평가', left, top - 80, 12, bold);
  write('※자재 및 인력조달 가격의 적정성 평가는 배점한도 점수를 부여한다.', left + 12, top - 103);
}

import { documentFontSize } from './documentTypography.js';
import { rgb } from 'pdf-lib';

export function appendLhCredibilityPages(pdf, model, { font, bold, color }) {
  const widths = [67, 132, 30, 146, 28];
  const fixedWidth = widths.reduce((sum, value) => sum + value, 0);
  const companyWidth = (520 - fixedWidth) / model.members.length;
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
  let offset = 0;
  const groups = (model.itemsPerPage || [4, model.items.length - 4]).map((count) => {
    const items = model.items.slice(offset, offset + count);
    offset += count;
    return items;
  });
  groups.forEach((items, pageIndex) => {
    const page = pdf.addPage([595.28, 841.89]);
    const nameSize = model.members.length >= 4 ? documentFontSize(7) : documentFontSize(8);
    const nameHeight = Math.max(30, ...model.members.map((member) => wrap(member.name || '미선택', companyWidth - 6, nameSize).length * nameSize * 1.2 + 8));
    const shareSize = model.members.length >= 4 ? documentFontSize(7) : documentFontSize(8);
    const shareHeight = Math.max(18, ...model.members.map((member) => wrap(member.share == null ? '-' : `${member.share}%`, companyWidth - 8, shareSize).length * shareSize * 1.2 + 6));
    const headerHeight = nameHeight + shareHeight;
    const rowValues = (item) => [item.category, item.factor, item.allocation, item.grades, item.points];
    const rowTextSize = (item, size) => item.scoreBlank ? Math.min(size, documentFontSize(7)) : size;
    const rowHeight = (item, size) => {
      const textSize = rowTextSize(item, size);
      return Math.max(item.scoreBlank ? 18 : 38, ...rowValues(item).map((value, index) => wrap(value, widths[index] - 8, textSize).length * textSize * 1.2 + 12));
    };
    let size = documentFontSize(8);
    const footerHeight = pageIndex === groups.length - 1 ? 40 : 0;
    while (737 - headerHeight - items.reduce((sum, item) => sum + rowHeight(item, size), 0) - footerHeight < 57 && size > 7) size -= .25;
    if (737 - headerHeight - items.reduce((sum, item) => sum + rowHeight(item, size), 0) - footerHeight < 57) throw new Error('신인도 평가표가 한 페이지를 초과합니다. 업체명 길이를 확인해 주세요.');
    const cell = (value, x, top, width, height, { textSize = size, fill = false, strong = false, align = 'center' } = {}) => {
      const selectedFont = strong ? bold : font;
      const lines = wrap(value, width - 8, textSize);
      page.drawRectangle({ x, y: top - height, width, height, borderColor: color, borderWidth: .6, ...(fill ? { color: rgb(.9, .9, .9) } : {}) });
      const startY = top - (height - lines.length * textSize * 1.2) / 2 - textSize;
      lines.forEach((line, index) => page.drawText(line, { x: align === 'left' ? x + 4 : x + (width - selectedFont.widthOfTextAtSize(line, textSize)) / 2, y: startY - index * textSize * 1.2, size: textSize, font: selectedFont, color }));
    };
    if (pageIndex === 0) page.drawText('4. 신인도 평가', { x: left, y: 766, size: documentFontSize(12), font: bold, color });
    let top = 737;
    let x = left;
    ['심사항목', '평 가 요 소', '배점', '등 급', '평점'].forEach((label, index) => { cell(label, x, top, widths[index], headerHeight, { fill: true, textSize: documentFontSize(9) }); x += widths[index]; });
    model.members.forEach((member, index) => {
      const columnX = left + fixedWidth + index * companyWidth;
      cell(member.name || '미선택', columnX, top, companyWidth, nameHeight, { fill: true, textSize: nameSize });
      cell(member.share == null ? '-' : `${member.share}%`, columnX, top - nameHeight, companyWidth, shareHeight, { fill: true, textSize: shareSize });
    });
    top -= headerHeight;
    items.forEach((item) => {
      const height = rowHeight(item, size);
      let x = left;
      rowValues(item).forEach((value, index) => {
        cell(index === 4 && item.pointsByGrade ? '' : value, x, top, widths[index], height, { textSize: rowTextSize(item, size), align: index === 1 || index === 3 ? 'left' : 'center' });
        if (index === 4 && item.pointsByGrade) {
          const lineHeight = size * 1.2;
          const lines = wrap(item.grades, widths[3] - 8, size);
          let y = top - (height - lines.length * lineHeight) / 2 - size;
          item.grades.split('\n\n').forEach((grade, gradeIndex) => {
            const points = item.pointsByGrade[gradeIndex];
            page.drawText(points, { x: x + (widths[index] - font.widthOfTextAtSize(points, size)) / 2, y, size, font, color });
            y -= (wrap(grade, widths[3] - 8, size).length + 1) * lineHeight;
          });
        }
        x += widths[index];
      });
      item.scores.forEach((score, index) => cell(String(score), x + index * companyWidth, top, companyWidth, height, { textSize: documentFontSize(10), strong: true }));
      top -= height;
    });
    if (pageIndex === groups.length - 1) {
      cell(model.summaryLabel || '합 계 [최종평점 : 신인도 평점 합계]\n배점 범위: +1.5 ~ -3', left, top, fixedWidth, 40, { textSize: documentFontSize(9) });
      model.members.forEach((member, index) => cell(String(member.score), left + fixedWidth + index * companyWidth, top, companyWidth, 40, { textSize: documentFontSize(10), strong: true }));
    }
  });
}

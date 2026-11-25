import { documentFontSize } from './documentTypography.js';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const A4 = [595.28, 841.89];
const INK = rgb(0, 0, 0);

function wrapText(text, font, size, width) {
  const lines = [];
  for (const paragraph of String(text || '').split(/\r?\n/)) {
    let line = '';
    for (const character of paragraph) {
      if (line && font.widthOfTextAtSize(line + character, size) > width) {
        lines.push(line.trimEnd());
        line = character.trimStart();
      } else line += character;
    }
    lines.push(line);
  }
  return lines;
}

const dateLabel = (value) => value ? String(value).slice(0, 10).replace(/-/g, '.   ') + '.' : '(작성날짜 미입력)';
const bidLabel = (value) => value ? String(value).replace('T', ' ').replace(/-/g, '/').slice(0, 16) : '(입찰일시 미입력)';

export async function createLhApplicationPdf(model, { regularFontBytes, boldFontBytes, subsetFonts = true, allowIncomplete = false } = {}) {
  if (!model || (!model.complete && !allowIncomplete)) throw new Error('신청서 필수 입력정보를 먼저 확인해 주세요.');
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(regularFontBytes, { subset: subsetFonts });
  const bold = await pdf.embedFont(boldFontBytes || regularFontBytes, { subset: subsetFonts });
  const page = pdf.addPage(A4);
  const left = 57;
  const width = A4[0] - left * 2;
  const draw = (text, x, y, size = documentFontSize(11.5), font = regular) => page.drawText(text, { x, y, size, font, color: INK });
  const center = (text, y, size, font = regular) => draw(text, (A4[0] - font.widthOfTextAtSize(text, size)) / 2, y, size, font);
  draw(model.formLabel, left, 772, documentFontSize(10.5));
  center(model.title, 751, documentFontSize(15), bold);
  let headerY = 714;
  for (const text of [`ㅇ공고번호 : ${model.noticeNo || '(미입력)'}`, `ㅇ공 사 명 : ${model.noticeTitle || '(미입력)'}`, `ㅇ입찰일시 : ${bidLabel(model.bidDeadline)}`]) {
    for (const line of wrapText(text, regular, documentFontSize(11.5), width)) { draw(line, left, headerY); headerY -= 19; }
  }

  let layout;
  for (const size of [documentFontSize(11.5), documentFontSize(11), documentFontSize(10.5), documentFontSize(10), documentFontSize(9.5)]) {
    const lineHeight = size * 1.7;
    const paragraph = wrapText(model.paragraph, regular, size, width);
    const address = wrapText(model.leader.address || '(주소 미입력)', regular, size, width - 263);
    const company = wrapText(model.leader.name || '(회사명 미입력)', regular, size, width - 263);
    const representative = wrapText(model.leader.representative || '(대표자 미입력)', regular, size, width - 303);
    const paragraphY = headerY - 22;
    const dateY = paragraphY - paragraph.length * lineHeight - 16;
    const signatureY = dateY - 24;
    const attachmentY = signatureY - (address.length + company.length + representative.length) * lineHeight - 4;
    const recipientY = attachmentY - 35;
    if (recipientY >= 171) { layout = { size, lineHeight, paragraph, address, company, representative, paragraphY, dateY, signatureY, attachmentY, recipientY }; break; }
  }
  if (!layout) throw new Error('신청서 내용이 1페이지를 초과합니다. 공고명, 업체명과 대표사 주소의 길이를 확인해 주세요.');
  const { size, lineHeight } = layout;
  layout.paragraph.forEach((line, index) => draw(line, left, layout.paragraphY - index * lineHeight, size));
  center(dateLabel(model.writtenDate), layout.dateY, size);
  draw('제 출 자 (공동수급체 대표자)', left + 30, layout.signatureY, size);
  let signatureY = layout.signatureY;
  for (const [label, lines] of [['주  소 :', layout.address], ['회사명 :', layout.company], ['대표자 :', layout.representative]]) {
    draw(label, left + 213, signatureY, size);
    if (label === '대표자 :') draw('(인)', left + width - 32, signatureY, size);
    for (const line of lines) { draw(line, left + 263, signatureY, size); signatureY -= lineHeight; }
  }
  draw(model.attachmentText, left, layout.attachmentY, size);
  center(model.recipient, layout.recipientY, documentFontSize(13), bold);
  let footnoteY = 112;
  for (const note of model.footnotes) {
    const noteSize = documentFontSize(10.2);
    const prefix = String(note).match(/^주\d+\.\s*/)?.[0] || '';
    const indent = regular.widthOfTextAtSize(prefix, noteSize);
    const lines = wrapText(String(note).slice(prefix.length), regular, noteSize, width - indent);
    draw(prefix, left, footnoteY, noteSize);
    for (const line of lines) { draw(line, left + indent, footnoteY, noteSize); footnoteY -= 17; }
    footnoteY -= 3;
  }
  pdf.setTitle(`적격심사 신청서 - ${model.noticeTitle || model.noticeNo}`);
  pdf.setAuthor('협정보조');
  pdf.setCreator('협정보조 웹 서류생성');
  return pdf.save();
}

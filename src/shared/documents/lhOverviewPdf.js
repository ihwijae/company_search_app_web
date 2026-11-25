import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { appendLhCompanyProfilePage } from './lhCompanyProfilePdf.js';
import { appendLhExperiencePage } from './lhExperiencePdf.js';
import { appendLhManagementPages } from './lhManagementPdf.js';
import { appendLhCredibilityPages } from './lhCredibilityPdf.js';
import { appendLhFixedSectionsPage } from './lhFixedSectionsPdf.js';
import { appendLhBidPricePage } from './lhBidPricePdf.js';

const BLACK = rgb(0, 0, 0);
const GRAY = rgb(.94, .94, .94);
const scoreText = (score) => score == null ? '—' : `${Number(score.toFixed(2))}점`;

function linesFor(text, font, size, width) {
  const lines = [];
  for (const paragraph of String(text).split('\n')) {
    let line = '';
    for (const character of paragraph) {
      if (line && font.widthOfTextAtSize(line + character, size) > width) { lines.push(line.trimEnd()); line = character.trimStart(); }
      else line += character;
    }
    lines.push(line);
  }
  return lines;
}

export async function createLhOverviewPdf(model, { regularFontBytes, boldFontBytes, allowIncomplete = false } = {}) {
  if (!model || (!model.complete && !allowIncomplete)) throw new Error('총괄표에 미산정 항목이 남아 있습니다. 작성 중 PDF로 확인해 주세요.');
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(regularFontBytes, { subset: true });
  const bold = await pdf.embedFont(boldFontBytes || regularFontBytes, { subset: true });
  const page = pdf.addPage([595.28, 841.89]);
  const left = 57;
  const width = 481;
  const text = (value, x, y, size = 11, selectedFont = font) => page.drawText(value, { x, y, size, font: selectedFont, color: BLACK });
  const cell = (value, x, top, cellWidth, height, { size = 10, selectedFont = font, fill = null } = {}) => {
    page.drawRectangle({ x, y: top - height, width: cellWidth, height, borderColor: BLACK, borderWidth: .6, ...(fill ? { color: fill } : {}) });
    const lines = linesFor(value, selectedFont, size, cellWidth - 9);
    if (lines.length * size * 1.45 > height - 6) throw new Error('총괄표의 공고명이나 항목 내용이 셀 높이를 초과합니다. 입력 내용을 확인해 주세요.');
    const startY = top - (height - lines.length * size * 1.45) / 2 - size;
    lines.forEach((line, index) => text(line, x + (cellWidth - selectedFont.widthOfTextAtSize(line, size)) / 2, startY - index * size * 1.45, size, selectedFont));
  };
  text(model.formLabel, left, 772, 10.5);
  text(model.rangeNote, left, 752, 10.5);
  text(model.title, (595.28 - bold.widthOfTextAtSize(model.title, 15)) / 2, 715, 15, bold);
  text('1. 총   괄', left, 676, 13, bold);
  text('가. 대상공사', left + 7, 641, 11.5);
  let top = 626;
  const bidLabel = model.bidDeadline ? String(model.bidDeadline).replace('T', ' ').replace(/-/g, '/').slice(0, 16) : '(미입력)';
  for (const [label, value] of [['공   고   번   호', model.noticeNo || '(미입력)'], ['입   찰   일   시', bidLabel], ['공   사   명', model.noticeTitle || '(미입력)']]) {
    const height = Math.max(26, linesFor(value, font, 10.5, width - 195 - 10).length * 16 + 10);
    cell(label, left, top, 195, height, { size: 10.5 });
    cell(value, left + 195, top, width - 195, height, { size: 10.5 });
    top -= height;
  }
  text('나. 종합평가', left + 7, top - 32, 11.5);
  top -= 45;
  const widths = [66, 46, 46, 49, 49, 43, 60, 72, 50];
  const xs = widths.reduce((list, size) => [...list, list[list.length - 1] + size], [left]);
  const headerTop = 31;
  const headerBottom = 48;
  cell('구  분', xs[0], top, widths[0], headerTop + headerBottom);
  cell('종합평점', xs[1], top, widths[1], headerTop + headerBottom, { size: 9 });
  cell('당 해 공 사 수 행 능 력', xs[2], top, widths.slice(2, 8).reduce((sum, size) => sum + size, 0), headerTop);
  cell('입찰가격', xs[8], top, widths[8], headerTop + headerBottom, { size: 9 });
  const headers = ['소 계', '시공경험', '경영상태', '신인도', '하도급\n관리계획의\n적정성', '자재 및\n인력조달\n가격의 적정성'];
  headers.forEach((label, index) => cell(label, xs[index + 2], top - headerTop, widths[index + 2], headerBottom, { size: 9 }));
  top -= headerTop + headerBottom;
  widths.forEach((size, index) => cell(index === 0 ? '★심사평점' : '점', xs[index], top, size, 28, { size: 9.5, fill: GRAY }));
  top -= 28;
  const keys = ['total', 'subtotal', 'construction', 'management', 'credibility', 'subcontract', 'material', 'bid'];
  cell('자기평가\n평    점', left, top, widths[0], 34, { size: 9.5 });
  keys.forEach((key, index) => cell(scoreText(model.scores[key]), xs[index + 1], top, widths[index + 1], 34, { size: 10 }));
  const noteY = top - 54;
  if (noteY < 120) throw new Error('총괄표가 한 페이지를 초과합니다. 공고명 길이를 확인해 주세요.');
  text('※ ★는 작성생략, 심사기관에서 작성', left, noteY, 10.5);
  if (!model.complete) text('※ —는 미산정 항목입니다. 본 총괄표는 작성 중입니다.', left, noteY - 24, 10);
  if (model.companyProfiles?.length) appendLhCompanyProfilePage(pdf, model.companyProfiles, { font, bold, color: BLACK });
  if (model.experiencePage) appendLhExperiencePage(pdf, model.experiencePage, { font, bold, color: BLACK });
  if (model.managementPage) appendLhManagementPages(pdf, model.managementPage, { font, bold, color: BLACK });
  if (model.credibilityPage) appendLhCredibilityPages(pdf, model.credibilityPage, { font, bold, color: BLACK });
  appendLhFixedSectionsPage(pdf, model, { font, bold, color: BLACK });
  if (model.bidPricePage) appendLhBidPricePage(pdf, model.bidPricePage, { font, bold, color: BLACK });
  pdf.setTitle(`적격심사 자기평가 및 심사표 - ${model.noticeTitle || model.noticeNo}`);
  return pdf.save();
}

export async function createLhSubmissionPdf(applicationBytes, overviewModel, options) {
  const overviewBytes = await createLhOverviewPdf(overviewModel, options);
  const pdf = await PDFDocument.create();
  for (const bytes of [applicationBytes, overviewBytes]) {
    const source = await PDFDocument.load(bytes);
    for (const page of await pdf.copyPages(source, source.getPageIndices())) pdf.addPage(page);
  }
  pdf.setTitle(`적격심사 신청서 및 총괄 - ${overviewModel.noticeTitle || overviewModel.noticeNo}`);
  pdf.setAuthor('협정보조');
  return pdf.save();
}

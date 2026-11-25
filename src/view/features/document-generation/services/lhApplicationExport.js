import { normalizeDocumentFont } from '../../../../shared/documents/documentTypography.js';

const fontUrls = {
  pretendard: [new URL('../../../../assets/fonts/Pretendard-Regular.ttf', import.meta.url), new URL('../../../../assets/fonts/Pretendard-Bold.ttf', import.meta.url)],
  'nanum-gothic': [new URL('../../../../assets/fonts/NanumGothic-Regular.ttf', import.meta.url), new URL('../../../../assets/fonts/NanumGothic-Bold.ttf', import.meta.url)],
  'nanum-myeongjo': [new URL('../../../../assets/fonts/NanumMyeongjo-Regular.ttf', import.meta.url), new URL('../../../../assets/fonts/NanumMyeongjo-Bold.ttf', import.meta.url)],
};
const fontPromises = new Map();

async function loadFonts(fontFamily) {
  const key = normalizeDocumentFont(fontFamily);
  if (!fontPromises.has(key)) fontPromises.set(key, Promise.all(fontUrls[key].map(async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('서류 글꼴을 불러오지 못했습니다. 다시 시도해 주세요.');
    return response.arrayBuffer();
  })).catch((error) => { fontPromises.delete(key); throw error; }));
  const [regularFontBytes, boldFontBytes] = await fontPromises.get(key);
  // Nanum fonts need full embedding to retain composite glyphs in PDF viewers.
  return { regularFontBytes, boldFontBytes, subsetFonts: key === 'pretendard' };
}

export async function createApplicationPdfBytes(model, { allowIncomplete = false, fontFamily } = {}) {
  const fonts = await loadFonts(fontFamily);
  const { createLhApplicationPdf } = await import('../../../../shared/documents/lhApplicationPdf.js');
  return createLhApplicationPdf(model, { ...fonts, allowIncomplete });
}

export async function createSubmissionPdfBytes(applicationBytes, overviewModel, { fontFamily } = {}) {
  const fonts = await loadFonts(fontFamily);
  const { createLhSubmissionPdf } = await import('../../../../shared/documents/lhOverviewPdf.js');
  return createLhSubmissionPdf(applicationBytes, overviewModel, { ...fonts, allowIncomplete: true });
}

export function downloadApplicationPdf(bytes, model, { includeOverview = false, draft = false } = {}) {
  const suffix = includeOverview ? `신청서_자기평가표${draft ? '_작성중' : ''}` : '적격심사신청서';
  const filename = `${String(model.noticeNo || model.noticeTitle || 'LH').replace(/[\\/:*?"<>|]/g, '-').slice(0, 150)}_${suffix}.pdf`;
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

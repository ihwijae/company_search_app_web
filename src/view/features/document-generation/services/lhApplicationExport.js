let fontsPromise;

async function loadFonts() {
  if (!fontsPromise) fontsPromise = Promise.all([
    fetch(new URL('../../../../assets/fonts/Pretendard-Regular.ttf', import.meta.url)).then((response) => {
      if (!response.ok) throw new Error('신청서 한글 글꼴을 불러오지 못했습니다.');
      return response.arrayBuffer();
    }),
    fetch(new URL('../../../../assets/fonts/Pretendard-Bold.ttf', import.meta.url)).then((response) => {
      if (!response.ok) throw new Error('신청서 제목 글꼴을 불러오지 못했습니다.');
      return response.arrayBuffer();
    }),
  ]).catch((error) => { fontsPromise = null; throw error; });
  const [regularFontBytes, boldFontBytes] = await fontsPromise;
  return { regularFontBytes, boldFontBytes };
}

export async function createApplicationPdfBytes(model, { allowIncomplete = false } = {}) {
  const fonts = await loadFonts();
  const { createLhApplicationPdf } = await import('../../../../shared/documents/lhApplicationPdf.js');
  return createLhApplicationPdf(model, { ...fonts, allowIncomplete });
}

export async function createSubmissionPdfBytes(applicationBytes, overviewModel) {
  const fonts = await loadFonts();
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

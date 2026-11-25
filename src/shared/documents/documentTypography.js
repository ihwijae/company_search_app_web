export const DOCUMENT_FONTS = [
  { value: 'pretendard', label: '프리텐다드 (기본)' },
  { value: 'nanum-gothic', label: '나눔고딕' },
  { value: 'nanum-myeongjo', label: '나눔명조' },
];

export const normalizeDocumentFont = (value) => DOCUMENT_FONTS.some((font) => font.value === value) ? value : 'pretendard';

// Use the same sizes for measurement, wrapping and drawing.
export const documentFontSize = (size) => size * 1.05;

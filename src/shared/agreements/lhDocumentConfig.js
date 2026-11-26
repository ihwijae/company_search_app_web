// Range differences for the shared LH submission forms.
const COMMON_COLUMNS = [
  { key: 'subtotal', label: '소 계' },
  { key: 'construction', label: '시공경험' },
  { key: 'management', label: '경영상태' },
  { key: 'credibility', label: '신인도' },
];

export const LH_DOCUMENT_CONFIG = {
  'lh-under50': {
    label: 'LH 50억 미만', tierMinAmount: 0, financialFormScale: 1,
    rangeNote: '<별표 3의 경우>', includeFixedSections: false,
    bidTitle: '5. 입찰가격점수', bidPage: 9,
    subtotalKeys: ['construction', 'management', 'credibility'],
    columns: COMMON_COLUMNS,
    widths: [76, 65, 65, 70, 70, 65, 70],
  },
  'lh-50to100': {
    label: 'LH 50억~100억', tierMinAmount: 5000000000, financialFormScale: 3,
    rangeNote: '<별표 2의 경우>', includeFixedSections: true,
    bidTitle: '7. 입찰가격점수', bidPage: 10,
    subtotalKeys: ['construction', 'management', 'credibility', 'subcontract', 'material'],
    columns: [...COMMON_COLUMNS,
      { key: 'subcontract', label: '하도급\n관리계획의\n적정성' },
      { key: 'material', label: '자재 및\n인력조달\n가격의 적정성' },
    ],
    widths: [66, 46, 46, 49, 49, 43, 60, 72, 50],
  },
};

export const getLhDocumentConfig = (rangeId = 'lh-50to100') => LH_DOCUMENT_CONFIG[rangeId];

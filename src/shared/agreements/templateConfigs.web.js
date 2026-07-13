const buildTemplateUrl = (fileName) => new URL(`../../../템플릿/${fileName}`, import.meta.url).href;

const LH_UNDER_50_KEY = 'lh-under50';
const LH_50_TO_100_KEY = 'lh-50to100';
const LH_100_TO_300_KEY = 'lh-100to300';
const LH_UNDER_50_SHARE_KEY = 'lh-under50-share';
const LH_50_TO_100_SHARE_KEY = 'lh-50to100-share';
const PPS_UNDER_50_KEY = 'pps-under50';
const PPS_50_TO_100_KEY = 'pps-50to100';
const KGAS_UNDER_50_KEY = 'kgas-under50';
const KGAS_50_TO_100_KEY = 'kgas-50to100';
const MOIS_30_TO_50_KEY = 'mois-30to50';
const MOIS_50_TO_100_KEY = 'mois-50to100';
const KRAIL_UNDER_50_KEY = 'krail-under50';
const KRAIL_50_TO_100_KEY = 'krail-50to100';
const EX_UNDER_50_KEY = 'ex-under50';
const EX_50_TO_100_KEY = 'ex-50to100';

export const AGREEMENT_TEMPLATE_CONFIGS_WEB = {
  'mois-under30': {
    label: '행안부 30억 미만',
    templateUrl: buildTemplateUrl('행안부_30억미만_템플릿.xlsx'),
    sheetName: '양식',
    startRow: 5,
    maxRows: 68,
    slotColumns: {
      name: ['C', 'D', 'E', 'F', 'G'],
      share: ['I', 'J', 'K', 'L', 'M'],
      management: ['P', 'Q', 'R', 'S', 'T'],
      performance: ['W', 'X', 'Y', 'Z', 'AA'],
      ability: ['AO', 'AP', 'AQ', 'AR', 'AS'],
    },
    approvalColumn: 'B',
    regionFill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' }, bgColor: { indexed: 64 } },
    summaryColumns: { netCostBonus: 'AG' },
  },
  'mois-30to50': {
    label: '행안부 30억~50억',
    templateUrl: buildTemplateUrl('행안부_30억~50억_템플릿.xlsx'),
    sheetName: '양식',
    startRow: 5,
    maxRows: 68,
    slotColumns: {
      name: ['C', 'D', 'E', 'F', 'G'],
      share: ['I', 'J', 'K', 'L', 'M'],
      management: ['P', 'Q', 'R', 'S', 'T'],
      performance: ['W', 'X', 'Y', 'Z', 'AA'],
      ability: ['AP', 'AQ', 'AR', 'AS', 'AT'],
    },
    approvalColumn: 'B',
    regionFill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' }, bgColor: { indexed: 64 } },
    headerCells: { baseAmount: 'D1', estimatedAmount: 'D2' },
    summaryColumns: { netCostBonus: 'AG' },
  },
  'mois-50to100': {
    label: '행안부 50억~100억',
    templateUrl: buildTemplateUrl('행안부_50억~100억_템플릿.xlsx'),
    sheetName: '양식',
    startRow: 5,
    maxRows: 68,
    slotColumns: {
      name: ['C', 'D', 'E', 'F', 'G'],
      share: ['I', 'J', 'K', 'L', 'M'],
      management: ['P', 'Q', 'R', 'S', 'T'],
      performance: ['W', 'X', 'Y', 'Z', 'AA'],
      ability: ['AO', 'AP', 'AQ', 'AR', 'AS'],
    },
    approvalColumn: 'B',
    regionFill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' }, bgColor: { indexed: 64 } },
    headerCells: {
      estimatedAmount: 'D1',
      baseAmount: 'D2',
      bidAmount: 'F2',
      noticeTitle: 'N1',
      bidDeadline: 'O2',
      dutySummary: 'U2',
      entryAmountNote: 'AA2',
      entryAmount: 'AQ3',
    },
    summaryColumns: { netCostBonus: 'AG' },
  },
  'pps-under50': {
    label: '조달청 50억 미만',
    templateUrl: buildTemplateUrl('조달청50억미만_템플릿.xlsx'),
    sheetName: '양식',
    startRow: 5,
    maxRows: 68,
    slotColumns: {
      name: ['C', 'D', 'E', 'F', 'G'],
      share: ['I', 'J', 'K', 'L', 'M'],
      management: ['P', 'Q', 'R', 'S', 'T'],
      performance: ['W', 'X', 'Y', 'Z', 'AA'],
      ability: ['AO', 'AP', 'AQ', 'AR', 'AS'],
    },
    headerCells: {
      estimatedAmount: 'D1',
      baseAmount: 'D2',
      bidAmount: 'F2',
      noticeTitle: 'M1',
      bidDeadline: 'P2',
      dutySummary: 'AH1',
    },
    approvalColumn: 'B',
    summaryColumns: { credibility: 'AD' },
    regionFill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' }, bgColor: { indexed: 64 } },
  },
  'pps-50to100': {
    label: '조달청 50억~100억',
    templateUrl: buildTemplateUrl('조달청50억~100억.xlsx'),
    sheetName: '템플릿',
    startRow: 5,
    maxRows: 68,
    slotColumns: {
      name: ['C', 'D', 'E', 'F', 'G'],
      share: ['I', 'J', 'K', 'L', 'M'],
      management: ['P', 'Q', 'R', 'S', 'T'],
      performance: ['W', 'X', 'Y', 'Z', 'AA'],
      ability: ['AP', 'AQ', 'AR', 'AS', 'AT'],
    },
    headerCells: {
      estimatedAmount: 'D1',
      baseAmount: 'D2',
      bidAmount: 'F2',
      noticeTitle: 'N1',
      bidDeadline: 'P2',
      dutySummary: 'AI1',
    },
    approvalColumn: 'B',
    summaryColumns: { credibility: 'AE', netCostBonus: 'AF' },
    regionFill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' }, bgColor: { indexed: 64 } },
  },
  'lh-under50': {
    label: 'LH 50억 미만',
    templateUrl: buildTemplateUrl('LH50억미만_템플릿.xlsx'),
    sheetName: '양식',
    startRow: 5,
    maxRows: 68,
    rowStep: 2,
    qualityRowOffset: 1,
    slotColumns: {
      name: ['C', 'D', 'E', 'F', 'G'],
      share: ['I', 'J', 'K', 'L', 'M'],
      management: ['P', 'Q', 'R', 'S', 'T'],
      performance: ['W', 'X', 'Y', 'Z', 'AA'],
      ability: ['AR', 'AS', 'AT', 'AU', 'AV'],
    },
    qualityColumns: ['I', 'J', 'K', 'L', 'M'],
    headerCells: {
      estimatedAmount: 'D1',
      baseAmount: 'D2',
      ratioBaseAmount: 'I1',
      entryAmount: 'AI1',
      noticeTitle: 'K1',
      bidDeadline: 'M2',
      dutySummary: 'Q2',
      netCostPenaltyNotice: 'AF2',
    },
    approvalColumn: 'B',
    summaryColumns: { credibility: 'AF', netCostBonus: 'AG', qualityPoints: 'AD' },
    managementBonusColumn: 'O',
    regionFill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' }, bgColor: { indexed: 64 } },
  },
  'lh-50to100-et': {
    label: 'LH 50억~100억(전기,통신)',
    templateUrl: buildTemplateUrl('LH50억~100억(전기,통신)_템플릿.xlsx'),
    sheetName: '양식',
    startRow: 5,
    maxRows: 68,
    rowStep: 2,
    qualityRowOffset: 1,
    slotColumns: {
      name: ['C', 'D', 'E', 'F', 'G'],
      share: ['I', 'J', 'K', 'L', 'M'],
      management: ['P', 'Q', 'R', 'S', 'T'],
      performance: ['W', 'X', 'Y', 'Z', 'AA'],
      ability: ['AT', 'AU', 'AV', 'AW', 'AX'],
    },
    qualityColumns: ['I', 'J', 'K', 'L', 'M'],
    headerCells: {
      estimatedAmount: 'D1',
      baseAmount: 'D2',
      ratioBaseAmount: 'I1',
      entryAmount: 'AG1',
      noticeTitle: 'K1',
      bidDeadline: 'M2',
      dutySummary: 'Q2',
      netCostPenaltyNotice: 'AD2',
    },
    approvalColumn: 'B',
    summaryColumns: { qualityPoints: 'AD', credibility: 'AF', netCostBonus: 'AG' },
    managementBonusColumn: 'O',
    regionFill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' }, bgColor: { indexed: 64 } },
  },
  'lh-50to100-sobang': {
    label: 'LH 50억~100억(소방)',
    templateUrl: buildTemplateUrl('LH50억~100억(소방)_템플릿.xlsx'),
    sheetName: '양식',
    startRow: 5,
    maxRows: 68,
    rowStep: 2,
    qualityRowOffset: 1,
    slotColumns: {
      name: ['C', 'D', 'E', 'F', 'G'],
      share: ['I', 'J', 'K', 'L', 'M'],
      management: ['P', 'Q', 'R', 'S', 'T'],
      performance: ['W', 'X', 'Y', 'Z', 'AA'],
      ability: ['AT', 'AU', 'AV', 'AW', 'AX'],
    },
    qualityColumns: ['I', 'J', 'K', 'L', 'M'],
    headerCells: {
      estimatedAmount: 'D1',
      baseAmount: 'D2',
      ratioBaseAmount: 'I1',
      entryAmount: 'AG1',
      noticeTitle: 'K1',
      bidDeadline: 'M2',
      dutySummary: 'Q2',
      netCostPenaltyNotice: 'AD2',
    },
    approvalColumn: 'B',
    summaryColumns: { qualityPoints: 'AD', credibility: 'AF', netCostBonus: 'AG' },
    managementBonusColumn: 'O',
    regionFill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' }, bgColor: { indexed: 64 } },
  },
  'lh-100to300': {
    label: 'LH 100억~300억',
    templateUrl: buildTemplateUrl('LH간이종심100-300억_템플릿.xlsx'),
    sheetName: '양식',
    startRow: 5,
    maxRows: 90,
    rowStep: 2,
    qualityRowOffset: 1,
    managementScoreMax: 8,
    qualityHighlightMin: 3.9,
    slotColumns: {
      name: ['C', 'D', 'E', 'F', 'G'],
      share: ['I', 'J', 'K', 'L', 'M'],
      management: ['O', 'P', 'Q', 'R', 'S'],
      performance: ['V', 'W', 'X', 'Y', 'Z'],
    },
    qualityColumns: ['O', 'P', 'Q', 'R', 'S'],
    headerCells: {
      estimatedAmount: 'E1',
      baseAmount: 'E2',
      ratioBaseAmount: 'H1',
      noticeTitle: 'O1',
      bidDeadline: 'P2',
      dutySummary: 'T2',
      memo: 'C1',
    },
    summaryColumns: { credibility: 'AE' },
    regionFill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' }, bgColor: { indexed: 64 } },
  },
  'krail-under50': {
    label: '국가철도공단 50억 미만',
    templateUrl: buildTemplateUrl('국가철도50억미만_템플릿.xlsx'),
    sheetName: '양식',
    startRow: 5,
    maxRows: 68,
    slotColumns: {
      name: ['C', 'D', 'E', 'F', 'G'],
      share: ['I', 'J', 'K', 'L', 'M'],
      management: ['P', 'Q', 'R', 'S', 'T'],
      performance: ['W', 'X', 'Y', 'Z', 'AA'],
      technician: ['AD', 'AE', 'AF', 'AG', 'AH'],
      ability: ['AV', 'AW', 'AX', 'AY', 'AZ'],
    },
    headerCells: {
      baseAmount: 'D2',
      amountForScore: 'I1',
      noticeTitle: 'N1',
      bidDeadline: 'P2',
      dutySummary: 'U2',
      memo: 'AD1',
    },
    approvalColumn: 'B',
    summaryColumns: { credibility: 'AK' },
    credibilityScale: 0.5 / 3,
    credibilityScaleExpr: '0.5/3',
    regionFill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' }, bgColor: { indexed: 64 } },
  },
  'krail-under50-sobang': {
    label: '국가철도공단 50억 미만(소방)',
    templateUrl: buildTemplateUrl('국가철도50억미만(소방)_템플릿.xlsx'),
    sheetName: '양식',
    startRow: 5,
    maxRows: 68,
    slotColumns: {
      name: ['C', 'D', 'E', 'F', 'G'],
      share: ['I', 'J', 'K', 'L', 'M'],
      management: ['P', 'Q', 'R', 'S', 'T'],
      performance: ['W', 'X', 'Y', 'Z', 'AA'],
      technician: ['AD', 'AE', 'AF', 'AG', 'AH'],
      ability: ['AV', 'AW', 'AX', 'AY', 'AZ'],
    },
    headerCells: {
      baseAmount: 'D2',
      amountForScore: 'I1',
      noticeTitle: 'N1',
      bidDeadline: 'P2',
      dutySummary: 'U2',
      memo: 'AD1',
    },
    approvalColumn: 'B',
    summaryColumns: { credibility: 'AK' },
    credibilityScale: 0.5 / 3,
    credibilityScaleExpr: '0.5/3',
    regionFill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' }, bgColor: { indexed: 64 } },
  },
  'krail-50to100-et': {
    label: '국가철도공단 50억~100억(전기,통신)',
    templateUrl: buildTemplateUrl('국가철도50억-100억(전기)_템플릿.xlsx'),
    sheetName: '양식',
    startRow: 5,
    maxRows: 68,
    slotColumns: {
      name: ['C', 'D', 'E', 'F', 'G'],
      share: ['I', 'J', 'K', 'L', 'M'],
      management: ['P', 'Q', 'R', 'S', 'T'],
      performance: ['W', 'X', 'Y', 'Z', 'AA'],
      technician: ['AD', 'AE', 'AF', 'AG', 'AH'],
      ability: ['AW', 'AX', 'AY', 'AZ', 'BA'],
    },
    headerCells: {
      baseAmount: 'D2',
      estimatedAmount: 'I1',
      noticeTitle: 'L1',
      bidDeadline: 'P2',
      dutySummary: 'U2',
      memo: 'AD1',
    },
    approvalColumn: 'B',
    summaryColumns: { subcontract: 'AK', credibility: 'AL' },
    credibilityScale: 0.9 / 3,
    credibilityScaleExpr: '0.9/3',
    regionFill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' }, bgColor: { indexed: 64 } },
  },
  'krail-50to100-sobang': {
    label: '국가철도공단 50억~100억(소방)',
    templateUrl: buildTemplateUrl('국가철도50억-100억(소방)_템플릿.xlsx'),
    sheetName: '양식',
    startRow: 5,
    maxRows: 68,
    slotColumns: {
      name: ['C', 'D', 'E', 'F', 'G'],
      share: ['I', 'J', 'K', 'L', 'M'],
      management: ['P', 'Q', 'R', 'S', 'T'],
      performance: ['W', 'X', 'Y', 'Z', 'AA'],
      technician: ['AD', 'AE', 'AF', 'AG', 'AH'],
      ability: ['AW', 'AX', 'AY', 'AZ', 'BA'],
    },
    headerCells: {
      baseAmount: 'D2',
      estimatedAmount: 'I1',
      noticeTitle: 'L1',
      bidDeadline: 'P2',
      dutySummary: 'U2',
      memo: 'AD1',
    },
    approvalColumn: 'B',
    summaryColumns: { subcontract: 'AK', credibility: 'AL' },
    credibilityScale: 0.9 / 3,
    credibilityScaleExpr: '0.9/3',
    regionFill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' }, bgColor: { indexed: 64 } },
  },
  'ex-under50': {
    label: '한국도로공사 50억 미만',
    templateUrl: buildTemplateUrl('한국도로공사50억미만_템플릿.xlsx'),
    sheetName: '양식',
    startRow: 5,
    maxRows: 68,
    slotColumns: {
      name: ['C', 'D', 'E', 'F', 'G'],
      share: ['I', 'J', 'K', 'L', 'M'],
      management: ['P', 'Q', 'R', 'S', 'T'],
      performance: ['W', 'X', 'Y', 'Z', 'AA'],
      ability: ['AO', 'AP', 'AQ', 'AR', 'AS'],
    },
    headerCells: {
      estimatedAmount: 'D1',
      baseAmount: 'D2',
      noticeTitle: 'M1',
      bidDeadline: 'P2',
      dutySummary: 'AH1',
      memo: 'W2',
    },
    approvalColumn: 'B',
    summaryColumns: { credibility: 'AD' },
    regionFill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' }, bgColor: { indexed: 64 } },
  },
  'ex-50to100': {
    label: '한국도로공사 50억~100억',
    templateUrl: buildTemplateUrl('한국도로공사50-100억_템플릿.xlsx'),
    sheetName: '양식',
    startRow: 5,
    maxRows: 68,
    slotColumns: {
      name: ['C', 'D', 'E', 'F', 'G'],
      share: ['I', 'J', 'K', 'L', 'M'],
      management: ['O', 'P', 'Q', 'R', 'S'],
      performance: ['V', 'W', 'X', 'Y', 'Z'],
      ability: ['AO', 'AP', 'AQ', 'AR', 'AS'],
    },
    headerCells: {
      estimatedAmount: 'D1',
      baseAmount: 'D2',
      noticeTitle: 'M1',
      bidDeadline: 'P2',
      dutySummary: 'AH1',
      memo: 'W2',
    },
    approvalColumn: 'B',
    summaryColumns: { credibility: 'AD', netCostBonus: 'AE' },
    regionFill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' }, bgColor: { indexed: 64 } },
  },
};

AGREEMENT_TEMPLATE_CONFIGS_WEB['kgas-under50'] = {
  ...AGREEMENT_TEMPLATE_CONFIGS_WEB['pps-under50'],
  label: '한국가스공사 50억 미만',
};

export const resolveWebAgreementTemplateConfig = (templateKey) => {
  if (!templateKey) return null;
  return AGREEMENT_TEMPLATE_CONFIGS_WEB[templateKey] || null;
};

export const resolveWebAgreementTemplateKey = (ownerId, rangeId, fileType) => {
  const ownerKey = String(ownerId || '').toUpperCase();
  const rawRangeKey = String(rangeId || '').toLowerCase();
  const rangeKey = ownerKey === 'LH'
    ? (rawRangeKey === LH_UNDER_50_SHARE_KEY
      ? LH_UNDER_50_KEY
      : (rawRangeKey === LH_50_TO_100_SHARE_KEY ? LH_50_TO_100_KEY : rawRangeKey))
    : rawRangeKey;
  const normalizedType = String(fileType || '').toLowerCase();
  if (ownerKey === 'MOIS' && rangeKey === 'mois-under30') return 'mois-under30';
  if (ownerKey === 'MOIS' && rangeKey === MOIS_30_TO_50_KEY) return 'mois-30to50';
  if (ownerKey === 'MOIS' && rangeKey === MOIS_50_TO_100_KEY) return 'mois-50to100';
  if (ownerKey === 'PPS' && rangeKey === PPS_UNDER_50_KEY) return 'pps-under50';
  if (ownerKey === 'PPS' && rangeKey === PPS_50_TO_100_KEY) return 'pps-50to100';
  if (ownerKey === 'KGAS' && rangeKey === KGAS_UNDER_50_KEY) return 'kgas-under50';
  if (ownerKey === 'LH' && rangeKey === LH_UNDER_50_KEY) return 'lh-under50';
  if (ownerKey === 'LH' && rangeKey === LH_100_TO_300_KEY) return 'lh-100to300';
  if (ownerKey === 'LH' && rangeKey === LH_50_TO_100_KEY) {
    if (normalizedType === 'sobang') return 'lh-50to100-sobang';
    return 'lh-50to100-et';
  }
  if (ownerKey === 'KRAIL' && rangeKey === KRAIL_UNDER_50_KEY) {
    if (normalizedType === 'sobang') return 'krail-under50-sobang';
    if (normalizedType === 'eung' || normalizedType === 'tongsin') return 'krail-under50';
    return null;
  }
  if (ownerKey === 'KRAIL' && rangeKey === KRAIL_50_TO_100_KEY) {
    if (normalizedType === 'sobang') return 'krail-50to100-sobang';
    if (normalizedType === 'eung' || normalizedType === 'tongsin') return 'krail-50to100-et';
    return null;
  }
  if (ownerKey === 'EX' && rangeKey === EX_UNDER_50_KEY) return 'ex-under50';
  if (ownerKey === 'EX' && rangeKey === EX_50_TO_100_KEY) return 'ex-50to100';
  return null;
};

export const isWebAgreementRangeImplemented = (ownerId, rangeId, fileType) => (
  resolveWebAgreementTemplateConfig(resolveWebAgreementTemplateKey(ownerId, rangeId, fileType)) != null
);

export const isWebAgreementRangeCalculationImplemented = (ownerId, rangeId, fileType) => {
  const ownerKey = String(ownerId || '').toUpperCase();
  const rangeKey = String(rangeId || '').toLowerCase();
  if (ownerKey === 'PPS' && rangeKey === PPS_50_TO_100_KEY) return true;
  if (ownerKey === 'KGAS' && rangeKey === KGAS_50_TO_100_KEY) return true;
  return isWebAgreementRangeImplemented(ownerId, rangeId, fileType);
};

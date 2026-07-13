const LH_AWARD_HISTORY_RAW_TEXT = `< LH 낙찰이력 보유 현황 > - ①

㈜지음이엔아이
- 계약일 : 2025.03.20 (9,428,462,975원) - 충북혁신 전기공사 1공구
- 계약일 : 2025.09.03 (3,979,189,607원) - 고양장항 소방시설공사 6공구

㈜아람이엔테크
- 계약일 : 2025.10.16 (2,256,233,999원) - 대전대동2 소방시설공사

㈜대흥디씨티
- 계약일 : 2025.10.16 (7,187,735,979원) - 군포대야미 전기공사 1공구

㈜성전사
- 계약일 : 2025.03.06 (4,892,709,215원) - 구리갈매역세권 전기공사 2공구

㈜대상전력
- 계약일 : 2025.03.06 (3,914,167,372원) - 구리갈매역세권 전기공사 2공구

일렉파워㈜
- 계약일 : 2025.03.13 (9,751,734,115) - 청주지북 전기공사

㈜송원이앤씨
- 계약일 : 2025.03.13 (1,950,346,823) - 청주지북 전기공사

㈜부현전기
- 계약일 : 2025.10.16 (14,375,471,958원) - 군포대야미 전기공사 1공구
- 계약일 : 2025.06.25 (5,436,090,832원) - 남양주왕숙 전기공사 4공구

신신이앤씨㈜
- 계약일 : 2025.04.03 (5,135,947,500원) - 원주무실 전기공사 2공구

㈜도화엔지니어링
- 계약일 : 2025.03.20 (1,885,692,595원) - 충북혁신 전기공사 1공구

㈜온세이엔씨
- 계약일 : 2025.03.12(6,576,671,731원) - 의정부우정 전기공사 1공구

㈜보원엔지니어링
- 계약일 : 2025.03.12(2,818,573,599원) - 의정부우정 전기공사 1공구

(유)우전
- 계약일 : 2026.01.14(4,596,128,195원) - 인천계양 전기공사 4공구

대명에너지㈜
- 계약일 : 2026.01.14(919,225,639원) - 인천계양 전기공사 4공구

에스지씨이앤씨㈜
- 계약일 : 2025.12.22 - 시흥거모 A-7BL 아파트 건설공사 5공구

일성건설㈜
- 계약일 : 2025.12.22 - 경산대임 A-3BL 아파트 건설공사 3공구

㈜대광건영
- 계약일 : 2025.12.16 - 수원당수 B-3BL 아파트 건설공사 7공구

㈜녹십자이엠
- 계약일 : 2025.11.12`;

export const sanitizeLhAwardCompanyName = (value) => {
  if (!value) return '';
  let result = String(value).trim();
  result = result.replace(/㈜/g, '');
  result = result.replace(/\(주\)/g, '');
  result = result.replace(/\(유\)/g, '');
  result = result.replace(/\(합\)/g, '');
  result = result.replace(/주식회사/g, '');
  result = result.replace(/\s+/g, ' ').trim();
  return result;
};

export const normalizeLhAwardCompanyKey = (value) => sanitizeLhAwardCompanyName(value).toLowerCase();

export const normalizeLhAwardBizNo = (value) => String(value || '').replace(/\D/g, '');

export const parseLhAwardDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

export const formatLhAwardDateInput = (value) => {
  const date = parseLhAwardDate(value);
  if (!date) return '';
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const withinPreviousYear = (contractDate, noticeDate) => {
  if (!(contractDate instanceof Date) || Number.isNaN(contractDate.getTime())) return false;
  if (!(noticeDate instanceof Date) || Number.isNaN(noticeDate.getTime())) return false;
  if (contractDate.getTime() > noticeDate.getTime()) return false;
  const oneYearAgo = new Date(noticeDate.getFullYear() - 1, noticeDate.getMonth(), noticeDate.getDate());
  return contractDate.getTime() >= oneYearAgo.getTime();
};

const parseRawHistoryEntries = (rawText) => {
  const entries = [];
  let companyName = '';
  String(rawText || '').split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('<')) return;
    if (!trimmed.startsWith('-')) {
      companyName = trimmed;
      return;
    }
    const match = trimmed.match(/계약일\s*:\s*(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})\s*(?:\(([^)]*)\))?\s*(?:-\s*(.*))?$/);
    if (!match || !companyName) return;
    const contractDate = formatLhAwardDateInput(match[1]);
    const contractAmount = match[2] ? Number(String(match[2]).replace(/\D/g, '')) : null;
    const projectName = String(match[3] || '').trim();
    entries.push({
      id: `legacy-${entries.length + 1}`,
      companyName,
      bizNo: '',
      fileType: 'eung',
      contractDate,
      contractAmount: Number.isFinite(contractAmount) && contractAmount > 0 ? contractAmount : null,
      projectName,
      matchMode: 'name',
      source: 'legacy',
    });
  });
  return entries;
};

export const DEFAULT_LH_AWARD_HISTORY_ENTRIES = parseRawHistoryEntries(LH_AWARD_HISTORY_RAW_TEXT);

const LH_AWARD_HISTORY_TEXT_HEADER = '< LH 낙찰이력 보유 현황 > - ①';

export const LH_AWARD_OWNER_OPTIONS = [
  { id: 'LH', label: 'LH' },
  { id: 'EX', label: '한국도로공사' },
  { id: 'KRAIL', label: '국가철도공단' },
  { id: 'MOIS', label: '행안부' },
  { id: 'PPS', label: '조달청' },
];

const LH_AWARD_OWNER_LABEL_BY_ID = LH_AWARD_OWNER_OPTIONS.reduce((acc, option) => {
  acc[option.id] = option.label;
  return acc;
}, {});

const LH_AWARD_OWNER_ID_BY_LABEL = LH_AWARD_OWNER_OPTIONS.reduce((acc, option) => {
  acc[option.label] = option.id;
  return acc;
}, {});

export const resolveLhAwardOwnerId = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return 'LH';
  const upper = raw.toUpperCase();
  if (LH_AWARD_OWNER_LABEL_BY_ID[upper]) return upper;
  return LH_AWARD_OWNER_ID_BY_LABEL[raw] || 'LH';
};

export const getLhAwardOwnerLabel = (value) => (
  LH_AWARD_OWNER_LABEL_BY_ID[resolveLhAwardOwnerId(value)] || 'LH'
);

const formatLhAwardDateDisplay = (value) => {
  const date = parseLhAwardDate(value);
  if (!date) return String(value || '').trim();
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
};

export function getLhAwardHistoryText(entries = DEFAULT_LH_AWARD_HISTORY_ENTRIES, options = {}) {
  const ownerFilter = options?.ownerId ? resolveLhAwardOwnerId(options.ownerId) : '';
  const normalizedEntries = normalizeLhAwardHistoryEntries(entries);
  const filteredEntries = ownerFilter
    ? normalizedEntries.filter((entry) => resolveLhAwardOwnerId(entry.ownerId) === ownerFilter)
    : normalizedEntries;
  if (!filteredEntries.length) return LH_AWARD_HISTORY_TEXT_HEADER;

  const groupedEntries = [];
  const groupIndexByCompany = new Map();
  filteredEntries.forEach((entry) => {
    const companyKey = `${entry.companyName}__${entry.bizNo || ''}`;
    const groupIndex = groupIndexByCompany.get(companyKey);
    if (groupIndex !== undefined) {
      groupedEntries[groupIndex].entries.push(entry);
      return;
    }
    groupIndexByCompany.set(companyKey, groupedEntries.length);
    groupedEntries.push({
      companyName: entry.companyName,
      entries: [entry],
    });
  });

  const blocks = groupedEntries.map((group) => {
    const lines = group.entries.map((entry) => {
      const owner = getLhAwardOwnerLabel(entry.ownerId);
      const amount = entry.contractAmount != null ? ` (${Number(entry.contractAmount).toLocaleString('ko-KR')}원)` : '';
      const project = entry.projectName ? ` - ${entry.projectName}` : '';
      return `- [${owner}] 계약일 : ${formatLhAwardDateDisplay(entry.contractDate)}${amount}${project}`;
    });
    return `${group.companyName}\n${lines.join('\n')}`;
  });

  return [LH_AWARD_HISTORY_TEXT_HEADER, '', blocks.join('\n\n')].join('\n');
}

export function normalizeLhAwardHistoryEntries(entries = []) {
  const source = Array.isArray(entries) ? entries : [];
  return source.map((entry, index) => {
    const companyName = String(entry?.companyName || '').trim();
    const contractDate = formatLhAwardDateInput(entry?.contractDate);
    const bizNo = String(entry?.bizNo || '').trim();
    const contractAmount = entry?.contractAmount === null || entry?.contractAmount === undefined || entry?.contractAmount === ''
      ? null
      : Number(entry.contractAmount);
    return {
      id: String(entry?.id || `award-${Date.now()}-${index}`),
      companyName,
      bizNo,
      ownerId: resolveLhAwardOwnerId(entry?.ownerId || entry?.owner || entry?.agency || entry?.agencyId),
      fileType: String(entry?.fileType || 'eung').trim() || 'eung',
      contractDate,
      contractAmount: Number.isFinite(contractAmount) ? contractAmount : null,
      projectName: String(entry?.projectName || '').trim(),
      matchMode: bizNo ? 'bizNo' : 'name',
      source: entry?.source || '',
    };
  }).filter((entry) => entry.companyName && entry.contractDate);
}

export function hasRecentLhAwardHistory(companyOrName, noticeDate, entries = DEFAULT_LH_AWARD_HISTORY_ENTRIES) {
  const notice = parseLhAwardDate(noticeDate);
  if (!notice) return false;
  const candidate = companyOrName && typeof companyOrName === 'object' ? companyOrName : null;
  const candidateName = candidate
    ? (candidate['검색된 회사'] || candidate['업체명'] || candidate.name || candidate.companyName || '')
    : companyOrName;
  const candidateBizNo = normalizeLhAwardBizNo(
    candidate ? (candidate['사업자번호'] || candidate.bizNo || candidate.businessNumber || '') : '',
  );
  const companyKey = normalizeLhAwardCompanyKey(candidateName);
  if (!candidateBizNo && !companyKey) return false;

  return normalizeLhAwardHistoryEntries(entries).some((entry) => {
    if (resolveLhAwardOwnerId(entry.ownerId) !== 'LH') return false;
    const contractDate = parseLhAwardDate(entry.contractDate);
    if (!withinPreviousYear(contractDate, notice)) return false;
    const entryBizNo = normalizeLhAwardBizNo(entry.bizNo);
    if (entryBizNo && candidateBizNo) return entryBizNo === candidateBizNo;
    return companyKey && normalizeLhAwardCompanyKey(entry.companyName) === companyKey;
  });
}

const addOneYear = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear() + 1, date.getMonth(), date.getDate());
};

const formatLhAwardShortDate = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
};

export function getLhAwardHistoryMatchInfo(companyOrName, entries = DEFAULT_LH_AWARD_HISTORY_ENTRIES) {
  const candidate = companyOrName && typeof companyOrName === 'object' ? companyOrName : null;
  const candidateName = candidate
    ? (candidate['검색된 회사'] || candidate['업체명'] || candidate.name || candidate.companyName || '')
    : companyOrName;
  const candidateBizNo = normalizeLhAwardBizNo(
    candidate ? (candidate['사업자번호'] || candidate.bizNo || candidate.businessNumber || '') : '',
  );
  const companyKey = normalizeLhAwardCompanyKey(candidateName);
  if (!candidateBizNo && !companyKey) return null;

  const matches = normalizeLhAwardHistoryEntries(entries)
    .map((entry) => {
      const contractDate = parseLhAwardDate(entry.contractDate);
      if (!contractDate) return null;
      const entryBizNo = normalizeLhAwardBizNo(entry.bizNo);
      const matched = entryBizNo && candidateBizNo
        ? entryBizNo === candidateBizNo
        : (companyKey && normalizeLhAwardCompanyKey(entry.companyName) === companyKey);
      if (!matched) return null;
      const expiryDate = addOneYear(contractDate);
      return {
        entry,
        ownerId: resolveLhAwardOwnerId(entry.ownerId),
        ownerLabel: getLhAwardOwnerLabel(entry.ownerId),
        contractDate,
        expiryDate,
        contractDateText: formatLhAwardShortDate(contractDate),
        expiryDateText: formatLhAwardShortDate(expiryDate),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.contractDate.getTime() - a.contractDate.getTime());

  const latest = matches[0] || null;
  if (!latest) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return {
    ...latest,
    expired: latest.expiryDate ? latest.expiryDate.getTime() < today.getTime() : false,
    rangeText: `${latest.contractDateText} ~ ${latest.expiryDateText}`,
    badgeText: `${latest.contractDateText} ~ ${latest.expiryDateText} ${latest.ownerLabel}`,
  };
}

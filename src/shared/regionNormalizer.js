const REGION_ALIAS_RULES = [
  { key: '서울', aliases: ['서울특별시', '서울'] },
  { key: '부산', aliases: ['부산광역시', '부산'] },
  { key: '대구', aliases: ['대구광역시', '대구'] },
  { key: '인천', aliases: ['인천광역시', '인천'] },
  { key: '광주', aliases: ['광주광역시', '광주'] },
  { key: '대전', aliases: ['대전광역시', '대전'] },
  { key: '울산', aliases: ['울산광역시', '울산'] },
  { key: '세종', aliases: ['세종특별자치시', '세종'] },
  { key: '경기', aliases: ['경기도', '경기'] },
  { key: '강원', aliases: ['강원특별자치도', '강원도', '강원'] },
  { key: '충북', aliases: ['충청북도', '충북'] },
  { key: '충남', aliases: ['충청남도', '충남'] },
  { key: '전북', aliases: ['전북특별자치도', '전라북도', '전북'] },
  { key: '전남', aliases: ['전라남도', '전남'] },
  { key: '경북', aliases: ['경상북도', '경북'] },
  { key: '경남', aliases: ['경상남도', '경남'] },
  { key: '제주', aliases: ['제주특별자치도', '제주도', '제주'] },
];

export const normalizeRegionName = (value) => {
  const raw = String(value || '').replace(/\s+/g, '').trim();
  if (!raw || raw === '전체') return '';
  for (const rule of REGION_ALIAS_RULES) {
    if (rule.aliases.some((alias) => raw.includes(alias))) {
      return rule.key;
    }
  }
  return raw;
};

export const normalizeRegionList = (values) => {
  const set = new Set();
  (Array.isArray(values) ? values : []).forEach((value) => {
    const normalized = normalizeRegionName(value);
    if (normalized) set.add(normalized);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko-KR'));
};

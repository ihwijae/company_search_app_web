import React from 'react';
import '../../../../styles.css';
import '../../../../fonts.css';
import Sidebar from '../../../../components/Sidebar.jsx';
import { useFeedback } from '../../../../components/FeedbackProvider.jsx';
import searchClient from '../../../../shared/searchClient.js';
import CREDIT_GRADE_ORDER from '../../../../shared/creditGrades.json';
import { loadPersisted, savePersisted } from '../../../../shared/persistence.js';
import { INDUSTRY_AVERAGES, DEBT_RATIO_WARN_FACTOR, CURRENT_RATIO_WARN_FACTOR } from '../../../../ratios.js';
import lhAwardHistoryClient from '../../../../shared/lhAwardHistoryClient.js';
import {
  DEFAULT_LH_AWARD_HISTORY_ENTRIES,
  getLhAwardHistoryMatchInfo,
  normalizeLhAwardHistoryEntries,
} from '../../../../shared/agreements/lhAwardHistory.js';

const FILE_TYPE_OPTIONS = [
  { key: 'eung', label: '전기' },
  { key: 'tongsin', label: '통신' },
  { key: 'sobang', label: '소방' },
  { key: 'all', label: '전체' },
];

const COMPANIES_PER_GRID_BLOCK = 12;
const COMPANY_GRID_STORAGE_KEY = 'company-grid-state';
const COMPANY_GRID_RENDER_BATCH_SIZE = 240;

const CREDIT_GRADE_OPTIONS = Array.isArray(CREDIT_GRADE_ORDER)
  ? CREDIT_GRADE_ORDER.map((grade) => String(grade || '').trim()).filter(Boolean)
  : [];

const GRID_ROWS = [
  { key: '검색된 회사', label: '회사명', kind: 'text' },
  { key: '대표자', label: '대표자', kind: 'text' },
  { key: '사업자번호', label: '사업자번호', kind: 'text' },
  { key: '대표지역', label: '지역', kind: 'region' },
  { key: '시평', label: '시공능력', kind: 'number' },
  { key: '3년 실적', label: '3년간 실적액', kind: 'number' },
  { key: '5년 실적', label: '5년간 실적액', kind: 'number' },
  { key: '부채비율', label: '부채비율', kind: 'percent' },
  { key: '유동비율', label: '유동비율', kind: 'percent' },
  { key: '영업기간', label: '영업기간', kind: 'text' },
  { key: '신용평가', label: '신용등급', kind: 'multiline' },
  { key: '여성기업', label: '여성기업', kind: 'text' },
  { key: '중소기업', label: '중소기업', kind: 'text' },
  { key: '일자리창출', label: '일자리창출평가', kind: 'text' },
  { key: '품질평가', label: '시공품질평가', kind: 'text' },
  { key: '비고', label: '비고', kind: 'multiline' },
];

const COPY_ORDER = [
  '검색된 회사',
  '대표자',
  '사업자번호',
  '지역',
  '시평',
  '3년 실적',
  '5년 실적',
  '부채비율',
  '유동비율',
  '영업기간',
  '신용평가',
  '여성기업',
  '중소기업',
  '일자리창출',
  '품질평가',
  '비고',
];

const DEFAULT_FILTERS = {
  name: '',
  bizNumber: '',
  manager: '',
  managerExclude: '',
  min_sipyung: '',
  max_sipyung: '',
  min_3y: '',
  max_3y: '',
  min_5y: '',
  max_5y: '',
  min_credit_grade: '',
};

const restoreFilters = (savedFilters) => {
  if (!savedFilters || typeof savedFilters !== 'object' || Array.isArray(savedFilters)) return DEFAULT_FILTERS;
  const { includeRegions: _includeRegions, excludeRegions: _excludeRegions, ...restFilters } = savedFilters;
  return {
    ...DEFAULT_FILTERS,
    ...restFilters,
  };
};

const sanitizeFilters = (filters) => {
  const { includeRegions: _includeRegions, excludeRegions: _excludeRegions, ...restFilters } = filters || {};
  return {
    ...DEFAULT_FILTERS,
    ...restFilters,
  };
};

const normalizeFileType = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === '전기') return 'eung';
  if (normalized === '통신') return 'tongsin';
  if (normalized === '소방') return 'sobang';
  if (normalized === '전체') return 'all';
  return FILE_TYPE_OPTIONS.some((item) => item.key === normalized) ? normalized : 'eung';
};

const normalizeRegion = (value) => String(value || '').trim();

const normalizeRegionSelection = (values) => {
  const source = Array.isArray(values) ? values : [];
  return Array.from(new Set(
    source.map(normalizeRegion).filter((region) => region && region !== '전체'),
  ));
};

const unformatNumber = (value) => String(value || '').replace(/,/g, '').trim();

const formatNumber = (value) => {
  if (!value && value !== 0) return '';
  const cleaned = String(value).replace(/,/g, '').trim();
  if (!cleaned) return '';
  const number = Number(cleaned);
  return Number.isFinite(number) ? number.toLocaleString() : String(value);
};

const formatPercent = (value) => {
  if (!value && value !== 0) return '';
  const cleaned = String(value).replace(/[%\s,]/g, '');
  const number = Number(cleaned);
  if (!Number.isFinite(number)) return String(value);
  return `${number.toFixed(2)}%`;
};

const parsePercentNumber = (value) => {
  if (value === null || value === undefined) return NaN;
  const number = Number(String(value).replace(/[%\s,]/g, ''));
  return Number.isFinite(number) ? number : NaN;
};

const parseFlexibleDate = (value) => {
  if (!value && value !== 0) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const match = String(value).trim().match(/(\d{4})[.\-/년\s]*(\d{1,2})[.\-/월\s]*(\d{1,2})?/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = match[3] ? Number(match[3]) : 1;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
};

const yearsSince = (date) => {
  if (!(date instanceof Date)) return NaN;
  const now = new Date();
  let years = now.getFullYear() - date.getFullYear();
  const monthDiff = now.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) years -= 1;
  return years;
};

const getCompanyValue = (company, row) => {
  if (!company || !row) return '';
  if (row.kind === 'region') {
    return company['대표지역'] || company['지역'] || '';
  }
  return company[row.key] ?? '';
};

const formatCellValue = (company, row) => {
  const value = getCompanyValue(company, row);
  if (row.kind === 'number') return formatNumber(value);
  if (row.kind === 'percent') return formatPercent(value);
  return String(value ?? '').trim();
};

const formatCopyValue = (company, key) => {
  const percentKeys = ['부채비율', '유동비율'];
  const formattedKeys = ['시평', '3년 실적', '5년 실적'];
  const raw = key === '지역'
    ? (company?.['대표지역'] || company?.['지역'] || '')
    : (company?.[key] ?? '');

  if (percentKeys.includes(key)) return formatPercent(raw);
  if (formattedKeys.includes(key)) return formatNumber(raw);

  let value = String(raw ?? '');
  if (key === '비고') return value.replace(/\r\n|\r/g, '\n');
  return value.replace(/\r\n|\r|\n/g, ' ').replace(/\s+/g, ' ').trim();
};

const buildCopyRows = (company) => (
  COPY_ORDER.map((key) => formatCopyValue(company, key))
);

const getCompanySelectionKey = (company, fallbackIndex = null) => {
  if (!company) return '';
  const bizNo = String(company['사업자번호'] || '').replace(/[^0-9]/g, '');
  if (bizNo) return `biz:${bizNo}`;
  const name = String(company['검색된 회사'] || company['업체명'] || '').trim();
  if (name) return `name:${name}`;
  return fallbackIndex !== null && fallbackIndex !== undefined ? `idx:${fallbackIndex}` : '';
};

const getCompanyFileType = (company, selectedFileType) => {
  if (selectedFileType === 'all') return normalizeFileType(company?._file_type || '');
  return normalizeFileType(selectedFileType);
};

const shouldWarnCell = (company, row, selectedFileType) => {
  const avg = INDUSTRY_AVERAGES[getCompanyFileType(company, selectedFileType)];
  if (!avg) return false;
  const value = getCompanyValue(company, row);
  if (row.key === '부채비율') {
    const number = parsePercentNumber(value);
    return Number.isFinite(number) && number >= avg.debtRatio * DEBT_RATIO_WARN_FACTOR;
  }
  if (row.key === '유동비율') {
    const number = parsePercentNumber(value);
    return Number.isFinite(number) && number <= avg.currentRatio * CURRENT_RATIO_WARN_FACTOR;
  }
  if (row.key === '영업기간') {
    const date = parseFlexibleDate(value);
    const years = date ? yearsSince(date) : NaN;
    return Number.isFinite(years) && years < 3;
  }
  return false;
};

const resolveStatusClass = (company) => {
  const status = String(company?.['요약상태'] || company?.summaryStatus || '').trim();
  if (status === '최신') return 'latest';
  if (status === '1년 경과') return 'stale';
  return 'old';
};

const buildCriteria = (filters, includeRegions, excludeRegions) => {
  const criteria = {
    ...filters,
  };
  criteria.includeRegions = normalizeRegionSelection(includeRegions);
  criteria.excludeRegions = normalizeRegionSelection(excludeRegions);
  ['min_sipyung', 'max_sipyung', 'min_3y', 'max_3y', 'min_5y', 'max_5y'].forEach((key) => {
    criteria[key] = unformatNumber(criteria[key]);
  });
  const bizDigits = String(criteria.bizNumber || '').replace(/[^0-9]/g, '');
  if (bizDigits) criteria.bizNumber = bizDigits;
  else delete criteria.bizNumber;
  if (criteria.min_credit_grade) criteria.min_credit_grade = String(criteria.min_credit_grade).trim().toUpperCase();
  else delete criteria.min_credit_grade;
  return criteria;
};

const filterResultsForCurrentCriteria = (items, criteria) => {
  let nextItems = Array.isArray(items) ? items : [];
  const searchName = String(criteria?.name || '').trim().toLowerCase();
  if (searchName) {
    nextItems = nextItems.filter((company) => (
      String(company?.['검색된 회사'] || company?.['업체명'] || '').toLowerCase().includes(searchName)
    ));
  }
  return nextItems;
};

const getAwardHistoryMatches = (company, awardHistoryEntries) => {
  const awardHistoryInfo = getLhAwardHistoryMatchInfo(company, awardHistoryEntries);
  return Array.isArray(awardHistoryInfo?.ownerMatches)
    ? awardHistoryInfo.ownerMatches
    : (awardHistoryInfo ? [awardHistoryInfo] : []);
};

const buildAwardHistoryTooltip = (matches) => (
  matches
    .map((match) => {
      const owner = match.ownerLabel || match.ownerId || '발주처';
      const period = match.rangeText || [match.contractDateText, match.expiryDateText].filter(Boolean).join(' ~ ');
      return `${owner}: ${period}`;
    })
    .filter(Boolean)
);

function FilterPanel({
  open,
  filters,
  onClose,
  onChange,
  onReset,
  onSearch,
}) {
  React.useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="company-grid-filter-panel" role="region" aria-label="검색 필터">
      <div className="company-grid-filter-head">
        <h2>검색/필터</h2>
        <div className="company-grid-filter-head-actions">
          <button type="button" className="btn-muted" onClick={onReset}>초기화</button>
          <button type="button" className="btn-primary" onClick={onSearch}>검색</button>
          <button type="button" className="company-grid-filter-close" onClick={onClose}>닫기</button>
        </div>
      </div>
      <div className="company-grid-filter-body">
        <label>
          업체명
          <input value={filters.name} onChange={(event) => onChange({ name: event.target.value })} />
        </label>
        <label>
          사업자번호
          <input value={filters.bizNumber} onChange={(event) => onChange({ bizNumber: event.target.value })} />
        </label>
        <label>
          담당자 포함
          <input value={filters.manager} onChange={(event) => onChange({ manager: event.target.value })} />
        </label>
        <label>
          담당자 제외
          <input value={filters.managerExclude} onChange={(event) => onChange({ managerExclude: event.target.value })} />
        </label>
        <div className="company-grid-range-row">
          <label>
            시공능력 최소
            <input value={filters.min_sipyung} onChange={(event) => onChange({ min_sipyung: formatNumber(event.target.value) })} />
          </label>
          <label>
            시공능력 최대
            <input value={filters.max_sipyung} onChange={(event) => onChange({ max_sipyung: formatNumber(event.target.value) })} />
          </label>
        </div>
        <div className="company-grid-range-row">
          <label>
            3년 실적 최소
            <input value={filters.min_3y} onChange={(event) => onChange({ min_3y: formatNumber(event.target.value) })} />
          </label>
          <label>
            3년 실적 최대
            <input value={filters.max_3y} onChange={(event) => onChange({ max_3y: formatNumber(event.target.value) })} />
          </label>
        </div>
        <div className="company-grid-range-row">
          <label>
            5년 실적 최소
            <input value={filters.min_5y} onChange={(event) => onChange({ min_5y: formatNumber(event.target.value) })} />
          </label>
          <label>
            5년 실적 최대
            <input value={filters.max_5y} onChange={(event) => onChange({ max_5y: formatNumber(event.target.value) })} />
          </label>
        </div>
        <label>
          최소 신용등급
          <select value={filters.min_credit_grade} onChange={(event) => onChange({ min_credit_grade: event.target.value })}>
            <option value="">전체</option>
            {CREDIT_GRADE_OPTIONS.map((grade) => (
              <option key={grade} value={grade}>{grade}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

export default function CompanyGridPage() {
  const persistedRef = React.useRef(null);
  if (persistedRef.current === null) {
    persistedRef.current = loadPersisted(COMPANY_GRID_STORAGE_KEY, null);
  }
  const persisted = persistedRef.current || {};
  const restoredFilters = restoreFilters(persisted.filters);
  const restoredIncludeRegions = normalizeRegionSelection(
    Array.isArray(persisted.includeRegions)
      ? persisted.includeRegions
      : (Array.isArray(persisted.filters?.includeRegions) ? persisted.filters.includeRegions : []),
  );
  const restoredSelectedRegion = typeof persisted.selectedRegion === 'string'
    && persisted.selectedRegion
    && persisted.selectedRegion !== '전체'
    ? [persisted.selectedRegion]
    : [];
  const restoredExcludeRegions = normalizeRegionSelection(
    Array.isArray(persisted.excludeRegions)
      ? persisted.excludeRegions
      : (Array.isArray(persisted.filters?.excludeRegions) ? persisted.filters.excludeRegions : []),
  );

  const { notify } = useFeedback();
  const [activeMenu, setActiveMenu] = React.useState('company-grid');
  const [fileType, setFileType] = React.useState(() => normalizeFileType(persisted.fileType || 'eung'));
  const [includeRegions, setIncludeRegions] = React.useState(() => (
    restoredIncludeRegions.length > 0 ? restoredIncludeRegions : restoredSelectedRegion
  ));
  const [excludeRegions, setExcludeRegions] = React.useState(() => restoredExcludeRegions);
  const [regions, setRegions] = React.useState(() => (
    Array.isArray(persisted.regions) && persisted.regions.length > 0 ? persisted.regions : ['전체']
  ));
  const [filters, setFilters] = React.useState(() => restoredFilters);
  const [filterOpen, setFilterOpen] = React.useState(() => !!persisted.filterOpen);
  const [results, setResults] = React.useState(() => (
    Array.isArray(persisted.results) ? persisted.results : []
  ));
  const [visibleCount, setVisibleCount] = React.useState(() => {
    const savedCount = Number(persisted.visibleCount);
    return Number.isFinite(savedCount) && savedCount > 0 ? savedCount : COMPANY_GRID_RENDER_BATCH_SIZE;
  });
  const [selectedCompanyKey, setSelectedCompanyKey] = React.useState(() => (
    typeof persisted.selectedCompanyKey === 'string' ? persisted.selectedCompanyKey : ''
  ));
  const [totalCount, setTotalCount] = React.useState(() => (
    Number.isFinite(Number(persisted.totalCount)) ? Number(persisted.totalCount) : 0
  ));
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [searched, setSearched] = React.useState(() => !!persisted.searched);
  const [awardHistoryEntries, setAwardHistoryEntries] = React.useState(() => (
    normalizeLhAwardHistoryEntries(DEFAULT_LH_AWARD_HISTORY_ENTRIES)
  ));
  const lastSearchRequestIdRef = React.useRef(0);

  const regionOptions = React.useMemo(() => (
    regions.filter((region) => region && region !== '전체')
  ), [regions]);

  const visibleResults = React.useMemo(() => (
    results.slice(0, Math.min(results.length, visibleCount))
  ), [results, visibleCount]);

  const resultBlocks = React.useMemo(() => {
    const blocks = [];
    for (let index = 0; index < visibleResults.length; index += COMPANIES_PER_GRID_BLOCK) {
      blocks.push(visibleResults.slice(index, index + COMPANIES_PER_GRID_BLOCK));
    }
    return blocks;
  }, [visibleResults]);

  const selectedCompany = React.useMemo(() => (
    results.find((company, index) => getCompanySelectionKey(company, index) === selectedCompanyKey) || null
  ), [results, selectedCompanyKey]);

  const loadRegions = React.useCallback(async (targetFileType) => {
    try {
      const response = await searchClient.getRegions(targetFileType);
      const nextRegions = Array.isArray(response) && response.length ? response : ['전체'];
      setRegions(nextRegions);
      setIncludeRegions((prev) => prev.filter((region) => nextRegions.includes(region)));
      setExcludeRegions((prev) => prev.filter((region) => nextRegions.includes(region)));
    } catch (regionError) {
      console.warn('[CompanyGrid] region load failed:', regionError);
      setRegions(['전체']);
      setIncludeRegions([]);
      setExcludeRegions([]);
    }
  }, []);

  React.useEffect(() => {
    loadRegions(fileType);
  }, [fileType, loadRegions]);

  React.useEffect(() => {
    savePersisted(COMPANY_GRID_STORAGE_KEY, {
      fileType,
      includeRegions,
      excludeRegions,
      regions: Array.isArray(regions) && regions.length > 0 ? regions : ['전체'],
      filters: sanitizeFilters(filters),
      filterOpen,
      results: Array.isArray(results) ? results : [],
      visibleCount,
      selectedCompanyKey,
      totalCount,
      searched,
    });
  }, [excludeRegions, fileType, filterOpen, filters, includeRegions, regions, results, searched, selectedCompanyKey, totalCount, visibleCount]);

  React.useEffect(() => {
    let canceled = false;
    lhAwardHistoryClient.load()
      .then((data) => {
        if (canceled) return;
        setAwardHistoryEntries(normalizeLhAwardHistoryEntries(data?.entries || DEFAULT_LH_AWARD_HISTORY_ENTRIES));
      })
      .catch((loadError) => {
        console.warn('[CompanyGrid] award history load failed:', loadError);
      });
    return () => {
      canceled = true;
    };
  }, []);

  const renderCellContent = React.useCallback((company, row) => {
    const value = formatCellValue(company, row) || '-';
    if (row.key !== '검색된 회사') return value;

    const awardHistoryMatches = getAwardHistoryMatches(company, awardHistoryEntries);
    const activeAwardHistory = awardHistoryMatches.some((match) => match && !match.expired);
    const tooltipLines = buildAwardHistoryTooltip(awardHistoryMatches);

    return (
      <span className="company-grid-company-name-wrap">
        <span className={activeAwardHistory ? 'company-grid-award-company' : ''}>{value}</span>
        {activeAwardHistory && tooltipLines.length > 0 && (
          <span className="company-grid-award-icon" tabIndex={0} aria-label={`낙찰이력 ${tooltipLines.join(', ')}`}>
            !
            <span className="company-grid-award-tooltip" role="tooltip">
              {tooltipLines.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </span>
          </span>
        )}
      </span>
    );
  }, [awardHistoryEntries]);

  const handleSelectMenu = React.useCallback((key) => {
    setActiveMenu(key);
    if (key === 'search') window.location.hash = '#/search';
    else if (key === 'company-grid') window.location.hash = '#/company-grid';
    else if (key === 'records') window.location.hash = '#/records';
    else if (key === 'mail') window.location.hash = '#/mail';
    else if (key === 'agreements') window.location.hash = '#/agreement-board';
    else if (key === 'agreements-sms') window.location.hash = '#/agreements';
    else if (key === 'auto-agreement') window.location.hash = '#/auto-agreement';
    else if (key === 'excel-helper') window.location.hash = '#/excel-helper';
    else if (key === 'bid-result') window.location.hash = '#/bid-result';
    else if (key === 'company-notes') window.location.hash = '#/company-notes';
    else if (key === 'settings') window.location.hash = '#/settings';
    else if (key === 'excel-web-edit') window.location.hash = '#/excel-web-edit';
    else if (key === 'scan-archive') window.location.hash = '#/scan-archive';
  }, []);

  const executeSearch = React.useCallback(async (overrides = {}) => {
    const requestId = lastSearchRequestIdRef.current + 1;
    lastSearchRequestIdRef.current = requestId;
    try {
      const effectiveIncludeRegions = normalizeRegionSelection(overrides.includeRegions ?? includeRegions);
      const effectiveExcludeRegions = normalizeRegionSelection(overrides.excludeRegions ?? excludeRegions);
      setLoading(true);
      setError('');
      setSearched(true);
      setResults([]);
      setSelectedCompanyKey('');
      setTotalCount(0);
      setVisibleCount(COMPANY_GRID_RENDER_BATCH_SIZE);
      const criteria = buildCriteria(filters, effectiveIncludeRegions, effectiveExcludeRegions);
      const options = {
        pagination: null,
      };
      const response = await searchClient.searchCompanies(criteria, normalizeFileType(fileType), options);
      if (lastSearchRequestIdRef.current !== requestId) return;
      if (!response?.success) throw new Error(response?.message || '검색 실패');
      const items = filterResultsForCurrentCriteria(response.data, criteria);
      setResults(items);
      setTotalCount(items.length);
      setVisibleCount(COMPANY_GRID_RENDER_BATCH_SIZE);
      setSelectedCompanyKey((prev) => (
        prev && items.some((company, index) => getCompanySelectionKey(company, index) === prev) ? prev : ''
      ));
      if (items.length === 0) {
        notify({ type: 'info', message: '검색 결과가 없습니다.' });
      }
    } catch (searchError) {
      if (lastSearchRequestIdRef.current !== requestId) return;
      console.error('[CompanyGrid] search failed:', searchError);
      setResults([]);
      setSelectedCompanyKey('');
      setTotalCount(0);
      setError(searchError?.message || '검색 중 오류가 발생했습니다.');
    } finally {
      if (lastSearchRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [excludeRegions, fileType, filters, includeRegions, notify]);

  React.useEffect(() => {
    const handleEnterSearch = (event) => {
      if (event.key !== 'Enter') return;
      if (event.isComposing || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
      const target = event.target;
      const tagName = String(target?.tagName || '').toUpperCase();
      if (target?.isContentEditable || tagName === 'TEXTAREA' || tagName === 'BUTTON' || tagName === 'SELECT') return;
      event.preventDefault();
      if (loading) return;
      executeSearch();
    };
    window.addEventListener('keydown', handleEnterSearch);
    return () => window.removeEventListener('keydown', handleEnterSearch);
  }, [executeSearch, loading]);

  const handleFileTypeChange = (event) => {
    const nextType = normalizeFileType(event.target.value);
    setFileType(nextType);
    setIncludeRegions([]);
    setExcludeRegions([]);
    setResults([]);
    setSelectedCompanyKey('');
    setTotalCount(0);
    setVisibleCount(COMPANY_GRID_RENDER_BATCH_SIZE);
    setSearched(false);
  };

  const handleIncludeRegionChange = (region) => {
    const normalized = normalizeRegion(region);
    const nextIncludeRegions = normalized === '전체'
      ? []
      : (includeRegions.includes(normalized)
        ? includeRegions.filter((item) => item !== normalized)
        : [...includeRegions, normalized]);
    setIncludeRegions(nextIncludeRegions);
    if (searched) {
      executeSearch({ includeRegions: nextIncludeRegions });
    }
  };

  const handleExcludeRegionChange = (region) => {
    const normalized = normalizeRegion(region);
    if (!normalized || normalized === '전체') return;
    const nextExcludeRegions = excludeRegions.includes(normalized)
      ? excludeRegions.filter((item) => item !== normalized)
      : [...excludeRegions, normalized];
    setExcludeRegions(nextExcludeRegions);
    if (searched) {
      executeSearch({ excludeRegions: nextExcludeRegions });
    }
  };

  const handleFilterChange = (patch) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS);
    setIncludeRegions([]);
    setExcludeRegions([]);
    setResults([]);
    setSelectedCompanyKey('');
    setTotalCount(0);
    setVisibleCount(COMPANY_GRID_RENDER_BATCH_SIZE);
    setSearched(false);
    setError('');
  };

  const handleCopyAll = React.useCallback(async () => {
    if (!selectedCompany) {
      notify({ type: 'warning', message: '전체복사할 업체를 먼저 선택하세요.' });
      return;
    }
    try {
      const response = await searchClient.copyCsvColumn(buildCopyRows(selectedCompany));
      if (!response?.success) throw new Error(response?.message || 'copy failed');
      notify({ type: 'success', message: '선택한 업체 정보가 클립보드에 복사되었습니다.' });
    } catch (copyError) {
      console.error('[CompanyGrid] copy failed:', copyError);
      notify({ type: 'error', message: '복사 중 오류가 발생했습니다.' });
    }
  }, [notify, selectedCompany]);

  const handleSelectCompany = React.useCallback((selectionKey) => {
    if (!selectionKey) return;
    setSelectedCompanyKey((prev) => (prev === selectionKey ? '' : selectionKey));
  }, []);

  const handleShowMore = React.useCallback(() => {
    setVisibleCount((prev) => Math.min(results.length, prev + COMPANY_GRID_RENDER_BATCH_SIZE));
  }, [results.length]);

  return (
    <div className="app-shell sidebar-wide">
      <Sidebar active={activeMenu} onSelect={handleSelectMenu} collapsed={false} />
      <main className="main company-grid-main">
        <div className="topbar" />
        <section className="company-grid-workspace">
          <div className="company-grid-toolbar">
            <div className="company-grid-toolbar-left">
              <label className="company-grid-filetype">
                공종
                <select value={fileType} onChange={handleFileTypeChange}>
                  {FILE_TYPE_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                  ))}
                </select>
              </label>
              <button type="button" className="company-grid-filter-button" onClick={() => setFilterOpen((prev) => !prev)}>
                검색/필터
              </button>
              <button type="button" className="btn-muted" onClick={handleReset}>
                초기화
              </button>
              <button type="button" className="btn-muted" onClick={handleCopyAll} disabled={!selectedCompany}>
                전체복사
              </button>
              <button type="button" className="btn-primary" onClick={() => executeSearch()} disabled={loading}>
                {loading ? '검색 중...' : '검색'}
              </button>
            </div>
            <div className="company-grid-region-area" aria-label="지역 조건">
              <div className="company-grid-region-row">
                <span className="company-grid-region-label">포함</span>
                <div className="company-grid-region-tabs" role="group" aria-label="지역 포함">
                  <button
                    type="button"
                    className={includeRegions.length === 0 ? 'active' : ''}
                    onClick={() => handleIncludeRegionChange('전체')}
                  >
                    전체
                  </button>
                  {regionOptions.map((region) => (
                    <button
                      key={`include-${region}`}
                      type="button"
                      className={includeRegions.includes(region) ? 'active' : ''}
                      onClick={() => handleIncludeRegionChange(region)}
                    >
                      {region}
                    </button>
                  ))}
                </div>
              </div>
              <div className="company-grid-region-row">
                <span className="company-grid-region-label exclude">제외</span>
                <div className="company-grid-region-tabs company-grid-region-tabs-exclude" role="group" aria-label="지역 제외">
                  {regionOptions.map((region) => (
                    <button
                      key={`exclude-${region}`}
                      type="button"
                      className={excludeRegions.includes(region) ? 'active' : ''}
                      onClick={() => handleExcludeRegionChange(region)}
                    >
                      {region}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="company-grid-summary">
              {selectedCompany && (
                <span>선택 {selectedCompany['검색된 회사'] || selectedCompany['업체명'] || '-'}</span>
              )}
              <span>결과 {totalCount.toLocaleString()}건</span>
              {results.length > 0 && results.length > visibleResults.length && (
                <span>표시 {visibleResults.length.toLocaleString()}건</span>
              )}
            </div>
          </div>
          <FilterPanel
            open={filterOpen}
            filters={filters}
            onClose={() => setFilterOpen(false)}
            onChange={handleFilterChange}
            onReset={handleReset}
            onSearch={() => {
              executeSearch();
            }}
          />

          {error && <p className="company-grid-error">{error}</p>}

          <div className="company-grid-table-wrap">
            {!searched && (
              <div className="company-grid-empty">
                <strong>검색 조건을 설정하고 검색하세요.</strong>
                <span>업체 정보를 엑셀형 바둑판으로 비교합니다.</span>
              </div>
            )}
            {searched && !loading && results.length === 0 && (
              <div className="company-grid-empty">
                <strong>검색 결과가 없습니다.</strong>
                <span>공종, 지역탭, 검색/필터 조건을 확인하세요.</span>
              </div>
            )}
            {resultBlocks.length > 0 && (
              <div className="company-grid-blocks">
                {resultBlocks.map((block, blockIndex) => (
                  <table className="company-grid-table" key={`block-${blockIndex}`}>
                    <tbody>
                      {GRID_ROWS.map((row) => (
                        <tr
                          key={row.key}
                          className={[
                            row.key === '비고' ? 'company-grid-note-row' : '',
                            row.key === '신용평가' ? 'company-grid-credit-row' : '',
                          ].filter(Boolean).join(' ')}
                        >
                          <th>{row.label}</th>
                          {block.map((company, index) => {
                            const absoluteIndex = (blockIndex * COMPANIES_PER_GRID_BLOCK) + index;
                            const selectionKey = getCompanySelectionKey(company, absoluteIndex);
                            const selectedClass = selectionKey && selectionKey === selectedCompanyKey ? 'company-grid-cell-selected' : '';
                            const statusClass = resolveStatusClass(company);
                            const warnClass = shouldWarnCell(company, row, fileType) ? 'company-grid-cell-warn' : '';
                            const industryClass = fileType === 'all' && row.key === '검색된 회사'
                              ? `company-grid-industry-${getCompanyFileType(company, 'all')}`
                              : '';
                            return (
                              <td
                                key={`${row.key}-${company['사업자번호'] || absoluteIndex}`}
                                className={`company-grid-cell company-grid-status-${statusClass} ${row.kind === 'number' || row.kind === 'percent' ? 'numeric' : ''} ${warnClass} ${selectedClass} ${industryClass}`.trim()}
                                onClick={() => handleSelectCompany(selectionKey)}
                              >
                                {renderCellContent(company, row)}
                              </td>
                            );
                          })}
                          {block.length < COMPANIES_PER_GRID_BLOCK && Array.from({ length: COMPANIES_PER_GRID_BLOCK - block.length }).map((_, index) => (
                            <td key={`${row.key}-empty-${index}`} className="company-grid-cell company-grid-empty-cell" />
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ))}
                {results.length > visibleResults.length && (
                  <div className="company-grid-load-more">
                    <button type="button" onClick={handleShowMore}>
                      더 보기 ({visibleResults.length.toLocaleString()} / {results.length.toLocaleString()})
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

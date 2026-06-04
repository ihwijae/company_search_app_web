import React from 'react';
import CompanySearchModal from '../../../../components/CompanySearchModal.jsx';
import { useFeedback } from '../../../../components/FeedbackProvider.jsx';
import lhAwardHistoryClient from '../../../../shared/lhAwardHistoryClient.js';
import {
  formatLhAwardDateInput,
  getLhAwardHistoryText,
  normalizeLhAwardHistoryEntries,
} from '../../../../shared/agreements/lhAwardHistory.js';

const EMPTY_FORM = {
  id: '',
  companyName: '',
  bizNo: '',
  fileType: 'eung',
  contractDate: '',
  contractAmount: '',
  projectName: '',
};

const formatAmount = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  return numeric.toLocaleString('ko-KR');
};

const parseAmountInput = (value) => {
  const raw = String(value || '').replace(/\D/g, '');
  return raw ? Number(raw) : null;
};

const getPickedCompanyName = (picked) => (
  picked?.name
  || picked?.snapshot?.['검색된 회사']
  || picked?.snapshot?.['업체명']
  || picked?.snapshot?.name
  || ''
);

const getPickedBizNo = (picked) => (
  picked?.bizNo
  || picked?.snapshot?.['사업자번호']
  || picked?.snapshot?.bizNo
  || ''
);

export default function LhAwardHistoryWindow({
  onClose = () => {},
  entries = [],
  onEntriesChange = () => {},
  fileType = 'eung',
  loading = false,
  error = '',
}) {
  const { notify, confirm } = useFeedback();
  const normalizedEntries = React.useMemo(() => normalizeLhAwardHistoryEntries(entries), [entries]);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchInitialQuery, setSearchInitialQuery] = React.useState('');
  const [linkTargetId, setLinkTargetId] = React.useState('');
  const [deleteTarget, setDeleteTarget] = React.useState(null);
  const [copying, setCopying] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const rootRef = React.useRef(null);

  const getFeedbackTarget = React.useCallback(() => (
    rootRef.current?.ownerDocument?.body || null
  ), []);

  const resetForm = React.useCallback(() => {
    setForm({ ...EMPTY_FORM, fileType: fileType || 'eung' });
  }, [fileType]);

  React.useEffect(() => {
    resetForm();
  }, [resetForm]);

  const updateEntries = React.useCallback((nextEntries) => {
    onEntriesChange(normalizeLhAwardHistoryEntries(nextEntries));
  }, [onEntriesChange]);

  const handlePickCompany = React.useCallback((picked) => {
    const companyName = getPickedCompanyName(picked);
    const bizNo = getPickedBizNo(picked);
    const nextFileType = picked?.fileType && picked.fileType !== 'all' ? picked.fileType : (fileType || 'eung');
    if (linkTargetId) {
      updateEntries(normalizedEntries.map((entry) => (
        entry.id === linkTargetId
          ? {
            ...entry,
            companyName: companyName || entry.companyName,
            bizNo: bizNo || entry.bizNo,
            fileType: nextFileType,
            matchMode: bizNo ? 'bizNo' : 'name',
          }
          : entry
      )));
      setLinkTargetId('');
      setSearchInitialQuery('');
      setSearchOpen(false);
      return;
    }
    setForm((prev) => ({
      ...prev,
      companyName: companyName || prev.companyName,
      bizNo: bizNo || prev.bizNo,
      fileType: nextFileType,
    }));
    setSearchInitialQuery('');
    setSearchOpen(false);
  }, [fileType, linkTargetId, normalizedEntries, updateEntries]);

  const handleSaveForm = React.useCallback(() => {
    const companyName = String(form.companyName || '').trim();
    const contractDate = formatLhAwardDateInput(form.contractDate);
    if (!companyName || !contractDate) return;
    const nextEntry = {
      id: form.id || `award-${Date.now()}`,
      companyName,
      bizNo: String(form.bizNo || '').trim(),
      fileType: form.fileType || fileType || 'eung',
      contractDate,
      contractAmount: parseAmountInput(form.contractAmount),
      projectName: String(form.projectName || '').trim(),
      matchMode: form.bizNo ? 'bizNo' : 'name',
    };
    const exists = normalizedEntries.some((entry) => entry.id === nextEntry.id);
    const nextEntries = exists
      ? normalizedEntries.map((entry) => (entry.id === nextEntry.id ? nextEntry : entry))
      : [nextEntry, ...normalizedEntries];
    updateEntries(nextEntries);
    resetForm();
    setEditorOpen(false);
  }, [fileType, form, normalizedEntries, resetForm, updateEntries]);

  const handleEdit = React.useCallback((entry) => {
    setForm({
      id: entry.id,
      companyName: entry.companyName,
      bizNo: entry.bizNo || '',
      fileType: entry.fileType || fileType || 'eung',
      contractDate: formatLhAwardDateInput(entry.contractDate),
      contractAmount: entry.contractAmount != null ? formatAmount(entry.contractAmount) : '',
      projectName: entry.projectName || '',
    });
    setEditorOpen(true);
  }, [fileType]);

  const requestDelete = React.useCallback((entry) => {
    setDeleteTarget(entry || null);
  }, []);

  const confirmDelete = React.useCallback(() => {
    if (!deleteTarget?.id) return;
    updateEntries(normalizedEntries.filter((entry) => entry.id !== deleteTarget.id));
    if (form.id === deleteTarget.id) {
      resetForm();
      setEditorOpen(false);
    }
    setDeleteTarget(null);
  }, [deleteTarget, form.id, normalizedEntries, resetForm, updateEntries]);

  const openCreateEditor = React.useCallback(() => {
    resetForm();
    setEditorOpen(true);
  }, [resetForm]);

  const closeEditor = React.useCallback(() => {
    resetForm();
    setEditorOpen(false);
  }, [resetForm]);

  const openCompanySearch = React.useCallback((targetId = '') => {
    const targetEntry = targetId
      ? normalizedEntries.find((entry) => entry.id === targetId)
      : null;
    setLinkTargetId(targetId);
    setSearchInitialQuery(String(targetEntry?.companyName || form.companyName || '').trim());
    setSearchOpen(true);
  }, [form.companyName, normalizedEntries]);

  const handleCopy = React.useCallback(async () => {
    if (copying) return;
    if (!normalizedEntries.length) {
      notify({ type: 'warning', message: '복사할 낙찰이력이 없습니다.', portalTarget: getFeedbackTarget() });
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      notify({ type: 'error', message: '이 브라우저에서는 복사 기능을 사용할 수 없습니다.', portalTarget: getFeedbackTarget() });
      return;
    }
    try {
      setCopying(true);
      await navigator.clipboard.writeText(getLhAwardHistoryText(normalizedEntries));
      notify({ type: 'success', message: '공유용 낙찰이력 텍스트를 복사했습니다.', portalTarget: getFeedbackTarget() });
    } catch (error) {
      notify({ type: 'error', message: error?.message || '복사에 실패했습니다.', portalTarget: getFeedbackTarget() });
    } finally {
      setCopying(false);
    }
  }, [copying, getFeedbackTarget, normalizedEntries, notify]);

  const handleExport = React.useCallback(async () => {
    if (exporting) return;
    if (!normalizedEntries.length) {
      notify({ type: 'warning', message: '내보낼 낙찰이력이 없습니다.', portalTarget: getFeedbackTarget() });
      return;
    }
    try {
      setExporting(true);
      const result = await lhAwardHistoryClient.exportData(normalizedEntries);
      if (!result?.canceled) {
        notify({ type: 'success', message: `낙찰이력 ${normalizedEntries.length}건을 내보냈습니다.`, portalTarget: getFeedbackTarget() });
      }
    } catch (error) {
      notify({ type: 'error', message: error?.message || '내보내기에 실패했습니다.', portalTarget: getFeedbackTarget() });
    } finally {
      setExporting(false);
    }
  }, [exporting, getFeedbackTarget, normalizedEntries, notify]);

  const handleImport = React.useCallback(async () => {
    if (importing) return;
    const ok = await confirm({
      title: '낙찰이력 가져오기',
      message: '가져오기를 실행하면 현재 낙찰이력 목록이 가져온 파일로 교체됩니다. 계속할까요?',
      confirmText: '가져오기',
      cancelText: '취소',
      portalTarget: getFeedbackTarget(),
    });
    if (!ok) return;
    try {
      setImporting(true);
      const result = await lhAwardHistoryClient.importData();
      if (result?.canceled) return;
      const importedEntries = normalizeLhAwardHistoryEntries(result?.entries || []);
      updateEntries(importedEntries);
      resetForm();
      setEditorOpen(false);
      setDeleteTarget(null);
      notify({
        type: 'success',
        message: `낙찰이력 ${importedEntries.length}건을 가져왔습니다.`,
        portalTarget: getFeedbackTarget(),
      });
    } catch (error) {
      notify({ type: 'error', message: error?.message || '가져오기에 실패했습니다.', portalTarget: getFeedbackTarget() });
    } finally {
      setImporting(false);
    }
  }, [confirm, getFeedbackTarget, importing, notify, resetForm, updateEntries]);

  return (
    <div ref={rootRef} style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#f8fafc',
      color: '#0f172a',
      fontFamily: '"Noto Sans KR", "Malgun Gothic", sans-serif',
    }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 16,
        padding: '18px 20px 14px',
        borderBottom: '1px solid #dbe4ee',
        background: '#ffffff',
      }}
      >
        <div>
          <strong style={{ fontSize: 16 }}>낙찰이력업체</strong>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#475569' }}>
            계약일이 공고일 기준 1년 이내면 협정보드에서 업체명을 빨간색으로 강조합니다.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="excel-btn" onClick={handleCopy} disabled={copying}>
            {copying ? '복사 중...' : '복사'}
          </button>
          <button type="button" className="excel-btn" onClick={handleImport} disabled={importing}>
            {importing ? '가져오는 중...' : '가져오기'}
          </button>
          <button type="button" className="excel-btn" onClick={handleExport} disabled={exporting}>
            {exporting ? '내보내는 중...' : '내보내기'}
          </button>
          <button type="button" className="excel-btn primary" onClick={openCreateEditor}>업체추가</button>
          <button type="button" className="excel-btn" onClick={onClose}>닫기</button>
        </div>
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderBottom: '1px solid #dbe4ee',
        background: '#f8fafc',
      }}
      >
        <div style={{ fontSize: 13, color: '#475569' }}>
          등록 {normalizedEntries.length.toLocaleString('ko-KR')}건
        </div>
        {error && <div style={{ marginTop: 8, color: '#b91c1c', fontSize: 13 }}>{error}</div>}
      </div>

      <div style={{ flex: 1, minHeight: 0, padding: 16, overflow: 'auto' }}>
        <table className="details-table" style={{ width: '100%', background: '#fff' }}>
          <thead>
            <tr>
              <th style={{ width: '20%' }}>업체명</th>
              <th style={{ width: '14%' }}>사업자번호</th>
              <th style={{ width: '12%' }}>계약일</th>
              <th style={{ width: '16%' }}>계약금액</th>
              <th>공사명</th>
              <th style={{ width: 170 }}></th>
            </tr>
          </thead>
          <tbody>
            {normalizedEntries.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.companyName}</td>
                <td>{entry.bizNo || <span style={{ color: '#b45309', fontWeight: 700 }}>미연결</span>}</td>
                <td>{entry.contractDate}</td>
                <td>{entry.contractAmount != null ? `${formatAmount(entry.contractAmount)}원` : '-'}</td>
                <td>{entry.projectName || '-'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    {!entry.bizNo && (
                      <button type="button" className="excel-btn" onClick={() => openCompanySearch(entry.id)}>업체 연결</button>
                    )}
                    <button type="button" className="excel-btn" onClick={() => handleEdit(entry)}>수정</button>
                    <button type="button" className="excel-btn" onClick={() => requestDelete(entry)}>삭제</button>
                  </div>
                </td>
              </tr>
            ))}
            {normalizedEntries.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 20, color: '#64748b' }}>
                  {loading ? '불러오는 중...' : '등록된 낙찰이력이 없습니다.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editorOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            background: 'rgba(15, 23, 42, 0.35)',
            zIndex: 30,
          }}
          onClick={closeEditor}
        >
          <div
            style={{
              width: 'min(920px, 100%)',
              maxHeight: 'calc(100vh - 48px)',
              overflow: 'auto',
              background: '#ffffff',
              border: '1px solid #dbe4ee',
              borderRadius: 10,
              boxShadow: '0 24px 80px rgba(15, 23, 42, 0.22)',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              padding: '16px 18px',
              borderBottom: '1px solid #e2e8f0',
            }}
            >
              <strong style={{ fontSize: 15 }}>{form.id ? '낙찰이력 수정' : '낙찰이력 등록'}</strong>
              <button type="button" className="excel-btn" onClick={closeEditor}>닫기</button>
            </div>
            <div style={{ display: 'grid', gap: 12, padding: 18 }}>
              <label style={{ display: 'grid', gap: 6, fontSize: 13, color: '#475569' }}>
                업체
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={form.companyName}
                    onChange={(event) => setForm((prev) => ({ ...prev, companyName: event.target.value }))}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        openCompanySearch('');
                      }
                    }}
                    placeholder="업체명"
                    style={{ flex: 1 }}
                  />
                  <button type="button" className="excel-btn" onClick={() => openCompanySearch('')}>업체조회</button>
                </div>
              </label>
              {form.bizNo && (
                <div style={{ fontSize: 12, color: '#64748b' }}>연결된 사업자번호: {form.bizNo}</div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '160px 180px', gap: 10 }}>
                <label style={{ display: 'grid', gap: 6, fontSize: 13, color: '#475569' }}>
                  계약일
                  <input
                    type="date"
                    value={form.contractDate}
                    onChange={(event) => setForm((prev) => ({ ...prev, contractDate: event.target.value }))}
                  />
                </label>
                <label style={{ display: 'grid', gap: 6, fontSize: 13, color: '#475569' }}>
                  계약금액
                  <input
                    value={form.contractAmount}
                    onChange={(event) => setForm((prev) => ({ ...prev, contractAmount: formatAmount(parseAmountInput(event.target.value)) }))}
                    placeholder="원"
                  />
                </label>
              </div>
              <label style={{ display: 'grid', gap: 6, fontSize: 13, color: '#475569' }}>
                공사명
                <input
                  value={form.projectName}
                  onChange={(event) => setForm((prev) => ({ ...prev, projectName: event.target.value }))}
                  placeholder="공사명"
                />
              </label>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              padding: '14px 18px 16px',
              borderTop: '1px solid #e2e8f0',
            }}
            >
              <button type="button" className="excel-btn" onClick={closeEditor}>취소</button>
              <button type="button" className="excel-btn primary" onClick={handleSaveForm} disabled={!form.companyName || !form.contractDate}>
                {form.id ? '수정' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            background: 'rgba(15, 23, 42, 0.35)',
            zIndex: 35,
          }}
          onClick={() => setDeleteTarget(null)}
        >
          <div
            style={{
              width: 'min(420px, 100%)',
              background: '#ffffff',
              border: '1px solid #dbe4ee',
              borderRadius: 10,
              boxShadow: '0 24px 80px rgba(15, 23, 42, 0.22)',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ padding: '18px 20px 10px' }}>
              <strong style={{ fontSize: 15 }}>낙찰이력 삭제</strong>
              <p style={{ margin: '10px 0 0', fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
                {deleteTarget.companyName}의 낙찰이력을 삭제할까요?
              </p>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              padding: '14px 20px 18px',
            }}
            >
              <button type="button" className="excel-btn" onClick={() => setDeleteTarget(null)}>취소</button>
              <button type="button" className="excel-btn primary" onClick={confirmDelete}>삭제</button>
            </div>
          </div>
        </div>
      )}

      {searchOpen && (
        <CompanySearchModal
          open={searchOpen}
          onClose={() => {
            setSearchOpen(false);
            setSearchInitialQuery('');
            setLinkTargetId('');
          }}
          onPick={handlePickCompany}
          fileType="all"
          initialQuery={searchInitialQuery}
          allowAll
          forceAllFileTypes
          forceWebSearch
          dedupeResults
          simpleView
        />
      )}
    </div>
  );
}

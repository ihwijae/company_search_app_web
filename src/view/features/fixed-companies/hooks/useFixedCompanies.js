import React from 'react';
import fixedCompaniesClient from '../../../../shared/fixedCompaniesClient.js';
import { getFixedCompanyScopeKey, getFixedCompanyKey, normalizeFixedCompany } from '../../../../shared/fixedCompanies.js';
import { extractManagerNames } from '../../../../utils/companyIndicators.js';

export default function useFixedCompanies({ notify, confirm }) {
  const loadRequestRef = React.useRef(0);
  const [scope, setScope] = React.useState({ industry: 'eung', range: 'under50', region: '서울' });
  const [groups, setGroups] = React.useState({});
  const [drafts, setDrafts] = React.useState({});
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const key = getFixedCompanyScopeKey(scope);
  const companies = drafts[key] || groups[key]?.companies || [];
  const dirtyKeys = Object.keys(drafts).filter((draftKey) => JSON.stringify(drafts[draftKey]) !== JSON.stringify(groups[draftKey]?.companies || []));
  const dirty = dirtyKeys.includes(key);

  const load = React.useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    setError('');
    try {
      const doc = await fixedCompaniesClient.load();
      if (requestId !== loadRequestRef.current) return;
      setGroups(doc.groups);
      setDrafts({});
    } catch (loadError) {
      if (requestId === loadRequestRef.current) setError(loadError.message);
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  }, []);
  React.useEffect(() => {
    load();
    return () => { loadRequestRef.current += 1; };
  }, [load]);

  const reload = async () => {
    if (dirtyKeys.length && !await confirm({
      title: '설정을 다시 불러올까요?',
      message: '저장하지 않은 변경사항을 지우고 서버의 최신 설정을 불러옵니다.',
      confirmText: '다시 불러오기',
    })) return;
    await load();
  };
  const updateCompanies = (next) => setDrafts((prev) => ({ ...prev, [key]: next }));
  const pickCompany = (picked) => {
    const snapshot = picked.snapshot || {};
    const company = normalizeFixedCompany({
      ...picked,
      companyRegion: snapshot['대표지역'] || snapshot['지역'] || '',
      managerNames: extractManagerNames(snapshot),
      note: '',
    });
    if (!company) return;
    if (companies.some((item) => getFixedCompanyKey(item) === getFixedCompanyKey(company))) {
      notify({ type: 'info', message: '현재 조건에 이미 등록된 업체입니다.' });
      return;
    }
    updateCompanies([...companies, company]);
    setPickerOpen(false);
  };
  const removeCompany = async (company) => {
    if (!await confirm({ title: '고정업체를 삭제할까요?', message: `${company.name} 업체를 현재 조건의 목록에서 삭제합니다.`, confirmText: '삭제' })) return;
    updateCompanies(companies.filter((item) => getFixedCompanyKey(item) !== getFixedCompanyKey(company)));
  };
  const updateNote = (companyKey, note) => updateCompanies(companies.map((item) => (
    getFixedCompanyKey(item) === companyKey ? { ...item, note } : item
  )));
  const save = async () => {
    if (saving || !dirty) return;
    setSaving(true);
    try {
      const result = await fixedCompaniesClient.saveGroup(scope, companies, groups[key]?.revision || 0);
      setGroups((prev) => ({ ...prev, [result.key]: result.group }));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[result.key];
        return next;
      });
      notify({ type: 'success', message: `${scope.region} 고정업체 설정을 저장했습니다.` });
    } catch (saveError) {
      notify({ type: 'error', message: saveError.message });
    } finally {
      setSaving(false);
    }
  };
  const countForRegion = (region) => {
    const regionKey = getFixedCompanyScopeKey({ ...scope, region });
    return (drafts[regionKey] || groups[regionKey]?.companies || []).length;
  };
  return {
    scope, setScope, companies, groups, dirty, dirtyCount: dirtyKeys.length,
    loading, saving, error, pickerOpen, setPickerOpen,
    pickCompany, removeCompany, updateNote, save, reload, countForRegion,
  };
}

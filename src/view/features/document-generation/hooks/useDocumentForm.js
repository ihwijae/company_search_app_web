import { useEffect, useState } from 'react';
import { companyFromSearch, createDocumentForm, documentSnapshot, normalizeDocumentForm } from '../documentForm.js';
import { fetchCompanyManagement } from '../services/refreshCompanyManagement.js';

const DRAFT_KEY = 'company_search_app:document-generation:tab-draft:v1';

function loadDraft() {
  const defaults = createDocumentForm();
  const empty = { form: defaults, record: null, savedSnapshot: documentSnapshot(defaults) };
  try {
    const draft = JSON.parse(window.sessionStorage.getItem(DRAFT_KEY));
    const form = draft?.form || draft;
    if (!form || !Array.isArray(form.companies) || form.companies.length !== 5) return empty;
    if (![2, 3, 4, 5].includes(form.companyCount)) return empty;
    return {
      form: normalizeDocumentForm(form),
      record: draft.record || null,
      savedSnapshot: typeof draft.savedSnapshot === 'string' ? documentSnapshot(normalizeDocumentForm(JSON.parse(draft.savedSnapshot))) : empty.savedSnapshot,
    };
  } catch {
    return empty;
  }
}

export default function useDocumentForm({ notify, confirm }) {
  const [draft, setDraft] = useState(loadDraft);
  const { form, record, savedSnapshot } = draft;
  const setForm = (updateForm) => setDraft((previous) => ({ ...previous, form: typeof updateForm === 'function' ? updateForm(previous.form) : updateForm }));
  const [pickerIndex, setPickerIndex] = useState(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const [managementLoadingIndex, setManagementLoadingIndex] = useState(null);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setDraftSaved(true);
    } catch {
      setDraftSaved(false);
    }
  }, [draft]);

  const update = (key, value) => setDraft((previous) => ({
    ...previous,
    form: normalizeDocumentForm({ ...previous.form, [key]: value }),
  }));
  const updateCompany = (index, key, value) => setForm((previous) => ({
    ...previous,
    companies: previous.companies.map((company, companyIndex) => companyIndex === index ? { ...company, [key]: value } : company),
  }));

  const refreshManagement = async (index) => {
    if (managementLoadingIndex !== null) return;
    const company = form.companies[index];
    if (!company.name) return;
    if (await confirm({ title: '경영상태 정보를 다시 가져올까요?', message: '부채비율·유동비율·영업기간·신용평가만 최신 조회정보로 교체합니다. 직접 수정한 경영정보도 교체되며, 대표자·주소·참여비율 등 나머지 정보는 유지됩니다.', confirmText: '불러오기' })) {
      setManagementLoadingIndex(index);
      try {
        const fields = await fetchCompanyManagement(company, form.industry);
        setForm((previous) => ({
          ...previous,
          companies: previous.companies.map((current, row) => row === index && current.name === company.name && current.bizNo === company.bizNo ? { ...current, ...fields } : current),
        }));
        notify({ message: '업체의 경영상태 정보를 불러왔습니다.', type: 'success' });
      } catch (error) {
        notify({ message: error.message || '경영상태 정보를 불러오지 못했습니다.', type: 'error' });
      } finally {
        setManagementLoadingIndex(null);
      }
    }
  };

  const changeIndustry = async (industry) => {
    if (industry === form.industry) return;
    if (form.companies.some((company) => Object.values(company).some(Boolean))) {
      if (!await confirm({ title: '공종을 변경할까요?', message: '공종을 변경하면 대표사와 구성사 입력정보가 초기화됩니다. 공고 기본정보는 유지됩니다.', confirmText: '공종 변경' })) return;
    }
    setPickerIndex(null);
    setDraft((previous) => ({ ...previous, form: { ...previous.form, industry, companies: createDocumentForm().companies } }));
  };

  const pickCompany = async (candidate) => {
    if (pickerIndex === null) return;
    const next = companyFromSearch(candidate);
    const normalize = (value) => value.replace(/\D/g, '');
    const duplicate = form.companies.slice(0, form.companyCount).some((company, index) => index !== pickerIndex && (
      next.bizNo && company.bizNo ? normalize(next.bizNo) === normalize(company.bizNo) : next.name && next.name === company.name
    ));
    if (duplicate) {
      notify({ message: '이미 선택한 업체입니다. 다른 업체를 선택해 주세요.', type: 'warning' });
      return;
    }
    if (Object.values(form.companies[pickerIndex]).some(Boolean)) {
      if (!await confirm({ title: '업체정보를 불러올까요?', message: '이 카드의 기존 업체 상세정보를 조회한 업체정보로 교체합니다. 참여비율과 작성자는 유지됩니다.', confirmText: '불러오기' })) return;
    }
    setForm((previous) => ({
      ...previous,
      companies: previous.companies.map((company, index) => index === pickerIndex ? { ...next, share: company.share, writer: company.writer } : company),
    }));
    setPickerIndex(null);
  };

  const reset = async () => {
    if (await confirm({ title: '새 서류를 작성할까요?', message: '현재 입력한 공고와 모든 업체정보를 초기화합니다.', confirmText: '새로 작성' })) {
      setPickerIndex(null);
      const nextForm = createDocumentForm();
      setDraft({ form: nextForm, record: null, savedSnapshot: documentSnapshot(nextForm) });
    }
  };

  const acceptLoaded = (document) => {
    const { form: loadedForm, ...metadata } = document;
    setPickerIndex(null);
    const normalized = normalizeDocumentForm(loadedForm);
    setDraft({ form: normalized, record: metadata, savedSnapshot: documentSnapshot(normalized) });
  };
  const markSaved = (document, submittedForm) => {
    const { form: savedForm, ...metadata } = document;
    setDraft((previous) => ({
      ...previous,
      form: documentSnapshot(previous.form) === documentSnapshot(submittedForm) ? savedForm : previous.form,
      record: metadata,
      savedSnapshot: documentSnapshot(savedForm),
    }));
  };

  const acceptDeleted = (id) => setDraft((previous) => previous.record?.id === id
    ? { ...previous, record: null, savedSnapshot: documentSnapshot(createDocumentForm()) }
    : previous);

  const savedExperience = record?.evaluationSnapshot;
  const qualityNeedsSave = Boolean(form.ownerId === 'LH' && form.reviewType === 'qualification' && form.rangeId === 'lh-50to100'
    && savedExperience?.scope.ownerId === form.ownerId && savedExperience.scope.rangeId === form.rangeId
    && savedExperience.scope.industry === form.industry && savedExperience.criteria.qualityAggregation !== 'weighted-grade');

  return { form, record, dirty: qualityNeedsSave || documentSnapshot(form) !== savedSnapshot, update, updateCompany, changeIndustry, pickerIndex, setPickerIndex, pickCompany, reset, draftSaved, acceptLoaded, acceptDeleted, markSaved, refreshManagement, managementLoadingIndex };
}

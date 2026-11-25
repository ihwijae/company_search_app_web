import { useState } from 'react';
import documentGenerationClient from '../../../../shared/documentGenerationClient.js';

export default function useDocumentLibrary({ state, notify, confirm }) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openingId, setOpeningId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');

  const reload = async () => {
    setLoading(true);
    setError('');
    try {
      setDocuments(await documentGenerationClient.list());
    } catch (failure) {
      setError(failure.message || '저장된 서류 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const openLibrary = () => {
    setLoadOpen(true);
    reload();
  };

  const save = async (title, asNew) => {
    if (saving) return;
    setSaving(true);
    setSaveError('');
    const submittedForm = state.form;
    try {
      const document = await documentGenerationClient.save({
        title, form: submittedForm,
        ...(!asNew && state.record ? { id: state.record.id, revision: state.record.revision } : {}),
        ...(asNew && state.record ? { sourceId: state.record.id, sourceRevision: state.record.revision } : {}),
      });
      state.markSaved(document, submittedForm);
      setSaveOpen(false);
      notify({ message: '서류 입력정보를 서버에 저장했습니다.', type: 'success' });
    } catch (failure) {
      setSaveError(failure.message || '서류를 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const load = async (id) => {
    if (openingId || deletingId) return;
    if (state.dirty && !await confirm({ title: '저장된 서류를 불러올까요?', message: '현재 저장하지 않은 변경사항이 있습니다. 불러오면 현재 입력 내용이 교체됩니다.', confirmText: '불러오기' })) return;
    setOpeningId(id);
    setError('');
    try {
      const document = await documentGenerationClient.load(id);
      state.acceptLoaded(document);
      setLoadOpen(false);
      notify({ message: '저장 당시의 공고와 업체정보를 불러왔습니다.', type: 'success' });
    } catch (failure) {
      setError(failure.message || '서류를 불러오지 못했습니다.');
    } finally {
      setOpeningId(null);
    }
  };

  const remove = async (document) => {
    if (deletingId || openingId || loading) return;
    setDeletingId(document.id);
    try {
      const current = state.record?.id === document.id;
      if (!await confirm({
        title: '저장된 서류를 삭제할까요?',
        message: `‘${document.title}’ 서류를 보관함에서 삭제합니다. 삭제한 서류는 복구할 수 없습니다.${current ? ' 현재 화면의 입력내용은 유지되며, 다시 저장하면 새 문서로 저장됩니다.' : ''}`,
        confirmText: '서류 삭제', cancelText: '취소',
      })) return;
      await documentGenerationClient.remove(document.id, document.revision);
      setDocuments((previous) => previous.filter((item) => item.id !== document.id));
      state.acceptDeleted(document.id);
      notify({ message: '저장된 서류를 삭제했습니다.', type: 'success' });
    } catch (failure) {
      notify({ message: failure.message || '서류를 삭제하지 못했습니다.', type: 'error' });
    } finally {
      setDeletingId(null);
    }
  };

  return {
    saveOpen, loadOpen, documents, loading, saving, openingId, deletingId, error, saveError,
    openSave: () => { setSaveError(''); setSaveOpen(true); }, closeSave: () => { if (!saving) setSaveOpen(false); },
    openLibrary, closeLibrary: () => { if (!openingId && !deletingId) setLoadOpen(false); }, reload, save, load, remove,
  };
}

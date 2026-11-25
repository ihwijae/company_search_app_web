import { useCallback, useEffect, useState } from 'react';
import { createMajorMaterials, MAX_MAJOR_MATERIAL_SUPPLIERS } from '../../../../shared/majorMaterials.js';
import majorMaterialsClient from '../../../../shared/majorMaterialsClient.js';

export default function useMajorMaterials({ notify, confirm, onClose }) {
  const [settings, setSettings] = useState(createMajorMaterials);
  const [savedItems, setSavedItems] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dirty = loaded && JSON.stringify(settings.items) !== savedItems;

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const next = await majorMaterialsClient.load();
      setSettings(next);
      setSavedItems(JSON.stringify(next.items));
      setLoaded(true);
    } catch (failure) {
      setError(failure.message || '주요자재 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const updateSupplier = (groupId, index, field, value) => setSettings((previous) => ({
    ...previous,
    items: { ...previous.items, [groupId]: previous.items[groupId].map((supplier, row) => row === index ? { ...supplier, [field]: value } : supplier) },
  }));

  const removeSupplier = (groupId, index) => setSettings((previous) => ({
    ...previous,
    items: { ...previous.items, [groupId]: previous.items[groupId].filter((supplier, row) => row !== index) },
  }));

  const addSupplier = (groupId) => setSettings((previous) => {
    if (previous.items[groupId].length >= MAX_MAJOR_MATERIAL_SUPPLIERS) return previous;
    return {
      ...previous,
      items: { ...previous.items, [groupId]: [...previous.items[groupId], { companyName: '', address: '' }] },
    };
  });

  const save = async () => {
    if (!loaded || loading || saving) return;
    setSaving(true);
    setError('');
    try {
      const next = await majorMaterialsClient.save(settings.items, settings.revision);
      setSettings(next);
      setSavedItems(JSON.stringify(next.items));
      notify({ message: '주요자재 업체명과 주소를 저장했습니다.', type: 'success' });
    } catch (failure) {
      setError(failure.message || '주요자재 정보를 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const close = async () => {
    if (saving) return;
    if (dirty && !await confirm({ title: '주요자재 설정을 닫을까요?', message: '저장하지 않은 업체명·주소 변경사항이 있습니다. 닫으면 변경사항이 사라집니다.', confirmText: '닫기' })) return;
    onClose();
  };

  const reloadWithConfirm = async () => {
    if (saving || loading) return;
    if (dirty && !await confirm({ title: '저장된 설정을 다시 불러올까요?', message: '현재 수정 중인 주요자재 정보를 서버에 저장된 내용으로 교체합니다.', confirmText: '다시 불러오기' })) return;
    await reload();
  };

  return { settings, dirty, loaded, loading, saving, error, updateSupplier, removeSupplier, addSupplier, save, close, reload: reloadWithConfirm };
}

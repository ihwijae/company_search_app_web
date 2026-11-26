import { useRef, useState } from 'react';
import { buildProjectFolderPlan, buildVendorFolderEntries, createProjectVendorFolders } from '../services/vendorFolders.js';

export default function useVendorFolders(showStatusMessage) {
  const [directory, setDirectory] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [result, setResult] = useState(null);
  const lock = useRef(false);
  const supported = typeof window !== 'undefined' && window.isSecureContext
    && typeof window.showDirectoryPicker === 'function';

  const selectDirectory = async () => {
    if (!supported || lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const selected = await window.showDirectoryPicker({ mode: 'readwrite', id: 'mail-vendor-folders' });
      setDirectory(selected);
      setResult(null);
      setProgress({ processed: 0, total: 0 });
    } catch (error) {
      if (error.name !== 'AbortError') {
        showStatusMessage('저장 폴더를 선택하지 못했습니다. 폴더 접근 권한을 확인해 주세요.', { type: 'error' });
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const generate = async (recipients, { fileName, profileName, profileError } = {}) => {
    if (!directory || lock.current) return;
    const plan = buildProjectFolderPlan(fileName, profileName);
    if (profileError || plan.error) {
      showStatusMessage(profileError || plan.error, { type: 'warning' });
      return;
    }
    const entries = buildVendorFolderEntries(recipients);
    if (!entries.length) {
      showStatusMessage('폴더를 생성할 업체명이 없습니다.', { type: 'warning' });
      return;
    }
    lock.current = true;
    setBusy(true);
    setResult(null);
    setProgress({ processed: 0, total: entries.length });
    try {
      let permission = await directory.queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        permission = await directory.requestPermission({ mode: 'readwrite' });
      }
      if (permission !== 'granted') {
        throw new Error('저장 폴더의 쓰기 권한이 필요합니다. 저장 폴더를 다시 선택한 뒤 폴더 생성 버튼을 눌러 주세요.');
      }
      const nextResult = await createProjectVendorFolders(directory, plan.parentName, entries, (processed) => {
        setProgress({ processed, total: entries.length });
      });
      setResult(nextResult);
      showStatusMessage(
        `공고 폴더 ${nextResult.parentCreated ? '생성' : '사용'} 완료 · 업체 폴더: 생성 ${nextResult.created}개 / 기존 ${nextResult.existing}개 / 실패 ${nextResult.failures.length}개`,
        { type: nextResult.failures.length ? 'warning' : 'success' },
      );
    } catch (error) {
      const message = error.message || '폴더를 생성하지 못했습니다.';
      setResult({ error: message });
      showStatusMessage(message, { type: 'error' });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return { supported, directory, busy, progress, result, selectDirectory, generate };
}

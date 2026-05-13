import React from 'react';
import '../../../../styles.css';
import '../../../../fonts.css';
import Sidebar from '../../../../components/Sidebar';
import excelEditBackendClient from '../../../../shared/excelEditBackendClient';
import { useFeedback } from '../../../../components/FeedbackProvider.jsx';

const EXCEL_WEB_STATE_KEY = 'excel-web-edit:state:v1';
let excelWebPageMemoryState = null;

const FIELD_LABELS = [
  ['companyName', '상호'],
  ['managerName', '대표자'],
  ['bizNo', '사업자등록번호'],
  ['region', '지역'],
  ['sipyung', '시평액'],
  ['perf3y', '3년실적'],
  ['perf5y', '5년실적'],
  ['debtRatio', '부채비율'],
  ['currentRatio', '유동비율'],
  ['bizYears', '영업기간'],
  ['creditText', '신용평가'],
  ['womenOwned', '여성기업'],
  ['smallBusiness', '중소기업'],
  ['jobCreation', '일자리창출실적'],
  ['qualityEval', '시공품질평가'],
  ['note', '비고'],
];

const EMPTY_FORM = {
  companyName: '',
  managerName: '',
  bizNo: '',
  region: '',
  sipyung: '',
  perf3y: '',
  perf5y: '',
  debtRatio: '',
  currentRatio: '',
  bizYears: '',
  creditGrade: '',
  creditStartDate: '',
  creditEndDate: '',
  womenOwned: '',
  smallBusiness: '',
  jobCreation: '',
  qualityEval: '',
  note: '',
};

const EDITOR_MODE = {
  MANAGEMENT: 'management',
  CREDIT: 'credit',
};

const MANAGEMENT_FILE_TYPES = ['전기경영상태', '통신경영상태', '소방경영상태'];
const MANAGEMENT_FILE_TYPE_COLORS = {
  전기경영상태: '#ca8a04',
  통신경영상태: '#0284c7',
  소방경영상태: '#dc2626',
};
const REGION_OPTIONS = ['서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];

function buildCreditText(form) {
  const grade = String(form.creditGrade || '').trim();
  const start = String(form.creditStartDate || '').trim();
  const end = String(form.creditEndDate || '').trim();
  if (!grade && !start && !end) return '';
  if (!grade) return `${start || '?'}~${end || '?'}`;
  if (!start && !end) return grade;
  return `${grade}\n(${start || '?'}~${end || '?'})`;
}

function formatBizNoInput(value = '') {
  const digits = String(value).replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

function formatAmountInput(value = '') {
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('ko-KR');
}

function formatPercentInput(value = '') {
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';
  const numeric = Number(digits) / 100;
  return `${numeric.toFixed(2)}%`;
}

function formatDotDateInput(value = '') {
  const digits = String(value).replace(/\D/g, '').slice(0, 8);
  if (!digits) return '';
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}.${digits.slice(4)}`;
  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6)}`;
}

function formatAmountPreviewValue(value = '') {
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';
  return (Number(digits) * 1000).toLocaleString('ko-KR');
}

function buildCreditLookupPreview(loadedData) {
  if (!loadedData) return '';
  const companyName = String(loadedData.companyName || '').trim();
  const bizNo = String(loadedData.bizNo || '').trim();
  const creditText = String(loadedData.creditText || '').trim();
  const header = companyName
    ? `${companyName}${bizNo ? ` [${bizNo}]` : ''}`
    : (bizNo ? `[${bizNo}]` : '');
  return [header, creditText].filter(Boolean).join('\n');
}

export default function ExcelWebEditPage() {
  const { notify } = useFeedback();
  const [activeMenu, setActiveMenu] = React.useState('excel-web-edit');
  const [fileType, setFileType] = React.useState('전기경영상태');
  const [editorMode, setEditorMode] = React.useState(EDITOR_MODE.MANAGEMENT);
  const [sourceFiles, setSourceFiles] = React.useState([]);
  const [selectedFileId, setSelectedFileId] = React.useState('');
  const [loadedData, setLoadedData] = React.useState(null);
  const [loadedColorMap, setLoadedColorMap] = React.useState({});
  const [lookupVersion, setLookupVersion] = React.useState('');
  const [form, setForm] = React.useState(EMPTY_FORM);
  const sourceFilesRef = React.useRef([]);
  const [pdfPageNumber, setPdfPageNumber] = React.useState(1);
  const [pdfLoading, setPdfLoading] = React.useState(false);
  const [pdfError, setPdfError] = React.useState('');
  const [previewZoom, setPreviewZoom] = React.useState(1);
  const [previewRotation, setPreviewRotation] = React.useState(0);
  const [isBackendBusy, setIsBackendBusy] = React.useState(false);
  const [backendStatusMessage, setBackendStatusMessage] = React.useState('');
  const [backendPreviewUrl, setBackendPreviewUrl] = React.useState('');
  const [backendPdfPageCount, setBackendPdfPageCount] = React.useState(0);
  const [backendPdfLoading, setBackendPdfLoading] = React.useState(false);
  const [isMultiPageNoticeOpen, setIsMultiPageNoticeOpen] = React.useState(false);
  const [multiPageNotice, setMultiPageNotice] = React.useState({ fileName: '', pageCount: 0 });
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = React.useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = React.useState(false);
  const [isPdfExportModalOpen, setIsPdfExportModalOpen] = React.useState(false);
  const [pdfExportPages, setPdfExportPages] = React.useState('');
  const [pdfExportFileName, setPdfExportFileName] = React.useState('');
  const [isMissingCompanyModalOpen, setIsMissingCompanyModalOpen] = React.useState(false);
  const [missingCompanyMode, setMissingCompanyMode] = React.useState('management');
  const [isCompanySetupModalOpen, setIsCompanySetupModalOpen] = React.useState(false);
  const [companySetupMode, setCompanySetupMode] = React.useState('register');
  const [companySetupDraft, setCompanySetupDraft] = React.useState({ companyName: '', sheetName: '', region: '' });
  const lastPdfErrorRef = React.useRef('');
  const multiPageNoticedFileIdsRef = React.useRef(new Set());
  const didHydrateRef = React.useRef(false);
  const previewAbortControllerRef = React.useRef(null);
  const skipNextPdfPageEffectRef = React.useRef(false);

  const notifyInfo = React.useCallback((message) => {
    if (!message) return;
    notify({ type: 'info', title: '알림', message });
  }, [notify]);

  const notifyError = React.useCallback((message) => {
    if (!message) return;
    notify({ type: 'error', title: '오류', message, duration: 4800 });
  }, [notify]);

  const selectedFile = React.useMemo(
    () => sourceFiles.find((file) => file.id === selectedFileId) || null,
    [selectedFileId, sourceFiles],
  );

  const previewSrc = selectedFile?.url || '';
  const isPdf = selectedFile?.type?.includes('pdf') || selectedFile?.name?.toLowerCase().endsWith('.pdf');
  const effectivePdfPageCount = isPdf ? backendPdfPageCount : 1;
  const finalCreditText = buildCreditText(form);
  const creditLookupPreview = React.useMemo(() => buildCreditLookupPreview(loadedData), [loadedData]);

  const mergedAfterData = React.useMemo(() => {
    if (!loadedData) return null;
    const next = { ...loadedData };
    Object.keys(form).forEach((key) => {
      if (['creditGrade', 'creditStartDate', 'creditEndDate'].includes(key)) return;
      const value = String(form[key] || '').trim();
      if (!value) return;
      if (['sipyung', 'perf3y', 'perf5y'].includes(key)) {
        next[key] = formatAmountPreviewValue(value);
        return;
      }
      next[key] = value;
    });
    if (finalCreditText) next.creditText = finalCreditText;
    return next;
  }, [finalCreditText, form, loadedData]);

  const onSelectMenu = React.useCallback((key) => {
    setActiveMenu(key);
    if (key === 'search') window.location.hash = '#/search';
    else if (key === 'records') window.location.hash = '#/records';
    else if (key === 'mail') window.location.hash = '#/mail';
    else if (key === 'agreements') window.location.hash = '#/agreement-board';
    else if (key === 'agreements-sms') window.location.hash = '#/agreements';
    else if (key === 'auto-agreement') window.location.hash = '#/auto-agreement';
    else if (key === 'excel-helper') window.location.hash = '#/excel-helper';
    else if (key === 'bid-result') window.location.hash = '#/bid-result';
    else if (key === 'kakao-send') window.location.hash = '#/kakao-send';
    else if (key === 'company-notes') window.location.hash = '#/company-notes';
    else if (key === 'settings') window.location.hash = '#/settings';
  }, []);

  const handleSourceUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    try {
      setIsBackendBusy(true);
      setBackendStatusMessage('스캔본을 서버 임시폴더에 업로드하는 중입니다.');
      const result = await excelEditBackendClient.uploadFiles({ files, fileType });
      const uploaded = Array.isArray(result?.data?.files) ? result.data.files : [];
      let firstAddedId = '';
      const nextFiles = uploaded.map((item, index) => {
        const sourceFile = files[index] || null;
        const id = item.uploadId || `${Date.now()}-${item.originalName || sourceFile?.name || 'file'}-${Math.random().toString(36).slice(2, 7)}`;
        if (!firstAddedId) firstAddedId = id;
        return {
          id,
          uploadId: item.uploadId || '',
          file: sourceFile,
          name: item.originalName || sourceFile?.name || item.savedName || 'file.pdf',
          type: item.contentType || sourceFile?.type || '',
          size: item.size || sourceFile?.size || 0,
          url: sourceFile
            ? URL.createObjectURL(sourceFile)
            : excelEditBackendClient.getTempUploadContentUrl(item.uploadId),
        };
      });

      const oldUploadIds = sourceFilesRef.current.map((item) => item.uploadId).filter(Boolean);
      sourceFilesRef.current.forEach((file) => {
        if (file.url?.startsWith('blob:')) {
          try { URL.revokeObjectURL(file.url); } catch (error) { void error; }
        }
      });
      if (oldUploadIds.length) void excelEditBackendClient.deleteTempUploads(oldUploadIds);

      setSourceFiles(nextFiles);
      setSelectedFileId(firstAddedId);
      setLoadedData(null);
      setLoadedColorMap({});
      setLookupVersion('');
      setForm(EMPTY_FORM);
      setPdfPageNumber(1);
      setPdfError('');
      notifyInfo(`임시 업로드 완료 (${nextFiles.length}건)`);
    } catch (error) {
      notifyError(error?.message || '임시 업로드에 실패했습니다.');
    } finally {
      setIsBackendBusy(false);
      setBackendStatusMessage('');
      event.target.value = '';
    }
  };

  React.useEffect(() => {
    if (!sourceFiles.length) {
      setSelectedFileId('');
      return;
    }
    if (selectedFileId && sourceFiles.some((file) => file.id === selectedFileId)) return;
    setSelectedFileId(sourceFiles[0].id);
  }, [selectedFileId, sourceFiles]);

  React.useEffect(() => {
    setPreviewZoom(1);
    setPreviewRotation(0);
  }, [selectedFileId]);

  React.useEffect(() => {
    sourceFilesRef.current = sourceFiles;
  }, [sourceFiles]);

  React.useEffect(() => {
    if (didHydrateRef.current) return;
    didHydrateRef.current = true;

    const memory = excelWebPageMemoryState;
    let persisted = null;
    try {
      const raw = window.sessionStorage.getItem(EXCEL_WEB_STATE_KEY);
      persisted = raw ? JSON.parse(raw) : null;
    } catch (error) {
      persisted = null;
    }

    const state = persisted || memory;
    const sourceState = Array.isArray(state?.sourceFiles) ? state.sourceFiles : [];
    const sourceFromState = sourceState
      .filter((item) => item?.uploadId)
      .map((item) => ({
        id: item.id || item.uploadId,
        uploadId: item.uploadId,
        file: null,
        name: item.name || item.originalName || item.savedName || 'file.pdf',
        type: item.type || item.contentType || '',
        size: item.size || 0,
        url: excelEditBackendClient.getTempUploadContentUrl(item.uploadId),
      }));
    const sourceFromMemory = Array.isArray(memory?.sourceFiles)
      ? memory.sourceFiles
        .filter((item) => item?.file)
        .map((item) => ({
          id: item.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          uploadId: item.uploadId || '',
          file: item.file,
          name: item.name || item.file?.name || 'file.pdf',
          type: item.type || item.file?.type || '',
          size: item.size || item.file?.size || 0,
          url: URL.createObjectURL(item.file),
        }))
      : [];
    const restoredSources = sourceFromState.length ? sourceFromState : sourceFromMemory;

    if (restoredSources.length) {
      setSourceFiles(restoredSources);
      setSelectedFileId(
        restoredSources.some((item) => item.id === state?.selectedFileId)
          ? state.selectedFileId
          : restoredSources[0].id,
      );
    }

    if (!state) return;
    if (state.fileType) setFileType(state.fileType);
    if (state.editorMode) setEditorMode(state.editorMode);
    if (state.form) setForm((prev) => ({ ...prev, ...state.form }));
    if (state.loadedData) setLoadedData(state.loadedData);
    if (state.loadedColorMap) setLoadedColorMap(state.loadedColorMap);
    if (state.lookupVersion) setLookupVersion(state.lookupVersion);
    if (typeof state.pdfPageNumber === 'number') setPdfPageNumber(Math.max(1, state.pdfPageNumber));
    if (typeof state.previewZoom === 'number') setPreviewZoom(Math.max(0.5, state.previewZoom));
    if (typeof state.previewRotation === 'number') setPreviewRotation(state.previewRotation % 360);
  }, []);

  React.useEffect(() => {
    if (!didHydrateRef.current) return;
    const serializable = {
      fileType,
      editorMode,
      selectedFileId,
      loadedData,
      loadedColorMap,
      lookupVersion,
      form,
      pdfPageNumber,
      previewZoom,
      previewRotation,
      sourceFiles: sourceFiles.map((item) => ({
        id: item.id,
        uploadId: item.uploadId || '',
        name: item.name,
        type: item.type,
        size: item.size || 0,
      })).filter((item) => item.uploadId),
    };
    excelWebPageMemoryState = {
      ...serializable,
      sourceFiles: sourceFiles.map((item) => ({
        id: item.id,
        uploadId: item.uploadId || '',
        file: item.file,
        name: item.name,
        type: item.type,
        size: item.size || 0,
      })),
    };
    try {
      window.sessionStorage.setItem(EXCEL_WEB_STATE_KEY, JSON.stringify(serializable));
    } catch (error) {
      void error;
    }
  }, [
    editorMode,
    fileType,
    form,
    loadedColorMap,
    loadedData,
    lookupVersion,
    pdfPageNumber,
    previewRotation,
    previewZoom,
    selectedFileId,
    sourceFiles,
  ]);

  React.useEffect(() => () => {
    if (!backendPreviewUrl) return;
    if (backendPreviewUrl.startsWith('blob:')) {
      try { URL.revokeObjectURL(backendPreviewUrl); } catch (error) { void error; }
    }
  }, [backendPreviewUrl]);

  React.useEffect(() => {
    return () => {
      if (previewAbortControllerRef.current) {
        previewAbortControllerRef.current.abort();
        previewAbortControllerRef.current = null;
      }
      sourceFilesRef.current.forEach((file) => {
        if (file.url?.startsWith('blob:')) {
          try { URL.revokeObjectURL(file.url); } catch (error) { void error; }
        }
      });
    };
  }, []);

  const removeSourceFile = React.useCallback((id) => {
    setSourceFiles((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) {
        if (target.url?.startsWith('blob:')) {
          try { URL.revokeObjectURL(target.url); } catch (error) { void error; }
        }
        if (target.uploadId) void excelEditBackendClient.deleteTempUploads([target.uploadId]);
      }
      return prev.filter((item) => item.id !== id);
    });
  }, []);

  const handleInput = (event) => {
    const { name } = event.target;
    let { value } = event.target;
    const inputType = event.nativeEvent?.inputType;

    if (name === 'bizNo') {
      value = formatBizNoInput(value);
      setLookupVersion('');
    } else if (['sipyung', 'perf3y', 'perf5y'].includes(name)) {
      value = formatAmountInput(value);
    } else if (['debtRatio', 'currentRatio'].includes(name)) {
      setForm((prev) => {
        const prevValue = String(prev[name] || '');
        const isDeletingPercentSuffix =
          inputType === 'deleteContentBackward'
          && prevValue.endsWith('%')
          && value === prevValue.slice(0, -1);

        const nextValue = isDeletingPercentSuffix
          ? formatPercentInput(prevValue.replace(/\D/g, '').slice(0, -1))
          : formatPercentInput(value);

        return { ...prev, [name]: nextValue };
      });
      return;
    } else if (['creditStartDate', 'creditEndDate', 'bizYears'].includes(name)) {
      value = formatDotDateInput(value);
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const changePreviewZoom = React.useCallback((delta) => {
    setPreviewZoom((prev) => Math.max(0.5, Number((prev + delta).toFixed(2))));
  }, []);

  const resetPreviewZoom = React.useCallback(() => {
    setPreviewZoom(1);
  }, []);

  const rotatePreview = React.useCallback((delta) => {
    setPreviewRotation((prev) => (prev + delta + 360) % 360);
  }, []);

  const resetPreviewRotation = React.useCallback(() => {
    setPreviewRotation(0);
  }, []);

  const handlePreviewWheel = React.useCallback((event) => {
    if (!event.ctrlKey) return;
    const direction = event.deltaY < 0 ? 1 : -1;
    changePreviewZoom(direction * 0.1);
  }, [changePreviewZoom]);

  const handleOpenPdfExportModal = React.useCallback(() => {
    if ((!selectedFile?.file && !selectedFile?.uploadId) || !isPdf) {
      notifyError('PDF 파일을 먼저 선택하세요.');
      return;
    }
    const base = String(selectedFile.name || 'pdf').replace(/\.pdf$/i, '');
    setPdfExportPages(String(pdfPageNumber || 1));
    setPdfExportFileName(`${base}_페이지내보내기.pdf`);
    setIsPdfExportModalOpen(true);
  }, [isPdf, notifyError, pdfPageNumber, selectedFile]);

  const handleExportPdfPages = React.useCallback(async () => {
    if ((!selectedFile?.file && !selectedFile?.uploadId) || !isPdf) {
      notifyError('PDF 파일을 먼저 선택하세요.');
      return;
    }
    const pages = String(pdfExportPages || '').trim();
    if (!pages) {
      notifyError('내보낼 페이지 범위를 입력하세요. 예: 1,3-5');
      return;
    }
    let fileName = String(pdfExportFileName || '').trim();
    if (!fileName) {
      notifyError('내보낼 파일명을 입력하세요.');
      return;
    }
    if (!/\.pdf$/i.test(fileName)) fileName = `${fileName}.pdf`;
    try {
      setIsBackendBusy(true);
      const result = await excelEditBackendClient.exportPdfPages({
        file: selectedFile.uploadId ? null : selectedFile.file,
        uploadId: selectedFile.uploadId || '',
        pages,
      });
      const blobUrl = URL.createObjectURL(result.blob);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(blobUrl);

      const remaining = await excelEditBackendClient.removePdfPages({
        file: selectedFile.uploadId ? null : selectedFile.file,
        uploadId: selectedFile.uploadId || '',
        pages,
      });

      if (!remaining.blob || (remaining.pageCount || 0) <= 0) {
        removeSourceFile(selectedFile.id);
        notifyInfo(`PDF 페이지 내보내기 완료 (${result.pageCount || 0}p), 원본 파일은 모두 비워져 목록에서 제거되었습니다.`);
      } else {
        const nextFile = new File([remaining.blob], selectedFile.name, { type: 'application/pdf' });
        setSourceFiles((prev) => prev.map((item) => {
          if (item.id !== selectedFile.id) return item;
          if (item.url?.startsWith('blob:')) {
            try { URL.revokeObjectURL(item.url); } catch (error) { void error; }
          }
          return {
            ...item,
            file: selectedFile.uploadId ? null : nextFile,
            type: 'application/pdf',
            size: remaining.blob.size,
            url: selectedFile.uploadId
              ? `${excelEditBackendClient.getTempUploadContentUrl(selectedFile.uploadId)}?t=${Date.now()}`
              : URL.createObjectURL(nextFile),
          };
        }));
        notifyInfo(`PDF 페이지 내보내기 완료 (${result.pageCount || 0}p), 원본에서 해당 페이지를 삭제했습니다.`);
      }
      setIsPdfExportModalOpen(false);
    } catch (error) {
      notifyError(error?.message || 'PDF 페이지 내보내기에 실패했습니다.');
    } finally {
      setIsBackendBusy(false);
    }
  }, [isPdf, notifyError, notifyInfo, pdfExportFileName, pdfExportPages, removeSourceFile, selectedFile]);

  const handleLoadData = async () => {
    const bizNo = String(form.bizNo || '').trim();
    if (!bizNo) {
      notifyError('사업자등록번호를 먼저 입력하세요.');
      return;
    }

    try {
      setIsBackendBusy(true);
      const result = await excelEditBackendClient.lookupCompany({ fileType, bizNo });
      if (!result?.data?.found) {
        setLoadedData(null);
        setLoadedColorMap({});
        setLookupVersion(String(result?.data?.version || ''));
        setMissingCompanyMode(editorMode === EDITOR_MODE.CREDIT ? 'credit' : 'management');
        setIsMissingCompanyModalOpen(true);
        return;
      }

      const company = result.data.company || {};
      const colorMap = result.data.colorMap || {};

      setLoadedData(company);
      setLoadedColorMap(colorMap);
      setLookupVersion(String(result?.data?.version || ''));
      setForm((prev) => ({
        ...EMPTY_FORM,
        bizNo: prev.bizNo || bizNo,
      }));
      notifyInfo('사업자번호 조회가 완료되었습니다.');
    } catch (error) {
      notifyError(error?.message || '사업자번호 조회에 실패했습니다.');
    } finally {
      setIsBackendBusy(false);
    }
  };

  const handleBizNoKeyDown = React.useCallback((event) => {
    if (event.key !== 'Enter') return;
    if (event.nativeEvent?.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    if (isBackendBusy) return;
    handleLoadData();
  }, [handleLoadData, isBackendBusy]);

  React.useEffect(() => {
    if (editorMode === EDITOR_MODE.CREDIT && fileType !== '신용평가') {
      setFileType('신용평가');
      setLookupVersion('');
      return;
    }
    if (editorMode === EDITOR_MODE.MANAGEMENT && fileType === '신용평가') {
      setFileType('전기경영상태');
      setLookupVersion('');
    }
  }, [editorMode, fileType]);

  const handleYearEndUpdate = async () => {
    try {
      setIsBackendBusy(true);
      const result = await excelEditBackendClient.updateYearEndColor({
        fileType,
        dryRun: false,
      });
      if (fileType !== '신용평가') {
        await excelEditBackendClient.refreshUploadedDataset(fileType);
      }
      notifyInfo(result?.message || '연말 색상 업데이트 요청 완료');
    } catch (error) {
      notifyError(error?.message || '연말 색상 업데이트 요청 실패');
    } finally {
      setIsBackendBusy(false);
    }
  };

  const handleCreditExpiryUpdate = async () => {
    try {
      setIsBackendBusy(true);
      const result = await excelEditBackendClient.updateCreditExpiry({
        fileType,
        dryRun: false,
      });
      if (fileType === '신용평가') {
        await Promise.all([
          excelEditBackendClient.refreshUploadedDataset('전기경영상태'),
          excelEditBackendClient.refreshUploadedDataset('통신경영상태'),
          excelEditBackendClient.refreshUploadedDataset('소방경영상태'),
        ]);
      } else {
        await excelEditBackendClient.refreshUploadedDataset(fileType);
      }
      notifyInfo(result?.message || '신용평가 유효기간 갱신 요청 완료');
    } catch (error) {
      notifyError(error?.message || '신용평가 유효기간 갱신 요청 실패');
    } finally {
      setIsBackendBusy(false);
    }
  };

  const resetEditorState = React.useCallback(() => {
    const tempUploadIds = sourceFilesRef.current.map((file) => file.uploadId).filter(Boolean);
    if (tempUploadIds.length) void excelEditBackendClient.deleteTempUploads(tempUploadIds);
    sourceFilesRef.current.forEach((file) => {
      if (file.url?.startsWith('blob:')) {
        try { URL.revokeObjectURL(file.url); } catch (error) { void error; }
      }
    });
    setIsDeleteConfirmOpen(false);
    setSourceFiles([]);
    setSelectedFileId('');
    setLoadedData(null);
    setLoadedColorMap({});
    setLookupVersion('');
    setForm(EMPTY_FORM);
    setPdfPageNumber(1);
    setPdfError('');
    setBackendPdfPageCount(0);
    setBackendPdfLoading(false);
    setBackendPreviewUrl((prev) => {
      if (prev) {
        try { URL.revokeObjectURL(prev); } catch (error) { void error; }
      }
      return '';
    });
  }, []);

  const handleSave = async () => {
    const bizNo = String(form.bizNo || '').trim();
    if (!bizNo) {
      notifyError('사업자등록번호를 먼저 입력하세요.');
      return;
    }

    const companyName = String(form.companyName || loadedData?.companyName || '').trim();
    const region = String(form.region || loadedData?.region || '').trim();

    try {
      setIsBackendBusy(true);
      setBackendStatusMessage('엑셀에 반영하고 스캔본을 최종 보관 폴더로 이동하는 중입니다.');
      const payload = {
        fileType,
        bizNo,
        expectedVersion: lookupVersion,
        tempFiles: selectedFile?.uploadId ? [{
          uploadId: selectedFile.uploadId,
          originalName: selectedFile.name,
          contentType: selectedFile.type,
          size: selectedFile.size || 0,
        }] : [],
        data: {
          ...form,
          companyName,
          region,
          creditText: finalCreditText,
        },
      };
      const files = selectedFile?.file && !selectedFile?.uploadId ? [selectedFile.file] : [];
      const result = await excelEditBackendClient.saveData({ payload, files });
      setBackendStatusMessage('저장은 완료됐고, 검색용 데이터를 백그라운드로 갱신하는 중입니다.');
      const refreshPromise = fileType === '신용평가'
        ? Promise.all([
          excelEditBackendClient.refreshUploadedDataset('전기경영상태'),
          excelEditBackendClient.refreshUploadedDataset('통신경영상태'),
          excelEditBackendClient.refreshUploadedDataset('소방경영상태'),
        ])
        : excelEditBackendClient.refreshUploadedDataset(fileType);
      refreshPromise.catch((error) => {
        console.warn('[ExcelWebEditPage] dataset refresh failed after save:', error);
        notifyError('저장은 완료됐지만 업로드 DB 재색인에 실패했습니다. 검색 결과가 바로 갱신되지 않을 수 있습니다.');
      });
      const archiveCount = Array.isArray(result?.data?.archivedFiles) ? result.data.archivedFiles.length : 0;
      notifyInfo(`확정 및 저장 완료${archiveCount ? ` (파일 보관 ${archiveCount}건)` : ''}`);
      resetEditorState();
    } catch (error) {
      notifyError(error?.message || '확정 및 저장에 실패했습니다.');
    } finally {
      setIsBackendBusy(false);
      setBackendStatusMessage('');
    }
  };

  const handleDeleteCompany = async () => {
    const bizNo = String(form.bizNo || loadedData?.bizNo || '').trim();
    if (!bizNo) {
      notifyError('삭제할 업체의 사업자등록번호가 없습니다. 먼저 불러오기를 진행하세요.');
      return;
    }

    try {
      setIsBackendBusy(true);
      const result = await excelEditBackendClient.deleteCompany({
        fileType,
        bizNo,
        expectedVersion: lookupVersion,
      });
      await excelEditBackendClient.refreshUploadedDataset(fileType);
      notifyInfo(result?.message || '업체 삭제가 완료되었습니다.');
      setIsDeleteConfirmOpen(false);
      resetEditorState();
    } catch (error) {
      notifyError(error?.message || '업체 삭제에 실패했습니다.');
    } finally {
      setIsBackendBusy(false);
    }
  };

  const openCompanySetupModal = React.useCallback((mode) => {
    setCompanySetupMode(mode);
    const region = String(form.region || loadedData?.region || '').trim();
    setCompanySetupDraft({
      companyName: String(form.companyName || loadedData?.companyName || '').trim(),
      sheetName: mode === 'register' ? region : '',
      region,
    });
    setIsCompanySetupModalOpen(true);
  }, [form.companyName, form.region, loadedData?.companyName, loadedData?.region]);

  const saveArchiveOnlyWithDraft = React.useCallback(async ({ companyName, region }) => {
    if (!selectedFile?.file && !selectedFile?.uploadId) {
      notifyError('저장할 파일이 없습니다. 파일을 먼저 업로드하세요.');
      return false;
    }
    try {
      setIsBackendBusy(true);
      setBackendStatusMessage('스캔본을 최종 보관 폴더로 이동하는 중입니다.');
      const payload = {
        fileType,
        bizNo: String(form.bizNo || '').trim(),
        saveMode: 'archive_only',
        expectedVersion: lookupVersion,
        tempFiles: selectedFile?.uploadId ? [{
          uploadId: selectedFile.uploadId,
          originalName: selectedFile.name,
          contentType: selectedFile.type,
          size: selectedFile.size || 0,
        }] : [],
        data: { companyName, region },
      };
      const result = await excelEditBackendClient.saveData({
        payload,
        files: selectedFile?.file && !selectedFile?.uploadId ? [selectedFile.file] : [],
      });
      const archiveCount = Array.isArray(result?.data?.archivedFiles) ? result.data.archivedFiles.length : 0;
      notifyInfo(`파일만 저장 완료${archiveCount ? ` (${archiveCount}건)` : ''}`);
      resetEditorState();
      return true;
    } catch (error) {
      notifyError(error?.message || '파일만 저장에 실패했습니다.');
      return false;
    } finally {
      setIsBackendBusy(false);
      setBackendStatusMessage('');
    }
  }, [fileType, form.bizNo, lookupVersion, notifyError, notifyInfo, resetEditorState, selectedFile]);

  const handleConfirmCompanySetup = React.useCallback(async () => {
    const companyName = String(companySetupDraft.companyName || '').trim();
    const sheetName = String(companySetupDraft.sheetName || '').trim();
    const region = String(companySetupDraft.region || '').trim();
    if (!companyName) {
      notifyError('업체명을 입력하세요.');
      return;
    }
    if (companySetupMode === 'register' && !sheetName) {
      notifyError('저장할 시트를 선택하세요.');
      return;
    }
    if (!region) {
      notifyError('지역을 입력하세요.');
      return;
    }

    if (companySetupMode === 'register') {
      setForm((prev) => ({
        ...prev,
        companyName,
        sheetName,
        region,
      }));
      setIsCompanySetupModalOpen(false);
      notifyInfo('신규업체 등록 정보가 입력되었습니다. 나머지 값을 입력 후 확정 및 저장하세요.');
      return;
    }

    const archived = await saveArchiveOnlyWithDraft({ companyName, region });
    if (archived) {
      setIsCompanySetupModalOpen(false);
    }
  }, [companySetupDraft.companyName, companySetupDraft.region, companySetupDraft.sheetName, companySetupMode, notifyError, notifyInfo, saveArchiveOnlyWithDraft]);

  const clearBackendPdfPreview = React.useCallback(() => {
    if (previewAbortControllerRef.current) {
      previewAbortControllerRef.current.abort();
      previewAbortControllerRef.current = null;
    }
    setBackendPdfPageCount(0);
    setBackendPdfLoading(false);
    setBackendPreviewUrl((prev) => {
      if (prev?.startsWith('blob:')) {
        try { URL.revokeObjectURL(prev); } catch (error) { void error; }
      }
      return '';
    });
  }, []);

  React.useEffect(() => {
    clearBackendPdfPreview();
    setIsMultiPageNoticeOpen(false);
  }, [clearBackendPdfPreview, selectedFileId]);

  const renderBackendPdfPage = React.useCallback(async (pageNumber) => {
    if (!selectedFile?.file && !selectedFile?.uploadId) return false;
    if (previewAbortControllerRef.current) {
      previewAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    previewAbortControllerRef.current = controller;
    try {
      setBackendPdfLoading(true);
      const rendered = await excelEditBackendClient.renderPdfPage({
        file: selectedFile.uploadId ? null : selectedFile.file,
        uploadId: selectedFile.uploadId || '',
        page: pageNumber,
        signal: controller.signal,
      });
      if (previewAbortControllerRef.current !== controller) return false;
      const nextUrl = URL.createObjectURL(rendered.blob);
      setBackendPreviewUrl((prev) => {
        if (prev) {
          try { URL.revokeObjectURL(prev); } catch (error) { void error; }
        }
        return nextUrl;
      });
      setBackendPdfPageCount(rendered.pageCount || 0);
      if (
        pageNumber === 1
        && selectedFile?.id
        && (rendered.pageCount || 0) >= 2
        && !multiPageNoticedFileIdsRef.current.has(selectedFile.id)
      ) {
        multiPageNoticedFileIdsRef.current.add(selectedFile.id);
        setMultiPageNotice({
          fileName: String(selectedFile.name || ''),
          pageCount: rendered.pageCount || 0,
        });
        setIsMultiPageNoticeOpen(true);
      }
      if (rendered.pageNumber && rendered.pageNumber !== pageNumber) {
        setPdfPageNumber(rendered.pageNumber);
      }
      setPdfError('');
      return true;
    } catch (error) {
      if (error?.name === 'AbortError') return false;
      const message = error?.message || 'Python PDF 렌더링에 실패했습니다.';
      setPdfError(message);
      if (lastPdfErrorRef.current !== message) {
        lastPdfErrorRef.current = message;
        notifyError(message);
      }
      return false;
    } finally {
      if (previewAbortControllerRef.current === controller) {
        previewAbortControllerRef.current = null;
        setBackendPdfLoading(false);
      }
    }
  }, [notifyError, selectedFile]);

  const renderBackendImage = React.useCallback(async () => {
    if (!selectedFile?.file && !selectedFile?.url) return false;
    try {
      setBackendPdfLoading(true);
      const nextUrl = selectedFile.file ? URL.createObjectURL(selectedFile.file) : selectedFile.url;
      setBackendPreviewUrl((prev) => {
        if (prev?.startsWith('blob:')) {
          try { URL.revokeObjectURL(prev); } catch (error) { void error; }
        }
        return nextUrl;
      });
      setBackendPdfPageCount(1);
      setPdfError('');
      return true;
    } catch (error) {
      if (error?.name === 'AbortError') return false;
      const message = error?.message || 'Python 이미지 렌더링에 실패했습니다.';
      setPdfError(message);
      if (lastPdfErrorRef.current !== message) {
        lastPdfErrorRef.current = message;
        notifyError(message);
      }
      return false;
    } finally {
      setBackendPdfLoading(false);
    }
  }, [notifyError, selectedFile]);

  React.useEffect(() => {
    let canceled = false;
    const loadPreview = async () => {
      clearBackendPdfPreview();
      setPdfError('');
      setPdfPageNumber(1);
      if (!selectedFile || (!selectedFile.file && !selectedFile.uploadId)) return;
      setPdfLoading(true);
      try {
        if (isPdf) {
          skipNextPdfPageEffectRef.current = true;
          await renderBackendPdfPage(1);
        } else {
          await renderBackendImage();
        }
      } catch (error) {
        if (!canceled) {
          setPdfError(error?.message || '미리보기를 불러올 수 없습니다.');
        }
      } finally {
        if (!canceled) setPdfLoading(false);
      }
    };

    loadPreview();

    return () => {
      canceled = true;
    };
  }, [clearBackendPdfPreview, isPdf, renderBackendImage, renderBackendPdfPage, selectedFile]);

  React.useEffect(() => {
    if (!isPdf || (!selectedFile?.file && !selectedFile?.uploadId)) return;
    if (skipNextPdfPageEffectRef.current) {
      skipNextPdfPageEffectRef.current = false;
      return;
    }
    renderBackendPdfPage(pdfPageNumber);
  }, [isPdf, pdfPageNumber, renderBackendPdfPage, selectedFile]);

  React.useEffect(() => {
    const handleGlobalWheel = (event) => {
      if (!event.ctrlKey) return;
      if (event.cancelable) event.preventDefault();
    };

    const handleGlobalKeydown = (event) => {
      if (!event.ctrlKey) return;
      if (event.key === '+' || event.key === '-' || event.key === '=' || event.key === '_' || event.key === '0') {
        event.preventDefault();
      }
    };

    window.addEventListener('wheel', handleGlobalWheel, { passive: false });
    window.addEventListener('keydown', handleGlobalKeydown);
    return () => {
      window.removeEventListener('wheel', handleGlobalWheel);
      window.removeEventListener('keydown', handleGlobalKeydown);
    };
  }, []);

  return (
    <div className="app-shell sidebar-wide">
      <Sidebar active={activeMenu} onSelect={onSelectMenu} collapsed={false} />
      <main className="main excel-web-v2-main">
        <div className="topbar" />
        <div className="excel-web-v2-layout">
          <section className="excel-web-v2-pane left">
            <h2>1. PDF/이미지 뷰어</h2>
            <div className="excel-web-v2-upload-row">
              <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleSourceUpload} />
            </div>
            <div className="excel-web-v2-file-list">
              {sourceFiles.length === 0 && <p className="muted">업로드된 파일이 없습니다.</p>}
              {sourceFiles.map((file) => (
                <button
                  type="button"
                  key={file.id}
                  className={file.id === selectedFileId ? 'active' : ''}
                  onClick={() => setSelectedFileId(file.id)}
                >
                  <span>{file.name}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    className="remove"
                    onClick={(e) => { e.stopPropagation(); removeSourceFile(file.id); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        removeSourceFile(file.id);
                      }
                    }}
                  >
                    ×
                  </span>
                </button>
              ))}
            </div>
            <div className="excel-web-v2-preview">
              {!selectedFile && <p className="muted">좌측 목록에서 파일을 선택하세요.</p>}
              {selectedFile && isPdf && (
                <div className="excel-web-v2-pdf-wrap">
                  <div className="excel-web-v2-pdf-toolbar">
                    <button type="button" disabled={pdfLoading || backendPdfLoading || pdfPageNumber <= 1} onClick={() => setPdfPageNumber((prev) => Math.max(1, prev - 1))}>이전</button>
                    <span>{effectivePdfPageCount > 0 ? `${pdfPageNumber} / ${effectivePdfPageCount}` : '0 / 0'}</span>
                    <button type="button" disabled={pdfLoading || backendPdfLoading || effectivePdfPageCount === 0 || pdfPageNumber >= effectivePdfPageCount} onClick={() => setPdfPageNumber((prev) => Math.min(effectivePdfPageCount, prev + 1))}>다음</button>
                    <button type="button" onClick={handleOpenPdfExportModal} disabled={pdfLoading || backendPdfLoading || effectivePdfPageCount === 0}>페이지 내보내기</button>
                    <button type="button" onClick={() => rotatePreview(-90)}>↺90°</button>
                    <button type="button" onClick={() => rotatePreview(90)}>↻90°</button>
                    <button type="button" onClick={resetPreviewRotation}>회전 초기화</button>
                    <button type="button" onClick={() => changePreviewZoom(-0.1)}>-</button>
                    <span>{Math.round(previewZoom * 100)}%</span>
                    <button type="button" onClick={() => changePreviewZoom(0.1)}>+</button>
                    <button type="button" onClick={resetPreviewZoom}>100%</button>
                    <a href={previewSrc} target="_blank" rel="noreferrer">원본 열기</a>
                  </div>
                  <div className="excel-web-v2-pdf-canvas-area" onWheel={handlePreviewWheel}>
                    {(pdfLoading || backendPdfLoading) && <p className="muted">PDF 불러오는 중...</p>}
                    {!pdfLoading && !backendPdfLoading && backendPreviewUrl && (
                      <img
                        src={backendPreviewUrl}
                        alt={selectedFile.name}
                        className="excel-web-v2-zoom-image"
                        style={{
                          width: `${previewZoom * 100}%`,
                          transform: `rotate(${previewRotation}deg)`,
                          transformOrigin: 'center center',
                        }}
                      />
                    )}
                    {!pdfLoading && !backendPdfLoading && !backendPreviewUrl && pdfError && <p className="muted">{pdfError}</p>}
                  </div>
                </div>
              )}
              {selectedFile && !isPdf && (
                <div className="excel-web-v2-pdf-wrap">
                  <div className="excel-web-v2-pdf-toolbar">
                    <button type="button" onClick={() => rotatePreview(-90)}>↺90°</button>
                    <button type="button" onClick={() => rotatePreview(90)}>↻90°</button>
                    <button type="button" onClick={resetPreviewRotation}>회전 초기화</button>
                    <button type="button" onClick={() => changePreviewZoom(-0.1)}>-</button>
                    <span>{Math.round(previewZoom * 100)}%</span>
                    <button type="button" onClick={() => changePreviewZoom(0.1)}>+</button>
                    <button type="button" onClick={resetPreviewZoom}>100%</button>
                    <a href={previewSrc} target="_blank" rel="noreferrer">원본 열기</a>
                  </div>
                  <div className="excel-web-v2-image-area" onWheel={handlePreviewWheel}>
                    {(pdfLoading || backendPdfLoading) && <p className="muted">이미지 불러오는 중...</p>}
                    {!pdfLoading && !backendPdfLoading && backendPreviewUrl && (
                      <img
                        src={backendPreviewUrl}
                        alt={selectedFile.name}
                        className="excel-web-v2-zoom-image"
                        style={{
                          width: `${previewZoom * 100}%`,
                          transform: `rotate(${previewRotation}deg)`,
                          transformOrigin: 'center center',
                        }}
                      />
                    )}
                    {!pdfLoading && !backendPdfLoading && !backendPreviewUrl && pdfError && <p className="muted">{pdfError}</p>}
                  </div>
                </div>
              )}
            </div>
          </section>

          {editorMode === EDITOR_MODE.MANAGEMENT && (
            <section className="excel-web-v2-pane center">
              <div className="excel-web-v2-pane-head">
                <h2>4. 변경 전/후 미리보기</h2>
              </div>
              <div className="excel-web-v2-compare">
                <div>
                  <h3>변경 전 (엑셀 원본)</h3>
                  <table>
                    <tbody>
                      {FIELD_LABELS.map(([key, label]) => (
                        <tr key={`before-${key}`}>
                          <th>{label}</th>
                          <td style={loadedColorMap?.[key] ? { backgroundColor: loadedColorMap[key] } : undefined}>{loadedData?.[key] || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <h3>변경 후 (사용자 입력)</h3>
                  <table>
                    <tbody>
                      {FIELD_LABELS.map(([key, label]) => (
                        <tr key={`after-${key}`}>
                          <th>{label}</th>
                          <td>{mergedAfterData?.[key] || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          <section className="excel-web-v2-pane right">
            <h2>2. 편집 유형</h2>
            <div className="excel-web-v2-editor-tabs">
              <button
                type="button"
                className={editorMode === EDITOR_MODE.MANAGEMENT ? 'active' : ''}
                onClick={() => setEditorMode(EDITOR_MODE.MANAGEMENT)}
              >
                경영상태
              </button>
              <button
                type="button"
                className={editorMode === EDITOR_MODE.CREDIT ? 'active' : ''}
                onClick={() => setEditorMode(EDITOR_MODE.CREDIT)}
              >
                신용평가
              </button>
            </div>

            {editorMode === EDITOR_MODE.MANAGEMENT && (
              <>
                <h2>3. 업데이트 대상 설정</h2>
                <div className="excel-web-v2-settings">
                  <label>
                    자료 종류
                    <select
                      className="excel-web-v2-filetype"
                      value={fileType}
                      onChange={(e) => {
                        setFileType(e.target.value);
                        setLookupVersion('');
                      }}
                    >
                      {MANAGEMENT_FILE_TYPES.map((type) => (
                        <option key={type} style={{ color: MANAGEMENT_FILE_TYPE_COLORS[type] || '#0f172a' }}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <h2>4. 경영상태 수정 입력</h2>
                <div className="excel-web-v2-form">
                  <label>상호<input name="companyName" value={form.companyName} onChange={handleInput} /></label>
                  <label>대표자<input name="managerName" value={form.managerName} onChange={handleInput} /></label>
                  <label>사업자등록번호<input name="bizNo" value={form.bizNo} onChange={handleInput} onKeyDown={handleBizNoKeyDown} /></label>
                  <label>지역<input name="region" value={form.region} onChange={handleInput} /></label>
                  <label>시평액<input name="sipyung" value={form.sipyung} onChange={handleInput} /></label>
                  <label>3년실적<input name="perf3y" value={form.perf3y} onChange={handleInput} /></label>
                  <label>5년실적<input name="perf5y" value={form.perf5y} onChange={handleInput} /></label>
                  <label>부채비율<input name="debtRatio" value={form.debtRatio} onChange={handleInput} /></label>
                  <label>유동비율<input name="currentRatio" value={form.currentRatio} onChange={handleInput} /></label>
                  <label>영업기간<input name="bizYears" value={form.bizYears} onChange={handleInput} /></label>
                  <label>여성기업<input name="womenOwned" value={form.womenOwned} onChange={handleInput} /></label>
                  <label>중소기업<input name="smallBusiness" value={form.smallBusiness} onChange={handleInput} /></label>
                  <label>일자리창출실적<input name="jobCreation" value={form.jobCreation} onChange={handleInput} /></label>
                  <label>시공품질평가<input name="qualityEval" value={form.qualityEval} onChange={handleInput} /></label>
                  <label className="full-row">비고<input name="note" value={form.note} onChange={handleInput} /></label>
                </div>

                <h2>5. 실행</h2>
                <div className="excel-web-v2-actions">
                  <button type="button" onClick={handleLoadData} disabled={isBackendBusy}>불러오기</button>
                  <button type="button" className="primary" onClick={handleSave} disabled={isBackendBusy}>확정 및 저장</button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => setIsDeleteConfirmOpen(true)}
                    disabled={isBackendBusy || !loadedData}
                  >
                    업체 삭제
                  </button>
                  <button type="button" className="maintenance" onClick={() => setIsMaintenanceModalOpen(true)} disabled={isBackendBusy}>갱신기능</button>
                </div>
                {backendStatusMessage && <p className="muted">{backendStatusMessage}</p>}
              </>
            )}

            {editorMode === EDITOR_MODE.CREDIT && (
              <>
                <h2>3. 업데이트 대상 설정</h2>
                <div className="excel-web-v2-settings">
                  <label>
                    자료 종류
                    <input value="신용평가" readOnly />
                  </label>
                </div>

                <h2>4. 기존 신용평가 조회값</h2>
                <div className="excel-web-v2-credit-readonly">
                  <label className="full-row">
                    기존 신용평가
                    <textarea value={creditLookupPreview} readOnly rows={4} />
                  </label>
                </div>

                <h2>5. 신용평가 입력</h2>
                <div className="excel-web-v2-form">
                  <label>사업자등록번호<input name="bizNo" value={form.bizNo} onChange={handleInput} onKeyDown={handleBizNoKeyDown} /></label>
                  <label>신용평가등급<input name="creditGrade" value={form.creditGrade} onChange={handleInput} /></label>
                  <div className="inline-dates">
                    <label>시작일<input name="creditStartDate" value={form.creditStartDate} onChange={handleInput} placeholder="YYYY.MM.DD" /></label>
                    <label>종료일<input name="creditEndDate" value={form.creditEndDate} onChange={handleInput} placeholder="YYYY.MM.DD" /></label>
                  </div>
                  <label className="full-row">
                    최종 저장값 (신용평가)
                    <textarea value={finalCreditText} readOnly rows={3} />
                  </label>
                </div>

                <h2>6. 실행</h2>
                <div className="excel-web-v2-actions">
                  <button type="button" onClick={handleLoadData} disabled={isBackendBusy}>불러오기</button>
                  <button type="button" className="primary" onClick={handleSave} disabled={isBackendBusy}>확정 및 저장</button>
                </div>
                {backendStatusMessage && <p className="muted">{backendStatusMessage}</p>}
              </>
            )}
          </section>
        </div>

        {isMaintenanceModalOpen && (
          <div className="excel-web-v2-modal-backdrop" role="dialog" aria-modal="true" aria-label="갱신기능">
            <div className="excel-web-v2-modal">
              <div className="excel-web-v2-modal-head">
                <h3>갱신 기능</h3>
                <button type="button" onClick={() => setIsMaintenanceModalOpen(false)} disabled={isBackendBusy}>닫기</button>
              </div>
              <div className="excel-web-v2-modal-body">
                <button
                  type="button"
                  onClick={async () => {
                    await handleYearEndUpdate();
                    setIsMaintenanceModalOpen(false);
                  }}
                  disabled={isBackendBusy}
                >
                  연말 색상 업데이트
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await handleCreditExpiryUpdate();
                    setIsMaintenanceModalOpen(false);
                  }}
                  disabled={isBackendBusy}
                >
                  신용평가 유효기간 갱신
                </button>
              </div>
            </div>
          </div>
        )}

        {isDeleteConfirmOpen && (
          <div className="excel-web-v2-modal-backdrop" role="dialog" aria-modal="true" aria-label="업체 삭제 확인">
            <div className="excel-web-v2-modal">
              <div className="excel-web-v2-modal-head">
                <h3>업체 삭제 확인</h3>
                <button type="button" onClick={() => setIsDeleteConfirmOpen(false)} disabled={isBackendBusy}>닫기</button>
              </div>
              <div className="excel-web-v2-modal-body">
                <p className="muted">
                  현재 선택한 {fileType} DB에서 업체 블록을 완전히 비웁니다.
                </p>
                <p className="muted">
                  업체명: {loadedData?.companyName || '-'}
                  <br />
                  사업자등록번호: {loadedData?.bizNo || form.bizNo || '-'}
                </p>
                <p className="muted">삭제하려면 아래 예 버튼을 눌러 진행하세요.</p>
                <button type="button" className="danger" onClick={handleDeleteCompany} disabled={isBackendBusy}>예</button>
                <button type="button" onClick={() => setIsDeleteConfirmOpen(false)} disabled={isBackendBusy}>아니오</button>
              </div>
            </div>
          </div>
        )}

        {isMultiPageNoticeOpen && (
          <div className="excel-web-v2-modal-backdrop" role="dialog" aria-modal="true" aria-label="페이지 수 안내">
            <div className="excel-web-v2-modal">
              <div className="excel-web-v2-modal-head">
                <h3>확인 필요</h3>
                <button type="button" onClick={() => setIsMultiPageNoticeOpen(false)}>확인</button>
              </div>
              <div className="excel-web-v2-modal-body">
                <p className="muted">
                  선택한 PDF는 총 {multiPageNotice.pageCount}페이지입니다.
                  {' '}
                  다른 업체 자료가 포함됐는지 확인하세요.
                </p>
                {multiPageNotice.fileName && <p className="muted">파일: {multiPageNotice.fileName}</p>}
                <button type="button" onClick={() => setIsMultiPageNoticeOpen(false)}>확인</button>
              </div>
            </div>
          </div>
        )}

        {isPdfExportModalOpen && (
          <div className="excel-web-v2-floating-wrap" role="dialog" aria-modal="false" aria-label="PDF 페이지 내보내기">
            <div className="excel-web-v2-modal excel-web-v2-floating-modal">
              <div className="excel-web-v2-modal-head">
                <h3>PDF 페이지 내보내기</h3>
                <button type="button" onClick={() => setIsPdfExportModalOpen(false)} disabled={isBackendBusy}>닫기</button>
              </div>
              <div className="excel-web-v2-modal-body">
                <label>
                  페이지 범위
                  <input
                    value={pdfExportPages}
                    onChange={(event) => setPdfExportPages(event.target.value)}
                    placeholder="예: 1,3-5,8"
                  />
                </label>
                <label>
                  파일명
                  <input
                    value={pdfExportFileName}
                    onChange={(event) => setPdfExportFileName(event.target.value)}
                    placeholder="내보낼 파일명.pdf"
                  />
                </label>
                <button type="button" onClick={handleExportPdfPages} disabled={isBackendBusy}>내보내기</button>
              </div>
            </div>
          </div>
        )}

        {isMissingCompanyModalOpen && (
          <div className="excel-web-v2-floating-wrap" role="dialog" aria-modal="false" aria-label="업체 미조회">
            <div className="excel-web-v2-modal excel-web-v2-floating-modal">
              <div className="excel-web-v2-modal-head">
                <h3>업체 미조회</h3>
                <button type="button" onClick={() => setIsMissingCompanyModalOpen(false)} disabled={isBackendBusy}>닫기</button>
              </div>
              <div className="excel-web-v2-modal-body">
                <p className="muted">해당 사업자번호를 엑셀에서 찾지 못했습니다. 처리 방식을 선택하세요.</p>
                {missingCompanyMode === 'management' && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMissingCompanyModalOpen(false);
                      openCompanySetupModal('register');
                    }}
                    disabled={isBackendBusy}
                  >
                    신규업체등록
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsMissingCompanyModalOpen(false);
                    openCompanySetupModal('archive_only');
                  }}
                  disabled={isBackendBusy}
                >
                  파일만저장
                </button>
              </div>
            </div>
          </div>
        )}

        {isCompanySetupModalOpen && (
          <div className="excel-web-v2-floating-wrap" role="dialog" aria-modal="false" aria-label="업체 정보 입력">
            <div className="excel-web-v2-modal excel-web-v2-floating-modal">
              <div className="excel-web-v2-modal-head">
                <h3>{companySetupMode === 'register' ? '신규업체등록 정보' : '파일만저장 정보'}</h3>
                <button type="button" onClick={() => setIsCompanySetupModalOpen(false)} disabled={isBackendBusy}>닫기</button>
              </div>
              <div className="excel-web-v2-modal-body">
                <label>
                  업체명
                  <input
                    value={companySetupDraft.companyName}
                    onChange={(event) => setCompanySetupDraft((prev) => ({ ...prev, companyName: event.target.value }))}
                    placeholder="업체명 입력"
                  />
                </label>
                {companySetupMode === 'register' && (
                  <label>
                    저장 시트
                    <input
                      list="excel-web-v2-region-options"
                      value={companySetupDraft.sheetName}
                      onChange={(event) => {
                        const nextSheetName = event.target.value;
                        setCompanySetupDraft((prev) => ({
                          ...prev,
                          sheetName: nextSheetName,
                          region: !prev.region || prev.region === prev.sheetName ? nextSheetName : prev.region,
                        }));
                      }}
                      placeholder="예: 경기"
                    />
                  </label>
                )}
                <label>
                  {companySetupMode === 'register' ? '지역/주소' : '지역'}
                  <input
                    list="excel-web-v2-region-options"
                    value={companySetupDraft.region}
                    onChange={(event) => setCompanySetupDraft((prev) => ({ ...prev, region: event.target.value }))}
                    placeholder={companySetupMode === 'register' ? '예: 경기도 화성시' : '예: 경기'}
                  />
                  <datalist id="excel-web-v2-region-options">
                    {REGION_OPTIONS.map((region) => <option key={region} value={region} />)}
                  </datalist>
                </label>
                <button type="button" onClick={handleConfirmCompanySetup} disabled={isBackendBusy}>
                  {companySetupMode === 'register' ? '확인' : '저장'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

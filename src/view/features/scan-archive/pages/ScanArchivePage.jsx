import React from 'react';
import '../../../../styles.css';
import '../../../../fonts.css';
import Sidebar from '../../../../components/Sidebar';
import scanArchiveClient from '../../../../shared/scanArchiveClient';
import excelEditBackendClient from '../../../../shared/excelEditBackendClient';

const SCAN_ARCHIVE_STATE_KEY = 'scan-archive:state:v1';
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tif', '.tiff']);
const TIFF_EXTENSIONS = new Set(['.tif', '.tiff']);
const FILE_FILTER = {
  ALL: 'all',
  ELECTRIC: 'electric',
  COMMUNICATION: 'communication',
  FIRE: 'fire',
  CREDIT: 'credit',
};

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return '-';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ko-KR');
}

function formatFileMeta(file) {
  const sizeText = formatBytes(file?.size);
  const updatedText = formatDate(file?.updatedAt);
  return {
    sizeText,
    updatedText,
  };
}

function getExtension(fileName = '') {
  const match = String(fileName || '').match(/(\.[^./\\]+)$/);
  return match ? match[1] : '';
}

export default function ScanArchivePage() {
  const initialSavedState = React.useMemo(() => {
    try {
      const raw = window.sessionStorage.getItem(SCAN_ARCHIVE_STATE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }, []);
  const [activeMenu, setActiveMenu] = React.useState('scan-archive');
  const [rootPath, setRootPath] = React.useState('');
  const [currentPath, setCurrentPath] = React.useState(() => String(initialSavedState?.currentPath || ''));
  const [breadcrumbs, setBreadcrumbs] = React.useState([{ name: '스캔본', path: '' }]);
  const [entries, setEntries] = React.useState([]);
  const [selectedFilePath, setSelectedFilePath] = React.useState(() => String(initialSavedState?.selectedFilePath || ''));
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [searchTerm, setSearchTerm] = React.useState(() => String(initialSavedState?.searchTerm || ''));
  const [searchResults, setSearchResults] = React.useState([]);
  const [fileFilter, setFileFilter] = React.useState(() => (
    Object.values(FILE_FILTER).includes(initialSavedState?.fileFilter)
      ? initialSavedState.fileFilter
      : FILE_FILTER.ALL
  ));
  const [searchBusy, setSearchBusy] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);
  const [folderDialog, setFolderDialog] = React.useState(null);
  const [folderName, setFolderName] = React.useState('');
  const [uploadDialogOpen, setUploadDialogOpen] = React.useState(false);
  const [uploadFile, setUploadFile] = React.useState(null);
  const [uploadFileName, setUploadFileName] = React.useState('');
  const [uploadOverwriteTarget, setUploadOverwriteTarget] = React.useState(null);
  const [archiveBusy, setArchiveBusy] = React.useState(false);
  const [viewerPageNumber, setViewerPageNumber] = React.useState(1);
  const [viewerPageCount, setViewerPageCount] = React.useState(0);
  const [viewerZoom, setViewerZoom] = React.useState(1);
  const [viewerRotation, setViewerRotation] = React.useState(0);
  const [viewerLoading, setViewerLoading] = React.useState(false);
  const [viewerError, setViewerError] = React.useState('');
  const [viewerImageUrl, setViewerImageUrl] = React.useState('');
  const viewerAbortRef = React.useRef(null);
  const searchRequestIdRef = React.useRef(0);
  const initialPathRef = React.useRef(String(initialSavedState?.currentPath || ''));

  const folders = React.useMemo(() => entries.filter((entry) => entry.type === 'dir'), [entries]);
  const files = React.useMemo(() => entries.filter((entry) => entry.type === 'file'), [entries]);
  const hasSearchKeyword = React.useMemo(() => String(searchTerm || '').trim().length > 0, [searchTerm]);
  const filteredFiles = React.useMemo(() => {
    return files.filter((file) => {
      const fileName = String(file.name || '');
      if (fileFilter === FILE_FILTER.ALL) return true;
      if (fileFilter === FILE_FILTER.ELECTRIC) return fileName.includes('전기경영상태');
      if (fileFilter === FILE_FILTER.COMMUNICATION) return fileName.includes('통신경영상태');
      if (fileFilter === FILE_FILTER.FIRE) return fileName.includes('소방경영상태');
      if (fileFilter === FILE_FILTER.CREDIT) return fileName.includes('신용평가');
      return true;
    });
  }, [fileFilter, files]);
  const visibleFiles = hasSearchKeyword ? searchResults : filteredFiles;
  const selectedFile = React.useMemo(
    () => filteredFiles.find((item) => item.path === selectedFilePath) || null,
    [filteredFiles, selectedFilePath],
  );

  const loadDirectory = React.useCallback(async (dir = '') => {
    try {
      setLoading(true);
      setError('');
      const payload = await scanArchiveClient.list(dir);
      const data = payload?.data || {};
      setRootPath(String(data.root || ''));
      setCurrentPath(String(data.currentPath || ''));
      setBreadcrumbs(Array.isArray(data.breadcrumbs) ? data.breadcrumbs : [{ name: '스캔본', path: '' }]);
      const nextEntries = Array.isArray(data.entries) ? data.entries : [];
      setEntries(nextEntries);
      setSelectedFilePath((prev) => (nextEntries.some((item) => item.path === prev) ? prev : ''));
    } catch (loadError) {
      setError(loadError?.message || '스캔본 목록을 불러오지 못했습니다.');
      setEntries([]);
      setSelectedFilePath('');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadDirectory(initialPathRef.current);
  }, [loadDirectory]);

  React.useEffect(() => {
    const payload = {
      currentPath,
      selectedFilePath,
      searchTerm,
      fileFilter,
    };
    try {
      window.sessionStorage.setItem(SCAN_ARCHIVE_STATE_KEY, JSON.stringify(payload));
    } catch (error) {
      void error;
    }
  }, [currentPath, fileFilter, searchTerm, selectedFilePath]);

  const handleSelectMenu = React.useCallback((key) => {
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
    else if (key === 'excel-web-edit') window.location.hash = '#/excel-web-edit';
    else if (key === 'scan-archive') window.location.hash = '#/scan-archive';
  }, []);

  const downloadUrl = selectedFile ? scanArchiveClient.buildDownloadUrl(selectedFile.path) : '';
  const downloadAllUrl = scanArchiveClient.buildDownloadAllUrl(currentPath);
  const isPdf = selectedFile?.ext === '.pdf';
  const isImage = selectedFile ? IMAGE_EXTENSIONS.has(selectedFile.ext) : false;
  const isTiff = selectedFile ? TIFF_EXTENSIONS.has(selectedFile.ext) : false;
  const canUseEnhancedViewer = Boolean(selectedFile && (isPdf || isImage));

  const clearViewerImageUrl = React.useCallback(() => {
    setViewerImageUrl((prev) => {
      if (prev?.startsWith('blob:')) {
        try { URL.revokeObjectURL(prev); } catch (error) { void error; }
      }
      return '';
    });
  }, []);

  const changeViewerZoom = React.useCallback((delta) => {
    setViewerZoom((prev) => Math.max(0.5, Number((prev + delta).toFixed(2))));
  }, []);

  const resetViewerZoom = React.useCallback(() => {
    setViewerZoom(1);
  }, []);

  const rotateViewer = React.useCallback((delta) => {
    setViewerRotation((prev) => (prev + delta + 360) % 360);
  }, []);

  const resetViewerRotation = React.useCallback(() => {
    setViewerRotation(0);
  }, []);

  const handleViewerWheel = React.useCallback((event) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    changeViewerZoom(event.deltaY < 0 ? 0.1 : -0.1);
  }, [changeViewerZoom]);

  const handleGlobalSearch = React.useCallback(async () => {
    const keyword = String(searchTerm || '').trim();
    if (!keyword) {
      setError('검색어를 입력하세요.');
      setSearchResults([]);
      return;
    }

    try {
      const requestId = searchRequestIdRef.current + 1;
      searchRequestIdRef.current = requestId;
      setSearchBusy(true);
      setError('');
      const payload = await scanArchiveClient.search(keyword, fileFilter);
      if (searchRequestIdRef.current !== requestId) return;
      const result = payload?.data || {};
      const nextResults = Array.isArray(result.results) ? result.results : [];
      setSearchResults(nextResults);
      if (nextResults.length === 0) {
        setError('검색 결과가 없습니다.');
        return;
      }
    } catch (searchError) {
      setSearchResults([]);
      setError(searchError?.message || '파일 검색 중 오류가 발생했습니다.');
    } finally {
      setSearchBusy(false);
    }
  }, [fileFilter, searchTerm]);

  const handleSelectSearchResult = React.useCallback(async (item) => {
    const targetDir = String(item?.dirPath || '');
    const targetPath = String(item?.path || '');
    if (!targetPath) return;
    if (targetDir !== currentPath) {
      await loadDirectory(targetDir);
    }
    setSelectedFilePath(targetPath);
  }, [currentPath, loadDirectory]);

  const handleDeleteSelectedFile = React.useCallback(async () => {
    if (!deleteTarget?.path) return;
    try {
      setDeleteBusy(true);
      setError('');
      await scanArchiveClient.deletePath(deleteTarget.path);
      setSelectedFilePath((prev) => (prev === deleteTarget.path ? '' : prev));
      setEntries((prev) => prev.filter((entry) => entry.path !== deleteTarget.path));
      setSearchResults((prev) => prev.filter((entry) => entry.path !== deleteTarget.path));
      setDeleteTarget(null);
      if (hasSearchKeyword) {
        await handleGlobalSearch();
      } else {
        await loadDirectory(currentPath);
      }
    } catch (deleteError) {
      setError(deleteError?.message || '파일 삭제에 실패했습니다.');
    } finally {
      setDeleteBusy(false);
    }
  }, [currentPath, deleteTarget, handleGlobalSearch, hasSearchKeyword, loadDirectory]);

  const renderSelectedFile = React.useCallback(async (pageNumber = 1) => {
    if (!selectedFile || !canUseEnhancedViewer) return;
    if (viewerAbortRef.current) viewerAbortRef.current.abort();
    const controller = new AbortController();
    viewerAbortRef.current = controller;
    try {
      setViewerLoading(true);
      setViewerError('');
      const response = await fetch(scanArchiveClient.buildPreviewUrl(selectedFile.path), {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`파일을 불러오지 못했습니다. (${response.status})`);
      const sourceBlob = await response.blob();
      if (controller.signal.aborted) return;

      if (isPdf) {
        const file = new File([sourceBlob], selectedFile.name || 'scan.pdf', {
          type: sourceBlob.type || 'application/pdf',
        });
        const rendered = await excelEditBackendClient.renderPdfPage({
          file,
          page: pageNumber,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        const nextUrl = URL.createObjectURL(rendered.blob);
        setViewerImageUrl((prev) => {
          if (prev?.startsWith('blob:')) {
            try { URL.revokeObjectURL(prev); } catch (error) { void error; }
          }
          return nextUrl;
        });
        setViewerPageCount(rendered.pageCount || 0);
        if (rendered.pageNumber && rendered.pageNumber !== pageNumber) {
          setViewerPageNumber(rendered.pageNumber);
        }
        return;
      }

      if (isTiff) {
        const file = new File([sourceBlob], selectedFile.name || 'scan.tif', {
          type: sourceBlob.type || 'image/tiff',
        });
        const rendered = await excelEditBackendClient.renderImage({
          file,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        const nextUrl = URL.createObjectURL(rendered.blob);
        setViewerImageUrl((prev) => {
          if (prev?.startsWith('blob:')) {
            try { URL.revokeObjectURL(prev); } catch (error) { void error; }
          }
          return nextUrl;
        });
        setViewerPageCount(1);
        return;
      }

      const nextUrl = URL.createObjectURL(sourceBlob);
      setViewerImageUrl((prev) => {
        if (prev?.startsWith('blob:')) {
          try { URL.revokeObjectURL(prev); } catch (error) { void error; }
        }
        return nextUrl;
      });
      setViewerPageCount(1);
    } catch (renderError) {
      if (renderError?.name === 'AbortError') return;
      setViewerError(renderError?.message || '미리보기를 불러오지 못했습니다.');
      clearViewerImageUrl();
      setViewerPageCount(0);
    } finally {
      if (viewerAbortRef.current === controller) {
        viewerAbortRef.current = null;
        setViewerLoading(false);
      }
    }
  }, [canUseEnhancedViewer, clearViewerImageUrl, isPdf, isTiff, selectedFile]);

  React.useEffect(() => {
    setViewerPageNumber(1);
    setViewerPageCount(0);
    setViewerError('');
    clearViewerImageUrl();
    if (!canUseEnhancedViewer) return undefined;
    return () => {
      if (viewerAbortRef.current) {
        viewerAbortRef.current.abort();
        viewerAbortRef.current = null;
      }
    };
  }, [canUseEnhancedViewer, clearViewerImageUrl, selectedFile?.path]);

  React.useEffect(() => {
    if (!selectedFile || !canUseEnhancedViewer) return;
    renderSelectedFile(viewerPageNumber);
  }, [canUseEnhancedViewer, renderSelectedFile, selectedFile, viewerPageNumber]);

  React.useEffect(() => () => {
    if (viewerAbortRef.current) viewerAbortRef.current.abort();
    clearViewerImageUrl();
  }, [clearViewerImageUrl]);

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

  const openCreateFolderDialog = React.useCallback(() => {
    setFolderDialog({ mode: 'create', target: null });
    setFolderName('');
    setError('');
  }, []);

  const openRenameFolderDialog = React.useCallback((folder) => {
    setFolderDialog({ mode: 'rename', target: folder });
    setFolderName(String(folder?.name || ''));
    setError('');
  }, []);

  const handleSubmitFolderDialog = React.useCallback(async () => {
    const nextName = String(folderName || '').trim();
    if (!nextName) {
      setError('폴더명을 입력하세요.');
      return;
    }
    try {
      setArchiveBusy(true);
      setError('');
      if (folderDialog?.mode === 'rename') {
        await scanArchiveClient.renameFolder(folderDialog.target?.path || '', nextName);
      } else {
        await scanArchiveClient.createFolder(currentPath, nextName);
      }
      setFolderDialog(null);
      setFolderName('');
      await loadDirectory(currentPath);
    } catch (folderError) {
      setError(folderError?.message || '폴더 작업에 실패했습니다.');
    } finally {
      setArchiveBusy(false);
    }
  }, [currentPath, folderDialog, folderName, loadDirectory]);

  const openUploadDialog = React.useCallback(() => {
    setUploadDialogOpen(true);
    setUploadFile(null);
    setUploadFileName('');
    setUploadOverwriteTarget(null);
    setError('');
  }, []);

  const handleUploadFileChange = React.useCallback((event) => {
    const file = event.target.files?.[0] || null;
    setUploadFile(file);
    setUploadFileName(file ? String(file.name || '') : '');
    setUploadOverwriteTarget(null);
  }, []);

  const handleSubmitUpload = React.useCallback(async (options = {}) => {
    if (!uploadFile) {
      setError('업로드할 파일을 선택하세요.');
      return;
    }
    const nextName = String(uploadFileName || '').trim();
    if (!nextName) {
      setError('저장할 파일명을 입력하세요.');
      return;
    }
    try {
      setArchiveBusy(true);
      setError('');
      const response = await scanArchiveClient.uploadFile(currentPath, uploadFile, nextName, {
        overwrite: Boolean(options.overwrite),
      });
      const savedPath = response?.data?.path || '';
      setUploadDialogOpen(false);
      setUploadFile(null);
      setUploadFileName('');
      setUploadOverwriteTarget(null);
      await loadDirectory(currentPath);
      if (savedPath) setSelectedFilePath(savedPath);
    } catch (uploadError) {
      if (uploadError?.status === 409 && uploadError?.code === 'FILE_EXISTS') {
        setUploadOverwriteTarget({
          name: uploadError.data?.name || nextName,
          path: uploadError.data?.path || '',
        });
        return;
      }
      setError(uploadError?.message || '파일 업로드에 실패했습니다.');
    } finally {
      setArchiveBusy(false);
    }
  }, [currentPath, loadDirectory, uploadFile, uploadFileName]);

  React.useEffect(() => {
    const keyword = String(searchTerm || '').trim();
    if (!keyword) {
      searchRequestIdRef.current += 1;
      setSearchBusy(false);
      setSearchResults([]);
      setError('');
      return undefined;
    }
    const timer = setTimeout(() => {
      handleGlobalSearch();
    }, 220);
    return () => clearTimeout(timer);
  }, [fileFilter, handleGlobalSearch, searchTerm]);

  const fileTypeClassName = (fileName) => {
    if (fileName.includes('전기경영상태')) return 'electric';
    if (fileName.includes('통신경영상태')) return 'communication';
    if (fileName.includes('소방경영상태')) return 'fire';
    if (fileName.includes('신용평가')) return 'credit';
    return 'default';
  };

  return (
    <div className="app-shell sidebar-wide">
      <Sidebar active={activeMenu} onSelect={handleSelectMenu} collapsed={false} />
      <main className="main scan-archive-main">
        <div className="topbar" />
        <div className="scan-archive-layout">
          <section className="scan-archive-pane">
            <div className="scan-archive-head">
              <h2>스캔본 폴더</h2>
              <div className="scan-archive-head-actions">
                <button type="button" onClick={openCreateFolderDialog} disabled={archiveBusy} title="폴더 생성">＋</button>
                <button type="button" onClick={() => loadDirectory(currentPath)} disabled={loading} title="새로고침">↻</button>
                <a href={downloadAllUrl} className="scan-archive-download-all" title="전체 ZIP 다운로드">ZIP</a>
              </div>
            </div>
            <p className="scan-archive-root">{rootPath || '-'}</p>
            <div className="scan-archive-breadcrumbs">
              {breadcrumbs.map((item) => (
                <button key={item.path || 'root'} type="button" onClick={() => loadDirectory(item.path)}>
                  {item.name}
                </button>
              ))}
            </div>
            {loading && <p className="muted">불러오는 중...</p>}
            {error && <p className="scan-archive-error">{error}</p>}
            <div className="scan-archive-list">
              {folders.map((folder) => (
                <div key={folder.path} className="scan-archive-folder-row">
                  <button type="button" onClick={() => loadDirectory(folder.path)}>
                    <span className="scan-archive-folder-name" tabIndex={0}>
                      <span className="scan-archive-folder-label">📁 {folder.name}</span>
                      <span className="scan-archive-folder-tooltip" role="tooltip">{folder.name}</span>
                    </span>
                    <span className="scan-archive-file-meta">{formatDate(folder.updatedAt)}</span>
                  </button>
                  <div className="scan-archive-folder-actions">
                    <button type="button" onClick={() => openRenameFolderDialog(folder)} disabled={archiveBusy}>수정</button>
                    <button type="button" className="danger" onClick={() => setDeleteTarget(folder)} disabled={archiveBusy}>삭제</button>
                  </div>
                </div>
              ))}
              {folders.length === 0 && !loading && <p className="muted">하위 폴더가 없습니다.</p>}
            </div>
          </section>

          <section className="scan-archive-pane">
            <div className="scan-archive-head">
              <h2>{hasSearchKeyword ? '검색 결과' : '파일 목록'}</h2>
              {!hasSearchKeyword && (
                <button type="button" className="scan-archive-upload-button" onClick={openUploadDialog} disabled={archiveBusy}>
                  파일 업로드
                </button>
              )}
            </div>
            <div className="scan-archive-file-controls">
              <input
                type="text"
                placeholder="파일명 검색"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleGlobalSearch();
                  }
                }}
              />
              <button
                type="button"
                className="scan-archive-search-btn"
                onClick={handleGlobalSearch}
                disabled={searchBusy}
              >
                {searchBusy ? '검색 중...' : '전체 검색'}
              </button>
              <div className="scan-archive-filter-row">
                <button
                  type="button"
                  className={fileFilter === FILE_FILTER.ALL ? 'active' : ''}
                  onClick={() => setFileFilter(FILE_FILTER.ALL)}
                >
                  전체
                </button>
                <button
                  type="button"
                  className={fileFilter === FILE_FILTER.ELECTRIC ? 'active' : ''}
                  onClick={() => setFileFilter(FILE_FILTER.ELECTRIC)}
                >
                  전기
                </button>
                <button
                  type="button"
                  className={fileFilter === FILE_FILTER.COMMUNICATION ? 'active' : ''}
                  onClick={() => setFileFilter(FILE_FILTER.COMMUNICATION)}
                >
                  통신
                </button>
                <button
                  type="button"
                  className={fileFilter === FILE_FILTER.FIRE ? 'active' : ''}
                  onClick={() => setFileFilter(FILE_FILTER.FIRE)}
                >
                  소방
                </button>
                <button
                  type="button"
                  className={fileFilter === FILE_FILTER.CREDIT ? 'active' : ''}
                  onClick={() => setFileFilter(FILE_FILTER.CREDIT)}
                >
                  신용평가
                </button>
              </div>
            </div>
            <div className="scan-archive-list">
              {visibleFiles.map((file) => (
                (() => {
                  const meta = formatFileMeta(file);
                  return (
                    <button
                      key={file.path}
                      type="button"
                      className={file.path === selectedFilePath ? 'active' : ''}
                      onClick={() => {
                        if (hasSearchKeyword) {
                          handleSelectSearchResult(file);
                          return;
                        }
                        setSelectedFilePath(file.path);
                      }}
                    >
                      <span className="scan-archive-file-summary">
                        <span className={`scan-archive-file-name ${fileTypeClassName(file.name)}`}>📄 {file.name}</span>
                        {hasSearchKeyword && <span className="scan-archive-file-path">{file.dirPath || '루트 폴더'}</span>}
                        <span className="scan-archive-file-dates">
                          <span>수정 {meta.updatedText}</span>
                        </span>
                      </span>
                      <span className="scan-archive-file-meta">{meta.sizeText}</span>
                    </button>
                  );
                })()
              ))}
              {visibleFiles.length === 0 && !loading && (
                <p className="muted">{hasSearchKeyword ? '검색 결과가 없습니다.' : '조건에 맞는 파일이 없습니다.'}</p>
              )}
            </div>
          </section>

          <section className="scan-archive-pane preview">
            <div className="scan-archive-head">
              <h2>미리보기</h2>
              {selectedFile && (
                <div className="scan-archive-preview-actions">
                  <a href={downloadUrl} className="scan-archive-download">
                    다운로드
                  </a>
                  <button
                    type="button"
                    className="scan-archive-delete"
                    onClick={() => setDeleteTarget(selectedFile)}
                    disabled={deleteBusy}
                  >
                    삭제
                  </button>
                </div>
              )}
            </div>
            {!selectedFile && <p className="muted">파일을 선택하세요.</p>}
            {selectedFile && (
              <div className="scan-archive-selected-meta">
                <span>크기 {formatBytes(selectedFile.size)}</span>
                <span>수정 {formatDate(selectedFile.updatedAt)}</span>
              </div>
            )}
            {selectedFile && canUseEnhancedViewer && (
              <div className="scan-archive-enhanced-viewer">
                <div className="excel-web-v2-pdf-toolbar">
                  {isPdf && (
                    <>
                      <button type="button" disabled={viewerLoading || viewerPageNumber <= 1} onClick={() => setViewerPageNumber((prev) => Math.max(1, prev - 1))}>이전</button>
                      <span>{viewerPageCount > 0 ? `${viewerPageNumber} / ${viewerPageCount}` : '0 / 0'}</span>
                      <button type="button" disabled={viewerLoading || viewerPageCount === 0 || viewerPageNumber >= viewerPageCount} onClick={() => setViewerPageNumber((prev) => Math.min(viewerPageCount, prev + 1))}>다음</button>
                    </>
                  )}
                  <button type="button" onClick={() => rotateViewer(-90)}>↺90°</button>
                  <button type="button" onClick={() => rotateViewer(90)}>↻90°</button>
                  <button type="button" onClick={resetViewerRotation}>회전 초기화</button>
                  <button type="button" onClick={() => changeViewerZoom(-0.1)}>-</button>
                  <span>{Math.round(viewerZoom * 100)}%</span>
                  <button type="button" onClick={() => changeViewerZoom(0.1)}>+</button>
                  <button type="button" onClick={resetViewerZoom}>100%</button>
                  <a href={downloadUrl} target="_blank" rel="noreferrer">원본 열기</a>
                </div>
                <div className="excel-web-v2-pdf-canvas-area" onWheel={handleViewerWheel}>
                  {viewerLoading && <p className="muted">미리보기 불러오는 중...</p>}
                  {!viewerLoading && viewerImageUrl && (
                    <img
                      src={viewerImageUrl}
                      alt={selectedFile.name}
                      className="excel-web-v2-zoom-image"
                      style={{
                        width: `${viewerZoom * 100}%`,
                        transform: `rotate(${viewerRotation}deg)`,
                        transformOrigin: 'center center',
                      }}
                    />
                  )}
                  {!viewerLoading && !viewerImageUrl && viewerError && <p className="muted">{viewerError}</p>}
                </div>
              </div>
            )}
            {selectedFile && !canUseEnhancedViewer && (
              <p className="muted">이 파일 형식은 미리보기를 지원하지 않습니다. 다운로드해서 확인해주세요.</p>
            )}
          </section>
        </div>
        {deleteTarget && (
          <div className="scan-archive-confirm-overlay" role="presentation">
            <div className="scan-archive-confirm" role="dialog" aria-modal="true" aria-labelledby="scan-delete-title">
              <h3 id="scan-delete-title">{deleteTarget.type === 'dir' ? '폴더 삭제' : '파일 삭제'}</h3>
              <p>
                서버에서 이 {deleteTarget.type === 'dir' ? '폴더와 하위 파일을 모두' : '파일을'} 삭제합니다.
                <br />
                <strong>{deleteTarget.name}</strong>
              </p>
              <div className="scan-archive-confirm-actions">
                <button type="button" onClick={() => setDeleteTarget(null)} disabled={deleteBusy}>
                  취소
                </button>
                <button type="button" className="danger" onClick={handleDeleteSelectedFile} disabled={deleteBusy}>
                  {deleteBusy ? '삭제 중...' : '삭제'}
                </button>
              </div>
            </div>
          </div>
        )}
        {folderDialog && (
          <div className="scan-archive-confirm-overlay" role="presentation">
            <div className="scan-archive-confirm" role="dialog" aria-modal="true" aria-labelledby="scan-folder-title">
              <h3 id="scan-folder-title">{folderDialog.mode === 'rename' ? '폴더명 수정' : '폴더 생성'}</h3>
              <label className="scan-archive-dialog-field">
                폴더명
                <input value={folderName} onChange={(event) => setFolderName(event.target.value)} autoFocus />
              </label>
              <div className="scan-archive-confirm-actions">
                <button type="button" onClick={() => setFolderDialog(null)} disabled={archiveBusy}>취소</button>
                <button type="button" className="primary" onClick={handleSubmitFolderDialog} disabled={archiveBusy}>
                  {archiveBusy ? '처리 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        )}
        {uploadDialogOpen && (
          <div className="scan-archive-confirm-overlay" role="presentation">
            <div className="scan-archive-confirm scan-archive-upload-dialog" role="dialog" aria-modal="true" aria-labelledby="scan-upload-title">
              <h3 id="scan-upload-title">파일 업로드</h3>
              <p className="scan-archive-dialog-help">현재 폴더에 별도 파일을 저장합니다.</p>
              <label className="scan-archive-dialog-field">
                파일 선택
                <input type="file" onChange={handleUploadFileChange} />
              </label>
              <label className="scan-archive-dialog-field">
                저장 파일명
                <input
                  value={uploadFileName}
                  onChange={(event) => setUploadFileName(event.target.value)}
                  placeholder={uploadFile ? `예: 별도자료${getExtension(uploadFile.name)}` : '파일을 먼저 선택하세요'}
                />
              </label>
              <div className="scan-archive-confirm-actions">
                <button
                  type="button"
                  onClick={() => {
                    setUploadDialogOpen(false);
                    setUploadOverwriteTarget(null);
                  }}
                  disabled={archiveBusy}
                >
                  취소
                </button>
                <button type="button" className="primary" onClick={handleSubmitUpload} disabled={archiveBusy}>
                  {archiveBusy ? '업로드 중...' : '업로드'}
                </button>
              </div>
            </div>
          </div>
        )}
        {uploadOverwriteTarget && (
          <div className="scan-archive-confirm-overlay" role="presentation">
            <div className="scan-archive-confirm" role="dialog" aria-modal="true" aria-labelledby="scan-overwrite-title">
              <h3 id="scan-overwrite-title">파일 덮어쓰기</h3>
              <p>
                같은 이름의 파일이 이미 있습니다.
                <br />
                <strong>{uploadOverwriteTarget.name}</strong>
                <br />
                기존 파일을 덮어쓸까요?
              </p>
              <div className="scan-archive-confirm-actions">
                <button type="button" onClick={() => setUploadOverwriteTarget(null)} disabled={archiveBusy}>
                  아니오
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => handleSubmitUpload({ overwrite: true })}
                  disabled={archiveBusy}
                >
                  {archiveBusy ? '덮어쓰는 중...' : '예'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

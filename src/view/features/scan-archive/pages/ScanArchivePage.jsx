import React from 'react';
import '../../../../styles.css';
import '../../../../fonts.css';
import Sidebar from '../../../../components/Sidebar';
import scanArchiveClient from '../../../../shared/scanArchiveClient';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']);

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

export default function ScanArchivePage() {
  const [activeMenu, setActiveMenu] = React.useState('scan-archive');
  const [rootPath, setRootPath] = React.useState('');
  const [currentPath, setCurrentPath] = React.useState('');
  const [breadcrumbs, setBreadcrumbs] = React.useState([{ name: '스캔본', path: '' }]);
  const [entries, setEntries] = React.useState([]);
  const [selectedFilePath, setSelectedFilePath] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const folders = React.useMemo(() => entries.filter((entry) => entry.type === 'dir'), [entries]);
  const files = React.useMemo(() => entries.filter((entry) => entry.type === 'file'), [entries]);
  const selectedFile = React.useMemo(
    () => files.find((item) => item.path === selectedFilePath) || null,
    [files, selectedFilePath],
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
    loadDirectory('');
  }, [loadDirectory]);

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

  const previewUrl = selectedFile ? scanArchiveClient.buildPreviewUrl(selectedFile.path) : '';
  const downloadUrl = selectedFile ? scanArchiveClient.buildDownloadUrl(selectedFile.path) : '';
  const isPdf = selectedFile?.ext === '.pdf';
  const isImage = selectedFile ? IMAGE_EXTENSIONS.has(selectedFile.ext) : false;

  return (
    <div className="app-shell sidebar-wide">
      <Sidebar active={activeMenu} onSelect={handleSelectMenu} collapsed={false} />
      <main className="main scan-archive-main">
        <div className="topbar" />
        <div className="scan-archive-layout">
          <section className="scan-archive-pane">
            <div className="scan-archive-head">
              <h2>스캔본 폴더</h2>
              <button type="button" onClick={() => loadDirectory(currentPath)} disabled={loading}>새로고침</button>
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
                <button key={folder.path} type="button" onClick={() => loadDirectory(folder.path)}>
                  <span>📁 {folder.name}</span>
                  <span>{formatDate(folder.updatedAt)}</span>
                </button>
              ))}
              {folders.length === 0 && !loading && <p className="muted">하위 폴더가 없습니다.</p>}
            </div>
          </section>

          <section className="scan-archive-pane">
            <h2>파일 목록</h2>
            <div className="scan-archive-list">
              {files.map((file) => (
                <button
                  key={file.path}
                  type="button"
                  className={file.path === selectedFilePath ? 'active' : ''}
                  onClick={() => setSelectedFilePath(file.path)}
                >
                  <span>📄 {file.name}</span>
                  <span>{formatBytes(file.size)}</span>
                </button>
              ))}
              {files.length === 0 && !loading && <p className="muted">파일이 없습니다.</p>}
            </div>
          </section>

          <section className="scan-archive-pane preview">
            <div className="scan-archive-head">
              <h2>미리보기</h2>
              {selectedFile && (
                <a href={downloadUrl} className="scan-archive-download">
                  다운로드
                </a>
              )}
            </div>
            {!selectedFile && <p className="muted">파일을 선택하세요.</p>}
            {selectedFile && isPdf && (
              <iframe title={selectedFile.name} src={previewUrl} className="scan-archive-preview-frame" />
            )}
            {selectedFile && isImage && (
              <div className="scan-archive-preview-image-wrap">
                <img src={previewUrl} alt={selectedFile.name} className="scan-archive-preview-image" />
              </div>
            )}
            {selectedFile && !isPdf && !isImage && (
              <p className="muted">이 파일 형식은 미리보기를 지원하지 않습니다. 다운로드해서 확인해주세요.</p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}


import React from 'react';
import '../../../../styles.css';
import '../../../../fonts.css';
import Sidebar from '../../../../components/Sidebar';

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

const MOCK_LOADED = {
  companyName: '일진전기건설공사',
  managerName: '조래원',
  bizNo: '131-20-68530',
  region: '인천',
  sipyung: '3,829,134,000',
  perf3y: '3,350,827,000',
  perf5y: '5,158,252,000',
  debtRatio: '28.70%',
  currentRatio: '456.46%',
  bizYears: '2003.06.20',
  creditText: 'A-\n(2025.01.01~2026.12.31)',
  womenOwned: '',
  smallBusiness: '',
  jobCreation: '',
  qualityEval: '',
  note: '박성규',
};

function buildCreditText(form) {
  const grade = String(form.creditGrade || '').trim();
  const start = String(form.creditStartDate || '').trim();
  const end = String(form.creditEndDate || '').trim();
  if (!grade && !start && !end) return '';
  if (!grade) return `${start || '?'}~${end || '?'}`;
  if (!start && !end) return grade;
  return `${grade}\n(${start || '?'}~${end || '?'})`;
}

export default function ExcelWebEditPage() {
  const [activeMenu, setActiveMenu] = React.useState('excel-web-edit');
  const [fileType, setFileType] = React.useState('전기경영상태');
  const [sourceFiles, setSourceFiles] = React.useState([]);
  const [selectedFileId, setSelectedFileId] = React.useState('');
  const [loadedData, setLoadedData] = React.useState(null);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const sourceFilesRef = React.useRef([]);

  const selectedFile = React.useMemo(
    () => sourceFiles.find((file) => file.id === selectedFileId) || null,
    [selectedFileId, sourceFiles],
  );

  const previewSrc = selectedFile?.url || '';
  const isPdf = selectedFile?.type?.includes('pdf') || selectedFile?.name?.toLowerCase().endsWith('.pdf');

  const mergedAfterData = React.useMemo(() => {
    if (!loadedData) return null;
    const next = { ...loadedData };
    const creditText = buildCreditText(form);
    Object.keys(form).forEach((key) => {
      if (['creditGrade', 'creditStartDate', 'creditEndDate'].includes(key)) return;
      const value = String(form[key] || '').trim();
      if (value) next[key] = value;
    });
    if (creditText) next.creditText = creditText;
    return next;
  }, [form, loadedData]);

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

  const handleSourceUpload = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    let firstAddedId = '';
    setSourceFiles((prev) => {
      const next = [...prev];
      files.forEach((file) => {
        const id = `${Date.now()}-${file.name}-${Math.random().toString(36).slice(2, 7)}`;
        if (!firstAddedId) firstAddedId = id;
        next.push({
          id,
          file,
          name: file.name,
          type: file.type || '',
          url: URL.createObjectURL(file),
        });
      });
      return next;
    });
    setSelectedFileId((prev) => prev || firstAddedId);
    event.target.value = '';
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
    sourceFilesRef.current = sourceFiles;
  }, [sourceFiles]);

  React.useEffect(() => {
    return () => {
      sourceFilesRef.current.forEach((file) => {
        try { URL.revokeObjectURL(file.url); } catch {}
      });
    };
  }, []);

  const removeSourceFile = (id) => {
    setSourceFiles((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) {
        try { URL.revokeObjectURL(target.url); } catch {}
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleInput = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleLoadData = () => {
    setLoadedData(MOCK_LOADED);
    setForm((prev) => ({
      ...prev,
      companyName: MOCK_LOADED.companyName,
      managerName: MOCK_LOADED.managerName,
      bizNo: MOCK_LOADED.bizNo,
      region: MOCK_LOADED.region,
      note: MOCK_LOADED.note,
    }));
  };

  return (
    <div className="app-shell sidebar-wide">
      <Sidebar active={activeMenu} onSelect={onSelectMenu} collapsed={false} />
      <main className="main excel-web-v2-main">
        <div className="title-drag" />
        <div className="excel-web-v2-layout">
          <section className="excel-web-v2-pane left">
            <h2>1. PDF/이미지 뷰어</h2>
            <div className="excel-web-v2-upload-row">
              <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg" onChange={handleSourceUpload} />
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
                <iframe title={selectedFile.name} src={previewSrc} />
              )}
              {selectedFile && !isPdf && (
                <img src={previewSrc} alt={selectedFile.name} />
              )}
            </div>
          </section>

          <section className="excel-web-v2-pane center">
            <div className="excel-web-v2-pane-head">
              <h2>4. 변경 전/후 미리보기</h2>
              <button type="button" onClick={handleLoadData}>불러오기</button>
            </div>
            <div className="excel-web-v2-compare">
              <div>
                <h3>변경 전 (엑셀 원본)</h3>
                <table>
                  <tbody>
                    {FIELD_LABELS.map(([key, label]) => (
                      <tr key={`before-${key}`}>
                        <th>{label}</th>
                        <td>{loadedData?.[key] || ''}</td>
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

          <section className="excel-web-v2-pane right">
            <h2>2. 업데이트 대상 설정</h2>
            <div className="excel-web-v2-settings">
              <label>
                자료 종류
                <select value={fileType} onChange={(e) => setFileType(e.target.value)}>
                  <option>전기경영상태</option>
                  <option>통신경영상태</option>
                  <option>소방경영상태</option>
                  <option>신용평가</option>
                </select>
              </label>
            </div>

            <h2>3. 수정 입력</h2>
            <div className="excel-web-v2-form">
              <label>상호<input name="companyName" value={form.companyName} onChange={handleInput} /></label>
              <label>대표자<input name="managerName" value={form.managerName} onChange={handleInput} /></label>
              <label>사업자등록번호<input name="bizNo" value={form.bizNo} onChange={handleInput} /></label>
              <label>지역<input name="region" value={form.region} onChange={handleInput} /></label>
              <label>시평액<input name="sipyung" value={form.sipyung} onChange={handleInput} /></label>
              <label>3년실적<input name="perf3y" value={form.perf3y} onChange={handleInput} /></label>
              <label>5년실적<input name="perf5y" value={form.perf5y} onChange={handleInput} /></label>
              <label>부채비율<input name="debtRatio" value={form.debtRatio} onChange={handleInput} /></label>
              <label>유동비율<input name="currentRatio" value={form.currentRatio} onChange={handleInput} /></label>
              <label>영업기간<input name="bizYears" value={form.bizYears} onChange={handleInput} /></label>
              <label>신용평가등급<input name="creditGrade" value={form.creditGrade} onChange={handleInput} /></label>
              <div className="inline-dates">
                <label>시작일<input name="creditStartDate" value={form.creditStartDate} onChange={handleInput} placeholder="YYYY.MM.DD" /></label>
                <label>종료일<input name="creditEndDate" value={form.creditEndDate} onChange={handleInput} placeholder="YYYY.MM.DD" /></label>
              </div>
              <label>여성기업<input name="womenOwned" value={form.womenOwned} onChange={handleInput} /></label>
              <label>중소기업<input name="smallBusiness" value={form.smallBusiness} onChange={handleInput} /></label>
              <label>일자리창출실적<input name="jobCreation" value={form.jobCreation} onChange={handleInput} /></label>
              <label>시공품질평가<input name="qualityEval" value={form.qualityEval} onChange={handleInput} /></label>
              <label>비고<input name="note" value={form.note} onChange={handleInput} /></label>
            </div>

            <h2>4. 실행</h2>
            <div className="excel-web-v2-actions">
              <button type="button">연말 색상 업데이트</button>
              <button type="button">신용평가 유효기간 갱신</button>
              <button type="button" className="primary">확정 및 저장</button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

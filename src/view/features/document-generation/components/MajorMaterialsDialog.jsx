import React, { useRef } from 'react';
import Modal from '../../../../components/Modal.jsx';
import { useFeedback } from '../../../../components/FeedbackProvider.jsx';
import { MAJOR_MATERIAL_GROUPS } from '../../../../shared/majorMaterials.js';
import useMajorMaterials from '../hooks/useMajorMaterials.js';
import MajorMaterialGroup from './MajorMaterialGroup.jsx';
import './DocumentLoadDialog.css';
import './MajorMaterialsDialog.css';

function MaterialsIcon({ close = false }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{close ? <path d="m6 6 12 12M18 6 6 18" /> : <><path d="m12 3 9 5-9 5-9-5 9-5ZM3 8v9l9 5 9-5V8M12 13v9M7.5 5.5l9 5" /></>}</svg>;
}

export default function MajorMaterialsDialog({ onClose }) {
  const feedback = useFeedback();
  const state = useMajorMaterials({ ...feedback, onClose });
  const closeRef = useRef(null);
  const { settings, loading, saving, loaded, dirty, error } = state;
  const disabled = loading || saving || !loaded;
  const canSave = !disabled && (dirty || settings.revision === 0);
  const status = loading ? '저장된 설정을 불러오는 중입니다.' : !loaded ? '설정을 불러온 후 수정할 수 있습니다.' : dirty ? '저장하지 않은 변경사항이 있습니다.' : settings.revision === 0 ? 'PDF 양식의 기본값입니다. 저장하면 공통 설정으로 보관됩니다.' : `최종 저장 ${new Date(settings.updatedAt).toLocaleString('ko-KR')}`;
  const header = <header className="document-library-header"><span className="document-library-header__icon"><MaterialsIcon /></span><div><span className="document-library-caption">LH · 적격심사 · 전기</span><h2 id="major-materials-title">주요자재 업체 설정</h2><p>주요 마감자재 선정 계획서에 사용할 업체명과 주소를 관리하세요.</p></div><button ref={closeRef} type="button" className="document-library-close" aria-label="주요자재 설정 닫기" disabled={saving} onClick={state.close}><MaterialsIcon close /></button></header>;
  const footer = <footer className="document-library-footer major-materials-footer"><p role="status" className={dirty ? 'major-materials-unsaved' : ''}>{saving ? '주요자재 정보를 저장하고 있습니다.' : status}</p><div className="document-library-footer__actions"><button type="button" className="document-library-button document-library-button--secondary" disabled={saving} onClick={state.close}>닫기</button><button type="button" className="document-library-button document-library-button--primary" disabled={!canSave} onClick={state.save}>{saving ? '저장 중…' : '주요자재 저장'}</button></div></footer>;

  return (
    <Modal open onClose={state.close} initialFocusRef={closeRef} ariaLabelledby="major-materials-title" disableEscClose={saving} maxWidth={1120} overlayClassName="document-library-overlay" boxClassName="document-library-dialog major-materials-dialog" header={header} footer={footer}>
      <div className="major-materials-body">
        <div className="major-materials-intro"><div><strong>자재별 선정업체 관리</strong><p>업체를 삭제한 뒤 저장하면 남은 업체 목록과 개수가 반영됩니다. 업체 번호는 표시 순서대로 매겨지며, 공고별 입력정보와 별도로 저장됩니다.</p></div><button type="button" className="document-library-button document-library-button--secondary" disabled={loading || saving} onClick={state.reload}>다시 불러오기</button></div>
        {error && <div className="major-materials-error" role="alert"><strong>주요자재 설정을 처리하지 못했습니다.</strong><p>{error}</p><p>수정 중인 내용은 유지됩니다. 저장된 정보를 확인하려면 ‘다시 불러오기’를 눌러 주세요.</p></div>}
        {loading ? <div className="document-library-state" role="status"><span className="document-library-spinner" /><p>저장된 주요자재 정보를 확인하고 있습니다.</p></div> : loaded && <fieldset className="major-materials-editor" disabled={disabled}><legend className="major-materials-sr-only">자재별 업체명과 업체주소 입력</legend><div className="major-materials-groups">{MAJOR_MATERIAL_GROUPS.map(({ id, label }) => <MajorMaterialGroup key={id} id={id} label={label} suppliers={settings.items[id]} icon={<MaterialsIcon />} onUpdate={(index, field, value) => state.updateSupplier(id, index, field, value)} onRemove={(index) => state.removeSupplier(id, index)} onAdd={() => state.addSupplier(id)} />)}</div></fieldset>}
      </div>
    </Modal>
  );
}

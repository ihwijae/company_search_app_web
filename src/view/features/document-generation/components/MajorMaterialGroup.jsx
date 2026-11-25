import React from 'react';
import { MAX_MAJOR_MATERIAL_SUPPLIERS } from '../../../../shared/majorMaterials.js';

export default function MajorMaterialGroup({ id, label, suppliers, icon, onUpdate, onRemove, onAdd }) {
  return (
    <section className="major-materials-group" aria-labelledby={`major-materials-${id}`}>
      <header>
        <span className="major-materials-group__icon">{icon}</span>
        <div><h3 id={`major-materials-${id}`}>{label}</h3><p>선정업체 · 소재지</p></div>
        <span className="major-materials-count" role="status">{suppliers.length}개 업체</span>
      </header>
      <div className="major-materials-suppliers">
        {suppliers.map((supplier, index) => (
          <div key={index} className="major-materials-supplier">
            <div className="major-materials-supplier__heading">
              <span>{String.fromCodePoint(0x2460 + index)}</span><strong>선정업체 {index + 1}</strong>
              <button type="button" className="major-materials-remove" aria-label={`${label} 선정업체 ${index + 1}${supplier.companyName ? ` ${supplier.companyName}` : ''} 삭제`} onClick={() => onRemove(index)}>업체 삭제</button>
            </div>
            <label><span>업체명</span><input value={supplier.companyName} maxLength={200} placeholder="선정업체명 입력" onChange={(event) => onUpdate(index, 'companyName', event.target.value)} aria-label={`${label} 선정업체 ${index + 1} 업체명`} /></label>
            <label><span>업체주소 <small>소재지</small></span><textarea value={supplier.address} maxLength={1000} rows={2} placeholder="선정업체 주소 입력" onChange={(event) => onUpdate(index, 'address', event.target.value)} aria-label={`${label} 선정업체 ${index + 1} 업체주소`} /></label>
          </div>
        ))}
        {!suppliers.length && <p className="major-materials-empty">등록된 업체가 없습니다.<br />업체 추가 버튼으로 선정업체를 입력해 주세요.</p>}
      </div>
      <div className="major-materials-group__footer"><span>최대 {MAX_MAJOR_MATERIAL_SUPPLIERS}개 업체</span><button type="button" className="document-library-button document-library-button--secondary" disabled={suppliers.length >= MAX_MAJOR_MATERIAL_SUPPLIERS} onClick={onAdd}>업체 추가</button></div>
    </section>
  );
}

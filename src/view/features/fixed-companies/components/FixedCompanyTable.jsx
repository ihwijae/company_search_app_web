import React from 'react';
import { getFixedCompanyKey } from '../../../../shared/fixedCompanies.js';
import { normalizeRegionName } from '../../../../shared/regionNormalizer.js';

const formatBizNo = (value) => value.length === 10
  ? `${value.slice(0, 3)}-${value.slice(3, 5)}-${value.slice(5)}` : (value || '사업자번호 없음');

export default function FixedCompanyTable({ companies, selectedRegion, disabled, onNoteChange, onRemove }) {
  const normalizedRegion = normalizeRegionName(selectedRegion);
  return (
    <div className="fixed-company-table-scroll">
      <table className="fixed-company-table">
        <thead>
          <tr>
            <th scope="col" className="fixed-company-table__number">번호</th>
            <th scope="col">업체 정보</th>
            <th scope="col" className="fixed-company-table__manager">담당자</th>
            <th scope="col" className="fixed-company-table__note">비고</th>
            <th scope="col" className="fixed-company-table__actions">관리</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((company, index) => {
            const key = getFixedCompanyKey(company);
            const companyRegion = company.companyRegion || company.snapshot?.['대표지역'] || company.snapshot?.['지역'] || '';
            const isLocalCompany = Boolean(normalizedRegion && normalizeRegionName(companyRegion) === normalizedRegion);
            return (
              <tr key={key} className={isLocalCompany ? 'fixed-company-table__row--local' : undefined}>
                <td className="fixed-company-table__number">{String(index + 1).padStart(2, '0')}</td>
                <td>
                  <div className="fixed-company-table__name">
                    <strong>{company.name}</strong>
                    {companyRegion && <span>{companyRegion}</span>}
                  </div>
                  <span className="fixed-company-table__biz-no">{formatBizNo(company.bizNo)}</span>
                </td>
                <td>
                  <div className="fixed-company-table__managers">
                    {company.managerNames.length
                      ? company.managerNames.map((name) => <span key={name}>{name}</span>)
                      : <span className="fixed-company-table__no-manager">미등록</span>}
                  </div>
                </td>
                <td>
                  <textarea
                    aria-label={`${company.name} 비고`}
                    placeholder="연락사항이나 참고할 내용을 남겨주세요."
                    value={company.note}
                    onChange={(event) => onNoteChange(key, event.target.value)}
                    disabled={disabled}
                    rows={2}
                  />
                </td>
                <td className="fixed-company-table__actions">
                  <button type="button" className="fixed-company-remove" disabled={disabled} onClick={() => onRemove(company)} aria-label={`${company.name} 삭제`}>삭제</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

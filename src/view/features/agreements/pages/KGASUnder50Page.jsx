import React from 'react';
import AgreementFlowPage from './AgreementFlowPage.jsx';

export default function KGASUnder50Page() {
  return (
    <AgreementFlowPage
      menuKey="kgas-under50"
      ownerId="KGAS"
      ownerLabel="한국가스공사"
      rangeLabel="50억 미만"
    />
  );
}


// Uses the application's shared evaluator result. No second score evaluator here.
import { getLhDocumentConfig } from './lhDocumentConfig.js';

export function buildLhManagementPage(form, application, totalScore) {
  const criteria = application.criteria;
  const config = getLhDocumentConfig(form.rangeId);
  const tier = criteria.formulasDoc.agencies.find((agency) => agency.id === 'lh').tiers.find((item) => item.minAmount === config.tierMinAmount);
  const management = tier.rules.management;
  const financial = management.methods.find((method) => method.id === 'composite');
  const credit = management.methods.find((method) => method.id === 'credit');
  const industryAvg = management.industryAverage?.override || criteria.industryAvg;
  const companies = form.companies.slice(0, form.companyCount).map((company, index) => {
    const evaluated = application.model.methods[index];
    const parsedShare = company.share === '' ? null : Number(company.share);
    const share = Number.isFinite(parsedShare) ? parsedShare : null;
    return {
      ...evaluated, share,
      bizYearsText: company.bizYears, creditAgency: company.creditAgency,
      contribution: evaluated.score != null && share != null && share >= 0 && share <= 100 ? evaluated.score * share / 100 : null,
    };
  });
  const missing = companies.flatMap((company) => [
    ...(!company.method ? [`${company.name || '미선택 업체'} ${company.validationMessage || '경영상태 평가정보'}`] : []),
    ...(company.share == null || company.share < 0 || company.share > 100 ? [`${company.name || '미선택 업체'} 참여비율`] : []),
  ]);
  if (Math.abs(companies.reduce((sum, company) => sum + (company.share || 0), 0) - 100) >= .01) missing.push('참여비율 합계 100%');
  return {
    version: 1, companies, industryAvg, financial, credit, totalScore, missing,
    financialFormScale: config.financialFormScale,
    financialSubtotal: companies.filter((company) => company.method === 'composite').reduce((sum, company) => sum + (company.contribution || 0), 0),
    creditSubtotal: companies.filter((company) => company.method === 'credit').reduce((sum, company) => sum + (company.contribution || 0), 0),
  };
}

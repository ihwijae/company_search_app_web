export const MAJOR_MATERIAL_GROUPS = [
  { id: 'switches', label: '스위치류' },
  { id: 'outlets', label: '콘센트류' },
];

export const MAX_MAJOR_MATERIAL_SUPPLIERS = 4;

// Initial supplier rows from 서류양식/주요 마감자재 선정 계획서.pdf.
// Each category owns separate rows so later changes can differ by material.
const TEMPLATE_SUPPLIERS = [
  { companyName: '클리오(주)', address: '경기도 성남시 중원구 둔촌대로 473' },
  { companyName: '제일일렉트릭(주)', address: '부산광역시 사하구 을숙도대로 555(신평동)' },
  { companyName: '르그랑코리아(주)', address: '서울특별시 영등포구 국제금융로8길 27-8' },
  { companyName: '(주)진성테크', address: '경기도 김포시 통진읍 율마로256번길 70-3' },
];

export function createMajorMaterials() {
  return {
    version: 1,
    revision: 0,
    updatedAt: null,
    items: Object.fromEntries(MAJOR_MATERIAL_GROUPS.map(({ id }) => [id, TEMPLATE_SUPPLIERS.map((supplier) => ({ ...supplier }))])),
  };
}

export function normalizeMajorMaterialItems(items) {
  if (!items || typeof items !== 'object' || Array.isArray(items)) throw new Error('주요자재 업체정보가 올바르지 않습니다.');
  const text = (value, label, maxLength) => {
    if (typeof value !== 'string' || value.length > maxLength) throw new Error(`${label}은 ${maxLength}자 이내의 텍스트로 입력해 주세요.`);
    return value;
  };
  return Object.fromEntries(MAJOR_MATERIAL_GROUPS.map(({ id, label }) => {
    if (!Array.isArray(items[id]) || items[id].length > MAX_MAJOR_MATERIAL_SUPPLIERS) throw new Error(`${label} 업체 목록은 최대 ${MAX_MAJOR_MATERIAL_SUPPLIERS}개까지 입력할 수 있습니다.`);
    return [id, items[id].map((supplier) => {
      if (!supplier || typeof supplier !== 'object' || Array.isArray(supplier)) throw new Error(`${label} 업체정보가 올바르지 않습니다.`);
      return { companyName: text(supplier.companyName, '업체명', 200), address: text(supplier.address, '업체주소', 1000) };
    })];
  }));
}

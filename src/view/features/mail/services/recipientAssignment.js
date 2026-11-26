export const normalizeMailVendorName = (name = '') => name
  .replace(/[\s]/g, '')
  .replace(/^[㈜(주)(합)(유)(재)]+/gi, '')
  .replace(/^주식회사|^유한회사|^합자회사|^재단법인|^사단법인/gi, '')
  .replace(/(㈜|\(주\)|주식회사|\(합\)|합자회사|\(유\)|유한회사|\(재\)|재단법인|\(사\)|사단법인)$/gi, '')
  .toLowerCase();

// 메일 업체 목록과 폴더 생성은 동일한 프로필 검증 및 담당자 판정 규칙을 사용한다.
export function getAssignedRecipients({ recipients, vendorWorkers, loadedSmtpProfileId, selectedSmtpProfileId, smtpProfiles }) {
  const failure = (error) => ({ error, profileName: '', recipients: [] });
  if (!loadedSmtpProfileId) return failure('먼저 SMTP 프로필을 불러오세요.');
  if (selectedSmtpProfileId && selectedSmtpProfileId !== loadedSmtpProfileId) {
    return failure('선택한 SMTP 프로필을 먼저 불러오세요.');
  }
  const profile = smtpProfiles.find((item) => item.id === loadedSmtpProfileId);
  if (!profile) return failure('불러온 SMTP 프로필을 찾을 수 없습니다.');
  const rawName = typeof profile.name === 'string' ? profile.name.trim() : '';
  if (!rawName) return failure('SMTP 프로필 이름이 비어 있습니다.');
  const normalizedName = rawName.replace(/\s+/g, '');
  const surname = normalizedName.slice(0, 1);
  const tokens = [normalizedName];
  if (surname && surname !== normalizedName) tokens.push(surname);
  const nextList = recipients.filter((item) => {
    const normalizedVendor = normalizeMailVendorName(item.vendorName);
    const worker = (item.workerName || vendorWorkers[normalizedVendor] || '').replace(/\s+/g, '');
    if (!worker) return false;
    return tokens.some((token) => token && worker.includes(token));
  });
  return {
    error: nextList.length ? '' : `'${rawName}' 담당 업체를 찾지 못했습니다.`,
    profileName: rawName,
    recipients: nextList,
  };
}

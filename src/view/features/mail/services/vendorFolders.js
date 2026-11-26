const sanitizeFolderName = (name) => name
  .replace(/[<>:"/\\|?*\p{Cc}]/gu, '_')
  .replace(/[. ]+$/g, '');

export function buildProjectFolderPlan(fileName, profileName) {
  const trimmedProfile = typeof profileName === 'string' ? profileName.trim() : '';
  if (!trimmedProfile) return { error: '먼저 SMTP 프로필을 불러오세요.', parentName: '' };
  const trimmedFileName = typeof fileName === 'string' ? fileName.trim() : '';
  if (!trimmedFileName) return { error: '투찰금액 엑셀을 먼저 불러와 주세요.', parentName: '' };
  const projectName = trimmedFileName.replace(/\.(xlsx|xlsm|xls)$/i, '').trim().replace(/_투찰금액$/, '').trim();
  if (!projectName) return { error: '엑셀 파일명에서 공고명을 확인할 수 없습니다. 파일명을 확인해 주세요.', parentName: '' };
  return { error: '', parentName: sanitizeFolderName(`${projectName}_내역서(${trimmedProfile})`) };
}

async function ensureDirectory(directory, name) {
  try {
    return { directory: await directory.getDirectoryHandle(name), created: false };
  } catch (error) {
    if (error.name !== 'NotFoundError') throw error;
    return { directory: await directory.getDirectoryHandle(name, { create: true }), created: true };
  }
}

export function buildVendorFolderEntries(recipients) {
  return recipients.flatMap((recipient, index) => {
    const vendorName = String(recipient.vendorName || '').trim();
    if (!vendorName) return [];
    const safeName = sanitizeFolderName(vendorName);
    const number = Number.isSafeInteger(recipient.id) && recipient.id > 0 ? recipient.id : index + 1;
    return [{ name: `${number}. ${safeName || '업체'}`, vendorName }];
  });
}

export async function createVendorFolders(directory, entries, onProgress = () => {}) {
  const result = { created: 0, existing: 0, failures: [] };
  for (const entry of entries) {
    try {
      const folder = await ensureDirectory(directory, entry.name);
      if (folder.created) result.created += 1;
      else result.existing += 1;
    } catch (error) {
      result.failures.push({ name: entry.name, message: error.message || '폴더 생성 실패' });
    }
    onProgress(result.created + result.existing + result.failures.length);
  }
  return result;
}

export async function createProjectVendorFolders(directory, parentName, entries, onProgress) {
  if (!parentName || sanitizeFolderName(parentName) !== parentName) throw new Error('상위 폴더명을 확인해 주세요.');
  if (!entries.length) throw new Error('폴더를 생성할 업체명이 없습니다.');
  const parent = await ensureDirectory(directory, parentName);
  const result = await createVendorFolders(parent.directory, entries, onProgress);
  return { ...result, parentName, parentCreated: parent.created };
}

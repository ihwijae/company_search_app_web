export function buildVendorFolderEntries(recipients) {
  return recipients.flatMap((recipient, index) => {
    const vendorName = String(recipient.vendorName || '').trim();
    if (!vendorName) return [];
    const safeName = vendorName
      .replace(/[<>:"/\\|?*\p{Cc}]/gu, '_')
      .replace(/[. ]+$/g, '');
    const number = Number.isSafeInteger(recipient.id) && recipient.id > 0 ? recipient.id : index + 1;
    return [{ name: `${number}. ${safeName || '업체'}`, vendorName }];
  });
}

export async function createVendorFolders(directory, entries, onProgress = () => {}) {
  const result = { created: 0, existing: 0, failures: [] };
  for (const entry of entries) {
    try {
      try {
        await directory.getDirectoryHandle(entry.name);
        result.existing += 1;
      } catch (error) {
        if (error.name !== 'NotFoundError') throw error;
        await directory.getDirectoryHandle(entry.name, { create: true });
        result.created += 1;
      }
    } catch (error) {
      result.failures.push({ name: entry.name, message: error.message || '폴더 생성 실패' });
    }
    onProgress(result.created + result.existing + result.failures.length);
  }
  return result;
}

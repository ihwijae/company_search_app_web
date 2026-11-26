const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function main() {
  const { buildVendorFolderEntries, createVendorFolders } = await import(pathToFileURL(
    path.join(__dirname, '../src/view/features/mail/services/vendorFolders.js'),
  ).href);
  const { getAssignedRecipients, normalizeMailVendorName } = await import(pathToFileURL(
    path.join(__dirname, '../src/view/features/mail/services/recipientAssignment.js'),
  ).href);
  const assignmentInput = {
    recipients: [
      { id: 1, vendorName: '대한건설', workerName: '홍 길 동' },
      { id: 2, vendorName: '한국전기', workerName: '김' },
      { id: 5, vendorName: '㈜미래통신', workerName: '' },
      { id: 8, vendorName: '한빛건설', workerName: '홍' },
      { id: 9, vendorName: '미지정업체', workerName: '' },
    ],
    vendorWorkers: { [normalizeMailVendorName('미래통신')]: '홍길동' },
    smtpProfiles: [{ id: 'hong', name: ' 홍길동 ' }, { id: 'kim', name: '김철수' }],
    loadedSmtpProfileId: 'hong',
    selectedSmtpProfileId: 'hong',
  };
  const assigned = getAssignedRecipients(assignmentInput);
  assert.equal(assigned.error, '');
  assert.equal(assigned.profileName, '홍길동');
  assert.deepEqual(assigned.recipients.map((item) => item.id), [1, 5, 8], 'Use existing full name / surname matching and vendor-worker fallback');
  assert.deepEqual(buildVendorFolderEntries(assigned.recipients).map((item) => item.name), ['1. 대한건설', '5. ㈜미래통신', '8. 한빛건설']);
  assert.equal(assignmentInput.recipients.length, 5, 'Folder filtering must not change the mail recipient list');
  for (const [override, message] of [
    [{ loadedSmtpProfileId: '' }, '먼저 SMTP 프로필을 불러오세요.'],
    [{ selectedSmtpProfileId: 'kim' }, '선택한 SMTP 프로필을 먼저 불러오세요.'],
    [{ smtpProfiles: [] }, '불러온 SMTP 프로필을 찾을 수 없습니다.'],
    [{ smtpProfiles: [{ id: 'hong', name: ' ' }] }, 'SMTP 프로필 이름이 비어 있습니다.'],
    [{ recipients: [] }, "'홍길동' 담당 업체를 찾지 못했습니다."],
  ]) {
    const blocked = getAssignedRecipients({ ...assignmentInput, ...override });
    assert.equal(blocked.error, message);
    assert.deepEqual(blocked.recipients, [], 'Invalid profile or unmatched worker must not fall back to all recipients');
  }
  const entries = buildVendorFolderEntries([
    { id: 1, vendorName: ' 대한건설 ' },
    { id: 3, vendorName: '한국/전기:*?"<>|\\\n. ' },
    { id: 4, vendorName: ' ' },
    { id: 7, vendorName: '대한건설' },
    { vendorName: '미래통신' },
  ]);
  assert.equal(entries.length, 4, 'Blank vendor names must be skipped');
  assert.deepEqual(entries.map((entry) => entry.name), [
    '1. 대한건설', '3. 한국_전기_________', '7. 대한건설', '5. 미래통신',
  ], 'Preserve displayed IDs and sanitize Windows-invalid characters');

  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mail-vendor-folders-'));
  try {
    const directory = {
      async getDirectoryHandle(name, options = {}) {
        const target = path.join(root, name);
        try {
          if (options.create) await fs.mkdir(target);
          if (!(await fs.stat(target)).isDirectory()) {
            throw Object.assign(new Error('A file already uses this name'), { name: 'TypeMismatchError' });
          }
          return { name };
        } catch (error) {
          if (error.code === 'ENOENT') error.name = 'NotFoundError';
          throw error;
        }
      },
    };
    const progress = [];
    const first = await createVendorFolders(directory, entries, (value) => progress.push(value));
    assert.deepEqual(first, { created: 4, existing: 0, failures: [] });
    assert.deepEqual(progress, [1, 2, 3, 4]);
    await fs.writeFile(path.join(root, entries[0].name, 'keep.txt'), 'keep existing contents');
    const repeated = await createVendorFolders(directory, entries);
    assert.deepEqual(repeated, { created: 0, existing: 4, failures: [] });
    assert.equal(await fs.readFile(path.join(root, entries[0].name, 'keep.txt'), 'utf8'), 'keep existing contents');

    await fs.writeFile(path.join(root, '8. 이름충돌'), 'keep existing file');
    const partial = await createVendorFolders(directory, [{ name: '8. 이름충돌' }, { name: '9. 다음업체' }]);
    assert.equal(partial.failures.length, 1);
    assert.equal(partial.failures[0].name, '8. 이름충돌');
    assert.equal(partial.created, 1, 'A failed folder must not prevent subsequent creation');
    assert.equal(await fs.readFile(path.join(root, '8. 이름충돌'), 'utf8'), 'keep existing file');

    const denied = await createVendorFolders({
      async getDirectoryHandle() {
        throw Object.assign(new Error('Write permission denied'), { name: 'NotAllowedError' });
      },
    }, [{ name: '1. 대한건설' }]);
    assert.equal(denied.created, 0);
    assert.equal(denied.failures[0].message, 'Write permission denied');
    assert.deepEqual(await createVendorFolders(directory, []), { created: 0, existing: 0, failures: [] });
    console.log('PASS: SMTP load guards, profile mismatch, worker matching, folder-only filtering, naming, filtered IDs, blank names, creation, repeat, content preservation, file conflicts, partial failure, denied permission and progress');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

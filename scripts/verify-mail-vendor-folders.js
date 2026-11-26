const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function main() {
  const { buildProjectFolderPlan, buildVendorFolderEntries, createVendorFolders, createProjectVendorFolders } = await import(pathToFileURL(
    path.join(__dirname, '../src/view/features/mail/services/vendorFolders.js'),
  ).href);
  const { getAssignedRecipients, getLoadedSmtpProfile, normalizeMailVendorName } = await import(pathToFileURL(
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
  assert.deepEqual(getLoadedSmtpProfile(assignmentInput), { error: '', profileName: '홍길동' });
  assert.equal(getLoadedSmtpProfile({ ...assignmentInput, recipients: [] }).error, '', 'Profile readiness must not depend on worker matching');
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
  const projectTitle = '2603745-00 남양주왕숙2 A-2BL 아파트 전기공사 2공구';
  const projectName = `${projectTitle}_내역서(홍길동)`;
  for (const extension of ['', '.xlsx', '.xlsm', '.XLS']) {
    assert.deepEqual(buildProjectFolderPlan(`${projectTitle}_투찰금액${extension}`, ' 홍길동 '), { error: '', parentName: projectName });
  }
  assert.equal(buildProjectFolderPlan(`${projectTitle}.xlsx`, '홍길동').parentName, projectName);
  assert.equal(buildProjectFolderPlan('내부_투찰금액_검토_투찰금액.xlsx', '김철수').parentName, '내부_투찰금액_검토_내역서(김철수)', 'Only remove the trailing tender suffix');
  assert.equal(buildProjectFolderPlan('공고/명_투찰금액.xlsx', '홍/길동').parentName, '공고_명_내역서(홍_길동)');
  for (const [fileName, profileName] of [['', '홍길동'], ['_투찰금액.xlsx', '홍길동'], ['공고.xlsx', ' ']]) {
    const invalidPlan = buildProjectFolderPlan(fileName, profileName);
    assert.ok(invalidPlan.error);
    assert.equal(invalidPlan.parentName, '');
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
    const makeDirectory = (directoryPath) => ({
      async getDirectoryHandle(name, options = {}) {
        const target = path.join(directoryPath, name);
        try {
          if (options.create) await fs.mkdir(target);
          if (!(await fs.stat(target)).isDirectory()) {
            throw Object.assign(new Error('A file already uses this name'), { name: 'TypeMismatchError' });
          }
          return makeDirectory(target);
        } catch (error) {
          if (error.code === 'ENOENT') error.name = 'NotFoundError';
          throw error;
        }
      },
    });
    const directory = makeDirectory(root);
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

    const assignedEntries = buildVendorFolderEntries(assigned.recipients);
    const parentProgress = [];
    const hierarchy = await createProjectVendorFolders(directory, projectName, assignedEntries, (value) => parentProgress.push(value));
    assert.equal(hierarchy.parentCreated, true);
    assert.equal(hierarchy.parentName, projectName);
    assert.equal(hierarchy.created, 3);
    assert.deepEqual(parentProgress, [1, 2, 3]);
    for (const entry of assignedEntries) assert.ok((await fs.stat(path.join(root, projectName, entry.name))).isDirectory());
    await fs.writeFile(path.join(root, projectName, assignedEntries[0].name, 'keep.txt'), 'keep project contents');
    const existingParent = await createProjectVendorFolders(directory, projectName, assignedEntries);
    assert.equal(existingParent.parentCreated, false);
    assert.equal(existingParent.created, 0);
    assert.equal(existingParent.existing, 3);
    assert.equal(await fs.readFile(path.join(root, projectName, assignedEntries[0].name, 'keep.txt'), 'utf8'), 'keep project contents');
    const otherProjectName = buildProjectFolderPlan(`${projectTitle}_투찰금액.xlsx`, '김철수').parentName;
    const allVendors = await createProjectVendorFolders(directory, otherProjectName, entries);
    assert.equal(allVendors.parentCreated, true);
    assert.equal(allVendors.created, entries.length, 'All-vendor mode must create the complete list inside its project folder');
    for (const entry of entries) assert.ok((await fs.stat(path.join(root, otherProjectName, entry.name))).isDirectory());
    assert.equal(await fs.readFile(path.join(root, projectName, assignedEntries[0].name, 'keep.txt'), 'utf8'), 'keep project contents', 'Different profile names must produce independent parent folders');
    await fs.writeFile(path.join(root, projectName, '2. 한국전기'), 'existing file inside project');
    const projectPartial = await createProjectVendorFolders(directory, projectName, [{ name: '2. 한국전기' }, { name: '77. 다음업체' }]);
    assert.equal(projectPartial.failures.length, 1);
    assert.equal(projectPartial.created, 1);
    assert.ok((await fs.stat(path.join(root, projectName, '77. 다음업체'))).isDirectory());
    await assert.rejects(fs.stat(path.join(root, '77. 다음업체')), { code: 'ENOENT' }, 'Children must stay inside the project folder');

    await fs.writeFile(path.join(root, '공고명_내역서(충돌)'), 'existing parent file');
    await assert.rejects(createProjectVendorFolders(directory, '공고명_내역서(충돌)', [{ name: '100. 잘못된위치' }]), { name: 'TypeMismatchError' });
    await assert.rejects(fs.stat(path.join(root, '100. 잘못된위치')), { code: 'ENOENT' }, 'Parent failure must not fall back to the selected directory');
    await assert.rejects(createProjectVendorFolders(directory, '빈공고_내역서(홍길동)', []));
    await assert.rejects(fs.stat(path.join(root, '빈공고_내역서(홍길동)')), { code: 'ENOENT' }, 'Do not create an empty project without vendors');
    await assert.rejects(createProjectVendorFolders(directory, '../잘못된경로', assignedEntries));
    await assert.rejects(createProjectVendorFolders({
      async getDirectoryHandle() { throw Object.assign(new Error('Denied'), { name: 'NotAllowedError' }); },
    }, projectName, assignedEntries), { name: 'NotAllowedError' });
    console.log('PASS: SMTP load guards, worker matching, filename suffix and extension handling, profile naming, parent/child folders, repeat, content preservation, file conflicts, partial failure, denied permission and progress');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

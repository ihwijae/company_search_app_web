import initSqlJs from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import defaults from '../main/features/records/defaults.json';

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const PROJECT_SAVED_EVENT = 'records:web:project-saved';
const CHANNEL_NAME = 'company-search-records';

const createIdState = () => ({
  company: 1,
  category: 1,
  project: 1,
  attachment: 1,
});

const toIsoNow = () => new Date().toISOString();
const normalizeText = (value) => String(value || '').trim();
const normalizeBoolean = (value, fallback = true) => (value === undefined ? fallback : !!value);
const clone = (value) => JSON.parse(JSON.stringify(value));

const sortByOrderThenName = (items) => [...items].sort((a, b) => (
  (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  || String(a.name || '').localeCompare(String(b.name || ''))
));

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || data?.error || '요청 실패');
  }
  return data;
}

const createChannel = () => {
  if (typeof BroadcastChannel === 'undefined') return null;
  try {
    return new BroadcastChannel(CHANNEL_NAME);
  } catch {
    return null;
  }
};

let broadcastChannel = null;
let cachedState = null;
let loadPromise = null;
let sqlJsPromise = null;

const emitProjectSaved = (payload = {}) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PROJECT_SAVED_EVENT, { detail: payload }));
  }
  if (!broadcastChannel) {
    broadcastChannel = createChannel();
  }
  try {
    broadcastChannel?.postMessage({ type: PROJECT_SAVED_EVENT, payload });
  } catch {}
};

const buildInitialState = () => {
  const createdAt = toIsoNow();
  const state = {
    version: 2,
    nextIds: createIdState(),
    companies: [],
    categories: [],
    projects: [],
  };

  (Array.isArray(defaults?.companies) ? defaults.companies : []).forEach((company, index) => {
    const id = state.nextIds.company++;
    state.companies.push({
      id,
      name: normalizeText(company.name),
      alias: normalizeText(company.alias),
      isPrimary: !!company.isPrimary,
      isMisc: !!company.isMisc,
      active: true,
      sortOrder: Number.isFinite(company.sortOrder) ? company.sortOrder : index,
      createdAt,
      updatedAt: createdAt,
    });
  });

  (Array.isArray(defaults?.categories) ? defaults.categories : []).forEach((category, index) => {
    const id = state.nextIds.category++;
    state.categories.push({
      id,
      name: normalizeText(category.name),
      parentId: Number.isInteger(category.parentId) ? category.parentId : null,
      active: true,
      sortOrder: Number.isFinite(category.sortOrder) ? category.sortOrder : index,
      createdAt,
      updatedAt: createdAt,
    });
  });

  return state;
};

const normalizeAttachment = (attachment) => ({
  id: Number(attachment.id),
  displayName: normalizeText(attachment.displayName),
  fileName: normalizeText(attachment.fileName || attachment.displayName),
  mimeType: attachment.mimeType || 'application/octet-stream',
  fileSize: Number.isFinite(attachment.fileSize) ? attachment.fileSize : null,
  uploadedAt: attachment.uploadedAt || toIsoNow(),
  pathname: attachment.pathname || '',
  dataUrl: attachment.dataUrl || '',
});

const normalizeState = (input) => {
  const base = buildInitialState();
  const source = input && typeof input === 'object' ? input : {};
  const nextIds = {
    ...base.nextIds,
    ...(source.nextIds && typeof source.nextIds === 'object' ? source.nextIds : {}),
  };
  const companies = Array.isArray(source.companies) ? source.companies : base.companies;
  const categories = Array.isArray(source.categories) ? source.categories : base.categories;
  const projects = Array.isArray(source.projects) ? source.projects : [];

  return {
    version: 2,
    nextIds: {
      company: Number.isFinite(nextIds.company) ? nextIds.company : base.nextIds.company,
      category: Number.isFinite(nextIds.category) ? nextIds.category : base.nextIds.category,
      project: Number.isFinite(nextIds.project) ? nextIds.project : base.nextIds.project,
      attachment: Number.isFinite(nextIds.attachment) ? nextIds.attachment : base.nextIds.attachment,
    },
    companies: companies.map((item, index) => ({
      id: Number(item.id),
      name: normalizeText(item.name),
      alias: normalizeText(item.alias),
      isPrimary: !!item.isPrimary,
      isMisc: !!item.isMisc,
      active: normalizeBoolean(item.active, true),
      sortOrder: Number.isFinite(item.sortOrder) ? item.sortOrder : index,
      createdAt: item.createdAt || toIsoNow(),
      updatedAt: item.updatedAt || item.createdAt || toIsoNow(),
    })),
    categories: categories.map((item, index) => ({
      id: Number(item.id),
      name: normalizeText(item.name),
      parentId: Number.isInteger(item.parentId) && item.parentId > 0 ? item.parentId : null,
      active: normalizeBoolean(item.active, true),
      sortOrder: Number.isFinite(item.sortOrder) ? item.sortOrder : index,
      createdAt: item.createdAt || toIsoNow(),
      updatedAt: item.updatedAt || item.createdAt || toIsoNow(),
    })),
    projects: projects.map((item) => ({
      id: Number(item.id),
      corporationName: normalizeText(item.corporationName),
      projectName: normalizeText(item.projectName),
      clientName: normalizeText(item.clientName),
      startDate: item.startDate || null,
      endDate: item.endDate || null,
      contractAmount: item.contractAmount === null || item.contractAmount === undefined || item.contractAmount === ''
        ? null
        : Number(item.contractAmount),
      scopeNotes: item.scopeNotes || '',
      primaryCompanyId: Number.isInteger(item.primaryCompanyId) && item.primaryCompanyId > 0 ? item.primaryCompanyId : null,
      categoryIds: Array.isArray(item.categoryIds) ? item.categoryIds.map(Number).filter((value) => Number.isInteger(value) && value > 0) : [],
      attachments: Array.isArray(item.attachments) ? item.attachments.map(normalizeAttachment) : [],
      createdAt: item.createdAt || toIsoNow(),
      updatedAt: item.updatedAt || item.createdAt || toIsoNow(),
    })),
  };
};

const fetchState = async ({ force = false } = {}) => {
  if (!force && cachedState) return cachedState;
  if (!force && loadPromise) return loadPromise;
  const request = requestJson('/api/records?action=load')
    .then((result) => {
      cachedState = normalizeState(result?.data || null);
      loadPromise = null;
      return cachedState;
    })
    .catch((error) => {
      loadPromise = null;
      throw error;
    });
  loadPromise = request;
  return request;
};

const persistState = async (state) => {
  cachedState = normalizeState(state);
  await requestJson('/api/records', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ action: 'save', document: cachedState }),
  });
  return cachedState;
};

const makeCategoryLookup = (categories) => {
  const map = new Map();
  categories.forEach((item) => map.set(item.id, item));
  return map;
};

const hydrateAttachment = (attachment) => ({
  id: attachment.id,
  displayName: attachment.displayName,
  fileName: attachment.fileName || attachment.displayName,
  filePath: attachment.pathname
    ? `/api/records?action=file&pathname=${encodeURIComponent(attachment.pathname)}`
    : (attachment.dataUrl || ''),
  relativePath: attachment.pathname || attachment.fileName || attachment.displayName,
  mimeType: attachment.mimeType || 'application/octet-stream',
  fileSize: attachment.fileSize ?? null,
  uploadedAt: attachment.uploadedAt,
  pathname: attachment.pathname || '',
});

const hydrateProject = (project, state) => {
  const company = state.companies.find((item) => item.id === project.primaryCompanyId) || null;
  const categoryLookup = makeCategoryLookup(state.categories);
  const attachments = Array.isArray(project.attachments) ? project.attachments.map(hydrateAttachment) : [];
  return {
    id: project.id,
    corporationName: project.corporationName,
    projectName: project.projectName,
    clientName: project.clientName || null,
    startDate: project.startDate || null,
    endDate: project.endDate || null,
    contractAmount: project.contractAmount,
    scopeNotes: project.scopeNotes || '',
    primaryCompanyId: project.primaryCompanyId,
    primaryCompanyName: company?.name || null,
    primaryCompanyIsMisc: !!company?.isMisc,
    categories: (Array.isArray(project.categoryIds) ? project.categoryIds : [])
      .map((id) => categoryLookup.get(id))
      .filter(Boolean)
      .map((item) => ({ id: item.id, name: item.name })),
    attachments,
    attachment: attachments[0] || null,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
};

const matchKeyword = (project, keyword) => {
  const normalizedKeyword = normalizeText(keyword).toLowerCase();
  if (!normalizedKeyword) return true;
  return [
    project.projectName,
    project.clientName,
    project.scopeNotes,
    project.corporationName,
  ].some((value) => String(value || '').toLowerCase().includes(normalizedKeyword));
};

const uniqueNameGuard = (items, payload, message) => {
  const targetName = normalizeText(payload?.name).toLowerCase();
  const duplicate = items.find((item) => (
    normalizeText(item.name).toLowerCase() === targetName
    && Number(item.id) !== Number(payload?.id || 0)
  ));
  if (duplicate) throw new Error(message);
};

const getSqlJs = async () => {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs({
      locateFile: () => sqlWasmUrl,
    });
  }
  return sqlJsPromise;
};

const uploadAttachmentFile = async (file, { projectId, attachmentId, fileName }) => {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return requestJson('/api/records/upload', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      projectId,
      attachmentId,
      fileName,
      contentType: file.type || 'application/octet-stream',
      fileBase64: btoa(binary),
    }),
  });
};

const createBrowserFile = (buffer, fileName, mimeType) => new File([buffer], fileName, {
  type: mimeType || 'application/octet-stream',
});

const filePathToParts = (value) => String(value || '')
  .split(/[\\/]+/)
  .map((part) => part.trim())
  .filter(Boolean);

const readNestedFile = async (directoryHandle, pathParts) => {
  let current = directoryHandle;
  for (let index = 0; index < pathParts.length; index += 1) {
    const part = pathParts[index];
    const isLast = index === pathParts.length - 1;
    if (isLast) {
      const handle = await current.getFileHandle(part);
      return handle.getFile();
    }
    current = await current.getDirectoryHandle(part);
  }
  throw new Error('파일 경로를 찾을 수 없습니다.');
};

const queryRows = (db, sql, params = []) => {
  const stmt = db.prepare(sql);
  if (Array.isArray(params) && params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
};

const buildImportedStateFromDatabase = async (db, directoryHandle) => {
  const companies = queryRows(db, 'SELECT * FROM companies ORDER BY sort_order, name');
  const categories = queryRows(db, 'SELECT * FROM categories ORDER BY sort_order, name');
  const projects = queryRows(db, 'SELECT * FROM projects ORDER BY id');
  const projectCategories = queryRows(db, 'SELECT * FROM project_categories');
  const attachments = queryRows(db, 'SELECT * FROM attachments ORDER BY id');
  const warnings = [];

  const projectCategoryMap = new Map();
  projectCategories.forEach((row) => {
    const projectId = Number(row.project_id);
    if (!projectCategoryMap.has(projectId)) projectCategoryMap.set(projectId, []);
    projectCategoryMap.get(projectId).push(Number(row.category_id));
  });

  const attachmentMap = new Map();
  attachments.forEach((row) => {
    const projectId = Number(row.project_id);
    if (!attachmentMap.has(projectId)) attachmentMap.set(projectId, []);
    attachmentMap.get(projectId).push(row);
  });

  const importedProjects = [];
  let nextAttachmentId = Math.max(1, ...attachments.map((row) => Number(row.id) || 0)) + 1;
  for (const project of projects) {
    const projectId = Number(project.id);
    const projectAttachments = [];
    for (const attachment of attachmentMap.get(projectId) || []) {
      try {
        const parts = filePathToParts(attachment.file_path);
        const file = await readNestedFile(directoryHandle, ['attachments', ...parts]);
        const normalizedId = Number(attachment.id) || nextAttachmentId++;
        const uploaded = await uploadAttachmentFile(file, {
          projectId,
          attachmentId: normalizedId,
          fileName: file.name,
        });
        projectAttachments.push({
          id: normalizedId,
          displayName: normalizeText(attachment.display_name || file.name),
          fileName: normalizeText(file.name),
          mimeType: attachment.mime_type || file.type || 'application/octet-stream',
          fileSize: Number.isFinite(Number(attachment.file_size)) ? Number(attachment.file_size) : file.size,
          uploadedAt: attachment.uploaded_at || toIsoNow(),
          pathname: uploaded.pathname || '',
        });
      } catch (error) {
        const displayName = normalizeText(attachment.display_name || attachment.file_path || '첨부 파일');
        warnings.push({
          type: 'attachment',
          projectId,
          attachmentId: Number(attachment.id) || null,
          displayName,
          filePath: String(attachment.file_path || ''),
          message: error?.message || '첨부를 가져오지 못했습니다.',
        });
        console.warn('[records import] attachment skipped:', {
          projectId,
          attachmentId: attachment.id,
          filePath: attachment.file_path,
          error: error?.message || error,
        });
      }
    }

    importedProjects.push({
      id: projectId,
      corporationName: normalizeText(project.corporation_name),
      projectName: normalizeText(project.project_name),
      clientName: normalizeText(project.client_name),
      startDate: project.start_date || null,
      endDate: project.end_date || null,
      contractAmount: project.contract_amount === null || project.contract_amount === undefined || project.contract_amount === ''
        ? null
        : Number(project.contract_amount),
      scopeNotes: project.scope_notes || '',
      primaryCompanyId: Number.isInteger(Number(project.primary_company_id)) && Number(project.primary_company_id) > 0
        ? Number(project.primary_company_id)
        : null,
      categoryIds: (projectCategoryMap.get(projectId) || []).map(Number),
      attachments: projectAttachments,
      createdAt: project.created_at || toIsoNow(),
      updatedAt: project.updated_at || project.created_at || toIsoNow(),
    });
  }

  const nextIds = {
    company: Math.max(1, ...companies.map((row) => Number(row.id) || 0)) + 1,
    category: Math.max(1, ...categories.map((row) => Number(row.id) || 0)) + 1,
    project: Math.max(1, ...projects.map((row) => Number(row.id) || 0)) + 1,
    attachment: Math.max(1, ...attachments.map((row) => Number(row.id) || 0)) + 1,
  };

  return {
    state: normalizeState({
      version: 2,
      nextIds,
      companies: companies.map((row) => ({
      id: Number(row.id),
      name: normalizeText(row.name),
      alias: normalizeText(row.alias),
      isPrimary: !!row.is_primary,
      isMisc: !!row.is_misc,
      active: row.active !== 0,
      sortOrder: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0,
      createdAt: row.created_at || toIsoNow(),
      updatedAt: row.updated_at || row.created_at || toIsoNow(),
    })),
    categories: categories.map((row) => ({
      id: Number(row.id),
      name: normalizeText(row.name),
      parentId: Number.isInteger(Number(row.parent_id)) && Number(row.parent_id) > 0 ? Number(row.parent_id) : null,
      active: row.active !== 0,
      sortOrder: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0,
      createdAt: row.created_at || toIsoNow(),
      updatedAt: row.updated_at || row.created_at || toIsoNow(),
      })),
      projects: importedProjects,
    }),
    stats: {
      companies: companies.length,
      categories: categories.length,
      projects: importedProjects.length,
      attachments: attachments.length,
      importedAttachments: importedProjects.reduce((sum, item) => sum + item.attachments.length, 0),
      skippedAttachments: warnings.length,
    },
    warnings,
  };
};

export const recordsWebStore = {
  async listCompanies(options = {}) {
    const state = await fetchState();
    return sortByOrderThenName(state.companies)
      .filter((item) => options.includeInactive || item.active !== false)
      .map((item) => clone(item));
  },

  async saveCompany(payload = {}) {
    const state = await fetchState();
    const name = normalizeText(payload.name);
    if (!name) throw new Error('법인명을 입력해 주세요.');
    uniqueNameGuard(state.companies, { ...payload, name }, '이미 등록된 법인명입니다.');

    const now = toIsoNow();
    if (payload.id) {
      const index = state.companies.findIndex((item) => item.id === Number(payload.id));
      if (index < 0) throw new Error('수정할 법인을 찾을 수 없습니다.');
      state.companies[index] = {
        ...state.companies[index],
        name,
        alias: normalizeText(payload.alias || name),
        isPrimary: !!payload.isPrimary,
        isMisc: !!payload.isMisc,
        active: normalizeBoolean(payload.active, true),
        sortOrder: Number.isFinite(payload.sortOrder) ? payload.sortOrder : state.companies[index].sortOrder,
        updatedAt: now,
      };
      await persistState(state);
      return clone(state.companies[index]);
    }

    const next = {
      id: state.nextIds.company++,
      name,
      alias: normalizeText(payload.alias || name),
      isPrimary: !!payload.isPrimary,
      isMisc: !!payload.isMisc,
      active: normalizeBoolean(payload.active, true),
      sortOrder: Number.isFinite(payload.sortOrder) ? payload.sortOrder : state.companies.length,
      createdAt: now,
      updatedAt: now,
    };
    state.companies.push(next);
    await persistState(state);
    return clone(next);
  },

  async deleteCompany(id) {
    const state = await fetchState();
    const targetId = Number(id);
    const beforeLength = state.companies.length;
    state.companies = state.companies.filter((item) => item.id !== targetId);
    if (state.companies.length === beforeLength) return false;
    state.projects = state.projects.map((project) => (
      project.primaryCompanyId === targetId
        ? { ...project, primaryCompanyId: null, updatedAt: toIsoNow() }
        : project
    ));
    await persistState(state);
    return true;
  },

  async listCategories(options = {}) {
    const state = await fetchState();
    return sortByOrderThenName(state.categories)
      .filter((item) => options.includeInactive || item.active !== false)
      .map((item) => clone(item));
  },

  async saveCategory(payload = {}) {
    const state = await fetchState();
    const name = normalizeText(payload.name);
    if (!name) throw new Error('공사 종류명을 입력해 주세요.');
    uniqueNameGuard(state.categories, { ...payload, name }, '이미 등록된 공사 종류명입니다.');

    const now = toIsoNow();
    const normalizedParentId = Number.isInteger(payload.parentId) && payload.parentId > 0 ? payload.parentId : null;
    if (payload.id) {
      const index = state.categories.findIndex((item) => item.id === Number(payload.id));
      if (index < 0) throw new Error('수정할 공사 종류를 찾을 수 없습니다.');
      state.categories[index] = {
        ...state.categories[index],
        name,
        parentId: payload.parentId !== undefined ? normalizedParentId : state.categories[index].parentId,
        active: normalizeBoolean(payload.active, true),
        sortOrder: Number.isFinite(payload.sortOrder) ? payload.sortOrder : state.categories[index].sortOrder,
        updatedAt: now,
      };
      await persistState(state);
      return clone(state.categories[index]);
    }

    const next = {
      id: state.nextIds.category++,
      name,
      parentId: normalizedParentId,
      active: normalizeBoolean(payload.active, true),
      sortOrder: Number.isFinite(payload.sortOrder) ? payload.sortOrder : state.categories.length,
      createdAt: now,
      updatedAt: now,
    };
    state.categories.push(next);
    await persistState(state);
    return clone(next);
  },

  async reorderCategories(parentId, orderedIds = []) {
    const state = await fetchState();
    const normalizedParentId = Number.isInteger(parentId) && parentId > 0 ? parentId : null;
    const siblings = state.categories.filter((item) => (
      (item.parentId ?? null) === normalizedParentId
    ));
    if (siblings.length === 0) return [];

    const siblingIds = new Set(siblings.map((item) => item.id));
    const requestedIds = orderedIds
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && siblingIds.has(value));
    if (requestedIds.length !== siblings.length) {
      throw new Error('공사 종류 순서를 변경할 수 없습니다.');
    }

    const now = toIsoNow();
    const orderLookup = new Map(requestedIds.map((id, index) => [id, index]));
    state.categories = state.categories.map((item) => {
      if (!siblingIds.has(item.id)) return item;
      return {
        ...item,
        sortOrder: orderLookup.get(item.id) ?? item.sortOrder,
        updatedAt: now,
      };
    });

    await persistState(state);

    return sortByOrderThenName(
      state.categories.filter((item) => (item.parentId ?? null) === normalizedParentId)
    ).map((item) => clone(item));
  },

  async deleteCategory(id) {
    const state = await fetchState();
    const targetId = Number(id);
    const childMap = new Map();
    state.categories.forEach((item) => {
      const parentKey = item.parentId ?? 0;
      if (!childMap.has(parentKey)) childMap.set(parentKey, []);
      childMap.get(parentKey).push(item.id);
    });
    const removeIds = new Set();
    const walk = (currentId) => {
      removeIds.add(currentId);
      (childMap.get(currentId) || []).forEach(walk);
    };
    walk(targetId);

    const beforeLength = state.categories.length;
    state.categories = state.categories.filter((item) => !removeIds.has(item.id));
    if (state.categories.length === beforeLength) return false;
    state.projects = state.projects.map((project) => ({
      ...project,
      categoryIds: project.categoryIds.filter((categoryId) => !removeIds.has(categoryId)),
      updatedAt: project.categoryIds.some((categoryId) => removeIds.has(categoryId)) ? toIsoNow() : project.updatedAt,
    }));
    await persistState(state);
    return true;
  },

  async listProjects(filters = {}) {
    const state = await fetchState();
    const result = state.projects.filter((project) => {
      if (!matchKeyword(project, filters.keyword)) return false;
      if (Array.isArray(filters.companyIds) && filters.companyIds.length > 0 && !filters.companyIds.includes(project.primaryCompanyId)) return false;
      if (Array.isArray(filters.categoryIds) && filters.categoryIds.length > 0 && !filters.categoryIds.some((id) => project.categoryIds.includes(id))) return false;
      const company = state.companies.find((item) => item.id === project.primaryCompanyId) || null;
      if (filters.companyType === 'misc' && !company?.isMisc) return false;
      if (filters.companyType === 'our' && company?.isMisc) return false;
      if (filters.startDateFrom && project.startDate && project.startDate < filters.startDateFrom) return false;
      if (filters.startDateTo && project.startDate && project.startDate > filters.startDateTo) return false;
      return true;
    });

    return result
      .sort((a, b) => {
        const aHasStart = !!a.startDate;
        const bHasStart = !!b.startDate;
        if (aHasStart !== bHasStart) return aHasStart ? -1 : 1;
        const startCompare = String(b.startDate || '').localeCompare(String(a.startDate || ''));
        if (startCompare !== 0) return startCompare;
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      })
      .map((project) => hydrateProject(project, state));
  },

  async getProject(id) {
    const state = await fetchState();
    const project = state.projects.find((item) => item.id === Number(id));
    return project ? hydrateProject(project, state) : null;
  },

  async createProject(payload = {}) {
    const state = await fetchState();
    const now = toIsoNow();
    const projectId = state.nextIds.project++;
    const attachments = await Promise.all(
      (Array.isArray(payload.attachments) ? payload.attachments : []).map(async (attachment) => {
        const attachmentId = state.nextIds.attachment++;
        const fileName = normalizeText(attachment.originalName || attachment.displayName || 'attachment');
        const file = createBrowserFile(attachment.buffer, fileName, attachment.mimeType);
        const uploaded = await uploadAttachmentFile(file, { projectId, attachmentId, fileName });
        return {
          id: attachmentId,
          displayName: fileName,
          fileName,
          mimeType: attachment.mimeType || 'application/octet-stream',
          fileSize: attachment.buffer?.byteLength ?? file.size,
          uploadedAt: now,
          pathname: uploaded.pathname || '',
        };
      }),
    );

    const next = {
      id: projectId,
      corporationName: normalizeText(payload.corporationName),
      projectName: normalizeText(payload.projectName),
      clientName: normalizeText(payload.clientName),
      startDate: payload.startDate || null,
      endDate: payload.endDate || null,
      contractAmount: payload.contractAmount === null || payload.contractAmount === undefined ? null : Number(payload.contractAmount),
      scopeNotes: payload.scopeNotes || '',
      primaryCompanyId: Number.isInteger(payload.primaryCompanyId) && payload.primaryCompanyId > 0 ? payload.primaryCompanyId : null,
      categoryIds: Array.isArray(payload.categoryIds) ? payload.categoryIds.map(Number).filter((value) => Number.isInteger(value) && value > 0) : [],
      attachments,
      createdAt: now,
      updatedAt: now,
    };
    state.projects.push(next);
    await persistState(state);
    const hydrated = hydrateProject(next, state);
    emitProjectSaved({ projectId: hydrated.id, mode: 'create' });
    return hydrated;
  },

  async updateProject(id, payload = {}) {
    const state = await fetchState();
    const index = state.projects.findIndex((item) => item.id === Number(id));
    if (index < 0) throw new Error('수정할 실적을 찾을 수 없습니다.');
    const current = state.projects[index];
    const now = toIsoNow();
    const newAttachments = await Promise.all(
      (Array.isArray(payload.attachments) ? payload.attachments : []).map(async (attachment) => {
        const attachmentId = state.nextIds.attachment++;
        const fileName = normalizeText(attachment.originalName || attachment.displayName || 'attachment');
        const file = createBrowserFile(attachment.buffer, fileName, attachment.mimeType);
        const uploaded = await uploadAttachmentFile(file, {
          projectId: current.id,
          attachmentId,
          fileName,
        });
        return {
          id: attachmentId,
          displayName: fileName,
          fileName,
          mimeType: attachment.mimeType || 'application/octet-stream',
          fileSize: attachment.buffer?.byteLength ?? file.size,
          uploadedAt: now,
          pathname: uploaded.pathname || '',
        };
      }),
    );
    state.projects[index] = {
      ...current,
      corporationName: normalizeText(payload.corporationName),
      projectName: normalizeText(payload.projectName),
      clientName: normalizeText(payload.clientName),
      startDate: payload.startDate || null,
      endDate: payload.endDate || null,
      contractAmount: payload.contractAmount === null || payload.contractAmount === undefined ? null : Number(payload.contractAmount),
      scopeNotes: payload.scopeNotes || '',
      primaryCompanyId: Number.isInteger(payload.primaryCompanyId) && payload.primaryCompanyId > 0 ? payload.primaryCompanyId : null,
      categoryIds: Array.isArray(payload.categoryIds) ? payload.categoryIds.map(Number).filter((value) => Number.isInteger(value) && value > 0) : [],
      attachments: [...current.attachments, ...newAttachments],
      updatedAt: now,
    };
    await persistState(state);
    const hydrated = hydrateProject(state.projects[index], state);
    emitProjectSaved({ projectId: hydrated.id, mode: 'edit' });
    return hydrated;
  },

  async deleteProject(id) {
    const state = await fetchState();
    const beforeLength = state.projects.length;
    state.projects = state.projects.filter((item) => item.id !== Number(id));
    if (state.projects.length === beforeLength) return false;
    await persistState(state);
    return true;
  },

  async removeAttachment(projectId, attachmentId) {
    const state = await fetchState();
    const project = state.projects.find((item) => item.id === Number(projectId));
    if (!project) throw new Error('실적을 찾을 수 없습니다.');
    const beforeLength = project.attachments.length;
    project.attachments = project.attachments.filter((item) => item.id !== Number(attachmentId));
    if (project.attachments.length === beforeLength) return false;
    project.updatedAt = toIsoNow();
    await persistState(state);
    return true;
  },

  async addAttachments(projectId, attachments = []) {
    const state = await fetchState();
    const project = state.projects.find((item) => item.id === Number(projectId));
    if (!project) throw new Error('실적을 찾을 수 없습니다.');
    const now = toIsoNow();
    const uploadedAttachments = await Promise.all(
      attachments.map(async (attachment) => {
        const attachmentId = state.nextIds.attachment++;
        const fileName = normalizeText(attachment.originalName || attachment.displayName || 'attachment');
        const file = createBrowserFile(attachment.buffer, fileName, attachment.mimeType);
        const uploaded = await uploadAttachmentFile(file, { projectId: project.id, attachmentId, fileName });
        return {
          id: attachmentId,
          displayName: fileName,
          fileName,
          mimeType: attachment.mimeType || 'application/octet-stream',
          fileSize: attachment.buffer?.byteLength ?? file.size,
          uploadedAt: now,
          pathname: uploaded.pathname || '',
        };
      }),
    );
    project.attachments.push(...uploadedAttachments);
    project.updatedAt = now;
    await persistState(state);
    return uploadedAttachments.map(hydrateAttachment);
  },

  openEditorWindow(payload = {}) {
    const params = new URLSearchParams();
    if (payload.mode === 'edit') params.set('mode', 'edit');
    if (payload.projectId) params.set('projectId', String(payload.projectId));
    if (payload.defaultCompanyId) params.set('defaultCompanyId', String(payload.defaultCompanyId));
    if (payload.defaultCompanyType) params.set('defaultCompanyType', String(payload.defaultCompanyType));
    const hash = `#/records-editor${params.toString() ? `?${params.toString()}` : ''}`;
    const popup = window.open(hash, 'company-search-records-editor-route', 'width=1280,height=900,resizable=yes,scrollbars=yes');
    if (!popup) {
      window.location.hash = hash;
      return { opened: false, fallback: 'same-window' };
    }
    popup.focus?.();
    return { opened: true };
  },

  notifyProjectSaved(payload = {}) {
    emitProjectSaved(payload);
  },

  onProjectSaved(callback) {
    const handler = (event) => callback?.(event?.detail || {});
    window.addEventListener(PROJECT_SAVED_EVENT, handler);
    if (!broadcastChannel) {
      broadcastChannel = createChannel();
    }
    const channelHandler = (event) => {
      if (event?.data?.type === PROJECT_SAVED_EVENT) {
        callback?.(event.data.payload || {});
      }
    };
    broadcastChannel?.addEventListener?.('message', channelHandler);
    return () => {
      window.removeEventListener(PROJECT_SAVED_EVENT, handler);
      broadcastChannel?.removeEventListener?.('message', channelHandler);
    };
  },

  async openAttachment(projectId, attachmentId) {
    const project = await this.getProject(projectId);
    const target = Array.isArray(project?.attachments)
      ? project.attachments.find((item) => item.id === Number(attachmentId))
      : project?.attachment || null;
    const href = target?.pathname
      ? `/api/records?action=file&pathname=${encodeURIComponent(target.pathname)}`
      : (target?.filePath || '');
    if (!href) {
      throw new Error('첨부 파일을 찾을 수 없습니다.');
    }
    window.open(href, '_blank', 'noopener,noreferrer');
    return true;
  },

  async exportDatabase() {
    const state = await fetchState({ force: true });
    const payload = {
      version: state.version || 2,
      exportedAt: toIsoNow(),
      data: state,
    };
    const fileName = `records-export-${new Date().toISOString().slice(0, 10)}.json`;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { canceled: false, path: fileName, exportedPath: fileName, includedAttachments: false };
  },

  async importDatabase() {
    if (typeof window.showDirectoryPicker !== 'function') {
      throw new Error('이 브라우저에서는 폴더 가져오기를 지원하지 않습니다. Chrome 또는 Edge에서 시도해 주세요.');
    }
    const directoryHandle = await window.showDirectoryPicker({ mode: 'read' });
    const dbHandle = await directoryHandle.getFileHandle('records.sqlite');
    const dbFile = await dbHandle.getFile();
    const dbBuffer = await dbFile.arrayBuffer();
    const SQL = await getSqlJs();
    const db = new SQL.Database(new Uint8Array(dbBuffer));
    try {
      const importedResult = await buildImportedStateFromDatabase(db, directoryHandle);
      await persistState(importedResult.state);
      emitProjectSaved({ projectId: null, mode: 'import' });
      return {
        canceled: false,
        fileName: dbFile.name,
        attachmentsImported: importedResult.stats.importedAttachments > 0,
        stats: importedResult.stats,
        warnings: importedResult.warnings,
      };
    } finally {
      db.close();
    }
  },
};

export default recordsWebStore;

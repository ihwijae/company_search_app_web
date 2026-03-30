import defaults from '../main/features/records/defaults.json';
import { loadPersisted, savePersisted } from './persistence.js';

const STORAGE_KEY = 'records:web-store:v1';
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

const arrayBufferToDataUrl = async (buffer, mimeType = 'application/octet-stream') => {
  const blob = new Blob([buffer], { type: mimeType || 'application/octet-stream' });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('파일을 읽을 수 없습니다.'));
    reader.readAsDataURL(blob);
  });
};

const downloadBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const openJsonFilePicker = () => new Promise((resolve, reject) => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.style.display = 'none';
  input.addEventListener('change', async () => {
    const [file] = Array.from(input.files || []);
    input.remove();
    if (!file) {
      resolve(null);
      return;
    }
    try {
      const text = await file.text();
      resolve({ file, payload: JSON.parse(text) });
    } catch (error) {
      reject(error);
    }
  }, { once: true });
  document.body.appendChild(input);
  input.click();
});

const createChannel = () => {
  if (typeof BroadcastChannel === 'undefined') return null;
  try {
    return new BroadcastChannel(CHANNEL_NAME);
  } catch {
    return null;
  }
};

let broadcastChannel = null;

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

const uniqueNameGuard = (items, payload, message) => {
  const targetName = normalizeText(payload?.name).toLowerCase();
  const duplicate = items.find((item) => (
    normalizeText(item.name).toLowerCase() === targetName
    && Number(item.id) !== Number(payload?.id || 0)
  ));
  if (duplicate) {
    throw new Error(message);
  }
};

const buildInitialState = () => {
  const createdAt = toIsoNow();
  const state = {
    version: 1,
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

let cachedState = null;

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
    version: 1,
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
      attachments: Array.isArray(item.attachments)
        ? item.attachments.map((attachment) => ({
          id: Number(attachment.id),
          displayName: normalizeText(attachment.displayName),
          fileName: normalizeText(attachment.fileName || attachment.displayName),
          mimeType: attachment.mimeType || 'application/octet-stream',
          fileSize: Number.isFinite(attachment.fileSize) ? attachment.fileSize : null,
          dataUrl: attachment.dataUrl || '',
          uploadedAt: attachment.uploadedAt || toIsoNow(),
        }))
        : [],
      createdAt: item.createdAt || toIsoNow(),
      updatedAt: item.updatedAt || item.createdAt || toIsoNow(),
    })),
  };
};

const getState = () => {
  if (cachedState) return cachedState;
  cachedState = normalizeState(loadPersisted(STORAGE_KEY, null));
  return cachedState;
};

const saveState = (nextState) => {
  cachedState = normalizeState(nextState);
  savePersisted(STORAGE_KEY, cachedState);
  return cachedState;
};

const makeCategoryLookup = (categories) => {
  const map = new Map();
  categories.forEach((item) => {
    map.set(item.id, item);
  });
  return map;
};

const hydrateAttachment = (attachment) => ({
  id: attachment.id,
  displayName: attachment.displayName,
  fileName: attachment.fileName || attachment.displayName,
  filePath: attachment.dataUrl,
  relativePath: attachment.fileName || attachment.displayName,
  mimeType: attachment.mimeType || 'application/octet-stream',
  fileSize: attachment.fileSize ?? null,
  uploadedAt: attachment.uploadedAt,
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

const pickImportState = (payload) => {
  if (payload && typeof payload === 'object' && payload.version === 1) return payload;
  if (payload && typeof payload === 'object' && payload.data && typeof payload.data === 'object') return payload.data;
  throw new Error('가져올 실적 데이터 형식이 올바르지 않습니다.');
};

export const recordsWebStore = {
  listCompanies(options = {}) {
    const state = getState();
    return sortByOrderThenName(state.companies)
      .filter((item) => options.includeInactive || item.active !== false)
      .map((item) => clone(item));
  },

  saveCompany(payload = {}) {
    const state = getState();
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
      saveState(state);
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
    saveState(state);
    return clone(next);
  },

  deleteCompany(id) {
    const state = getState();
    const targetId = Number(id);
    const beforeLength = state.companies.length;
    state.companies = state.companies.filter((item) => item.id !== targetId);
    if (state.companies.length === beforeLength) return false;
    state.projects = state.projects.map((project) => (
      project.primaryCompanyId === targetId
        ? {
          ...project,
          primaryCompanyId: null,
          updatedAt: toIsoNow(),
        }
        : project
    ));
    saveState(state);
    return true;
  },

  listCategories(options = {}) {
    const state = getState();
    return sortByOrderThenName(state.categories)
      .filter((item) => options.includeInactive || item.active !== false)
      .map((item) => clone(item));
  },

  saveCategory(payload = {}) {
    const state = getState();
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
      saveState(state);
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
    saveState(state);
    return clone(next);
  },

  deleteCategory(id) {
    const state = getState();
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
    saveState(state);
    return true;
  },

  listProjects(filters = {}) {
    const state = getState();
    const result = state.projects.filter((project) => {
      if (!matchKeyword(project, filters.keyword)) return false;
      if (Array.isArray(filters.companyIds) && filters.companyIds.length > 0 && !filters.companyIds.includes(project.primaryCompanyId)) {
        return false;
      }
      if (Array.isArray(filters.categoryIds) && filters.categoryIds.length > 0 && !filters.categoryIds.some((id) => project.categoryIds.includes(id))) {
        return false;
      }
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

  getProject(id) {
    const state = getState();
    const project = state.projects.find((item) => item.id === Number(id));
    return project ? hydrateProject(project, state) : null;
  },

  async createProject(payload = {}) {
    const state = getState();
    const now = toIsoNow();
    const attachments = await Promise.all(
      (Array.isArray(payload.attachments) ? payload.attachments : []).map(async (attachment) => ({
        id: state.nextIds.attachment++,
        displayName: normalizeText(attachment.originalName || attachment.displayName || '첨부 파일'),
        fileName: normalizeText(attachment.originalName || attachment.displayName || 'attachment'),
        mimeType: attachment.mimeType || 'application/octet-stream',
        fileSize: attachment.buffer?.byteLength ?? null,
        dataUrl: await arrayBufferToDataUrl(attachment.buffer, attachment.mimeType),
        uploadedAt: now,
      })),
    );

    const next = {
      id: state.nextIds.project++,
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
    saveState(state);
    const hydrated = hydrateProject(next, state);
    emitProjectSaved({ projectId: hydrated.id, mode: 'create' });
    return hydrated;
  },

  async updateProject(id, payload = {}) {
    const state = getState();
    const index = state.projects.findIndex((item) => item.id === Number(id));
    if (index < 0) throw new Error('수정할 실적을 찾을 수 없습니다.');
    const current = state.projects[index];
    const now = toIsoNow();
    const newAttachments = await Promise.all(
      (Array.isArray(payload.attachments) ? payload.attachments : []).map(async (attachment) => ({
        id: state.nextIds.attachment++,
        displayName: normalizeText(attachment.originalName || attachment.displayName || '첨부 파일'),
        fileName: normalizeText(attachment.originalName || attachment.displayName || 'attachment'),
        mimeType: attachment.mimeType || 'application/octet-stream',
        fileSize: attachment.buffer?.byteLength ?? null,
        dataUrl: await arrayBufferToDataUrl(attachment.buffer, attachment.mimeType),
        uploadedAt: now,
      })),
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
    saveState(state);
    const hydrated = hydrateProject(state.projects[index], state);
    emitProjectSaved({ projectId: hydrated.id, mode: 'edit' });
    return hydrated;
  },

  deleteProject(id) {
    const state = getState();
    const beforeLength = state.projects.length;
    state.projects = state.projects.filter((item) => item.id !== Number(id));
    if (state.projects.length === beforeLength) return false;
    saveState(state);
    return true;
  },

  removeAttachment(projectId, attachmentId) {
    const state = getState();
    const project = state.projects.find((item) => item.id === Number(projectId));
    if (!project) throw new Error('실적을 찾을 수 없습니다.');
    const beforeLength = project.attachments.length;
    project.attachments = project.attachments.filter((item) => item.id !== Number(attachmentId));
    if (project.attachments.length === beforeLength) return false;
    project.updatedAt = toIsoNow();
    saveState(state);
    return true;
  },

  async addAttachments(projectId, attachments = []) {
    const state = getState();
    const project = state.projects.find((item) => item.id === Number(projectId));
    if (!project) throw new Error('실적을 찾을 수 없습니다.');
    const now = toIsoNow();
    const newAttachments = await Promise.all(
      attachments.map(async (attachment) => ({
        id: state.nextIds.attachment++,
        displayName: normalizeText(attachment.originalName || attachment.displayName || '첨부 파일'),
        fileName: normalizeText(attachment.originalName || attachment.displayName || 'attachment'),
        mimeType: attachment.mimeType || 'application/octet-stream',
        fileSize: attachment.buffer?.byteLength ?? null,
        dataUrl: await arrayBufferToDataUrl(attachment.buffer, attachment.mimeType),
        uploadedAt: now,
      })),
    );
    project.attachments.push(...newAttachments);
    project.updatedAt = now;
    saveState(state);
    return newAttachments.map(hydrateAttachment);
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

  openAttachment(projectId, attachmentId) {
    const project = this.getProject(projectId);
    const target = Array.isArray(project?.attachments)
      ? project.attachments.find((item) => item.id === Number(attachmentId))
      : project?.attachment || null;
    if (!target?.filePath) {
      throw new Error('첨부 파일을 찾을 수 없습니다.');
    }

    const link = document.createElement('a');
    link.href = target.filePath;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.download = target.displayName || 'attachment';
    document.body.appendChild(link);
    link.click();
    link.remove();
    return true;
  },

  exportDatabase() {
    const state = getState();
    const payload = {
      version: 1,
      exportedAt: toIsoNow(),
      data: state,
    };
    const fileName = `records-export-${new Date().toISOString().slice(0, 10)}.json`;
    downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), fileName);
    return {
      canceled: false,
      path: fileName,
      exportedPath: fileName,
      includedAttachments: state.projects.some((item) => Array.isArray(item.attachments) && item.attachments.length > 0),
    };
  },

  async importDatabase() {
    const result = await openJsonFilePicker();
    if (!result) return { canceled: true };
    const importedState = normalizeState(pickImportState(result.payload));
    saveState(importedState);
    emitProjectSaved({ projectId: null, mode: 'import' });
    return {
      canceled: false,
      fileName: result.file.name,
      attachmentsImported: importedState.projects.some((item) => Array.isArray(item.attachments) && item.attachments.length > 0),
    };
  },
};

export default recordsWebStore;

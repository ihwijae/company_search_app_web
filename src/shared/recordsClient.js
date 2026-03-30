import recordsWebStore from './recordsWebStore.js';

const wrapInvoke = async (method, ...args) => {
  const webMethod = recordsWebStore[method];
  if (typeof webMethod !== 'function') {
    throw new Error(`records web method ${method} is not available`);
  }
  return webMethod.apply(recordsWebStore, args);
};

const wrapEvent = (method, ...args) => {
  const webMethod = recordsWebStore[method];
  if (typeof webMethod !== 'function') {
    throw new Error(`records web method ${method} is not available`);
  }
  return webMethod.apply(recordsWebStore, args);
};

export const recordsClient = {
  listProjects: (filters) => wrapInvoke('listProjects', filters),
  getProject: (id) => wrapInvoke('getProject', id),
  createProject: (payload) => wrapInvoke('createProject', payload),
  updateProject: (id, data) => wrapInvoke('updateProject', id, data),
  deleteProject: (id) => wrapInvoke('deleteProject', id),
  openEditorWindow: (payload) => wrapInvoke('openEditorWindow', payload),
  notifyProjectSaved: (payload) => wrapEvent('notifyProjectSaved', payload),
  onProjectSaved: (callback) => wrapEvent('onProjectSaved', callback),
  removeAttachment: (projectId, attachmentId) => wrapInvoke('removeAttachment', projectId, attachmentId),
  addAttachments: (projectId, attachments) => wrapInvoke('addAttachments', projectId, attachments),
  listCompanies: (options) => wrapInvoke('listCompanies', options),
  saveCompany: (payload) => wrapInvoke('saveCompany', payload),
  deleteCompany: (id) => wrapInvoke('deleteCompany', id),
  listCategories: (options) => wrapInvoke('listCategories', options),
  saveCategory: (payload) => wrapInvoke('saveCategory', payload),
  deleteCategory: (id) => wrapInvoke('deleteCategory', id),
  openAttachment: (projectId, attachmentId) => wrapInvoke('openAttachment', projectId, attachmentId),
  exportDatabase: () => wrapInvoke('exportDatabase'),
  importDatabase: () => wrapInvoke('importDatabase'),
};

export default recordsClient;

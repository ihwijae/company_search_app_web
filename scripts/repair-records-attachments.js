#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const { put } = require('@vercel/blob');
const { readRecordsDocument, writeRecordsDocument } = require('../api/_lib/records-store');
const { resolveToken } = require('../api/_lib/blob-store');

const SOURCE_DIR = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(process.cwd(), '실적관리');

function normalizeText(value) {
  return String(value || '').trim();
}

function queryRows(db, sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

async function uploadAttachment(absolutePath, pathname, mimeType) {
  const token = resolveToken();
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not configured');
  const buffer = fs.readFileSync(absolutePath);
  return put(pathname, buffer, {
    access: 'private',
    contentType: mimeType || undefined,
    addRandomSuffix: false,
    allowOverwrite: true,
    token,
  });
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function upsertCompany(companies, nextCompany) {
  const existing = companies.find((item) => item.id === nextCompany.id);
  if (existing) return;
  companies.push(nextCompany);
}

function upsertProject(projects, nextProject) {
  const index = projects.findIndex((item) => item.id === nextProject.id);
  if (index >= 0) {
    projects[index] = nextProject;
    return;
  }
  projects.push(nextProject);
}

async function main() {
  const token = resolveToken();
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not configured');
  const dbPath = path.join(SOURCE_DIR, 'records.sqlite');
  if (!fs.existsSync(dbPath)) throw new Error(`records.sqlite not found: ${dbPath}`);

  const SQL = await initSqlJs({
    locateFile: (file) => require.resolve(`sql.js/dist/${file}`),
  });
  const db = new SQL.Database(fs.readFileSync(dbPath));

  try {
    const companies = queryRows(db, 'SELECT * FROM companies ORDER BY sort_order, name');
    const projects = queryRows(db, 'SELECT * FROM projects ORDER BY id');
    const categoriesByProject = queryRows(db, 'SELECT project_id, category_id FROM project_categories ORDER BY project_id, category_id');
    const attachments = queryRows(db, 'SELECT * FROM attachments ORDER BY project_id, id');

    const categoryMap = new Map();
    categoriesByProject.forEach((row) => {
      const projectId = Number(row.project_id);
      if (!categoryMap.has(projectId)) categoryMap.set(projectId, []);
      categoryMap.get(projectId).push(Number(row.category_id));
    });

    const attachmentMap = new Map();
    attachments.forEach((row) => {
      const projectId = Number(row.project_id);
      if (!attachmentMap.has(projectId)) attachmentMap.set(projectId, []);
      attachmentMap.get(projectId).push(row);
    });

    const current = await readRecordsDocument();
    if (!current) throw new Error('current records document is missing in Blob');
    current.companies = ensureArray(current.companies);
    current.projects = ensureArray(current.projects);
    current.nextIds = current.nextIds || {};

    let uploadedCount = 0;
    let repairedProjects = 0;

    for (const company of companies) {
      upsertCompany(current.companies, {
        id: Number(company.id),
        name: normalizeText(company.name),
        alias: normalizeText(company.alias),
        isPrimary: !!company.is_primary,
        isMisc: !!company.is_misc,
        active: company.active !== 0,
        sortOrder: Number.isFinite(Number(company.sort_order)) ? Number(company.sort_order) : 0,
        createdAt: company.created_at || new Date().toISOString(),
        updatedAt: company.updated_at || company.created_at || new Date().toISOString(),
      });
    }

    for (const project of projects) {
      const projectId = Number(project.id);
      const existingProject = current.projects.find((item) => item.id === projectId) || null;
      const existingAttachments = ensureArray(existingProject?.attachments);
      const existingAttachmentIds = new Set(existingAttachments.map((item) => Number(item.id)));
      const sourceAttachments = attachmentMap.get(projectId) || [];
      const nextAttachments = [...existingAttachments];
      let projectChanged = false;

      for (const attachment of sourceAttachments) {
        const attachmentId = Number(attachment.id);
        if (existingAttachmentIds.has(attachmentId)) continue;

        const relativeFilePath = String(attachment.file_path || '').replace(/\\/g, path.sep);
        const absolutePath = path.join(SOURCE_DIR, 'attachments', relativeFilePath);
        if (!fs.existsSync(absolutePath)) {
          throw new Error(`Missing attachment file: ${absolutePath}`);
        }

        const fileName = path.basename(absolutePath);
        const pathname = `company-search/records/attachments/${projectId}/${attachmentId}-${fileName}`;
        const uploaded = await uploadAttachment(absolutePath, pathname, attachment.mime_type || undefined);
        nextAttachments.push({
          id: attachmentId,
          displayName: normalizeText(attachment.display_name || fileName),
          fileName,
          mimeType: attachment.mime_type || 'application/octet-stream',
          fileSize: Number.isFinite(Number(attachment.file_size)) ? Number(attachment.file_size) : fs.statSync(absolutePath).size,
          uploadedAt: attachment.uploaded_at || new Date().toISOString(),
          blobPathname: uploaded.pathname || '',
          url: uploaded.url || '',
          downloadUrl: uploaded.downloadUrl || uploaded.url || '',
        });
        uploadedCount += 1;
        projectChanged = true;
      }

      const nextProject = {
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
        categoryIds: categoryMap.get(projectId) || [],
        attachments: nextAttachments,
        createdAt: project.created_at || existingProject?.createdAt || new Date().toISOString(),
        updatedAt: project.updated_at || existingProject?.updatedAt || project.created_at || new Date().toISOString(),
      };

      const sourceCount = sourceAttachments.length;
      const targetCount = nextAttachments.length;
      if (!existingProject || projectChanged || sourceCount !== targetCount) {
        upsertProject(current.projects, nextProject);
        repairedProjects += 1;
        await writeRecordsDocument(current);
      }
    }

    current.nextIds.company = Math.max(current.nextIds.company || 1, ...current.companies.map((item) => Number(item.id) || 0)) + 1;
    current.nextIds.project = Math.max(current.nextIds.project || 1, ...current.projects.map((item) => Number(item.id) || 0)) + 1;
    current.nextIds.attachment = Math.max(
      current.nextIds.attachment || 1,
      ...current.projects.flatMap((item) => ensureArray(item.attachments).map((attachment) => Number(attachment.id) || 0)),
    ) + 1;
    await writeRecordsDocument(current);

    const attachmentTotal = current.projects.reduce((sum, item) => sum + ensureArray(item.attachments).length, 0);
    console.log(JSON.stringify({
      companies: current.companies.length,
      projects: current.projects.length,
      attachments: attachmentTotal,
      repairedProjects,
      uploadedCount,
    }, null, 2));
  } finally {
    db.close();
  }
}

main().catch((error) => {
  console.error('[repair-records-attachments] failed:', error && error.message ? error.message : error);
  process.exit(1);
});

#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const { put } = require('@vercel/blob');
const { resolveToken } = require('../api/_lib/blob-store');
const { writeRecordsDocument } = require('../api/_lib/records-store');

const cliArgs = process.argv.slice(2);
const sourceArg = cliArgs.find((arg) => !arg.startsWith('--')) || '실적관리';
const SOURCE_DIR = path.resolve(sourceArg);
const DRY_RUN = process.argv.includes('--dry-run');

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

function normalizeState(input) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    version: 2,
    nextIds: source.nextIds || { company: 1, category: 1, project: 1, attachment: 1 },
    companies: Array.isArray(source.companies) ? source.companies : [],
    categories: Array.isArray(source.categories) ? source.categories : [],
    projects: Array.isArray(source.projects) ? source.projects : [],
  };
}

async function uploadAttachment(absolutePath, { projectId, attachmentId, fileName, mimeType }) {
  const token = resolveToken();
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not configured');
  }
  const buffer = fs.readFileSync(absolutePath);
  const pathname = `company-search/records/attachments/${projectId}/${attachmentId}-${fileName}`;
  const uploaded = await put(pathname, buffer, {
    access: 'private',
    contentType: mimeType || undefined,
    addRandomSuffix: false,
    allowOverwrite: true,
    token,
  });
  return {
    blobPathname: uploaded.pathname || '',
    url: uploaded.url || '',
    downloadUrl: uploaded.downloadUrl || uploaded.url || '',
  };
}

async function buildDocumentFromExport(sourceDir) {
  const dbPath = path.join(sourceDir, 'records.sqlite');
  if (!fs.existsSync(dbPath)) {
    throw new Error(`records.sqlite not found: ${dbPath}`);
  }

  const SQL = await initSqlJs({
    locateFile: (file) => require.resolve(`sql.js/dist/${file}`),
  });
  const db = new SQL.Database(fs.readFileSync(dbPath));

  try {
    const companies = queryRows(db, 'SELECT * FROM companies ORDER BY sort_order, name');
    const categories = queryRows(db, 'SELECT * FROM categories ORDER BY sort_order, name');
    const projects = queryRows(db, 'SELECT * FROM projects ORDER BY id');
    const projectCategories = queryRows(db, 'SELECT * FROM project_categories');
    const attachments = queryRows(db, 'SELECT * FROM attachments ORDER BY id');

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

    const warnings = [];
    const migratedProjects = [];

    for (const project of projects) {
      const projectId = Number(project.id);
      const migratedAttachments = [];
      const projectAttachments = attachmentMap.get(projectId) || [];

      for (const attachment of projectAttachments) {
        const relativeFilePath = String(attachment.file_path || '').replace(/\\/g, path.sep);
        const absolutePath = path.join(sourceDir, 'attachments', relativeFilePath);
        if (!fs.existsSync(absolutePath)) {
          warnings.push({
            type: 'missing_attachment',
            projectId,
            attachmentId: Number(attachment.id),
            filePath: absolutePath,
          });
          continue;
        }

        const fileName = path.basename(absolutePath);
        const uploaded = DRY_RUN
          ? { blobPathname: '', url: '', downloadUrl: '' }
          : await uploadAttachment(absolutePath, {
            projectId,
            attachmentId: Number(attachment.id),
            fileName,
            mimeType: attachment.mime_type || undefined,
          });

        migratedAttachments.push({
          id: Number(attachment.id),
          displayName: normalizeText(attachment.display_name || fileName),
          fileName,
          mimeType: attachment.mime_type || 'application/octet-stream',
          fileSize: Number.isFinite(Number(attachment.file_size)) ? Number(attachment.file_size) : fs.statSync(absolutePath).size,
          uploadedAt: attachment.uploaded_at || new Date().toISOString(),
          blobPathname: uploaded.blobPathname,
          url: uploaded.url,
          downloadUrl: uploaded.downloadUrl,
        });
      }

      migratedProjects.push({
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
        categoryIds: projectCategoryMap.get(projectId) || [],
        attachments: migratedAttachments,
        createdAt: project.created_at || new Date().toISOString(),
        updatedAt: project.updated_at || project.created_at || new Date().toISOString(),
      });
    }

    return normalizeState({
      nextIds: {
        company: Math.max(1, ...companies.map((row) => Number(row.id) || 0)) + 1,
        category: Math.max(1, ...categories.map((row) => Number(row.id) || 0)) + 1,
        project: Math.max(1, ...projects.map((row) => Number(row.id) || 0)) + 1,
        attachment: Math.max(1, ...attachments.map((row) => Number(row.id) || 0)) + 1,
      },
      companies: companies.map((row) => ({
        id: Number(row.id),
        name: normalizeText(row.name),
        alias: normalizeText(row.alias),
        isPrimary: !!row.is_primary,
        isMisc: !!row.is_misc,
        active: row.active !== 0,
        sortOrder: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0,
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
      })),
      categories: categories.map((row) => ({
        id: Number(row.id),
        name: normalizeText(row.name),
        parentId: Number.isInteger(Number(row.parent_id)) && Number(row.parent_id) > 0 ? Number(row.parent_id) : null,
        active: row.active !== 0,
        sortOrder: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0,
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
      })),
      projects: migratedProjects,
      warnings,
    });
  } finally {
    db.close();
  }
}

async function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    throw new Error(`source directory not found: ${SOURCE_DIR}`);
  }

  if (!DRY_RUN && !resolveToken()) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not configured');
  }

  console.log(`[records-migrate] source: ${SOURCE_DIR}`);
  console.log(`[records-migrate] mode: ${DRY_RUN ? 'dry-run' : 'upload'}`);

  const document = await buildDocumentFromExport(SOURCE_DIR);
  const warnings = Array.isArray(document.warnings) ? document.warnings : [];
  delete document.warnings;

  const outputPath = path.resolve(process.cwd(), 'tmp-records-migration-preview.json');
  fs.writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf8');
  console.log(`[records-migrate] preview written: ${outputPath}`);
  console.log(`[records-migrate] companies=${document.companies.length} categories=${document.categories.length} projects=${document.projects.length}`);
  console.log(`[records-migrate] attachments=${document.projects.reduce((sum, item) => sum + item.attachments.length, 0)} warnings=${warnings.length}`);

  if (!DRY_RUN) {
    await writeRecordsDocument(document);
    console.log('[records-migrate] records index written to blob');
  }

  if (warnings.length > 0) {
    const warningsPath = path.resolve(process.cwd(), 'tmp-records-migration-warnings.json');
    fs.writeFileSync(warningsPath, JSON.stringify(warnings, null, 2), 'utf8');
    console.log(`[records-migrate] warnings written: ${warningsPath}`);
  }
}

main().catch((error) => {
  console.error('[records-migrate] failed:', error && error.message ? error.message : error);
  process.exit(1);
});

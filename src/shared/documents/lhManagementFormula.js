const numeric = (value, digits = 4) => value == null ? '-' : Number(value).toLocaleString('ko-KR', { maximumFractionDigits: digits });
const financialParts = (company, scale) => ['debtScore', 'currentScore', 'yearsScore'].map((key) => company.financialDetails.parts[key] * scale);

// Formats the source form's expressions; evaluated scores remain authoritative.
export function formatLhManagementFormula(model, method) {
  const companies = model.companies.filter((company) => company.method === method);
  if (!companies.length) return '-';
  const financial = method === 'composite';
  const maximum = financial ? model.financial.maxScore : model.credit.maxScore;
  const denominator = financial ? maximum * model.financialFormScale
    : Math.max(...model.credit.gradeTable.map((row) => Number(row.base) || 0));
  const groups = new Map();
  const labels = companies.map((company) => {
    const parts = financial ? financialParts(company, model.financialFormScale) : [];
    const base = financial ? parts.reduce((sum, value) => sum + value, 0) : company.creditDetails.base;
    // Only combine shares when both the displayed base and evaluated score agree.
    const key = `${numeric(base)}:${company.score}`;
    const group = groups.get(key) || { base, share: 0, complete: true };
    group.share += company.share || 0;
    group.complete = group.complete && company.contribution != null;
    groups.set(key, group);
    return financial
      ? `${company.name} : ${parts.map((value) => numeric(value, 2)).join(' +')} = ${numeric(base, 2)}점`
      : `${company.name} : ${company.creditGrade} (${numeric(base)}점)`;
  });
  const expressions = [...groups.values()].map((group) => `(${numeric(group.base)}*${numeric(maximum)}/${numeric(denominator)}*${group.complete ? numeric(group.share) : '-'}%)`);
  const complete = companies.every((company) => company.contribution != null);
  const subtotal = financial ? model.financialSubtotal : model.creditSubtotal;
  return `${labels.join('\n')}\n\n${expressions.join('\n+ ')}\n= ${complete ? numeric(subtotal) : '-'}`;
}

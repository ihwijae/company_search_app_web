export function appendLhCompanyProfilePage(pdf, companies, { font, bold, color }) {
  const page = pdf.addPage([595.28, 841.89]);
  const left = 57;
  const width = 481;
  const labelWidth = 130;
  const companyWidth = (width - labelWidth) / companies.length;
  const size = companies.length >= 4 ? 8 : 9.5;
  const wrap = (value, available, fontSize) => {
    const result = [];
    for (const paragraph of String(value || '—').split('\n')) {
      let line = '';
      for (const character of paragraph) {
        if (line && font.widthOfTextAtSize(line + character, fontSize) > available) { result.push(line); line = ''; }
        line += character;
      }
      result.push(line);
    }
    return result;
  };
  page.drawText('다. 업체현황', { x: left, y: 766, size: 12, font: bold, color });
  const rows = [
    ['회 사 명', (company) => company.name],
    ['대 표 자', (company) => company.representative ? `${company.representative}     (인)` : '—'],
    ['업 체 등 록 번 호', (company) => company.registrationNo],
    ['시 공 능 력 공 시 액', (company) => {
      if (!company.sipyungAmount) return '';
      const value = Number(String(company.sipyungAmount).replace(/,/g, ''));
      return Number.isFinite(value) ? value.toLocaleString('ko-KR') : company.sipyungAmount;
    }],
    ['도 급 순 위', (company) => company.rank],
    ['주 소', (company) => company.address],
    ['전 화 번 호', (company) => company.phone],
    ['작 성 자', (company) => company.writer],
    ['사업자 등 록 번 호', (company) => company.bizNo],
    ['법 인 등 록 번 호', (company) => company.corporateNo],
  ];
  let top = 753;
  for (const [label, getValue] of rows) {
    const values = companies.map((company) => wrap(getValue(company), companyWidth - 10, size));
    const height = Math.max(24, ...values.map((lines) => lines.length * size * 1.4 + 10));
    if (top - height < 57) throw new Error('업체현황 내용이 한 페이지를 초과합니다. 주소 등 입력 길이를 확인해 주세요.');
    const cell = (lines, x, cellWidth, fontSize) => {
      page.drawRectangle({ x, y: top - height, width: cellWidth, height, borderColor: color, borderWidth: .6 });
      const startY = top - (height - lines.length * fontSize * 1.4) / 2 - fontSize;
      lines.forEach((line, index) => page.drawText(line, { x: x + (cellWidth - font.widthOfTextAtSize(line, fontSize)) / 2, y: startY - index * fontSize * 1.4, size: fontSize, font, color }));
    };
    cell([label], left, labelWidth, 10);
    values.forEach((lines, index) => cell(lines, left + labelWidth + index * companyWidth, companyWidth, size));
    top -= height;
  }
}

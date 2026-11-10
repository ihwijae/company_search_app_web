// Run: node scripts/check-net-cost-bonus.cjs
// Compare with the original LH implementation:
// git show HEAD:src/view/features/agreements/components/AgreementBoardWindow.jsx | node scripts/check-net-cost-bonus.cjs --legacy-source-stdin
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

(async () => {
  const { calculateNetCostBonus, resolveNetCostBonusConfig } = await import('../src/shared/agreements/calculations/netCostBonus.js');
  const { buildAgreementExportPayload } = await import('../src/shared/agreements/agreementExportPayload.js');
  const { computeGroupSummaries } = await import('../src/shared/agreements/calculations/groupSummary.js');
  const calculate = (owner, range, values = {}) => calculateNetCostBonus({
    config: resolveNetCostBonusConfig(owner, range),
    baseAmount: 1000000000,
    netCostAmount: 920000000,
    aValue: 100000000,
    ...values,
  });
  const mappings = [
    ['mois-under30', 'lh-under50', 1.2],
    ['mois-30to50', 'lh-under50', 1.2],
    ['mois-50to100', 'lh-50to100', 3.1],
  ];
  for (const [range, lhRange, expected] of mappings) {
    assert.strictEqual(resolveNetCostBonusConfig('MOIS', range), resolveNetCostBonusConfig('LH', lhRange));
    assert.equal(calculate('MOIS', range).score, expected);
    assert.deepEqual(calculate('MOIS', range), calculate('LH', lhRange));
    assert.equal(calculate('MOIS', range, { aValue: null }).score, 0);
    assert.equal(calculate('MOIS', range, { aValue: 0 }).score, 0, 'preserve existing zero A-value behavior');
    assert.equal(calculate('MOIS', range, { aValue: 1012000000 }).score, 0);
    assert.equal(calculate('MOIS', range, { netCostAmount: 0 }).score, 0);
    assert.equal(calculate('MOIS', range, { netCostAmount: 930000000 }).penaltyNotice, true);

    const identity = (value) => value;
    const [summary] = await computeGroupSummaries({
      metrics: [{ groupIndex: 0, memberCount: 1, shareValid: true, managementScore: 12, performanceAmount: 1000000000 }],
      performanceBaseReady: true, perfBase: 1000000000,
      evaluatePerformanceScore: async () => 13,
      managementMax: 15, managementScoreMax: 15,
      derivedPerformanceMax: 15, getPerformanceCap: () => 15,
      clampScore: (value, max) => Math.max(0, Math.min(value, max)),
      roundForMoisManagement: identity, roundForLhTotals: identity,
      roundUpForPpsUnder50: identity, roundForKrailUnder50: identity,
      roundForExManagement: identity, roundForPerformanceTotals: identity,
      isMois30To50: range === 'mois-30to50', isMois50To100: range === 'mois-50to100',
      netCostBonusScore: expected, bidScoreDefault: 65,
      mois50To100BidScore: 45, subcontractScoreDefault: 10,
      mois50To100SubcontractScore: 10, mois50To100MaterialScore: 10,
    });
    const otherScores = range === 'mois-under30' ? 65 : (range === 'mois-30to50' ? 75 : 65);
    assert.equal(summary.totalScoreBase, 12 + 13 + otherScores + expected, 'include bonus in agreement total');
    const payload = buildAgreementExportPayload({
      ownerId: 'MOIS', selectedRangeKey: range,
      groupAssignments: [['member']], participantMap: new Map(),
      summaryByGroup: new Map([[0, summary]]), netCostBonusScore: expected,
    });
    assert.equal(payload.groups[0].summary.netCostBonusScore, expected, 'export the same computed bonus');
  }
  assert.equal(calculate('LH', 'lh-under50-share').score, 1.2);
  assert.equal(calculate('LH', 'lh-50to100-share').score, 3.1);
  for (const [owner, range] of [['LH', 'lh-100to300'], ['PPS', 'pps-under50'], ['MOIS', 'mois-other']]) {
    assert.equal(resolveNetCostBonusConfig(owner, range), null);
    assert.equal(calculate(owner, range).score, 0);
  }
  const nearLimit = { baseAmount: 9881422000, netCostAmount: 9200000000 };
  assert.match(calculate('MOIS', 'mois-50to100', nearLimit).notice, /100억/);
  assert.equal(calculate('MOIS', 'mois-50to100', nearLimit).score, 0);
  assert.equal(calculate('MOIS', 'mois-50to100', { ...nearLimit, baseAmount: 9881421000 }).notice, '');
  assert.equal(calculate('MOIS', 'mois-30to50', nearLimit).notice, '');

  if (process.argv.includes('--legacy-source-stdin')) {
    const source = fs.readFileSync(0, 'utf8');
    const start = source.indexOf('  const netCostBonusScore = React.useMemo(() => {');
    const end = source.indexOf('  const effectiveNetCostBonusScore =', start);
    assert.ok(start >= 0 && end > start, 'original LH implementation must be present');
    const helpers = source.slice(source.indexOf('const roundUpThousand ='), source.indexOf('const buildDutySummary ='));
    const legacy = new vm.Script(`${helpers}\n${source.slice(start, end)}\n({ score: netCostBonusScore, notice: netCostBonusNotice, penaltyNotice: netCostPenaltyNotice });`);
    let count = 0;
    for (const [, lhRange] of mappings) {
      for (const base of [1000000001, 3000000000, 6000000000, 9881421000, 9881422000, 10000000000]) {
        for (const netRatio of [0, 0.85, 0.9, 0.92, 0.93, 0.95, 1]) {
          for (const aRatio of [0, 0.05, 0.1, 0.5, 1.1]) {
            const values = { baseAmount: base, netCostAmount: base * netRatio, aValue: base * aRatio };
            const result = legacy.runInNewContext({
              ...values, isLHOwner: true, effectiveSelectedRangeKey: lhRange,
              LH_UNDER_50_KEY: 'lh-under50', LH_50_TO_100_KEY: 'lh-50to100',
              React: { useMemo: (callback) => callback() }, toNumber: (value) => value,
              clampScore: (value, max) => Math.max(0, Math.min(value, max)),
            });
            assert.deepEqual(calculate('LH', lhRange, values), JSON.parse(JSON.stringify(result)));
            count += 1;
          }
        }
      }
    }
    console.log(`Original LH results preserved: ${count} cases`);
  }
  console.log('Net cost bonus checks passed: LH/MOIS mapping, totals, export, limits, rounding, missing inputs');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

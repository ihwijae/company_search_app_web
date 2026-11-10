// Run: node scripts/check-bid-amount.cjs
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const esbuild = require('esbuild');

(async () => {
  const { calculateBidAmount, usesNetCostBidFloor } = await import('../src/shared/agreements/calculations/bidAmount.js');
  const { calculatePossibleShareRatio, formatPossibleShareValue } = await import('../src/shared/agreements/calculations/possibleShare.js');
  const regionPath = path.resolve(__dirname, '../src/shared/agreements/regionCandidateService.js');
  const compiled = esbuild.buildSync({ entryPoints: [regionPath], bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false });
  const regionModule = new Module(regionPath, module);
  regionModule.paths = module.paths;
  regionModule._compile(compiled.outputFiles[0].text, regionPath);
  const { buildInitialRegionSearchParams, computeRegionCandidateShares } = regionModule.exports;
  const example = {
    ownerId: 'MOIS', rangeKey: 'mois-50to100',
    baseAmount: 7816772000, adjustmentRate: 1.016, bidRate: 0.87495,
    aValue: 472253239, useAValue: true, netCostAmount: 7572604787,
  };
  const result = calculateBidAmount(example);
  assert.equal(example.baseAmount * example.adjustmentRate, 7941840352);
  assert.equal(result.standardAmount, 7007768484);
  assert.equal(result.netCostFloor, 7539891135);
  assert.equal(result.amount, 7539891135);
  assert.equal(result.usesNetCostFloor, true);
  assert.ok(result.amount >= example.netCostAmount * example.adjustmentRate * 0.98, 'round upward so the bid is never below the floor');
  assert.equal(formatPossibleShareValue(calculatePossibleShareRatio(result.amount, 3000000000)), '39.78');

  for (const rangeKey of ['mois-30to50', 'mois-50to100']) {
    assert.equal(usesNetCostBidFloor('MOIS', rangeKey), true);
    assert.equal(calculateBidAmount({ ...example, rangeKey }).amount, result.amount);
    for (const netCostAmount of [null, 0, 6000000000]) {
      const lower = calculateBidAmount({ ...example, rangeKey, netCostAmount });
      assert.equal(lower.amount, result.standardAmount);
      assert.equal(lower.usesNetCostFloor, false);
    }
    const params = buildInitialRegionSearchParams({
      ownerId: 'MOIS', menuKey: rangeKey,
      bidAmount: String(result.amount), ratioBaseAmount: String(result.amount),
    });
    assert.equal(params.ratioBase, String(result.amount));
    const [regionalCompany] = computeRegionCandidateShares([{ rating: 3000000000 }], Number(params.ratioBase));
    assert.equal(regionalCompany._pct, 39.78, 'regional search/import uses the final bid for shares');
  }
  for (const [ownerId, rangeKey] of [['MOIS', 'mois-under30'], ['LH', 'lh-under50'], ['LH', 'lh-50to100'], ['PPS', 'pps-under50'], ['PPS', 'pps-50to100']]) {
    assert.equal(usesNetCostBidFloor(ownerId, rangeKey), false);
    assert.equal(calculateBidAmount({ ...example, ownerId, rangeKey }).amount, result.standardAmount);
  }
  for (const values of [{ baseAmount: null }, { baseAmount: 0 }, { bidRate: NaN }, { adjustmentRate: NaN }]) {
    assert.equal(calculateBidAmount({ ...example, ...values }).amount, 0);
  }
  assert.equal(calculateBidAmount({ ...example, netCostAmount: null, useAValue: false }).amount, Math.round(example.baseAmount * example.bidRate * example.adjustmentRate));
  const higherStandard = calculateBidAmount({ ...example, bidRate: 0.99 });
  assert.equal(higherStandard.amount, higherStandard.standardAmount);
  assert.equal(higherStandard.usesNetCostFloor, false);
  const adjusted = calculateBidAmount({ ...example, adjustmentRate: 1 });
  assert.equal(adjusted.amount, Math.ceil(example.netCostAmount * 0.98), 'recalculate when the adjustment rate changes');
  assert.equal(calculateBidAmount({ ...example, netCostAmount: 0 }).amount, result.standardAmount, 'removing net cost restores the standard bid');
  console.log('Bid amount checks passed: supplied example, floor/standard comparison, rounding, shares, regional imports, excluded ranges, missing inputs');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

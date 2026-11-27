// Form wording from the supplied LH self-evaluation PDF. All applicant scores
// are fixed at zero for now; no agreement-board credibility rules are changed.
import { getLhDocumentConfig } from './lhDocumentConfig.js';
import { LH_UNDER50_CREDIBILITY_TEMPLATE } from './lhUnder50Credibility.js';
import { LH_50TO100_CREDIBILITY_TEMPLATE } from './lh50To100Credibility.js';

const templateFor = (rangeId) => rangeId === 'lh-under50' ? LH_UNDER50_CREDIBILITY_TEMPLATE : LH_50TO100_CREDIBILITY_TEMPLATE;

export function buildLhCredibilityPage(members, rangeId = 'lh-50to100') {
  const { items, ...layout } = templateFor(rangeId);
  return {
    version: 1, mode: 'fixed-zero', score: 0,
    ...layout,
    members: members.map((member) => ({ name: member.name, share: member.share, score: 0 })),
    items: items.map((item) => ({ ...item, scores: members.map(() => item.scoreBlank ? '' : 0) })),
  };
}

export function withFixedLhCredibility(snapshot) {
  if (snapshot.model.credibilityPage?.mode === 'fixed-zero') {
    if (snapshot.model.credibilityPage.templateId !== templateFor(snapshot.scope.rangeId).templateId) {
      return { ...snapshot, model: { ...snapshot.model, credibilityPage: buildLhCredibilityPage(snapshot.model.members, snapshot.scope.rangeId) } };
    }
    return snapshot;
  }
  const { model, criteria } = snapshot;
  const scores = { ...model.scores, credibility: 0 };
  const round = (value) => Math.round(value * 10 ** criteria.scoreDigits) / 10 ** criteria.scoreDigits;
  const shareComplete = Math.abs((model.shareSum || 0) - 100) < .01;
  const subtotalKeys = getLhDocumentConfig(snapshot.scope.rangeId).subtotalKeys;
  scores.subtotal = shareComplete && subtotalKeys.every((key) => Number.isFinite(scores[key]))
    ? round(subtotalKeys.reduce((sum, key) => sum + scores[key], 0)) : null;
  scores.total = scores.subtotal != null && Number.isFinite(scores.bid) ? round(scores.subtotal + scores.bid) : null;
  const pending = model.pending.filter((item) => item !== '신인도');
  return {
    ...snapshot,
    criteria: { ...criteria, credibility: { version: 1, mode: 'fixed-zero', score: 0 } },
    model: {
      ...model, scores, pending, credibilityPage: buildLhCredibilityPage(model.members, snapshot.scope.rangeId),
      complete: model.missing.length === 0 && pending.length === 0 && scores.total != null,
    },
  };
}

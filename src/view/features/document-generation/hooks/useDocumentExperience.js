import { useMemo } from 'react';
import formulasDoc from '../../../../shared/formulas.defaults.json';
import { resolveDocumentExperience } from '../../../../shared/agreements/documentEvaluation.js';

export default function useDocumentExperience(form, record) {
  return useMemo(() => ({
    snapshot: resolveDocumentExperience(form, { previousSnapshot: record?.evaluationSnapshot, formulasDoc }),
    hasSavedCriteria: Boolean(record?.evaluationSnapshot && record.evaluationSnapshot.scope.ownerId === form.ownerId
      && record.evaluationSnapshot.scope.reviewType === form.reviewType && record.evaluationSnapshot.scope.rangeId === form.rangeId
      && record.evaluationSnapshot.scope.industry === form.industry),
  }), [form, record]);
}

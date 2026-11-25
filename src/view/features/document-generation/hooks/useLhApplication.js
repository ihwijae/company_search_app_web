import { useMemo } from 'react';
import formulasDoc from '../../../../shared/formulas.defaults.json';
import industryAverages from '../../../../shared/industryAverages.json';
import { evaluateScores } from '../../../../shared/evaluator.web.js';
import { resolveLhApplication } from '../../../../shared/agreements/lhApplication.js';

export default function useLhApplication(form, record) {
  return useMemo(() => resolveLhApplication(form, { previousSnapshot: record?.applicationSnapshot, formulasDoc, industryAverages, evaluateScores }), [form, record]);
}

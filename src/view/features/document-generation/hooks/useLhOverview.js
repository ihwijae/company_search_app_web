import { useMemo } from 'react';
import { resolveLhOverview } from '../../../../shared/agreements/lhOverview.js';

export default function useLhOverview(form, record, application, experience) {
  return useMemo(() => resolveLhOverview(form, { previousSnapshot: record?.overviewSnapshot, application, experience }), [form, record, application, experience]);
}

import React from 'react';
import { useFeedback } from '../../../../components/FeedbackProvider.jsx';

const ACTION_CONFIRMATIONS = {
  refresh: {
    title: '업체정보를 갱신하시겠습니까?',
    message: '현재 협정보드의 업체정보를 최신 자료로 갱신합니다.',
  },
  regionImport: {
    title: '지역사를 불러오시겠습니까?',
    message: '확인 후 불러올 자료 조건을 선택하면 지역사를 협정보드에 배치합니다.',
  },
  fixedImport: {
    title: '고정업체를 불러오시겠습니까?',
    message: '고정업체를 불러와 현재 협정보드에 배치합니다.',
  },
  ownCorporationImport: {
    title: '우리법인을 불러오시겠습니까?',
    message: '우리법인을 불러와 현재 협정보드에 배치합니다.',
  },
  undoImport: {
    title: '불러오기를 되돌리시겠습니까?',
    message: '가장 최근에 불러온 업체 배치를 되돌립니다.',
  },
  inconMemo: {
    title: '아이건설넷 메모를 생성하시겠습니까?',
    message: '현재 협정 내용으로 아이건설넷 메모를 생성해 클립보드에 복사합니다.',
  },
};

export default function useBoardActionConfirmation(portalContainer) {
  const { confirm } = useFeedback();
  const pendingRef = React.useRef(false);

  return React.useCallback(async (actionKey, action) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    try {
      const accepted = await confirm({
        ...ACTION_CONFIRMATIONS[actionKey],
        confirmText: '확인',
        cancelText: '취소',
        portalTarget: portalContainer || null,
      });
      if (accepted) await action();
    } finally {
      pendingRef.current = false;
    }
  }, [confirm, portalContainer]);
}

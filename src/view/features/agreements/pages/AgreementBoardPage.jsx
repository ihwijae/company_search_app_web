import React from 'react';
import '../../../../styles.css';
import '../../../../fonts.css';
import AgreementBoardWindow from '../components/AgreementBoardWindow.jsx';
import { useAgreementBoard } from '../context/AgreementBoardContext.jsx';
import { BASE_ROUTES } from '../../../../shared/navigation.js';

const BOARD_HEALTHCHECK_INTERVAL_MS = 4000;

export default function AgreementBoardPage() {
  const {
    boardState,
    updateBoard,
    appendCandidatesFromSearch,
    removeCandidate,
    closeBoard,
  } = useAgreementBoard();
  const [serverReachable, setServerReachable] = React.useState(true);

  React.useEffect(() => {
    if (!boardState.open || !boardState.inlineMode) {
      updateBoard({ open: true, inlineMode: true });
    }
  }, [boardState.inlineMode, boardState.open, updateBoard]);

  React.useEffect(() => {
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  React.useEffect(() => () => {
    updateBoard({ open: false, inlineMode: false });
  }, [updateBoard]);

  React.useEffect(() => {
    if (!boardState.inlineMode) return;
    document.title = boardState.title || '협정보드';
  }, [boardState.inlineMode, boardState.open, updateBoard]);

  React.useEffect(() => {
    let active = true;
    let initialized = false;
    let previousReachable = true;

    const checkServerHealth = async () => {
      try {
        const response = await fetch(`/api/auth?action=session&_ts=${Date.now()}`, {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (!active) return;

        if (initialized && !previousReachable) {
          window.location.reload();
          return;
        }

        initialized = true;
        previousReachable = true;
        setServerReachable(true);
      } catch (error) {
        if (!active) return;
        initialized = true;
        previousReachable = false;
        setServerReachable(false);
      }
    };

    checkServerHealth();
    const timer = window.setInterval(checkServerHealth, BOARD_HEALTHCHECK_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="app-shell">
      <div className="main">
        <div className="title-drag" />
        <div className="topbar" />
        <div className="stage agreement-board-stage">
          {!serverReachable && (
            <div className="agreement-board-connection-banner">
              서버 연결이 끊겼습니다. 서버가 복구되면 이 탭이 자동 새로고침됩니다.
            </div>
          )}
          <AgreementBoardWindow
            inlineMode={true}
            open={true}
            onClose={() => {
              closeBoard();
              window.location.hash = BASE_ROUTES.search;
            }}
            candidates={boardState.candidates || []}
            pinned={boardState.pinned || []}
            excluded={boardState.excluded || []}
            groupAssignments={boardState.groupAssignments || []}
            groupShares={boardState.groupShares || []}
            groupShareRawInputs={boardState.groupShareRawInputs || []}
            groupCredibility={boardState.groupCredibility || []}
            groupTechnicianScores={boardState.groupTechnicianScores || []}
            groupApprovals={boardState.groupApprovals || []}
            groupManagementBonus={boardState.groupManagementBonus || []}
            groupQualityScores={boardState.groupQualityScores || []}
            technicianEntriesByTarget={boardState.technicianEntriesByTarget || {}}
            dutyRegions={boardState.dutyRegions || []}
            groupSize={boardState.groupSize || 4}
            title={boardState.title || '협정보드'}
            alwaysInclude={boardState.alwaysInclude || []}
            fileType={boardState.fileType || 'eung'}
            ownerId={boardState.ownerId || 'LH'}
            rangeId={boardState.rangeId || null}
            onAddRepresentatives={appendCandidatesFromSearch}
            onRemoveRepresentative={removeCandidate}
            onUpdateBoard={updateBoard}
            noticeNo={boardState.noticeNo || ''}
            noticeTitle={boardState.noticeTitle || ''}
            noticeDate={boardState.noticeDate || ''}
            industryLabel={boardState.industryLabel || ''}
            splitIndustryLabel={boardState.splitIndustryLabel || ''}
            splitEntryAmount={boardState.splitEntryAmount || ''}
            entryAmount={boardState.entryAmount || ''}
            entryMode={boardState.entryMode || 'ratio'}
            baseAmount={boardState.baseAmount || ''}
            estimatedAmount={boardState.estimatedAmount || ''}
            bidAmount={boardState.bidAmount || ''}
            ratioBaseAmount={boardState.ratioBaseAmount || ''}
            bidRate={boardState.bidRate || ''}
            adjustmentRate={boardState.adjustmentRate || ''}
            netCostBonusOverride={boardState.netCostBonusOverride || ''}
            performanceCoefficient={boardState.performanceCoefficient || ''}
            regionAdjustmentCoefficient={boardState.regionAdjustmentCoefficient || ''}
            bidDeadline={boardState.bidDeadline || ''}
            regionDutyRate={boardState.regionDutyRate || ''}
            participantLimit={boardState.participantLimit || ''}
            netCostAmount={boardState.netCostAmount || ''}
            aValue={boardState.aValue || ''}
            memoHtml={boardState.memoHtml || ''}
            smsStatus={boardState.smsStatus || 'pending'}
            smsCompletedAt={boardState.smsCompletedAt || ''}
          />
        </div>
      </div>
    </div>
  );
}

# WSL 서버 작업 정리 (2026-04-15)

## 1. 작업 개요
- 협정보드에 `분담이행방식`(LH 50억미만/50억~100억 전용) 흐름을 추가하고, 기존 공동이행 계산/검증과 충돌하지 않도록 분리 적용함.
- 분담 슬롯의 업체조회/배치/중복허용/검증배지/점수집계/엑셀내보내기/문자생성까지 전체 플로우를 보정함.
- 별도 스크립트로 만들던 `신용평가 갱신 요청`을 관리자 업로드 드로어 UI 기능으로 전환하고, 클릭 시 클립보드 복사 방식으로 적용함.

## 2. 협정보드 분담이행방식 반영

### A. 모드/헤더 UI
- LH 금액구간에 아래 옵션 추가:
  - `50억 미만 - 분담이행방식`
  - `50억~100억 - 분담이행방식`
- 분담이행 선택 시 헤더에 추가:
  - `분담이행방식 공종`
  - `분담이행 참가자격`
- 참여업체수 5개사 기준 분담 슬롯 라벨을 `소방분담/통신분담/...` 형태로 표시.

### B. 업체조회/배치
- 분담 슬롯에서 업체조회 모달이 주공종이 아니라 `분담 공종` 기준으로 열리도록 수정.
- 같은 업체를 `주공종 슬롯 + 분담 슬롯`에 동시에 배치 가능하도록 중복키 처리 보정.
- 분담 방식에서 발생하던 동일 담당자 중복 경고는 분담 슬롯에 한해 제외.

### C. 계산/검증 정책
- 분담 슬롯은 주공종 점수 계산(경영/실적/품질/집계)에 포함하지 않도록 분리.
- 분담 슬롯은 `가능지분` 표시/제한을 적용하지 않도록 변경.
- 분담 참가자격(시평액) 입력 시, 분담 업체에만 자격검증 적용:
  - 기준 미달은 기존 스타일의 `참가자격미달` 배지로 표시.

### D. 지분 계산 정밀도
- 가능지분 계산 전반을 반올림이 아닌 `TRUNC(..., 4)`(소수 4자리 버림) 기준으로 통일.
- 화면 표시는 기존처럼 소수 2자리 유지.

### E. 엑셀 내보내기
- 분담 업체는 협정별 지정 위치 `H열`에 업체명만 기록.
- 분담 업체의 경영/실적/시평/기타 점수 데이터는 내보내지 않음.
- 템플릿은 기존 템플릿을 그대로 사용.

### F. 협정 문자 생성
- 분담이행방식인 경우 문자에 분담 라인을 별도 추가하도록 변경.
- 예시 형식:
  - `소방분담 : 대동종합전설㈜ 100%`
- 본문 마지막은 기존처럼 `협정 부탁드립니다.` 유지.

## 3. 오류/버그 수정
- `Cannot access 'safeParticipantLimit' before initialization` 런타임 오류 수정.
- 분담 슬롯 업체 적용 후 협정보드 반영 안 되던 문제 수정.
- 분담 업체 100% 입력 시 주공종 미구성인데 만점처럼 보이던 집계 오류 수정(분담 슬롯 점수 집계 제외).

## 4. 신용평가 갱신 요청 기능 전환

### A. 구현 방식 변경
- 기존 `scripts/generate-expired-credit-messages.js` 스크립트 방식 제거.
- 업로드 드로어에서 실행 가능한 UI 버튼으로 전환:
  - 버튼명: `신용평가 갱신 요청`
  - 버튼 클릭 시 결과를 별도 창/textarea 없이 즉시 클립보드 복사.

### B. 추출 규칙
- 전체 데이터셋(전기/통신/소방) 기준 조회.
- 공종 중복 업체는 `사업자번호 우선, 없으면 업체명`으로 1회만 포함.
- 담당자별로 묶어서 아래 문구 생성:
  - `- [업체명] 갱신된 신용평가 자료 부탁드립니다`
- 추가 필터(최종 반영):
  1. 신용평가 자료가 실제로 존재하는 업체만 포함
  2. `요약상태 = 최신` 업체만 포함
  3. 신용평가 만료 판정된 업체만 포함

## 5. 주요 수정 파일
- `src/view/features/agreements/components/AgreementBoardWindow.jsx`
- `src/view/features/agreements/context/AgreementBoardContext.jsx`
- `src/view/features/agreements/hooks/useAgreementBoardStorage.js`
- `src/view/features/agreements/pages/AgreementBoardPage.jsx`
- `src/shared/agreements/calculations/groupSummary.js`
- `src/shared/agreements/calculations/boardMemberMeta.js`
- `src/shared/agreements/calculations/possibleShare.js`
- `src/shared/agreements/agreementExportPayload.js`
- `src/shared/agreements/exportAgreementWorkbook.js`
- `src/shared/agreements/generator.js`
- `src/view/features/search/pages/SearchPage.jsx`
- `src/index.css`
- `package.json`

## 6. 삭제 파일
- `scripts/generate-expired-credit-messages.js`

## 7. 검증
- `npm run build` 반복 수행하여 빌드 성공 확인.
- 경고(대용량 청크/외부화 모듈)는 기존과 동일 유형으로 확인.

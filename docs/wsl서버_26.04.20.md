# WSL 서버 작업 정리 (2026-04-20)

## 1. 작업 개요
- 분담이행방식에서 분담 슬롯(5번째 슬롯) 지분 입력 시 `품질점수/품질총점`이 협정보드 계산에 포함되던 문제를 수정함.
- 협정보드 화면 계산과 내보내기 payload 계산이 동일 기준으로 동작하도록 분담 슬롯 제외 조건을 통일함.
- 아이건설넷 메모 생성 기능에서 분담 슬롯을 별도 라인(`소방분담  업체명 100%`)으로 출력하도록 변경함.
- 아이건설넷 메모에서 일부 그룹만 분담 라벨이 적용되고 일부는 `0%`로 보이던 원인을 분석해 슬롯 인덱스 보존 버그를 수정함.

## 2. 협정보드 분담 품질점수 계산 제외

### A. 문제
- LH 분담이행방식에서 분담 슬롯에 지분/품질값을 입력하면, 분담 업체가 품질총점 및 품질점수 계산에 반영됨.
- 요구사항은 분담 슬롯 업체가 점수 계산(특히 품질)에서 완전히 제외되는 것임.

### B. 수정 내용
- `AgreementBoardWindow.jsx` 품질 합산 2개 경로에 분담 슬롯 제외 조건 추가:
  - 품질 행 표시용 합산(`resolvedQualityTotal`)
  - 그룹 총점 계산용 품질 합산(`qualityTotal`)
- 제외 조건: `isSplitAssignedSlot(meta.slotIndex)`인 경우 합산하지 않음.

### C. 내보내기 일관성 보정
- `agreementExportPayload.js`의 LH 품질점수 합산에서도 분담 구성원(`member.isSplitMember`) 제외 처리.
- 화면과 내보내기 결과가 동일한 계산 기준을 갖도록 정렬.

## 3. 아이건설넷 메모 분담 라인 포맷 개선

### A. 요구사항
- 기존 출력 예:
  - 일반 라인에 분담 업체가 `... 100%`로 섞여 출력됨
- 변경 목표:
  - 일반 구성원 라인과 분담 라인을 분리
  - 예: `소방분담  ㈜보령에스 100%`

### B. 수정 내용
- `inconMemo.js`에 분담 라인 생성 함수(`buildSplitMemberLine`) 추가.
- 메모 생성 시 멤버를 `기본 구성원(baseMembers)`과 `분담 구성원(splitMember)`으로 분리.
- 블록 출력 순서:
  1. 기존 구성원 블록
  2. 빈 줄
  3. 분담 라인(`{분담라벨}  {업체명} {지분}%`)
- `AgreementBoardWindow.jsx`에서 메모 생성 호출 시 아래 파라미터 전달 추가:
  - `isSplitAssignedSlot`
  - `splitLabel` (`${splitIndustryLabel || '분담'}분담`)

## 4. 원인 분석 및 추가 버그 수정(메모 일부만 분담 인식)

### A. 증상
- 일부 그룹은 `소방분담 ... 100%`로 나오지만,
- 일부 그룹은 같은 분담칸인데 일반 라인 `업체명 0%` 형태로 출력됨.

### B. 원인
- `inconMemo.js`에서 그룹 슬롯 배열 처리 시 `group.filter(Boolean)` 사용으로 빈 슬롯이 제거됨.
- 이로 인해 실제 슬롯 인덱스가 당겨져 분담칸(5번째 슬롯) 판별이 그룹별로 깨짐.

### C. 수정
- 슬롯 인덱스 보존 방식으로 변경:
  - `group.map((uid, slotIndex) => ({ uid, slotIndex })).filter(...)`
- 이후 분담 판별(`isSplitAssignedSlot(slotIndex)`)과 지분 참조(`groupShares[groupIndex]?.[slotIndex]`) 모두 원래 슬롯 기준으로 처리.

## 5. 주요 수정 파일
- `src/view/features/agreements/components/AgreementBoardWindow.jsx`
- `src/shared/agreements/agreementExportPayload.js`
- `src/shared/agreements/calculations/inconMemo.js`

## 6. 검증
- `npm run build` 실행으로 빌드 성공 확인.
- 기존과 동일한 경고(대용량 청크, externalized 모듈)는 유지됨.

# WSL 서버 작업 정리 (2026-04-16)

## 1. 작업 개요
- 협정보드 `한국도로공사(EX) 50억~100억` 구간의 누락된 계산/규칙 연동을 보완함.
- `실적만점금액` 기준(`기초금액 × 2배`)을 협정보드에 반영함.
- `경영상태`에서 50억~100억 구간도 신용평가(`credit`) 방식이 `composite`와 함께 동작하도록 규칙을 추가함.
- EX 50억~100억 구간은 가점 체크가 적용되지 않도록 협정보드 UI/계산 반영 조건에서 제외함.
- EX 50억~100억 엑셀 내보내기 템플릿 매핑을 추가함(사용자 지정 셀만 반영).

## 2. 협정보드 계산 보완

### A. 실적만점금액 기준 추가
- EX 50억~100억 선택 시 실적만점금액을 `기초금액 × 2배`로 계산하도록 분기 추가.
- 기존 EX 50억 미만(`기초금액 × 1배`) 분기는 유지.

### B. 경영상태 신용평가(credit) 규칙 추가
- `formulas.defaults.json`의 EX 50억~100억 티어(`minAmount: 5,000,000,000 ~ maxAmount: 10,000,000,000`)에 `credit` 메서드 추가.
- 등급표(`gradeTable`)는 EX 50억 미만과 동일한 기준으로 반영.
- 결과적으로 EX 50억~100억 경영상태는 `methodSelection: max`에 따라 `composite`와 `credit` 중 높은 점수를 사용.

### C. EX 50억~100억 가점 체크 제거
- 협정보드에서 EX 50억~100억 구간은 `showManagementBonus`가 `false`가 되도록 조건 조정.
- 해당 구간에서는 가점 체크 UI가 보이지 않고, 가점 계산에도 반영되지 않음.

## 3. EX 50억~100억 엑셀 내보내기 매핑 반영

### A. 템플릿 키 연결
- `resolveTemplateKey`에 EX 50억~100억(`ex-50to100`) 반환 분기 추가.

### B. 템플릿 설정 추가
- 템플릿: `한국도로공사50-100억_템플릿.xlsx`
- 시트명: `양식`
- 시작 행/최대 행: `startRow: 5`, `maxRows: 68`
- 슬롯 컬럼:
  - 업체명: `C,D,E,F,G` (50억 미만과 동일)
  - 지분: `I,J,K,L,M` (50억 미만과 동일)
  - 경영: `O,P,Q,R,S`
  - 실적: `V,W,X,Y,Z`
  - 시평액(ability): `AO,AP,AQ,AR,AS` (50억 미만과 동일)
- 요약 컬럼:
  - 신인도: `AD`
  - 순공사점수: `AE`

### C. 템플릿 보호 원칙 반영
- 사용자 지정 위치 외 셀은 매핑하지 않음.
- 특히 `투찰점수`, `하도급점수`는 `summaryColumns`에 매핑하지 않아 템플릿 기본 수식/기본값 셀을 덮어쓰지 않도록 유지.

## 4. 주요 수정 파일
- `src/view/features/agreements/components/AgreementBoardWindow.jsx`
- `src/shared/formulas.defaults.json`
- `src/shared/agreements/templateConfigs.web.js`

## 5. 검증
- `npm run build` 실행으로 빌드 성공 확인.
- 기존 경고(대용량 청크, vite externalized 모듈)는 동일하게 유지됨.

# WSL 서버 작업 정리 (2026-04-09)

## 1. 작업 배경
- 협정보드 `행안부 50억~100억` 실적점수 계산이 만점(15점)으로 잘못 보이는 이슈 확인
- 개발 PC/운영 서버 데이터 경로 분리 및 업로드 권한 문제(`EACCES: permission denied, mkdir '/home/ihwijae'`) 해결
- 협정보드 새 탭을 열어둔 상태에서 서버 재시작 시 사용자 체감 개선

## 2. 개발/운영 데이터 경로 정리

### 변경 내용
- `package.json`의 서버 실행 경로를 고정 경로(`/home/ihwijae/...`)에서 사용자 홈 기반으로 변경
  - `serve`
  - `serve:lan`
- 현재 기본값:
  - `COMPANY_SEARCH_APP_DATA_ROOT=${COMPANY_SEARCH_APP_DATA_ROOT:-$HOME/app-data/company-search}`

### 의미
- 개발 PC(`leehwijae`)에서 실행: `/home/leehwijae/app-data/company-search`
- 운영 서버(`ihwijae`)에서 실행: `/home/ihwijae/app-data/company-search`
- 업로드/협정보드 저장 데이터는 repo 밖 경로에 저장되므로 `git push/pull`과 충돌하지 않음

## 3. 협정보드 실적점수 이슈 대응

### A. 행안부 50~100 분모 규칙
- 이 구간은 실적 분모를 `추정가격`만 사용하도록 정리
- 추정가격 없으면 계산 진행하지 않도록 처리

### B. 행안부 50~100 실적 데이터 소스
- 이 구간은 `3년 실적`만 사용
- `5년 실적` 폴백 경로 제거
- 수동 입력값도 3년 기준 필드에 저장되도록 보정

### C. 반올림 규칙
- `행안부 50~100` 실적 계산 반올림을 소수 4자리로 적용
  - `src/shared/formulas.defaults.json`의 해당 구간 `rounding`
  - `method: round`, `digits: 4`

### D. 표시 자릿수
- 협정보드 화면의 `행안부 50~100` 실적점수 표시를 소수 4자리로 변경

### E. 실적점수 컬럼 폭
- 협정보드 `실적점수 총점` 칸이 좁다는 요청 반영
- 모든 발주처/금액대 공통으로 폭 소폭 확장

## 4. 실적점수 계산 안정성(공통)
- 기존 구조에서 일부 상황에 공식식 외 계산 경로(폴백)가 개입할 가능성 제거
- 현재는 발주처/금액대에 해당하는 공식식 평가 결과만 사용
- 공식식 평가 실패 시 다른 식으로 자동 대체하지 않고 결과를 비움(`null`)

## 5. 서버 재시작 시 협정보드 탭 UX 개선

### 구현 내용
- 협정보드 페이지에서 4초 주기로 `/api/auth?action=session` 헬스체크
- 서버 단절 시 상단 배너 표시
- 단절 후 복구 감지 시 협정보드 탭 자동 새로고침

### 현재 인증 동작과의 관계
- 세션은 메모리(Map) 기반이라 서버 재시작 시 로그인 세션이 초기화됨
- 따라서 자동 새로고침 후 로그인 페이지로 이동할 수 있음
- 로그인 후 현재 정책상 기본 이동 경로는 메인(`#/search`)

## 6. 확인된 사용자 동작 정리
- 개발 서버에서 DB 업로드/협정보드 저장:
  - 개발 PC 로컬 경로에 저장됨
- 운영 서버에서 실행/외부 접속:
  - 운영 서버 경로 데이터 사용
- 양쪽 데이터는 분리 운영됨

## 7. 주요 수정 파일
- `package.json`
- `src/shared/formulas.defaults.json`
- `src/shared/agreements/calculations/performanceValue.js`
- `src/shared/agreements/calculations/performanceScore.js`
- `src/view/features/agreements/components/AgreementBoardWindow.jsx`
- `src/view/features/agreements/pages/AgreementBoardPage.jsx`
- `src/styles.css`

## 8. 추가 수정 (협정보드)

### A. LH 50억~100억 여성기업 가점 수정
- 기존 `1.1`에서 `1.05`로 변경
- 협정보드 계산과 엑셀 내보내기 값 모두 동일하게 반영
- 템플릿 기본값이 남지 않도록 가점 셀은 매 내보내기 시 명시적으로 덮어쓰기

### B. 예상점수 표시 방식 변경
- 기존: LH 구간에서 `예상점수`가 사실상 만점(95) 기준으로만 보이는 체감
- 변경: 협정보드 `예상점수` 칸은 참고용으로 원점수(95 초과 가능) 그대로 표시
- 만점 기준/판정 로직은 유지하고, 화면 표시만 초과분을 확인할 수 있게 조정

## 9. 추가 수정 파일
- `src/main/features/agreements/exportExcel.js`
- `src/shared/agreements/exportAgreementWorkbook.js`

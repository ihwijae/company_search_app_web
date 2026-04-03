# WSL 서버 전환 작업 인계 (2026-04-02)

## 1) 오늘 작업 목적
- 기존 `Vercel + Blob` 중심 흐름에서 벗어나, 노트북 WSL 로컬 파일시스템 기반 서버 운영으로 전환.
- 업로드/저장/불러오기 데이터를 서버 공용 경로에 통일해서 여러 사용자가 같은 데이터를 보도록 정리.
- 웹 모드에서 Electron 전용 의존 때문에 안 되던 기능들을 브라우저 경로로 보강.

## 2) 운영 실행 방식 (현재 기준)
- 운영 실행은 `npm run serve:prod` 또는 LAN 공개 시 `npm run serve:prod:lan` 사용.
- `serve:*` 스크립트에서 고정 루트 지정:
  - `COMPANY_SEARCH_APP_DATA_ROOT=/home/ihwijae/app-data/company-search`
- Vercel 배포 의존 제거 방향으로 정리 중이며, 현재 운영은 로컬 `server.js` + `dist` 기준.

## 3) 서버 저장 경로 통일
기준 루트:
- `/home/ihwijae/app-data/company-search`

세부 경로:
- 마스터 데이터셋 업로드: `uploads/master-files`
- 실적 데이터: `records/index.json`
- 실적 첨부: `records/attachments`
- 협정보드: `agreement-board`
- 메일 첨부 임시파일: `mail-attachments`
- 설정/주소록: `config/mail.address-book.json`
- 임시업체: `temp-companies/index.json`

## 4) 기능별 반영 현황

### 업체 데이터셋(전기/통신/소방)
- 프로젝트 내 정적 엑셀 포함 방식에서 업로드 기반으로 전환.
- 업로드 후 서버 경로 저장, 조회 API는 서버 경로 데이터 사용.
- 업로드 전 조회가 되던 문제(기존 정적/캐시 영향) 제거 방향으로 정리.

### 실적 기능
- Blob 기반 제거, 로컬 JSON + 첨부파일 구조로 전환.
- DB 가져오기(`records.sqlite`) 후 서버 경로에 반영됨.
- 필터에 `전체` 추가.
- 가져오기 중 로딩 안내 추가.
- 긴 텍스트가 잘리던 UI는 GUI 버전 구조 참고해 스크롤/레이아웃 보정 완료.

### 협정보드
- 저장/불러오기 모두 `agreement-board` 경로 사용.
- 발주처별 하위 폴더 구조(예: LH, 도로공사 등) 허용.
- 재귀 스캔으로 목록 구성, 메타데이터(발주처/금액대 등)는 JSON payload 내부로 관리.
- 파일명 자체에는 메타데이터가 안 보일 수 있음(내부 데이터 기반 필터링).

### 메일 기능
- 첨부 업로드/전송/정리 흐름이 로컬 파일시스템 기준으로 동작.
- SMTP 프로필은 브라우저 로컬 저장.
- 주소록은 서버 고정 경로(`config/mail.address-book.json`) 저장으로 통일.
- 과거 프로젝트 상대 경로 주소록은 로드 시 마이그레이션 처리.

### 임시업체 관리 (공유화)
- 서버 공용 저장소로 전환:
  - API: `/api/temp-companies`
  - 저장: `temp-companies/index.json`
- 업체조회/지역사/검색 경로에서 임시업체 데이터 병합 반영.
- 캐시 키에도 임시업체 `updatedAt` 반영.

### 개찰결과 도우미 (오늘 마지막 수정)
문제:
- 웹 모드에서 파일 업로드 후에도 `엑셀 파일을 선택하세요` 메시지 발생.
- 원인: `file.path`/`window.electronAPI.*` 전제 로직.

조치:
- 파일 선택 검증을 웹/일렉트론 공용으로 수정 (`File` 객체 기준 허용).
- 업체 검색을 Electron 직접 호출 대신 `searchClient` 경유로 통일.
- 웹 모드 분기 추가:
  - `개찰결과 엑셀 크기 및 폰트 수정`: 브라우저에서 변환 후 `..._서식변환.xlsx` 다운로드.
  - `투찰금액 템플릿 업체 배치`: 브라우저에서 처리 후 `..._배치완료.xlsx` 다운로드.
- 중복업체 선택 모달 확정 경로도 웹 분기 반영.

수정 파일:
- `src/view/features/bid-helper/pages/BidResultPage.jsx`

빌드 확인:
- `npm run build` 성공.

## 5) 사용 중 주의사항
- `npm run preview`는 API가 붙지 않아 업로드/서버저장 기능에서 404 가능.
- 운영 테스트는 반드시 `serve:prod` 계열로 확인.
- cloudflared `connect refused 127.0.0.1:4173`는 서버 재시작 중/미실행 시 정상적으로 뜰 수 있음.

## 6) 다음 세션 TODO
- 문서 자동 생성 기능 착수:
  - 목표: `docs` 양식(.docx) + 데이터 매핑으로 제출서류 자동 생성.
  - 권장 1차 범위:
    1. 템플릿 업로드/선택
    2. placeholder 치환(`{{업체명}}` 등)
    3. 결과 문서 일괄 생성(zip 또는 서버 저장)

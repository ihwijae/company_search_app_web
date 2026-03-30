# 새 PC 작업 환경 세팅 / 백업 문서

이 문서는 현재 저장소를 포맷 후 새 PC에서 다시 작업하기 위한 복구용 메모다.

기준 시점:
- 저장소: `company_search_app_web`
- 기준 문서:
  - 루트 `규칙.md`
  - `docs/웹앱_26.03.27.md`

중요 원칙:
- 현재 작업 기준은 `웹 전용`이다.
- 새 작업 시 Electron/IPC/preload 호환 코드를 새로 늘리지 않는다.
- 브라우저 기본 팝업 대신 앱 내부 UI를 우선 사용한다.

## 1. 새 PC에 먼저 설치할 것

### 필수 프로그램
- Git
- Node.js 20 LTS 권장
- npm 10 이상 권장
- Visual Studio Code

### 권장 프로그램
- Google Chrome
- Microsoft Edge
- Excel

설명:
- Chrome/Edge는 웹 앱 동작 확인용이다.
- Excel은 결과 `.xlsx` 확인용이다.
- 현재 저장소는 웹 전용 기준으로 작업하지만, `package.json`에는 아직 Electron 관련 의존성과 스크립트가 남아 있다. 그래서 `npm install` 시 Electron도 같이 설치된다.

## 2. 백업해야 하는 항목

포맷 전에 아래 파일과 정보를 반드시 따로 백업한다.

### 저장소 자체
- Git 원격 저장소에 푸시
- 또는 프로젝트 폴더 전체 백업

### 환경변수 파일
- `.env`
- `.env.local`
- 필요 시 `.env.local.example`

주의:
- 이 파일들에는 API 키나 Blob 토큰 같은 민감 정보가 들어갈 수 있다.
- 값 자체를 문서에 적지 말고, 안전한 개인 비밀번호 관리자나 별도 비공개 메모에 저장한다.

### 데이터/리소스 폴더 확인
- `db/`
- `public/`
- `template/`
- `템플릿/`
- `image/`

설명:
- `db/` 안의 원본 xlsx는 빌드 전에 정적 JSON 데이터셋 생성에 사용된다.
- 템플릿 폴더는 엑셀 내보내기에 필요하다.

### 개인 설정/운영 정보
- SMTP 관련 계정 정보
- Blob/Vercel 관련 토큰
- 필요 시 SMPP 계정 정보
- Git 계정 설정

## 3. 이 프로젝트에서 설치되는 npm 라이브러리 목록

아래는 `package.json` 기준 설치 라이브러리 목록이다.

### dependencies
- `@vercel/blob`
- `adm-zip`
- `axios`
- `axios-cookiejar-support`
- `cheerio`
- `chokidar`
- `exceljs`
- `nodemailer`
- `react`
- `react-dom`
- `react-quill`
- `sql.js`
- `tough-cookie`
- `xlsx`

### devDependencies
- `@types/react`
- `@types/react-dom`
- `@vitejs/plugin-react`
- `concurrently`
- `electron`
- `electron-builder`
- `electron-icon-builder`
- `eslint`
- `eslint-plugin-react`
- `eslint-plugin-react-hooks`
- `eslint-plugin-react-refresh`
- `vite`

정리:
- 실제 설치 명령은 라이브러리를 하나씩 설치할 필요 없이 `npm install` 한 번이면 된다.
- 위 목록은 새 PC에서 빠진 의존성이 있는지 확인하기 위한 백업용 기록이다.

## 4. 새 PC 복구 순서

### 1) 기본 도구 설치
- Git 설치
- Node.js 20 LTS 설치
- VS Code 설치

설치 확인:

```bash
node -v
npm -v
git --version
```

### 2) 저장소 가져오기

```bash
git clone <저장소 주소>
cd company_search_app_web
```

또는 백업해 둔 프로젝트 폴더를 그대로 복사해도 된다.

### 3) 환경변수 복원
- 백업해 둔 `.env`, `.env.local`을 프로젝트 루트에 복원

현재 확인된 예시:
- `.env.local.example`에는 `BLOB_READ_WRITE_TOKEN` 예시가 있음
- 실제 실행 시 Blob 기반 기능을 쓰려면 `BLOB_READ_WRITE_TOKEN` 또는 동등한 값이 필요할 수 있음

주의:
- 민감한 값은 Git에 올리지 않는다.

### 4) 의존성 설치

```bash
npm install
```

설명:
- 승인된 설치 prefix에 이미 `npm install`이 포함되어 있다.
- 설치 시 Electron 관련 패키지도 함께 내려받는다.

### 5) 개발 실행

웹 개발 기본:

```bash
npm run dev
```

빌드 확인:

```bash
npm run build
```

Electron 포함 실행이 필요할 때만:

```bash
npm run start:dev
```

주의:
- 현재 작업 원칙은 웹 전용이다.
- 평소 확인은 `npm run dev`, `npm run build` 중심으로 진행하는 것이 맞다.

## 5. 빌드/실행 관련 메모

### 빌드 전에 자동 실행되는 것
- `npm run build` 전에 `prebuild`가 실행된다.
- 실제 스크립트: `scripts/build-static-datasets.js`

의미:
- `db/` 폴더의 원본 xlsx를 읽어서 정적 JSON 데이터셋으로 만든다.
- 따라서 새 PC에서도 `db/` 폴더 원본 파일이 빠지면 검색 데이터가 정상 빌드되지 않을 수 있다.

### 주요 실행 명령
- `npm run dev`: Vite 웹 개발 서버
- `npm run build`: 웹 빌드
- `npm run start`: 빌드 후 Electron 실행
- `npm run start:dev`: Vite + Electron 동시 실행
- `npm run dist:win`: Windows 설치파일 빌드

## 6. 외부 서비스/토큰 메모

### Blob
- 사용 기능:
  - 협정보드 저장/불러오기
  - 공용 주소록 저장
  - 첨부 임시 업로드
  - 일부 데이터셋 API
- 필요한 값:
  - `BLOB_READ_WRITE_TOKEN`

### 메일
- 메일 발송은 `nodemailer` 기반
- SMTP 계정 정보가 필요함
- 네이버 SMTP를 쓰는 흐름이 코드와 문서에 남아 있음

### SMPP
- 실시간 조회 기능을 계속 쓸 경우 계정 정보가 필요할 수 있음
- 웹 전용 작업과 직접 관련이 적더라도 기존 기능 확인이 필요하면 백업해 두는 편이 안전하다.

## 7. 새 PC에서 우선 확인할 체크리스트

- `node -v`, `npm -v`, `git --version` 정상 확인
- 프로젝트 루트에 `.env`, `.env.local` 복원 완료
- `db/`, `template/`, `템플릿/` 누락 없음
- `npm install` 완료
- `npm run build` 성공
- `npm run dev` 접속 확인
- 업체조회 데이터 정상 조회 확인
- 협정보드 저장/불러오기 확인
- 메일 기능이 필요하면 SMTP 테스트 확인

## 8. 작업 시작 전에 다시 볼 문서

- `규칙.md`
- `docs/웹앱_26.03.27.md`
- 필요 시 `docs/리팩토링_기능분리_26.03.06.md`
- 필요 시 `docs/알림공통UI.md`

## 9. 한 줄 요약

새 PC에서는 `Node.js + Git + VS Code`를 먼저 설치하고, 저장소와 `.env/.env.local`, `db/`, 템플릿 폴더를 복원한 뒤 `npm install`, `npm run build`, `npm run dev` 순서로 확인하면 된다.

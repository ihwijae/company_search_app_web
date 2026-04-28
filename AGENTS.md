# Repository Guidelines

이 문서는 이 저장소에서 새 세션이 시작될 때 우선 적용되는 기본 작업 지침이다.

## Working Priority
- 이 저장소는 웹 버전만을 대상으로 작업한다.
- 목표는 기존 GUI(Electron) 앱을 웹으로 완전히 전환하는 것이다.
- 현재 저장소에 Electron 관련 코드가 남아 있어도, 새 작업은 웹 전용 단순화를 우선한다.
- Electron, IPC, preload, 데스크톱 전용 분기 호환을 유지하기 위한 새 코드는 추가하지 않는다.
- 기존 Electron 구현을 우선 사용하는 임시 fallback, 브리지 재사용, 웹/데스크톱 겸용 분기는 금지한다.
- 웹 기능으로 대체 가능한 기존 데스크톱 전용 코드는 제거 방향을 우선 검토한다.
- 웹 전환 중에도 기존 GUI에서 검증된 비즈니스 로직과 판정 규칙은 변경하지 않는다.
- 입력 기준, 판정 기준, 출력 결과는 기존 GUI와 동일해야 한다.
- 로직 변경이 불가피하면 임의로 바꾸지 말고 변경 사유와 영향 범위를 먼저 명시적으로 확인받는다.

## Project Structure & Module Organization
- React renderer lives under `src/view`, grouped by feature such as `features/search/pages/SearchPage.jsx`.
- Shared UI and logic components sit in `src/components`, `src/shared`, and `utils`.
- Static assets are located in `src/assets` and `image/`. Build artifacts land in `dist/` after running the Vite build.
- Legacy Electron main-process and preload files such as `main.js`, `preload.js`, and `src/main/**` may still exist during migration, but they are not the target architecture for new work.
- Excel parsing and business logic modules may exist across legacy and migrated paths; preserve behavior while moving implementation toward web-facing structure.

## UI Rules
- 모달창, 알림창, 확인창, 팝업창은 브라우저 기본 `alert`, `confirm`, `prompt` 또는 운영체제 기본 팝업에 의존하지 않는다.
- 가능한 한 앱 내부의 자체 UI를 사용한다.
- 공통 알림/확인 UI가 필요하면 `src/components/FeedbackProvider.jsx`와 관련 스타일을 우선 사용한다.
- 새 입력 UI가 필요할 때도 브라우저 기본 팝업보다 앱 내부 패널, 자체 다이얼로그, 별도 화면 등 포커스를 직접 제어할 수 있는 구조를 우선한다.

## Design Rules
- `docs` 폴더의 협정보드 리팩토링 관련 문서들에 정리된 방향을 우선 참고한다.
- 기능 구현 시 로직과 UI를 한 파일에 계속 누적하지 말고 역할별로 분리하는 설계를 우선한다.
- 새로운 기능을 만들거나 기존 기능을 확장할 때도 동일한 원칙을 적용한다.
- 화면 컴포넌트, 상태 관리, 비즈니스 로직, 데이터 처리, 공통 UI를 가능한 한 분리한다.
- 한 파일이 과도하게 커지면 하위 컴포넌트, 훅, 유틸, 서비스 레이어로 나누는 방향을 먼저 검토한다.
- 기존 기능에 임시 코드만 덧붙이기보다, 이후 유지보수와 확장을 고려한 구조로 정리한다.

## Build, Test, and Development Commands
- `npm run dev` starts the Vite renderer for web development.
- `npm run build` performs a production Vite build.
- `npm run preview` serves the built renderer locally for verification.
- `npm run serve` starts the Node web server with the configured data root.
- `npm run serve:lan` starts the Node web server bound to `0.0.0.0`.
- `npm run serve:prod` builds and serves the production web app.
- `npm run start:dev` runs the current multi-process development stack used during migration.
- Legacy Electron packaging commands such as `npm run start`, `npm run dist:win`, and `npm run dist:portable` may remain for transition purposes, but new work should not depend on them unless explicitly requested.

## Coding Style & Naming Conventions
- Use 2-space indentation for JavaScript and JSX.
- Prefer descriptive camelCase for variables and functions. React components remain PascalCase.
- Follow existing naming patterns: feature directories in kebab-case, component files in PascalCase, helper files in camelCase.
- Run ESLint with `npx eslint src` when touching complex logic. The project uses the config in `eslint.config.js`.

## Testing Guidelines
- Automated tests are not yet established; rely on manual verification within the web app and related local services.
- When adding logic-heavy modules, include ad-hoc scripts or console assertions where useful and document follow-up test needs.
- When migrating legacy behavior, verify that the resulting web behavior matches the prior GUI logic and output.

## Commit & Pull Request Guidelines
- Write imperative, concise commit subjects such as `Normalize file-type lookups in main process`.
- Group related file changes together.
- Pull requests should summarize motivation, list user-facing effects, and note manual test coverage.
- Attach screenshots or logs for UI regressions, migration-sensitive behavior changes, or server/API errors.
- Reference relevant issues or TODOs from `work.md` or `docs/` so maintainers can trace outstanding work.

## Security & Configuration Tips
- Configuration such as file path settings is persisted in `CONFIG_PATH`; avoid committing environment-specific copies.
- Never store production Excel data in the repo. Load local paths through the app's configuration flows.
- Before PC recovery or handoff, verify restoration of root env files and data folders such as `.env`, `.env.local`, `db/`, `template/`, and `템플릿/`.

## Environment & Handoff
- The default development environment is `Windows + WSL + VS Code Remote`.
- Prefer running development commands inside WSL.
- Before handing work to Codex on a new machine, ensure `WSL2`, `Ubuntu`, `Node.js`, `npm`, and `git` are already installed.
- Before installing Codex CLI, confirm `node -v` and `npm -v` work correctly inside WSL.
- Follow `docs/pc백업.md` and `scripts/setup-wsl-dev.sh` for WSL recovery and machine setup.

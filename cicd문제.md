# CI/CD 문제 정리

## 발생 일시
- 2026-04-08

## 증상
- GitHub Actions 실행 상태가 `Failure`로 표시됨.
- 에러 메시지:
  - `Invalid workflow file: .github/workflows/deploy.yml#L1`
  - `Unexpected value ...`

## 원인
- `.github/workflows/deploy.yml` 파일에 YAML이 아닌 쉘 스크립트 내용이 들어가 있었음.
- `set -euo pipefail`, `git pull`, `npm run build`, `pm2 restart` 같은 내용은
  워크플로우 파일이 아니라 `scripts/deploy-prod.sh`에 들어가야 함.

## 해결
1. `deploy.yml`을 올바른 YAML 형식으로 수정
2. `scripts/deploy-prod.sh`는 기존 쉘 스크립트로 유지
3. 수정 후 `git push`하여 Actions 재실행

## 정상 동작 기준
- Actions 상태: `Success`
- 서버 로그에서 배포 흐름 확인:
  1. `git pull`
  2. `npm ci`
  3. `npm run build`
  4. `pm2 restart company-search`

## 최종 결론
- 실패 원인은 CI/CD 구조 문제가 아니라 `deploy.yml` 파일 형식 오류였음.
- `deploy.yml` 수정 후 자동배포가 정상 동작함.

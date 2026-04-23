# Excel Edit Python Backend

엑셀수정(웹) 기능 전용 Python(FastAPI) 백엔드입니다.

## Quick Start

```bash
cd backend/python
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8787 --reload
```

## Endpoints

- `GET /health`
- `POST /excel-edit/upload` (multipart)
- `POST /excel-edit/update-year-end-color`
- `POST /excel-edit/update-credit-expiry`
- `POST /excel-edit/company-lookup`
- `POST /excel-edit/save` (multipart: `payload` + 선택 파일)
- `POST /excel-edit/render-pdf-page` (PyMuPDF PNG 렌더)
- `POST /excel-edit/render-image` (Pillow PNG 렌더)

### Upload 동작

- `/excel-edit/upload`는 미리보기용 업로드를 처리하며 서버 디스크에 파일을 저장하지 않습니다.
- 실제 파일 저장은 추후 확정/저장 API에서만 수행하도록 분리하는 것을 기준으로 합니다.

## Environment

- `EXCEL_EDIT_STORAGE_ROOT`
  - 업로드 파일 저장 루트
  - 기본값: `./backend/python/data`
- `EXCEL_EDIT_ARCHIVE_ROOT`
  - 확정/저장 시 첨부파일 보관 루트
  - 기본값: `EXCEL_EDIT_STORAGE_ROOT/archive`
- `EXCEL_EDIT_DB_PATH_ELECTRIC`
  - 전기 경영상태 DB 엑셀 파일 경로
- `EXCEL_EDIT_DB_PATH_COMMUNICATION`
  - 통신 경영상태 DB 엑셀 파일 경로
- `EXCEL_EDIT_DB_PATH_FIRE`
  - 소방 경영상태 DB 엑셀 파일 경로

### 경로 우선순위

- DB/보관 경로는 환경변수를 우선 사용합니다.
- 환경변수가 없으면 `ocr_config.json`(루트 또는 `clone/excel_modifi/ocr_config.json`)의 기존 설정값을 fallback으로 사용합니다.

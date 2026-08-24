# 필터 상태 저장 localStorage quota 정리

## 배경

브라우저 콘솔에 아래 오류가 발생했다.

```text
[persistence] localStorage unavailable: QuotaExceededError
Failed to execute 'setItem' on 'Storage': Setting the value of 'company_search_app:__probe__' exceeded the quota.
```

사용자가 브라우저나 탭을 닫았다가 다시 열었을 때 검색 필터 입력값이 유지되어야 하는데, 위 오류가 발생한 뒤 필터 복원이 정상 동작하지 않았다.

## 원인

필터 저장 자체는 작은 데이터만 필요하다.

- 업체명
- 사업자번호
- 지역 포함/제외
- 담당자
- 시평액/3년/5년 실적 범위
- 정렬값
- 일부 체크박스 상태

문제는 과거 저장 상태에 검색 결과 목록이나 선택 업체 전체 객체처럼 큰 값이 포함된 흔적이 있었고, 이 값이 localStorage quota를 채울 수 있다는 점이었다.

localStorage가 꽉 찬 상태에서 앱 시작 시 probe key를 저장하면 `QuotaExceededError`가 발생한다. 기존 구현은 이 오류를 localStorage 전체 사용 불가로 판단해 저장된 필터값을 읽거나 같은 key를 작게 덮어쓰는 복구 흐름까지 가지 못했다.

## 수정 내용

### 1. quota 초과 시 localStorage 읽기/삭제 경로 유지

`src/shared/persistence.js`에서 localStorage probe 저장이 quota 초과로 실패해도 localStorage 객체 자체는 사용할 수 있게 유지했다.

이유는 quota 초과 상황에서도 기존 key 읽기와 삭제는 가능하기 때문이다.

저장 시에는 기존 흐름처럼 먼저 `setItem`을 시도하고, 실패하면 같은 key를 삭제한 뒤 다시 저장한다.

```js
storage.removeItem(fullKey);
storage.setItem(fullKey, JSON.stringify(value));
```

따라서 예전에 저장된 큰 값이 같은 key에 남아 있으면, 그 값을 지운 뒤 현재 구조의 작은 필터 상태로 다시 저장할 수 있다.

### 2. 검색/업체목록 저장 상태 축소 유지

검색 페이지는 저장 직전에 큰 값을 비운다.

- `searchResults: []`
- `selectedCompany: null`
- `latestQuery: null`
- `resultsScrollPosition: { top: 0, left: 0 }`

업체목록 페이지도 저장 직전에 큰 값을 비운다.

- `results: []`
- `selectedCompanyKey: ''`
- `searched: false`
- `scrollPosition: { top: 0, left: 0 }`

즉, 화면을 닫았다가 다시 열 때 유지할 대상은 필터와 정렬 같은 작은 UI 상태로 제한한다.

## IndexedDB 정리

필터/화면 상태 저장용 IndexedDB fallback은 제거했다.

제거한 항목:

- `openPersistenceDb`
- `loadFromIndexedDb`
- `saveToIndexedDb`
- `removeFromIndexedDb`
- `loadPersistedAsync`
- 검색 페이지의 비동기 백업 복원 effect
- 업체목록 페이지의 비동기 백업 복원 effect

현재 필터/화면 상태 저장은 `loadPersisted`, `savePersisted` 기반의 localStorage 흐름만 사용한다.

## 유지한 IndexedDB

`src/shared/webSearchStore.js`의 IndexedDB는 제거하지 않았다.

이 IndexedDB는 필터 저장용이 아니라 웹 업체검색 데이터셋 저장용이다.

웹에서 엑셀 파일을 업로드하면 업체 데이터를 파싱해 전기/통신/소방 데이터셋으로 저장하고, 업체검색은 이 데이터셋을 조회한다.

이 데이터는 필터보다 크고 구조화된 데이터이므로 localStorage 대상이 아니다. 따라서 업체검색용 IndexedDB는 기존 동작에 영향이 없도록 유지했다.

## 마지막 메뉴 복원

마지막으로 보고 있던 메뉴도 `localStorage`에 저장된다.

- key: `company_search_app:last-route`
- 구현 위치: `src/App.jsx`

다만 협정보드 관련 화면은 마지막 메뉴 복원 대상에서 제외한다.

복원 제외 경로:

- `/agreement-board`
- `/agreements`
- `/region-search`
- `/lh/under50`
- `/lh/50to100`
- `/pps/under50`
- `/pps/50to100`
- `/kgas/under50`
- `/kgas/50to100`
- `/mois/under30`
- `/mois/30to50`
- `/mois/50to100`

협정보드 화면은 상태와 입력값이 복잡하므로, 브라우저를 다시 열 때 바로 협정보드로 복원하지 않고 검색 화면으로 시작하는 설계를 유지한다.

## 현재 기준

- 필터/정렬/체크박스/마지막 메뉴: localStorage
- 업체검색 데이터셋: IndexedDB
- 검색 결과 목록 전체: 저장하지 않음
- 업체 선택 전체 객체: 저장하지 않음
- 협정보드 경로: 마지막 메뉴 복원 제외

# FITNOVA 패치 내역

## 2026-10-18 — 모바일 UI 위치 및 DM 화면 안정화

### 변경 사항
- 휴대폰의 실제 뷰포트 높이(`100svh`, `100dvh`)와 안전 영역(`safe-area-inset-*`)을 고려하도록 CSS 보완
- 모바일에서 가로 화면 넘침을 줄이고, 콘텐츠와 입력 요소가 화면 폭을 벗어나지 않도록 보완
- DM 대화 화면을 모바일 전체 화면 레이아웃으로 구성하고, 대화 헤더와 메시지 입력창은 고정 영역으로 유지
- 메시지 목록 영역만 내부 스크롤되도록 조정
- 하단 내비게이션이 홈 제스처 영역과 겹치지 않도록 안전 여백 적용
- 팝업/모달의 최대 높이와 내부 스크롤 처리 보완
- 모바일 키보드가 열릴 때 뷰포트가 콘텐츠 크기에 반영되도록 `interactive-widget=resizes-content` 추가
- Android 앱에서 키보드 표시 시 레이아웃이 조정되도록 `windowSoftInputMode="adjustResize"` 추가

### 반영 파일
- `frontend/src/source-ui-parity.css`
- `frontend/index.html`
- `frontend/android/app/src/main/AndroidManifest.xml`

### Git 커밋
- `a427c6c` — Fix mobile viewport and DM layout stability
- `c297d3d` — Resize mobile viewport when keyboard opens
- `ba0f23d` — Resize Android app layout for keyboard

### 확인 사항
- Vercel 웹 배포는 `READY` 상태를 확인함.
- 실제 기기에서 모든 화면과 키보드 조합을 완전히 검증한 것은 아님. Android 네이티브 설정 변경은 새 Android 앱 빌드에 포함되어야 함.

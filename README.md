# refui — 레퍼런스 UI (위시켓 157617)

기업-전문가 거리 기반 자동 배정 시스템 분석 산출물을 웹으로 보여주는 정적 레퍼런스 UI.
발주처에 URL 하나로 공유하기 위한 자료이며, 랜딩에서 IT 전문가용 / 일반 담당자용 두 버전으로 분기한다.

## 구성

| 파일 | 역할 |
|---|---|
| `index.html` | 랜딩 — 2카드 분기 + 라이브 데모(`../proto/`)·자동 시연(`../demo/자동시연.html`) 링크 |
| `it.html` | IT 전문가용 — 아키텍처·알고리즘·기술 질의·리스크 |
| `nonit.html` | 일반 담당자용 — 동작·효과 중심, 기술 용어 배제 |
| `styles.css` | 공유 커스텀 CSS (Tailwind CDN 보완, 다크 전용) |
| `client.js` | 공유 스크립트 (차트 초기화·스크롤 리빌·`window.REFUI_DATA` 소비) |
| `data.json` | 분석 데이터 원장 — meta·insights·questions·risks·milestones·screens |

## 로컬 실행

CDN(Tailwind·Pretendard·lucide)을 쓰므로 인터넷 연결이 필요하다. `file://`로도 열리지만
`data.json`을 fetch하는 페이지가 있다면 로컬 서버를 사용한다.

```bash
cd doc  # refui의 상위 — ../proto, ../demo 상대 링크가 함께 동작한다
python3 -m http.server 8000
# http://localhost:8000/refui/
```

## 재배포

```bash
./deploy.sh   # 저장소 루트의 배포 스크립트 — GitHub Pages(meleteyo.github.io/refui-157617) 반영
```

주의: 실명·실기업·발주처 특정 정보 금지(샘플은 김OO·가상 상호), 지도 시각화 금지.

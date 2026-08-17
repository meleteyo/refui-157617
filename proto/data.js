// =====================================================================
// data.js — 거리 기반 자동 배정 시스템 (#157617) 프로토타입 데모 데이터
//
// 설계 원본: doc/models/5_UI디자인가이드.md 샘플 데이터 원장 + 모델 82~85
// 기준 시각: 2026-08-16 09:20 — (주)두리엔지 회수(08-14 09:35) 이후 시점
//   → 김OO 당월 11건·진행중 2 (원장 "83 시점" 정합)
// 규칙: 모든 ENUM은 대문자 영문 / ID 포맷 APL-YYYY-MMDD-NNNN·묶음 YYYY-NNNNN
// 주의: 전 항목 가상 데이터 — 실명·실기업·발주처 특정 정보 없음
// =====================================================================

window.NOW_LABEL = "2026-08-16 09:20";
window.PROVINCES = ["경기", "서울", "인천"];

window.ENUMS = {
  CASE_STATUS: ["WAIT", "TARGET", "CONFIRMED", "ONGOING", "REVOKED", "DONE"],
  WAIT_REASON: ["GEO_FAIL", "NO_EXPERT"],
  EVENT_TYPE: ["ASSIGN", "REVOKE", "WAIT", "WAIT_RELEASE"],
  LOAD_COLOR: ["GREEN", "YELLOW", "RED", "GRAY"],
  POLICY: ["DISTANCE_FIRST", "BALANCE_FIRST"],
};

// ── 운영 파라미터 (ENG_PARAM — 모델 85 현재 값) ──────────────────────
window.PARAMS = {
  bundleKm: 3.0,
  devLimit: 2,
  schedule: "매일 06:00 배치",
  singleAllowed: "허용",
  dailyLimitOpt: "미사용",
  weight: 0.5,
  lastModifiedBy: "이OO",
  lastModifiedAt: "2026-08-10 09:12",
  round: 1,
};

// ── 최근 배치 실행 (ENG_JOB_RUN) ────────────────────────────────────
window.LAST_JOB_RUN = {
  executedAt: "2026-08-16 06:00",
  status: "SUCCESS",           // SUCCESS | FAILED
  confirmedCount: 71,
  waitCount: 3,
};

// ── 전문가 (EXT_EXPERT + ENG_COUNTER 당월) — 원장 4인 + 보조 5인 ────
window.EXPERTS = [
  { id: "EXP-01", name: "김OO", province: "경기", monthCount: 11, ongoing: 2, available: true,  grayReason: null },
  { id: "EXP-02", name: "이OO", province: "경기", monthCount: 10, ongoing: 4, available: true,  grayReason: null },
  { id: "EXP-03", name: "최OO", province: "경기", monthCount: 13, ongoing: 4, available: true,  grayReason: null },   // 허용 편차 초과 예시
  { id: "EXP-04", name: "정OO", province: "경기", monthCount: 12, ongoing: 1, available: false, grayReason: "부재 2026-08-18~08-22" },
  { id: "EXP-05", name: "박OO", province: "서울", monthCount: 14, ongoing: 0, available: false, grayReason: "배정 가능 OFF" },   // 경기 후보 등장 금지
  { id: "EXP-06", name: "한OO", province: "서울", monthCount: 18, ongoing: 3, available: true,  grayReason: null },
  { id: "EXP-07", name: "송OO", province: "서울", monthCount: 17, ongoing: 2, available: true,  grayReason: null },
  { id: "EXP-08", name: "임OO", province: "인천", monthCount: 22, ongoing: 5, available: true,  grayReason: null },
  { id: "EXP-09", name: "강OO", province: "인천", monthCount: 18, ongoing: 2, available: true,  grayReason: null },
];

// ── 대시보드 KPI (모델 82) ───────────────────────────────────────────
window.KPIS = {
  monthlyAssignTotal: 762,
  avgDistanceKm: 5.2,
  waitCount: 3,
  // 균등 위반 도 수는 EXPERTS + PARAMS.devLimit로 화면에서 실시간 산출
};

// ── 7일 배정/대기 추이 (ENG_ASSIGN_LOG 일별 집계) ───────────────────
window.TREND_7D = [
  { date: "08-10", assign: 61, wait: 2 },
  { date: "08-11", assign: 68, wait: 3 },
  { date: "08-12", assign: 74, wait: 2 },
  { date: "08-13", assign: 63, wait: 4 },
  { date: "08-14", assign: 70, wait: 2 },
  { date: "08-15", assign: 58, wait: 3 },
  { date: "08-16", assign: 71, wait: 3 },
];

// ── 대기 큐 (assign1002 + ENG_ASSIGN_LOG 대기 근거 — 모델 83) ────────
// candidates: 후보 전문가 참조(name) + 거리. 당월 건수·진행중은 EXPERTS에서 실시간 해석
window.WAIT_QUEUE = [
  {
    applyNo: "APL-2026-0812-0117", company: "(주)한빛정밀", province: "경기",
    reason: "GEO_FAIL", ruleCode: "BS0003", waitedAt: "2026-08-15 06:02", elapsedH: 27,
    receivedAt: "2026-08-12",
    addr: {
      raw: "경기 안산 단원구 별망로 178 나동 2층",
      refined: "경기도 안산시 단원구 별망로 178",
      confidence: "실패", failCode: "ADDR_PARSE",
    },
  },
  {
    applyNo: "APL-2026-0813-0042", company: "대성테크(주)", province: "경기",
    reason: "NO_EXPERT", ruleCode: "BS0009", waitedAt: "2026-08-15 06:02", elapsedH: 27,
    receivedAt: "2026-08-13", bundleNo: "2026-00187",
    reasonDetail: "도내 배정 가능 전문가 없음 — 묶음 반경 내 후보 전원 허용 편차 초과·근접",
    candidates: [
      { name: "김OO", distanceKm: 5.1 },
      { name: "최OO", distanceKm: 6.7 },
      { name: "이OO", distanceKm: 9.8 },
    ],
  },
  {
    applyNo: "APL-2026-0813-0107", company: "미래솔루션(주)", province: "서울",
    reason: "GEO_FAIL", ruleCode: "BS0003", waitedAt: "2026-08-15 06:02", elapsedH: 27,
    receivedAt: "2026-08-13",
    addr: {
      raw: "서울 금천 가산디지털1로 168 B동 지하",
      refined: "서울특별시 금천구 가산디지털1로 168",
      confidence: "의심", failCode: "GEO_AMBIG",
    },
  },
];

// ── 재배정 대상 (회수 복귀 건 — assign1007, 모델 83) ─────────────────
window.REASSIGN_TARGETS = [
  {
    applyNo: "APL-2026-0812-0203", company: "(주)두리엔지", province: "경기",
    bundleNo: "2026-00186",
    revokeReason: "기업 일정 변경 요청", prevExpert: "김OO", prevDistanceKm: 5.1,
    assignedAt: "2026-08-13 06:02", revokedAt: "2026-08-14 09:35",
    candidates: [
      { name: "김OO", distanceKm: 5.1 },
      { name: "이OO", distanceKm: 7.3 },
      { name: "최OO", distanceKm: 8.9 },
    ],
  },
  {
    applyNo: "APL-2026-0811-0156", company: "세명산업(주)", province: "경기",
    bundleNo: "2026-00174",
    revokeReason: "기업 일정 변경 요청", prevExpert: "이OO", prevDistanceKm: 3.8,
    assignedAt: "2026-08-12 06:03", revokedAt: "2026-08-13 15:40",
    candidates: [
      { name: "이OO", distanceKm: 3.8 },
      { name: "최OO", distanceKm: 4.9 },
      { name: "김OO", distanceKm: 6.2 },
    ],
  },
];

// ── 회수 대상 검색 결과 (배정확정·진행중 — assign1006, 모델 83) ──────
window.REVOKABLE_CASES = [
  { applyNo: "APL-2026-0814-0031", company: "(주)신광정공", province: "경기", status: "CONFIRMED", expert: "김OO", distanceKm: 4.2, assignedDate: "2026-08-15" },
  { applyNo: "APL-2026-0813-0088", company: "우성기계(주)", province: "서울", status: "ONGOING",   expert: "한OO", distanceKm: 3.1, assignedDate: "2026-08-14" },
  { applyNo: "APL-2026-0815-0009", company: "(주)태건산업", province: "인천", status: "CONFIRMED", expert: "강OO", distanceKm: 5.6, assignedDate: "2026-08-16" },
];

// ── 배정 이력 (ENG_ASSIGN_LOG — 모델 84, 처리 일시 내림차순) ─────────
// xai: 기록 시점 스냅샷(후보 비교·규칙 체인·파라미터) — 현재 데이터로 재계산하지 않음 (BS0090)
// 필수 스토리: ① 두리엔지 배정→회수 쌍  ② 서진금속 대기(실패)→재배정 쌍
window.ASSIGN_HISTORY = [
  {
    id: "LOG-0459", at: "2026-08-16 06:02", type: "ASSIGN",
    applyNo: "APL-2026-0815-0009", company: "(주)태건산업", province: "인천",
    expert: "강OO", distanceKm: 5.6, rules: ["BS0034", "BS0006"], bundleNo: "2026-00201",
    xai: {
      narrative: "강OO — 편차 이내 후보 1명 · 거리 5.6km",
      params: "묶음 반경 3.0km · 허용 편차 2건 · 배정 주기 일 1회 06:00",
      candidates: [
        { name: "강OO", month: 17, ongoing: 2, km: 5.6, note: "선정" },
        { name: "임OO", month: 22, ongoing: 5, km: 4.8, note: "허용 편차 초과" },
      ],
    },
  },
  {
    id: "LOG-0455", at: "2026-08-15 06:02", type: "WAIT",
    applyNo: "APL-2026-0813-0042", company: "대성테크(주)", province: "경기",
    expert: null, distanceKm: null, rules: ["BS0009"],
    waitReason: "후보 없음(NO_EXPERT) — 묶음 반경 내 배정 가능 전문가 없음",
  },
  {
    id: "LOG-0454", at: "2026-08-15 06:02", type: "WAIT",
    applyNo: "APL-2026-0812-0117", company: "(주)한빛정밀", province: "경기",
    expert: null, distanceKm: null, rules: ["BS0003"],
    waitReason: "주소 실패(GEO_FAIL) — 좌표 변환 실패 (ADDR_PARSE)",
  },
  {
    id: "LOG-0453", at: "2026-08-15 06:02", type: "WAIT",
    applyNo: "APL-2026-0813-0107", company: "미래솔루션(주)", province: "서울",
    expert: null, distanceKm: null, rules: ["BS0003"],
    waitReason: "주소 실패(GEO_FAIL) — 좌표 모호 (GEO_AMBIG)",
  },
  {
    id: "LOG-0450", at: "2026-08-14 09:35", type: "REVOKE",
    applyNo: "APL-2026-0812-0203", company: "(주)두리엔지", province: "경기",
    expert: "김OO", distanceKm: 5.1, rules: ["BS0010", "BS0052"],
    revoke: { reason: "기업 일정 변경 요청", prevExpert: "김OO", prevKm: 5.1, assignedAt: "2026-08-13 06:02", impact: "김OO 8월 건수 12→11 · 진행중 3→2" },
  },
  {
    id: "LOG-0447", at: "2026-08-14 06:02", type: "ASSIGN",
    applyNo: "APL-2026-0813-0088", company: "우성기계(주)", province: "서울",
    expert: "한OO", distanceKm: 3.1, rules: ["BS0034", "BS0006"], bundleNo: "2026-00195",
    xai: {
      narrative: "한OO — 편차 이내 후보 2명 중 거리 최소 3.1km",
      params: "묶음 반경 3.0km · 허용 편차 2건 · 배정 주기 일 1회 06:00",
      candidates: [
        { name: "한OO", month: 17, ongoing: 2, km: 3.1, note: "선정" },
        { name: "송OO", month: 17, ongoing: 2, km: 4.6, note: "거리 열세" },
      ],
    },
  },
  {
    id: "LOG-0444", at: "2026-08-13 15:40", type: "REVOKE",
    applyNo: "APL-2026-0811-0156", company: "세명산업(주)", province: "경기",
    expert: "이OO", distanceKm: 3.8, rules: ["BS0010", "BS0052"],
    revoke: { reason: "기업 일정 변경 요청", prevExpert: "이OO", prevKm: 3.8, assignedAt: "2026-08-12 06:03", impact: "이OO 8월 건수 11→10 · 진행중 5→4" },
  },
  {
    // ★ 원장 대표 스토리 — (주)두리엔지 배정 (이후 08-14 회수)
    id: "LOG-0438", at: "2026-08-13 06:02", type: "ASSIGN",
    applyNo: "APL-2026-0812-0203", company: "(주)두리엔지", province: "경기",
    expert: "김OO", distanceKm: 5.1, rules: ["BS0034", "BS0006"], bundleNo: "2026-00186",
    xai: {
      narrative: "김OO — 편차 이내 후보 2명 중 진행중 최소 2건·거리 5.1km",
      params: "묶음 반경 3.0km · 허용 편차 2건 · 배정 주기 일 1회 06:00",
      candidates: [
        { name: "김OO", month: 11, ongoing: 2, km: 5.1, note: "선정" },
        { name: "이OO", month: 11, ongoing: 4, km: 4.2, note: "진행중 건수 열세" },
        { name: "최OO", month: 13, ongoing: 1, km: 6.0, note: "허용 편차 초과" },
      ],
    },
  },
  {
    id: "LOG-0432", at: "2026-08-12 06:03", type: "ASSIGN",
    applyNo: "APL-2026-0811-0156", company: "세명산업(주)", province: "경기",
    expert: "이OO", distanceKm: 3.8, rules: ["BS0034", "BS0006"], bundleNo: "2026-00174",
    xai: {
      narrative: "이OO — 편차 이내 후보 3명 중 거리 최소 3.8km",
      params: "묶음 반경 3.0km · 허용 편차 2건 · 배정 주기 일 1회 06:00",
      candidates: [
        { name: "이OO", month: 10, ongoing: 4, km: 3.8, note: "선정" },
        { name: "김OO", month: 11, ongoing: 3, km: 5.5, note: "거리 열세" },
        { name: "최OO", month: 12, ongoing: 2, km: 7.1, note: "거리 열세" },
      ],
    },
  },
  {
    // ★ 실패 + 재배정 1쌍 — (주)서진금속: 대기(주소 실패) → 보정 → 재배정
    id: "LOG-0431", at: "2026-08-12 06:02", type: "ASSIGN",
    applyNo: "APL-2026-0810-0074", company: "(주)서진금속", province: "경기",
    expert: "이OO", distanceKm: 2.9, rules: ["BS0034", "BS0006"], bundleNo: "2026-00171",
    reassign: true, reassignNote: "주소 보정 후 재배정",
    xai: {
      narrative: "이OO — 주소 보정 후 재배정 · 편차 이내 후보 2명 중 거리 최소 2.9km",
      params: "묶음 반경 3.0km · 허용 편차 2건 · 배정 주기 일 1회 06:00",
      candidates: [
        { name: "이OO", month: 9, ongoing: 3, km: 2.9, note: "선정" },
        { name: "김OO", month: 11, ongoing: 3, km: 4.4, note: "거리 열세" },
      ],
    },
  },
  {
    id: "LOG-0430", at: "2026-08-12 06:01", type: "WAIT_RELEASE",
    applyNo: "APL-2026-0810-0074", company: "(주)서진금속", province: "경기",
    expert: null, distanceKm: null, rules: ["BS0003"],
    waitReason: "보정 주소 재변환 성공 — 대기 해제·배정대상 복귀 (geo1003)",
  },
  {
    id: "LOG-0424", at: "2026-08-11 06:02", type: "WAIT",
    applyNo: "APL-2026-0810-0074", company: "(주)서진금속", province: "경기",
    expert: null, distanceKm: null, rules: ["BS0003"],
    waitReason: "주소 실패(GEO_FAIL) — 좌표 변환 실패 (GEO_NOTFOUND)",
  },
  {
    // 엔진 도입 전 이력 — 후보 스냅샷 없음 (BS0090 "근거 데이터 없음" 형상)
    id: "LOG-0401", at: "2026-08-01 10:12", type: "ASSIGN",
    applyNo: "APL-2026-0731-0088", company: "(주)동아정밀", province: "서울",
    expert: "송OO", distanceKm: 4.0, rules: [],
    xai: null, noSnapshot: true,
  },
];

// ── 통계 (stat1001 — 모델 84 통계 탭) ────────────────────────────────
window.STATS = {
  period: "2026-08-01 ~ 2026-08-16",
  provinces: [
    { province: "경기", assign: 412, wait: 9, avgKm: 5.8 },
    { province: "서울", assign: 263, wait: 4, avgKm: 3.9 },
    { province: "인천", assign: 87,  wait: 1, avgKm: 4.4 },
  ],
  avgDistanceKm: 5.2,
};

// ── 파라미터 프리셋 2세트 (모델 85 — A/B 비교용: 현행 / 제안) ─────────
window.PARAM_PRESETS = [
  {
    id: "PRESET-CURRENT", name: "현행 운영 설정", active: true,
    bundleKm: 3.0, devLimit: 2, weight: 0.5,
    note: "2026-08-10 1회차 적용 — 운영 중",
    sim: {
      runId: "2026-00051", ranAt: "2026-08-14 16:02",
      period: "2026-08-03 ~ 2026-08-09", targetCount: 438,
      matchRate: 87.4, avgDistance: 11.8, maxDeviation: 2, waitCount: 9,
      waitDetail: "좌표 실패 5 · 전문가 없음 4",
      distMax: 13, distMin: 11,
      distribution: [
        { name: "김OO", count: 12 }, { name: "이OO", count: 11 }, { name: "최OO", count: 13 },
        { name: "한OO", count: 12 }, { name: "송OO", count: 11 }, { name: "강OO", count: 12 },
      ],
    },
  },
  {
    id: "PRESET-PROPOSED", name: "제안 설정 (반경·편차 완화)", active: false,
    bundleKm: 3.5, devLimit: 3, weight: 0.5,
    note: "83 화면 후보 없음 건 해소 목적 — 드라이런 근거 2026-00052",
    sim: {
      runId: "2026-00052", ranAt: "2026-08-14 16:05",
      period: "2026-08-03 ~ 2026-08-09", targetCount: 438,
      matchRate: 88.6, avgDistance: 12.1, maxDeviation: 3, waitCount: 5,
      waitDetail: "좌표 실패 5 · 전문가 없음 0",
      distMax: 14, distMin: 11,
      distribution: [
        { name: "김OO", count: 13 }, { name: "이OO", count: 11 }, { name: "최OO", count: 14 },
        { name: "한OO", count: 12 }, { name: "송OO", count: 11 }, { name: "강OO", count: 13 },
      ],
    },
  },
];

// ── 파라미터 적용 이력 (ENG_PARAM_LOG — 모델 85) ─────────────────────
window.PARAM_LOG = [
  { at: "2026-08-10 09:12", change: "묶음 반경 2.5 → 3.0 km", runId: "2026-00042", by: "이OO", round: "1회차", rollbackable: true },
  { at: "2026-08-03 14:00", change: "최초 등록 (묶음 2.5km · 편차 2건)", runId: null, by: "이OO", round: "착수", rollbackable: false },
];

// ── 규칙 코드 설명 (근거 배지 툴팁) ──────────────────────────────────
window.RULE_DESC = {
  MG1002: "같은 도 안에서 전문가별 배정 건수 차이를 허용 편차 이내로 유지",
  MG1008: "배정 규칙 파라미터 변경은 담당자 확인 후 반영",
  BS0003: "지오코딩 실패 주소는 보정 대상 기록 후 신청 건 대기 전환",
  BS0005: "같은 도 전문가 중 월 배정 건수가 허용 편차 이내가 되도록 선정",
  BS0006: "균등 제약을 지키는 후보 중 거리 최소 전문가 선정",
  BS0008: "배정·회수 시 판단 근거를 이력으로 기록 (선정 전문가·거리·규칙)",
  BS0009: "배정 가능 전문가가 없는 묶음의 신청 건은 대기 전환",
  BS0010: "회수 건은 실적 카운터 차감 후 재배정 대상으로 복귀",
  BS0021: "배정 실행은 동시에 하나만 기동 (단일 실행 잠금)",
  BS0034: "묶음 반경 내 신청 건을 하나의 배정 묶음으로 구성",
  BS0046: "배정 실행 시 적용 파라미터 스냅샷을 이력에 함께 기록",
  BS0052: "배정 회수는 회수 사유 필수 입력·이력 기록",
  BS0053: "완료 상태의 신청 건은 회수 불가",
  BS0087: "수동 재배정은 사유 필수 — 처리 구분·사유·전문가·거리 이력 기록",
  BS0088: "대기 사유 코드별 추천 액션 매핑 (GEO_FAIL 보정 / NO_EXPERT 재배정)",
  BS0089: "편차 상한 초과 후보는 차단하지 않고 경고·사유 확인 후 배정",
  BS0090: "설명 카드는 기록된 이력 데이터만으로 구성 — 재계산하지 않음",
  BS0091: "통계는 이력의 처리 일시 기준으로 집계",
  BS0092: "이력·통계 화면은 조회 전용",
  BS0093: "시뮬레이션 근거 실행 ID 없이 파라미터 변경 불가",
  BS0094: "파라미터 적용 전후 값·승인자·근거 실행 ID·회차 이력 기록, 롤백 지원",
  BS0095: "파라미터는 유효 범위 내 입력만 허용 (입력 시점 차단)",
};

// ── 감사 로그 (사이드패널 하단 공통 표시용) ──────────────────────────
window.MOCK_AUDIT = [
  { time: "2026-08-13 06:02", action: "ASSIGN",      actor: "engine" },
  { time: "2026-08-13 06:02", action: "COUNTER_INC", actor: "engine" },
  { time: "2026-08-14 09:35", action: "REVOKE",      actor: "manager01" },
  { time: "2026-08-14 09:35", action: "COUNTER_DEC", actor: "engine" },
  { time: "2026-08-16 06:00", action: "BATCH_RUN",   actor: "scheduler" },
];

// ── Tweaks 기본값 ────────────────────────────────────────────────────
window.TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "brandName": "배정 관리 콘솔",
  "brandColor": "#a855f7",
  "policyMode": "DISTANCE_FIRST",
  "showRuleBadges": true,
  "density": "regular"
}/*EDITMODE-END*/;

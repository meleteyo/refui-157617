// dashboard.jsx — 01 배정 현황 모니터 (모델 82)
// KPI 4종 · 도별 편차 게이지(저울 색 규약 T6) · 전문가 부하 히트맵 · 오늘 처리할 것
const { useState: useStateD, useMemo: useMemoD } = React;

// ─────────────────────────────────────────────────────────────────────
// 공용 도메인 컴포넌트 (dashboard.jsx에서 정의 — console/history/templates 재사용)
// ─────────────────────────────────────────────────────────────────────

const LOAD_STYLE = {
  GREEN:  { label: "여유",        bg: "bg-emerald-500/15", text: "text-emerald-300", dot: "bg-emerald-400" },
  YELLOW: { label: "상한 근접",   bg: "bg-amber-500/15",   text: "text-amber-300",   dot: "bg-amber-400" },
  RED:    { label: "상한 초과",   bg: "bg-rose-500/15",    text: "text-rose-300",    dot: "bg-rose-400" },
  GRAY:   { label: "배정 제외",   bg: "bg-slate-600/20",   text: "text-slate-400",   dot: "bg-slate-500" },
};

function LoadBadge({ level, label }) {
  const c = LOAD_STYLE[level] || LOAD_STYLE.GRAY;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md ${c.bg} ${c.text} px-2 py-0.5 text-xs font-medium`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}></span>
      {label || c.label}
    </span>
  );
}

const EVENT_STYLE = {
  ASSIGN:       { label: "배정",       bg: "bg-emerald-500/15", text: "text-emerald-300", dot: "bg-emerald-400" },
  REVOKE:       { label: "회수",       bg: "bg-orange-500/15",  text: "text-orange-300",  dot: "bg-orange-400" },
  WAIT:         { label: "대기 전환",  bg: "bg-amber-500/15",   text: "text-amber-300",   dot: "bg-amber-400" },
  WAIT_RELEASE: { label: "대기 해제",  bg: "bg-slate-500/15",   text: "text-slate-300",   dot: "bg-slate-400" },
};

function EventBadge({ type }) {
  const c = EVENT_STYLE[type] || EVENT_STYLE.WAIT_RELEASE;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md ${c.bg} ${c.text} px-2 py-0.5 text-xs font-medium whitespace-nowrap`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}></span>
      {c.label}
    </span>
  );
}

const CASE_STYLE = {
  CONFIRMED: { label: "배정확정",           bg: "bg-emerald-500/15", text: "text-emerald-300" },
  ONGOING:   { label: "진행중",             bg: "bg-sky-500/15",     text: "text-sky-300" },
  WAIT:      { label: "대기",               bg: "bg-amber-500/15",   text: "text-amber-300" },
  TARGET:    { label: "배정대상(회수 복귀)", bg: "bg-orange-500/15",  text: "text-orange-300" },
  DONE:      { label: "완료",               bg: "bg-slate-500/15",   text: "text-slate-300" },
};

function CaseBadge({ status }) {
  const c = CASE_STYLE[status] || CASE_STYLE.DONE;
  return <span className={`inline-flex rounded-md ${c.bg} ${c.text} px-2 py-0.5 text-xs font-medium whitespace-nowrap`}>{c.label}</span>;
}

// 근거 배지 — 규칙 코드 칩 (hover 시 규칙 설명 툴팁, 디자인 원칙 1)
function RuleChip({ code }) {
  return (
    <span title={window.RULE_DESC[code] || code}
      className="inline-flex rounded bg-slate-800 border border-slate-700/60 px-1.5 py-0.5 text-[10px] font-mono text-slate-300 cursor-help whitespace-nowrap">
      {code}
    </span>
  );
}

// 도별 부하 산출 — BS0084·BS0085 (배정 가능 전문가만 대상)
// 반환: { [province]: { min, max, cap, deviation, color, cells:[{expert, count, color}] } }
function calcProvinceStats() {
  const devLimit = window.PARAMS.devLimit;
  const out = {};
  window.PROVINCES.forEach((prov) => {
    const all = window.EXPERTS.filter((e) => e.province === prov);
    const act = all.filter((e) => e.available);
    const counts = act.map((e) => e.monthCount);
    const min = counts.length ? Math.min(...counts) : 0;
    const max = counts.length ? Math.max(...counts) : 0;
    const cap = min + devLimit;
    const deviation = max - min;
    const color = deviation >= devLimit ? "RED" : deviation >= devLimit - 1 ? "YELLOW" : "GREEN";
    const cells = all.map((e) => ({
      expert: e,
      count: e.monthCount,
      color: !e.available ? "GRAY" : e.monthCount >= cap ? "RED" : e.monthCount >= cap - 1 ? "YELLOW" : "GREEN",
    }));
    out[prov] = { min, max, cap, deviation, color, cells };
  });
  return out;
}

// 편차 초과 판정 (후보 카드·경고 다이얼로그 공용 — BS0089)
function isOverCap(expertName) {
  const e = window.EXPERTS.find((x) => x.name === expertName);
  if (!e) return false;
  const st = calcProvinceStats()[e.province];
  return st ? e.monthCount >= st.cap : false;
}

Object.assign(window, { LoadBadge, EventBadge, CaseBadge, RuleChip, calcProvinceStats, isOverCap });

// ─────────────────────────────────────────────────────────────────────
// Dashboard 화면
// ─────────────────────────────────────────────────────────────────────

const GAUGE_COLOR = {
  GREEN:  { badge: "초록", bar: "bg-emerald-400" },
  YELLOW: { badge: "노랑", bar: "bg-amber-400" },
  RED:    { badge: "빨강", bar: "bg-rose-400" },
};

function Dashboard({ navigate, tweaks }) {
  const [month, setMonth] = useStateD("2026-08");
  const [provinceF, setProvinceF] = useStateD("전체");
  const [runDialog, setRunDialog] = useStateD(false);
  const [toast, setToast] = useStateD(null);

  const stats = useMemoD(() => calcProvinceStats(), []);
  const provinces = provinceF === "전체" ? window.PROVINCES : [provinceF];
  const violated = window.PROVINCES.filter((p) => stats[p].color === "RED").length;

  const waitItems = window.WAIT_QUEUE;
  const geoFail = waitItems.filter((w) => w.reason === "GEO_FAIL").length;
  const noExpert = waitItems.filter((w) => w.reason === "NO_EXPERT").length;
  const reassignCount = window.REASSIGN_TARGETS.length;
  const todayTotal = waitItems.length + reassignCount;

  // 도 필터 적용 시 KPI 재집계 (모델 82 {설명} 4)
  const provRow = provinceF !== "전체" ? window.STATS.provinces.find((p) => p.province === provinceF) : null;
  const kpiTotal = provRow ? provRow.assign : window.KPIS.monthlyAssignTotal;
  const kpiAvg = provRow ? provRow.avgKm : window.KPIS.avgDistanceKm;
  const kpiWait = provinceF === "전체" ? waitItems.length : waitItems.filter((w) => w.province === provinceF).length;
  const kpiViolated = provinceF === "전체" ? violated : (stats[provinceF].color === "RED" ? 1 : 0);

  const fireToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-end justify-between">
        <div>
          <window.SectionLabel color="purple">MONITOR · {window.NOW_LABEL} 기준 · 조회 전용</window.SectionLabel>
          <h1 className="text-3xl font-bold mt-1.5 tracking-tight text-slate-50">배정 현황 모니터</h1>
          <p className="text-sm text-slate-300 mt-1">ENG_COUNTER · ENG_JOB_RUN · ENG_CASE_STATE · ENG_ASSIGN_LOG 집계 — 백엔드 재작업 없음 (API-first)</p>
        </div>
        {/* 주 액션 1개 — <배정 실행> (원칙 5, T7) */}
        <button onClick={() => setRunDialog(true)}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-sm font-semibold flex items-center gap-2 shadow-lg shadow-purple-500/30">
          <window.Icon name="play" className="w-3.5 h-3.5" />배정 실행
        </button>
      </div>

      {/* 상단 컨텍스트 바 — 최근 배치 실행 (ENG_JOB_RUN) */}
      <window.Card className="px-5 py-3 flex items-center gap-4 text-sm">
        <span className="text-slate-400 text-xs uppercase tracking-wider">최근 배치</span>
        <span className="font-mono text-slate-200">{window.LAST_JOB_RUN.executedAt}</span>
        {window.LAST_JOB_RUN.status === "SUCCESS"
          ? <span className="inline-flex rounded-md bg-slate-500/15 text-slate-300 px-2 py-0.5 text-xs font-medium">완료</span>
          : <span className="inline-flex rounded-md bg-rose-500/15 text-rose-300 px-2 py-0.5 text-xs font-medium">실패</span>}
        <span className="text-slate-400">확정 <b className="text-emerald-300 tabular-nums">{window.LAST_JOB_RUN.confirmedCount}</b>건</span>
        <span className="text-slate-400">대기 <b className="text-amber-300 tabular-nums">{window.LAST_JOB_RUN.waitCount}</b>건</span>
        <span className="ml-auto text-[11px] font-mono text-slate-500">ENG_JOB_RUN · 단일 실행 잠금 BS0021</span>
      </window.Card>

      {/* 필터 — 조회 전용 화면의 유일한 입력 항목 (원칙 6: 이탈 후 복귀 시 유지) */}
      <window.Card className="px-5 py-3 flex items-center gap-3">
        <window.Icon name="filter" className="w-3.5 h-3.5 text-slate-400" />
        <label className="text-xs text-slate-400">연월</label>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
          className="px-3 py-1.5 rounded-md bg-slate-950 border border-slate-700/60 text-sm focus:border-purple-500 outline-none" />
        <label className="text-xs text-slate-400 ml-2">도</label>
        <select value={provinceF} onChange={(e) => setProvinceF(e.target.value)}
          className="px-3 py-1.5 rounded-md bg-slate-950 border border-slate-700/60 text-sm focus:border-purple-500 outline-none">
          {["전체"].concat(window.PROVINCES).map((p) => <option key={p}>{p}</option>)}
        </select>
        <button onClick={() => fireToast("monitor1001 재조회 — 집계 갱신 (데모)")}
          className="px-3.5 py-1.5 rounded-md bg-slate-800 border border-slate-700/60 hover:bg-slate-700 text-sm flex items-center gap-1.5">
          <window.Icon name="search" className="w-3.5 h-3.5" />조회
        </button>
        <span className="ml-auto text-[11px] text-slate-500">필터는 화면 이탈 후 복귀 시 유지</span>
      </window.Card>

      {/* KPI 4종 */}
      <div className="grid grid-cols-4 gap-4">
        <window.Card className="p-5">
          <div className="text-xs text-slate-400">당월 배정 합계</div>
          <div className="text-3xl font-bold tabular-nums mt-1">{window.fmt(kpiTotal)}<span className="text-base text-slate-500 ml-1">건</span></div>
          <div className="mt-3"><window.Sparkline data={window.TREND_7D.map((d) => d.assign)} color="#a855f7" height={30} /></div>
          <div className="mt-1.5 text-[10px] text-slate-500">최근 7일 일별 배정 · BS0084</div>
        </window.Card>
        <window.Card className="p-5">
          <div className="text-xs text-slate-400">평균 배정 거리</div>
          <div className="text-3xl font-bold tabular-nums mt-1">{kpiAvg}<span className="text-base text-slate-500 ml-1">km</span></div>
          <div className="mt-3 h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-500 to-pink-400" style={{ width: `${Math.min(100, kpiAvg * 10)}%` }}></div>
          </div>
          <div className="mt-1.5 text-[10px] text-slate-500">ENG_ASSIGN_LOG 당월 확정 건 거리 평균</div>
        </window.Card>
        <window.Card className="p-5 cursor-pointer hover:border-amber-500/40 transition" onClick={() => navigate("console", { tab: "wait" })}>
          <div className="text-xs text-slate-400 flex items-center justify-between">대기 건수 <window.Icon name="arrowRight" className="w-3 h-3 text-slate-500" /></div>
          <div className="text-3xl font-bold tabular-nums mt-1 text-amber-300">{kpiWait}<span className="text-base text-slate-500 ml-1">건</span></div>
          <div className="mt-3 flex gap-1.5 text-[10px]">
            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300">좌표 실패 {geoFail}</span>
            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300">후보 없음 {noExpert}</span>
          </div>
          <div className="mt-1.5 text-[10px] text-slate-500">클릭 시 처리 콘솔 대기 큐로</div>
        </window.Card>
        {/* 강조 KPI — rose 솔리드 톤 */}
        <window.Card className="p-5 !bg-rose-950 !border-rose-700">
          <div className="text-xs text-rose-200 font-medium">균등 위반 도 수</div>
          <div className="text-3xl font-bold tabular-nums mt-1 text-rose-50">{kpiViolated}<span className="text-base text-rose-200/70 ml-1">개</span></div>
          <div className="mt-3 flex gap-1.5">
            {window.PROVINCES.filter((p) => stats[p].color === "RED").map((p) => (
              <span key={p} className="px-1.5 py-0.5 rounded bg-rose-900 border border-rose-700 text-[10px] text-rose-100">{p}</span>
            ))}
          </div>
          <div className="mt-1.5 text-[11px] text-rose-200/80">편차 빨강 = 신규 배정 차단 상태 · BS0085</div>
        </window.Card>
      </div>

      {/* 오늘 처리할 것 (원칙 2 인박스 제로 · BS0086) */}
      <window.Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <window.Icon name="bell" className="w-4 h-4 text-purple-400" />
          <h3 className="font-semibold">오늘 처리할 것</h3>
          <span className="text-xs text-slate-500">담당자 개입이 필요한 건만 · BS0086</span>
          <span className="ml-auto text-2xl font-bold tabular-nums text-purple-300">{todayTotal}<span className="text-sm text-slate-500 ml-1">건</span></span>
        </div>
        {todayTotal === 0 ? (
          <div className="py-6 text-center text-sm text-slate-500">처리할 것 0건 — 모두 처리되었습니다</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between p-3.5 rounded-lg bg-slate-950 border border-slate-800">
              <div>
                <div className="text-sm font-medium flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  대기 {waitItems.length}건
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 ml-4">좌표 변환 실패 {geoFail} · 배정 가능 전문가 없음 {noExpert}</div>
              </div>
              <button onClick={() => navigate("console", { tab: "wait" })}
                className="text-xs px-3 py-1.5 rounded-md bg-slate-800 border border-slate-700/60 hover:border-purple-500/50 hover:text-purple-300 transition flex items-center gap-1">
                대기 큐로 <window.Icon name="arrowRight" className="w-3 h-3" />
              </button>
            </div>
            <div className="flex items-center justify-between p-3.5 rounded-lg bg-slate-950 border border-slate-800">
              <div>
                <div className="text-sm font-medium flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                  재배정 대상 {reassignCount}건
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 ml-4">회수 후 미배정 — 다음 배치에서 자동 재배정</div>
              </div>
              <button onClick={() => navigate("console", { tab: "reassign" })}
                className="text-xs px-3 py-1.5 rounded-md bg-slate-800 border border-slate-700/60 hover:border-purple-500/50 hover:text-purple-300 transition flex items-center gap-1">
                재배정 대상 탭으로 <window.Icon name="arrowRight" className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </window.Card>

      {/* 도별 편차 게이지 (T6 저울 색 규약 · BS0084/BS0085) */}
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <h3 className="font-semibold text-sm">도별 편차 게이지</h3>
          <span className="text-[11px] text-slate-500">편차 = 도내 배정 가능 전문가 최대 − 최소 건수 · 허용 {window.PARAMS.devLimit}건 (ENG_PARAM) · 노랑·빨강 카드 클릭 시 처리 콘솔로</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {provinces.map((prov) => {
            const st = stats[prov];
            const g = GAUGE_COLOR[st.color];
            const clickable = st.color !== "GREEN";
            return (
              <window.Card key={prov}
                onClick={clickable ? () => navigate("console", { tab: "wait", province: prov }) : undefined}
                className={`p-5 ${clickable ? "cursor-pointer hover:border-purple-500/40 transition" : ""}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold">{prov}</div>
                  <LoadBadge level={st.color} label={st.color === "RED" ? "빨강 · 배정 차단" : st.color === "YELLOW" ? "노랑 · 상한 근접" : "초록 · 여유"} />
                </div>
                <div className="text-2xl font-bold tabular-nums">
                  {st.deviation}<span className="text-sm text-slate-500 font-normal"> / 허용 {window.PARAMS.devLimit}건</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className={`h-full ${g.bar}`} style={{ width: `${Math.min(100, (st.deviation / (window.PARAMS.devLimit + 2)) * 100)}%` }}></div>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="tabular-nums">최대 {st.max} · 최소 {st.min}</span>
                  {clickable && <span className="text-purple-400 flex items-center gap-0.5">처리 콘솔로 <window.Icon name="arrowRight" className="w-3 h-3" /></span>}
                </div>
              </window.Card>
            );
          })}
        </div>
      </div>

      {/* 전문가 부하 히트맵 (T6 · BS0085 — 도별 행 + 성명:건수 셀) */}
      <window.Card className="p-5">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-sm">전문가 부하 히트맵</h3>
          <span className="text-[11px] text-slate-500">셀 상한 = 도내 최소 건수 + 허용 편차 · 셀 클릭 시 이력·통계로 (전문가 필터)</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-slate-500 mb-4">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400"></span>여유</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"></span>상한 근접 (1건 이내)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400"></span>상한 도달·초과 — 배정 차단</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-500"></span>부재 중·배정 불가 (BS0081·BS0082)</span>
        </div>
        <div className="space-y-3">
          {provinces.map((prov) => (
            <div key={prov} className="flex items-start gap-3">
              <div className="w-12 shrink-0 pt-1.5 text-sm font-semibold text-slate-300">{prov}</div>
              <div className="flex-1 flex flex-wrap gap-2">
                {stats[prov].cells.map(({ expert, count, color }) => {
                  const c = LOAD_STYLE[color];
                  return (
                    <button key={expert.id}
                      onClick={() => navigate("history", { expert: expert.name })}
                      title={expert.grayReason || `당월 ${count}건 · 진행중 ${expert.ongoing}건 — 클릭 시 배정 이력`}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700/60 bg-slate-950 hover:border-purple-500/50 transition text-xs ${color === "GRAY" ? "opacity-60" : ""}`}>
                      <span className={`w-2 h-2 rounded-full ${c.dot}`}></span>
                      <span className={color === "GRAY" ? "text-slate-500" : "text-slate-200"}>{expert.name}</span>
                      <span className={`font-mono tabular-nums ${c.text}`}>{count}</span>
                      {expert.grayReason && <span className="text-[9px] text-slate-600">{expert.grayReason}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </window.Card>

      {/* 배정 실행 확인 다이얼로그 (원칙 4 — 영향 요약) */}
      {runDialog && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-950/70" onClick={() => setRunDialog(false)}></div>
          <window.Card className="relative w-full max-w-md p-6">
            <h3 className="font-bold text-lg mb-2">지금 배정 배치를 실행할까요?</h3>
            <p className="text-sm text-slate-300">배정대상 24건 · 재배정 대상 {reassignCount}건 포함</p>
            <p className="text-[11px] text-slate-500 mt-2">실행 중 배치가 있으면 신규 기동이 차단됩니다 (ENG_JOB_RUN 단일 실행 잠금 <window.RuleChip code="BS0021" />)</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setRunDialog(false)}
                className="px-4 py-2 rounded-md bg-slate-800 border border-slate-700/60 text-sm hover:bg-slate-700">취소</button>
              <button onClick={() => { setRunDialog(false); fireToast("assign1001 호출 — 배정 배치 실행 요청 (데모, 실행 권한 확인 후)"); }}
                className="px-4 py-2 rounded-md bg-gradient-to-r from-purple-500 to-pink-500 text-sm font-semibold">확인</button>
            </div>
          </window.Card>
        </div>
      )}

      {/* 토스트 */}
      {toast && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg bg-slate-900 border border-purple-500/40 text-sm text-slate-100 shadow-xl flex items-center gap-2">
          <window.Icon name="check" className="w-4 h-4 text-emerald-400" />{toast}
        </div>
      )}
    </div>
  );
}

window.Dashboard = Dashboard;

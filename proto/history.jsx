// history.jsx — 03 배정 이력·통계 (모델 84)
// 이력 테이블 + 행 클릭 "왜 이 전문가?" XAI 설명 카드 (3줄 내러티브 + 후보 비교표 펼침)
// 통계 탭 — 기간별 추이 · 도별 분포 · 평균 배정 거리 (조회 전용 BS0092)
const { useState: useStateH, useEffect: useEffectH, useMemo: useMemoH } = React;

const TYPE_OPTIONS_H = [
  ["ALL", "전체"],
  ["ASSIGN", "배정"],
  ["REVOKE", "회수"],
  ["WAIT", "대기 전환"],
  ["WAIT_RELEASE", "대기 해제"],
];

function HistoryScreen({ route, navigate, tweaks }) {
  // 필터는 화면 이탈 후 복귀 시 유지 (원칙 6) — window.__histFilter에 보존
  const saved = window.__histFilter || {
    from: "2026-08-01", to: "2026-08-16", expert: "전체", province: "전체", type: "ALL",
  };
  const fromPayload = route.payload && route.payload.expert ? { expert: route.payload.expert } : {};
  const [f, setF] = useStateH({ ...saved, ...fromPayload });
  const [applied, setApplied] = useStateH({ ...saved, ...fromPayload });
  const [periodErr, setPeriodErr] = useStateH(null);
  const [tab, setTab] = useStateH("history");
  const [detail, setDetail] = useStateH(null);
  const [expand, setExpand] = useStateH(false);
  const [unit, setUnit] = useStateH("일");
  const [toast, setToast] = useStateH(null);

  useEffectH(() => { window.__histFilter = f; }, [f]);

  // Esc — 사이드패널 닫기
  useEffectH(() => {
    const onKey = (e) => { if (e.key === "Escape") setDetail(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const fireToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  const doSearch = () => {
    if (!f.from || !f.to) {
      setPeriodErr("조회 기간은 필수 조건입니다 (BS0055)");
      return;
    }
    setPeriodErr(null);
    setApplied({ ...f });
    fireToast("assign1004 조회 — 처리 일시 내림차순 (데모)");
  };

  const rows = useMemoH(() => {
    return window.ASSIGN_HISTORY.filter((r) => {
      const d = r.at.slice(0, 10);
      if (applied.from && d < applied.from) return false;
      if (applied.to && d > applied.to) return false;
      if (applied.expert !== "전체" && r.expert !== applied.expert) return false;
      if (applied.province !== "전체" && r.province !== applied.province) return false;
      if (applied.type !== "ALL" && r.type !== applied.type) return false;
      return true;
    });
  }, [applied]);

  const expertNames = ["전체"].concat(
    window.EXPERTS.map((e) => e.name)
  );

  // ── 통계 집계 (BS0091 — 처리 일시 기준, 단위 일/주/월) ─────────────
  const trendBuckets = useMemoH(() => {
    const t = window.TREND_7D;
    if (unit === "일") return t;
    if (unit === "주") {
      const half = Math.ceil(t.length / 2);
      const mk = (arr, label) => ({
        date: label,
        assign: arr.reduce((s, d) => s + d.assign, 0),
        wait: arr.reduce((s, d) => s + d.wait, 0),
      });
      return [
        mk(t.slice(0, half), `${t[0].date} ~ ${t[half - 1].date}`),
        mk(t.slice(half), `${t[half].date} ~ ${t[t.length - 1].date}`),
      ];
    }
    return [{
      date: "2026-08",
      assign: t.reduce((s, d) => s + d.assign, 0),
      wait: t.reduce((s, d) => s + d.wait, 0),
    }];
  }, [unit]);
  const trendMaxH = Math.max(...trendBuckets.map((d) => d.assign));
  const statTotal = window.STATS.provinces.reduce(
    (a, p) => ({ assign: a.assign + p.assign, wait: a.wait + p.wait }),
    { assign: 0, wait: 0 }
  );

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-end justify-between">
        <div>
          <window.SectionLabel color="emerald">HISTORY · 조회 전용 — 수정·삭제 없음 (BS0092)</window.SectionLabel>
          <h1 className="text-3xl font-bold mt-1.5 tracking-tight text-slate-50">배정 이력 · 통계</h1>
          <p className="text-sm text-slate-300 mt-1">assign1004 근거 이력 + stat1001 집계 — 자동 결정이 보이는 모든 행에 1클릭 근거 (T1·T2)</p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <div className="font-mono">최근 배치 {window.LAST_JOB_RUN.executedAt}</div>
          <div className="mt-0.5">확정 {window.LAST_JOB_RUN.confirmedCount}건 · 대기 {window.LAST_JOB_RUN.waitCount}건</div>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex items-center gap-1.5">
        {[["history", "이력"], ["stats", "통계"]].map(([key, label]) => (
          <button key={key} onClick={() => { setTab(key); setDetail(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
              tab === key ? "bg-slate-800 border-emerald-500/50 text-white" : "bg-slate-900 border-slate-700/60 text-slate-400 hover:text-slate-200"
            }`}>
            {label}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-slate-500">필터는 화면 이탈 후 복귀 시 유지 (원칙 6)</span>
      </div>

      {/* ── 이력 탭 ── */}
      {tab === "history" && (
        <div className="space-y-4">
          <window.Card className="px-5 py-3 flex items-center gap-3 flex-wrap">
            <label className="text-xs text-slate-400">조회 기간 <span className="text-rose-400">*</span></label>
            <input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })}
              className="px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-700/60 text-sm outline-none focus:border-emerald-500" />
            <span className="text-slate-600">~</span>
            <input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })}
              className="px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-700/60 text-sm outline-none focus:border-emerald-500" />
            <label className="text-xs text-slate-400 ml-2">전문가</label>
            <select value={f.expert} onChange={(e) => setF({ ...f, expert: e.target.value })}
              className="px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-700/60 text-sm outline-none focus:border-emerald-500">
              {expertNames.map((n) => <option key={n}>{n}</option>)}
            </select>
            <label className="text-xs text-slate-400 ml-2">도</label>
            <select value={f.province} onChange={(e) => setF({ ...f, province: e.target.value })}
              className="px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-700/60 text-sm outline-none focus:border-emerald-500">
              {["전체"].concat(window.PROVINCES).map((p) => <option key={p}>{p}</option>)}
            </select>
            <label className="text-xs text-slate-400 ml-2">유형</label>
            <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}
              className="px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-700/60 text-sm outline-none focus:border-emerald-500">
              {TYPE_OPTIONS_H.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button onClick={doSearch}
              className="px-3.5 py-1.5 rounded-md bg-slate-800 border border-slate-700/60 hover:bg-slate-700 text-sm flex items-center gap-1.5">
              <window.Icon name="search" className="w-3.5 h-3.5" />조회
            </button>
            {periodErr && <span className="text-xs text-rose-400">{periodErr}</span>}
          </window.Card>

          <window.Card className="overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
              <div className="text-sm">
                <span className="font-semibold">이력 목록</span>
                <span className="text-slate-500 ml-2 text-xs">처리 일시 내림차순 · {rows.length}건 · 행 클릭 → "왜 이 전문가?" 설명 카드</span>
              </div>
              <button onClick={() => fireToast("CSV 다운로드 — 모델 23 CSV 응답 옵션 (데모)")}
                className="text-xs px-3 py-1.5 rounded-md bg-slate-800 border border-slate-700/60 hover:bg-slate-700 flex items-center gap-1.5">
                <window.Icon name="download" className="w-3 h-3" />CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                    <th className="px-5 py-2.5 font-medium">처리 일시</th>
                    <th className="px-3 py-2.5 font-medium">유형</th>
                    <th className="px-3 py-2.5 font-medium">신청 번호</th>
                    <th className="px-3 py-2.5 font-medium">기업명</th>
                    <th className="px-3 py-2.5 font-medium">도</th>
                    <th className="px-3 py-2.5 font-medium">전문가</th>
                    <th className="px-3 py-2.5 font-medium text-right">거리</th>
                    <th className="px-3 py-2.5 font-medium">적용 규칙</th>
                    <th className="px-5 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} onClick={() => { setDetail(r); setExpand(false); }}
                      className={`border-b border-slate-800/60 hover:bg-slate-800/30 cursor-pointer transition group ${
                        detail && detail.id === r.id ? "bg-slate-800/40" : ""
                      }`}>
                      <td className="px-5 py-3 font-mono text-xs text-slate-400 tabular-nums whitespace-nowrap">{r.at}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <window.EventBadge type={r.type} />
                          {r.reassign && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300">재배정</span>}
                        </div>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-300">{r.applyNo}</td>
                      <td className="px-3 py-3 font-medium">{r.company}</td>
                      <td className="px-3 py-3 text-slate-300">{r.province}</td>
                      <td className="px-3 py-3">{r.expert || <span className="text-slate-600">—</span>}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-300">{r.distanceKm != null ? `${r.distanceKm}km` : <span className="text-slate-600">—</span>}</td>
                      <td className="px-3 py-3">
                        {tweaks.showRuleBadges && r.rules.length > 0 ? (
                          <span className="flex items-center gap-1 flex-wrap">
                            {r.rules.map((c, i) => (
                              <React.Fragment key={c}>
                                {i > 0 && <span className="text-slate-600 text-[10px]">→</span>}
                                <window.RuleChip code={c} />
                              </React.Fragment>
                            ))}
                          </span>
                        ) : <span className="text-slate-600 text-xs">—</span>}
                      </td>
                      <td className="px-5 py-3 text-right text-xs text-slate-500 group-hover:text-emerald-300 transition whitespace-nowrap">왜? →</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr><td colSpan="9" className="px-5 py-10 text-center text-sm text-slate-500">조회 결과 0건 — 조건을 변경해 보세요</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </window.Card>
        </div>
      )}

      {/* ── 통계 탭 ── */}
      {tab === "stats" && (
        <div className="space-y-4">
          <window.Card className="px-5 py-3 flex items-center gap-3">
            <label className="text-xs text-slate-400">조회 기간 <span className="text-rose-400">*</span></label>
            <input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })}
              className="px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-700/60 text-sm" />
            <span className="text-slate-600">~</span>
            <input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })}
              className="px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-700/60 text-sm" />
            <label className="text-xs text-slate-400 ml-2">집계 단위</label>
            <select value={unit} onChange={(e) => setUnit(e.target.value)}
              className="px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-700/60 text-sm outline-none focus:border-emerald-500">
              {["일", "주", "월"].map((u) => <option key={u}>{u}</option>)}
            </select>
            <button onClick={() => fireToast("stat1001 집계 조회 (데모 — SELECT만, BS0091)")}
              className="px-3.5 py-1.5 rounded-md bg-slate-800 border border-slate-700/60 hover:bg-slate-700 text-sm flex items-center gap-1.5">
              <window.Icon name="search" className="w-3.5 h-3.5" />조회
            </button>
            <span className="ml-auto text-[11px] text-slate-500">처리 일시 기준 집계 · 회수 건 소급 차감 없음 (BS0091)</span>
          </window.Card>

          <div className="grid grid-cols-12 gap-4">
            {/* ① 기간별 배정/대기 추이 */}
            <window.Card className="col-span-12 lg:col-span-7 p-5">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="font-semibold text-sm">기간별 배정 / 대기 추이</h3>
                <span className="text-[11px] text-slate-500">최근 7일 표본 · 단위 {unit}</span>
              </div>
              <div className="space-y-2.5">
                {trendBuckets.map((d) => (
                  <div key={d.date} className="flex items-center gap-3 text-xs">
                    <span className="w-24 shrink-0 font-mono text-slate-400 tabular-nums">{d.date}</span>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-3.5 rounded bg-slate-800 overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-purple-500/70 to-purple-400/50"
                            style={{ width: `${(d.assign / trendMaxH) * 100}%` }}></div>
                        </div>
                        <span className="w-16 text-right tabular-nums text-slate-300">배정 {d.assign}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded bg-slate-800 overflow-hidden">
                          <div className="h-full bg-amber-400/70"
                            style={{ width: `${Math.min(100, (d.wait / trendMaxH) * 100 * 6)}%` }}></div>
                        </div>
                        <span className="w-16 text-right tabular-nums text-amber-300/80">대기 {d.wait}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </window.Card>

            {/* ③ 평균 배정 거리 */}
            <window.Card className="col-span-12 lg:col-span-5 p-5 flex flex-col">
              <h3 className="font-semibold text-sm mb-1">평균 배정 거리</h3>
              <div className="text-[11px] text-slate-500 mb-3">기간 내 ASSIGN 이력의 거리 평균 (BS0091)</div>
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-5xl font-bold tabular-nums">{window.STATS.avgDistanceKm}<span className="text-xl text-slate-500 ml-1">km</span></div>
                  <div className="mt-3 flex items-center gap-2 justify-center text-[11px] text-slate-500">
                    {window.STATS.provinces.map((p) => (
                      <span key={p.province} className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 tabular-nums">{p.province} {p.avgKm}km</span>
                    ))}
                  </div>
                </div>
              </div>
            </window.Card>
          </div>

          {/* ② 도별 분포 — 도 단위 그리드 (지도·좌표 시각화 없음) */}
          <window.Card className="overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-2">
              <h3 className="font-semibold text-sm">도별 분포</h3>
              <span className="text-[11px] text-slate-500">도 단위 그리드 — 지도·좌표 시각화 없음 (공고 스코프 밖)</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                  <th className="px-5 py-2.5 font-medium">도</th>
                  <th className="px-3 py-2.5 font-medium text-right">배정</th>
                  <th className="px-3 py-2.5 font-medium text-right">대기</th>
                  <th className="px-3 py-2.5 font-medium text-right">평균 거리</th>
                  <th className="px-5 py-2.5 font-medium">배정 비중</th>
                </tr>
              </thead>
              <tbody>
                {window.STATS.provinces.map((p) => (
                  <tr key={p.province} className="border-b border-slate-800/60">
                    <td className="px-5 py-3 font-medium">{p.province}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{window.fmt(p.assign)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-amber-300/90">{p.wait}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-300">{p.avgKm}km</td>
                    <td className="px-5 py-3 w-1/3">
                      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-500/70 to-emerald-400/50"
                          style={{ width: `${(p.assign / statTotal.assign) * 100}%` }}></div>
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="text-slate-300">
                  <td className="px-5 py-3 font-semibold">합계</td>
                  <td className="px-3 py-3 text-right tabular-nums font-semibold">{window.fmt(statTotal.assign)}</td>
                  <td className="px-3 py-3 text-right tabular-nums font-semibold">{statTotal.wait}</td>
                  <td className="px-3 py-3 text-right text-slate-500">—</td>
                  <td className="px-5 py-3 text-[11px] text-slate-500">{window.STATS.period} 집계</td>
                </tr>
              </tbody>
            </table>
          </window.Card>
        </div>
      )}

      {/* ── 사이드패널 — "왜 이 전문가?" XAI 설명 카드 ── */}
      {detail && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-slate-950/60" onClick={() => setDetail(null)}></div>
          <div className="w-full max-w-md bg-slate-950 border-l border-slate-700/60 overflow-y-auto">
            <div className="sticky top-0 bg-slate-950 border-b border-slate-800 px-5 py-4 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400">
                  {detail.type === "ASSIGN" ? "왜 이 전문가?" : detail.type === "REVOKE" ? "회수 근거" : "대기 근거"}
                </div>
                <div className="font-mono text-sm mt-0.5">{detail.applyNo}</div>
              </div>
              <button onClick={() => setDetail(null)} className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400">
                <window.Icon name="x" className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <window.EventBadge type={detail.type} />
                <span className="font-medium">{detail.company}</span>
                <span className="text-slate-500 text-xs">{detail.province}</span>
                <span className="ml-auto font-mono text-[11px] text-slate-500">{detail.at}</span>
              </div>

              {/* ASSIGN + 스냅샷 — 3줄 내러티브 (BS0090) */}
              {detail.type === "ASSIGN" && detail.xai && (
                <>
                  <p className="text-[11px] text-slate-500">이력 데이터만으로 구성 — 현재 데이터로 재계산하지 않음 {tweaks.showRuleBadges && <window.RuleChip code="BS0090" />}</p>
                  <div className="space-y-2.5">
                    <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-700/60">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">① 선정 결과</div>
                      <div className="text-sm text-slate-100 leading-relaxed">{detail.xai.narrative}</div>
                    </div>
                    <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-700/60">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">② 적용 규칙 체인 (배지 hover 시 설명)</div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {detail.rules.map((c, i) => (
                          <React.Fragment key={c}>
                            {i > 0 && <span className="text-slate-600 text-xs">→</span>}
                            <window.RuleChip code={c} />
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-700/60">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">③ 당시 파라미터 {tweaks.showRuleBadges && <window.RuleChip code="BS0046" />}</div>
                      <div className="text-xs text-slate-200 font-mono">{detail.xai.params}</div>
                    </div>
                  </div>

                  <button onClick={() => setExpand(!expand)}
                    className="w-full py-2 rounded-lg bg-slate-900 border border-slate-700/60 hover:border-emerald-500/40 text-xs text-slate-300 flex items-center justify-center gap-1.5 transition">
                    <window.Icon name={expand ? "x" : "eye"} className="w-3.5 h-3.5" />
                    {expand ? "상세 접기" : "자세히 — 후보 비교표·파라미터 스냅샷"}
                  </button>

                  {expand && (
                    <div className="space-y-3">
                      <div className="rounded-lg border border-slate-700/60 overflow-hidden">
                        <div className="px-3.5 py-2 bg-slate-900 border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                          후보 비교표 — 당시 후보 스냅샷 (재계산 없음)
                        </div>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-[10px] uppercase text-slate-500 border-b border-slate-800">
                              <th className="px-3.5 py-2 font-medium">후보</th>
                              <th className="px-2 py-2 font-medium text-right">당월</th>
                              <th className="px-2 py-2 font-medium text-right">진행중</th>
                              <th className="px-2 py-2 font-medium text-right">거리</th>
                              <th className="px-3.5 py-2 font-medium">탈락 사유</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.xai.candidates.map((c) => (
                              <tr key={c.name} className={`border-b border-slate-800/60 ${c.note === "선정" ? "bg-emerald-500/10" : ""}`}>
                                <td className="px-3.5 py-2 font-medium">
                                  {c.name}{c.note === "선정" && <span className="ml-1.5 text-[9px] px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-300">선정</span>}
                                </td>
                                <td className="px-2 py-2 text-right tabular-nums">{c.month}</td>
                                <td className="px-2 py-2 text-right tabular-nums">{c.ongoing}</td>
                                <td className="px-2 py-2 text-right tabular-nums">{c.km}km</td>
                                <td className="px-3.5 py-2 text-slate-400">{c.note === "선정" ? "—" : c.note}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-900 border border-slate-700/60 text-[11px] font-mono text-slate-400">
                        파라미터 스냅샷 · {detail.xai.params}
                      </div>
                    </div>
                  )}

                  <button onClick={() => navigate("settings", { focus: "devLimit" })}
                    className="w-full py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-sm font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-purple-500/20">
                    이 규칙 조정 <window.Icon name="arrowRight" className="w-3.5 h-3.5" />
                  </button>
                  <p className="text-[10px] text-slate-500 text-center -mt-2">모델 85 파라미터 조정 화면 — 해당 파라미터 포커스</p>
                </>
              )}

              {/* ASSIGN + 스냅샷 없음 (엔진 도입 전 이력) */}
              {detail.type === "ASSIGN" && !detail.xai && (
                <div className="p-4 rounded-lg bg-slate-900 border border-slate-700/60 text-sm text-slate-400 flex items-start gap-2.5">
                  <window.Icon name="alert" className="w-4 h-4 shrink-0 text-slate-500 mt-0.5" />
                  <span>근거 데이터 없음 — 후보 스냅샷이 기록되지 않은 이력입니다 (엔진 도입 전 이력 등, BS0090 기본안)</span>
                </div>
              )}

              {/* REVOKE — 회수 사유 + 원배정 근거 */}
              {detail.type === "REVOKE" && detail.revoke && (
                <div className="space-y-2.5">
                  <div className="p-3.5 rounded-lg bg-slate-900 border border-orange-500/30">
                    <div className="text-[10px] uppercase tracking-wider text-orange-400 mb-1">회수 사유 {tweaks.showRuleBadges && <window.RuleChip code="BS0052" />}</div>
                    <div className="text-sm text-slate-100">{detail.revoke.reason}</div>
                  </div>
                  <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-700/60 text-xs space-y-1.5">
                    <div className="flex justify-between"><span className="text-slate-500">원배정</span><span>{detail.revoke.prevExpert} · {detail.revoke.prevKm}km</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">원배정 일시</span><span className="font-mono">{detail.revoke.assignedAt}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">영향</span><span className="text-orange-300">{detail.revoke.impact}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">복귀 상태</span><span>배정대상 (재배정 대상) {tweaks.showRuleBadges && <window.RuleChip code="BS0010" />}</span></div>
                  </div>
                </div>
              )}

              {/* WAIT / WAIT_RELEASE — 대기 사유 */}
              {(detail.type === "WAIT" || detail.type === "WAIT_RELEASE") && (
                <div className="p-3.5 rounded-lg bg-slate-900 border border-amber-500/30">
                  <div className="text-[10px] uppercase tracking-wider text-amber-400 mb-1">
                    {detail.type === "WAIT" ? "대기 전환 사유" : "대기 해제 사유"}
                  </div>
                  <div className="text-sm text-slate-100">{detail.waitReason}</div>
                  {detail.type === "WAIT" && (
                    <button onClick={() => navigate("console", { tab: "wait" })}
                      className="mt-3 text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                      처리 콘솔에서 처리 <window.Icon name="arrowRight" className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              {/* 감사 로그 (T2 decision trail) */}
              <div className="pt-2 border-t border-slate-800">
                <h4 className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">감사 로그 (ENG_ASSIGN_LOG · BS0008)</h4>
                <div className="space-y-1.5 text-[11px] font-mono text-slate-500">
                  {window.MOCK_AUDIT.map((a, i) => (
                    <div key={i}>{a.time} · {a.action} · {a.actor}</div>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-slate-600">Esc 또는 바깥 클릭으로 닫기</p>
            </div>
          </div>
        </div>
      )}

      {/* 토스트 */}
      {toast && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg bg-slate-900 border border-emerald-500/40 text-sm text-slate-100 shadow-xl flex items-center gap-2">
          <window.Icon name="check" className="w-4 h-4 text-emerald-400" />{toast}
        </div>
      )}
    </div>
  );
}

window.History = HistoryScreen;

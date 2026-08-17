// console.jsx — 02 실패 건 처리·수동 재배정 (모델 83)
// 대기 인박스(사유 탭) + 4스텝 수동 재배정 위저드
//   ① 대기 건 선택 → ② 후보·조치 확인 (Tweaks policyMode에 따라 정렬·추천 실변경)
//   → ③ 사유 입력 (편차 초과 시 경고 BS0089) → ④ 확정 + 이력 기록 토스트 (BS0087)
const { useState: useStateC, useEffect: useEffectC, useMemo: useMemoC } = React;

const WIZ_STEPS = [
  { n: 1, label: "대기 건 선택", icon: "db" },
  { n: 2, label: "후보·조치 확인", icon: "user" },
  { n: 3, label: "사유 입력", icon: "file" },
  { n: 4, label: "확정·이력 기록", icon: "shieldCheck" },
];

function ConsoleScreen({ route, navigate, tweaks, setTweak }) {
  const payload = route.payload || {};
  const [topTab, setTopTab] = useStateC(
    payload.tab === "reassign" ? "reassign" : payload.tab === "revoke" ? "revoke" : "wait"
  );
  const [reasonTab, setReasonTab] = useStateC("ALL");
  const [provinceF, setProvinceF] = useStateC(payload.province || "전체");
  const [dateFrom, setDateFrom] = useStateC("2026-08-01");
  const [dateTo, setDateTo] = useStateC("2026-08-16");

  const [step, setStep] = useStateC(1);
  const [sel, setSel] = useStateC(null);          // 선택 건 { ..., kind: 'WAIT' | 'REASSIGN' }
  const [cand, setCand] = useStateC(null);        // 선택 후보 name
  const [fixAddr, setFixAddr] = useStateC("");
  const [fixNote, setFixNote] = useStateC("");
  const [reason, setReason] = useStateC("");
  const [warnOpen, setWarnOpen] = useStateC(false);
  const [progress, setProgress] = useStateC(0);
  const [done, setDone] = useStateC(false);

  const [processed, setProcessed] = useStateC([]);   // 처리 완료 applyNo — 큐에서 제거 (인박스 제로)
  const [addedReassign, setAddedReassign] = useStateC([]); // 회수 탭에서 회수 → 재배정 대상 추가
  const [revokedNos, setRevokedNos] = useStateC([]);
  const [revokeDlg, setRevokeDlg] = useStateC(null);
  const [revokeReason, setRevokeReason] = useStateC("");
  const [searchQ, setSearchQ] = useStateC("");
  const [toast, setToast] = useStateC(null);

  const policy = tweaks.policyMode || "DISTANCE_FIRST";

  const fireToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3400);
  };

  // ── 목록 (필터는 화면 상태로 유지 — 원칙 6) ───────────────────────
  const waitList = window.WAIT_QUEUE
    .filter((w) => !processed.includes(w.applyNo))
    .filter((w) => reasonTab === "ALL" || w.reason === reasonTab)
    .filter((w) => provinceF === "전체" || w.province === provinceF);

  const reassignList = window.REASSIGN_TARGETS.concat(addedReassign)
    .filter((r) => !processed.includes(r.applyNo))
    .filter((r) => provinceF === "전체" || r.province === provinceF);

  const waitCount = window.WAIT_QUEUE.filter((w) => !processed.includes(w.applyNo)).length;
  const reassignCount = window.REASSIGN_TARGETS.concat(addedReassign).filter((r) => !processed.includes(r.applyNo)).length;
  const geoFailN = window.WAIT_QUEUE.filter((w) => !processed.includes(w.applyNo) && w.reason === "GEO_FAIL").length;
  const noExpertN = window.WAIT_QUEUE.filter((w) => !processed.includes(w.applyNo) && w.reason === "NO_EXPERT").length;

  const isGeoFix = sel && sel.kind === "WAIT" && sel.reason === "GEO_FAIL";

  // ── 후보 정렬·추천 — Tweaks policyMode가 실제 동작을 바꾼다 ────────
  const stats = window.calcProvinceStats();
  const enrich = (c) => {
    const e = window.EXPERTS.find((x) => x.name === c.name) || {};
    const st = stats[e.province] || { cap: 99 };
    const over = e.monthCount >= st.cap;
    const level = !e.available ? "GRAY" : over ? "RED" : e.monthCount >= st.cap - 1 ? "YELLOW" : "GREEN";
    return { ...c, monthCount: e.monthCount, ongoing: e.ongoing, province: e.province, over, level, cap: st.cap };
  };
  const sortedCands = useMemoC(() => {
    if (!sel || !sel.candidates) return [];
    const arr = sel.candidates.map(enrich);
    if (policy === "DISTANCE_FIRST") {
      arr.sort((a, b) => a.distanceKm - b.distanceKm);
    } else {
      arr.sort((a, b) => a.monthCount - b.monthCount || a.ongoing - b.ongoing || a.distanceKm - b.distanceKm);
    }
    return arr;
  }, [sel, policy]);
  const recommended = sortedCands.find((c) => !c.over);
  const selectedCand = sortedCands.find((c) => c.name === cand) || null;

  // ── Step 4 — 처리 체크리스트 애니메이션 ───────────────────────────
  const step4Lines = !sel ? [] : isGeoFix
    ? [
        "geo1004 — 보정 주소 단건 등록 (geo1003 검증 로직 재사용)",
        "재변환 성공 — 좌표 확보 · 정제 신뢰도 [정상]",
        "ENG_CASE_STATE — 대기 해제 · 배정대상 복귀 (BS0003)",
        "ENG_ASSIGN_LOG — 처리 이력 기록 · 다음 배치에서 자동 배정",
      ]
    : [
        "assign1005 — 단일 트랜잭션 시작 (잠금 순서: ENG_CASE_STATE → EXT_ASSIGN → ENG_COUNTER)",
        `ENG_CASE_STATE — ${sel.kind === "REASSIGN" ? "배정대상" : "대기"} → 배정확정 전환`,
        `ENG_COUNTER — ${cand || ""} 당월 건수 +1 (공용 702)`,
        `ENG_ASSIGN_LOG — 처리 구분: 수동 재배정 · 사유${selectedCand && selectedCand.over ? " · 편차 초과 여부" : ""} 기록 (공용 703 · BS0087${selectedCand && selectedCand.over ? "·BS0089" : ""})`,
      ];

  useEffectC(() => {
    if (step !== 4) return;
    setProgress(0);
    setDone(false);
    const t = setInterval(() => {
      setProgress((p) => {
        if (p >= step4Lines.length) {
          clearInterval(t);
          return p;
        }
        return p + 1;
      });
    }, 520);
    return () => clearInterval(t);
  }, [step]);

  useEffectC(() => {
    if (step === 4 && progress >= step4Lines.length && step4Lines.length > 0 && !done) {
      setDone(true);
      setProcessed((prev) => prev.concat(sel.applyNo));
      fireToast(isGeoFix
        ? "보정 등록 완료 — 재변환 성공 · 큐에서 제거 (geo1004)"
        : "이력 기록 완료 — 수동 재배정 · 사유 포함 (ENG_ASSIGN_LOG · BS0087)");
    }
  }, [progress, step]);

  const pickCase = (row, kind) => {
    setSel({ ...row, kind });
    setCand(null);
    setReason("");
    setFixAddr("");
    setFixNote("");
    setStep(2);
  };

  const resetWizard = () => {
    setStep(1);
    setSel(null);
    setCand(null);
    setReason("");
    setDone(false);
  };

  const confirmStep3 = () => {
    if (isGeoFix) { setStep(4); return; }
    if (!reason.trim()) return;
    if (selectedCand && selectedCand.over) setWarnOpen(true);
    else setStep(4);
  };

  // ── 회수 탭 ────────────────────────────────────────────────────────
  const revokable = window.REVOKABLE_CASES
    .filter((r) => !revokedNos.includes(r.applyNo))
    .filter((r) => !searchQ || r.company.includes(searchQ) || r.applyNo.includes(searchQ));

  const doRevoke = () => {
    if (!revokeReason.trim() || !revokeDlg) return;
    const r = revokeDlg;
    const peers = window.EXPERTS.filter((e) => e.province === r.province && e.available);
    setAddedReassign((prev) => prev.concat({
      applyNo: r.applyNo, company: r.company, province: r.province,
      revokeReason: revokeReason.trim(), prevExpert: r.expert, prevDistanceKm: r.distanceKm,
      assignedAt: r.assignedDate + " 06:02", revokedAt: window.NOW_LABEL,
      candidates: peers.map((e, i) => ({
        name: e.name,
        distanceKm: e.name === r.expert ? r.distanceKm : Math.round((r.distanceKm + 1.4 + i * 1.7) * 10) / 10,
      })),
    }));
    setRevokedNos((prev) => prev.concat(r.applyNo));
    setRevokeDlg(null);
    setRevokeReason("");
    fireToast(`회수 완료 — ${r.expert} 카운터 차감 · '배정대상' 복귀 (assign1003 · BS0010)`);
  };

  const revokeImpact = (r) => {
    const e = window.EXPERTS.find((x) => x.name === r.expert) || { monthCount: 0, ongoing: 0 };
    return `${r.expert} 8월 건수 ${e.monthCount}→${e.monthCount - 1} · 진행중 ${e.ongoing}→${Math.max(0, e.ongoing - 1)}`;
  };

  const kmBar = (km) => `${Math.min(100, Math.round((km / 10) * 100))}%`;

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-end justify-between">
        <div>
          <window.SectionLabel color="cyan">INBOX · 인박스 제로 — 처리하면 큐에서 사라집니다</window.SectionLabel>
          <h1 className="text-3xl font-bold mt-1.5 tracking-tight text-slate-50">실패 건 처리 · 수동 재배정</h1>
          <p className="text-sm text-slate-300 mt-1">assign1002 대기 큐 + ENG_ASSIGN_LOG 대기 근거 — 사유별 추천 액션 (BS0088)</p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <div className="font-mono">최근 배치 {window.LAST_JOB_RUN.executedAt}</div>
          <div className="mt-0.5">확정 {window.LAST_JOB_RUN.confirmedCount}건 · 대기 {window.LAST_JOB_RUN.waitCount}건</div>
        </div>
      </div>

      {/* 상단 탭 */}
      <div className="flex items-center gap-1.5">
        {[
          ["wait", `대기 큐 (${waitCount})`],
          ["reassign", `재배정 대상 (${reassignCount})`],
          ["revoke", "배정 회수"],
        ].map(([key, label]) => (
          <button key={key}
            onClick={() => { setTopTab(key); resetWizard(); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
              topTab === key
                ? "bg-slate-800 border-purple-500/50 text-white"
                : "bg-slate-900 border-slate-700/60 text-slate-400 hover:text-slate-200"
            }`}>
            {label}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-slate-500">필터는 화면 이탈 후 복귀 시 유지 (원칙 6)</span>
      </div>

      {/* ── 배정 회수 탭 ── */}
      {topTab === "revoke" && (
        <div className="space-y-4">
          <window.Card className="px-5 py-3 flex items-center gap-3">
            <window.Icon name="search" className="w-3.5 h-3.5 text-slate-400" />
            <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="신청 번호 또는 기업명"
              className="w-64 px-3 py-1.5 rounded-md bg-slate-950 border border-slate-700/60 text-sm focus:border-purple-500 outline-none" />
            <label className="text-xs text-slate-400 ml-2">배정 기간</label>
            <input type="date" defaultValue="2026-08-10" className="px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-700/60 text-sm" />
            <span className="text-slate-500">~</span>
            <input type="date" defaultValue="2026-08-16" className="px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-700/60 text-sm" />
            <span className="ml-auto text-[11px] text-slate-500">검색 대상: 배정확정·진행중 (완료 건 회수 불가 <window.RuleChip code="BS0053" />)</span>
          </window.Card>

          <window.Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                    <th className="px-5 py-2.5 font-medium">신청 번호</th>
                    <th className="px-3 py-2.5 font-medium">기업명</th>
                    <th className="px-3 py-2.5 font-medium">도</th>
                    <th className="px-3 py-2.5 font-medium">상태</th>
                    <th className="px-3 py-2.5 font-medium">배정 전문가</th>
                    <th className="px-3 py-2.5 font-medium text-right">거리</th>
                    <th className="px-3 py-2.5 font-medium">배정일</th>
                    <th className="px-5 py-2.5 font-medium text-right">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {revokable.map((r) => (
                    <tr key={r.applyNo} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition">
                      <td className="px-5 py-3 font-mono text-xs text-slate-300">{r.applyNo}</td>
                      <td className="px-3 py-3 font-medium">{r.company}</td>
                      <td className="px-3 py-3 text-slate-300">{r.province}</td>
                      <td className="px-3 py-3"><window.CaseBadge status={r.status} /></td>
                      <td className="px-3 py-3">{r.expert}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-300">{r.distanceKm}km</td>
                      <td className="px-3 py-3 text-slate-400 tabular-nums text-xs">{r.assignedDate}</td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => { setRevokeDlg(r); setRevokeReason(""); }}
                          className="text-xs px-3 py-1.5 rounded-md bg-orange-500/10 border border-orange-500/30 text-orange-300 hover:bg-orange-500/20 transition">
                          회수
                        </button>
                      </td>
                    </tr>
                  ))}
                  {revokable.length === 0 && (
                    <tr><td colSpan="8" className="px-5 py-8 text-center text-sm text-slate-500">검색 결과 0건 — 조건을 변경해 보세요</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </window.Card>
          <p className="text-[11px] text-slate-500">회수 확정 건은 '배정대상' 상태로 복귀하여 <b className="text-slate-400">재배정 대상 탭</b>에 표시됩니다 <window.RuleChip code="BS0010" /></p>
        </div>
      )}

      {/* ── 위저드 (대기 큐·재배정 대상) ── */}
      {topTab !== "revoke" && (
        <div className="space-y-4">
          {/* 4스텝 진행 표시 */}
          <window.Card className="p-4">
            <div className="flex items-center justify-between gap-2">
              {WIZ_STEPS.map((s, i, arr) => {
                const active = step === s.n;
                const finished = step > s.n;
                return (
                  <React.Fragment key={s.n}>
                    <button
                      disabled={s.n >= step || step === 4}
                      onClick={() => setStep(s.n)}
                      className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition ${
                        active ? "bg-purple-500/20 text-purple-100" : finished ? "text-emerald-400 hover:bg-slate-800" : "text-slate-500"
                      }`}>
                      <span className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold ${
                        active ? "bg-gradient-to-br from-purple-500 to-pink-500 text-white"
                          : finished ? "bg-emerald-500/30 text-emerald-200" : "bg-slate-800 text-slate-500"
                      }`}>
                        {finished ? <window.Icon name="check" className="w-3.5 h-3.5" /> : s.n}
                      </span>
                      <span className="text-sm font-medium">{s.label}</span>
                    </button>
                    {i < arr.length - 1 && <div className={`flex-1 h-px ${step > s.n ? "bg-emerald-500/40" : "bg-slate-700/60"}`}></div>}
                  </React.Fragment>
                );
              })}
            </div>
          </window.Card>

          {/* 선택 건 요약 바 (Step 2+) */}
          {step > 1 && sel && (
            <window.Card className="px-5 py-3 flex items-center gap-3 text-sm">
              <window.CaseBadge status={sel.kind === "REASSIGN" ? "TARGET" : "WAIT"} />
              <span className="font-mono text-xs text-slate-300">{sel.applyNo}</span>
              <span className="font-semibold">{sel.company}</span>
              <span className="text-slate-400 text-xs">{sel.province}{sel.bundleNo ? ` · 묶음 ${sel.bundleNo}` : ""}</span>
              {sel.kind === "WAIT"
                ? <span className="text-xs text-amber-300">{sel.reason === "GEO_FAIL" ? "주소 실패 (GEO_FAIL)" : "후보 없음 (NO_EXPERT)"}</span>
                : <span className="text-xs text-orange-300">회수 복귀 — {sel.revokeReason}</span>}
              {step < 4 && (
                <button onClick={resetWizard} className="ml-auto text-xs text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded border border-slate-700/60 hover:bg-slate-800">
                  선택 변경
                </button>
              )}
            </window.Card>
          )}

          {/* Step 1 — 대기 건 선택 */}
          {step === 1 && topTab === "wait" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {[
                  ["ALL", `전체 ${waitCount}`],
                  ["GEO_FAIL", `주소 실패 GEO_FAIL ${geoFailN}`],
                  ["NO_EXPERT", `후보 없음 NO_EXPERT ${noExpertN}`],
                ].map(([key, label]) => (
                  <button key={key} onClick={() => setReasonTab(key)}
                    className={`px-3 py-1.5 rounded-md text-xs border transition ${
                      reasonTab === key ? "bg-amber-500/15 border-amber-500/40 text-amber-200" : "bg-slate-900 border-slate-700/60 text-slate-400 hover:text-slate-200"
                    }`}>
                    {label}
                  </button>
                ))}
                <label className="text-xs text-slate-400 ml-3">도</label>
                <select value={provinceF} onChange={(e) => setProvinceF(e.target.value)}
                  className="px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-700/60 text-sm outline-none focus:border-purple-500">
                  {["전체"].concat(window.PROVINCES).map((p) => <option key={p}>{p}</option>)}
                </select>
                <label className="text-xs text-slate-400 ml-1">대기 전환 기간</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-2 py-1.5 rounded-md bg-slate-950 border border-slate-700/60 text-xs" />
                <span className="text-slate-600">~</span>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-2 py-1.5 rounded-md bg-slate-950 border border-slate-700/60 text-xs" />
              </div>

              <window.Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                        <th className="px-5 py-2.5 font-medium">신청 번호</th>
                        <th className="px-3 py-2.5 font-medium">기업명</th>
                        <th className="px-3 py-2.5 font-medium">도</th>
                        <th className="px-3 py-2.5 font-medium">대기 사유</th>
                        <th className="px-3 py-2.5 font-medium text-right">경과</th>
                        <th className="px-3 py-2.5 font-medium">근거</th>
                        <th className="px-5 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {waitList.map((w) => (
                        <tr key={w.applyNo} onClick={() => pickCase(w, "WAIT")}
                          className="border-b border-slate-800/60 hover:bg-slate-800/30 cursor-pointer transition group">
                          <td className="px-5 py-3 font-mono text-xs text-slate-300">{w.applyNo}</td>
                          <td className="px-3 py-3 font-medium">{w.company}</td>
                          <td className="px-3 py-3 text-slate-300">{w.province}</td>
                          <td className="px-3 py-3">
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/15 text-amber-300 px-2 py-0.5 text-xs font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                              {w.reason === "GEO_FAIL" ? "주소 실패" : "후보 없음"}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-slate-400 text-xs">{w.elapsedH}h</td>
                          <td className="px-3 py-3">{tweaks.showRuleBadges && <window.RuleChip code={w.ruleCode} />}</td>
                          <td className="px-5 py-3 text-right text-xs text-slate-500 group-hover:text-purple-300 transition">처리 시작 →</td>
                        </tr>
                      ))}
                      {waitList.length === 0 && (
                        <tr><td colSpan="7" className="px-5 py-10 text-center text-sm text-slate-500">대기 건 0 — 모두 처리되었습니다</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </window.Card>
            </div>
          )}

          {step === 1 && topTab === "reassign" && (
            <div className="space-y-3">
              <div className="px-4 py-2.5 rounded-lg bg-slate-900 border border-slate-700/60 text-xs text-slate-300 flex items-center gap-2">
                <window.Icon name="alert" className="w-3.5 h-3.5 text-orange-400" />
                다음 배치에서 자동 재배정됩니다 — 즉시 배정하려면 행을 선택해 <b className="text-orange-300">이 전문가에게 배정</b>을 진행하세요 {tweaks.showRuleBadges && <window.RuleChip code="BS0010" />}
              </div>
              <window.Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                        <th className="px-5 py-2.5 font-medium">신청 번호</th>
                        <th className="px-3 py-2.5 font-medium">기업명</th>
                        <th className="px-3 py-2.5 font-medium">도</th>
                        <th className="px-3 py-2.5 font-medium">회수 사유</th>
                        <th className="px-3 py-2.5 font-medium">원배정</th>
                        <th className="px-3 py-2.5 font-medium">회수 일시</th>
                        <th className="px-5 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {reassignList.map((r) => (
                        <tr key={r.applyNo} onClick={() => pickCase(r, "REASSIGN")}
                          className="border-b border-slate-800/60 hover:bg-slate-800/30 cursor-pointer transition group">
                          <td className="px-5 py-3 font-mono text-xs text-slate-300">{r.applyNo}</td>
                          <td className="px-3 py-3 font-medium">{r.company}</td>
                          <td className="px-3 py-3 text-slate-300">{r.province}</td>
                          <td className="px-3 py-3 text-slate-300 text-xs">{r.revokeReason}</td>
                          <td className="px-3 py-3 text-xs">{r.prevExpert} · <span className="tabular-nums">{r.prevDistanceKm}km</span></td>
                          <td className="px-3 py-3 font-mono text-xs text-slate-400">{r.revokedAt}</td>
                          <td className="px-5 py-3 text-right text-xs text-slate-500 group-hover:text-purple-300 transition">재배정 →</td>
                        </tr>
                      ))}
                      {reassignList.length === 0 && (
                        <tr><td colSpan="7" className="px-5 py-10 text-center text-sm text-slate-500">재배정 대상 0건 — 모두 처리되었습니다</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </window.Card>
            </div>
          )}

          {/* Step 2 — 후보·조치 확인 */}
          {step === 2 && sel && isGeoFix && (
            <div className="grid grid-cols-12 gap-4">
              <window.Card className="col-span-12 lg:col-span-6 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">대기 근거 (ENG_ASSIGN_LOG)</h3>
                  {tweaks.showRuleBadges && <window.RuleChip code="BS0003" />}
                </div>
                <div className="space-y-2.5 text-sm">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-slate-500">원본 주소</div>
                    <div className="mt-0.5 text-slate-200">{sel.addr.raw}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-slate-500">정제 주소</div>
                    <div className="mt-0.5 text-slate-200 flex items-center gap-2">
                      {sel.addr.refined}
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${sel.addr.confidence === "실패" ? "bg-rose-500/15 text-rose-300" : "bg-amber-500/15 text-amber-300"}`}>
                        정제 신뢰도 · {sel.addr.confidence}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-[11px] uppercase tracking-wider text-slate-500">실패 코드</div>
                    <span className="font-mono text-xs text-rose-300">{sel.addr.failCode}</span>
                    <span className="text-[10px] text-slate-500">(ADDR_PARSE / GEO_NOTFOUND / GEO_AMBIG)</span>
                  </div>
                </div>
                <div className="pt-3 border-t border-slate-800 space-y-2">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500">일괄 보정 — 모델 31 CSV 인터페이스 재사용</div>
                  <div className="flex gap-2">
                    <button onClick={() => fireToast("geo1002 — 실패 주소 CSV 다운로드 (데모)")}
                      className="text-xs px-3 py-1.5 rounded-md bg-slate-800 border border-slate-700/60 hover:bg-slate-700 flex items-center gap-1.5">
                      <window.Icon name="download" className="w-3 h-3" />실패 주소 CSV 다운로드
                    </button>
                    <button onClick={() => fireToast("geo1003 — 보정 CSV 업로드 (데모)")}
                      className="text-xs px-3 py-1.5 rounded-md bg-slate-800 border border-slate-700/60 hover:bg-slate-700 flex items-center gap-1.5">
                      <window.Icon name="file" className="w-3 h-3" />보정 CSV 업로드
                    </button>
                  </div>
                </div>
              </window.Card>

              <window.Card className="col-span-12 lg:col-span-6 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">추천 액션 — 보정 주소 인라인 등록</h3>
                  {tweaks.showRuleBadges && <window.RuleChip code="BS0088" />}
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-slate-500">보정 주소 <span className="text-rose-400">*</span></label>
                  <input value={fixAddr} onChange={(e) => setFixAddr(e.target.value)} placeholder={sel.addr.refined}
                    className="mt-1 w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700/60 text-sm focus:border-purple-500 outline-none" />
                  <button onClick={() => setFixAddr(sel.addr.refined)}
                    className="mt-1.5 text-[11px] text-purple-400 hover:text-purple-300">정제 주소 후보 채우기 →</button>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  <window.Icon name="shieldCheck" className="w-3 h-3 inline mr-1 text-emerald-400" />
                  <b className="text-slate-400">geo1004</b>(신규) — 등록 즉시 재변환, 성공 시 배정대상 복귀·큐에서 제거
                </p>
                <div className="pt-3 flex items-center justify-between">
                  <button onClick={resetWizard} className="text-sm px-4 py-2 rounded-md bg-slate-800 border border-slate-700/60 hover:bg-slate-700 flex items-center gap-1.5">
                    <window.Icon name="chevronLeft" className="w-3.5 h-3.5" />이전
                  </button>
                  <button disabled={!fixAddr.trim()} onClick={() => setStep(3)}
                    className="text-sm px-4 py-2 rounded-md bg-gradient-to-r from-purple-500 to-pink-500 font-semibold disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-lg shadow-purple-500/20">
                    다음 <window.Icon name="arrowRight" className="w-3.5 h-3.5" />
                  </button>
                </div>
              </window.Card>
            </div>
          )}

          {step === 2 && sel && !isGeoFix && (
            <div className="space-y-4">
              <window.Card className="p-5">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{sel.kind === "REASSIGN" ? "회수 근거 + 후보 전문가 카드" : "후보 전문가 카드"}</h3>
                    <span className="text-[11px] text-slate-500">근접순 · 지도 없음 (공고 스코프 밖 — 거리 막대로 표현)</span>
                    {tweaks.showRuleBadges && <window.RuleChip code="BS0088" />}
                  </div>
                  {/* 정책 모드 토글 — Tweaks policyMode와 동기화, 정렬·추천이 실제로 바뀐다 */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500">정책 모드</span>
                    <div className="flex p-0.5 rounded-md bg-slate-950 border border-slate-700/60 text-xs">
                      {[["DISTANCE_FIRST", "거리 우선"], ["BALANCE_FIRST", "균등 우선"]].map(([v, l]) => (
                        <button key={v} onClick={() => setTweak && setTweak("policyMode", v)}
                          className={`px-2.5 py-1 rounded transition ${policy === v ? "bg-purple-500/30 text-purple-200" : "text-slate-400 hover:text-slate-200"}`}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mb-4">
                  {policy === "DISTANCE_FIRST"
                    ? "거리 우선 — 근접순 정렬, 편차 이내 최근접 후보를 추천합니다"
                    : "균등 우선 — 당월 배정 건수 오름차순 정렬, 최소 건수 후보를 추천합니다 (동수 시 진행중 최소)"}
                </p>

                {sel.kind === "REASSIGN" && (
                  <div className="mb-4 px-4 py-3 rounded-lg bg-slate-950 border border-orange-500/20 text-xs flex items-center gap-3">
                    <span className="text-orange-300 font-medium">회수 근거</span>
                    <span className="text-slate-300">{sel.revokeReason}</span>
                    <span className="text-slate-500">원배정 {sel.prevExpert} · {sel.prevDistanceKm}km</span>
                    <span className="text-slate-500 font-mono">{sel.revokedAt}</span>
                    {tweaks.showRuleBadges && <window.RuleChip code="BS0052" />}
                  </div>
                )}
                {sel.kind === "WAIT" && sel.reasonDetail && (
                  <div className="mb-4 px-4 py-3 rounded-lg bg-slate-950 border border-amber-500/20 text-xs flex items-center gap-3">
                    <span className="text-amber-300 font-medium">대기 사유</span>
                    <span className="text-slate-300">{sel.reasonDetail}</span>
                    {tweaks.showRuleBadges && <window.RuleChip code="BS0009" />}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  {sortedCands.map((c) => {
                    const isSel = cand === c.name;
                    const isRec = recommended && recommended.name === c.name;
                    return (
                      <button key={c.name} onClick={() => setCand(c.name)}
                        className={`text-left p-4 rounded-xl border transition relative ${
                          isSel ? "bg-purple-500/10 border-purple-500/60"
                            : isRec ? "bg-slate-950 border-purple-500/40 ring-1 ring-purple-500/30"
                            : "bg-slate-950 border-slate-700/60 hover:border-slate-500"
                        }`}>
                        {isRec && (
                          <span className="absolute -top-2.5 left-3 px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-[10px] font-bold text-white shadow">
                            추천 · {policy === "DISTANCE_FIRST" ? "최근접" : "당월 최소"}
                          </span>
                        )}
                        <div className="flex items-center justify-between mb-2.5">
                          <span className="font-semibold">{c.name} · {c.province}</span>
                          {isSel && <window.Icon name="check" className="w-4 h-4 text-purple-300" />}
                        </div>
                        <div className="space-y-2 text-xs">
                          <div>
                            <div className="flex items-center justify-between text-slate-400">
                              <span>거리</span><span className="tabular-nums text-slate-200 font-mono">{c.distanceKm.toFixed(1)} km</span>
                            </div>
                            <div className="mt-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-cyan-400 to-purple-400" style={{ width: kmBar(c.distanceKm) }}></div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">당월 배정 <b className="text-slate-200 tabular-nums">{c.monthCount}</b>건</span>
                            <window.LoadBadge level={c.level} label={c.over ? "편차 상한 초과" : undefined} />
                          </div>
                          <div className="text-slate-400">진행중 <b className="text-slate-200 tabular-nums">{c.ongoing}</b>건</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 flex items-center gap-4 text-[11px]">
                  {sel.kind === "WAIT" && (
                    <button onClick={() => navigate("settings", { focus: "devLimit" })}
                      className="text-purple-400 hover:text-purple-300 flex items-center gap-1">
                      허용 편차 완화 시뮬레이션 <window.Icon name="arrowRight" className="w-3 h-3" />
                      <span className="text-slate-500">(모델 85 · sim1001 드라이런)</span>
                    </button>
                  )}
                  <button onClick={() => fireToast("기존 수동 배정 화면 딥링크 — 기존 시스템 확인 후 확정 (데모 미연결)")}
                    className="text-slate-500 hover:text-slate-300">기존 수동 배정 화면에서 처리 →</button>
                </div>
              </window.Card>

              <div className="flex items-center justify-between">
                <button onClick={() => setStep(1)} className="text-sm px-4 py-2 rounded-md bg-slate-800 border border-slate-700/60 hover:bg-slate-700 flex items-center gap-1.5">
                  <window.Icon name="chevronLeft" className="w-3.5 h-3.5" />이전
                </button>
                <button disabled={!cand} onClick={() => setStep(3)}
                  className="text-sm px-4 py-2 rounded-md bg-gradient-to-r from-purple-500 to-pink-500 font-semibold disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-lg shadow-purple-500/20">
                  이 전문가에게 배정 <window.Icon name="arrowRight" className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — 사유 입력 */}
          {step === 3 && sel && (
            <div className="grid grid-cols-12 gap-4">
              <window.Card className="col-span-12 lg:col-span-7 p-5 space-y-4">
                <h3 className="font-semibold">{isGeoFix ? "보정 등록 확인" : "재배정 사유 입력"}</h3>
                {isGeoFix ? (
                  <>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between py-2 border-b border-slate-800">
                        <span className="text-slate-400">보정 주소</span><span className="text-slate-200">{fixAddr}</span>
                      </div>
                      <div>
                        <label className="text-[11px] uppercase tracking-wider text-slate-500">비고 (선택)</label>
                        <input value={fixNote} onChange={(e) => setFixNote(e.target.value)} placeholder="예: 기업 대표번호로 확인"
                          className="mt-1 w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700/60 text-sm focus:border-purple-500 outline-none" />
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500">등록 즉시 재변환합니다 — 성공 시 배정대상 복귀, 재실패 시 사유 표시 후 대기 유지 (BS0003)</p>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="text-[11px] uppercase tracking-wider text-slate-500">
                        재배정 사유 <span className="text-rose-400">*</span> — 오버라이드 기록 (T1) {tweaks.showRuleBadges && <window.RuleChip code="BS0087" />}
                      </label>
                      <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows="3"
                        placeholder="예: 파주권 후보 부재, 편차 근접 후보 김OO 협의 배정"
                        className="mt-1 w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700/60 text-sm focus:border-purple-500 outline-none resize-none"></textarea>
                      {!reason.trim() && <p className="mt-1 text-[11px] text-amber-400">사유는 필수입니다 — 공용 703으로 ENG_ASSIGN_LOG에 기록됩니다</p>}
                    </div>
                    {selectedCand && selectedCand.over && (
                      <div className="px-4 py-3 rounded-lg bg-amber-950 border border-amber-700 text-xs text-amber-100 flex items-start gap-2">
                        <window.Icon name="alert" className="w-4 h-4 shrink-0 text-amber-300" />
                        <span>
                          <b>{selectedCand.name}</b> 후보는 당월 {selectedCand.monthCount}건으로 허용 편차 상한({selectedCand.cap}건)을 초과합니다.
                          확정 시 경고 확인을 거치며, 편차 초과 사실이 이력에 함께 기록됩니다 (BS0089 — 차단 아님).
                        </span>
                      </div>
                    )}
                  </>
                )}
              </window.Card>

              <window.Card className="col-span-12 lg:col-span-5 p-5 space-y-3">
                <h3 className="font-semibold">처리 요약</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1.5 border-b border-slate-800">
                    <span className="text-slate-400">신청 건</span>
                    <span className="font-mono text-xs">{sel.applyNo}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800">
                    <span className="text-slate-400">기업</span><span>{sel.company}</span>
                  </div>
                  {isGeoFix ? (
                    <div className="flex justify-between py-1.5 border-b border-slate-800">
                      <span className="text-slate-400">처리</span><span className="text-xs">보정 등록 → 재변환 → 배정대상 복귀</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between py-1.5 border-b border-slate-800">
                        <span className="text-slate-400">선택 후보</span>
                        <span className="font-semibold">{cand} <span className="text-slate-500 font-normal tabular-nums">· {selectedCand ? selectedCand.distanceKm.toFixed(1) : ""}km</span></span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-slate-800">
                        <span className="text-slate-400">정책 모드</span>
                        <span className="text-xs">{policy === "DISTANCE_FIRST" ? "거리 우선" : "균등 우선"}</span>
                      </div>
                    </>
                  )}
                </div>
                <div className="pt-2 space-y-2">
                  <button
                    disabled={!isGeoFix && !reason.trim()}
                    onClick={confirmStep3}
                    className="w-full py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 font-bold text-sm disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-purple-500/30">
                    <window.Icon name="check" className="w-4 h-4" />
                    {isGeoFix ? "보정 등록 (geo1004)" : "확정 (assign1005)"}
                  </button>
                  <button onClick={() => setStep(2)} className="w-full py-2 rounded-lg bg-slate-800 border border-slate-700/60 hover:bg-slate-700 text-sm">이전 단계</button>
                </div>
              </window.Card>
            </div>
          )}

          {/* Step 4 — 확정 + 이력 기록 */}
          {step === 4 && sel && (
            <window.Card className="p-7">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                  <window.Icon name={done ? "check" : "play"} className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{done ? "처리 완료" : "처리 중"}</h3>
                  <div className="text-xs text-slate-500 font-mono">{sel.applyNo} · {sel.company}</div>
                </div>
                {!done && (
                  <div className="ml-auto text-xs text-emerald-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>단일 트랜잭션
                  </div>
                )}
              </div>

              <div className="space-y-2.5 max-w-2xl">
                {step4Lines.map((line, i) => {
                  const doneLine = progress > i;
                  const activeLine = progress === i;
                  return (
                    <div key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm transition ${
                      doneLine ? "bg-slate-950 border-emerald-500/30 text-slate-200"
                        : activeLine ? "bg-slate-950 border-purple-500/40 text-slate-300"
                        : "bg-slate-950 border-slate-800 text-slate-600"
                    }`}>
                      {doneLine
                        ? <window.Icon name="check" className="w-4 h-4 text-emerald-400 shrink-0" />
                        : <span className={`w-4 h-4 rounded-full border-2 shrink-0 ${activeLine ? "border-purple-400 animate-pulse" : "border-slate-700"}`}></span>}
                      <span className="font-mono text-xs">{line}</span>
                    </div>
                  );
                })}
              </div>

              {done && (
                <div className="mt-6 p-5 rounded-xl bg-emerald-950 border border-emerald-700 max-w-2xl">
                  <div className="text-emerald-200 font-medium text-sm flex items-center gap-2">
                    <window.Icon name="shieldCheck" className="w-4 h-4" />
                    {isGeoFix
                      ? "보정 등록 완료 — 배정대상 복귀, 다음 배치(06:00)에서 자동 배정됩니다"
                      : `${sel.company} → ${cand} 배정 확정`}
                  </div>
                  <div className="text-emerald-50 text-xs mt-1.5 leading-relaxed">
                    큐에서 제거되었습니다 (인박스 제로 — 원칙 2).
                    {!isGeoFix && ` 처리 구분 '수동 재배정'과 사유가 ENG_ASSIGN_LOG에 기록되었습니다${selectedCand && selectedCand.over ? " (편차 초과 여부 포함)" : ""}.`}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button onClick={resetWizard} className="px-4 py-2 rounded-md bg-emerald-900 border border-emerald-700 text-sm text-emerald-100 hover:bg-emerald-800">인박스로 돌아가기</button>
                    <button onClick={() => navigate("history", {})} className="px-4 py-2 rounded-md bg-gradient-to-r from-purple-500 to-pink-500 text-sm font-semibold">이력·통계 보기</button>
                  </div>
                </div>
              )}
            </window.Card>
          )}
        </div>
      )}

      {/* 편차 초과 경고 다이얼로그 (BS0089 — 차단 아님) */}
      {warnOpen && selectedCand && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-950/70" onClick={() => setWarnOpen(false)}></div>
          <window.Card className="relative w-full max-w-md p-6 !border-amber-700">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-950 border border-amber-700 flex items-center justify-center shrink-0">
                <window.Icon name="alert" className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <h3 className="font-bold">허용 편차 상한 초과</h3>
                <p className="text-sm text-slate-300 mt-1.5 leading-relaxed">
                  <b>{selectedCand.name}</b> 전문가는 당월 <b className="tabular-nums">{selectedCand.monthCount}건</b>으로
                  허용 편차 상한(<b className="tabular-nums">{selectedCand.cap}건</b>)을 초과합니다.<br />
                  계속하면 편차 초과 사실이 사유와 함께 이력에 기록됩니다. {tweaks.showRuleBadges && <window.RuleChip code="BS0089" />}
                </p>
                <div className="mt-3 px-3 py-2 rounded-md bg-slate-950 border border-slate-800 text-xs text-slate-400">
                  <span className="text-slate-500">재배정 사유 · </span>{reason}
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setWarnOpen(false)}
                className="px-4 py-2 rounded-md bg-slate-800 border border-slate-700/60 text-sm hover:bg-slate-700">취소</button>
              <button onClick={() => { setWarnOpen(false); setStep(4); }}
                className="px-4 py-2 rounded-md bg-amber-600 hover:bg-amber-500 text-sm font-semibold text-white">계속 배정</button>
            </div>
          </window.Card>
        </div>
      )}

      {/* 회수 확인 다이얼로그 (원칙 4 — 영향 요약) */}
      {revokeDlg && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-950/70" onClick={() => setRevokeDlg(null)}></div>
          <window.Card className="relative w-full max-w-md p-6">
            <h3 className="font-bold text-lg">이 배정을 회수합니다</h3>
            <div className="mt-3 px-4 py-3 rounded-lg bg-slate-950 border border-slate-800 text-sm space-y-1.5">
              <div className="flex justify-between"><span className="text-slate-400">대상</span><span className="font-mono text-xs">{revokeDlg.applyNo}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">영향 요약</span><span className="text-orange-300 text-xs">{revokeImpact(revokeDlg)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">복귀 상태</span><span className="text-xs">'배정대상' (재배정 대상 탭 표시) {tweaks.showRuleBadges && <window.RuleChip code="BS0010" />}</span></div>
            </div>
            <div className="mt-3">
              <label className="text-[11px] uppercase tracking-wider text-slate-500">회수 사유 <span className="text-rose-400">*</span> {tweaks.showRuleBadges && <window.RuleChip code="BS0052" />}</label>
              <input value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} placeholder="예: 기업 일정 변경 요청"
                className="mt-1 w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700/60 text-sm focus:border-purple-500 outline-none" />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setRevokeDlg(null)}
                className="px-4 py-2 rounded-md bg-slate-800 border border-slate-700/60 text-sm hover:bg-slate-700">취소</button>
              <button disabled={!revokeReason.trim()} onClick={doRevoke}
                className="px-4 py-2 rounded-md bg-orange-600 hover:bg-orange-500 text-sm font-semibold text-white disabled:opacity-30">회수 확정 (assign1003)</button>
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

window.Console = ConsoleScreen;

// templates.jsx — 04 규칙 파라미터·시뮬레이션 (모델 85)
// 파라미터 프리셋 목록(현행/제안) + A/B 시뮬레이션 나란히 비교 (일치율·거리·편차 델타 ▲▼)
// + 적용 확인 다이얼로그 (MG1008) — "시뮬레이션 근거 없는 파라미터 변경 불가" (BS0093)
const { useState: useStateT, useEffect: useEffectT } = React;

// BS0095 유효 범위 (기본안 — 착수 협의로 확정)
const RANGE_T = {
  bundleKm: { min: 0.5, max: 10.0, label: "묶음 반경", unit: "km" },
  devLimit: { min: 0, max: 9, label: "균등 허용 편차", unit: "건" },
  weight: { min: 0, max: 1, label: "우선순위 가중", unit: "" },
};

function TemplatesScreen({ route, navigate, tweaks }) {
  const focusParam = route.payload && route.payload.focus;

  const [params, setParams] = useStateT({ ...window.PARAMS });
  const [presetId, setPresetId] = useStateT("PRESET-PROPOSED");
  const [period, setPeriod] = useStateT({ from: "2026-08-03", to: "2026-08-09" });
  const preset = window.PARAM_PRESETS.find((p) => p.id === presetId);
  const [ov, setOv] = useStateT({ bundleKm: preset.bundleKm, devLimit: preset.devLimit, weight: preset.weight });

  const [slotA, setSlotA] = useStateT(null);
  const [slotB, setSlotB] = useStateT(null);
  const [running, setRunning] = useStateT(null);   // 'A' | 'B'
  const [applyDlg, setApplyDlg] = useStateT(false);
  const [rollbackDlg, setRollbackDlg] = useStateT(null);
  const [distPanel, setDistPanel] = useStateT(false);
  const [log, setLog] = useStateT(window.PARAM_LOG.map((r) => ({ ...r })));
  const [toast, setToast] = useStateT(null);

  const fireToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3600);
  };

  const pickPreset = (p) => {
    setPresetId(p.id);
    setOv({ bundleKm: p.bundleKm, devLimit: p.devLimit, weight: p.weight });
  };

  // BS0095 — 입력 시점 범위 검증
  const rangeErr = (key) => {
    const v = Number(ov[key]);
    const r = RANGE_T[key];
    if (ov[key] === "" || isNaN(v)) return null;
    if (v < r.min || v > r.max) return `${r.label}은 ${r.min}~${r.max}${r.unit} 범위만 허용 (BS0095)`;
    return null;
  };
  const anyRangeErr = Object.keys(RANGE_T).some((k) => rangeErr(k));

  const runSim = (slot) => {
    if (!period.from || !period.to) { fireToast("대상 기간은 필수입니다"); return; }
    if (slot === "B" && anyRangeErr) return;
    setRunning(slot);
    const src = slot === "A" ? window.PARAM_PRESETS[0] : window.PARAM_PRESETS[1];
    setTimeout(() => {
      const result = {
        ...src.sim,
        paramSummary: slot === "A"
          ? `묶음 ${params.bundleKm}km · 편차 ${params.devLimit}건 · 가중 ${params.weight}`
          : `묶음 ${ov.bundleKm}km · 편차 ${ov.devLimit}건 · 가중 ${ov.weight}`,
      };
      if (slot === "A") setSlotA(result); else setSlotB(result);
      setRunning(null);
      fireToast(`sim1001 드라이런 완료 — ${result.runId} (운영 데이터 무변경 · BS0012)`);
    }, 900);
  };

  // 델타 — 방향과 무관하게 ▲=개선(초록) · ▼=악화(빨강)
  const deltas = slotA && slotB ? [
    { label: "일치율", a: `${slotA.matchRate} %`, b: `${slotB.matchRate} %`, improved: slotB.matchRate > slotA.matchRate, mag: `${Math.abs(slotB.matchRate - slotA.matchRate).toFixed(1)}%p` },
    { label: "평균 거리", a: `${slotA.avgDistance} km`, b: `${slotB.avgDistance} km`, improved: slotB.avgDistance < slotA.avgDistance, mag: `${Math.abs(slotB.avgDistance - slotA.avgDistance).toFixed(1)}km` },
    { label: "최대 편차", a: `${slotA.maxDeviation}건`, b: `${slotB.maxDeviation}건`, improved: slotB.maxDeviation < slotA.maxDeviation, mag: `${Math.abs(slotB.maxDeviation - slotA.maxDeviation)}건` },
    { label: "대기 건수", a: `${slotA.waitCount}건`, b: `${slotB.waitCount}건`, improved: slotB.waitCount < slotA.waitCount, mag: `${Math.abs(slotB.waitCount - slotA.waitCount)}건` },
  ] : null;
  const deltaLine = deltas
    ? deltas.map((d) => `${d.label} ${d.improved ? "▲" : "▼"}${d.mag}`).join(" · ")
    : "";

  const changeSummary = [];
  if (slotB) {
    if (Number(ov.bundleKm) !== params.bundleKm) changeSummary.push(`묶음 반경 ${params.bundleKm} → ${ov.bundleKm} km`);
    if (Number(ov.devLimit) !== params.devLimit) changeSummary.push(`균등 허용 편차 ${params.devLimit} → ${ov.devLimit}건`);
    if (Number(ov.weight) !== params.weight) changeSummary.push(`우선순위 가중 ${params.weight} → ${ov.weight}`);
  }

  const nextRound = params.round + 1;

  const doApply = () => {
    const before = { bundleKm: params.bundleKm, devLimit: params.devLimit, weight: params.weight };
    const after = { bundleKm: Number(ov.bundleKm), devLimit: Number(ov.devLimit), weight: Number(ov.weight) };
    const updated = {
      ...params, ...after,
      lastModifiedBy: "담당자", lastModifiedAt: window.NOW_LABEL, round: nextRound,
    };
    setParams(updated);
    // 다른 화면(대시보드 게이지·콘솔 부하 배지)도 새 파라미터로 재계산되도록 전역 반영
    Object.assign(window.PARAMS, updated);
    setLog([{
      at: window.NOW_LABEL,
      change: changeSummary.join(" · ") || "변경 없음(재적용)",
      runId: slotB.runId, by: "담당자", round: `${nextRound}회차`,
      rollbackable: true, before,
    }].concat(log));
    setApplyDlg(false);
    setSlotA(null);
    fireToast(`파라미터 적용 완료 — 적용 전후 값·승인자·근거 실행 ID·${nextRound}회차 기록 (ENG_PARAM_LOG · BS0094 · MG1008)`);
  };

  const rollbackBefore = (entry) =>
    entry.before || (entry.runId === "2026-00042" ? { bundleKm: 2.5, devLimit: 2, weight: 0.5 } : null);

  const doRollback = () => {
    const entry = rollbackDlg;
    const before = rollbackBefore(entry);
    if (!before) { setRollbackDlg(null); return; }
    const updated = {
      ...params, ...before,
      lastModifiedBy: "담당자", lastModifiedAt: window.NOW_LABEL,
    };
    setParams(updated);
    Object.assign(window.PARAMS, updated);
    setLog([{
      at: window.NOW_LABEL,
      change: `롤백 — ${entry.change} 이전 값 복원`,
      runId: entry.runId, by: "담당자", round: "롤백",
      rollbackable: false,
    }].concat(log.map((r) => (r === entry ? { ...r, rollbackable: false } : r))));
    setRollbackDlg(null);
    setSlotA(null);
    setSlotB(null);
    fireToast("롤백 완료 — 직전 설정 복원 · 이력 기록 (BS0094 · MG1008)");
  };

  const focusCls = (key) =>
    focusParam === key ? "ring-2 ring-pink-500/60 border-pink-500/60" : "";

  const inputCls = "w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700/60 text-sm outline-none focus:border-pink-500 tabular-nums";

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-end justify-between">
        <div>
          <window.SectionLabel color="pink">PARAMETERS · SIMULATION — 근거 없는 변경 불가 (BS0093)</window.SectionLabel>
          <h1 className="text-3xl font-bold mt-1.5 tracking-tight text-slate-50">규칙 파라미터 · 시뮬레이션</h1>
          <p className="text-sm text-slate-300 mt-1">ENG_PARAM + sim1001 드라이런 (모델 33 재사용) — 운영 데이터 무변경 (BS0012)</p>
        </div>
        <div className="text-right">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700/60 text-xs text-slate-300">
            <window.Icon name="history" className="w-3.5 h-3.5 text-pink-400" />
            조정 {params.round}회차 적용 · 검증 2주 진행 중
          </span>
          {focusParam && (
            <div className="mt-1.5 text-[11px] text-pink-400">연계 진입 — 허용 편차 파라미터 포커스</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* 현재 파라미터 (ENG_PARAM) */}
        <window.Card className="col-span-12 lg:col-span-7 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">현재 파라미터 (ENG_PARAM)</h3>
            <span className="text-[11px] text-slate-500">마지막 변경 · {params.lastModifiedBy} · <span className="font-mono">{params.lastModifiedAt}</span></span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              ["묶음 반경", `${params.bundleKm} km`, focusParam === "bundleKm"],
              ["균등 허용 편차", `${params.devLimit}건`, focusParam === "devLimit"],
              ["배정 실행 주기", params.schedule, false],
              ["단독 배정 허용", params.singleAllowed, false],
              ["일일 한도 옵션", params.dailyLimitOpt, false],
              ["우선순위 가중", String(params.weight), false],
            ].map(([label, value, focused]) => (
              <div key={label} className={`px-3.5 py-3 rounded-lg bg-slate-950 border ${focused ? "border-pink-500/60 ring-1 ring-pink-500/30" : "border-slate-800"}`}>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
                <div className="mt-1 font-semibold tabular-nums text-slate-100">{value}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-slate-500">배정 실행 주기·단독 배정 허용·일일 한도 옵션은 표시 전용 (변경은 협의 절차 — 합의 사항 4)</p>
        </window.Card>

        {/* 파라미터 프리셋 목록 — 현행 / 제안 (A/B 비교용 2세트) */}
        <window.Card className="col-span-12 lg:col-span-5 p-5">
          <div className="flex items-center gap-2 mb-3.5">
            <h3 className="font-semibold text-sm">파라미터 프리셋</h3>
            <span className="text-[11px] text-slate-500">선택 시 오버라이드 폼에 반영</span>
          </div>
          <div className="space-y-2.5">
            {window.PARAM_PRESETS.map((p) => {
              const on = presetId === p.id;
              return (
                <button key={p.id} onClick={() => pickPreset(p)}
                  className={`w-full text-left p-3.5 rounded-lg border transition ${
                    on ? "bg-pink-500/10 border-pink-500/50" : "bg-slate-950 border-slate-800 hover:border-slate-600"
                  }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium flex items-center gap-2">
                      {p.name}
                      {p.active && <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">운영 중</span>}
                    </span>
                    {on && <window.Icon name="check" className="w-4 h-4 text-pink-300" />}
                  </div>
                  <div className="mt-1.5 text-xs text-slate-400 font-mono tabular-nums">
                    묶음 {p.bundleKm}km · 편차 {p.devLimit}건 · 가중 {p.weight}
                  </div>
                  <div className="mt-1 text-[10px] text-slate-500">{p.note}</div>
                </button>
              );
            })}
          </div>
        </window.Card>
      </div>

      {/* 시뮬레이션 실행 폼 (sim1001) */}
      <window.Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="font-semibold text-sm">시뮬레이션 실행 — sim1001 드라이런</h3>
          <span className="text-[11px] text-slate-500">운영 데이터 무변경 {tweaks.showRuleBadges && <window.RuleChip code="BS0012" />} · 미지정 항목은 운영 값 적용 {tweaks.showRuleBadges && <window.RuleChip code="BS0071" />}</span>
        </div>
        <div className="grid grid-cols-12 gap-3 items-end">
          <div className="col-span-12 md:col-span-4">
            <label className="text-[11px] uppercase tracking-wider text-slate-500">대상 기간 <span className="text-rose-400">*</span></label>
            <div className="flex items-center gap-2 mt-1">
              <input type="date" value={period.from} onChange={(e) => setPeriod({ ...period, from: e.target.value })} className={inputCls} />
              <span className="text-slate-600">~</span>
              <input type="date" value={period.to} onChange={(e) => setPeriod({ ...period, to: e.target.value })} className={inputCls} />
            </div>
          </div>
          {Object.keys(RANGE_T).map((key) => (
            <div key={key} className="col-span-4 md:col-span-2">
              <label className="text-[11px] uppercase tracking-wider text-slate-500">
                {RANGE_T[key].label} <span className="text-slate-600">({RANGE_T[key].min}~{RANGE_T[key].max}{RANGE_T[key].unit})</span>
              </label>
              <input type="number" step={key === "devLimit" ? 1 : 0.1} value={ov[key]}
                onChange={(e) => setOv({ ...ov, [key]: e.target.value })}
                className={`mt-1 ${inputCls} ${rangeErr(key) ? "!border-rose-500" : ""} ${focusCls(key)}`} />
            </div>
          ))}
          <div className="col-span-12 md:col-span-2 flex flex-col gap-1.5">
            <button onClick={() => runSim("A")} disabled={running !== null}
              className="w-full py-2 rounded-md bg-slate-800 border border-slate-700/60 hover:bg-slate-700 text-xs font-medium disabled:opacity-40 flex items-center justify-center gap-1.5">
              {running === "A" ? <span className="w-3 h-3 rounded-full border-2 border-slate-400 border-t-transparent animate-spin"></span> : <window.Icon name="play" className="w-3 h-3" />}
              현행 설정으로 실행
            </button>
            <button onClick={() => runSim("B")} disabled={running !== null || anyRangeErr}
              className="w-full py-2 rounded-md bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-xs font-semibold disabled:opacity-40 flex items-center justify-center gap-1.5 shadow-lg shadow-purple-500/20">
              {running === "B" ? <span className="w-3 h-3 rounded-full border-2 border-white/60 border-t-transparent animate-spin"></span> : <window.Icon name="play" className="w-3 h-3" />}
              제안 설정으로 실행
            </button>
          </div>
        </div>
        {Object.keys(RANGE_T).map((k) => rangeErr(k) && (
          <p key={k} className="mt-2 text-xs text-rose-400">{rangeErr(k)}</p>
        ))}
      </window.Card>

      {/* A/B 비교 뷰 */}
      <window.Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="font-semibold text-sm">A/B 비교 — 좌: 현행 설정 결과 / 우: 제안 설정 결과</h3>
          <span className="text-[11px] text-slate-500">델타 방향과 무관하게 ▲=개선(초록) · ▼=악화(빨강)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                <th className="px-3 py-2.5 font-medium w-32">지표</th>
                <th className="px-3 py-2.5 font-medium">A. 현행 설정</th>
                <th className="px-3 py-2.5 font-medium">B. 제안 설정</th>
                <th className="px-3 py-2.5 font-medium w-44">델타</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-800/60 text-xs">
                <td className="px-3 py-2.5 text-slate-400">실행 ID</td>
                <td className="px-3 py-2.5 font-mono">{slotA ? slotA.runId : <span className="text-slate-600">— 미실행</span>}</td>
                <td className="px-3 py-2.5 font-mono">{slotB ? slotB.runId : <span className="text-slate-600">— 미실행</span>}</td>
                <td className="px-3 py-2.5"></td>
              </tr>
              <tr className="border-b border-slate-800/60 text-xs">
                <td className="px-3 py-2.5 text-slate-400">적용 파라미터</td>
                <td className="px-3 py-2.5 font-mono text-slate-300">{slotA ? slotA.paramSummary : "—"}</td>
                <td className="px-3 py-2.5 font-mono text-slate-300">{slotB ? slotB.paramSummary : "—"}</td>
                <td className="px-3 py-2.5"></td>
              </tr>
              {[
                ["일치율", (s) => `${s.matchRate} %`],
                ["평균 거리", (s) => `${s.avgDistance} km`],
                ["최대 편차", (s) => `${s.maxDeviation}건`],
                ["대기 건수", (s) => `${s.waitCount}건 (${s.waitDetail})`],
              ].map(([label, fn], i) => {
                const d = deltas ? deltas[i] : null;
                return (
                  <tr key={label} className="border-b border-slate-800/60">
                    <td className="px-3 py-3 text-slate-400 text-xs">{label}</td>
                    <td className="px-3 py-3 tabular-nums font-semibold">{slotA ? fn(slotA) : <span className="text-slate-600 font-normal text-xs">—</span>}</td>
                    <td className="px-3 py-3 tabular-nums font-semibold">{slotB ? fn(slotB) : <span className="text-slate-600 font-normal text-xs">—</span>}</td>
                    <td className="px-3 py-3">
                      {d ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${
                          d.improved ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"
                        }`}>
                          {d.improved ? "▲" : "▼"}{d.mag} {d.improved ? "개선" : "악화"}
                        </span>
                      ) : <span className="text-slate-600 text-xs">A·B 실행 후 표시</span>}
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td className="px-3 py-3 text-slate-400 text-xs">전문가별 분포 요약</td>
                <td className="px-3 py-3 tabular-nums text-xs">{slotA ? `최대 ${slotA.distMax} / 최소 ${slotA.distMin}` : "—"}</td>
                <td className="px-3 py-3 tabular-nums text-xs">{slotB ? `최대 ${slotB.distMax} / 최소 ${slotB.distMin}` : "—"}</td>
                <td className="px-3 py-3">
                  <button disabled={!slotA && !slotB} onClick={() => setDistPanel(true)}
                    className="text-xs text-purple-400 hover:text-purple-300 disabled:text-slate-600 flex items-center gap-1">
                    분포 상세 <window.Icon name="arrowRight" className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 주 액션 1개 — <이 설정 적용> (T7, BS0093 게이팅) */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-col items-center gap-2">
          <button disabled={!slotB || anyRangeErr} onClick={() => setApplyDlg(true)}
            className="px-8 py-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 font-bold text-sm disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-purple-500/30">
            <window.Icon name="shieldCheck" className="w-4 h-4" />이 설정 적용
          </button>
          {!slotB && (
            <p className="text-[11px] text-slate-500">
              제안 설정 시뮬레이션 실행 후 적용할 수 있습니다 — 근거 실행 ID 없이 변경 불가 {tweaks.showRuleBadges && <window.RuleChip code="BS0093" />}
            </p>
          )}
        </div>
      </window.Card>

      {/* 적용 이력 — 롤백 지원 (BS0094) */}
      <window.Card className="overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-2">
          <h3 className="font-semibold text-sm">적용 이력 (ENG_PARAM_LOG)</h3>
          <span className="text-[11px] text-slate-500">적용 전후 값·승인자·근거 실행 ID·조정 회차 — "검증 2주·조정 3회" 회차 기록 {tweaks.showRuleBadges && <window.RuleChip code="BS0094" />}</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
              <th className="px-5 py-2.5 font-medium">적용 일시</th>
              <th className="px-3 py-2.5 font-medium">변경 내용</th>
              <th className="px-3 py-2.5 font-medium">근거 실행 ID</th>
              <th className="px-3 py-2.5 font-medium">승인자</th>
              <th className="px-3 py-2.5 font-medium">회차</th>
              <th className="px-5 py-2.5 font-medium text-right">액션</th>
            </tr>
          </thead>
          <tbody>
            {log.map((r, i) => (
              <tr key={i} className="border-b border-slate-800/60">
                <td className="px-5 py-3 font-mono text-xs text-slate-400">{r.at}</td>
                <td className="px-3 py-3 text-slate-200 text-xs">{r.change}</td>
                <td className="px-3 py-3 font-mono text-xs">{r.runId || <span className="text-slate-600">—</span>}</td>
                <td className="px-3 py-3 text-xs">{r.by}</td>
                <td className="px-3 py-3 text-xs">{r.round}</td>
                <td className="px-5 py-3 text-right">
                  {r.rollbackable ? (
                    <button onClick={() => setRollbackDlg(r)}
                      className="text-xs px-3 py-1.5 rounded-md bg-slate-800 border border-slate-700/60 hover:border-orange-500/50 hover:text-orange-300 transition">롤백</button>
                  ) : <span className="text-slate-600 text-xs">—</span>}
                </td>
              </tr>
            ))}
            {log.length === 0 && (
              <tr><td colSpan="6" className="px-5 py-8 text-center text-sm text-slate-500">적용 이력 0건 — 아직 화면 적용 이력이 없습니다</td></tr>
            )}
          </tbody>
        </table>
      </window.Card>

      {/* 적용 확인 다이얼로그 (MG1008 — 변경 요약 + 예상 영향 + 근거 실행) */}
      {applyDlg && slotB && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-950/70" onClick={() => setApplyDlg(false)}></div>
          <window.Card className="relative w-full max-w-lg p-6">
            <h3 className="font-bold text-lg">파라미터 적용 확인</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">담당자 승인 후 반영 {tweaks.showRuleBadges && <window.RuleChip code="MG1008" />}</p>
            <div className="mt-4 space-y-2.5 text-sm">
              <div className="px-4 py-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">변경 요약</div>
                {changeSummary.length > 0
                  ? changeSummary.map((c) => <div key={c} className="tabular-nums text-slate-100">{c}</div>)
                  : <div className="text-slate-400">변경 항목 없음</div>}
              </div>
              <div className="px-4 py-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">예상 영향 (A/B 델타 4지표)</div>
                <div className="text-xs text-slate-200">{deltaLine || "현행 설정 실행(A) 후 델타가 표시됩니다"}</div>
              </div>
              <div className="px-4 py-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1">
                <div className="flex justify-between"><span className="text-slate-500">근거 실행</span><span className="font-mono">{slotB.runId} ({slotB.ranAt} · 대상 {slotB.targetCount}건)</span></div>
                <div className="flex justify-between"><span className="text-slate-500">조정 회차</span><span>{nextRound}회차로 기록됩니다 (검증 2주 · 조정 3회 프로세스)</span></div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setApplyDlg(false)}
                className="px-4 py-2 rounded-md bg-slate-800 border border-slate-700/60 text-sm hover:bg-slate-700">취소</button>
              <button onClick={doApply}
                className="px-4 py-2 rounded-md bg-gradient-to-r from-purple-500 to-pink-500 text-sm font-semibold">승인하고 적용 (param1002)</button>
            </div>
          </window.Card>
        </div>
      )}

      {/* 롤백 확인 다이얼로그 (BS0094) */}
      {rollbackDlg && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-950/70" onClick={() => setRollbackDlg(null)}></div>
          <window.Card className="relative w-full max-w-md p-6 !border-orange-700">
            <h3 className="font-bold text-lg">직전 설정으로 복원할까요?</h3>
            <div className="mt-3 px-4 py-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between"><span className="text-slate-500">복원 대상</span><span className="text-slate-200">{rollbackDlg.change}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">복원 요약</span>
                <span className="tabular-nums text-orange-300">
                  {(() => { const b = rollbackBefore(rollbackDlg); return b ? `묶음 ${params.bundleKm} → ${b.bundleKm} km · 편차 ${params.devLimit} → ${b.devLimit}건` : "—"; })()}
                </span>
              </div>
              <div className="flex justify-between"><span className="text-slate-500">원 적용 근거 실행</span><span className="font-mono">{rollbackDlg.runId || "—"}</span></div>
            </div>
            <p className="mt-2.5 text-[11px] text-slate-500">롤백도 동일하게 이력으로 기록됩니다 (BS0094 · 직전 1단계 복원 기본안)</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setRollbackDlg(null)}
                className="px-4 py-2 rounded-md bg-slate-800 border border-slate-700/60 text-sm hover:bg-slate-700">취소</button>
              <button onClick={doRollback}
                className="px-4 py-2 rounded-md bg-orange-600 hover:bg-orange-500 text-sm font-semibold text-white">승인하고 복원</button>
            </div>
          </window.Card>
        </div>
      )}

      {/* 분포 상세 사이드패널 (모델 33 전문가별 분포 표 재사용) */}
      {distPanel && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-slate-950/60" onClick={() => setDistPanel(false)}></div>
          <div className="w-full max-w-sm bg-slate-950 border-l border-slate-700/60 overflow-y-auto">
            <div className="sticky top-0 bg-slate-950 border-b border-slate-800 px-5 py-4 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-pink-400">전문가별 분포 상세</div>
                <div className="text-xs text-slate-500 mt-0.5">sim1001 리포트 (모델 33 형상 재사용)</div>
              </div>
              <button onClick={() => setDistPanel(false)} className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400">
                <window.Icon name="x" className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase text-slate-500 border-b border-slate-800">
                    <th className="py-2 font-medium">전문가</th>
                    <th className="py-2 font-medium text-right">A. 현행</th>
                    <th className="py-2 font-medium text-right">B. 제안</th>
                    <th className="py-2 font-medium text-right">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {window.PARAM_PRESETS[0].sim.distribution.map((row, i) => {
                    const b = window.PARAM_PRESETS[1].sim.distribution[i];
                    const dv = b.count - row.count;
                    return (
                      <tr key={row.name} className="border-b border-slate-800/60">
                        <td className="py-2.5 font-medium">{row.name}</td>
                        <td className="py-2.5 text-right tabular-nums">{slotA ? row.count : "—"}</td>
                        <td className="py-2.5 text-right tabular-nums">{slotB ? b.count : "—"}</td>
                        <td className={`py-2.5 text-right tabular-nums ${dv > 0 ? "text-amber-300" : "text-slate-500"}`}>
                          {slotA && slotB ? (dv > 0 ? `+${dv}` : dv) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-3 text-[10px] text-slate-500">기간 {window.PARAM_PRESETS[0].sim.period} · 대상 {window.PARAM_PRESETS[0].sim.targetCount}건</p>
            </div>
          </div>
        </div>
      )}

      {/* 토스트 */}
      {toast && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg bg-slate-900 border border-pink-500/40 text-sm text-slate-100 shadow-xl flex items-center gap-2 max-w-xl">
          <window.Icon name="check" className="w-4 h-4 text-emerald-400 shrink-0" />{toast}
        </div>
      )}
    </div>
  );
}

window.Templates = TemplatesScreen;

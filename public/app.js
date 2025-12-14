const byId = (id) => document.getElementById(id);

const loadLocale = async () => {
  try {
    const res = await fetch("/locales/en/common.json", { cache: "no-cache" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};

const applyLocale = (dict) => {
  if (!dict) return;

  const setText = (id, text) => {
    const el = byId(id);
    if (el) el.textContent = text;
  };

  setText("title", dict.title);
  setText("subtitle", dict.subtitle);
  setText("tabEet", dict.tabEet);
  setText("tabDiff", dict.tabDiff);
  setText("tabBulk", dict.tabBulk);
  setText("tabPoints", dict.tabPoints);
  setText("missingBibLabel", dict.missingBibLabel);
  setText("timingLabel", dict.timingLabel);
  setText("calcBtn", dict.calculate);
  setText("footerText", dict.footer);
  setText("diffTitle", dict.diffTitle);
  setText("diffHelp", dict.diffHelp);
  setText("finishLabel", dict.finishLabel);
  setText("startLabel", dict.startLabel);
  setText("diffBtn", dict.calculate);
  setText("bulkTitle", dict.bulkTitle);
  setText("bulkHelp", dict.bulkHelp);
  setText("bulkLabel", dict.bulkLabel);
  setText("bulkBtn", dict.calculate);
  setText("pointsTitle", dict.pointsTitle);
  setText("pointsHelp", dict.pointsHelp);
  setText("disciplineLabel", dict.disciplineLabel);
  setText("fValueLabel", dict.fValueLabel);
  setText("minSurchargeLabel", dict.minSurchargeLabel);
  setText("adderLabel", dict.adderLabel);
  setText("useResultsAsStartersLabel", dict.useResultsAsStartersLabel);
  setText("missingPointsAs250Label", dict.missingPointsAs250Label);
  setText("resultsLabel", dict.resultsLabel);
  setText("startersLabel", dict.startersLabel);
  setText("pointsBtn", dict.calculate);

  const missingBib = byId("missingBib");
  if (missingBib) missingBib.placeholder = dict.autoDetect;
};

const escapeHtml = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const renderError = (result, dict) => {
  const msg = result?.error ?? dict?.resultMissing ?? "Failed to calculate.";
  return `<div class="resultLine danger"><span class="pill">error</span> ${escapeHtml(msg)}</div>`;
};

const renderDiffError = (dict) => {
  const msg = dict?.diffError ?? "Please provide valid start and finish times.";
  return `<div class="resultLine danger"><span class="pill">error</span> ${escapeHtml(msg)}</div>`;
};

const NS_PER_SECOND = 1_000_000_000n;
const NS_PER_MINUTE = 60n * NS_PER_SECOND;
const NS_PER_HOUR = 60n * NS_PER_MINUTE;
const NS_PER_DAY = 24n * NS_PER_HOUR;

const parseTodToNs = (raw) => {
  const token = String(raw ?? "").trim().replace(/\(.+\)$/, "").trim();
  if (!token) return null;

  // Accept HH:MM:SS(.|,)frac and HH.MM.SS(.|,)frac and also MM:SS(.|,)frac
  let m = token.match(/^(\d{1,2})[:.](\d{1,2})[:.](\d{1,2})(?:[.,](\d+))?$/);
  if (m) {
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    const ss = Number(m[3]);
    const fracRaw = m[4] ?? "";
    if (![hh, mm, ss].every(Number.isFinite) || hh < 0 || mm < 0 || ss < 0 || mm >= 60 || ss >= 60) return null;
    const frac9 = (fracRaw + "000000000").slice(0, 9);
    const fracNs = BigInt(frac9);
    return BigInt(hh) * NS_PER_HOUR + BigInt(mm) * NS_PER_MINUTE + BigInt(ss) * NS_PER_SECOND + fracNs;
  }

  m = token.match(/^(\d{1,3})[:.](\d{1,2})(?:[.,](\d+))?$/);
  if (!m) return null;
  const mm = Number(m[1]);
  const ss = Number(m[2]);
  const fracRaw = m[3] ?? "";
  if (![mm, ss].every(Number.isFinite) || mm < 0 || ss < 0 || ss >= 60) return null;
  const frac9 = (fracRaw + "000000000").slice(0, 9);
  const fracNs = BigInt(frac9);
  return BigInt(mm) * NS_PER_MINUTE + BigInt(ss) * NS_PER_SECOND + fracNs;
};

const formatDurationTrunc = ({ ns, fractionDigits }) => {
  const digits = Math.max(0, fractionDigits ?? 0);
  const abs = ns < 0n ? -ns : ns;

  const hh = abs / NS_PER_HOUR;
  const mm = (abs % NS_PER_HOUR) / NS_PER_MINUTE;
  const ss = (abs % NS_PER_MINUTE) / NS_PER_SECOND;
  const fracNs = abs % NS_PER_SECOND;

  const fracStr9 = String(fracNs).padStart(9, "0");
  const fracStr = digits ? fracStr9.slice(0, digits) : "";

  const mmStr = String(mm).padStart(hh > 0n ? 2 : 1, "0");
  const ssStr = String(ss).padStart(2, "0");

  const core = hh > 0n ? `${hh}:${mmStr}:${ssStr}` : `${mmStr}:${ssStr}`;
  return digits ? `${core}.${fracStr}` : core;
};

const renderDiffOk = ({ duration1000, duration100 }, dict) => {
  const l1000 = dict?.duration10000 ?? dict?.duration1000 ?? "Duration (1/10000)";
  const l100 = dict?.duration100 ?? "Duration (1/100)";
  return [
    `<div class="resultLine ok"><span class="pill">ok</span> <strong>${escapeHtml(
      l1000
    )}</strong>: <span class="pill mono">${escapeHtml(duration1000)}</span></div>`,
    `<div class="resultLine ok"><span class="pill">ok</span> <strong>${escapeHtml(
      l100
    )}</strong>: <span class="pill mono">${escapeHtml(duration100)}</span></div>`
  ].join("");
};

const extractTimeTokens = (line) => {
  const re = /(\d{1,2}[:.]\d{1,2}[:.]\d{1,2}(?:[.,]\d+)?)(?:\([^)]*\))?/g;
  const out = [];
  for (const m of String(line).matchAll(re)) out.push(m[1]);
  return out;
};

const renderOk = (result, dict) => {
  const bib = result.missingBib;
  const eet = result.eet?.aTod ?? "";
  const correction = result.correction?.seconds ?? "";
  const source = result.source?.bTod ?? "";
  const refs = (result.referenceBibList ?? []).join(", ");
  const sum = result.correctionDetails?.sumDiffSeconds ?? "";
  const avg = result.correctionDetails?.avgDiffSecondsTrunc ?? "";

  const eetLabel = dict?.resultEet ?? "EET (System A) for BIB";
  const corrLabel = dict?.resultCorrection ?? "Correction";
  const srcLabel = dict?.resultSource ?? "Source (System B/manual)";
  const refsLabel = dict?.resultRefs ?? "Reference BIBs";
  const sumLabel = dict?.resultSum ?? "Sum (B-A)";
  const avgLabel = dict?.resultAvg ?? "Avg (B-A) unrounded";

  const tableTitle = dict?.tableTitle ?? "Rows";
  const colBib = dict?.colBib ?? "BIB";
  const colB = dict?.colB ?? "System B/manual (TOD)";
  const colA = dict?.colA ?? "System A (TOD)";
  const colDiff = dict?.colDiff ?? "Diff (B-A)";
  const colFlags = dict?.colFlags ?? "Flags";
  const flagMissing = dict?.flagMissing ?? "missing";
  const flagRef = dict?.flagRef ?? "ref";
  const computedEet = dict?.computedEet ?? "computed (EET)";

  const rows = Array.isArray(result.rows) ? result.rows : [];
  const tableRows = rows
    .map((r) => {
      const flags = [];
      if (r.isMissing) flags.push(`<span class="flag danger">${escapeHtml(flagMissing)}</span>`);
      if (r.isReference) flags.push(`<span class="flag ok">${escapeHtml(flagRef)}</span>`);

      const trClass = r.isMissing ? "trMissing" : r.isReference ? "trRef" : "";
      const bTod = r.b?.tod || r.b?.raw || "";
      const aTod = r.a?.tod || r.a?.raw || "";
      const aComputed = r.a?.computedTod || "";
      const diff = r.diff?.seconds ?? "";

      const aCell = r.isMissing
        ? `<div class="cellStack">
  <div class="mono muted">${escapeHtml(aTod || r.a?.raw || "missing time")}</div>
  <div class="computed">
    <span class="computedLabel">${escapeHtml(computedEet)}</span>
    <span class="pill mono">${escapeHtml(aComputed || result.eet?.aTod || "")}</span>
  </div>
</div>`
        : escapeHtml(aTod);

      return `<tr class="${trClass}">
  <td class="td mono">${escapeHtml(r.bib)}</td>
  <td class="td mono">${escapeHtml(bTod)}</td>
  <td class="td mono">${aCell}</td>
  <td class="td mono">${escapeHtml(diff)}</td>
  <td class="td"><div class="flags">${flags.join("")}</div></td>
</tr>`;
    })
    .join("");

  const tableHtml = `
<div class="resultLine muted"><strong>${escapeHtml(tableTitle)}</strong></div>
<div class="tableWrap">
  <table class="table">
    <thead>
      <tr>
        <th class="th">${escapeHtml(colBib)}</th>
        <th class="th">${escapeHtml(colB)}</th>
        <th class="th">${escapeHtml(colA)}</th>
        <th class="th">${escapeHtml(colDiff)}</th>
        <th class="th">${escapeHtml(colFlags)}</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>
</div>`;

  return [
    `<div class="resultLine ok"><span class="pill">ok</span> <strong>${escapeHtml(
      eetLabel
    )} ${escapeHtml(bib)}</strong>: <span class="pill">${escapeHtml(eet)}</span></div>`,
    `<div class="resultLine muted"><strong>${escapeHtml(corrLabel)}</strong>: <span class="pill">${escapeHtml(
      correction
    )}</span> (n=${escapeHtml(result.usedDiffCount)})</div>`,
    `<div class="resultLine muted"><strong>${escapeHtml(sumLabel)}</strong>: <span class="pill">${escapeHtml(
      sum
    )}</span></div>`,
    `<div class="resultLine muted"><strong>${escapeHtml(avgLabel)}</strong>: <span class="pill">${escapeHtml(
      avg
    )}</span></div>`,
    `<div class="resultLine muted"><strong>${escapeHtml(srcLabel)}</strong>: <span class="pill">${escapeHtml(
      source
    )}</span></div>`,
    `<div class="resultLine muted"><strong>${escapeHtml(refsLabel)}</strong>: ${escapeHtml(refs)}</div>`
  ].join("") + tableHtml;
};

const main = async () => {
  const dict = await loadLocale();
  applyLocale(dict);

  const tabEet = byId("tabEet");
  const tabDiff = byId("tabDiff");
  const tabBulk = byId("tabBulk");
  const tabPoints = byId("tabPoints");
  const panelEet = byId("panelEet");
  const panelDiff = byId("panelDiff");
  const panelBulk = byId("panelBulk");
  const panelPoints = byId("panelPoints");

  const setActiveTab = (name) => {
    const isEet = name === "eet";
    const isDiff = name === "diff";
    const isBulk = name === "bulk";
    const isPoints = name === "points";
    if (tabEet) {
      tabEet.classList.toggle("isActive", isEet);
      tabEet.setAttribute("aria-selected", isEet ? "true" : "false");
      tabEet.tabIndex = isEet ? 0 : -1;
    }
    if (tabDiff) {
      tabDiff.classList.toggle("isActive", isDiff);
      tabDiff.setAttribute("aria-selected", isDiff ? "true" : "false");
      tabDiff.tabIndex = isDiff ? 0 : -1;
    }
    if (tabBulk) {
      tabBulk.classList.toggle("isActive", isBulk);
      tabBulk.setAttribute("aria-selected", isBulk ? "true" : "false");
      tabBulk.tabIndex = isBulk ? 0 : -1;
    }
    if (tabPoints) {
      tabPoints.classList.toggle("isActive", isPoints);
      tabPoints.setAttribute("aria-selected", isPoints ? "true" : "false");
      tabPoints.tabIndex = isPoints ? 0 : -1;
    }
    if (panelEet) panelEet.classList.toggle("isActive", isEet);
    if (panelDiff) panelDiff.classList.toggle("isActive", isDiff);
    if (panelBulk) panelBulk.classList.toggle("isActive", isBulk);
    if (panelPoints) panelPoints.classList.toggle("isActive", isPoints);
  };

  if (tabEet) tabEet.addEventListener("click", () => setActiveTab("eet"));
  if (tabDiff) tabDiff.addEventListener("click", () => setActiveTab("diff"));
  if (tabBulk) tabBulk.addEventListener("click", () => setActiveTab("bulk"));
  if (tabPoints) tabPoints.addEventListener("click", () => setActiveTab("points"));

  const btn = byId("calcBtn");
  const timingText = byId("timingText");
  const missingBib = byId("missingBib");
  const resultEl = byId("result");

  const doCalc = async () => {
    if (!resultEl) return;
    resultEl.innerHTML = `<div class="resultLine muted"><span class="pill">…</span> calculating</div>`;

    const payload = {
      text: timingText?.value ?? "",
      missingBib: missingBib?.value ?? ""
    };

    let res;
    try {
      res = await fetch("/api/calc", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch {
      resultEl.innerHTML = renderError({ error: "Network error." }, dict);
      return;
    }

    let json;
    try {
      json = await res.json();
    } catch {
      resultEl.innerHTML = renderError({ error: "Invalid server response." }, dict);
      return;
    }

    if (!json?.ok) {
      resultEl.innerHTML = renderError(json, dict);
      return;
    }

    resultEl.innerHTML = renderOk(json, dict);
  };

  if (btn) btn.addEventListener("click", doCalc);

  const diffBtn = byId("diffBtn");
  const finishTod = byId("finishTod");
  const startTod = byId("startTod");
  const diffResultEl = byId("diffResult");

  const doDiff = () => {
    if (!diffResultEl) return;
    const finishNs = parseTodToNs(finishTod?.value ?? "");
    const startNs = parseTodToNs(startTod?.value ?? "");
    if (finishNs == null || startNs == null) {
      diffResultEl.innerHTML = renderDiffError(dict);
      return;
    }

    let dur = finishNs - startNs;
    if (dur < 0n) dur += NS_PER_DAY;

    const duration1000 = formatDurationTrunc({ ns: dur, fractionDigits: 4 });
    const duration100 = formatDurationTrunc({ ns: dur, fractionDigits: 2 });
    diffResultEl.innerHTML = renderDiffOk({ duration1000, duration100 }, dict);
  };

  if (diffBtn) diffBtn.addEventListener("click", doDiff);

  const bulkBtn = byId("bulkBtn");
  const bulkText = byId("bulkText");
  const bulkResultEl = byId("bulkResult");

  const doBulk = () => {
    if (!bulkResultEl) return;
    const text = String(bulkText?.value ?? "");
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const hOriginal = dict?.bulkOriginal ?? "Original line";
    const hTime1 = dict?.bulkTime1 ?? "Time #1";
    const hTime2 = dict?.bulkTime2 ?? "Time #2";
    const hDur10000 = dict?.bulkDuration10000 ?? "Duration (1/10000)";
    const hDur100 = dict?.bulkDuration100 ?? "Duration (1/100)";
    const hStatus = dict?.bulkStatus ?? "Status";
    const statusOk = dict?.bulkOk ?? "ok";
    const statusNoTimes = dict?.bulkNoTimes ?? "no 2 time values found";

    const rowsHtml = lines
      .map((line) => {
        const times = extractTimeTokens(line);
        const t1 = times[0] ?? "";
        const t2 = times[1] ?? "";
        const ns1 = times.length >= 2 ? parseTodToNs(t1) : null;
        const ns2 = times.length >= 2 ? parseTodToNs(t2) : null;

        if (ns1 == null || ns2 == null) {
          return `<tr>
  <td class="td mono">${escapeHtml(line)}</td>
  <td class="td mono">${escapeHtml(t1)}</td>
  <td class="td mono">${escapeHtml(t2)}</td>
  <td class="td mono"></td>
  <td class="td mono"></td>
  <td class="td"><span class="pill danger">${escapeHtml(statusNoTimes)}</span></td>
</tr>`;
        }

        let dur = ns2 - ns1;
        if (dur < 0n) dur += NS_PER_DAY;
        const d10000 = formatDurationTrunc({ ns: dur, fractionDigits: 4 });
        const d100 = formatDurationTrunc({ ns: dur, fractionDigits: 2 });

        return `<tr>
  <td class="td mono">${escapeHtml(line)}</td>
  <td class="td mono">${escapeHtml(t1)}</td>
  <td class="td mono">${escapeHtml(t2)}</td>
  <td class="td mono">${escapeHtml(d10000)}</td>
  <td class="td mono">${escapeHtml(d100)}</td>
  <td class="td"><span class="pill ok">${escapeHtml(statusOk)}</span></td>
</tr>`;
      })
      .join("");

    bulkResultEl.innerHTML = `
<div class="tableWrap">
  <table class="table">
    <thead>
      <tr>
        <th class="th">${escapeHtml(hOriginal)}</th>
        <th class="th">${escapeHtml(hTime1)}</th>
        <th class="th">${escapeHtml(hTime2)}</th>
        <th class="th">${escapeHtml(hDur10000)}</th>
        <th class="th">${escapeHtml(hDur100)}</th>
        <th class="th">${escapeHtml(hStatus)}</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
</div>`;
  };

  if (bulkBtn) bulkBtn.addEventListener("click", doBulk);

  const discipline = byId("discipline");
  const fValue = byId("fValue");
  const minSurcharge = byId("minSurcharge");
  const adder = byId("adder");
  const useResultsAsStarters = byId("useResultsAsStarters");
  const missingPointsAs250 = byId("missingPointsAs250");
  const resultsText = byId("resultsText");
  const startersText = byId("startersText");
  const startersBlock = byId("startersBlock");
  const pointsBtn = byId("pointsBtn");
  const pointsResult = byId("pointsResult");

  const syncDiscipline = () => {
    const d = String(discipline?.value ?? "");
    const map = { SL: 730, RS: 1010, SG: 1190, PAR: 1190 };
    const v = map[d];
    if (fValue && Number.isFinite(v)) fValue.value = String(v);
  };
  if (discipline) discipline.addEventListener("change", syncDiscipline);

  const syncStartersVisibility = () => {
    const useRes = Boolean(useResultsAsStarters?.checked);
    if (startersBlock) startersBlock.style.display = useRes ? "none" : "block";
  };
  if (useResultsAsStarters) useResultsAsStarters.addEventListener("change", syncStartersVisibility);
  syncStartersVisibility();

  const renderPointsError = (result) => {
    const msg = result?.error ?? dict?.pointsError ?? "Failed to calculate points.";
    return `<div class="resultLine danger"><span class="pill">error</span> ${escapeHtml(msg)}</div>`;
  };

  const renderPointsOk = (result) => {
    const summaryTitle = dict?.pointsSummaryTitle ?? "Summary";
    const winnerTime = dict?.winnerTime ?? "Winner time";
    const finalSurcharge = dict?.finalSurcharge ?? "Final surcharge";
    const baseSurcharge = dict?.baseSurcharge ?? "Base surcharge";
    const sumA = dict?.sumA ?? "Sum A";
    const sumB = dict?.sumB ?? "Sum B";
    const sumC = dict?.sumC ?? "Sum C";

    const tableTitle = dict?.pointsTableTitle ?? "Calculated points";
    const colRank = dict?.colRank ?? "Rank";
    const colBib = dict?.colBib ?? "BIB";
    const colTime = dict?.colTime ?? "Time";
    const colDsvPoints = dict?.colDsvPoints ?? "DSV points";
    const colRacePoints = dict?.colRacePoints ?? "Race points";
    const colTotalPoints = dict?.colTotalPoints ?? "Total points";

    const flagWinner = dict?.flagWinner ?? "winner";
    const flagTop10 = dict?.flagTop10 ?? "top10";
    const flagSumA = dict?.flagSumA ?? "sumA";

    const rows = Array.isArray(result.rows) ? result.rows : [];
    const rowsHtml = rows
      .map((r) => {
        const flags = [];
        if (r.isWinner) flags.push(`<span class="flag ok">${escapeHtml(flagWinner)}</span>`);
        if (r.isTop10) flags.push(`<span class="flag">${escapeHtml(flagTop10)}</span>`);
        if (r.isInSumA) flags.push(`<span class="flag ok">${escapeHtml(flagSumA)}</span>`);

        return `<tr>
  <td class="td mono">${escapeHtml(r.rank)}</td>
  <td class="td mono">${escapeHtml(r.bib ?? "")}</td>
  <td class="td mono">${escapeHtml(r.time)}</td>
  <td class="td mono">${escapeHtml(r.dsvPoints)}</td>
  <td class="td mono">${escapeHtml(r.racePoints)}</td>
  <td class="td mono">${escapeHtml(r.totalPoints)}</td>
  <td class="td"><div class="flags">${flags.join("")}</div></td>
</tr>`;
      })
      .join("");

    const usedMin = result.usedMinSurcharge ? " (min applied)" : "";

    return `
<div class="resultLine muted"><strong>${escapeHtml(summaryTitle)}</strong></div>
<div class="resultLine muted"><strong>${escapeHtml(winnerTime)}</strong>: <span class="pill">${escapeHtml(
      result.winnerTime
    )}</span></div>
<div class="resultLine muted"><strong>${escapeHtml(sumA)}</strong>: <span class="pill">${escapeHtml(result.sumA)}</span></div>
<div class="resultLine muted"><strong>${escapeHtml(sumB)}</strong>: <span class="pill">${escapeHtml(result.sumB)}</span></div>
<div class="resultLine muted"><strong>${escapeHtml(sumC)}</strong>: <span class="pill">${escapeHtml(result.sumC)}</span></div>
<div class="resultLine muted"><strong>${escapeHtml(baseSurcharge)}</strong>: <span class="pill">${escapeHtml(
      result.baseSurcharge
    )}</span>${escapeHtml(usedMin)}</div>
<div class="resultLine ok"><span class="pill">ok</span> <strong>${escapeHtml(finalSurcharge)}</strong>: <span class="pill mono">${escapeHtml(
      result.finalSurcharge
    )}</span></div>

<div class="resultLine muted"><strong>${escapeHtml(tableTitle)}</strong></div>
<div class="tableWrap">
  <table class="table">
    <thead>
      <tr>
        <th class="th">${escapeHtml(colRank)}</th>
        <th class="th">${escapeHtml(colBib)}</th>
        <th class="th">${escapeHtml(colTime)}</th>
        <th class="th">${escapeHtml(colDsvPoints)}</th>
        <th class="th">${escapeHtml(colRacePoints)}</th>
        <th class="th">${escapeHtml(colTotalPoints)}</th>
        <th class="th">Flags</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
</div>`;
  };

  const doPoints = async () => {
    if (!pointsResult) return;
    pointsResult.innerHTML = `<div class="resultLine muted"><span class="pill">…</span> calculating</div>`;

    const payload = {
      resultsText: resultsText?.value ?? "",
      startersText: startersText?.value ?? "",
      useResultsAsStarters: Boolean(useResultsAsStarters?.checked),
      missingPointsAs250: Boolean(missingPointsAs250?.checked),
      fValue: fValue?.value ?? "",
      minSurcharge: minSurcharge?.value ?? "",
      adder: adder?.value ?? ""
    };

    let res;
    try {
      res = await fetch("/api/points", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch {
      pointsResult.innerHTML = renderPointsError({ error: "Network error." });
      return;
    }

    let json;
    try {
      json = await res.json();
    } catch {
      pointsResult.innerHTML = renderPointsError({ error: "Invalid server response." });
      return;
    }

    if (!json?.ok) {
      pointsResult.innerHTML = renderPointsError(json);
      return;
    }

    pointsResult.innerHTML = renderPointsOk(json);
  };

  if (pointsBtn) pointsBtn.addEventListener("click", doPoints);
};

main();



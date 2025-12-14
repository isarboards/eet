import {
  formatAverageSecondsTrunc,
  formatSeconds,
  formatTod,
  roundNsToUnitHalfAwayFromZero,
  unitNsFromFractionDigits
} from "./time.js";

const isMissingLike = (raw) => {
  const s = String(raw ?? "").trim().toLowerCase();
  return (
    s === "missing" ||
    s === "missing time" ||
    s === "missed" ||
    s === "missed time" ||
    s === "no time"
  );
};

const isValidCorrectionRow = (row) => {
  // FIS text: “use the 10 times of day …”. So only rows with *actual* TOD values count.
  return row.aNs != null && row.bNs != null;
};

const diffNsForRow = (row) => {
  if (row.aNs != null && row.bNs != null) return row.bNs - row.aNs;
  return null;
};

const maxAFractionDigits = (rows) => {
  let max = 0;
  for (const r of rows) {
    if (r.aNs == null) continue;
    if (typeof r.aFractionDigits === "number") {
      if (r.aFractionDigits > max) max = r.aFractionDigits;
    }
  }
  return max;
};

const rowDiffFractionDigits = (row) => {
  const a = typeof row.aFractionDigits === "number" ? row.aFractionDigits : 0;
  const b = typeof row.bFractionDigits === "number" ? row.bFractionDigits : 0;
  return Math.max(3, a, b);
};

const chooseReferenceRows = ({ rows, missingIndex, targetCount }) => {
  const before = [];
  for (let i = missingIndex - 1; i >= 0; i -= 1) {
    if (isValidCorrectionRow(rows[i])) before.push(rows[i]);
    if (before.length >= targetCount) break;
  }
  before.reverse();

  if (before.length >= targetCount) return before.slice(0, targetCount);

  const after = [];
  for (let i = missingIndex + 1; i < rows.length; i += 1) {
    if (isValidCorrectionRow(rows[i])) after.push(rows[i]);
    if (before.length + after.length >= targetCount) break;
  }
  return before.concat(after).slice(0, targetCount);
};

export const calculateEet = ({ rows, missingBib, referenceCount = 10 }) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      ok: false,
      error: "No rows parsed from input."
    };
  }

  const missingIndex =
    typeof missingBib === "number"
      ? rows.findIndex((r) => r.bib === missingBib)
      : rows.findIndex((r) => r.aNs == null && r.bNs != null && isMissingLike(r.aRaw));

  if (missingIndex < 0) {
    return {
      ok: false,
      error:
        "Could not find a row with missing System A time. Ensure the missing row contains System B/manual time and 'missing time' (or pass missingBib)."
    };
  }

  const missingRow = rows[missingIndex];
  if (missingRow.bNs == null) {
    return {
      ok: false,
      error: `Missing row (BIB ${missingRow.bib}) does not contain a System B/manual time-of-day to use as source.`
    };
  }

  const refs = chooseReferenceRows({
    rows,
    missingIndex,
    targetCount: referenceCount
  });

  if (refs.length === 0) {
    return { ok: false, error: "No valid reference rows found to calculate correction." };
  }

  let sumDiffNs = 0n;
  const diffs = [];
  for (const r of refs) {
    const d = diffNsForRow(r);
    if (d == null) continue;
    sumDiffNs += d;
    diffs.push({ bib: r.bib, diffNs: d });
  }

  if (diffs.length === 0) {
    return { ok: false, error: "Reference rows did not yield any usable A/B differences." };
  }

  const aDigits = Math.max(3, maxAFractionDigits(refs));
  const unitNs = unitNsFromFractionDigits(aDigits);

  const correctionNs = roundNsToUnitHalfAwayFromZero({
    numeratorNs: sumDiffNs,
    denominator: BigInt(diffs.length),
    unitNs
  });

  const eetNs = missingRow.bNs - correctionNs;

  const refBibSet = new Set(refs.map((r) => r.bib));
  const verboseRows = rows.map((r) => {
    const bTod = r.bNs != null ? formatTod({ ns: r.bNs, fractionDigits: r.bFractionDigits ?? 0 }) : "";
    const aTod = r.aNs != null ? formatTod({ ns: r.aNs, fractionDigits: r.aFractionDigits ?? 0 }) : "";
    const hasDiff = r.aNs != null && r.bNs != null;
    const diffDigits = rowDiffFractionDigits(r);
    const diffSeconds = hasDiff ? formatSeconds({ ns: r.bNs - r.aNs, fractionDigits: diffDigits }) : "";

    const isMissing = r.bib === missingRow.bib;
    const computedATod = isMissing ? formatTod({ ns: eetNs, fractionDigits: aDigits }) : "";

    return {
      bib: r.bib,
      b: { raw: r.bRaw ?? "", tod: bTod },
      a: { raw: r.aRaw ?? "", tod: aTod, computedTod: computedATod },
      diff: hasDiff ? { seconds: diffSeconds } : null,
      isReference: refBibSet.has(r.bib),
      isMissing
    };
  });

  return {
    ok: true,
    missingBib: missingRow.bib,
    referenceBibList: refs.map((r) => r.bib),
    usedDiffCount: diffs.length,
    aFractionDigitsUsed: aDigits,
    correction: {
      ns: correctionNs,
      seconds: formatSeconds({ ns: correctionNs, fractionDigits: aDigits })
    },
    correctionDetails: {
      sumDiffSeconds: formatSeconds({ ns: sumDiffNs, fractionDigits: aDigits }),
      avgDiffSecondsTrunc: formatAverageSecondsTrunc({
        sumNs: sumDiffNs,
        count: diffs.length,
        fractionDigits: Math.min(aDigits + 2, 8)
      }),
      roundingUnitSeconds: `0.${"0".repeat(Math.max(0, aDigits - 1))}1`
    },
    source: {
      bib: missingRow.bib,
      bTod: formatTod({ ns: missingRow.bNs, fractionDigits: missingRow.bFractionDigits ?? 0 }),
      bRaw: missingRow.bRaw
    },
    eet: {
      bib: missingRow.bib,
      aTod: formatTod({ ns: eetNs, fractionDigits: aDigits })
    },
    rows: verboseRows
  };
};



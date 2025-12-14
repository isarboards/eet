const NS_PER_SECOND = 1_000_000_000n;
const NS_PER_MINUTE = 60n * NS_PER_SECOND;
const NS_PER_HOUR = 60n * NS_PER_MINUTE;

const absBigInt = (n) => (n < 0n ? -n : n);

const roundHalfUpInt = ({ numerator, denominator }) => {
  if (denominator <= 0n) throw new Error("denominator must be > 0");
  if (numerator === 0n) return 0n;

  const q = numerator / denominator; // trunc toward zero
  const r = numerator % denominator;
  const shouldRoundUp = absBigInt(r) * 2n >= denominator;
  if (!shouldRoundUp) return q;
  return q + (numerator > 0n ? 1n : -1n);
};

const formatHundredths = (n) => {
  const sign = n < 0n ? "-" : "";
  const abs = absBigInt(n);
  const whole = abs / 100n;
  const frac = abs % 100n;
  return `${sign}${whole}.${String(frac).padStart(2, "0")}`;
};

const parsePointsToHundredths = (raw) => {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const normalized = s.replace(",", ".");
  const m = normalized.match(/^(-?\d+)(?:\.(\d+))?$/);
  if (!m) return null;

  const sign = m[1].startsWith("-") ? -1n : 1n;
  const intPart = BigInt(m[1].replace("-", ""));
  const fracRaw = m[2] ?? "";
  const frac2 = (fracRaw + "00").slice(0, 2);
  const fracRest = fracRaw.slice(2);
  let frac = BigInt(frac2);

  // If input has more than 2 decimals, apply half-up rounding to 2 decimals.
  if (fracRest.length > 0) {
    const nextDigit = Number(fracRest[0] ?? "0");
    if (Number.isFinite(nextDigit) && nextDigit >= 5) {
      frac += 1n;
      if (frac >= 100n) {
        frac = 0n;
        return sign * ((intPart + 1n) * 100n + frac);
      }
    }
  }

  return sign * (intPart * 100n + frac);
};

const parseDurationToNs = (raw) => {
  const token = String(raw ?? "").trim().replace(/\(.+\)$/, "").trim();
  if (!token) return null;

  // Accept:
  // - H:MM:SS(.|,)frac
  // - MM:SS(.|,)frac
  // - SS(.|,)frac
  let m = token.match(/^(\d+):(\d{1,2}):(\d{1,2})(?:[.,](\d+))?$/);
  if (m) {
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    const ss = Number(m[3]);
    const fracRaw = m[4] ?? "";
    if (![hh, mm, ss].every(Number.isFinite) || mm >= 60 || ss >= 60) return null;
    const frac9 = (fracRaw + "000000000").slice(0, 9);
    return BigInt(hh) * NS_PER_HOUR + BigInt(mm) * NS_PER_MINUTE + BigInt(ss) * NS_PER_SECOND + BigInt(frac9);
  }

  m = token.match(/^(\d+):(\d{1,2})(?:[.,](\d+))?$/);
  if (m) {
    const mm = Number(m[1]);
    const ss = Number(m[2]);
    const fracRaw = m[3] ?? "";
    if (![mm, ss].every(Number.isFinite) || ss >= 60) return null;
    const frac9 = (fracRaw + "000000000").slice(0, 9);
    return BigInt(mm) * NS_PER_MINUTE + BigInt(ss) * NS_PER_SECOND + BigInt(frac9);
  }

  m = token.match(/^(\d+)(?:[.,](\d+))?$/);
  if (!m) return null;
  const ss = Number(m[1]);
  const fracRaw = m[2] ?? "";
  if (!Number.isFinite(ss)) return null;
  const frac9 = (fracRaw + "000000000").slice(0, 9);
  return BigInt(ss) * NS_PER_SECOND + BigInt(frac9);
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

const extractFirstDurationToken = (line) => {
  const s = String(line);

  // Prefer tokens with ':' as time. Supports 1:45.1467 etc.
  const withColon = s.match(/(\d+(?::\d{1,2}){1,2}(?:[.,]\d+)?)(?:\([^)]*\))?/);
  if (withColon?.[1]) return withColon[1];

  // Fallback: allow seconds-only with a fractional part, e.g. 100.0000
  // (avoid grabbing bib/rank integers by requiring '.' or ',')
  const secOnly = s.match(/(\d+[.,]\d+)(?:\([^)]*\))?/);
  if (secOnly?.[1]) return secOnly[1];

  return null;
};

const extractBib = (line) => {
  const s = String(line).trim();

  // Common input: "rank bib time points" => bib is the 2nd integer column.
  const twoInts = s.match(/^(\d+)\s+(\d+)\b/);
  if (twoInts) return Number(twoInts[2]);

  // Fallback: first integer column.
  const m = s.match(/^(\d+)\b/);
  if (!m) return null;
  return Number(m[1]);
};

const extractLastNumberToken = (line) => {
  // Points usually appear as a decimal number; take the last numeric token.
  const re = /-?\d+(?:[.,]\d+)?/g;
  const matches = String(line).match(re);
  if (!matches || matches.length === 0) return null;
  return matches[matches.length - 1];
};

export const calculateDsvPoints = ({
  resultsText,
  startersText,
  useResultsAsStarters,
  missingPointsAs250,
  fValue,
  minSurcharge,
  adder
}) => {
  const F = Number(fValue);
  if (!Number.isFinite(F) || F <= 0) {
    return { ok: false, error: "Invalid F value." };
  }

  const adderH = parsePointsToHundredths(adder);
  if (adderH == null) return { ok: false, error: "Invalid adder value." };

  const minH = parsePointsToHundredths(minSurcharge);
  if (minH == null) return { ok: false, error: "Invalid minimum surcharge value." };

  const resultLines = String(resultsText ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const finishers = [];
  for (let i = 0; i < resultLines.length; i += 1) {
    const line = resultLines[i];
    const bib = extractBib(line);
    const timeToken = extractFirstDurationToken(line);
    const timeNs = timeToken ? parseDurationToNs(timeToken) : null;
    if (timeNs == null) continue;

    const lastNum = extractLastNumberToken(line);
    let pointsH = lastNum ? parsePointsToHundredths(lastNum) : null;
    if (pointsH == null && missingPointsAs250) pointsH = 25_000n;

    finishers.push({
      idx: i,
      bib,
      line,
      timeToken,
      timeNs,
      pointsH
    });
  }

  if (finishers.length < 1) return { ok: false, error: "No valid finisher times found in Results." };

  finishers.sort((a, b) => (a.timeNs < b.timeNs ? -1 : a.timeNs > b.timeNs ? 1 : 0));
  const winner = finishers[0];
  const To = winner.timeNs;
  if (To <= 0n) return { ok: false, error: "Winner time is invalid." };

  // Race points (hundredths), rounded half-up to 2 decimals.
  for (const f of finishers) {
    const delta = f.timeNs - To;
    const num = BigInt(Math.round(F)) * delta * 100n;
    const rpH = roundHalfUpInt({ numerator: num, denominator: To });
    f.racePointsH = rpH;
  }

  const first10 = finishers.slice(0, 10);
  const first10WithPoints = first10
    .map((x) => ({ ...x, pointsH: x.pointsH ?? (missingPointsAs250 ? 25_000n : null) }))
    .filter((x) => x.pointsH != null);

  if (first10WithPoints.length < 5) {
    return {
      ok: false,
      error: "Need at least 5 athletes with points among the first 10 finishers (missing points can be set to 250.00)."
    };
  }

  first10WithPoints.sort((a, b) => (a.pointsH < b.pointsH ? -1 : a.pointsH > b.pointsH ? 1 : 0));
  const best5A = first10WithPoints.slice(0, 5);

  const sumA = best5A.reduce((acc, x) => acc + x.pointsH, 0n);
  const sumC = best5A.reduce((acc, x) => acc + (x.racePointsH ?? 0n), 0n);

  const startersSource = useResultsAsStarters ? resultLines : String(startersText ?? "").split(/\r?\n/).map((l) => l.trim());
  const startersPoints = [];
  for (const line of startersSource) {
    if (!line) continue;
    const lastNum = extractLastNumberToken(line);
    let pH = lastNum ? parsePointsToHundredths(lastNum) : null;
    if (pH == null && missingPointsAs250) pH = 25_000n;
    if (pH != null) startersPoints.push(pH);
  }
  if (startersPoints.length < 5) {
    return {
      ok: false,
      error: "Need at least 5 starter point values for Sum B (missing points can be set to 250.00)."
    };
  }
  startersPoints.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const best5B = startersPoints.slice(0, 5);
  const sumB = best5B.reduce((acc, x) => acc + x, 0n);

  // Base surcharge in hundredths: base*100 = (SumA+SumB-SumC)/10
  const baseNum = sumA + sumB - sumC;
  const baseH = roundHalfUpInt({ numerator: baseNum, denominator: 10n });
  const baseBeforeMinH = baseH;
  const baseAfterMinH = baseH < minH ? minH : baseH;
  const surchargeH = baseAfterMinH + adderH;

  const rows = finishers.map((f, idx) => ({
    rank: idx + 1,
    bib: f.bib,
    time: formatDurationTrunc({ ns: f.timeNs, fractionDigits: 4 }),
    dsvPoints: f.pointsH != null ? formatHundredths(f.pointsH) : "",
    racePoints: formatHundredths(f.racePointsH ?? 0n),
    totalPoints: formatHundredths((f.racePointsH ?? 0n) + surchargeH),
    isWinner: idx === 0,
    isTop10: idx < 10,
    isInSumA: best5A.some((x) => x.idx === f.idx)
  }));

  return {
    ok: true,
    winnerTime: formatDurationTrunc({ ns: To, fractionDigits: 4 }),
    fValueUsed: Math.round(F),
    sumA: formatHundredths(sumA),
    sumB: formatHundredths(sumB),
    sumC: formatHundredths(sumC),
    baseSurcharge: formatHundredths(baseBeforeMinH),
    minSurcharge: formatHundredths(minH),
    usedMinSurcharge: baseBeforeMinH < minH,
    adder: formatHundredths(adderH),
    finalSurcharge: formatHundredths(surchargeH),
    rows
  };
};



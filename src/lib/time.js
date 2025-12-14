const NS_PER_SECOND = 1_000_000_000n;
const NS_PER_MINUTE = 60n * NS_PER_SECOND;
const NS_PER_HOUR = 60n * NS_PER_MINUTE;
const NS_PER_DAY = 24n * NS_PER_HOUR;

const absBigInt = (n) => (n < 0n ? -n : n);

const normalizeTodToken = (raw) => {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // Common “hand timing” format: 10:00:50.35(00) → ignore parentheses.
  return s.replace(/\(.+\)$/, "").trim();
};

const isNonTimeMarker = (raw) => {
  if (raw == null) return true;
  const s = String(raw).trim().toLowerCase();
  if (!s) return true;
  return (
    s === "dnf" ||
    s === "dns" ||
    s === "dsq" ||
    s === "missing" ||
    s === "missing time" ||
    s === "missed" ||
    s === "missed time" ||
    s === "no time" ||
    s === "-" ||
    s === "--" ||
    s === "---"
  );
};

export const parseTod = (raw) => {
  if (isNonTimeMarker(raw)) {
    return { ns: null, fractionDigits: null };
  }

  const token = normalizeTodToken(raw);
  if (!token || isNonTimeMarker(token)) {
    return { ns: null, fractionDigits: null };
  }

  // Accept:
  // - HH:MM:SS(.|,)frac
  // - HH.MM.SS(.|,)frac  (some PDFs/exporters use dots)
  const m = token.match(
    /^(\d{1,2})[:.](\d{1,2})[:.](\d{1,2})(?:[.,](\d+))?$/
  );
  if (!m) {
    return { ns: null, fractionDigits: null };
  }

  const hh = Number(m[1]);
  const mm = Number(m[2]);
  const ss = Number(m[3]);
  if (
    Number.isNaN(hh) ||
    Number.isNaN(mm) ||
    Number.isNaN(ss) ||
    hh < 0 ||
    mm < 0 ||
    ss < 0 ||
    mm >= 60 ||
    ss >= 60
  ) {
    return { ns: null, fractionDigits: null };
  }

  const fracRaw = m[4] ?? "";
  const fractionDigits = fracRaw.length ? fracRaw.length : 0;
  const frac9 = (fracRaw + "000000000").slice(0, 9);
  const fracNs = BigInt(frac9);

  const baseNs =
    BigInt(hh) * NS_PER_HOUR + BigInt(mm) * NS_PER_MINUTE + BigInt(ss) * NS_PER_SECOND;

  return { ns: baseNs + fracNs, fractionDigits };
};

export const formatTod = ({ ns, fractionDigits }) => {
  if (ns == null) return "";

  const digits = Math.max(0, fractionDigits ?? 0);
  const dayWrapped = ((ns % NS_PER_DAY) + NS_PER_DAY) % NS_PER_DAY;

  const hh = dayWrapped / NS_PER_HOUR;
  const mm = (dayWrapped % NS_PER_HOUR) / NS_PER_MINUTE;
  const ss = (dayWrapped % NS_PER_MINUTE) / NS_PER_SECOND;
  const fracNs = dayWrapped % NS_PER_SECOND;

  const hhStr = String(hh).padStart(2, "0");
  const mmStr = String(mm).padStart(2, "0");
  const ssStr = String(ss).padStart(2, "0");

  if (!digits) {
    return `${hhStr}:${mmStr}:${ssStr}`;
  }

  const fracStr9 = String(fracNs).padStart(9, "0");
  const fracStr = fracStr9.slice(0, digits);
  return `${hhStr}:${mmStr}:${ssStr}.${fracStr}`;
};

export const formatSeconds = ({ ns, fractionDigits }) => {
  if (ns == null) return "";
  const digits = Math.max(0, fractionDigits ?? 0);

  const sign = ns < 0n ? "-" : "";
  const abs = absBigInt(ns);

  const whole = abs / NS_PER_SECOND;
  const fracNs = abs % NS_PER_SECOND;

  if (!digits) {
    return `${sign}${whole}`;
  }

  const fracStr9 = String(fracNs).padStart(9, "0");
  const fracStr = fracStr9.slice(0, digits);
  return `${sign}${whole}.${fracStr}`;
};

export const formatAverageSecondsTrunc = ({ sumNs, count, fractionDigits }) => {
  if (sumNs == null) return "";
  const n = BigInt(count);
  if (n <= 0n) return "";

  const digits = Math.max(0, fractionDigits ?? 0);
  const sign = sumNs < 0n ? "-" : "";
  const abs = absBigInt(sumNs);

  // seconds = abs(ns) / 1e9; we want `digits` decimals => scale by 10^digits
  const scale = 10n ** BigInt(digits);
  const scaled = (abs * scale) / (n * NS_PER_SECOND);

  const whole = scaled / scale;
  const frac = scaled % scale;
  if (!digits) return `${sign}${whole}`;

  const fracStr = String(frac).padStart(digits, "0");
  return `${sign}${whole}.${fracStr}`;
};

export const roundNsToUnitHalfAwayFromZero = ({ numeratorNs, denominator, unitNs }) => {
  if (denominator <= 0n) {
    throw new Error("denominator must be > 0");
  }
  if (unitNs <= 0n) {
    throw new Error("unitNs must be > 0");
  }
  if (numeratorNs === 0n) return 0n;

  const denom2 = denominator * unitNs;
  const q = numeratorNs / denom2; // trunc toward zero
  const r = numeratorNs % denom2;

  const shouldRoundUp = absBigInt(r) * 2n >= denom2;
  if (!shouldRoundUp) return q * unitNs;

  const inc = numeratorNs > 0n ? 1n : -1n;
  return (q + inc) * unitNs;
};

export const unitNsFromFractionDigits = (fractionDigits) => {
  const digits = Math.max(0, fractionDigits ?? 0);
  const pow = BigInt(Math.max(0, 9 - digits));
  return 10n ** pow;
};

export const NS = {
  NS_PER_SECOND,
  NS_PER_MINUTE,
  NS_PER_HOUR,
  NS_PER_DAY
};



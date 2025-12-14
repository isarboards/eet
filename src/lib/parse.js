import { parseTod } from "./time.js";

const normalizeLine = (line) => line.replace(/\s+/g, " ").trim();

const extractBib = (line) => {
  const m = line.match(/^\s*(\d+)\b/);
  if (!m) return null;
  return Number(m[1]);
};

const extractTimesInOrder = (line) => {
  // Accept HH:MM:SS(.|,)frac or HH.MM.SS(.|,)frac; also accept optional "(00)" suffix.
  const re =
    /(\d{1,2}[:.]\d{1,2}[:.]\d{1,2}(?:[.,]\d+)?)(?:\([^)]*\))?/g;
  const out = [];
  for (const m of line.matchAll(re)) out.push(m[1]);
  return out;
};

const detectMarkers = (lineLower) => {
  const hasMissed = lineLower.includes("missed time") || lineLower.includes("missed");
  const hasMissing = lineLower.includes("missing time") || lineLower.includes("missing");
  const hasDNF = /\bdnf\b/.test(lineLower);
  const hasDNS = /\bdns\b/.test(lineLower);
  const hasDSQ = /\bdsq\b/.test(lineLower);
  return { hasMissed, hasMissing, hasDNF, hasDNS, hasDSQ };
};

export const parseTimingText = (text) => {
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .map((l) => normalizeLine(l))
    .filter((l) => l && !l.startsWith("#"));

  const rows = [];
  for (const line of lines) {
    const bib = extractBib(line);
    if (bib == null) continue;

    const lineLower = line.toLowerCase();
    const times = extractTimesInOrder(line);
    const markers = detectMarkers(lineLower);

    // Convention: if two times exist, first is System B/manual, second is System A.
    // If one time exists and line contains “missing/missed”, treat that time as System B.
    // If one time exists without marker, we still treat it as System B (best effort).
    let bRaw = null;
    let aRaw = null;
    if (times.length >= 2) {
      bRaw = times[0];
      aRaw = times[1];
    } else if (times.length === 1) {
      bRaw = times[0];
      aRaw = markers.hasMissing || markers.hasMissed ? "missing time" : null;
    } else {
      // No time strings, so likely DNF/DNS/DSQ or empty
      if (markers.hasDNF) {
        bRaw = "DNF";
        aRaw = "DNF";
      } else if (markers.hasDNS) {
        bRaw = "DNS";
        aRaw = "DNS";
      } else if (markers.hasDSQ) {
        bRaw = "DSQ";
        aRaw = "DSQ";
      }
    }

    const b = parseTod(bRaw);
    const a = parseTod(aRaw);

    rows.push({
      bib,
      rawLine: line,
      bRaw,
      aRaw,
      bNs: b.ns,
      aNs: a.ns,
      bFractionDigits: b.fractionDigits,
      aFractionDigits: a.fractionDigits
    });
  }

  return rows;
};




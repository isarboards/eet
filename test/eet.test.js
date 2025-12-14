import test from "node:test";
import assert from "node:assert/strict";

import { calculateEet, parseTimingText } from "../src/lib/index.js";

test("FIS example 13.1 (A & B precision 1/1000) -> Bib 22 EET 13:04:12.240, correction -0.082", () => {
  const input = `
11 13:00:00.483 13:00:00.263
12 13:00:26.521 13:00:26.880
13 13:00:47.410 13:00:47.368
14 13:01:04.232 13:01:04.368
15 13:01:27.544 13:01:27.775
16 DNF DNF
17 13:02:12.993 13:02:12.912
18 13:02:42.501 13:02:42.616
19 13:03:00.211 13:03:00.944
20 13:03:20.694 13:03:20.280
21 13:03:48.560 13:03:48.559
22 13:04:12.158 missed time
`.trim();

  const rows = parseTimingText(input);
  const result = calculateEet({ rows, missingBib: 22 });
  assert.equal(result.ok, true);
  assert.equal(result.missingBib, 22);
  assert.equal(result.correction.seconds, "-0.082");
  assert.equal(result.eet.aTod, "13:04:12.240");
});

test("FIS example 13.2 (A & B precision 1/10000) -> Bib 8 EET 10:07:51.6972, correction -0.1158", () => {
  const input = `
1 10:00:50.3548 10:00:50.1292
2 10:01:52.0189 10:01:52.1921
3 10:02:49.4978 10:02:49.4920
4 10:03:50.6148 10:03:50.9812
5 10:04:49.2741 10:04:49.8729
6 10:05:50.4702 10:05:50.5129
7 10:06:48.9125 10:06:48.8615
8 10:07:51.5814 missing time
9 10:08:49.8751 10:08:50.0002
10 10:09:49.2459 10:09:49.4278
11 10:10:50.3954 10:10:50.3473
`.trim();

  const rows = parseTimingText(input);
  const result = calculateEet({ rows, missingBib: 8 });
  assert.equal(result.ok, true);
  assert.equal(result.missingBib, 8);
  assert.equal(result.correction.seconds, "-0.1158");
  assert.equal(result.eet.aTod, "10:07:51.6972");
});

test("FIS example 13.3 (hand time 1/100, A 1/10000) -> Bib 8 EET 10:07:51.7007, correction -0.1207", () => {
  const input = `
1 10:00:50.35(00) 10:00:50.1292
2 10:01:52.01(00) 10:01:52.1921
3 10:02:49.49(00) 10:02:49.4920
4 10:03:50.61(00) 10:03:50.9812
5 10:04:49.27(00) 10:04:49.8729
6 10:05:50.47(00) 10:05:50.5129
7 10:06:48.91(00) 10:06:48.8615
8 10:07:51.58(00) missing time
9 10:08:49.87(00) 10:08:50.0002
10 10:09:49.24(00) 10:09:49.4278
11 10:10:50.39(00) 10:10:50.3473
`.trim();

  const rows = parseTimingText(input);
  const result = calculateEet({ rows, missingBib: 8 });
  assert.equal(result.ok, true);
  assert.equal(result.missingBib, 8);
  assert.equal(result.correction.seconds, "-0.1207");
  assert.equal(result.eet.aTod, "10:07:51.7007");
});




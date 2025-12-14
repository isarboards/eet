import test from "node:test";
import assert from "node:assert/strict";

import { calculateDsvPoints } from "../src/lib/index.js";

test("DSV points: basic race points + surcharge shape", () => {
  const res = calculateDsvPoints({
    resultsText: `
1 1:40.00 12.00
2 1:41.00 30.00
3 1:42.00 20.00
4 1:43.00 50.00
5 1:44.00 18.00
6 1:45.00 40.00
7 1:46.00 60.00
8 1:47.00 80.00
9 1:48.00 90.00
10 1:49.00 100.00
11 1:50.00 110.00
`.trim(),
    startersText: "",
    useResultsAsStarters: true,
    missingPointsAs250: true,
    fValue: 1000,
    minSurcharge: 25,
    adder: 0
  });

  assert.equal(res.ok, true);
  assert.equal(res.winnerTime.startsWith("1:40"), true);
  assert.equal(typeof res.finalSurcharge, "string");
  assert.equal(Array.isArray(res.rows), true);
  assert.equal(res.rows[0].racePoints, "0.00");
});

test("DSV points: rounding to 2 decimals is half-up", () => {
  // Winner 100.0000s, racer 104.5345s with F=1000:
  // delta/to = 0.045345 → race points = 45.345 → 45.35 (half-up)
  const res = calculateDsvPoints({
    resultsText: `
1 100.0000 10.00
2 104.5345 20.00
3 105.0000 30.00
4 106.0000 40.00
5 107.0000 50.00
6 108.0000 60.00
7 109.0000 70.00
8 110.0000 80.00
9 111.0000 90.00
10 112.0000 100.00
`.trim(),
    startersText: "",
    useResultsAsStarters: true,
    missingPointsAs250: true,
    fValue: 1000,
    minSurcharge: 0,
    adder: 0
  });

  assert.equal(res.ok, true);
  const row2 = res.rows.find((r) => r.rank === 2);
  assert.equal(row2?.racePoints, "45.35");
});

test("Race points match RS example table (F=1010)", () => {
  const res = calculateDsvPoints({
    resultsText: `
1 1:03,00 10.00
2 1:03,04 10.00
3 1:04,12 10.00
4 1:04,23 10.00
5 1:04,26 10.00
6 1:04,33 10.00
7 1:05,64 10.00
8 1:05,67 10.00
9 1:06,45 10.00
10 1:12.34 10.00
`.trim(),
    startersText: "",
    useResultsAsStarters: true,
    missingPointsAs250: true,
    fValue: 1010,
    minSurcharge: 0,
    adder: 0
  });

  assert.equal(res.ok, true);
  const byRank = new Map(res.rows.map((r) => [r.rank, r.racePoints]));
  assert.equal(byRank.get(1), "0.00");
  assert.equal(byRank.get(2), "0.64");
  assert.equal(byRank.get(3), "17.96");
  assert.equal(byRank.get(4), "19.72");
  assert.equal(byRank.get(5), "20.20");
  assert.equal(byRank.get(6), "21.32");
  assert.equal(byRank.get(7), "42.32");
  assert.equal(byRank.get(8), "42.80");
  assert.equal(byRank.get(9), "55.31");
  assert.equal(byRank.get(10), "149.74");
});



# EET (Equivalent Electronic Time) Calculator – FIS Alpine Timing

Small Node.js web app to calculate **EET** when **System A** time-of-day is missing, following the FIS procedure.

## Run

```bash
npm test
npm run start
```

Then open `http://localhost:3000`.

## Input format (paste into UI)

Paste lines that contain:

- a **BIB** number
- a **System B / manual** time-of-day (or DNF/DNS/DSQ)
- a **System A** time-of-day (or “missing time” / “missed time” / DNF/DNS/DSQ)

Example:

```text
11 13:00:00.483 13:00:00.263
12 13:00:26.521 13:00:26.880
...
22 13:04:12.158 missed time
```

## Notes

- **Reference set**: up to **10 valid pairs** (both A and B times present), preferring those **before** the missing bib; if fewer than 10 exist before, we take the remaining from **after** the missing bib.
- **Correction precision**: rounded to the **System A precision** used in the reference set (minimum 1/1000).




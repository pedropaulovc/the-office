import { withSpan } from "@/lib/telemetry";

export type TTestResult = {
  tStatistic: number;
  degreesOfFreedom: number;
  pValue: number;
  significant: boolean;
  meanA: number;
  meanB: number;
  sdA: number;
  sdB: number;
};

/** Arithmetic mean. */
export function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Sample variance (Bessel's correction: n-1). */
export function variance(values: number[]): number {
  const m = mean(values);
  return values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
}

/** Sample standard deviation. */
export function standardDeviation(values: number[]): number {
  return Math.sqrt(variance(values));
}

// ---------------------------------------------------------------------------
// t-distribution CDF via regularized incomplete beta function
// ---------------------------------------------------------------------------

/** Lanczos approximation for the log-gamma function. */
function lnGamma(x: number): number {
  const g = 7;
  const coefficients = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];

  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  }

  x -= 1;
  let a = coefficients[0]!;
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) {
    a += coefficients[i]! / (x + i);
  }

  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/**
 * Regularized incomplete beta function I_x(a, b) via continued fraction
 * (Lentz's modified method).
 */
function betaIncomplete(x: number, a: number, b: number): number {
  if (x === 0) return 0;
  if (x === 1) return 1;

  const lnBeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta);

  // Use the continued fraction representation that converges faster
  // If x > (a+1)/(a+b+2), use the symmetry relation
  if (x > (a + 1) / (a + b + 2)) {
    return 1 - betaIncomplete(1 - x, b, a);
  }

  const tiny = 1e-30;
  let f = tiny;
  let c = 1;
  let d = 1 - (a + b) * x / (a + 1);
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  f = d;

  for (let m = 1; m <= 200; m++) {
    // Even step: d_{2m}
    let numerator = m * (b - m) * x / ((a + 2 * m - 1) * (a + 2 * m));
    d = 1 + numerator * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + numerator / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    f *= c * d;

    // Odd step: d_{2m+1}
    numerator =
      -(a + m) * (a + b + m) * x / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 + numerator * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + numerator / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = c * d;
    f *= delta;

    if (Math.abs(delta - 1) < 1e-10) break;
  }

  return (front / a) * f;
}

/**
 * CDF of Student's t-distribution: P(T <= t | df).
 * Uses the relationship: P = 1 - 0.5 * I_x(df/2, 1/2) where x = df/(df+t^2).
 */
export function tDistributionCDF(t: number, df: number): number {
  if (t === 0) return 0.5;

  const x = df / (df + t * t);
  const ibeta = betaIncomplete(x, df / 2, 0.5);
  const p = 1 - 0.5 * ibeta;

  if (t < 0) return 1 - p;
  return p;
}

// ---------------------------------------------------------------------------
// Welch's t-test
// ---------------------------------------------------------------------------

/** Welch-Satterthwaite degrees of freedom approximation. */
function welchSatterthwaite(
  s1sq: number,
  n1: number,
  s2sq: number,
  n2: number,
): number {
  const num = (s1sq / n1 + s2sq / n2) ** 2;
  const den =
    (s1sq / n1) ** 2 / (n1 - 1) + (s2sq / n2) ** 2 / (n2 - 1);
  return num / den;
}

/** Welch's two-sample t-test (two-tailed). */
export function welchTTest(
  groupA: number[],
  groupB: number[],
): TTestResult {
  return withSpan("welch-t-test", "statistics", () => {
    const mA = mean(groupA);
    const mB = mean(groupB);
    const vA = variance(groupA);
    const vB = variance(groupB);
    const nA = groupA.length;
    const nB = groupB.length;

    const denom = Math.sqrt(vA / nA + vB / nB);
    const tStat = denom === 0 ? 0 : (mA - mB) / denom;
    const df =
      denom === 0 ? nA + nB - 2 : welchSatterthwaite(vA, nA, vB, nB);
    const pValue =
      tStat === 0 ? 1 : 2 * (1 - tDistributionCDF(Math.abs(tStat), df));

    return {
      tStatistic: tStat,
      degreesOfFreedom: df,
      pValue,
      significant: pValue <= 0.05,
      meanA: mA,
      meanB: mB,
      sdA: standardDeviation(groupA),
      sdB: standardDeviation(groupB),
    };
  });
}

// ---------------------------------------------------------------------------
// Cohen's d effect size
// ---------------------------------------------------------------------------

/** Cohen's d: standardized mean difference using pooled SD. */
export function cohensD(groupA: number[], groupB: number[]): number {
  const mA = mean(groupA);
  const mB = mean(groupB);
  const vA = variance(groupA);
  const vB = variance(groupB);
  const pooledSd = Math.sqrt((vA + vB) / 2);
  if (pooledSd === 0) return 0;
  return (mA - mB) / pooledSd;
}

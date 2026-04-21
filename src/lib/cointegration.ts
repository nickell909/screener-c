// Statistical Analysis Engine for Cointegration Testing
// All functions use real mathematical implementations

export interface CointegrationResult {
  symbol1: string;
  symbol2: string;
  pValue: number;
  adfStatistic: number;
  hedgeRatio: number;
  intercept: number;
  halfLife: number;
  correlation: number;
  cointegrated: boolean;
  residuals: number[];
}

export interface ADFResult {
  statistic: number;
  pValue: number;
  isStationary: boolean;
  criticalValues: {
    1: number;
    5: number;
    10: number;
  };
}

// OLS Linear Regression: y = slope * x + intercept
export function olsRegression(
  y: number[],
  x: number[]
): { slope: number; intercept: number; residuals: number[] } {
  const n = Math.min(y.length, x.length);
  if (n < 2) {
    return { slope: 0, intercept: 0, residuals: [] };
  }

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (Math.abs(denominator) < 1e-12) {
    return { slope: 0, intercept: sumY / n, residuals: y.map((v) => v - sumY / n) };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  const residuals: number[] = [];
  for (let i = 0; i < n; i++) {
    residuals.push(y[i] - (slope * x[i] + intercept));
  }

  return { slope, intercept, residuals };
}

// Calculate the mean of an array
function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

// Calculate the variance of an array (sample variance)
function variance(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
}

// Calculate standard deviation
function stdDev(arr: number[]): number {
  return Math.sqrt(variance(arr));
}

/**
 * Augmented Dickey-Fuller test for stationarity.
 *
 * Uses the Frisch-Waugh-Lovell (FWL) theorem for numerical stability:
 * 1. Regress Δy(t) on lagged differences → get residual Δỹ(t)
 * 2. Regress y(t-1) on lagged differences → get residual ỹ(t-1)
 * 3. Regress Δỹ(t) on ỹ(t-1) → the t-stat of the slope is the ADF statistic
 *
 * This avoids full matrix inversion and is much more robust.
 */
export function adfTest(series: number[], maxLags?: number): ADFResult {
  const n = series.length;
  const criticalValues = {
    1: -3.43,
    5: -2.86,
    10: -2.57,
  };

  if (n < 25) {
    return {
      statistic: 0,
      pValue: 1.0,
      isStationary: false,
      criticalValues,
    };
  }

  // Calculate first differences: Δy(t) = y(t) - y(t-1)
  const dy: number[] = [];
  for (let i = 1; i < n; i++) {
    dy.push(series[i] - series[i - 1]);
  }

  // Lagged level: y(t-1)
  const yLagged: number[] = series.slice(0, n - 1);

  // Determine max lag length (Schwert criterion, capped at 8 for stability)
  const maxL = maxLags ?? Math.min(Math.floor(Math.sqrt(n)), 8);

  // Try ADF with decreasing lags until we find one that works
  for (let lags = maxL; lags >= 0; lags--) {
    const effectiveLen = dy.length - lags;
    if (effectiveLen < 15) continue;

    // Dependent variable: Δy(t) for t from (lags+1) to end
    const depVar = dy.slice(lags);

    // Independent variable: y(t-1) for t from (lags+1) to end
    const yIndep = yLagged.slice(lags);

    if (lags === 0) {
      // Simple DF test: Δy(t) = α * y(t-1) + error
      const result = olsRegression(depVar, yIndep);
      const residuals = result.residuals;
      const residualVariance = residuals.reduce((s, r) => s + r * r, 0) / (effectiveLen - 2);
      const yIndepVariance = yIndep.reduce((s, v) => s + (v - mean(yIndep)) ** 2, 0);

      if (yIndepVariance < 1e-12) continue;

      const seSlope = Math.sqrt(residualVariance / yIndepVariance);
      if (seSlope < 1e-12) continue;

      const tStatistic = result.slope / seSlope;
      const pValue = approximateADFPValue(tStatistic);

      return {
        statistic: tStatistic,
        pValue,
        isStationary: tStatistic < criticalValues[5],
        criticalValues,
      };
    }

    // ADF with lags using Frisch-Waugh-Lovell theorem
    // Build lagged differences: Δy(t-j) for j=1..lags
    // CRITICAL: must start from i = lags so that laggedDiffs[j][i] aligns with depVar[i]
    const laggedDiffs: number[][] = [];
    for (let lag = 1; lag <= lags; lag++) {
      const diffLag: number[] = [];
      for (let i = lags; i < dy.length; i++) {
        diffLag.push(dy[i - lag]);
      }
      laggedDiffs.push(diffLag);
    }

    // Step 1 (FWL): Regress Δy(t) on lagged differences, get residuals
    const dyResiduals = partialOut(laggedDiffs, depVar);

    // Step 2 (FWL): Regress y(t-1) on lagged differences, get residuals
    const yResiduals = partialOut(laggedDiffs, yIndep);

    if (!dyResiduals || !yResiduals) continue;

    // Step 3 (FWL): Regress dyResiduals on yResiduals
    const finalResult = olsRegression(dyResiduals, yResiduals);
    const finalResiduals = finalResult.residuals;

    // The effective degrees of freedom: effectiveLen - (lags + 1) for the lagged diffs and intercept
    const df = effectiveLen - lags - 1;
    if (df < 5) continue;

    const residualVariance = finalResiduals.reduce((s, r) => s + r * r, 0) / (df - 1);
    const yResVariance = yResiduals.reduce((s, v) => s + (v - mean(yResiduals)) ** 2, 0);

    if (yResVariance < 1e-12) continue;

    const seSlope = Math.sqrt(residualVariance / yResVariance);
    if (seSlope < 1e-12) continue;

    const tStatistic = finalResult.slope / seSlope;
    const pValue = approximateADFPValue(tStatistic);

    return {
      statistic: tStatistic,
      pValue,
      isStationary: tStatistic < criticalValues[5],
      criticalValues,
    };
  }

  // Ultimate fallback: simple DF test
  const result = olsRegression(dy, yLagged);
  const residuals = result.residuals;
  const residualVariance = residuals.reduce((s, r) => s + r * r, 0) / (dy.length - 2);
  const yLagVariance = yLagged.reduce((s, v) => s + (v - mean(yLagged)) ** 2, 0);

  if (yLagVariance < 1e-12) {
    return { statistic: 0, pValue: 1.0, isStationary: false, criticalValues };
  }

  const seSlope = Math.sqrt(residualVariance / yLagVariance);
  const tStatistic = seSlope > 0 ? result.slope / seSlope : 0;

  return {
    statistic: tStatistic,
    pValue: approximateADFPValue(tStatistic),
    isStationary: tStatistic < criticalValues[5],
    criticalValues,
  };
}

/**
 * Frisch-Waugh-Lovell partial out: regress y on X and return residuals.
 * Uses sequential Gram-Schmidt orthogonalization (no matrix inversion needed).
 *
 * @param X - Array of regressor arrays (each inner array is one regressor)
 * @param y - Dependent variable array
 * @returns Residuals of y after removing the effect of X, or null if failed
 */
function partialOut(X: number[][], y: number[]): number[] | null {
  if (X.length === 0) return [...y];

  const n = y.length;
  if (n < X.length + 2) return null;

  // Start with y as the residual
  let residual = [...y];

  // Sequentially project out each regressor (Gram-Schmidt)
  // First, also orthogonalize the regressors among themselves
  const orthogonalX: number[][] = [];
  const norms: number[] = [];

  for (let k = 0; k < X.length; k++) {
    let xk = [...X[k]];

    // Remove projections onto previously orthogonalized regressors
    for (let j = 0; j < orthogonalX.length; j++) {
      const dot = dotProduct(xk, orthogonalX[j]);
      const norm2 = norms[j] * norms[j];
      if (norm2 < 1e-15) return null;

      for (let i = 0; i < n; i++) {
        xk[i] -= (dot / norm2) * orthogonalX[j][i];
      }
    }

    const norm = Math.sqrt(dotProduct(xk, xk));
    if (norm < 1e-10) {
      // This regressor is linearly dependent on previous ones, skip it
      continue;
    }

    orthogonalX.push(xk);
    norms.push(norm);

    // Remove the projection of residual onto this orthogonal regressor
    const dotRes = dotProduct(residual, xk);
    const norm2 = norm * norm;

    for (let i = 0; i < n; i++) {
      residual[i] -= (dotRes / norm2) * xk[i];
    }
  }

  return residual;
}

function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

// Approximate p-value for ADF test statistic
// Uses interpolation based on MacKinnon (2010) approximate critical values
function approximateADFPValue(testStat: number): number {
  // Approximate p-value using a lookup table approach
  // These are approximate points for the ADF distribution (no trend, with constant)
  const table: [number, number][] = [
    [-5.0, 0.00001],
    [-4.5, 0.00005],
    [-4.0, 0.0003],
    [-3.8, 0.0007],
    [-3.6, 0.0015],
    [-3.43, 0.01],
    [-3.3, 0.018],
    [-3.15, 0.03],
    [-3.0, 0.045],
    [-2.86, 0.05],
    [-2.7, 0.075],
    [-2.57, 0.10],
    [-2.4, 0.14],
    [-2.2, 0.20],
    [-2.0, 0.28],
    [-1.8, 0.38],
    [-1.6, 0.48],
    [-1.4, 0.58],
    [-1.2, 0.67],
    [-1.0, 0.76],
    [-0.8, 0.83],
    [-0.5, 0.91],
    [0.0, 0.98],
    [1.0, 0.999],
  ];

  // Linear interpolation
  if (testStat <= table[0][0]) return table[0][1];
  if (testStat >= table[table.length - 1][0]) return table[table.length - 1][1];

  for (let i = 0; i < table.length - 1; i++) {
    if (testStat >= table[i][0] && testStat <= table[i + 1][0]) {
      const t =
        (testStat - table[i][0]) / (table[i + 1][0] - table[i][0]);
      return table[i][1] + t * (table[i + 1][1] - table[i][1]);
    }
  }

  return 0.5;
}

// Calculate half-life of mean reversion
export function calculateHalfLife(spread: number[]): number {
  if (spread.length < 10) return Infinity;

  const n = spread.length;

  // Regress: Δspread(t) = β * spread(t-1) + error
  const y: number[] = [];
  const x: number[] = [];

  for (let i = 1; i < n; i++) {
    y.push(spread[i] - spread[i - 1]);
    x.push(spread[i - 1]);
  }

  const result = olsRegression(y, x);

  // If beta is positive or very close to zero, no mean reversion
  if (result.slope >= 0) return Infinity;

  // Half-life = -ln(2) / beta
  const halfLife = -Math.log(2) / result.slope;

  // Sanity check - if halfLife is unreasonably large, return Infinity
  if (halfLife > n * 10) return Infinity;

  return halfLife;
}

// Calculate Pearson correlation coefficient
export function correlation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;

  const meanX = mean(x.slice(0, n));
  const meanY = mean(y.slice(0, n));

  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    sumXY += dx * dy;
    sumX2 += dx * dx;
    sumY2 += dy * dy;
  }

  const denominator = Math.sqrt(sumX2 * sumY2);
  if (denominator < 1e-12) return 0;

  return sumXY / denominator;
}

// Engle-Granger cointegration test
export function engleGrangerTest(
  y: number[],
  x: number[]
): {
  cointegrated: boolean;
  pValue: number;
  adfStatistic: number;
  hedgeRatio: number;
  intercept: number;
  residuals: number[];
  halfLife: number;
} {
  const n = Math.min(y.length, x.length);
  const minLen = 30;

  if (n < minLen) {
    return {
      cointegrated: false,
      pValue: 1.0,
      adfStatistic: 0,
      hedgeRatio: 0,
      intercept: 0,
      residuals: [],
      halfLife: Infinity,
    };
  }

  // Step 1: Run OLS regression y = hedgeRatio * x + intercept
  const ols = olsRegression(y.slice(0, n), x.slice(0, n));

  // Step 2: Test residuals for stationarity using ADF test
  const adf = adfTest(ols.residuals);

  // Step 3: Calculate half-life
  const halfLife = calculateHalfLife(ols.residuals);

  return {
    cointegrated: adf.isStationary,
    pValue: adf.pValue,
    adfStatistic: adf.statistic,
    hedgeRatio: ols.slope,
    intercept: ols.intercept,
    residuals: ols.residuals,
    halfLife,
  };
}

// Batch cointegration scan - find all cointegrated pairs from a price matrix
export function scanCointegration(
  symbols: string[],
  priceMatrix: number[][],
  significanceLevel: number = 0.05
): CointegrationResult[] {
  const results: CointegrationResult[] = [];
  const n = symbols.length;

  if (n < 2) return results;

  // Check each pair
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const prices1 = priceMatrix[i];
      const prices2 = priceMatrix[j];

      if (!prices1 || !prices2 || prices1.length < 30 || prices2.length < 30) {
        continue;
      }

      const minLen = Math.min(prices1.length, prices2.length);
      const y = prices1.slice(0, minLen);
      const x = prices2.slice(0, minLen);

      // Calculate correlation first as a quick filter
      const corr = correlation(y, x);

      // Skip pairs with very low correlation (unlikely to be cointegrated)
      if (Math.abs(corr) < 0.3) continue;

      // Run Engle-Granger test in both directions
      const test1 = engleGrangerTest(y, x);
      const test2 = engleGrangerTest(x, y);

      // Use the direction with the lower p-value
      const bestTest = test1.pValue <= test2.pValue ? test1 : test2;
      const symbol1 = test1.pValue <= test2.pValue ? symbols[i] : symbols[j];
      const symbol2 = test1.pValue <= test2.pValue ? symbols[j] : symbols[i];

      results.push({
        symbol1,
        symbol2,
        pValue: bestTest.pValue,
        adfStatistic: bestTest.adfStatistic,
        hedgeRatio: bestTest.hedgeRatio,
        intercept: bestTest.intercept,
        halfLife: bestTest.halfLife,
        correlation: corr,
        cointegrated: bestTest.pValue <= significanceLevel,
        residuals: bestTest.residuals,
      });
    }
  }

  return results;
}

// Calculate z-score of a series
export function zScore(series: number[]): number[] {
  if (series.length < 2) return series.map(() => 0);

  const m = mean(series);
  const sd = stdDev(series);

  if (sd < 1e-12) return series.map(() => 0);

  return series.map((v) => (v - m) / sd);
}

// Calculate spread from two price series with hedge ratio
export function calculateSpread(
  y: number[],
  x: number[],
  hedgeRatio: number,
  intercept: number
): number[] {
  const n = Math.min(y.length, x.length);
  const spread: number[] = [];

  for (let i = 0; i < n; i++) {
    spread.push(y[i] - hedgeRatio * x[i] - intercept);
  }

  return spread;
}

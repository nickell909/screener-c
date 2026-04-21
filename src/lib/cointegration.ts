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

// Augmented Dickey-Fuller test for stationarity
export function adfTest(series: number[], maxLags?: number): ADFResult {
  const n = series.length;
  const criticalValues = {
    1: -3.43,
    5: -2.86,
    10: -2.57,
  };

  if (n < 20) {
    return {
      statistic: 0,
      pValue: 1.0,
      isStationary: false,
      criticalValues,
    };
  }

  // Determine the number of lags
  const lags = maxLags ?? Math.min(Math.floor(12 * Math.pow(n / 100, 1 / 4)), n - 3);

  if (lags >= n - 2) {
    return {
      statistic: 0,
      pValue: 1.0,
      isStationary: false,
      criticalValues,
    };
  }

  // Calculate first differences
  const dy: number[] = [];
  for (let i = 1; i < n; i++) {
    dy.push(series[i] - series[i - 1]);
  }

  // Lagged level (y(t-1))
  const yLagged: number[] = series.slice(0, n - 1);

  // Lagged differences
  const laggedDiffs: number[][] = [];
  for (let lag = 1; lag <= lags; lag++) {
    const diffLag: number[] = [];
    for (let i = lag; i < dy.length; i++) {
      diffLag.push(dy[i - lag]);
    }
    laggedDiffs.push(diffLag);
  }

  // Align all arrays - the effective length after accounting for lags
  const effectiveLen = dy.length - lags;
  if (effectiveLen < 10) {
    return {
      statistic: 0,
      pValue: 1.0,
      isStationary: false,
      criticalValues,
    };
  }

  // Dependent variable: dy from index lags to end
  const depVar = dy.slice(lags);

  // Independent variables: yLagged from index lags to end, plus lagged differences
  // Build the regression: dy(t) = alpha * y(t-1) + sum(beta_i * dy(t-i)) + error

  // For simplicity with OLS, we'll do a simple regression of dy on yLagged
  // with lagged differences as additional regressors

  if (lags === 0) {
    // Simple DF test: dy(t) = alpha * y(t-1) + error
    const yIndep = yLagged.slice(lags);
    const result = olsRegression(depVar, yIndep);

    // Calculate the standard error of the slope coefficient
    const residuals = result.residuals;
    const residualVariance = residuals.reduce((s, r) => s + r * r, 0) / (effectiveLen - 2);
    const yIndepVariance = yIndep.reduce((s, v) => s + (v - mean(yIndep)) ** 2, 0);
    const seSlope = Math.sqrt(residualVariance / (yIndepVariance || 1));

    const tStatistic = seSlope > 0 ? result.slope / seSlope : 0;

    // Approximate p-value using interpolation
    const pValue = approximateADFPValue(tStatistic);

    return {
      statistic: tStatistic,
      pValue,
      isStationary: tStatistic < criticalValues[5],
      criticalValues,
    };
  }

  // ADF with lags: use multiple regression approach
  // dy(t) = alpha * y(t-1) + sum(beta_i * dy(t-i)) + error
  // We'll use an iterative approach: first regress out the lagged differences, then test

  // Build the X matrix columns (as arrays)
  const yIndep = yLagged.slice(lags);

  // Multiple OLS regression using normal equations
  // Variables: [1, y(t-1), dy(t-1), dy(t-2), ..., dy(t-lags)]
  const numVars = 2 + lags; // intercept + y(t-1) + lagged diffs

  // Build design matrix
  const X: number[][] = [];
  for (let i = 0; i < effectiveLen; i++) {
    const row: number[] = [1, yIndep[i]];
    for (let lag = 0; lag < lags; lag++) {
      row.push(laggedDiffs[lag][i]);
    }
    X.push(row);
  }

  // Solve using normal equations: beta = (X'X)^-1 X'y
  const beta = solveLinearRegression(X, depVar);

  // Calculate residuals
  const residuals: number[] = [];
  for (let i = 0; i < effectiveLen; i++) {
    let predicted = 0;
    for (let j = 0; j < numVars; j++) {
      predicted += beta[j] * X[i][j];
    }
    residuals.push(depVar[i] - predicted);
  }

  // Calculate standard error of the coefficient on y(t-1) (index 1)
  const residualSS = residuals.reduce((s, r) => s + r * r, 0);
  const residualVariance = residualSS / (effectiveLen - numVars);

  // Calculate (X'X)^-1
  const XtX = multiplyMatrices(transpose(X), X);
  const XtXInv = invertMatrix(XtX);

  if (XtXInv === null) {
    return {
      statistic: 0,
      pValue: 1.0,
      isStationary: false,
      criticalValues,
    };
  }

  const seAlpha = Math.sqrt(Math.abs(residualVariance * XtXInv[1][1]));

  const tStatistic = seAlpha > 0 ? beta[1] / seAlpha : 0;
  const pValue = approximateADFPValue(tStatistic);

  return {
    statistic: tStatistic,
    pValue,
    isStationary: tStatistic < criticalValues[5],
    criticalValues,
  };
}

// Approximate p-value for ADF test statistic
// Uses interpolation based on MacKinnon (2010) approximate critical values
function approximateADFPValue(testStat: number): number {
  // Approximate p-value using a lookup table approach
  // These are approximate points for the ADF distribution (no trend, with constant)
  const table: [number, number][] = [
    [-4.0, 0.0001],
    [-3.8, 0.0003],
    [-3.6, 0.0007],
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

// --- Matrix utility functions for multiple regression ---

function transpose(matrix: number[][]): number[][] {
  if (matrix.length === 0) return [];
  const rows = matrix.length;
  const cols = matrix[0].length;
  const result: number[][] = [];
  for (let j = 0; j < cols; j++) {
    result[j] = [];
    for (let i = 0; i < rows; i++) {
      result[j][i] = matrix[i][j];
    }
  }
  return result;
}

function multiplyMatrices(a: number[][], b: number[][]): number[][] {
  const aRows = a.length;
  const aCols = a[0]?.length ?? 0;
  const bRows = b.length;
  const bCols = b[0]?.length ?? 0;

  if (aCols !== bRows) return [];

  const result: number[][] = [];
  for (let i = 0; i < aRows; i++) {
    result[i] = [];
    for (let j = 0; j < bCols; j++) {
      let sum = 0;
      for (let k = 0; k < aCols; k++) {
        sum += a[i][k] * b[k][j];
      }
      result[i][j] = sum;
    }
  }
  return result;
}

// Invert a matrix using Gauss-Jordan elimination
function invertMatrix(matrix: number[][]): number[][] | null {
  const n = matrix.length;
  if (n === 0) return null;

  // Create augmented matrix [A | I]
  const aug: number[][] = [];
  for (let i = 0; i < n; i++) {
    aug[i] = [...matrix[i]];
    for (let j = 0; j < n; j++) {
      aug[i].push(i === j ? 1 : 0);
    }
  }

  // Forward elimination with partial pivoting
  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxRow = col;
    let maxVal = Math.abs(aug[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > maxVal) {
        maxVal = Math.abs(aug[row][col]);
        maxRow = row;
      }
    }

    if (maxVal < 1e-12) return null; // Singular matrix

    // Swap rows
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    // Scale pivot row
    const pivotVal = aug[col][col];
    for (let j = 0; j < 2 * n; j++) {
      aug[col][j] /= pivotVal;
    }

    // Eliminate column
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = 0; j < 2 * n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  // Extract inverse
  const inverse: number[][] = [];
  for (let i = 0; i < n; i++) {
    inverse[i] = aug[i].slice(n);
  }

  return inverse;
}

// Solve linear regression using normal equations: beta = (X'X)^-1 X'y
function solveLinearRegression(X: number[][], y: number[]): number[] {
  const n = X.length;
  if (n === 0) return [];
  const p = X[0].length;

  const XtX = multiplyMatrices(transpose(X), X);
  const XtY: number[] = [];
  const Xt = transpose(X);

  for (let j = 0; j < p; j++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += Xt[j][i] * y[i];
    }
    XtY.push(sum);
  }

  const XtXInv = invertMatrix(XtX);
  if (XtXInv === null) {
    // Fallback: return zeros
    return new Array(p).fill(0);
  }

  const beta: number[] = [];
  for (let i = 0; i < p; i++) {
    let sum = 0;
    for (let j = 0; j < p; j++) {
      sum += XtXInv[i][j] * XtY[j];
    }
    beta.push(sum);
  }

  return beta;
}

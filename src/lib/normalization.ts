// Data normalization utilities

/**
 * Z-score normalization: (x - mean) / std
 */
export function normalizeZScore(data: number[]): number[] {
  if (data.length < 2) return data.map(() => 0);

  const mean = data.reduce((s, v) => s + v, 0) / data.length;
  const variance =
    data.reduce((s, v) => s + (v - mean) ** 2, 0) / (data.length - 1);
  const std = Math.sqrt(variance);

  if (std < 1e-12) return data.map(() => 0);

  return data.map((v) => (v - mean) / std);
}

/**
 * Min-max normalization to [0, 1]
 */
export function normalizeMinMax(data: number[]): number[] {
  if (data.length === 0) return [];

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;

  if (range < 1e-12) return data.map(() => 0.5);

  return data.map((v) => (v - min) / range);
}

/**
 * Percent change normalization
 * Returns (n-1) values representing percent changes
 */
export function normalizePercentChange(prices: number[]): number[] {
  if (prices.length < 2) return [];

  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (Math.abs(prices[i - 1]) < 1e-12) {
      changes.push(0);
    } else {
      changes.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
  }

  return changes;
}

/**
 * Align two time series by timestamp
 * Returns aligned arrays of values that have matching timestamps
 */
export function alignSeries(
  series1: { timestamp: number; value: number }[],
  series2: { timestamp: number; value: number }[]
): [number[], number[]] {
  // Create maps for fast lookup
  const map1 = new Map<number, number>();
  const map2 = new Map<number, number>();

  for (const item of series1) {
    map1.set(item.timestamp, item.value);
  }

  for (const item of series2) {
    map2.set(item.timestamp, item.value);
  }

  // Find common timestamps
  const commonTimestamps: number[] = [];
  for (const ts of map1.keys()) {
    if (map2.has(ts)) {
      commonTimestamps.push(ts);
    }
  }

  // Sort timestamps
  commonTimestamps.sort((a, b) => a - b);

  // Build aligned arrays
  const aligned1: number[] = [];
  const aligned2: number[] = [];

  for (const ts of commonTimestamps) {
    aligned1.push(map1.get(ts)!);
    aligned2.push(map2.get(ts)!);
  }

  return [aligned1, aligned2];
}

/**
 * Align multiple time series by timestamp
 * Returns a matrix of aligned values and the list of common timestamps
 */
export function alignMultipleSeries(
  series: { timestamp: number; value: number }[][]
): { timestamps: number[]; values: number[][] } {
  if (series.length === 0) return { timestamps: [], values: [] };

  // Start with all timestamps from the first series
  let commonTimestamps = new Set(series[0].map((s) => s.timestamp));

  // Intersect with all other series
  for (let i = 1; i < series.length; i++) {
    const tsSet = new Set(series[i].map((s) => s.timestamp));
    commonTimestamps = new Set(
      [...commonTimestamps].filter((ts) => tsSet.has(ts))
    );
  }

  const sortedTimestamps = [...commonTimestamps].sort((a, b) => a - b);

  // Create maps for each series
  const maps = series.map((s) => {
    const m = new Map<number, number>();
    for (const item of s) {
      m.set(item.timestamp, item.value);
    }
    return m;
  });

  // Build aligned value matrix
  const values: number[][] = maps.map((m) =>
    sortedTimestamps.map((ts) => m.get(ts) ?? 0)
  );

  return { timestamps: sortedTimestamps, values };
}

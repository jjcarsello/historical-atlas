/** A year for which the dataset has a world borders map. Negative years are BC. */
export interface Snapshot {
  year: number;
  file: string;
}

const YEARS = [
  -123000, -10000, -8000, -5000, -4000, -3000, -2000, -1500, -1000, -700, -500, -400, -323, -300,
  -200, -100, -1, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1279, 1300, 1400,
  1492, 1500, 1530, 1600, 1650, 1700, 1715, 1783, 1800, 1815, 1878, 1880, 1900, 1914, 1920, 1930,
  1938, 1945, 1960, 1994, 2000, 2010,
];

export const SNAPSHOTS: Snapshot[] = YEARS.map((year) => ({
  year,
  file: year < 0 ? `world_bc${-year}.geojson` : `world_${year}.geojson`,
}));

export const DATA_BASE_URL =
  'https://cdn.jsdelivr.net/gh/aourednik/historical-basemaps@master/geojson/';

export function formatYear(year: number): string {
  return year < 0 ? `${(-year).toLocaleString()} BC` : `AD ${year}`;
}

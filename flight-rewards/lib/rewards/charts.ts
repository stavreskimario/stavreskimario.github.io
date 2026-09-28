import chartData from "../../data/reward-charts.json";
import type { Cabin, ProgramId, RewardChartVersion } from "../types";
export const rewardCharts = chartData as RewardChartVersion[];
export function findChart(
  program: ProgramId,
  group: string,
  bookingDate: string,
): RewardChartVersion | undefined {
  return rewardCharts.find(
    (c) =>
      c.program === program &&
      c.group === group &&
      c.effectiveFrom <= bookingDate &&
      (!c.effectiveTo || bookingDate <= c.effectiveTo),
  );
}
export function lookup(
  chart: RewardChartVersion,
  distance: number,
  cabin: Cabin,
) {
  const zone = chart.zones.find((z) => Math.round(distance) <= z.maxMiles);
  const points = zone?.prices[cabin];
  return points === undefined
    ? null
    : { minimum: points, maximum: zone?.maximum?.[cabin] ?? points };
}
export interface PriceResult {
  minimum: number | null;
  maximum: number | null;
  versions: string[];
  notes: string[];
}

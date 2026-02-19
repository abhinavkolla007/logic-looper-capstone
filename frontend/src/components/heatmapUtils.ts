import dayjs from 'dayjs'
import type { DailyActivity } from '../storage/storageManager'
import {
  buildHeatmapCellsForYear,
  calculateIntensityFromActivity,
  splitIntoWeeks,
  type CoreHeatmapCellData,
} from '../lib/engagementCore'

export type HeatmapCellData = CoreHeatmapCellData

export function calculateIntensity(activity?: DailyActivity): 0 | 1 | 2 | 3 | 4 {
  return calculateIntensityFromActivity(activity)
}

export function buildHeatmapCells(activities: DailyActivity[], year = dayjs().year()): HeatmapCellData[] {
  return buildHeatmapCellsForYear(activities, year)
}

export function splitWeeks(cells: HeatmapCellData[]): HeatmapCellData[][] {
  return splitIntoWeeks(cells, 7)
}

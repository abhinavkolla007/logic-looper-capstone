import { memo } from 'react'
import dayjs from 'dayjs'
import type { HeatmapCellData } from './heatmapUtils'

const intensityClass: Record<number, string> = {
  0: 'bg-[#F6F5F5]',
  1: 'bg-[#C2D9FF]',
  2: 'bg-[#BFCFE7]',
  3: 'bg-[#7752FE]',
  4: 'bg-[#414BEA]',
}

interface Props {
  cell: HeatmapCellData
  isToday: boolean
  revealIndex: number
  isMilestonePulse?: boolean
  onHover?: (cell: HeatmapCellData | null) => void
}

function HeatmapCellBase({ cell, isToday, revealIndex, isMilestonePulse = false, onHover }: Props) {
  const title = cell.solved
    ? `${cell.date} | score ${cell.score} | ${(cell.timeTaken / 1000).toFixed(1)}s | diff ${cell.difficulty}`
    : `${cell.date} | not completed`

  return (
    <div
      className={`h-3 w-3 rounded-sm ${isToday ? 'ring-1 ring-[#190482]' : ''} ${isMilestonePulse ? 'animate-pulse' : ''} ${intensityClass[cell.intensity]}`}
      style={{
        opacity: 1,
        transform: isToday && cell.solved ? 'scale(1.12)' : 'scale(1)',
        transition: `transform ${isToday && cell.solved ? 600 : 250}ms ease ${Math.min(revealIndex * 2, 250)}ms`,
      }}
      title={title}
      aria-label={`Heatmap ${dayjs(cell.date).format('MMM D')}`}
      onMouseEnter={() => onHover?.(cell)}
      onMouseLeave={() => onHover?.(null)}
    />
  )
}

export const HeatmapCell = memo(HeatmapCellBase)

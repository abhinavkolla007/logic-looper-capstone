import { memo } from 'react'
import { HeatmapCell } from './HeatmapCell'
import type { HeatmapCellData } from './heatmapUtils'

interface Props {
  week: HeatmapCellData[]
  today: string
  weekIndex: number
  milestoneDate?: string | null
  onHover?: (cell: HeatmapCellData | null) => void
}

function HeatmapColumnBase({ week, today, weekIndex, milestoneDate, onHover }: Props) {
  return (
    <div className="grid gap-1 grid-rows-7">
      {week.map((cell, dayIndex) => (
        <HeatmapCell
          key={cell.date}
          cell={cell}
          isToday={cell.date === today}
          revealIndex={weekIndex * 7 + dayIndex}
          isMilestonePulse={Boolean(milestoneDate && cell.date === milestoneDate)}
          onHover={onHover}
        />
      ))}
    </div>
  )
}

export const HeatmapColumn = memo(HeatmapColumnBase)

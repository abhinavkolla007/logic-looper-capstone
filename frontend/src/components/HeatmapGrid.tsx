import { HeatmapColumn } from './HeatmapColumn'
import type { HeatmapCellData } from './heatmapUtils'

interface Props {
  weeks: HeatmapCellData[][]
  today: string
  milestoneDate?: string | null
  onHover?: (cell: HeatmapCellData | null) => void
}

export default function HeatmapGrid({ weeks, today, milestoneDate, onHover }: Props) {
  return (
    <div className="overflow-x-auto">
      <div className="inline-grid gap-1" style={{ gridTemplateColumns: `repeat(${weeks.length}, 1fr)` }}>
        {weeks.map((week, idx) => (
          <HeatmapColumn
            key={week[0]?.date ?? `week-${idx}`}
            week={week}
            today={today}
            weekIndex={idx}
            milestoneDate={milestoneDate}
            onHover={onHover}
          />
        ))}
      </div>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '../features/store'
import dayjs from 'dayjs'
import HeatmapGrid from './HeatmapGrid'
import { buildHeatmapCells, splitWeeks, type HeatmapCellData } from './heatmapUtils'
import { storageManager, type DailyActivity } from '../storage/storageManager'

export default function HeatmapView() {
  const fallbackHeatmapData = useSelector((state: RootState) => state.game.heatmapData)
  const streak = useSelector((state: RootState) => state.game.streak)
  const currentYear = dayjs().year()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [yearData, setYearData] = useState<DailyActivity[]>(fallbackHeatmapData)
  const [hoveredCell, setHoveredCell] = useState<HeatmapCellData | null>(null)
  const userId = localStorage.getItem('userId') || localStorage.getItem('guestId') || 'guest'

  useEffect(() => {
    const loadYear = async () => {
      const data = await storageManager.getActivitiesByYear(userId, selectedYear)
      setYearData(data)
    }
    void loadYear()
  }, [selectedYear, userId])

  const cells = useMemo(() => buildHeatmapCells(yearData, selectedYear), [yearData, selectedYear])
  const weeks = useMemo(() => splitWeeks(cells), [cells])
  const today = dayjs().format('YYYY-MM-DD')
  const todayCell = useMemo(() => cells.find((cell) => cell.date === today), [cells, today])
  const milestoneDate = useMemo(() => {
    const milestones = new Set([7, 30, 100, 365])
    if (!todayCell?.solved) return null
    if (!streak || !milestones.has(streak.current)) return null
    return today
  }, [streak, today, todayCell?.solved])
  const yearOptions = useMemo(() => [currentYear - 1, currentYear, currentYear + 1], [currentYear])
  const completionCount = useMemo(() => cells.filter((cell) => cell.solved).length, [cells])

  const handleDownloadHeatmapImage = () => {
    const cellSize = 10
    const gap = 2
    const padding = 16
    const width = padding * 2 + weeks.length * (cellSize + gap)
    const height = padding * 2 + 7 * (cellSize + gap) + 30
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const colorMap: Record<number, string> = {
      0: '#F6F5F5',
      1: '#C2D9FF',
      2: '#BFCFE7',
      3: '#7752FE',
      4: '#414BEA',
    }

    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = '#190482'
    ctx.font = 'bold 12px sans-serif'
    ctx.fillText(`Logic Looper ${selectedYear} - ${completionCount} days solved`, padding, 12)

    weeks.forEach((week, x) => {
      week.forEach((cell, y) => {
        const px = padding + x * (cellSize + gap)
        const py = padding + y * (cellSize + gap) + 12
        ctx.fillStyle = colorMap[cell.intensity]
        ctx.fillRect(px, py, cellSize, cellSize)
      })
    })

    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = `logic-looper-streak-${selectedYear}.png`
    link.click()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-[#190482]">{cells.length}-Day Activity</h3>
        <div className="flex items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="text-xs rounded-md border border-[#C2D9FF] bg-white px-2 py-1 text-[#190482]"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleDownloadHeatmapImage}
            className="text-xs rounded-md border border-[#C2D9FF] bg-white px-2 py-1 text-[#190482] hover:bg-[#F6F5F5]"
          >
            Share as Image
          </button>
        </div>
      </div>

      <HeatmapGrid weeks={weeks} today={today} milestoneDate={milestoneDate} onHover={setHoveredCell} />

      <div className="rounded-md border border-[#C2D9FF] bg-white px-3 py-2 text-xs text-[#3D3B40]">
        {hoveredCell ? (
          <span>
            {hoveredCell.date} - Score: {hoveredCell.score} - Time: {(hoveredCell.timeTaken / 1000).toFixed(1)}s - Difficulty: {hoveredCell.difficulty}
          </span>
        ) : (
          <span>Hover a day to see details.</span>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-[#3D3B40]">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`h-2 w-2 rounded-sm ${
              level === 0
                ? 'bg-[#F6F5F5]'
                : level === 1
                  ? 'bg-[#C2D9FF]'
                  : level === 2
                    ? 'bg-[#BFCFE7]'
                    : level === 3
                      ? 'bg-[#7752FE]'
                      : 'bg-[#414BEA]'
            }`}
            title={`Intensity ${level}`}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}

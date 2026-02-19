import { render, screen } from '@testing-library/react'
import { HeatmapCell } from './HeatmapCell'

describe('HeatmapCell (Jest)', () => {
  it('renders with label/title and today ring when active', () => {
    render(
      <HeatmapCell
        isToday
        revealIndex={3}
        cell={{
          date: '2026-02-19',
          solved: true,
          score: 98,
          timeTaken: 32000,
          difficulty: 3,
          intensity: 3,
        }}
      />
    )

    const cell = screen.getByLabelText('Heatmap Feb 19')
    expect(cell).toBeTruthy()
    expect(cell.getAttribute('title')).toBe('2026-02-19 | score 98 | 32.0s | diff 3')
    expect(cell.className).toContain('ring-1')
  })
})

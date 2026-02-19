import { describe, expect, it, vi } from 'vitest'

const renderMock = vi.fn()

vi.mock('react-dom/client', () => ({
  default: {
    createRoot: vi.fn(() => ({ render: renderMock })),
  },
  createRoot: vi.fn(() => ({ render: renderMock })),
}))

vi.mock('./App', () => ({
  default: () => null,
}))

describe('main entry', () => {
  it('mounts React app', async () => {
    const root = document.createElement('div')
    root.id = 'root'
    document.body.appendChild(root)

    await import('./main')
    expect(renderMock).toHaveBeenCalled()
  })
})

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import BootstrapApp from './bootstrapApp'

vi.mock('./App', () => ({
  default: () => <div>App Root Mock</div>,
}))

describe('BootstrapApp', () => {
  it('renders app root within provider tree', () => {
    render(<BootstrapApp />)
    expect(screen.getByText('App Root Mock')).toBeTruthy()
  })
})

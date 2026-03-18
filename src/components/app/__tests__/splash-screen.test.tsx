import { render, screen } from '@testing-library/react'
import SplashScreen from '../splash-screen'

describe('splashScreen', () => {
  it('renders the app logo', () => {
    render(<SplashScreen />)
    const logo = screen.getByRole('img', { name: /holix ai/i })
    expect(logo).toBeInTheDocument()
  })

  it('renders the app name', () => {
    render(<SplashScreen />)
    expect(screen.getByText('Holix AI')).toBeInTheDocument()
  })
})

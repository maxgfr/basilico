import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('App', () => {
  it('rend le nom du produit', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'basilico' })).toBeInTheDocument()
  })
})

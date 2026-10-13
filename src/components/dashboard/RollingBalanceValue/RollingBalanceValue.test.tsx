// ABOUTME: Tests for RollingBalanceValue's fromValue roll — the decimal-alignment padding columns
// ABOUTME: collapse instead of showing zeros, so the row starts as the old value and ends as the new one.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { RollingBalanceValue } from './RollingBalanceValue'

const originalMatchMedia = window.matchMedia

/** Report non-reduced motion (setup defaults to reduced) so the odometer actually rolls. */
beforeEach(() => {
  window.matchMedia = ((query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList) as typeof window.matchMedia
})

afterEach(() => {
  window.matchMedia = originalMatchMedia
})

function columns(container: HTMLElement): HTMLElement[] {
  const root = container.firstElementChild as HTMLElement
  return Array.from(root.children) as HTMLElement[]
}

function shownCount(container: HTMLElement): number {
  return columns(container).filter((column) => !column.className.includes('collapsed')).length
}

/** Wait for the two-frame kick-off that flips the odometer from its start state to its end state. */
async function waitForRollToStart(container: HTMLElement) {
  await waitFor(() =>
    expect(container.querySelector('[class*="digitTrackRoll"]')).not.toBeNull(),
  )
}

describe('RollingBalanceValue — fromValue alignment padding', () => {
  it('starts as the old value and ends as the new one when the amount shrinks (10.5 → 5)', async () => {
    const { container } = render(
      <RollingBalanceValue value="5" fromValue="10.5" mode="fromValue" rollTrigger={1} rollStartMs={0} />,
    )
    // The padded row is "05.0"; before the roll every column is part of "10.5".
    expect(columns(container)).toHaveLength(4)
    expect(shownCount(container)).toBe(4)

    await waitForRollToStart(container)
    // Once rolling, the leading 0, the point and the trailing 0 are padding for "5" — they fold away.
    expect(shownCount(container)).toBe(1)
  })

  it('hides the padding zero at the start when the amount grows (1.74 → 20)', async () => {
    const { container } = render(
      <RollingBalanceValue value="20" fromValue="1.74" mode="fromValue" rollTrigger={1} rollStartMs={0} />,
    )
    // Padded row "01.74" → "20.00": the leading column is padding for "1.74", so it starts collapsed
    // and the row reads as the four characters of "1.74", not "01.74".
    expect(columns(container)).toHaveLength(5)
    expect(columns(container)[0]?.className).toContain('collapsed')
    expect(shownCount(container)).toBe(4)

    await waitForRollToStart(container)
    // "20" has no fraction, so the point and both fraction columns fold away; the leading column opens.
    expect(columns(container)[0]?.className).not.toContain('collapsed')
    expect(shownCount(container)).toBe(2)
  })

  it('folds away a thousands comma whose left-hand digit is padding (1,000 → 5)', async () => {
    const { container } = render(
      <RollingBalanceValue value="5" fromValue="1,000" mode="fromValue" rollTrigger={1} rollStartMs={0} />,
    )
    expect(shownCount(container)).toBe(5)

    await waitForRollToStart(container)
    const comma = columns(container).find((column) => column.textContent === ',')
    expect(comma?.className).toContain('collapsed')
    expect(shownCount(container)).toBe(1)
  })

  it('keeps an exiting column until its roll is ending, and opens an entering column at once', async () => {
    const { container } = render(
      <RollingBalanceValue
        value="20"
        fromValue="1.74"
        mode="fromValue"
        rollTrigger={1}
        rollStartMs={0}
        rollDurationMs={1000}
        digitStaggerMs={70}
      />,
    )
    await waitForRollToStart(container)
    const [entering, , point, firstFraction] = columns(container)
    expect(entering?.style.transitionDelay).toBe('')
    // The point sits before fraction column 2 and the first fraction digit is column 2: both finish
    // folding as that column's roll lands (1000ms roll + 2 × 70ms stagger − 450ms fold = 690ms).
    expect(point?.style.transitionDelay).toBe('690ms')
    expect(firstFraction?.style.transitionDelay).toBe('690ms')
  })

  it('leaves columns that belong to both values alone (no collapse, no fold transition)', async () => {
    const { container } = render(
      <RollingBalanceValue value="2.5" fromValue="7.5" mode="fromValue" rollTrigger={1} rollStartMs={0} />,
    )
    await waitForRollToStart(container)
    expect(shownCount(container)).toBe(3)
    expect(container.querySelector('[class*="paddingFold"]')).toBeNull()
  })
})

describe('RollingBalanceValue — fromZero reveal', () => {
  it('never collapses or adds the fold transition (the dashboard balance reveal is unchanged)', async () => {
    const { container } = render(<RollingBalanceValue value="1,234.56" rollStartMs={0} />)
    await waitForRollToStart(container)
    expect(shownCount(container)).toBe(columns(container).length)
    expect(container.querySelector('[class*="paddingFold"]')).toBeNull()
  })
})

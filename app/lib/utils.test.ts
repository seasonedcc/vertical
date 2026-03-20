import { describe, expect, it } from 'vitest'
import { cx } from './utils'

describe('cx', () => {
  it('joins string arguments with spaces', () => {
    expect(cx('foo', 'bar', 'baz')).toBe('foo bar baz')
  })

  it('filters out falsy and non-string values', () => {
    expect(cx('foo', false, null, undefined, 0, 'bar')).toBe('foo bar')
  })

  it('handles nested arrays', () => {
    expect(cx(['foo', 'bar'], 'baz')).toBe('foo bar baz')
  })

  it('returns empty string for no arguments', () => {
    expect(cx()).toBe('')
  })

  it('handles single string argument', () => {
    expect(cx('foo')).toBe('foo')
  })
})

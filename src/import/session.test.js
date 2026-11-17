// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { readImportSession, saveImportSession } from './session'
import { autoMap, parseCsv, TEMPLATE } from './csv'

afterEach(() => { vi.restoreAllMocks(); sessionStorage.clear() })
const file = { name: 'cuts.csv', ...parseCsv(TEMPLATE) }
const draft = { step: 2, file, mapping: autoMap(file.headers), skipErrors: true, saved: 0, transaction: null }

it('round-trips a draft and clears it when starting over', () => {
  expect(saveImportSession(draft)).toBe(true)
  expect(readImportSession()).toEqual(draft)
  saveImportSession({ file: null })
  expect(readImportSession()).toBeNull()
})
it('ignores corrupted session data', () => {
  sessionStorage.setItem('catcow.csv-import.v1', '{broken')
  expect(readImportSession()).toBeNull()
  saveImportSession({ ...draft, file: { ...file, records: [null] } })
  expect(readImportSession()).toBeNull()
})
it('handles unavailable or full browser storage', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
  expect(saveImportSession(draft)).toBe(false)
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
  expect(readImportSession()).toBeNull()
})

import { FIELDS, MAX_ROWS } from './csv'

const KEY = 'catcow.csv-import.v1'

export function readImportSession() {
  try {
    const draft = JSON.parse(sessionStorage.getItem(KEY))
    if (!draft || ![1, 2, 3].includes(draft.step)) return null
    const { file, mapping } = draft
    if (
      !file ||
      typeof file.name !== 'string' ||
      !Array.isArray(file.headers) ||
      !file.headers.every((value) => typeof value === 'string') ||
      !Array.isArray(file.records) ||
      !file.records.length ||
      file.records.length > MAX_ROWS ||
      !file.records.every(
        (row) =>
          Number.isInteger(row.rowNumber) &&
          Array.isArray(row.cells) &&
          row.cells.length === file.headers.length &&
          row.cells.every((value) => typeof value === 'string'),
      ) ||
      !mapping ||
      !FIELDS.every(
        ({ key }) =>
          mapping[key] === '' ||
          (typeof mapping[key] === 'string' &&
            /^\d+$/.test(mapping[key]) &&
            Number(mapping[key]) < file.headers.length),
      )
    )
      return null
    // Never restore an unconfirmed database request as a fresh editable import.
    if (
      draft.transaction &&
      (!draft.transaction.requestId || !Array.isArray(draft.transaction.cuts))
    )
      return null
    return draft
  } catch {
    return null
  }
}

export function saveImportSession(draft) {
  try {
    if (!draft.file) sessionStorage.removeItem(KEY)
    else sessionStorage.setItem(KEY, JSON.stringify(draft))
    return true
  } catch {
    return false
  }
}

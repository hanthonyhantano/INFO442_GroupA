// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ImportPage from './ImportPage'
import { TEMPLATE } from './csv'
afterEach(cleanup)

async function upload(text = TEMPLATE, name = 'cuts.csv') {
  const file = new File([text], name, { type: 'text/csv' })
  file.text = async () => text
  fireEvent.change(screen.getByLabelText('CSV file'), {
    target: { files: [file] },
  })
  await screen.findByRole('button', { name: 'Review rows →' })
  fireEvent.click(screen.getByRole('button', { name: 'Review rows →' }))
}
function show(props = {}) {
  render(
    <MemoryRouter>
      <ImportPage {...props} />
    </MemoryRouter>,
  )
}
describe('producer import workflow', () => {
  it('allows review without an inventory connection but disables saving', async () => {
    show()
    await upload()
    expect(screen.getByRole('button', { name: 'Import 1 cuts' }).disabled).toBe(true)
    expect(screen.getByText(/Saving will be available/)).toBeTruthy()
  })
  it('preserves mappings and cell edits when going back', async () => {
    show()
    await upload()
    fireEvent.change(screen.getByLabelText('Row 2 Product name'), {
      target: { value: 'Edited roast' },
    })
    fireEvent.click(screen.getByRole('button', { name: '← Column mapping' }))
    fireEvent.click(screen.getByRole('button', { name: 'Review rows →' }))
    expect(screen.getByLabelText('Row 2 Product name').value).toBe('Edited roast')
  })
  it('blocks invalid rows, allows skipping, and saves only valid drafts', async () => {
    const onImport = vi.fn().mockResolvedValue(undefined)
    show({ inventory: [], onImport })
    await upload(TEMPLATE + '\nBad,Unknown,five,,')
    expect(screen.getByRole('button', { name: 'Fix 1 rows to import' }).disabled).toBe(true)
    fireEvent.click(screen.getByLabelText('Skip rows that still have errors'))
    fireEvent.click(screen.getByRole('button', { name: 'Import 1 cuts' }))
    await screen.findByRole('heading', { name: 'Import complete' })
    expect(onImport.mock.calls[0][0].cuts).toHaveLength(1)
    expect(onImport.mock.calls[0][0].cuts[0].isLive).toBe(false)
  })
  it('preserves data and reuses the identical request after an ambiguous failure', async () => {
    const onImport = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(undefined)
    show({ inventory: [], onImport })
    await upload()
    fireEvent.click(screen.getByRole('button', { name: 'Import 1 cuts' }))
    await screen.findByRole('alert')
    expect(screen.getByLabelText('Row 2 Product name').value).toBe('Chuck roast')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await screen.findByRole('heading', { name: 'Import complete' })
    expect(onImport.mock.calls[1][0]).toBe(onImport.mock.calls[0][0])
  })
  it('recovers when an invalid drop interrupts a pending file read', async () => {
    show()
    let finishRead
    const file = new File([TEMPLATE], 'slow.csv')
    file.text = () =>
      new Promise((resolve) => {
        finishRead = resolve
      })
    fireEvent.change(screen.getByLabelText('CSV file'), {
      target: { files: [file] },
    })
    fireEvent.drop(screen.getByLabelText('CSV file').closest('label'), {
      dataTransfer: { files: [new File(['bad'], 'cuts.xlsx')] },
    })
    expect(screen.getByLabelText('CSV file').disabled).toBe(false)
    await act(async () => finishRead(TEMPLATE))
    expect(screen.queryByRole('button', { name: 'Review rows →' })).toBeNull()
    await upload()
    expect(screen.getByLabelText('Row 2 Product name').value).toBe('Chuck roast')
  })
  it('rejects non-CSV uploads', async () => {
    show()
    fireEvent.change(screen.getByLabelText('CSV file'), {
      target: { files: [new File(['x'], 'cuts.xlsx')] },
    })
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/CSV/))
  })
})

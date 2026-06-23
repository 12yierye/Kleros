import { exportAllDB, type PersistenceData } from '@/composables/useDB'

export async function exportAll(): Promise<PersistenceData> {
  return exportAllDB()
}

export function downloadExport() {
  exportAllDB().then(data => {
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const date = new Date().toISOString().slice(0, 10)
    a.download = `kleros-export-${date}.json`
    a.click()
    URL.revokeObjectURL(url)
  })
}

import { useState } from 'react';
import { loadCards } from './storage';
import { mergeCards, parseBackup, serializeBackup } from './backup';
import { exportFile } from './native';
export function BackupControls({ onImport }: { onImport: () => void }) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  return <section className="backup-panel"><h2>Your cards, with you</h2><p>Move your collection from the browser to Android with a JSON backup. Review history is included; API keys are excluded. Existing cards are kept when IDs match.</p>
    <button disabled={busy} className="export-btn" onClick={async () => { setBusy(true); try { await exportFile('japanese-flashcards-backup.json', serializeBackup(loadCards()), 'application/json'); setStatus('Backup prepared. Save the file somewhere safe.'); } catch { setStatus('Export was cancelled or could not finish. Try again.'); } finally { setBusy(false); } }}>Export card backup</button>
    <label className="import-label">Import card backup<input type="file" accept=".json,application/json" disabled={busy} onChange={async e => {
      const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
      setBusy(true); try { const result = mergeCards(loadCards(), parseBackup(await file.text())); localStorage.setItem('flashcards', JSON.stringify(result.cards)); onImport(); setStatus(`${result.imported} imported · ${result.skipped} skipped`); } catch (error) { setStatus(error instanceof Error ? error.message : 'Import failed.'); } finally { setBusy(false); }
    }}/></label><p role="status">{status}</p></section>;
}

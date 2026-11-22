import { useRef, useState } from 'react';
import { Download, Upload, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportWorkspaceBackup, restoreWorkspaceBackup } from '@/lib/workspace-backup';

/** Explicit offline-only backup, no paid services or API keys required. */
export function WorkspaceBackup() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState('');
  const download = () => {
    try {
      const snapshot = exportWorkspaceBackup();
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'avqix-zaloha-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setStatus('Záloha byla připravena ke stažení. Uložte ji na bezpečné místo.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Zálohu se nepodařilo připravit.');
    }
  };
  const restore = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('Soubor je příliš velký (maximum 2 MB).');
      const input: unknown = JSON.parse(await file.text());
      // Validation runs first; there is no write if the file is invalid.
      const { validateWorkspaceSnapshot } = await import('@/lib/workspace-backup');
      const snapshot = validateWorkspaceSnapshot(input);
      if (!window.confirm('Obnovit ' + snapshot.clients.length + ' klientů a ' + snapshot.tasks.length + ' úkolů? Současné klienty, cíle a úkoly v tomto prohlížeči tím nahradíte.')) {
        setStatus('Obnovení zrušeno.');
        return;
      }
      restoreWorkspaceBackup(snapshot);
      setStatus('Data obnovena. Obnovte stránku, aby se projevila ve všech přehledech.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Soubor nelze načíst.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  return (
    <section className="reco-section" aria-labelledby="avqix-backup-title">
      <div className="section-heading"><div>
        <h2 id="avqix-backup-title">Bezplatná záloha pracovního prostoru</h2>
        <p>Klienti, cíle a úkoly – do souboru na vašem zařízení. Nic se neposílá do cloudu.</p>
      </div></div>
      <div className="info-banner"><ShieldCheck size={18} /><span>AVQIX zatím ukládá data v tomto prohlížeči. Před připojením databáze doporučujeme zálohu. Neukládejte sem hesla ani API tokeny.</span></div>
      <div className="gsc-actions">
        <Button size="sm" onClick={download}><Download size={16} />Stáhnout zálohu JSON</Button>
        <input ref={fileRef} type="file" accept=".json,application/json" aria-label="Soubor zálohy AVQIX" style={{ display:'none' }} onChange={event => void restore(event.target.files?.[0])} />
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload size={16} />Obnovit ze zálohy</Button>
      </div>
      {status && <p className="goal-help" role="status">{status}</p>}
    </section>
  );
}

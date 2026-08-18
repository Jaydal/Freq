'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function BackupRestoreManager() {
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await fetch('/api/backup');
      if (!res.ok) {
        throw new Error(`Error: ${res.statusText}`);
      }
      
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Backup exported successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to export backup');
    } finally {
      setIsExporting(false);
    }
  };

  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('Are you sure you want to restore from this backup? Existing data might be overwritten.')) {
      e.target.value = '';
      return;
    }

    setIsRestoring(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Failed to restore backup');
      }

      toast.success('Backup restored successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to restore backup');
    } finally {
      setIsRestoring(false);
      e.target.value = '';
    }
  };

  return (
    <div className="flex gap-4">
      <Button 
        onClick={handleExport} 
        disabled={isExporting} 
        variant="outline"
        className="border-zinc-700 bg-zinc-950/40"
      >
        {isExporting ? 'Exporting...' : 'Export Full Backup (JSON)'}
      </Button>
      
      <Button 
        onClick={handleRestoreClick} 
        disabled={isRestoring}
        variant="outline"
        className="border-zinc-700 bg-zinc-950/40"
      >
        {isRestoring ? 'Restoring...' : 'Restore from Backup (JSON)'}
      </Button>
      
      <input 
        type="file" 
        accept=".json,application/json" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
      />
    </div>
  );
}

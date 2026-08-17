'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { assignRFID, updateRFID, deleteRFID } from '@/features/rfid/actions';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

export default function BulkRegisterClient({ initialCards }: { initialCards: any[] }) {
  const [cards, setCards] = useState<any[]>(initialCards);
  const [uid, setUid] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const refreshCards = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('rfid_cards')
      .select('*, members(*)')
      .order('assigned_date', { ascending: false, nullsFirst: false });
    setCards(data ?? []);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid.trim()) {
      toast('Enter an RFID UID');
      return;
    }
    setSubmitting(true);
    try {
      await assignRFID({ uid: uid.trim(), memberId: null });
      setUid('');
      toast.success('RFID card registered');
      await refreshCards();
    } catch (err: any) {
      if (err.message?.includes('already')) {
        toast.warning(err.message);
      } else {
        toast.error(err.message || 'Failed to register RFID');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (cardId: string, newStatus: string) => {
    try {
      await updateRFID(cardId, { status: newStatus, memberId: null });
      toast.success('Status updated');
      await refreshCards();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  const handleDelete = async (cardId: string) => {
    if (!window.confirm('Delete this RFID card permanently?')) return;
    try {
      await deleteRFID(cardId);
      toast.success('Card deleted');
      await refreshCards();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete card');
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return <span className="text-zinc-600">—</span>;
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-zinc-150">Simulated RFID Scan</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="flex gap-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor="uid">Simulated RFID Scan</Label>
              <Input
                id="uid"
                value={uid}
                onChange={e => setUid(e.target.value)}
                placeholder="Type UID and press Enter"
                disabled={submitting}
                className="font-mono text-lg tracking-widest border-zinc-700 bg-zinc-950/40"
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={submitting} className="h-10">
                {submitting ? 'Registering...' : 'Register'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-900/30 overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-zinc-950/40">
              <TableRow className="border-b border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-400 font-semibold h-11">UID</TableHead>
                <TableHead className="text-zinc-400 font-semibold h-11">Registration Date</TableHead>
                <TableHead className="text-zinc-400 font-semibold h-11">Status</TableHead>
                <TableHead className="text-zinc-400 font-semibold text-right h-11 pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-zinc-800">
              {!cards.length ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-zinc-500 py-8">
                    No RFID cards registered yet.
                  </TableCell>
                </TableRow>
              ) : (
                cards.map((card: any) => (
                  <TableRow key={card.id} className="border-zinc-800 hover:bg-zinc-800/10 transition-colors">
                    <TableCell className="font-mono text-sm text-zinc-200 py-3.5">
                      {card.uid}
                    </TableCell>
                    <TableCell className="text-zinc-400 py-3.5">
                      {formatDate(card.assigned_date)}
                    </TableCell>
                    <TableCell className="py-3.5">
                      <select
                        value={card.status}
                        onChange={e => handleStatusChange(card.id, e.target.value)}
                        className="h-8 rounded-md border border-zinc-700 bg-zinc-950/40 px-2.5 py-1 text-sm text-zinc-200 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                        <option value="Unassigned">Unassigned</option>
                      </select>
                    </TableCell>
                    <TableCell className="py-3.5 text-right pr-6">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(card.id)}
                        className="h-8"
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
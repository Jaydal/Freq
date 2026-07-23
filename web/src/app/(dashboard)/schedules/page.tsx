import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from 'lucide-react';

export default async function SchedulesPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-150">Group Schedules</h1>
        <p className="text-sm text-zinc-500 mt-1">Manage recurring court reservations and group schedules.</p>
      </div>

      <Card className="border-zinc-800 bg-zinc-900/30">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Calendar className="size-5 text-emerald-400" />
            Active Schedules
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-zinc-400 py-8 text-center">
            The group scheduling feature is currently being built.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

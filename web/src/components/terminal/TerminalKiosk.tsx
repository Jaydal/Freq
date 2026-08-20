'use client';

import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TerminalLayout } from './TerminalLayout';
import { CourtOverview } from './CourtOverview';
import { IdleScreen } from './IdleScreen';
import { SelectCourt } from './SelectCourt';
import { SelectGameType } from './SelectGameType';
import { SelectDuration } from './SelectDuration';
import { ConfirmBooking } from './ConfirmBooking';
import { QueueBoard } from './QueueBoard';
import { ReservationOffer } from './ReservationOffer';
import { BookingSuccess } from './BookingSuccess';
import { ErrorScreen } from './ErrorScreen';
import type { ProductsConfig } from '@/lib/products-config-types';
import { getCost } from '@/lib/products-config-types';
import { fetchBoardSnapshot, cancelQueueEntry } from '@/app/terminal/queue/actions';
import { AlertCircle, Trash2, Plus } from 'lucide-react';
import { getRfidFormats } from '@/lib/rfid';

interface Player {
  id: string;
  memberId: string;
  firstName: string;
  lastName: string;
  balance: number;
}

interface CourtOption {
  id: string;
  name: string;
  status: string;
  estimatedWait?: string;
}

export type KioskStep =
  | 'booting'
  | 'idle'
  | 'existing-queue'
  | 'select-court'
  | 'select-game'
  | 'select-duration'
  | 'confirm'
  | 'offer'
  | 'success'
  | 'error';


const SUCCESS_DELAY_MS = 5000;

export function TerminalKiosk() {
  const [step, setStep] = useState<KioskStep>('idle');
  const [member, setMember] = useState<Player | null>(null);
  const [selectedCourt, setSelectedCourt] = useState<CourtOption | null>(null);
  const [gameType, setGameType] = useState<'1v1' | '2v2' | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [matchTitle, setMatchTitle] = useState('');
  
  const [_queueEntry, _setQueueEntry] = useState<any>(null);
  const queueEntryIdRef = useRef<string | null>(null);
  const setQueueEntry = useCallback((entry: any | ((prev: any) => any)) => {
    _setQueueEntry((prev: any) => {
      const next = typeof entry === 'function' ? entry(prev) : entry;
      queueEntryIdRef.current = next?.id || null;
      return next;
    });
  }, []);
  const queueEntry = _queueEntry;

  const [errorInfo, setErrorInfo] = useState<{ title: string; message: string } | null>(null);
  const [courts, setCourts] = useState<CourtOption[]>([]);
  const [testMode, setTestMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scannedNfcUid, setScannedNfcUid] = useState<string | null>(null);
  const [nfcStatus, setNfcStatus] = useState<'idle' | 'waiting_for_interaction' | 'active' | 'error' | 'unsupported'>('idle');
  const [nfcBadgeVisible, setNfcBadgeVisible] = useState(false);
  const nfcBadgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [config, setConfig] = useState<ProductsConfig | null>(null);
  const rfidRef = useRef<HTMLInputElement>(null);
  const nfcScannerRef = useRef<any>(null);
  const supabase = useMemo(() => createClient(), []);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepRef = useRef<KioskStep>('idle');

  useEffect(() => {
    const isTest = new URLSearchParams(window.location.search).get('testmode') === 'true';
    setTestMode(isTest);
  }, []);

  useEffect(() => {
    if (step === 'idle') {
      setTimeout(() => rfidRef.current?.focus(), 200);
    }
  }, [step]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("NDEFReader" in window)) {
      setNfcStatus('unsupported');
      return;
    }

    setNfcStatus('waiting_for_interaction');

    const startScanner = async () => {
      if (nfcScannerRef.current) return;

      try {
        const ndef = new (window as any).NDEFReader();
        await ndef.scan();
        nfcScannerRef.current = ndef;
        setNfcStatus('active');
        setNfcBadgeVisible(true);
        // Auto-hide the "active" badge after 3 seconds
        if (nfcBadgeTimer.current) clearTimeout(nfcBadgeTimer.current);
        nfcBadgeTimer.current = setTimeout(() => setNfcBadgeVisible(false), 3000);
        
        ndef.addEventListener("reading", ({ serialNumber }: any) => {
          if (serialNumber) {
             const uid = serialNumber.replace(/:/g, "").toUpperCase();
             setScannedNfcUid(uid);
          }
        });
      } catch (err) {
        console.error("NFC start failed", err);
        setNfcStatus('error');
      }
    };

    document.addEventListener("click", startScanner);
    document.addEventListener("touchstart", startScanner);

    return () => {
      document.removeEventListener("click", startScanner);
      document.removeEventListener("touchstart", startScanner);
    };
  }, []);

  useEffect(() => {
    if (scannedNfcUid && step === 'idle') {
      lookupMember(scannedNfcUid);
      setScannedNfcUid(null);
    }
  }, [scannedNfcUid, step]);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    if (step === 'success') {
      successTimer.current = setTimeout(() => reset(), SUCCESS_DELAY_MS);
      return () => { if (successTimer.current) clearTimeout(successTimer.current); };
    }
    if (step === 'select-court') {
      fetchCourts();
    }
  }, [step]);

  const checkQueueEntryStatus = useCallback(async (id: string) => {
    try {
      const { data } = await supabase
        .from('queue_entries')
        .select('status, expires_at, court_id, duration, party_size')
        .eq('id', id)
        .single();
      if (!data) return;
      // Only clear the success timer when a poll arrives outside the success
      // screen — otherwise the success screen never auto-resets (Critical #4)
      if (successTimer.current && stepRef.current !== 'success') clearTimeout(successTimer.current);
      if (data.status === 'offered') {
        setQueueEntry((prev: any) => prev ? { ...prev, status: 'offered', expires_at: data.expires_at, court_id: data.court_id } : prev);
        setStep('offer');
      } else if (data.status === 'completed') {
        setQueueEntry((prev: any) => prev ? { ...prev, status: 'completed' } : prev);
        if (!duration && (data as any).duration) setDuration((data as any).duration);
        if (!gameType && (data as any).party_size) setGameType((data as any).party_size === 4 ? '2v2' : '1v1');
        setStep('success');
      } else if (['expired', 'declined', 'cancelled'].includes(data.status)) {
        setQueueEntry((prev: any) => prev ? { ...prev, status: data.status } : prev);
        setStep('idle');
      }
    } catch {}
  }, [supabase]);


  const fetchCourts = useCallback(async () => {
    try {
      const snap = await fetchBoardSnapshot();
      const nowSec = Date.now() / 1000;
      setCourts(snap.courts.map((c: any) => {
        const isPlayingNow = c.startTime > 0 && c.startTime <= nowSec;
        return {
          id: c.id,
          name: c.name,
          status: isPlayingNow ? 'Playing' : 'Available',
        };
      }));
    } catch {}
  }, []);

  useEffect(() => {
    fetchInitial();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!cancelled) await fetchCourts();
    };
    run();
    
    const es = new EventSource('/api/queue/events');
    let sseDebounce: ReturnType<typeof setTimeout> | null = null;
    es.onmessage = () => { 
      if (!cancelled) {
        if (sseDebounce) clearTimeout(sseDebounce);
        sseDebounce = setTimeout(() => {
          sseDebounce = null;
          if (!cancelled) {
            fetchCourts(); 
            if (queueEntryIdRef.current) checkQueueEntryStatus(queueEntryIdRef.current);
          }
        }, 100);
      }
    };
    es.onerror = (err) => console.error('SSE Error:', err);

    const poller = setInterval(() => { if (!cancelled) fetchCourts(); }, 30_000);
    return () => { cancelled = true; if (sseDebounce) clearTimeout(sseDebounce); clearInterval(poller); es.close(); };
  }, [fetchCourts, checkQueueEntryStatus]);

  async function fetchInitial() {
    try {
      // 1. Test backend API connection
      const apiRes = await fetch('/api/health');
      if (!apiRes.ok) throw new Error('API unreachable');

      // 2. Test Supabase Database connection
      const { data: rows, error } = await supabase.from('settings').select('key, value').in('key', ['products', 'prices', 'preparationTime']);
      if (error) throw new Error('Database unreachable');

      if (rows) {
        const map = new Map(rows.map(r => [r.key, r.value]));
        const products = tryParse(map.get('products'));
        const rates = tryParse(map.get('prices'));
        const prepTimeSec = parseInt(map.get('preparationTime') ?? '', 10);
        setConfig({
          matchTypes: products?.matchTypes ?? ['1v1', '2v2'],
          durations: products?.durations ?? [30, 60, 90],
          rates: rates ?? { '30': 150, '60': 300, '90': 450 },
          
        });
      }
      await fetchCourts();
      setStep('idle');
    } catch (err: any) {
      setErrorInfo({ title: 'System Offline', message: 'Unable to connect to the server. Retrying...' });
      setStep('error');
      setTimeout(fetchInitial, 5000); // retry after 5 seconds
    }
  }

  function tryParse(json: string | undefined): any {
    if (!json) return undefined;
    try { return JSON.parse(json); } catch { return undefined; }
  }



  function focusRfid() {
    setTimeout(() => rfidRef.current?.focus(), 200);
  }

  async function handleRfidSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rfidRef.current) return;
    const uid = rfidRef.current.value.trim();
    rfidRef.current.value = '';
    if (!uid) return;
    await lookupMember(uid === 'test' ? 'TEST001' : uid);
  }

  async function lookupMember(uid: string) {
    setErrorInfo(null);
    try {
      const formats = getRfidFormats(uid);
      const { data: card, error: err } = await supabase
        .from('rfid_cards')
        .select('member_id')
        .in('uid', formats)
        .eq('status', 'Active')
        .maybeSingle();
      if (err || !card) { setErrorInfo({ title: 'RFID Read Failed', message: 'Card not recognized. Please try again.' }); setStep('error'); return; }
      
      const { data: memberData, error: memberErr } = await supabase
        .from('members')
        .select('id, member_id, first_name, last_name')
        .eq('id', card.member_id)
        .single();
      if (memberErr || !memberData) { setErrorInfo({ title: 'RFID Read Failed', message: 'Card not recognized. Please try again.' }); setStep('error'); return; }
      
      const { data: walletData } = await supabase
        .from('wallets')
        .select('balance')
        .eq('member_id', memberData.id)
        .single();

      const player: Player = {
        id: memberData.id,
        memberId: memberData.member_id,
        firstName: memberData.first_name,
        lastName: memberData.last_name,
        balance: walletData?.balance ?? 0,
      };
      setMember(player);
      
      // Removed checkExistingQueue (allow users to book even if they are in an active game)

      // Check if they are in a queue
      const { data } = await supabase
        .from('queue_entries')
        .select('id, status, court_id, expires_at, duration, party_size, courts!left(name)')
        .eq('member_id', player.id)
        .in('status', ['waiting', 'offered'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data && data.status === 'offered') { setQueueEntry(data as any); setStep('offer'); return; }
      if (data && data.status === 'waiting') { setQueueEntry(data as any); setStep('existing-queue'); return; }
      setStep('select-court');
    } catch { 
      setErrorInfo({ title: 'Unable to Connect', message: 'Check connection and try again.' }); 
      setStep('error'); 
    }
  }

  function handleSelectCourt(court: CourtOption) {
    setSelectedCourt(court);
    setStep('select-game');
  }

  function handleSelectGame(gt: '1v1' | '2v2') {
    setGameType(gt);
    setStep('select-duration');
  }

  function handleSelectDuration(d: number) {
    setDuration(d);
    setStep('confirm');
  }

  async function handleJoinQueue() {
    if (!member || !duration || !gameType) return;
    setBusy(true);
    setErrorInfo(null);
    if (!config) return;
    const partySize = gameType === '2v2' ? 4 : 2;
    const cost = getCost(config, duration, partySize);
    if (member.balance < cost) {
      setErrorInfo({ title: 'No Credits Remaining', message: `You need ₱${cost} but only have ₱${member.balance}.` });
      setStep('error');
      setBusy(false);
      return;
    }
    try {
      const res = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: member.id,
          start: new Date().toISOString(),
          duration,
          partySize,
          playerIds: [member.id],
          ...(selectedCourt?.id ? { courtId: selectedCourt.id } : {}),
          matchTitle: matchTitle || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        setErrorInfo({ title: 'Unable to Join Queue', message: body.error || 'Please try again.' });
        setStep('error');
        setBusy(false);
        return;
      }
      const entry = await res.json();
      setQueueEntry(entry);
      if (entry.status === 'completed') {
        const remaining = member.balance - cost;
        setMember(prev => prev ? { ...prev, balance: remaining } : prev);
        setStep('success');
      } else {
        setQueueEntry(entry);
        setStep('existing-queue');
      }
    } catch {
      setErrorInfo({ title: 'Unable to Connect', message: 'Check connection and try again.' });
      setStep('error');
    }
    setBusy(false);
  }

  async function handleAcceptOffer() {
    if (!queueEntry) return;
    setBusy(true);
    try {
      const res = await fetch('/api/queue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: queueEntry.id, action: 'accept' }),
      });
      if (!res.ok) {
        const body = await res.json();
        setErrorInfo({ title: 'Accept Failed', message: body.error || 'Please try again.' });
        setStep('error');
        setBusy(false);
        return;
      }
      const cost = config && duration ? getCost(config, duration, gameType === '2v2' ? 4 : 2) : 0;
      setMember(prev => prev ? { ...prev, balance: prev.balance - cost } : prev);
      setStep('success');
    } catch {
      setErrorInfo({ title: 'Unable to Connect', message: 'Check connection and try again.' });
      setStep('error');
    }
    setBusy(false);
  }

  async function handleDeclineOffer() {
    if (!queueEntry) return;
    try {
      await fetch('/api/queue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: queueEntry.id, action: 'decline' }),
      });
    } catch {}
    reset();
  }

  async function handleCancelQueue() {
    if (!queueEntry) return;
    try {
      const res = await cancelQueueEntry(queueEntry.id);
      if (!res.ok) {
        setErrorInfo({ title: 'Cancel Failed', message: res.error ?? 'Please try again.' });
        setStep('error');
        return;
      }
    } catch {}
    reset();
  }

  async function handleCancelExisting() {
    if (!queueEntry) return;
    try {
      const res = await cancelQueueEntry(queueEntry.id);
      if (!res.ok) {
        setErrorInfo({ title: 'Cancel Failed', message: res.error ?? 'Please try again.' });
        setStep('error');
        return;
      }
    } catch {}
    setQueueEntry(null);
    setStep('select-court');
  }

  function reset() {
    setMember(null);
    setSelectedCourt(null);
    setGameType(null);
    setDuration(null);
    setMatchTitle('');
    setQueueEntry(null);
    setErrorInfo(null);
    setStep('idle');
    focusRfid();
  }

  function handleBack() {
    switch (step) {
      case 'select-game': setStep('select-court'); break;
      case 'select-duration': setStep('select-game'); break;
      case 'confirm': setStep('select-duration'); break;
      default: reset();
    }
  }

  const creditsRequired = config && member && duration && gameType
    ? getCost(config, duration, gameType === '2v2' ? 4 : 2)
    : 0;

  const fullScreenSteps = new Set<KioskStep>(['offer', 'success', 'error']);
  const hasSidebar = !fullScreenSteps.has(step);

  const courtOverview = useMemo(() => <CourtOverview />, []);

  function withLayout(content: ReactNode) {
    return (
      <TerminalLayout sidebar={hasSidebar ? courtOverview : undefined}>
        {content}
      </TerminalLayout>
    );
  }

  if (step === 'error' && errorInfo) {
    return withLayout(<ErrorScreen title={errorInfo.title} message={errorInfo.message} onRetry={reset} />);
  }

  const renderStep = () => {
    switch (step) {
      case 'idle':
      return (
        <div className="relative min-h-screen bg-primary">
          <QueueBoard />
          {testMode && (
            <div className="absolute top-4 right-4 z-50 bg-primary/90 border border-zinc-800 rounded-xl p-4 w-64 shadow-2xl animate-fade-in">
              <h3 className="text-xs font-bold text-zinc-300 mb-2 flex items-center gap-1.5">
                <span>🔧</span>
                <span>Test RFID Input</span>
              </h3>
              <form onSubmit={handleRfidSubmit} className="flex gap-2">
                <input
                  ref={rfidRef}
                  type="text"
                  placeholder="Enter Card UID"
                  className="flex-1 bg-background border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-zinc-700"
                />
                <button
                  type="submit"
                  className="bg-secondary hover:bg-secondary/90 text-white text-xs font-extrabold px-3 py-1.5 rounded-lg active:scale-95 transition-all cursor-pointer"
                >
                  Go
                </button>
              </form>
            </div>
          )}
        </div>
      );

    case 'existing-queue':
      return withLayout(
        member && queueEntry && (
          <div className="min-h-full flex flex-col items-center justify-center p-8 text-center animate-fade-in">
            <div className="size-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-400">
              <AlertCircle className="size-6" />
            </div>
            <h2 className="text-lg font-black text-zinc-100 tracking-wide">Active Booking Found</h2>
            <p className="text-xs text-zinc-400 mt-1 mb-6">You are already in the waiting list.</p>
            
            <div className="bg-gradient-to-br from-primary/40 to-primary/20 border border-primary-foreground/10 rounded-2xl p-5 mb-8 w-full max-w-sm text-left shadow-md shadow-black/10 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-zinc-550 uppercase tracking-widest">Queue Status</span>
                <span className="text-xs font-bold text-amber-455 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  Waiting
                </span>
              </div>
              {queueEntry.courts?.name && (
                <>
                  <div className="h-px bg-zinc-850" />
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-zinc-550 uppercase tracking-widest">Preferred Court</span>
                    <span className="text-xs font-black text-zinc-200">{queueEntry.courts.name}</span>
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-col gap-2.5 w-full max-w-xs">
              <button 
                onClick={() => setStep('select-court')}
                className="w-full py-3.5 px-6 rounded-xl bg-secondary hover:bg-secondary/90 text-white font-extrabold text-xs uppercase tracking-wider active:scale-[0.98] transition-all cursor-pointer shadow-md shadow-emerald-500/10 flex items-center justify-center gap-2"
              >
                <Plus className="size-4 stroke-[2.5]" />
                <span>Book Another Game</span>
              </button>
              <button 
                onClick={handleCancelExisting}
                className="w-full py-3.5 px-6 rounded-xl bg-primary-foreground/10 text-primary-foreground border border-zinc-800 hover:text-red-400 hover:border-red-500/45 hover:bg-red-500/[0.02] font-extrabold text-xs uppercase tracking-wider active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Trash2 className="size-4" />
                <span>Cancel Booking</span>
              </button>
            </div>
          </div>
        )
      );

    case 'select-court':
      return withLayout(
        <SelectCourt member={member} courts={courts} onSelect={handleSelectCourt} onBack={reset} />
      );

    case 'select-game':
      return withLayout(
        <SelectGameType member={member} onSelect={handleSelectGame} onBack={handleBack} onCancel={reset} />
      );

    case 'select-duration':
      return withLayout(
        config && <SelectDuration member={member} durations={config.durations} rates={config.rates} onSelect={handleSelectDuration} onBack={handleBack} onCancel={reset} />
      );

    case 'confirm':
      return withLayout(
        member && selectedCourt && gameType && duration && (
          <ConfirmBooking
            member={member}
            courtName={selectedCourt.name}
            gameType={gameType}
            duration={duration}
            creditsRequired={creditsRequired}
            balance={member.balance}
            matchTitle={matchTitle}
            onMatchTitleChange={setMatchTitle}
            onConfirm={handleJoinQueue}
            onBack={handleBack}
            onCancel={reset}
            busy={busy}
          />
        )
      );

    case 'offer':
      return withLayout(
        queueEntry && (
          <ReservationOffer
            courtName={selectedCourt?.name ?? queueEntry.court_name ?? 'Court'}
            expiresAt={queueEntry.expires_at}
            onAccept={handleAcceptOffer}
            onDecline={handleDeclineOffer}
            busy={busy}
          />
        )
      );

    case 'success':
      return withLayout(
        member && duration && gameType && (
          <BookingSuccess
            courtName={selectedCourt?.name}
            duration={duration}
            creditsUsed={creditsRequired}
            creditsRemaining={member.balance}
          />
        )
      );

      default:
        return withLayout(
          <IdleScreen rfidRef={rfidRef} onRfidSubmit={handleRfidSubmit} />
        );
    }
  };

  return (
    <>
      {renderStep()}
      {/* Persistent badges for permanent states */}
      {nfcStatus === 'unsupported' && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-3 py-1.5 rounded-lg text-xs font-medium z-50 whitespace-nowrap">
          NFC Not Supported (Requires Android Chrome)
        </div>
      )}
      {nfcStatus === 'waiting_for_interaction' && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-amber-500/90 text-black px-3 py-1.5 rounded-lg text-xs font-medium z-50 whitespace-nowrap">
          Tap anywhere to enable NFC
        </div>
      )}
      {nfcStatus === 'error' && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-3 py-1.5 rounded-lg text-xs font-medium z-50 whitespace-nowrap">
          NFC Permission Denied
        </div>
      )}
      {/* Active badge — auto-hides after 3s with fade */}
      <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 bg-secondary/90 text-white px-3 py-1.5 rounded-lg text-xs font-medium z-50 whitespace-nowrap transition-opacity duration-700 ${nfcBadgeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        ✓ NFC Scanner Active
      </div>
    </>
  );
}

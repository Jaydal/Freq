import Link from "next/link";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Target, BarChart3, CreditCard, Scan, Monitor, Play, ClipboardCheck } from "lucide-react";

async function getPrices(): Promise<Record<string, number>> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from('settings').select('value').eq('key', 'prices').single();
    if (data?.value) return JSON.parse(data.value);
  } catch {}
  return { "10": 10, "25": 150, "55": 300, "85": 450 };
}

function CourtIllustration() {
  return (
    <svg viewBox="0 0 400 260" className="w-full max-w-lg mx-auto" fill="none">
      <rect x="10" y="10" width="380" height="240" rx="8" fill="#2d6a4f" />
      <rect x="20" y="20" width="360" height="220" rx="4" stroke="white" strokeWidth="2" fill="none" />
      <line x1="200" y1="20" x2="200" y2="240" stroke="white" strokeWidth="1.5" strokeDasharray="6 4" />
      <rect x="120" y="20" width="160" height="220" stroke="white" strokeWidth="1" fill="none" />
      <rect x="20" y="100" width="80" height="60" rx="4" fill="#1b4332" stroke="white" strokeWidth="1" />
      <rect x="300" y="100" width="80" height="60" rx="4" fill="#1b4332" stroke="white" strokeWidth="1" />
      <text x="200" y="115" textAnchor="middle" fill="white" fontSize="11" fontFamily="system-ui">PICKLE</text>
      <text x="200" y="132" textAnchor="middle" fill="white" fontSize="11" fontFamily="system-ui">POINT</text>
    </svg>
  );
}

export default async function LandingPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  if (code) {
    redirect(`/update-password?code=${code}`);
  }

  const prices = await getPrices();
  const rateEntries = Object.entries(prices) as [string, number][];

  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-6 py-4 flex justify-between items-center bg-white/80 backdrop-blur border-b sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-700 rounded-lg flex items-center justify-center text-white text-xs font-bold">PP</div>
          <div>
            <div className="text-lg font-bold text-green-800 leading-tight">Pickle Point</div>
            <div className="text-xs text-green-600 leading-tight">Pickle Ball Court</div>
          </div>
        </div>
        <nav className="flex gap-4 items-center">
          <Link href="/terminal">
            <Button variant="outline" className="border-green-400 text-green-700 hover:bg-green-50">
              Book Now
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="ghost">Staff Login</Button>
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="py-16 md:py-24 px-4 bg-gradient-to-br from-green-900 via-green-800 to-emerald-900 text-white overflow-hidden">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-block px-3 py-1 bg-green-500/20 text-green-300 text-sm rounded-full border border-green-500/30">
                3 Outdoor Courts &bull; Open Daily
              </div>
              <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-tight">
                Your Next <span className="text-green-300">Pickle Ball</span> Game
                <span className="block text-3xl md:text-4xl font-semibold text-green-200/80">Starts Here</span>
              </h1>
              <p className="text-lg md:text-xl text-green-100/80 max-w-lg">
                Premium outdoor pickle ball courts with self-service kiosk, RFID tap-in access, and live queue management.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <Link href="/terminal">
                  <Button size="lg" className="px-10 py-6 text-lg bg-green-400 text-green-900 hover:bg-green-300 font-semibold">
                    Book a Court Now
                  </Button>
                </Link>
                <Link href="#how-it-works">
                  <Button size="lg" variant="outline" className="px-10 py-6 text-lg border-green-400 text-green-200 hover:bg-green-700/50">
                    How It Works
                  </Button>
                </Link>
              </div>
            </div>
            <div className="hidden md:block">
              <CourtIllustration />
            </div>
          </div>
        </section>

        <section id="how-it-works" className="py-20 px-4 bg-white">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">Self-Service Queue &amp; Booking</h2>
            <p className="text-center text-gray-500 mb-14 max-w-xl mx-auto">
              No front desk required. From scan to play in under a minute.
            </p>
            <div className="grid md:grid-cols-4 gap-6">
              <div className="text-center space-y-3 relative">
                <div className="w-16 h-16 mx-auto bg-green-100 rounded-2xl flex items-center justify-center">
                  <Scan className="w-7 h-7 text-green-700" />
                </div>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-3 w-7 h-7 bg-green-700 text-white rounded-full text-sm font-bold flex items-center justify-center">1</div>
                <h3 className="font-semibold text-gray-900 mt-2">Tap RFID</h3>
                <p className="text-sm text-gray-500">Scan your member card at the kiosk terminal</p>
              </div>
              <div className="text-center space-y-3 relative">
                <div className="w-16 h-16 mx-auto bg-blue-100 rounded-2xl flex items-center justify-center">
                  <ClipboardCheck className="w-7 h-7 text-blue-700" />
                </div>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-3 w-7 h-7 bg-blue-700 text-white rounded-full text-sm font-bold flex items-center justify-center">2</div>
                <h3 className="font-semibold text-gray-900 mt-2">Pick Duration</h3>
                <p className="text-sm text-gray-500">Choose your play time and party size</p>
              </div>
              <div className="text-center space-y-3 relative">
                <div className="w-16 h-16 mx-auto bg-amber-100 rounded-2xl flex items-center justify-center">
                  <Monitor className="w-7 h-7 text-amber-700" />
                </div>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-3 w-7 h-7 bg-amber-700 text-white rounded-full text-sm font-bold flex items-center justify-center">3</div>
                <h3 className="font-semibold text-gray-900 mt-2">Watch the Board</h3>
                <p className="text-sm text-gray-500">Live queue updates on the lobby display</p>
              </div>
              <div className="text-center space-y-3 relative">
                <div className="w-16 h-16 mx-auto bg-green-100 rounded-2xl flex items-center justify-center">
                  <Play className="w-7 h-7 text-green-700" />
                </div>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-3 w-7 h-7 bg-green-700 text-white rounded-full text-sm font-bold flex items-center justify-center">4</div>
                <h3 className="font-semibold text-gray-900 mt-2">Play!</h3>
                <p className="text-sm text-gray-500">Court assigned &mdash; head to your court and play</p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 px-4 bg-gray-50">
          <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl shadow-sm border border-green-100 overflow-hidden">
              <div className="h-48 bg-gradient-to-br from-green-600 to-emerald-700 flex items-center justify-center">
                <CourtIllustration />
              </div>
              <div className="p-6 space-y-2">
                <h3 className="font-semibold text-gray-900">Court 1</h3>
                <p className="text-sm text-gray-500">Premium outdoor court with professional-grade surface and LED scoreboard.</p>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-green-100 overflow-hidden">
              <div className="h-48 bg-gradient-to-br from-green-600 to-emerald-700 flex items-center justify-center">
                <CourtIllustration />
              </div>
              <div className="p-6 space-y-2">
                <h3 className="font-semibold text-gray-900">Court 2</h3>
                <p className="text-sm text-gray-500">Shaded court available for daytime play with adjacent waiting area.</p>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-green-100 overflow-hidden">
              <div className="h-48 bg-gradient-to-br from-green-600 to-emerald-700 flex items-center justify-center">
                <CourtIllustration />
              </div>
              <div className="p-6 space-y-2">
                <h3 className="font-semibold text-gray-900">Court 3</h3>
                <p className="text-sm text-gray-500">Regulation-size court with night lighting for evening matches.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 px-4 bg-white">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Why Pickle Point?</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center space-y-3 p-6">
                <Target className="w-10 h-10 mx-auto text-green-600" />
                <h3 className="text-xl font-semibold text-gray-900">Self-Service Booking</h3>
                <p className="text-gray-500 text-sm">Scan your RFID card at the kiosk, pick a time, and start playing. No front desk needed.</p>
              </div>
              <div className="text-center space-y-3 p-6">
                <BarChart3 className="w-10 h-10 mx-auto text-green-600" />
                <h3 className="text-xl font-semibold text-gray-900">Real-Time Queue</h3>
                <p className="text-gray-500 text-sm">See court availability and your position in line live on the lobby display.</p>
              </div>
              <div className="text-center space-y-3 p-6">
                <CreditCard className="w-10 h-10 mx-auto text-green-600" />
                <h3 className="text-xl font-semibold text-gray-900">Auto Billing</h3>
                <p className="text-gray-500 text-sm">Pay-per-play with wallet deduction. No cash, no cards — just tap and play.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="rates" className="py-16 px-4 bg-gray-50">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <h2 className="text-3xl font-bold text-gray-900">Court Rates</h2>
            <p className="text-gray-500">Pay-per-minute rates for one court session. Group rates available for doubles.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {rateEntries.map(([min, price]) => (
                <div key={min} className="bg-white rounded-xl shadow-sm border border-green-100 p-6 hover:shadow-md transition-shadow">
                  <div className="text-2xl font-bold text-green-600">₱{price}</div>
                  <div className="text-sm text-gray-500 mt-1">{min} min</div>
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-400">All rates are per court session. Maximum 4 players per court.</p>
          </div>
        </section>

        <section className="py-16 px-4 bg-green-800 text-white text-center">
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-3xl font-bold">Ready to Play?</h2>
            <p className="text-green-200 text-lg">Visit our self-service kiosk at the court or book instantly online.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/terminal">
                <Button size="lg" className="px-10 py-6 text-lg bg-green-400 text-green-900 hover:bg-green-300 font-semibold">
                  Book a Court
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-8 px-4 text-center text-sm text-gray-400 bg-gray-900">
        <div className="max-w-4xl mx-auto space-y-2">
          <div className="flex items-center justify-center gap-2">
            <div className="w-6 h-6 bg-green-600 rounded flex items-center justify-center text-white text-[8px] font-bold">PP</div>
            <span className="font-semibold text-gray-300">Pickle Point</span>
          </div>
          <p>Pickle Ball Court &mdash; Open Daily 6:00 AM &ndash; 10:00 PM</p>
          <p>&copy; {new Date().getFullYear()} Pickle Point. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Target, BarChart3, CreditCard, Scan, Monitor, Play, ClipboardCheck } from "lucide-react";
import { withTimeout } from "@/lib/utils/timeout";
import Image from "next/image";
import BootAnimation from "@/components/brand/BootAnimation";
import { PP_LOGO, PP_SUBMARK } from "@/constants/brand";

async function getPrices(): Promise<Record<string, number>> {
  try {
    const supabase = await withTimeout(
      createClient(),
      10000,
      () => { throw new Error('createClient timeout'); }
    );

    const { data, error } = await withTimeout(
      supabase.from('settings').select('value').eq('key', 'prices').single(),
      3000,
      () => ({ data: null, error: { message: 'timeout' } } as any)
    );
    if (data?.value && !error) return JSON.parse(data.value);
  } catch {}
  return { "10": 10, "25": 150, "55": 300, "85": 450 };
}

function CourtIllustration() {
  return (
    <Image
      src={PP_LOGO}
      alt="Paddle Point court illustration"
      width={400}
      height={260}
      className="w-full max-w-lg mx-auto"
    />
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
    <>
      <BootAnimation />
      <div className="flex flex-col min-h-screen">
        <header className="px-6 py-4 flex justify-between items-center bg-background/80 backdrop-blur border-b sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <Image src={PP_SUBMARK} alt="Paddle Point" width={32} height={32} />
            <div>
              <div className="text-lg font-bold text-primary leading-tight">Paddle Point</div>
              <div className="text-xs text-primary/70 leading-tight">Solano, Nueva Vizcaya</div>
            </div>
          </div>
          <nav className="flex gap-4 items-center">
            <Link href="/terminal">
              <Button className="bg-secondary text-white hover:bg-secondary/90">Book Now</Button>
            </Link>
            <Link href="/login">
              <Button variant="ghost" className="text-primary hover:bg-primary/10">Staff Login</Button>
            </Link>
          </nav>
        </header>

        <main className="flex-1">
          <section className="py-16 md:py-24 px-4 bg-gradient-to-br from-primary via-primary to-[#1a4a7a] text-white overflow-hidden">
            <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div className="inline-block px-3 py-1 bg-primary-foreground/10 text-primary-foreground text-sm rounded-full border border-primary-foreground/20">
                  Solano, Nueva Vizcaya &bull; 3 Outdoor Courts &bull; Open Daily
                </div>
                <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-tight text-primary-foreground">
                  Your Next <span className="text-secondary">Pickle Ball</span> Game
                  <span className="block text-3xl md:text-4xl font-semibold text-primary-foreground/80">Starts Here</span>
                </h1>
                <p className="text-lg md:text-xl text-primary-foreground/80 max-w-lg">
                  Premium outdoor pickle ball courts with self-service kiosk, RFID tap-in access, and live queue management.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 pt-2">
                  <Link href="/terminal">
                    <Button size="lg" className="px-10 py-6 text-lg bg-secondary text-white hover:bg-secondary/90 font-semibold">
                      Book a Court Now
                    </Button>
                  </Link>
                  <Link href="#how-it-works">
                    <Button size="lg" variant="outline" className="px-10 py-6 text-lg border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10">
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

          <section id="how-it-works" className="py-20 px-4 bg-background">
            <div className="max-w-5xl mx-auto">
              <h2 className="text-3xl font-bold text-center text-primary mb-4">Self-Service Queue &amp; Booking</h2>
              <p className="text-center text-muted-foreground mb-14 max-w-xl mx-auto">
                No front desk required. From scan to play in under a minute.
              </p>
              <div className="grid md:grid-cols-4 gap-6">
                <div className="text-center space-y-3 relative">
                  <div className="w-16 h-16 mx-auto bg-secondary/10 rounded-2xl flex items-center justify-center">
                    <Scan className="w-7 h-7 text-secondary" />
                  </div>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-3 w-7 h-7 bg-secondary text-white rounded-full text-sm font-bold flex items-center justify-center">1</div>
                  <h3 className="font-semibold text-primary mt-2">Tap RFID</h3>
                  <p className="text-sm text-muted-foreground">Scan your member card at the kiosk terminal</p>
                </div>
                <div className="text-center space-y-3 relative">
                  <div className="w-16 h-16 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center">
                    <ClipboardCheck className="w-7 h-7 text-primary" />
                  </div>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-3 w-7 h-7 bg-primary text-white rounded-full text-sm font-bold flex items-center justify-center">2</div>
                  <h3 className="font-semibold text-primary mt-2">Pick Duration</h3>
                  <p className="text-sm text-muted-foreground">Choose your play time and party size</p>
                </div>
                <div className="text-center space-y-3 relative">
                  <div className="w-16 h-16 mx-auto bg-amber-100 rounded-2xl flex items-center justify-center">
                    <Monitor className="w-7 h-7 text-amber-700" />
                  </div>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-3 w-7 h-7 bg-amber-700 text-white rounded-full text-sm font-bold flex items-center justify-center">3</div>
                  <h3 className="font-semibold text-primary mt-2">Watch the Board</h3>
                  <p className="text-sm text-muted-foreground">Live queue updates on the lobby display</p>
                </div>
                <div className="text-center space-y-3 relative">
                  <div className="w-16 h-16 mx-auto bg-secondary/10 rounded-2xl flex items-center justify-center">
                    <Play className="w-7 h-7 text-secondary" />
                  </div>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-3 w-7 h-7 bg-secondary text-white rounded-full text-sm font-bold flex items-center justify-center">4</div>
                  <h3 className="font-semibold text-primary mt-2">Play!</h3>
                  <p className="text-sm text-muted-foreground">Court assigned &mdash; head to your court and play</p>
                </div>
              </div>
            </div>
          </section>

          <section className="py-16 px-4 bg-muted">
            <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
              <div className="bg-background rounded-xl shadow-sm border border-primary/10 overflow-hidden">
                <div className="h-48 bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <CourtIllustration />
                </div>
                <div className="p-6 space-y-2">
                  <h3 className="font-semibold text-primary">Court 1</h3>
                  <p className="text-sm text-muted-foreground">Premium outdoor court with professional-grade surface and LED scoreboard.</p>
                </div>
              </div>
              <div className="bg-background rounded-xl shadow-sm border border-primary/10 overflow-hidden">
                <div className="h-48 bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <CourtIllustration />
                </div>
                <div className="p-6 space-y-2">
                  <h3 className="font-semibold text-primary">Court 2</h3>
                  <p className="text-sm text-muted-foreground">Shaded court available for daytime play with adjacent waiting area.</p>
                </div>
              </div>
              <div className="bg-background rounded-xl shadow-sm border border-primary/10 overflow-hidden">
                <div className="h-48 bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <CourtIllustration />
                </div>
                <div className="p-6 space-y-2">
                  <h3 className="font-semibold text-primary">Court 3</h3>
                  <p className="text-sm text-muted-foreground">Regulation-size court with night lighting for evening matches.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="py-16 px-4 bg-background">
            <div className="max-w-5xl mx-auto">
              <h2 className="text-3xl font-bold text-center text-primary mb-12">Why Paddle Point?</h2>
              <div className="grid md:grid-cols-3 gap-8">
                <div className="text-center space-y-3 p-6">
                  <Target className="w-10 h-10 mx-auto text-primary" />
                  <h3 className="text-xl font-semibold text-primary">Self-Service Booking</h3>
                  <p className="text-muted-foreground text-sm">Scan your RFID card at the kiosk, pick a time, and start playing. No front desk needed.</p>
                </div>
                <div className="text-center space-y-3 p-6">
                  <BarChart3 className="w-10 h-10 mx-auto text-primary" />
                  <h3 className="text-xl font-semibold text-primary">Real-Time Queue</h3>
                  <p className="text-muted-foreground text-sm">See court availability and your position in line live on the lobby display.</p>
                </div>
                <div className="text-center space-y-3 p-6">
                  <CreditCard className="w-10 h-10 mx-auto text-primary" />
                  <h3 className="text-xl font-semibold text-primary">Auto Billing</h3>
                  <p className="text-muted-foreground text-sm">Pay-per-play with wallet deduction. No cash, no cards — just tap and play.</p>
                </div>
              </div>
            </div>
          </section>

          <section id="rates" className="py-16 px-4 bg-muted">
            <div className="max-w-3xl mx-auto text-center space-y-8">
              <h2 className="text-3xl font-bold text-primary">Court Rates</h2>
              <p className="text-muted-foreground">Pay-per-minute rates for one court session. Group rates available for doubles.</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {rateEntries.map(([min, price]) => (
                  <div key={min} className="bg-background rounded-xl shadow-sm border border-primary/10 p-6 hover:border-primary/30 transition-colors">
                    <div className="text-2xl font-bold text-secondary">₱{price}</div>
                    <div className="text-sm text-primary/60 mt-1">{min} min</div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground/70">All rates are per court session. Maximum 4 players per court.</p>
            </div>
          </section>

          <section className="py-16 px-4 bg-primary text-primary-foreground text-center">
            <div className="max-w-2xl mx-auto space-y-6">
              <h2 className="text-3xl font-bold">Ready to Play?</h2>
              <p className="text-primary-foreground/80 text-lg">Visit our self-service kiosk at the court or book instantly online.</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/terminal">
                  <Button size="lg" className="px-10 py-6 text-lg bg-secondary text-white hover:bg-secondary/90 font-semibold">
                    Book a Court
                  </Button>
                </Link>
              </div>
            </div>
          </section>
        </main>

        <footer className="py-8 px-4 text-center text-sm text-primary-foreground/70 bg-primary">
          <div className="max-w-4xl mx-auto space-y-2">
            <div className="flex items-center justify-center gap-2">
              <Image src={PP_SUBMARK} alt="Paddle Point" width={24} height={24} />
              <span className="font-semibold text-primary-foreground">Paddle Point</span>
            </div>
            <p>Solano, Nueva Vizcaya &mdash; Open Daily 6:00 AM &ndash; 10:00 PM</p>
            <p>&copy; {new Date().getFullYear()} Paddle Point. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </>
  );
}

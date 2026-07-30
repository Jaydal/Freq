export interface ProductsConfig {
  matchTypes: string[];
  durations: number[];
  rates: Record<string, number>;
}

export function getCost(config: ProductsConfig, duration: number, partySize: number): number {
  const rate = config.rates[String(duration)] ?? 0;
  return Math.round((rate * (duration / 30)) / (partySize === 4 ? 2 : 1));
}

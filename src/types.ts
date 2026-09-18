export interface WhoisResult {
  ip: string;
  version: 'IPv4' | 'IPv6';
  isValid: boolean;
  provider: string; // e.g. "Cloudflare, Inc." or "Google LLC"
  org?: string;
  isp?: string;
  asn?: {
    asn: number | string;
    name: string;
    route?: string;
  };
  location: {
    country: string;
    countryCode: string;
    region: string;
    city: string;
    postalCode?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
    flagEmoji?: string;
  };
  network: {
    range: string; // e.g. "1.1.1.0 - 1.1.1.255"
    cidr?: string; // e.g. "1.1.1.0/24"
    netmask?: string; // e.g. "255.255.255.0"
    prefixLength?: number;
    parentNet?: string;
    rir?: string; // ARIN, RIPE, APNIC, LACNIC, AFRINIC
  };
  reverseDns?: string[];
  abuseContact?: string;
  latencyMs?: number;
  queriedAt?: string;
  source?: string;
}

export type SlotStatus = 'idle' | 'loading' | 'success' | 'error';

export interface FormSlot {
  id: string;
  ipInput: string;
  status: SlotStatus;
  result?: WhoisResult;
  error?: string;
  suggestion?: string;
  suggestedFix?: string;
  startTime?: number;
}

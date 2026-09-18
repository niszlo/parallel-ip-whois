import express from 'express';
import path from 'path';
import net from 'net';
import dns from 'dns';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json());

// Helper for IPv4 netmask
function getIPv4Netmask(prefixLength: number): string {
  if (prefixLength < 0 || prefixLength > 32) return '255.255.255.255';
  if (prefixLength === 0) return '0.0.0.0';
  const mask = (~0 << (32 - prefixLength)) >>> 0;
  return [
    (mask >>> 24) & 255,
    (mask >>> 16) & 255,
    (mask >>> 8) & 255,
    mask & 255,
  ].join('.');
}

// Helper for IPv6 netmask / prefix notation
function getIPv6Netmask(prefixLength: number): string {
  if (prefixLength <= 0) return '::/0';
  if (prefixLength >= 128) return 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff';
  const fullGroups = Math.floor(prefixLength / 16);
  const remainingBits = prefixLength % 16;
  const groups: string[] = [];
  for (let i = 0; i < fullGroups; i++) {
    groups.push('ffff');
  }
  if (remainingBits > 0) {
    const val = ((0xffff << (16 - remainingBits)) & 0xffff).toString(16).padStart(4, '0');
    groups.push(val);
  }
  while (groups.length < 8) {
    groups.push('0000');
  }
  return groups.join(':');
}

// Checks if an IPv4 address is inside a given CIDR
function isIpv4InCidr(ip: string, cidr: string): boolean {
  try {
    const [netAddr, pfxStr] = cidr.split('/');
    const prefix = parseInt(pfxStr, 10);
    if (isNaN(prefix) || prefix < 0 || prefix > 32) return false;

    const ipToLong = (addr: string) => {
      const parts = addr.split('.').map((p) => parseInt(p, 10));
      if (parts.length !== 4 || parts.some(isNaN)) return 0;
      return (((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0);
    };

    const ipLong = ipToLong(ip);
    const netLong = ipToLong(netAddr);
    const mask = prefix === 0 ? 0 : ((~0 << (32 - prefix)) >>> 0);
    return (ipLong & mask) === (netLong & mask);
  } catch {
    return false;
  }
}

// Expands IPv6 to 8 4-hex groups
function expandIPv6(ip: string): string[] | null {
  try {
    const clean = ip.replace(/^\[|\]$/g, '').trim();
    if (!clean.includes(':')) return null;
    let parts = clean.split(':');
    if (clean.includes('::')) {
      const doubleColonParts = clean.split('::');
      const left = doubleColonParts[0] ? doubleColonParts[0].split(':') : [];
      const right = doubleColonParts[1] ? doubleColonParts[1].split(':') : [];
      const missingCount = 8 - (left.length + right.length);
      const fill = Array(missingCount).fill('0000');
      parts = [...left, ...fill, ...right];
    }
    if (parts.length !== 8) return null;
    return parts.map((p) => p.padStart(4, '0'));
  } catch {
    return null;
  }
}

// Converts IPv6 to BigInt
function ipv6ToBigInt(ip: string): bigint | null {
  const parts = expandIPv6(ip);
  if (!parts) return null;
  try {
    return BigInt('0x' + parts.join(''));
  } catch {
    return null;
  }
}

// Checks if an IPv6 address is inside a given CIDR
function isIpv6InCidr(ip: string, cidr: string): boolean {
  try {
    const [netAddr, pfxStr] = cidr.split('/');
    const prefix = parseInt(pfxStr, 10);
    if (isNaN(prefix) || prefix < 0 || prefix > 128) return false;

    const ipBig = ipv6ToBigInt(ip);
    const netBig = ipv6ToBigInt(netAddr);
    if (ipBig === null || netBig === null) return false;

    if (prefix === 0) return true;
    const mask = ((1n << 128n) - 1n) ^ ((1n << BigInt(128 - prefix)) - 1n);
    return (ipBig & mask) === (netBig & mask);
  } catch {
    return false;
  }
}

// Convert IP and mask to CIDR if needed
function parseCidrFromRange(startIp: string, endIp: string, version: 'IPv4' | 'IPv6'): { cidr?: string; netmask?: string } {
  if (version === 'IPv4') {
    try {
      const ipToLong = (ip: string) =>
        ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
      const start = ipToLong(startIp);
      const end = ipToLong(endIp);
      const diff = end - start + 1;
      if (diff > 0 && (diff & (diff - 1)) === 0) {
        const prefix = 32 - Math.log2(diff);
        return {
          cidr: `${startIp}/${prefix}`,
          netmask: getIPv4Netmask(prefix),
        };
      }
    } catch {
      // ignore
    }
  }
  return {};
}

// Quick timeout wrapper for fetch
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 4500): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
}

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Primary WHOIS / IP Lookup Endpoint
app.get('/api/whois', async (req, res) => {
  const rawIp = (req.query.ip as string || '').trim();
  const startTime = Date.now();

  if (!rawIp) {
    return res.status(400).json({ error: 'IP address query parameter is required (e.g. ?ip=8.8.8.8)' });
  }

  // Remove URL prefixes, CIDR suffix if provided, brackets, and quotes
  let cleanTarget = rawIp
    .replace(/^https?:\/\//i, '')
    .replace(/["']/g, '')
    .trim();

  // If user provided a CIDR like 8.8.8.8/24, keep note of prefix but extract IP for lookup
  let providedPrefix: string | undefined = undefined;
  if (cleanTarget.includes('/')) {
    const parts = cleanTarget.split('/');
    cleanTarget = parts[0];
    providedPrefix = parts[1];
  }
  cleanTarget = cleanTarget.replace(/^\[|\]$/g, '').trim();

  let ipToLookup = cleanTarget;
  let ipFamily = net.isIP(ipToLookup);

  // If not a direct IP, try DNS hostname lookup (e.g. google.com or dns.google)
  if (ipFamily === 0) {
    try {
      const lookupRes = await Promise.race([
        dns.promises.lookup(cleanTarget),
        new Promise<{ address: string; family: number }>((_, reject) =>
          setTimeout(() => reject(new Error('DNS lookup timeout')), 2000)
        ),
      ]);
      ipToLookup = lookupRes.address;
      ipFamily = net.isIP(ipToLookup);
    } catch {
      return res.status(400).json({
        error: `Could not resolve "${rawIp}" as a valid IPv4, IPv6, or domain name.`,
        provided: rawIp,
      });
    }
  }

  if (ipFamily === 0) {
    return res.status(400).json({
      error: `"${rawIp}" is not a valid IPv4 or IPv6 address.`,
      provided: rawIp,
    });
  }

  const cleanIp = ipToLookup;
  const version: 'IPv4' | 'IPv6' = ipFamily === 4 ? 'IPv4' : 'IPv6';

  // 1. Concurrent Reverse DNS lookup
  const reverseDnsPromise = (async () => {
    try {
      const hostnames = await Promise.race([
        dns.promises.reverse(cleanIp),
        new Promise<string[]>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500)),
      ]);
      return hostnames;
    } catch {
      return [];
    }
  })();

  // 2. Fetch IP Intelligence & WHOIS metadata in parallel
  let ipWhoisData: any = null;
  let ripeStatData: any = null;
  let rdapData: any = null;

  try {
    const [ipWhoisRes, ripeStatRes, arinRes, apnicRes, ripeRes] = await Promise.allSettled([
      fetchWithTimeout(`https://ipwho.is/${encodeURIComponent(cleanIp)}`, {
        headers: { 'User-Agent': 'Parallel-IP-Whois/1.0' },
      }),
      fetchWithTimeout(`https://stat.ripe.net/data/network-info/data.json?resource=${encodeURIComponent(cleanIp)}`, {
        headers: { 'User-Agent': 'Parallel-IP-Whois/1.0', Accept: 'application/json' },
      }),
      fetchWithTimeout(`https://rdap.arin.net/registry/ip/${encodeURIComponent(cleanIp)}`, {
        headers: { Accept: 'application/rdap+json, application/json', 'User-Agent': 'Parallel-IP-Whois/1.0' },
      }),
      fetchWithTimeout(`https://rdap.apnic.net/ip/${encodeURIComponent(cleanIp)}`, {
        headers: { Accept: 'application/rdap+json, application/json', 'User-Agent': 'Parallel-IP-Whois/1.0' },
      }),
      fetchWithTimeout(`https://rdap.ripe.net/ip/${encodeURIComponent(cleanIp)}`, {
        headers: { Accept: 'application/rdap+json, application/json', 'User-Agent': 'Parallel-IP-Whois/1.0' },
      }),
    ]);

    if (ipWhoisRes.status === 'fulfilled' && ipWhoisRes.value.ok) {
      ipWhoisData = await ipWhoisRes.value.json();
    }

    if (ripeStatRes.status === 'fulfilled' && ripeStatRes.value.ok) {
      try {
        ripeStatData = await ripeStatRes.value.json();
      } catch {
        // ignore
      }
    }

    // Pick the most complete RDAP response
    const rdapResponses = [arinRes, apnicRes, ripeRes];
    for (const r of rdapResponses) {
      if (r.status === 'fulfilled' && r.value.ok) {
        try {
          const json = await r.value.json();
          if (json && (json.cidr0_cidrs?.length > 0 || json.startAddress || json.name)) {
            rdapData = json;
            break;
          }
        } catch {
          // ignore
        }
      }
    }
  } catch (err: any) {
    console.error(`Error querying IP APIs for ${cleanIp}:`, err.message);
  }

  const reverseDns = await reverseDnsPromise;
  const latencyMs = Date.now() - startTime;

  // Extract / synthesize information
  const provider =
    ipWhoisData?.connection?.org ||
    ipWhoisData?.connection?.isp ||
    rdapData?.name ||
    rdapData?.entities?.find((e: any) => e.roles?.includes('registrant'))?.vcardArray?.[1]?.find((v: any) => v[0] === 'fn')?.[3] ||
    'Unknown Provider';

  const org = ipWhoisData?.connection?.org || rdapData?.name || undefined;
  const isp = ipWhoisData?.connection?.isp || undefined;

  const asnNumber =
    ipWhoisData?.connection?.asn ||
    (ripeStatData?.data?.asns?.[0] ? parseInt(ripeStatData.data.asns[0], 10) : undefined) ||
    rdapData?.autnums?.[0]?.startAutnum;

  const asnName =
    ipWhoisData?.connection?.org ||
    ipWhoisData?.connection?.isp ||
    (asnNumber ? `AS${asnNumber}` : 'N/A');

  // Fine-tuned Datacenter Netblock & CIDR Resolution
  const candidateCidrs: Array<{ cidr: string; source: string; prefixLength: number }> = [];

  // 1. Check all CIDRs in RDAP cidr0_cidrs
  if (rdapData?.cidr0_cidrs && Array.isArray(rdapData.cidr0_cidrs)) {
    for (const c of rdapData.cidr0_cidrs) {
      if (c.v4prefix && typeof c.length === 'number') {
        const fullCidr = `${c.v4prefix}/${c.length}`;
        if (version === 'IPv4' && isIpv4InCidr(cleanIp, fullCidr)) {
          candidateCidrs.push({ cidr: fullCidr, source: 'RIR-RDAP', prefixLength: c.length });
        }
      } else if (c.v6prefix && typeof c.length === 'number') {
        const fullCidr = `${c.v6prefix}/${c.length}`;
        if (version === 'IPv6' && isIpv6InCidr(cleanIp, fullCidr)) {
          candidateCidrs.push({ cidr: fullCidr, source: 'RIR-RDAP', prefixLength: c.length });
        }
      }
    }
  }

  // 2. Check RIPEstat global BGP announced network prefix
  if (ripeStatData?.data?.prefix && typeof ripeStatData.data.prefix === 'string') {
    const pfx = ripeStatData.data.prefix.trim();
    if (pfx.includes('/')) {
      const pLen = parseInt(pfx.split('/')[1], 10);
      const isMatch = version === 'IPv4' ? isIpv4InCidr(cleanIp, pfx) : isIpv6InCidr(cleanIp, pfx);
      if (isMatch && !isNaN(pLen)) {
        candidateCidrs.push({ cidr: pfx, source: 'BGP-RIPEstat', prefixLength: pLen });
      }
    }
  }

  // 3. Check IPWhoIs route
  if (ipWhoisData?.connection?.route && typeof ipWhoisData.connection.route === 'string') {
    const pfx = ipWhoisData.connection.route.trim();
    if (pfx.includes('/')) {
      const pLen = parseInt(pfx.split('/')[1], 10);
      const isMatch = version === 'IPv4' ? isIpv4InCidr(cleanIp, pfx) : isIpv6InCidr(cleanIp, pfx);
      if (isMatch && !isNaN(pLen)) {
        candidateCidrs.push({ cidr: pfx, source: 'IPWhoIs-Route', prefixLength: pLen });
      }
    }
  }

  // 4. Check RDAP startAddress - endAddress
  if (rdapData?.startAddress && rdapData?.endAddress) {
    const parsed = parseCidrFromRange(rdapData.startAddress, rdapData.endAddress, version);
    if (parsed.cidr) {
      const pLen = parseInt(parsed.cidr.split('/')[1], 10);
      const isMatch = version === 'IPv4' ? isIpv4InCidr(cleanIp, parsed.cidr) : isIpv6InCidr(cleanIp, parsed.cidr);
      if (isMatch && !isNaN(pLen)) {
        candidateCidrs.push({ cidr: parsed.cidr, source: 'RDAP-Range', prefixLength: pLen });
      }
    }
  }

  // Determine the optimal fine-tuned Datacenter Netblock Range
  let selectedCidr = '';
  let selectedPrefix = 0;

  if (candidateCidrs.length > 0) {
    // For IPv4:
    // Datacenter allocations typically span /10 to /24 (covering /12 for Cloudflare, /13 for AWS, /15 for Google, /16 for DigitalOcean/Hetzner, /10 for MS Azure, /24 for small blocks).
    // Prioritize RIR-RDAP / BGP allocations between /9 and /24.
    if (version === 'IPv4') {
      const validDatacenterBlocks = candidateCidrs.filter(
        (c) => c.prefixLength >= 8 && c.prefixLength <= 24
      );

      if (validDatacenterBlocks.length > 0) {
        // Sort by most authoritative RIR allocation / datacenter coverage
        // If there's an RIR allocation (e.g. /12, /13, /15, /16), it covers the datacenter infrastructure
        const rirMatch = validDatacenterBlocks.find((c) => c.source === 'RIR-RDAP');
        if (rirMatch) {
          selectedCidr = rirMatch.cidr;
          selectedPrefix = rirMatch.prefixLength;
        } else {
          // Otherwise pick the BGP announced or largest valid datacenter block
          validDatacenterBlocks.sort((a, b) => a.prefixLength - b.prefixLength);
          selectedCidr = validDatacenterBlocks[0].cidr;
          selectedPrefix = validDatacenterBlocks[0].prefixLength;
        }
      } else {
        // Fallback to first matching candidate
        selectedCidr = candidateCidrs[0].cidr;
        selectedPrefix = candidateCidrs[0].prefixLength;
      }
    } else {
      // For IPv6:
      // Datacenter allocations typically span /24 to /48 (e.g. /32 for Cloudflare/Google, /48 for customer subnets)
      const validV6Blocks = candidateCidrs.filter(
        (c) => c.prefixLength >= 20 && c.prefixLength <= 48
      );
      if (validV6Blocks.length > 0) {
        const rirMatch = validV6Blocks.find((c) => c.source === 'RIR-RDAP');
        if (rirMatch) {
          selectedCidr = rirMatch.cidr;
          selectedPrefix = rirMatch.prefixLength;
        } else {
          validV6Blocks.sort((a, b) => a.prefixLength - b.prefixLength);
          selectedCidr = validV6Blocks[0].cidr;
          selectedPrefix = validV6Blocks[0].prefixLength;
        }
      } else {
        selectedCidr = candidateCidrs[0].cidr;
        selectedPrefix = candidateCidrs[0].prefixLength;
      }
    }
  }

  // Fallbacks if no candidate found
  if (!selectedCidr) {
    if (providedPrefix) {
      selectedCidr = `${cleanIp}/${providedPrefix}`;
    } else {
      selectedCidr = version === 'IPv4' ? `${cleanIp}/24` : `${cleanIp}/48`;
    }
  }

  const range = selectedCidr;
  const cidr = selectedCidr;
  const netmask = version === 'IPv4' ? getIPv4Netmask(selectedPrefix || 24) : getIPv6Netmask(selectedPrefix || 48);
  const rir = rdapData?.port43?.replace('.net', '').toUpperCase() || undefined;

  // Extract abuse email if available
  let abuseContact: string | undefined = undefined;
  if (rdapData?.entities) {
    for (const entity of rdapData.entities) {
      if (entity.roles?.includes('abuse')) {
        const vcard = entity.vcardArray?.[1];
        if (vcard) {
          const emailEntry = vcard.find((item: any) => item[0] === 'email');
          if (emailEntry) abuseContact = emailEntry[3];
        }
      }
    }
  }

  const result = {
    ip: cleanIp,
    version,
    isValid: true,
    provider: provider !== 'Unknown Provider' ? provider : (ipWhoisData?.company?.name || 'Unknown / Unassigned'),
    org,
    isp,
    asn: asnNumber
      ? {
          asn: asnNumber,
          name: asnName,
          route: ipWhoisData?.connection?.route || undefined,
        }
      : undefined,
    location: {
      country: ipWhoisData?.country || 'Unknown Country',
      countryCode: ipWhoisData?.country_code || '',
      region: ipWhoisData?.region || ipWhoisData?.region_code || 'Unknown Region',
      city: ipWhoisData?.city || 'Unknown City',
      postalCode: ipWhoisData?.postal || undefined,
      latitude: ipWhoisData?.latitude || undefined,
      longitude: ipWhoisData?.longitude || undefined,
      timezone: ipWhoisData?.timezone?.id || ipWhoisData?.timezone?.utc || undefined,
      flagEmoji: ipWhoisData?.flag?.emoji || undefined,
    },
    network: {
      range: range || `${cleanIp} (host)`,
      cidr: cidr || (version === 'IPv4' ? `${cleanIp}/24` : `${cleanIp}/48`),
      netmask: netmask || (version === 'IPv4' ? '255.255.255.0' : 'ffff:ffff:ffff::'),
      prefixLength: selectedPrefix,
      rir: rir || (ipWhoisData?.connection?.asn ? 'RIR Delegated' : undefined),
    },
    reverseDns: reverseDns.length > 0 ? reverseDns : undefined,
    abuseContact,
    latencyMs,
    queriedAt: new Date().toISOString(),
    source: ipWhoisData?.success ? 'IPWhoIs + RDAP' : (rdapData ? 'RDAP' : 'Direct Lookup'),
  };

  return res.json(result);
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Parallel IP WHOIS server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

export interface PresetGroup {
  name: string;
  description: string;
  ips: string[];
}

export const IP_PRESET_GROUPS: PresetGroup[] = [
  {
    name: 'Top DNS & CDNs (6 Nodes)',
    description: 'Cloudflare, Google, Quad9, AWS, Microsoft, and Fastly',
    ips: [
      '8.8.8.8',          // Google DNS
      '1.1.1.1',          // Cloudflare
      '9.9.9.9',          // Quad9
      '52.95.110.1',      // Amazon AWS
      '20.112.52.29',     // Microsoft
      '151.101.1.69',     // Fastly
    ],
  },
  {
    name: 'IPv6 Global Networks (6 Nodes)',
    description: 'Dual-stack & pure IPv6 addresses across international carriers',
    ips: [
      '2001:4860:4860::8888', // Google IPv6
      '2606:4700:4700::1111', // Cloudflare IPv6
      '2620:fe::fe',          // Quad9 IPv6
      '2a00:1450:4001:810::200e', // Google EU
      '2400:cb00:2048:1::c629:d7a2', // Cloudflare APNIC
      '2600:9000:2000:1::1',  // AWS CloudFront IPv6
    ],
  },
  {
    name: 'Mixed IPv4 & IPv6 Infrastructure (6 Nodes)',
    description: 'Global infrastructure and hosting backbones',
    ips: [
      '142.250.190.46',       // Google
      '104.16.132.229',       // Cloudflare CDN
      '2001:4860:4860::8844', // Google IPv6 Secondary
      '185.199.108.153',      // GitHub Fastly
      '76.76.21.21',          // Vercel Anycast
      '2606:4700::6810:84e5', // Cloudflare IPv6 Anycast
    ],
  },
];

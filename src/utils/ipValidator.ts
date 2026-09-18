/**
 * Strict IPv4 Regex
 * Validates 4 decimal octets (0-255) separated by dots, with optional CIDR mask (/0-32).
 * e.g., "1.2.3.4", "8.8.8.8", "192.168.1.1/24"
 */
export const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])(?:\/(?:3[0-2]|[12]?[0-9]))?$/;

/**
 * Strict IPv6 Regex
 * Validates standard 8-group notation, compressed "::" notation, IPv4-mapped IPv6,
 * and optional prefix length (/0-128).
 * e.g., "1:2:3:4:55:6:7:8", "2001:4860:4860::8888", "2606:4700:4700::1111", "::1"
 */
export const IPV6_REGEX = /^(?:(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:(?::[0-9a-fA-F]{1,4}){1,6}|:(?:(?::[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(?::[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(?:ffff(?::0{1,4}){0,1}:){0,1}(?:(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])|(?:[0-9a-fA-F]{1,4}:){1,4}:(?:(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9]))(?:\/(?:12[0-8]|1[01][0-9]|[1-9]?[0-9]))?$/i;

/**
 * Checks if a string is a valid IPv4 address (or CIDR) via regex
 */
export function isValidIPv4(ip: string): boolean {
  return IPV4_REGEX.test(ip.trim());
}

/**
 * Checks if a string is a valid IPv6 address via regex
 */
export function isValidIPv6(ip: string): boolean {
  const clean = ip.trim().replace(/^\[|\]$/g, '');
  return IPV6_REGEX.test(clean);
}

/**
 * Detect IP type: 'IPv4' | 'IPv6' | 'invalid' | 'empty'
 */
export function detectIpType(ip: string): 'IPv4' | 'IPv6' | 'invalid' | 'empty' {
  const trimmed = ip.trim().replace(/^\[|\]$/g, '');
  if (!trimmed) return 'empty';
  if (isValidIPv4(trimmed)) return 'IPv4';
  if (isValidIPv6(trimmed)) return 'IPv6';
  return 'invalid';
}

export interface IpPrecheckResult {
  isValid: boolean;
  version?: 'IPv4' | 'IPv6';
  cleanedIp: string;
  errorMessage?: string;
  suggestion?: string;
  suggestedFix?: string;
}

/**
 * Prechecks an IP entry before sending any network request.
 * If invalid format, stops request execution and provides concrete suggestions to fix the entry.
 */
export function validateIpPrecheck(rawInput: string): IpPrecheckResult {
  const trimmed = rawInput.trim().replace(/^https?:\/\//i, '').replace(/^\[|\]$/g, '');

  if (!trimmed) {
    return {
      isValid: false,
      cleanedIp: '',
      errorMessage: 'Please enter an IP address before running a query.',
      suggestion: 'Provide a valid IPv4 (e.g. 1.2.3.4, 8.8.8.8) or IPv6 (e.g. 2001:4860:4860::8888).',
    };
  }

  // 1. Precheck IPv4 regex
  if (IPV4_REGEX.test(trimmed)) {
    return {
      isValid: true,
      version: 'IPv4',
      cleanedIp: trimmed,
    };
  }

  // 2. Precheck IPv6 regex
  if (IPV6_REGEX.test(trimmed)) {
    return {
      isValid: true,
      version: 'IPv6',
      cleanedIp: trimmed,
    };
  }

  // 3. Regex failed - generate specific actionable suggestions to correct entry
  let suggestion = 'Please format the entry as a standard IPv4 (e.g. 1.2.3.4) or IPv6 address (e.g. 2001:4860:4860::8888 or 1:2:3:4:55:6:7:8).';
  let suggestedFix: string | undefined = undefined;

  // Case A: Dot-separated (attempted IPv4)
  if (trimmed.includes('.') && !trimmed.includes(':')) {
    const withoutCidr = trimmed.split('/')[0];
    const parts = withoutCidr.split('.');
    
    if (parts.length < 4) {
      suggestion = `IPv4 requires exactly 4 octets (e.g. 1.2.3.4). You provided ${parts.length} octet${parts.length === 1 ? '' : 's'}.`;
      if (parts.length === 3 && parts.every((p) => /^\d+$/.test(p) && parseInt(p, 10) <= 255)) {
        suggestedFix = `${parts.join('.')}.1`;
      }
    } else if (parts.length > 4) {
      suggestion = `IPv4 format only contains 4 octets separated by dots. Found ${parts.length} octets.`;
      if (parts.slice(0, 4).every((p) => /^\d+$/.test(p) && parseInt(p, 10) <= 255)) {
        suggestedFix = parts.slice(0, 4).join('.');
      }
    } else {
      const invalidOctets = parts.filter((p) => !/^\d+$/.test(p) || parseInt(p, 10) > 255 || parseInt(p, 10) < 0);
      if (invalidOctets.length > 0) {
        suggestion = `Octet "${invalidOctets.join(', ')}" is invalid. Each IPv4 octet must be a decimal number between 0 and 255 (e.g. 1.2.3.4).`;
      }
    }
  } 
  // Case B: Colon-separated (attempted IPv6)
  else if (trimmed.includes(':')) {
    const doubleColons = (trimmed.match(/::/g) || []).length;
    if (doubleColons > 1) {
      suggestion = `IPv6 syntax allows at most one "::" compression marker. Found ${doubleColons}. Example: 2001:4860:4860::8888.`;
    } else {
      const parts = trimmed.split('/')[0].split(':').filter((p) => p !== '');
      const invalidHex = parts.filter((p) => !/^[0-9a-fA-F]{1,4}$/.test(p));
      if (invalidHex.length > 0) {
        suggestion = `Hex group "${invalidHex.join(', ')}" is invalid. IPv6 groups must have 1-4 hexadecimal characters (0-9, a-f). Example: 1:2:3:4:55:6:7:8.`;
      } else {
        suggestion = `Invalid IPv6 structure. Standard IPv6 has up to 8 groups (e.g. 2606:4700:4700::1111 or 1:2:3:4:55:6:7:8).`;
      }
    }
  } 
  // Case C: Plain text or domain
  else {
    suggestion = `Only raw IP addresses are accepted. Please provide an IPv4 (e.g. 1.2.3.4, 8.8.8.8) or IPv6 address (e.g. 2606:4700:4700::1111).`;
  }

  return {
    isValid: false,
    cleanedIp: trimmed,
    errorMessage: `Invalid IP format: "${trimmed}"`,
    suggestion,
    suggestedFix,
  };
}

export interface ParsedBulkIp {
  id: string;
  original: string;
  cleaned: string;
  precheck: IpPrecheckResult;
  targetNodeIndex: number; // 0-indexed (0 to 5 -> Node 1 to Node 6)
}

export interface BulkIpParseResult {
  items: ParsedBulkIp[];
  validCount: number;
  invalidCount: number;
  totalParsed: number;
  hasErrors: boolean;
  canSend: boolean;
}

/**
 * Parses multi-line, comma-separated, or space-separated IP lists (up to maxCount, default 6)
 * and validates each entry against IPv4/IPv6 regex.
 */
export function parseAndValidateBulkIps(rawText: string, maxCount = 6): BulkIpParseResult {
  if (!rawText || !rawText.trim()) {
    return {
      items: [],
      validCount: 0,
      invalidCount: 0,
      totalParsed: 0,
      hasErrors: false,
      canSend: false,
    };
  }

  const lines = rawText.split(/[\r\n]+/);
  const rawTokens: string[] = [];

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    // Strip leading list bullet/number markers like "1. ", "1) ", "[1] ", "Node 1: ", "- ", "* "
    line = line.replace(/^(?:\[\d+\]|\d+[\)\.]|node\s*\d+[\:\-]?|ip\s*\d+[\:\-]?|[-*•])\s+/i, '');

    // Split line by commas, semicolons, tabs
    const subParts = line.split(/[,;\t]+/);
    for (const part of subParts) {
      const trimmedPart = part.trim();
      if (!trimmedPart) continue;

      // Handle space-separated tokens on a single line
      const spaceTokens = trimmedPart.split(/\s+/);
      for (let token of spaceTokens) {
        token = token
          .trim()
          .replace(/^https?:\/\//i, '')
          .replace(/^[\[\"\'\(\<]+|[\]\"\'\)\>]+$/g, '')
          .replace(/[,;]+$/g, '')
          .trim();

        if (token) {
          rawTokens.push(token);
        }
      }
    }
  }

  // Limit to maxCount tokens (e.g. 6)
  const targetTokens = rawTokens.slice(0, maxCount);

  const items: ParsedBulkIp[] = targetTokens.map((token, idx) => {
    const precheck = validateIpPrecheck(token);
    return {
      id: `bulk-${idx + 1}`,
      original: token,
      cleaned: precheck.cleanedIp || token,
      precheck,
      targetNodeIndex: idx,
    };
  });

  const validCount = items.filter((i) => i.precheck.isValid).length;
  const invalidCount = items.filter((i) => !i.precheck.isValid).length;

  return {
    items,
    validCount,
    invalidCount,
    totalParsed: items.length,
    hasErrors: invalidCount > 0,
    canSend: items.length > 0 && validCount > 0,
  };
}


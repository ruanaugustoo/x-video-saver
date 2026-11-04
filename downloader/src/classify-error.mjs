//   network   -> connection / temporary limit: retry with backoff and count toward the breaker
//   permanent -> no video, deleted, protected...: retrying will not help
//   unknown   -> not recognized: no retry, does not trip the breaker
//   fatal     -> configuration problem (e.g. unreadable cookies): every next link would fail
//                the same way, so the run stops right away

const PERMANENT =
  /no video could be found|tweet.{0,20}unavailable|unavailable.{0,20}tweet|protected|is private|suspended|age[- ]restricted|nsfw|sign in|log ?in|requires? auth|http error (?:401|403|404)|certificate verify failed|not available in your country|removed|deleted|does not exist/i;

const FATAL =
  /could not copy .{0,20}cookie database|failed to decrypt with dpapi|could not find .{0,30}cookies? (?:database|file)|unsupported browser|failed to (?:load|read|parse) cookies?|cookies? file .{0,60}(?:not found|does not exist)/i;

const NETWORK =
  /timed? ?out|timeout|connection (?:reset|aborted|refused|error)|temporary failure|name resolution|getaddrinfo|name or service not known|nodename nor servname|network is unreachable|no route to host|urlopen error|remote end closed|incomplete ?read|read error|broken pipe|unexpected eof|transporterror|http error (?:429|5\d\d)|too many requests|rate.?limit|unable to download (?:json|webpage|video)/i;

/**
 * @param {string} [output] stderr (or stdout) from yt-dlp
 * @returns {{ kind: 'network' | 'permanent' | 'fatal' | 'unknown', reason: string }}
 */
export function classifyError(output = '') {
  const lines = output
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const errorLine = [...lines].reverse().find((l) => l.startsWith('ERROR:')) ?? lines.at(-1) ?? '';
  const reason =
    errorLine.replace(/^ERROR:\s*(?:\[[^\]]+\]\s*(?:[\w-]+:\s*)?)?/, '').slice(0, 160) ||
    'unknown error';

  if (FATAL.test(errorLine)) return { kind: 'fatal', reason };

  // Temporary HTTP codes win over the "permanent" check (e.g. 503 Service Unavailable).
  if (/http error (?:429|5\d\d)/i.test(errorLine)) return { kind: 'network', reason };
  if (PERMANENT.test(errorLine)) return { kind: 'permanent', reason };
  if (NETWORK.test(errorLine)) return { kind: 'network', reason };
  return { kind: 'unknown', reason };
}

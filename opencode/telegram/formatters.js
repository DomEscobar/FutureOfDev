/**
 * Pure formatting helpers
 * No side effects, no I/O — just data → string transformations
 */

/**
 * Escape MarkdownV2 special characters
 * @param {string} str
 * @returns {string}
 */
function escapeMarkdown(str) {
  if (typeof str !== 'string') return str;
  // Escape backslash first to avoid double-escaping
  let s = String(str).replace(/\\/g, '\\\\');
  // Escape all MarkdownV2 special characters: _ * [ ] ( ) ~ ` > # + = | { } . ! \
  return s.replace(/[_\*\[\(\)\~\`\>\#\+\=\|\{\}\.\!\\\-]/g, '\\$&');
}

/**
 * Build a progress bar
 * @param {number} percent 0-100
 * @param {number} size number of characters (default 10)
 * @returns {string} e.g. "▰▰▰▰▱▱▱▱▱▱ 40%"
 */
exports.progressBar = (percent, size = 10) => {
  const p = Math.max(0, Math.min(100, percent));
  const filled = Math.round(size * p / 100);
  const bar = '▰'.repeat(filled) + '▱'.repeat(size - filled);
  return `${bar} ${p}%`;
};

/**
 * Get severity emoji/icon
 * @param {string} severity HIGH|MEDIUM|LOW|INFO
 * @returns {string}
 */
exports.severityBadge = (severity) => {
  const map = {
    HIGH: '🔴',
    MEDIUM: '🟡',
    LOW: '🟢',
    INFO: '🔵'
  };
  return map[severity?.toUpperCase()] || '⚪';
};

/**
 * Format cost with visual indicator for high spend
 * @param {string|number} cost
 * @returns {string} e.g. "$0.0421" or "$1.2345 ⚠️"
 */
exports.formatCost = (cost) => {
  const n = parseFloat(cost) || 0;
  const base = `$${n.toFixed(4)}`;
  return n > 0.1 ? `${base} ⚠️` : base;
};

/**
 * Format seconds into human duration
 * @param {number} seconds
 * @returns {string} e.g. "7m 23s", "2m 0s", "45s"
 */
exports.formatDuration = (seconds) => {
  if (!seconds || seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
};

/**
 * Format timestamp to readable date/time
 * @param {string|Date} ts
 * @returns {string}
 */
exports.formatDate = (ts) => {
  const d = new Date(ts);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Truncate with ellipsis, safe for null/undefined
 * @param {string} str
 * @param {number} max
 * @returns {string}
 */
exports.truncate = (str, max = 30) => {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
};

/**
 * Escape and bold for MarkdownV2
 * @param {string} str
 * @returns {string}
 */
exports.bold = (str) => `*${escapeMarkdown(str)}*`;
exports.italic = (str) => `_${escapeMarkdown(str)}_`;
exports.code = (str) => `\`${str}\``;
exports.escapeMarkdown = escapeMarkdown;

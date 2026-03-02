/**
 * Telegram Reporting — Clean, Beautiful, Modular
 * 
 * This module provides pure formatting functions and template builders
 * for Agency and Player telemetry messages.
 * 
 * Usage:
 *   const tg = require('./telegram');
 *   const payload = tg.renderAgency(state);
 *   sendToTelegram(payload.text, state, payload.reply_markup);
 */

const { formatCost, formatDuration, progressBar, severityBadge } = require('./formatters');
const { 
  agencyDashboard, 
  playerDashboard, 
  findingCard, 
  kpiSummary 
} = require('./templates');
const { 
  reRunExplorer, 
  verifyFix, 
  muteFor, 
  viewLog, 
  combine 
} = require('./buttons');

/**
 * Main public API
 */
module.exports = {
  // Agency pipeline status
  renderAgency: (state, options = {}) => {
    // Build button rows
    const rows = [
      reRunExplorer(),
      muteFor(30),
      viewLog('telemetry')
    ];
    // If this run is for a specific finding, add verify button
    if (state.findingId) {
      rows.unshift(verifyFix(state.findingId));
    }
    return {
      text: agencyDashboard(state, options),
      parse_mode: 'MarkdownV2',
      reply_markup: combine(...rows)
    };
  },

  // Player session status
  renderPlayer: (state, options = {}) => ({
    text: playerDashboard(state, options),
    parse_mode: 'MarkdownV2',
    reply_markup: combine(
      reRunExplorer(),
      muteFor(30),
      viewLog('journal')
    )
  }),

  // Single UX finding card
  renderFinding: (finding, status = 'NEW') => ({
    text: findingCard(finding, status),
    parse_mode: 'MarkdownV2',
    reply_markup: combine(
      verifyFix(finding.id),
      reRunExplorer(),
      viewLog('diff')
    )
  }),

  // Daily KPI summary
  renderKpi: (stats) => ({
    text: kpiSummary(stats),
    parse_mode: 'MarkdownV2',
    reply_markup: null
  }),

  // Low\-level helpers (exposed for custom extensions)
  _formatters: { formatCost, formatDuration, progressBar, severityBadge }
};

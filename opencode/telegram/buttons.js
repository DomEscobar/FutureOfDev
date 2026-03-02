/**
 * Inline keyboard button builders
 * Each returns an array of button objects for Telegram Bot API
 */

/**
 * Base button factory
 * @param {string} text - Button label
 * @param {string} callback_data - Unique callback identifier
 * @param {boolean} primary - Use primary (blue) style
 * @returns {object}
 */
function button(text, callback_data, primary = false) {
  return {
    text,
    callback_data,
    ...(primary && { style: 'primary' }) // Telegram likes "primary"/"secondary" in some libs
  };
}

/**
 * [🔄 Re‑run Explorer] — triggers immediate player exploration
 */
exports.reRunExplorer = () => [[button('🔄 Re‑run Explorer', 'explorer_run')]];

/**
 * [✅ Verify Fix] — runs focused verification for a finding
 * @param {string} findingId
 */
exports.verifyFix = (findingId) => [[button('✅ Verify Fix', `verify_fix:${findingId}`)]];

/**
 * [🔕 Mute N min] — silence notifications temporarily
 * @param {number} minutes
 */
exports.muteFor = (minutes) => [[button(`🔕 Mute ${minutes}m`, `mute:${minutes}`)]];

/**
 * [📋 View Log] — send or display log file
 * @param {string} type - 'telemetry'|'journal'|'diff'|'log'
 */
exports.viewLog = (type) => [[button(`📋 View ${type}`, `view_log:${type}`)]];

/**
 * Combine multiple rows into a keyboard layout
 * @param  {...Array<Array<object>>} rows
 * @returns {{inline_keyboard: Array<Array<object>>}}
 */
exports.combine = (...rows) => {
  const keyboard = rows.filter(row => Array.isArray(row) && row.length > 0);
  return keyboard.length > 0 ? { inline_keyboard: keyboard.flat() } : null;
};

/**
 * Quick action panel (common set)
 */
exports.actionPanel = (findingId = null) => {
  const base = [
    ['🔄 Re‑run Explorer', 'explorer_run'],
    ['📊 Status', 'status']
  ];
  if (findingId) {
    base.push(['✅ Verify Fix', `verify_fix:${findingId}`]);
  }
  base.push(['🔕 Mute 30m', 'mute:30']);
  return { inline_keyboard: base.map(([text, cb]) => button(text, cb)) };
};

/**
 * Confirmation buttons (Yes/No)
 */
exports.confirm = (action) => [
  [button('✅ Yes', `confirm:${action}`), button('❌ No', 'confirm:cancel')]
];

const { describe, it } = require('node:test');
const assert = require('node:assert');

const formatters = require('../telegram/formatters');

describe('telegram formatters', () => {
    describe('progressBar', () => {
        it('returns bar string with percent', () => {
            const out = formatters.progressBar(40, 10);
            assert.ok(out.includes('40%'));
            assert.ok(out.includes('▰'));
            assert.ok(out.includes('▱'));
        });
        it('clamps percent to 0-100', () => {
            assert.ok(formatters.progressBar(-10).startsWith('▱'));
            assert.ok(formatters.progressBar(150).includes('100%'));
        });
        it('uses default size 10', () => {
            const out = formatters.progressBar(50);
            const filled = (out.match(/▰/g) || []).length;
            const empty = (out.match(/▱/g) || []).length;
            assert.strictEqual(filled + empty, 10);
        });
    });

    describe('severityBadge', () => {
        it('maps HIGH to red, MEDIUM to yellow, LOW to green, INFO to blue', () => {
            assert.strictEqual(formatters.severityBadge('HIGH'), '🔴');
            assert.strictEqual(formatters.severityBadge('MEDIUM'), '🟡');
            assert.strictEqual(formatters.severityBadge('LOW'), '🟢');
            assert.strictEqual(formatters.severityBadge('INFO'), '🔵');
        });
        it('returns default for unknown severity', () => {
            assert.strictEqual(formatters.severityBadge('UNKNOWN'), '⚪');
            assert.strictEqual(formatters.severityBadge(), '⚪');
        });
        it('is case insensitive', () => {
            assert.strictEqual(formatters.severityBadge('high'), '🔴');
        });
    });

    describe('formatCost', () => {
        it('formats number to 4 decimals with dollar sign', () => {
            assert.strictEqual(formatters.formatCost(0.0421), '$0.0421');
            assert.strictEqual(formatters.formatCost('0.05'), '$0.0500');
        });
        it('adds warning for cost > 0.1', () => {
            assert.ok(formatters.formatCost(0.5).includes('⚠️'));
            assert.ok(!formatters.formatCost(0.05).includes('⚠️'));
        });
        it('handles invalid input as zero', () => {
            assert.strictEqual(formatters.formatCost('x'), '$0.0000');
        });
    });

    describe('formatDuration', () => {
        it('returns seconds when under 60', () => {
            assert.strictEqual(formatters.formatDuration(45), '45s');
            assert.strictEqual(formatters.formatDuration(0), '0s');
        });
        it('returns minutes and seconds when >= 60', () => {
            assert.strictEqual(formatters.formatDuration(125), '2m 5s');
            assert.strictEqual(formatters.formatDuration(60), '1m 0s');
        });
        it('handles null/undefined', () => {
            assert.ok(formatters.formatDuration(null).endsWith('s'));
            assert.ok(formatters.formatDuration(undefined).endsWith('s'));
        });
    });

    describe('escapeMarkdown', () => {
        it('escapes MarkdownV2 special chars', () => {
            const out = formatters.escapeMarkdown('a_b*c');
            assert.ok(out.includes('\\'));
        });
        it('handles non-string', () => {
            assert.strictEqual(formatters.escapeMarkdown(123), 123);
        });
    });

    describe('truncate', () => {
        it('returns string as-is when under max', () => {
            assert.strictEqual(formatters.truncate('short', 30), 'short');
        });
        it('truncates with ellipsis when over max', () => {
            const long = 'a'.repeat(40);
            const out = formatters.truncate(long, 30);
            assert.strictEqual(out.length, 30);
            assert.ok(out.endsWith('…'));
        });
        it('returns empty for null/undefined', () => {
            assert.strictEqual(formatters.truncate(null), '');
            assert.strictEqual(formatters.truncate(undefined), '');
        });
    });

    describe('bold and italic', () => {
        it('wraps in markdown bold/italic', () => {
            assert.ok(formatters.bold('x').startsWith('*'));
            assert.ok(formatters.bold('x').endsWith('*'));
            assert.ok(formatters.italic('x').startsWith('_'));
            assert.ok(formatters.italic('x').endsWith('_'));
        });
    });
});

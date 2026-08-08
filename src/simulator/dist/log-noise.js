"use strict";
// src/simulator/log-noise.ts
//
// Independently rolls a chance to emit a log line matching each pattern
// the Loki ruler is watching for (test-compass_loki_rules.yml), so you can
// trigger those alerts — and generate labeled training data for whatever
// you're training on top of the alert-storm/dedup/triage pipeline —
// without touching the HTTP status-code path at all.
//
// Each pattern rolls independently (not mutually exclusive with the
// others, or with the real response status) — same "one knob per outcome"
// shape as success_chance/fast_chance in the controller.
exports.__esModule = true;
exports.parseBoolOrNull = exports.parseChanceOrNull = exports.injectLogNoise = exports.DEFAULT_LOG_NOISE_CONFIG = void 0;
exports.DEFAULT_LOG_NOISE_CONFIG = {
    exception_chance: 0,
    fatal_chance: 0,
    oom_chance: 0,
    conn_error_chance: 0,
    storm_flag: false
};
var PATTERNS = [
    {
        key: 'exception_chance',
        trigger: 'log_exception_pattern',
        messages: [
            'Unhandled exception in request handler\nTraceback (most recent call last):\n  File "handler.py", line 42, in process\nRuntimeError: simulated failure',
            'Traceback (most recent call last):\n  File "worker.py", line 17, in run\nValueError: simulated failure',
        ]
    },
    {
        key: 'fatal_chance',
        trigger: 'log_fatal_burst',
        messages: [
            'FATAL: unrecoverable state detected, process exiting',
            'panic: simulated panic — runtime invariant violated',
        ]
    },
    {
        key: 'oom_chance',
        trigger: 'oom_log_signal',
        messages: [
            'Out of memory: heap allocation failed after 3 retries',
            'oom: process exceeded memory limit, killing worker',
        ]
    },
    {
        key: 'conn_error_chance',
        trigger: 'dependency_connection_errors',
        messages: [
            'connect ECONNREFUSED — connection refused by downstream service',
            'connection reset by peer while reading response',
            'could not connect to database: timeout after 5000ms',
        ]
    },
];
function randInt(min, max) {
    if (max <= min)
        return min;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(items) {
    return items[randInt(0, items.length - 1)];
}
/**
 * Rolls each pattern independently against its configured chance and logs
 * the ones that hit. Returns the list of triggers that fired, so the
 * caller can attach it to the response-generation log line for easy
 * correlation/labeling when you go train on the output.
 */
function injectLogNoise(logger, config, context) {
    var _a;
    var fired = [];
    for (var _i = 0, PATTERNS_1 = PATTERNS; _i < PATTERNS_1.length; _i++) {
        var pattern = PATTERNS_1[_i];
        var chance = (_a = config[pattern.key]) !== null && _a !== void 0 ? _a : 0;
        if (chance <= 0)
            continue;
        var roll = randInt(1, 100);
        if (roll > chance)
            continue;
        logger.error(pick(pattern.messages), {
            correlation_id: context.correlation_id,
            path: context.path,
            simulated: true,
            test_compass_trigger: pattern.trigger
        });
        fired.push(pattern.trigger);
    }
    if (config.storm_flag) {
        logger.warn('test-compass_test_storm_flag=1', {
            correlation_id: context.correlation_id,
            path: context.path,
            simulated: true,
            test_compass_trigger: 'synthetic_storm_test'
        });
        fired.push('synthetic_storm_test');
    }
    return fired;
}
exports.injectLogNoise = injectLogNoise;
function parseChanceOrNull(v) {
    if (typeof v !== 'string' || v === '')
        return null;
    var n = Number.parseInt(v, 10);
    if (!Number.isFinite(n) || n < 0 || n > 100)
        return null;
    return n;
}
exports.parseChanceOrNull = parseChanceOrNull;
function parseBoolOrNull(v) {
    if (typeof v !== 'string' || v === '')
        return null;
    if (v === '1' || v.toLowerCase() === 'true')
        return true;
    if (v === '0' || v.toLowerCase() === 'false')
        return false;
    return null;
}
exports.parseBoolOrNull = parseBoolOrNull;

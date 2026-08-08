"use strict";
// src/simulator/simulator.controller.ts
//
// customization paths :
//   1. GET/PUT /config — shared runtime defaults, changeable without a
//      restart (dial success_chance to 0 mid-demo to trigger
//      CompassHighErrorRate on purpose; dial exception_chance/fatal_chance/
//      oom_chance/conn_error_chance to trigger the Loki-side alerts the
//      same way).
//   2. Per-request query overrides — ?success_chance=0&fast_chance=0, or
//      ?exception_chance=100&storm_flag=1 — forces one specific outcome
//      without touching what concurrent requests get.
//
// Depends on:
//   - CorrelationIdMiddleware (req.correlationId)
//   - MetricsInterceptor (already recording http_requests_total /
//     http_request_duration_seconds globally — nothing extra needed here)
//   - the Winston/Loki logger from logger.config.ts
//   - log-noise.ts — independent probabilistic log-pattern injection,
//     matching test-compass_loki_rules.yml so you can trigger those
//     alerts (and generate labeled training data) on demand
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.SimulatorController = void 0;
var common_1 = require("@nestjs/common");
var common_2 = require("@nestjs/common");
var nest_winston_1 = require("nest-winston");
var log_noise_1 = require("./log-noise");
var FAILURE_CODES = [400, 504];
var SimulatorController = /** @class */ (function () {
    function SimulatorController(configService, logger) {
        this.configService = configService;
        this.logger = logger;
    }
    SimulatorController.prototype.getConfig = function () {
        return this.configService.get();
    };
    SimulatorController.prototype.updateConfig = function (body) {
        return this.configService.set(body);
    };
    SimulatorController.prototype.status = function (req, res, query) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.simulate(req, res, query)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    SimulatorController.prototype.info = function (req, res, query) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.simulate(req, res, query)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    SimulatorController.prototype.simulate = function (req, res, query) {
        var _a, _b, _c, _d;
        return __awaiter(this, void 0, void 0, function () {
            var _e, config, overridden, _f, logNoiseConfig, logNoiseOverridden, fastRoll, isFast, latencyMs, status, firedPatterns;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        _e = this.resolveConfig(query), config = _e.config, overridden = _e.overridden;
                        _f = this.resolveLogNoiseConfig(query), logNoiseConfig = _f.logNoiseConfig, logNoiseOverridden = _f.logNoiseOverridden;
                        fastRoll = randInt(1, 100);
                        isFast = fastRoll <= config.fast_chance;
                        latencyMs = isFast
                            ? randInt(1, config.fast_duration_ms)
                            : randInt(config.fast_duration_ms + 1, 1000);
                        return [4 /*yield*/, sleep(latencyMs)];
                    case 1:
                        _g.sent();
                        status = this.rollStatusCode(config.success_chance);
                        firedPatterns = log_noise_1.injectLogNoise(this.logger, logNoiseConfig, {
                            correlation_id: req.correlationId,
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                            path: (_b = (_a = req.route) === null || _a === void 0 ? void 0 : _a.path) !== null && _b !== void 0 ? _b : req.path
                        });
                        this.logger.info('simulated response generated', {
                            correlation_id: req.correlationId,
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                            path: (_d = (_c = req.route) === null || _c === void 0 ? void 0 : _c.path) !== null && _d !== void 0 ? _d : req.path,
                            status: status,
                            simulated_latency_ms: latencyMs,
                            success_chance: config.success_chance,
                            fast_chance: config.fast_chance,
                            fast_duration_ms: config.fast_duration_ms,
                            config_overridden: overridden,
                            log_noise_fired: firedPatterns,
                            log_noise_overridden: logNoiseOverridden
                        });
                        res.status(status).json({ response: 'pong' });
                        return [2 /*return*/];
                }
            });
        });
    };
    // Layers query-param overrides on top of the shared default config —
    // same precedence as the Go version's resolveConfig().
    SimulatorController.prototype.resolveConfig = function (query) {
        var config = this.configService.get();
        var overridden = false;
        var successChance = parseIntOrNull(query.success_chance);
        if (successChance !== null && inRange(successChance)) {
            config.success_chance = successChance;
            overridden = true;
        }
        var fastChance = parseIntOrNull(query.fast_chance);
        if (fastChance !== null && inRange(fastChance)) {
            config.fast_chance = fastChance;
            overridden = true;
        }
        var fastDurationMs = parseIntOrNull(query.fast_duration_ms);
        if (fastDurationMs !== null && fastDurationMs >= 1) {
            config.fast_duration_ms = fastDurationMs;
            overridden = true;
        }
        return { config: config, overridden: overridden };
    };
    // Same layering pattern as resolveConfig(), but for the log-noise knobs.
    // Defaults come from SimulatorConfigService (extend EndpointConfig with
    // the LogNoiseConfig fields — see note below), query params override
    // per-request.
    SimulatorController.prototype.resolveLogNoiseConfig = function (query) {
        var _a, _b, _c, _d, _e;
        var stored = this.configService.get();
        var logNoiseConfig = {
            exception_chance: (_a = stored.exception_chance) !== null && _a !== void 0 ? _a : log_noise_1.DEFAULT_LOG_NOISE_CONFIG.exception_chance,
            fatal_chance: (_b = stored.fatal_chance) !== null && _b !== void 0 ? _b : log_noise_1.DEFAULT_LOG_NOISE_CONFIG.fatal_chance,
            oom_chance: (_c = stored.oom_chance) !== null && _c !== void 0 ? _c : log_noise_1.DEFAULT_LOG_NOISE_CONFIG.oom_chance,
            conn_error_chance: (_d = stored.conn_error_chance) !== null && _d !== void 0 ? _d : log_noise_1.DEFAULT_LOG_NOISE_CONFIG.conn_error_chance,
            storm_flag: (_e = stored.storm_flag) !== null && _e !== void 0 ? _e : log_noise_1.DEFAULT_LOG_NOISE_CONFIG.storm_flag
        };
        var overridden = false;
        var exceptionChance = log_noise_1.parseChanceOrNull(query.exception_chance);
        if (exceptionChance !== null) {
            logNoiseConfig.exception_chance = exceptionChance;
            overridden = true;
        }
        var fatalChance = log_noise_1.parseChanceOrNull(query.fatal_chance);
        if (fatalChance !== null) {
            logNoiseConfig.fatal_chance = fatalChance;
            overridden = true;
        }
        var oomChance = log_noise_1.parseChanceOrNull(query.oom_chance);
        if (oomChance !== null) {
            logNoiseConfig.oom_chance = oomChance;
            overridden = true;
        }
        var connErrorChance = log_noise_1.parseChanceOrNull(query.conn_error_chance);
        if (connErrorChance !== null) {
            logNoiseConfig.conn_error_chance = connErrorChance;
            overridden = true;
        }
        var stormFlag = log_noise_1.parseBoolOrNull(query.storm_flag);
        if (stormFlag !== null) {
            logNoiseConfig.storm_flag = stormFlag;
            overridden = true;
        }
        return { logNoiseConfig: logNoiseConfig, logNoiseOverridden: overridden };
    };
    SimulatorController.prototype.rollStatusCode = function (successChancePct) {
        var roll = randInt(1, 100);
        if (roll <= successChancePct)
            return 200;
        return FAILURE_CODES[randInt(0, FAILURE_CODES.length - 1)];
    };
    __decorate([
        common_1.Get('config')
    ], SimulatorController.prototype, "getConfig");
    __decorate([
        common_1.Put('config'),
        __param(0, common_1.Body())
    ], SimulatorController.prototype, "updateConfig");
    __decorate([
        common_1.Get('ping/:id/status'),
        __param(0, common_1.Req()),
        __param(1, common_1.Res()),
        __param(2, common_1.Query())
    ], SimulatorController.prototype, "status");
    __decorate([
        common_1.Get('ping/:id/info'),
        __param(0, common_1.Req()),
        __param(1, common_1.Res()),
        __param(2, common_1.Query())
    ], SimulatorController.prototype, "info");
    SimulatorController = __decorate([
        common_1.Controller(),
        __param(1, common_2.Inject(nest_winston_1.WINSTON_MODULE_PROVIDER))
    ], SimulatorController);
    return SimulatorController;
}());
exports.SimulatorController = SimulatorController;
function randInt(min, max) {
    if (max <= min)
        return min;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function sleep(ms) {
    return new Promise(function (resolve) { return setTimeout(resolve, ms); });
}
function parseIntOrNull(v) {
    if (typeof v !== 'string' || v === '')
        return null;
    var n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
}
function inRange(pct) {
    return pct >= 0 && pct <= 100;
}

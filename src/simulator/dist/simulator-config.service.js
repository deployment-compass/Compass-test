"use strict";
// src/simulator/simulator-config.service.ts
//
// in-memory
// source of truth for default response-simulation behavior, mutable at
// runtime via GET/PUT /config.
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
exports.__esModule = true;
exports.SimulatorConfigService = void 0;
var common_1 = require("@nestjs/common");
var DEFAULT_CONFIG = {
    success_chance: 90,
    fast_chance: 95,
    fast_duration_ms: 300
};
var SimulatorConfigService = /** @class */ (function () {
    function SimulatorConfigService() {
        this.config = __assign({}, DEFAULT_CONFIG);
    }
    SimulatorConfigService.prototype.get = function () {
        return __assign({}, this.config);
    };
    SimulatorConfigService.prototype.set = function (next) {
        this.validate(next);
        this.config = __assign({}, next);
        return this.get();
    };
    SimulatorConfigService.prototype.validate = function (c) {
        if (!inRange(c.success_chance) || !inRange(c.fast_chance)) {
            throw new common_1.BadRequestException('success_chance and fast_chance must be 0-100');
        }
        if (!Number.isFinite(c.fast_duration_ms) || c.fast_duration_ms < 1) {
            throw new common_1.BadRequestException('fast_duration_ms must be >= 1');
        }
    };
    SimulatorConfigService = __decorate([
        common_1.Injectable()
    ], SimulatorConfigService);
    return SimulatorConfigService;
}());
exports.SimulatorConfigService = SimulatorConfigService;
function inRange(pct) {
    return Number.isFinite(pct) && pct >= 0 && pct <= 100;
}

"use strict";
// src/simulator/simulator.module.ts
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
exports.__esModule = true;
exports.SimulatorModule = void 0;
var common_1 = require("@nestjs/common");
var simulator_controller_1 = require("./simulator.controller");
var simulator_config_service_1 = require("./simulator-config.service");
var logger_module_1 = require("src/logger/logger.module");
var SimulatorModule = /** @class */ (function () {
    function SimulatorModule() {
    }
    SimulatorModule = __decorate([
        common_1.Module({
            imports: [logger_module_1.LoggerModule],
            controllers: [simulator_controller_1.SimulatorController],
            providers: [simulator_config_service_1.SimulatorConfigService]
        })
    ], SimulatorModule);
    return SimulatorModule;
}());
exports.SimulatorModule = SimulatorModule;

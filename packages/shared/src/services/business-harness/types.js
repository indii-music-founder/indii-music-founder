"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHarnessRun = createHarnessRun;
function createHarnessRun(params) {
    var _a, _b, _c;
    return Object.assign(Object.assign({}, params), { schemaVersion: (_a = params.schemaVersion) !== null && _a !== void 0 ? _a : 1, runId: (_b = params.runId) !== null && _b !== void 0 ? _b : `harness_${params.domain}_${Date.now()}`, createdAt: (_c = params.createdAt) !== null && _c !== void 0 ? _c : new Date().toISOString() });
}
//# sourceMappingURL=types.js.map
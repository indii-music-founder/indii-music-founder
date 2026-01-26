"use strict";
/**
 * Type definitions for subscription and usage tracking
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsageWarningLevel = exports.SubscriptionTier = void 0;
const SubscriptionTier_1 = require("./SubscriptionTier");
Object.defineProperty(exports, "SubscriptionTier", { enumerable: true, get: function () { return SubscriptionTier_1.SubscriptionTier; } });
/**
 * Usage warning levels
 */
var UsageWarningLevel;
(function (UsageWarningLevel) {
    UsageWarningLevel["NORMAL"] = "normal";
    UsageWarningLevel["HIGH"] = "high";
    UsageWarningLevel["CRITICAL"] = "critical";
    UsageWarningLevel["EXCEEDED"] = "exceeded";
})(UsageWarningLevel || (exports.UsageWarningLevel = UsageWarningLevel = {}));
//# sourceMappingURL=types.js.map
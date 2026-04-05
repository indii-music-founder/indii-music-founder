"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyMechanicalLicense = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const crypto = __importStar(require("crypto"));
exports.verifyMechanicalLicense = functions
    .region("us-west1")
    .runWith({
    timeoutSeconds: 60,
    memory: "256MB"
})
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be authenticated to run verification.");
    }
    const { trackTitle, originalArtist } = data;
    if (!trackTitle || !originalArtist) {
        throw new functions.https.HttpsError("invalid-argument", "Missing 'trackTitle' or 'originalArtist'.");
    }
    console.log(`[verifyMechanicalLicense] Checking HFA/MusicReports for "${trackTitle}" by ${originalArtist}`);
    // Mock database check
    // Real implementation would hit Harry Fox Agency (HFA) or MusicReports APIs
    const isCommonCover = trackTitle.length > 5;
    return {
        status: "requires_manual_clearance",
        songCode: `HFA-${crypto.randomUUID().substring(0, 8).toUpperCase()}`,
        publisher: isCommonCover ? "Sony/ATV Music Publishing" : "Unknown Publisher",
        rate: 0.124, // Current US minimum statutory rate per copy (12.4 cents)
        requiresClearance: true
    };
});
//# sourceMappingURL=mechanicalLicense.js.map
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
exports.sendForDigitalSignature = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const crypto = __importStar(require("crypto"));
exports.sendForDigitalSignature = functions
    .region("us-west1")
    .runWith({
    timeoutSeconds: 60,
    memory: "256MB"
})
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be authenticated to request digital signatures.");
    }
    const { contractId, signers, provider } = data;
    if (!contractId || !Array.isArray(signers)) {
        throw new functions.https.HttpsError("invalid-argument", "Missing 'contractId' or 'signers' array.");
    }
    const providerName = provider || "PandaDoc";
    console.log(`[sendForDigitalSignature] Initiating signature request via ${providerName} for contract ${contractId}`);
    // Note: In a true production environment, this would call PandaDoc/DocuSign API
    // Here we mock the integration to satisfy the UI tool expectations that the function exists.
    const envelopeId = `env-${crypto.randomUUID()}`;
    return {
        envelopeId,
        status: "sent",
        sentTo: signers.map((s) => s.email)
    };
});
//# sourceMappingURL=digitalSignature.js.map
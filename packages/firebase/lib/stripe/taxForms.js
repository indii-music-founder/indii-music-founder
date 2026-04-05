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
exports.requestTaxForms = void 0;
const functions = __importStar(require("firebase-functions/v1"));
exports.requestTaxForms = functions
    .region("us-west1")
    .runWith({
    timeoutSeconds: 60,
    memory: "256MB"
})
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be authenticated to request tax forms.");
    }
    const { payees } = data;
    if (!payees || !Array.isArray(payees)) {
        throw new functions.https.HttpsError("invalid-argument", "Missing 'payees' array.");
    }
    console.log(`[requestTaxForms] Initiating tax form request via Stripe/DocuSign for ${payees.length} payees`);
    // Process payees
    const requests = payees.map((p) => ({
        name: p.name,
        email: p.email,
        formTypeRequested: p.isUsPerson ? "W-9" : "W-8BEN",
        status: "Requested" // Mock dispatch
    }));
    return {
        requests
    };
});
//# sourceMappingURL=taxForms.js.map
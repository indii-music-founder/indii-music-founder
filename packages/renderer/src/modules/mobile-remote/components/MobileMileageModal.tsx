/**
 * MobileMileageModal — Quick on-the-go mileage and travel expense tracking for indiiREMOTEv1.
 * Supports artists traveling to gear stores, rehearsals, and gig venues.
 * Calculates standard IRS mileage deduction ($0.67/mile) and persists to Notes & Expenses.
 */

import React, { useState } from "react";
import { Car, X, MapPin, DollarSign, ArrowRightLeft, Check, Receipt, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "../haptics";
import { useStore } from "@/core/store";
import { FinanceService } from "@/services/finance/FinanceService";
import { auth } from "@/services/firebase";
import { remoteRelayService } from "@/services/agent/RemoteRelayService";
import { useToast } from "@/core/context/ToastContext";
import { logger } from "@/utils/logger";

const IRS_MILEAGE_RATE = 0.67; // $0.67 / mile standard business deduction

const COMMON_DESTINATIONS = [
  "Guitar Center",
  "Local Music Store",
  "Venue / Gig",
  "Rehearsal Studio",
  "Audio Repair Shop",
];

interface MobileMileageModalProps {
  isOpen: boolean;
  onClose: () => void;
  isPaired: boolean;
  onOpenReceiptCapture?: () => void;
}

export default function MobileMileageModal({
  isOpen,
  onClose,
  isPaired,
  onOpenReceiptCapture,
}: MobileMileageModalProps) {
  const toast = useToast();
  const [destination, setDestination] = useState("");
  const [miles, setMiles] = useState("");
  const [isRoundTrip, setIsRoundTrip] = useState(true);
  const [purpose, setPurpose] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const rawMiles = parseFloat(miles) || 0;
  const totalMiles = isRoundTrip ? rawMiles * 2 : rawMiles;
  const taxDeduction = (totalMiles * IRS_MILEAGE_RATE).toFixed(2);

  const handleSave = async (andSnapReceipt: boolean = false) => {
    if (!destination.trim()) {
      toast.error("Please enter a destination");
      return;
    }
    if (totalMiles <= 0) {
      toast.error("Please enter valid miles");
      return;
    }

    setIsSaving(true);
    triggerHaptic(50);

    const tripSummary = `${isRoundTrip ? "Round-trip" : "One-way"} drive to ${destination}: ${totalMiles.toFixed(1)} miles @ $${IRS_MILEAGE_RATE}/mi = $${taxDeduction} tax deduction.${purpose ? " Purpose: " + purpose : ""}`;

    try {
      const userId = auth.currentUser?.uid;
      const today = new Date().toISOString().split("T")[0]!;

      // 1. Persist to Finance Expenses if authenticated
      if (userId) {
        try {
          const financeService = new FinanceService();
          await financeService.addExpense({
            userId,
            vendor: destination,
            amount: parseFloat(taxDeduction),
            category: "Travel",
            date: today,
            description: `[Mileage] ${tripSummary}`,
            paymentStatus: "paid",
            evidenceStatus: "verified",
          });
        } catch (financeError) {
          logger.warn("[MobileMileage] Could not save directly to expenses collection:", financeError);
        }
      }

      // 2. Persist to local / synchronized Notes
      useStore.getState().addNote({
        title: `Mileage: ${destination} (${totalMiles.toFixed(1)} mi)`,
        content: `${tripSummary}\nRecorded on: ${new Date().toLocaleString()}\nStatus: Auto-logged for tax deduction`,
        attachments: [],
        tags: ["mileage", "travel", "tax-deduction", "expense", "mobile-capture"],
      });

      // 3. Dispatch to Studio Executor if paired
      if (isPaired) {
        try {
          await remoteRelayService.dispatchTask({
            type: "live_moment",
            payload: { noteText: `[Mileage Logged] ${tripSummary}` },
          });
        } catch (relayErr) {
          logger.warn("[MobileMileage] Failed to dispatch task to studio executor:", relayErr);
        }
      }

      triggerHaptic([50, 50, 50]);
      toast.success(`Logged ${totalMiles.toFixed(1)} miles ($${taxDeduction} deduction)`);

      // Reset state
      setDestination("");
      setMiles("");
      setPurpose("");
      onClose();

      if (andSnapReceipt && onOpenReceiptCapture) {
        onOpenReceiptCapture();
      }
    } catch (err) {
      logger.error("[MobileMileage] Failed to log mileage:", err);
      toast.error("Failed to log mileage. Please try again.");
      triggerHaptic([100, 200, 100]);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="w-full max-w-lg bg-[#0d0d12] border border-white/10 rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl flex flex-col gap-5 max-h-[92vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Car className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">Track Miles & Run</h3>
                <p className="text-xs text-white/50 font-medium">Auto-deductible at $0.67/mi</p>
              </div>
            </div>
            <button
              onClick={() => {
                triggerHaptic(30);
                onClose();
              }}
              className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Destination */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-white/70 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-amber-400" />
              Where are you heading?
            </label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. Guitar Center, Rehearsal Studio"
              className="w-full bg-[#181820] border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-amber-400/50"
            />
            {/* Quick chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {COMMON_DESTINATIONS.map((dest) => (
                <button
                  key={dest}
                  type="button"
                  onClick={() => {
                    triggerHaptic(20);
                    setDestination(dest);
                  }}
                  className={cn(
                    "text-[11px] px-2.5 py-1 rounded-full border transition-all",
                    destination === dest
                      ? "bg-amber-400/20 border-amber-400/40 text-amber-300 font-medium"
                      : "bg-white/5 border-white/5 text-white/60 hover:border-white/20"
                  )}
                >
                  {dest}
                </button>
              ))}
            </div>
          </div>

          {/* Distance & Round-trip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/70 uppercase tracking-wider">
                Distance (Miles)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={miles}
                onChange={(e) => setMiles(e.target.value)}
                placeholder="e.g. 14.2"
                className="w-full bg-[#181820] border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-amber-400/50 font-mono"
              />
            </div>

            <div className="space-y-1.5 flex flex-col justify-end">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(30);
                  setIsRoundTrip(!isRoundTrip);
                }}
                className={cn(
                  "w-full py-3 px-4 rounded-2xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all",
                  isRoundTrip
                    ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                    : "bg-[#181820] border-white/10 text-white/50"
                )}
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Round-Trip (To & Back)</span>
              </button>
            </div>
          </div>

          {/* Live Tax Deduction Card */}
          {totalMiles > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-white/60">Estimated Tax Deduction</p>
                  <p className="text-lg font-bold text-amber-300 font-mono">
                    $${taxDeduction}{" "}
                    <span className="text-xs font-normal text-white/40">
                      (${totalMiles.toFixed(1)} mi total)
                    </span>
                  </p>
                </div>
              </div>
              <Sparkles className="w-4 h-4 text-amber-400/60" />
            </motion.div>
          )}

          {/* Purpose / Gear Note */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-white/70 uppercase tracking-wider">
              Purchase Note / Gear Purpose (Optional)
            </label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Cables, strings, mic stands for show"
              className="w-full bg-[#181820] border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-amber-400/50"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2.5 pt-2">
            <button
              type="button"
              disabled={isSaving || totalMiles <= 0 || !destination.trim()}
              onClick={() => handleSave(false)}
              className="w-full py-3.5 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm tracking-tight flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_20px_rgba(245,158,11,0.2)]"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? "Logging Trip..." : "Log Mileage & Save Deduction"}</span>
            </button>

            {onOpenReceiptCapture && (
              <button
                type="button"
                disabled={isSaving || totalMiles <= 0 || !destination.trim()}
                onClick={() => handleSave(true)}
                className="w-full py-3 px-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white font-medium text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Receipt className="w-4 h-4 text-amber-400" />
                <span>Save Mileage & Snap Gear Receipt</span>
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

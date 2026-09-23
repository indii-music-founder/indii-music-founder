import React, { useState } from 'react';
import {
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
  ArrowRight,
  Database,
  Lock,
  FileCheck
} from 'lucide-react';
import { FormatForensicsEngine } from '@/services/foundry/FormatForensicsEngine';
import { HypothesisLedger } from '@/services/foundry/HypothesisLedger';
import { AdapterConstructor } from '@/services/foundry/AdapterConstructor';
import { LayeredValidator } from '@/services/foundry/LayeredValidator';
import { ArtistBusinessGraphNormalizer } from '@/services/foundry/ArtistBusinessGraphNormalizer';
import type {
  FormatForensicsReport,
  HypothesisLedgerState,
  NormalizedStatementReport,
  LayeredValidationReport,
  ArtistBusinessGraphResolution
} from '@indii/shared';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';

// Preset genuine samples for rapid testing and demonstrations
const PRESETS = {
  distrokid: `Reporting Date\tSale Month\tStore\tArtist\tTitle\tISRC\tUPC\tQuantity\tEarnings (USD)\tCountry of Sale
2026-04-15\t2026-03\tSpotify\tKIRA NOVA\tVelvet Voltage\tUS-IND-26-00001\t8847243739548\t14500\t55.10\tUS
2026-04-15\t2026-03\tSpotify\tKIRA NOVA\tVelvet Voltage\tUS-IND-26-00001\t8847243739548\t4200\t16.38\tGB
2026-04-15\t2026-03\tApple Music\tKIRA NOVA\tVelvet Voltage\tUS-IND-26-00001\t8847243739548\t3100\t23.25\tUS
2026-04-15\t2026-03\tApple Music\tKIRA NOVA\tVelvet Voltage\tUS-IND-26-00001\t8847243739548\t1200\t9.00\tDE
2026-04-15\t2026-03\tAmazon Music\tKIRA NOVA\tVelvet Voltage\tUS-IND-26-00001\t8847243739548\t1800\t7.20\tUS
2026-04-15\t2026-03\tYouTube Music\tKIRA NOVA\tVelvet Voltage\tUS-IND-26-00001\t8847243739548\t9500\t19.00\tUS
2026-04-15\t2026-03\tiTunes\tKIRA NOVA\tVelvet Voltage\tUS-IND-26-00001\t8847243739548\t45\t31.50\tUS`,

  tunecore: `Sales Period,Posted Date,Store Name,Country Of Sale,Artist,Release Title,Song Title,ISRC,UPC,Quantity,Total Earned
2026-03,2026-04-18,Spotify,US,KIRA NOVA,Velvet Voltage,Velvet Voltage,US-IND-26-00001,8847243739548,8200,31.16
2026-03,2026-04-18,Apple Music,US,KIRA NOVA,Velvet Voltage,Velvet Voltage,US-IND-26-00001,8847243739548,2500,18.75
2026-03,2026-04-18,Amazon Music,JP,KIRA NOVA,Velvet Voltage,Velvet Voltage,US-IND-26-00001,8847243739548,900,3.60
2026-03,2026-04-18,Deezer,FR,KIRA NOVA,Velvet Voltage,Velvet Voltage,US-IND-26-00001,8847243739548,650,2.60`,

  drifting: `Reporting Date\tSale Month\tStore\tArtist\tTitle\tISRC\tUPC\tTax Withholding (USD)\tPublisher Royalty ID\tQuantity\tEarnings (USD)\tCountry of Sale
2026-05-15\t2026-04\tSpotify\tKIRA NOVA\tVelvet Voltage\tUS-IND-26-00001\t8847243739548\t1.25\tPUB-9941\t16000\t60.80\tUS
2026-05-15\t2026-04\tSpotify\tKIRA NOVA\tVelvet Voltage\tMALFORMED_ISRC\t8847243739548\t0.00\tPUB-9941\t100\t0.50\tUS`,
};

// Canonical catalog fixture for Velvet Voltage
const VELVET_VOLTAGE_CATALOG = new Map<string, ExtendedGoldenMetadata>([
  [
    'US-IND-26-00001',
    {
      trackTitle: 'Velvet Voltage',
      artistName: 'KIRA NOVA',
      isrc: 'US-IND-26-00001',
      explicit: false,
      genre: 'Dark Electro-Pop / Synthwave',
      labelName: 'indii Records',
      splits: [
        { legalName: 'Kira Novakowski', role: 'songwriter', percentage: 70, email: 'kira@kiranova.io' },
        { legalName: 'DJ PHANTOM', role: 'producer', percentage: 30, email: 'phantom@kiranova.io' },
      ],
      pro: 'BMI',
      publisher: 'indii Publishing',
    } as ExtendedGoldenMetadata,
  ],
]);

export const FormatFoundryModule: React.FC = () => {
  const [rawText, setRawText] = useState<string>('');
  const [forensics, setForensics] = useState<FormatForensicsReport | null>(null);
  const [ledgerState, setLedgerState] = useState<HypothesisLedgerState | null>(null);
  const [report, setReport] = useState<NormalizedStatementReport | null>(null);
  const [validation, setValidation] = useState<LayeredValidationReport | null>(null);
  const [graph, setGraph] = useState<ArtistBusinessGraphResolution | null>(null);
  const [isBooked, setIsBooked] = useState<boolean>(false);

  const handleLoadPreset = (key: keyof typeof PRESETS) => {
    const content = PRESETS[key];
    setRawText(content);
    setIsBooked(false);
    runAnalysis(content);
  };

  const runAnalysis = async (content: string) => {
    if (!content.trim()) return;

    // 1. Forensics
    const fReport = FormatForensicsEngine.analyze('manual_input', content);
    setForensics(fReport);

    // 2. Hypotheses
    const ledger = HypothesisLedger.fromForensics(fReport, fReport.detectedFormatFamily);
    setLedgerState(ledger.getState());

    // 3. Adapter Execution
    const adapter = AdapterConstructor.resolveAdapter(content);
    if (adapter) {
      const parsed = adapter.parse(content);
      setReport(parsed);

      // 4. Layered Validation
      const vReport = await LayeredValidator.validate(content, parsed);
      setValidation(vReport);

      // 5. Graph Normalization
      const gResolution = ArtistBusinessGraphNormalizer.normalizeToGraph(parsed, VELVET_VOLTAGE_CATALOG);
      setGraph(gResolution);
    } else {
      setReport(null);
      setValidation(null);
      setGraph(null);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setRawText(val);
    setIsBooked(false);
    if (val.trim()) {
      runAnalysis(val);
    } else {
      setForensics(null);
      setLedgerState(null);
      setReport(null);
      setValidation(null);
      setGraph(null);
    }
  };

  const handleConfirmBooking = () => {
    setIsBooked(true);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">Format Intelligence & Capability Foundry</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Clean-Room Engine
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Reconstruct, validate, and normalize unfamiliar music-business formats and statements into the canonical Artist Business Graph.
          </p>
        </div>
        <div className="flex items-center space-x-2 bg-emerald-950/40 border border-emerald-500/30 rounded-lg px-3 py-1.5 text-xs text-emerald-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Local-First Private Analysis • Zero Model Egress</span>
        </div>
      </div>

      {/* Preset Quick Actions */}
      <div className="flex items-center space-x-3 text-xs">
        <span className="text-slate-400 font-medium">Load Authorized Evidence Fixtures:</span>
        <button
          onClick={() => handleLoadPreset('distrokid')}
          className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
        >
          DistroKid TSV (2026.1)
        </button>
        <button
          onClick={() => handleLoadPreset('tunecore')}
          className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
        >
          TuneCore CSV (2026.1)
        </button>
        <button
          onClick={() => handleLoadPreset('drifting')}
          className="px-3 py-1.5 rounded-md bg-amber-950/40 hover:bg-amber-900/40 text-amber-200 border border-amber-700/50 transition"
        >
          Drifting Mutation (Quarantine Test)
        </button>
      </div>

      {/* Evidence Intake Input */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <label htmlFor="raw-statement-input" className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
            <FileText className="w-4 h-4 text-indigo-400" />
            <span>Raw Statement or Format Evidence</span>
          </label>
          <span className="text-xs text-slate-500">Paste tabular statement, DDEX XML, or drop file</span>
        </div>
        <textarea
          id="raw-statement-input"
          value={rawText}
          onChange={handleTextChange}
          placeholder="Paste raw sales statement (TSV/CSV) or drop evidence file here..."
          className="w-full h-32 bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* Forensics & Hypotheses Grid */}
      {forensics && ledgerState && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Forensics Report */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>Format Forensics</span>
              </h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-700/30">
                {Math.round(forensics.forensicsConfidence * 100)}% Confidence
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-500 block">Detected Family:</span>
                <span className="font-semibold text-slate-200">{forensics.detectedFormatFamily}</span>
              </div>
              <div className="p-2 rounded bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-500 block">Delimiter:</span>
                <span className="font-mono text-slate-200">{forensics.delimiter || 'N/A'}</span>
              </div>
              <div className="p-2 rounded bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-500 block">Columns Detected:</span>
                <span className="font-semibold text-slate-200">{forensics.columnCount} columns</span>
              </div>
              <div className="p-2 rounded bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-500 block">Rows Observed:</span>
                <span className="font-semibold text-slate-200">{forensics.totalRowsObserved} rows</span>
              </div>
            </div>

            {/* Column Semantic Inferences */}
            <div className="space-y-1.5 pt-2">
              <span className="text-xs text-slate-400 font-medium">Inferred Semantic Mapping:</span>
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                {forensics.columns.map((col) => (
                  <div key={col.index} className="flex items-center justify-between text-xs p-1.5 rounded bg-slate-950/40 border border-slate-800/50">
                    <span className="font-mono text-slate-400 truncate max-w-[140px]">{col.rawHeader}</span>
                    <div className="flex items-center space-x-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-950/80 text-indigo-300 border border-indigo-800/40">
                        {col.inferredSemantic}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">{Math.round(col.confidence * 100)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Hypothesis Ledger */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>Hypothesis Ledger</span>
              </h2>
              <span className="text-xs text-slate-400">
                {ledgerState.provenRulesCount} Proven • {ledgerState.unknownRulesCount} Unknown
              </span>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {ledgerState.hypotheses.map((hyp) => (
                <div key={hyp.id} className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300 capitalize">{hyp.category.replace(/_/g, ' ')}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        hyp.status === 'proven'
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50'
                          : hyp.status === 'tentative'
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-800/50'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {hyp.status.toUpperCase()} ({Math.round(hyp.confidence * 100)}%)
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{hyp.ruleStatement}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Layered Validation Results */}
      {validation && report && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
              <FileCheck className="w-4 h-4 text-emerald-400" />
              <span>7-Layer Validation Matrix</span>
            </h2>
            <span
              className={`px-2.5 py-1 rounded text-xs font-semibold ${
                validation.allPassed
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                  : 'bg-amber-950/80 text-amber-300 border border-amber-500/40'
              }`}
            >
              {validation.allPassed ? 'ALL LAYERS PASSED' : 'VALIDATION WARNINGS DETECTED'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-300">1. Byte Layer</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <p className="text-slate-400">{validation.byte.details}</p>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-300">2. Structural Layer</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <p className="text-slate-400">{validation.structural.details}</p>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-300">3. Semantic Layer</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <p className="text-slate-400">{validation.semantic.details}</p>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-300">4. Round-Trip Layer</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <p className="text-slate-400">{validation.roundTrip.details}</p>
            </div>
          </div>

          {/* Quarantined Rows Banner if any */}
          {report.quarantinedRows.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-700/50 space-y-2 text-xs">
              <div className="flex items-center space-x-2 text-amber-300 font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Quarantine Alert: {report.quarantinedRows.length} Row(s) Isolated</span>
              </div>
              {report.quarantinedRows.map((q, idx) => (
                <div key={idx} className="p-2 rounded bg-slate-950/80 font-mono text-[11px] text-amber-200 flex justify-between">
                  <span>Line {q.lineIndex}: {q.reason} ({q.errorCode})</span>
                  <span className="text-slate-500 truncate max-w-[200px]">{q.rawContent}</span>
                </div>
              ))}
            </div>
          )}

          {/* Consequential Approval Gate */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-indigo-950/40 border border-indigo-800/40 text-xs">
            <div className="flex items-center space-x-2">
              <Lock className="w-4 h-4 text-indigo-400" />
              <span className="text-indigo-200">
                {isBooked
                  ? 'Statement successfully booked to canonical Artist Business Graph.'
                  : validation.humanReview.requiresArtistConfirmation
                  ? 'Human review required before booking due to quarantined rows or unverified fields.'
                  : 'Statement passed all automated validation criteria. Ready to book.'}
              </span>
            </div>
            {!isBooked ? (
              <button
                onClick={handleConfirmBooking}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition flex items-center space-x-1.5"
              >
                <span>Approve & Book Statement</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <span className="flex items-center space-x-1 text-emerald-400 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Booked</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Artist Business Graph Normalization View */}
      {graph && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
              <Database className="w-4 h-4 text-indigo-400" />
              <span>Artist Business Graph Normalization</span>
            </h2>
            <span className="text-xs text-slate-400">
              {graph.lineageLinksCount} Traceable Lineage Links
            </span>
          </div>

          {/* Releases and Tracks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {graph.releases.map((rel) => (
              <div key={rel.upc} className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-500 block">Release</span>
                    <h3 className="text-sm font-bold text-white">{rel.title}</h3>
                    <span className="text-xs text-indigo-400 font-medium">{rel.artist}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500 block">Total Revenue</span>
                    <span className="text-base font-bold text-emerald-400 font-mono">${rel.totalGrossRevenue.toFixed(2)}</span>
                  </div>
                </div>

                <div className="border-t border-slate-800/80 pt-2 space-y-2">
                  <span className="text-xs text-slate-400 font-medium block">Tracks & Lineage:</span>
                  {rel.tracks.map((trk) => (
                    <div key={trk.isrc} className="p-2 rounded bg-slate-900/80 border border-slate-800 text-xs space-y-1">
                      <div className="flex justify-between font-semibold text-slate-300">
                        <span>{trk.title}</span>
                        <span className="font-mono text-emerald-400">${trk.netRevenue.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500">
                        <span className="font-mono">ISRC: {trk.isrc}</span>
                        <span>{trk.streams.toLocaleString()} Streams</span>
                      </div>
                      <div className="text-[10px] text-slate-500 pt-0.5">
                        Source Rows: {trk.sourceLineIndices.map((i) => `L${i}`).join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Contributor Split Summary */}
            <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 block">Economics</span>
                  <h3 className="text-sm font-bold text-white">Contributor Splits</h3>
                  <span className="text-xs text-slate-400">Allocated according to canonical contracts</span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500 block">Total Allocated</span>
                  <span className="text-base font-bold text-indigo-400 font-mono">${graph.totalAllocatedRevenue.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                {Object.entries(graph.contributorSummary).map(([name, summary]) => (
                  <div key={name} className="flex items-center justify-between p-2.5 rounded bg-slate-900/80 border border-slate-800 text-xs">
                    <div>
                      <span className="font-semibold text-slate-200 block">{name}</span>
                      <span className="text-[10px] text-slate-500">Direct Contract Split</span>
                    </div>
                    <span className="font-mono font-bold text-emerald-400">${summary.totalPayout.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FormatFoundryModule;

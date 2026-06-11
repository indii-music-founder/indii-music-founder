/**
 * AnalyticsAgent.ts
 * 
 * The Intelligence Analytics Specialist - Expert in streaming metrics, audience profiles, and release velocity curves.
 */

import { AgentConfig } from "../types";
import { freezeAgentConfig } from '../FreezeDiagnostic';
import { AnalyticsTools } from '../tools/AnalyticsTools';
import systemPrompt from '@agents/analytics/prompt.md?raw';

export const AnalyticsAgent: AgentConfig = {
    id: "analytics",
    name: "Analytics Director",
    description: "Analyzes audience intelligence, streaming data, and career metrics for independent artists.",
    color: "bg-purple-600",
    category: "specialist",
    systemPrompt: systemPrompt,
    get functions() {
        return {
            calculate_viral_potential_score: AnalyticsTools.calculate_viral_potential_score,
            benchmark_release_velocity: AnalyticsTools.benchmark_release_velocity,
            detect_streaming_anomalies: AnalyticsTools.detect_streaming_anomalies,
            run_cohort_analysis: AnalyticsTools.run_cohort_analysis,
        } as Record<string, import('@/services/agent/types').AnyToolFunction>;
    },
    authorizedTools: ['calculate_viral_potential_score', 'benchmark_release_velocity', 'detect_streaming_anomalies', 'run_cohort_analysis'],

    tools: [{
        functionDeclarations: [
            {
                name: "calculate_viral_potential_score",
                description: "Predict viral potential based on tempo/BPM, genre, and mood using historical artist distributions.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        bpm: { type: "NUMBER", description: "BPM/tempo of the track." },
                        genre: { type: "STRING", description: "Genre of the track." },
                        mood: { type: "STRING", description: "Mood of the track." }
                    },
                    required: ["bpm", "genre", "mood"]
                }
            },
            {
                name: "benchmark_release_velocity",
                description: "Compare current release streaming trajectory (24h, 7d, 30d) against artist historical baseline.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        trackId: { type: "STRING", description: "Optional: ISRC or ID of the track to benchmark." },
                        artistId: { type: "STRING", description: "Optional: ID of the artist." }
                    },
                    required: []
                }
            },
            {
                name: "detect_streaming_anomalies",
                description: "Scan streaming event logs for sudden spikes or drop-offs to detect potential botting or viral events.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        trackId: { type: "STRING", description: "ISRC or ID of the track." },
                        currentStreams: { type: "NUMBER", description: "Current count of daily streams." },
                        averageStreams: { type: "NUMBER", description: "Average historical daily streams." }
                    },
                    required: ["trackId", "currentStreams", "averageStreams"]
                }
            },
            {
                name: "run_cohort_analysis",
                description: "Run cohort retention queries to track weekly user listening activity.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        dataset_id: { type: "STRING", description: "BigQuery dataset ID." },
                        table_id: { type: "STRING", description: "BigQuery table ID containing event logs." },
                        cohort_dimension: { type: "STRING", description: "Dimension to group by (e.g. week, month)." },
                        timeframe: { type: "STRING", description: "Time range (e.g. last_30_days, last_90_days)." }
                    },
                    required: ["dataset_id", "table_id", "cohort_dimension", "timeframe"]
                }
            }
        ]
    }]
};

// Freeze the schema to prevent cross-test contamination
freezeAgentConfig(AnalyticsAgent);

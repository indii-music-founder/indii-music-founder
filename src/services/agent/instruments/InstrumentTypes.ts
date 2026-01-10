/**
 * Instrument Layer Type Definitions
 *
 * The Instrument layer provides a unified interface for all tools and actions
 * that agents can execute. This enables the agent system to:
 * 1. Discover available capabilities dynamically
 * 2. Execute tools with consistent error handling
 * 3. Track costs and resource usage
 * 4. Enforce approval gates for expensive operations
 */

/**
 * Compute type for instrument execution
 */
export type ComputeType = 'local' | 'cloud' | 'hybrid';

/**
 * Economic model for instrument execution
 */
export type EconomicModel = 'free' | 'quota' | 'token' | 'subscription';

/**
 * Instrument categories for organization and discovery
 */
export type InstrumentCategory =
  | 'generation'
  | 'utility'
  | 'analysis'
  | 'communication'
  | 'file_operations'
  | 'media_processing'
  | 'data_processing';

/**
 * Required subscription tier to use an instrument
 */
export type RequiredTier = 'free' | 'pro' | 'studio';

/**
 * JSON Schema format for inputs/outputs
 */
export interface JSONSchemaObject {
  type: string;
  description?: string;
  properties?: Record<string, JSONSchemaObject>;
  required?: string[];
  items?: JSONSchemaObject;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  format?: string;
  default?: any;
}

/**
 * Complete instrument metadata
 */
export interface InstrumentMetadata {
  /** Unique identifier for the instrument */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description of what the instrument does */
  description: string;

  /** Category for organization */
  category: InstrumentCategory;

  /** Version string */
  version: string;

  /** Author (service/team) */
  author?: string;

  /** Execution type */
  isAsync: boolean;

  /** Timeout in milliseconds */
  timeoutMs?: number;

  /** Economic model */
  cost: {
    type: EconomicModel;
    amount: number;
    currency?: string;
  };

  /** Whether user approval is required */
  requiresApproval: boolean;

  /** Minimum subscription tier */
  requiredTier?: RequiredTier;

  /** Constraints on operations */
  constraints: {
    maxResolution?: string;
    maxDuration?: number;
    maxFileSize?: number;
    maxBatchSize?: number;
    allowedFormats?: string[];
    rateLimitPerMinute?: number;
  };

  /** Compute location */
  computeType: ComputeType;

  /** Preferred AI model */
  preferredModel?: string;

  /** Fallback models if preferred unavailable */
  fallbackModels?: string[];

  /** Dependencies on other instruments */
  dependsOn?: string[];

  /** Tags for search and filtering */
  tags?: string[];

  /** Examples of usage */
  examples?: Array<{
    input: Record<string, any>;
    output?: any;
    description: string;
  }>;
}

/**
 * Input parameter definition
 */
export interface InstrumentInput {
  /** Parameter name */
  name: string;

  /** Human-readable description */
  description: string;

  /** Whether the parameter is required */
  required: boolean;

  /** JSON Schema for validation */
  schema: JSONSchemaObject;

  /** Default value (optional) */
  defaultValue?: any;
}

/**
 * Output definition
 */
export interface InstrumentOutput {
  /** Output type or description */
  type: string;

  /** Description of what's returned */
  description: string;

  /** JSON Schema for validation */
  schema: JSONSchemaObject;
}

/**
 * Execution result wrapper
 */
export interface InstrumentResult<T = any> {
  /** Whether execution succeeded */
  success: boolean;

  /** Result data (if successful) */
  data?: T;

  /** Error message (if failed) */
  error?: string;

  /** Detailed error for logging */
  errorDetails?: any;

  /** Execution metadata */
  metadata: {
    /** Time to execute in milliseconds */
    executionTimeMs: number;

    /** Cost in tokens/credits */
    cost?: number;

    /** Model used for AI-based instruments */
    modelUsed?: string;

    /** Impact on quota usage */
    quotaImpact?: {
      type: string;
      amount: number;
    };

    /** Additional context */
    additionalInfo?: Record<string, any>;
  };
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether the input is valid */
  valid: boolean;

  /** Error messages for invalid input */
  errors: string[];

  /** Warnings (input passes but has issues) */
  warnings?: string[];
}

/**
 * Cost estimation result
 */
export interface CostEstimate {
  /** Estimated cost in tokens/credits */
  amount: number;

  /** Currency (if applicable) */
  currency?: string;

  /** Whether this is a maximum or exact estimate */
  type: 'exact' | 'approximate' | 'maximum';

  /** Breakdown of cost factors */
  breakdown?: Record<string, number>;
}

/**
 * Approval request for interactive operations
 */
export interface ApprovalRequest {
  /** Instrument requesting approval */
  instrument: InstrumentMetadata;

  /** Parameters that will be used */
  params: Record<string, any>;

  /** Estimated cost */
  cost: number;

  /** Context for the approval */
  context?: {
    taskDescription?: string;
    urgency?: 'normal' | 'high' | 'urgent';
    projectId?: string;
  };
}

/**
 * Core Instrument interface that all instruments must implement
 */
export interface Instrument {
  /** Instrument metadata */
  metadata: InstrumentMetadata;

  /** Input parameter definitions */
  inputs: InstrumentInput[];

  /** Output definitions */
  outputs: InstrumentOutput[];

  /**
   * Execute the instrument with given parameters
   */
  execute(params: Record<string, any>): Promise<InstrumentResult>;

  /**
   * Validate input parameters against the schema
   */
  validateInputs(params: Record<string, any>): Promise<ValidationResult>;

  /**
   * Estimate execution cost before running
   */
  estimateCost(params: Record<string, any>): Promise<CostEstimate>;

  /**
   * Check if approval is required for this execution
   */
  requiresApproval?(params: Record<string, any>): Promise<boolean> | boolean;

  /**
   * Execute a dry run (validate and estimate without actually executing)
   */
  dryRun?(params: Record<string, any>): Promise<{
    validation: ValidationResult;
    cost: CostEstimate;
  }>;
}

/**
 * Instrument registry entry for discovery
 */
export interface InstrumentRegistryEntry extends Instrument {
  /** Whether the instrument is currently available */
  available: boolean;

  /** Last time instrument was updated */
  lastUpdated: number;

  /** Usage statistics */
  usageStats: {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    lastExecutionTime?: number;
  };
}

/**
 * Filter criteria for searching instruments
 */
export interface InstrumentFilter {
  /** Only include these categories */
  categories?: InstrumentCategory[];

  /** Only include these tags */
  tags?: string[];

  /** Only these compute types */
  computeTypes?: ComputeType[];

  /** Only these economic models */
  economicModels?: EconomicModel[];

  /** Only instruments that don't require approval */
  skipApprovalRequired?: boolean;

  /** Only instruments available for this tier */
  tier?: RequiredTier;

  /** Search in name/description */
  search?: string;
}

/**
 * Instrument execution options
 */
export interface InstrumentExecutionOptions {
  /** Force execution even if quota exceeded */
  force?: boolean;

  /** Skip approval check */
  skipApproval?: boolean;

  /** Enable dry run mode */
  dryRun?: boolean;

  /** Progress callback for long-running operations */
  onProgress?: (progress: number, message?: string) => void;

  /** Custom timeout (overrides instrument default) */
  timeoutMs?: number;
}

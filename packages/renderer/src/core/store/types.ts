import type { AppSlice } from "@/core/store/slices/appSlice";
import type { ProfileSlice } from "@/core/store/slices/profileSlice";
import type { AgentSlice } from "@/core/store/slices/agent";
import type { CreativeSlice } from "@/core/store/slices/creative";
import type { WorkflowSlice } from "@/core/store/slices/workflowSlice";
import type { AuthSlice } from "@/core/store/slices/authSlice";
import type { FinanceSlice } from "@/core/store/slices/financeSlice";
import type { DistributionSlice } from "@/core/store/slices/distributionSlice";
import type { FileSystemSlice } from "@/core/store/slices/fileSystemSlice";
import type { CanvasEditorSlice } from "@/core/store/slices/creative/canvasEditorSlice";
import type { AudioIntelligenceSlice } from "@/core/store/slices/audioIntelligenceSlice";
import type { SubscriptionSlice } from "@/core/store/slices/subscriptionSlice";
import type { SidecarSlice } from "@/core/store/slices/sidecarSlice";
import type { SyncSlice } from "@/core/store/slices/syncSlice";
import type { AudioGenerationSlice } from "@/core/store/slices/audioGenerationSlice";
import type { UploadQueueSlice } from "@/core/store/slices/uploadQueueSlice";
import type { AudioPlayerSlice } from "@/core/store/slices/audioPlayerSlice";
import type { BackgroundJobsSlice } from "@/core/store/slices/backgroundJobsSlice";
import type { MemoryAgentSlice } from "@/core/store/slices/memoryAgentSlice";
import type { MarketplaceSlice } from "@/core/store/slices/marketplaceSlice";
import type { EmailSlice } from "@/core/store/slices/emailSlice";
import type { AnalyticsSlice } from "@/core/store/slices/analyticsSlice";
import type { BoardroomSlice } from "@/core/store/slices/boardroomSlice";
import type { AgentFeedbackSlice } from "@/core/store/slices/agentFeedbackSlice";
import type { RegistrationSlice } from "@/core/store/slices/registrationSlice";
import type { AgentPlanSlice } from "@/core/store/slices/agentPlanSlice";
import type { AgentCanvasSlice } from "@/core/store/slices/agentCanvasSlice";
import type { AgentMemoryState } from "@/core/store/slices/agentMemorySlice";
import type { HandoffSlice } from "@/core/store/slices/handoffSlice";
import type { CRMSlice } from "@/core/store/slices/crmSlice";
import type { MapSlice } from "@/core/store/slices/mapSlice";
import type { NotesSlice } from "@/core/store/slices/notesSlice";
import type { AgentSwarmSlice } from "@/core/store/slices/agentSwarmSlice";
import type { ProjectCanvasSlice } from "@/modules/project-canvas/store/projectCanvasSlice";

export interface StoreState extends
    AppSlice,
    ProfileSlice,
    AgentSlice,
    CreativeSlice,
    WorkflowSlice,
    AuthSlice,
    FinanceSlice,
    DistributionSlice,
    FileSystemSlice,
    CanvasEditorSlice,
    AudioIntelligenceSlice,
    SubscriptionSlice,
    SidecarSlice,
    SyncSlice,
    AudioGenerationSlice,
    UploadQueueSlice,
    AudioPlayerSlice,
    BackgroundJobsSlice,
    MemoryAgentSlice,
    MarketplaceSlice,
    EmailSlice,
    AnalyticsSlice,
    BoardroomSlice,
    AgentFeedbackSlice,
    RegistrationSlice,
    AgentPlanSlice,
    AgentCanvasSlice,
    AgentMemoryState,
    HandoffSlice,
    CRMSlice,
    MapSlice,
    NotesSlice,
    AgentSwarmSlice,
    ProjectCanvasSlice { }

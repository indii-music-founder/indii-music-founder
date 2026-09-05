import type { AppSlice } from "./slices/appSlice";
import type { ProfileSlice } from "./slices/profileSlice";
import type { AgentSlice } from "./slices/agent";
import type { CreativeSlice } from "./slices/creative";
import type { WorkflowSlice } from "./slices/workflowSlice";
import type { AuthSlice } from "./slices/authSlice";
import type { FinanceSlice } from "./slices/financeSlice";
import type { DistributionSlice } from "./slices/distributionSlice";
import type { FileSystemSlice } from "./slices/fileSystemSlice";
import type { CanvasEditorSlice } from "./slices/creative/canvasEditorSlice";
import type { AudioIntelligenceSlice } from "./slices/audioIntelligenceSlice";
import type { SubscriptionSlice } from "./slices/subscriptionSlice";
import type { SidecarSlice } from "./slices/sidecarSlice";
import type { SyncSlice } from "./slices/syncSlice";
import type { AudioGenerationSlice } from "./slices/audioGenerationSlice";
import type { UploadQueueSlice } from "./slices/uploadQueueSlice";
import type { AudioPlayerSlice } from "./slices/audioPlayerSlice";
import type { BackgroundJobsSlice } from "./slices/backgroundJobsSlice";
import type { MemoryAgentSlice } from "./slices/memoryAgentSlice";
import type { MarketplaceSlice } from "./slices/marketplaceSlice";
import type { EmailSlice } from "./slices/emailSlice";
import type { AnalyticsSlice } from "./slices/analyticsSlice";
import type { BoardroomSlice } from "./slices/boardroomSlice";
import type { AgentFeedbackSlice } from "./slices/agentFeedbackSlice";
import type { RegistrationSlice } from "./slices/registrationSlice";
import type { AgentPlanSlice } from "./slices/agentPlanSlice";
import type { AgentCanvasSlice } from "./slices/agentCanvasSlice";
import type { AgentMemoryState } from "./slices/agentMemorySlice";
import type { HandoffSlice } from "./slices/handoffSlice";
import type { CRMSlice } from "./slices/crmSlice";
import type { MapSlice } from "./slices/mapSlice";
import type { NotesSlice } from "./slices/notesSlice";
import type { AgentSwarmSlice } from "./slices/agentSwarmSlice";
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

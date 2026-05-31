# Screenwriter & Script Generation Flowchart

This flowchart maps the **Screenwriter Module**—an AI-assisted screenplay generator for music video directors and film producers. It guides users from concept through final screenplay with scene breakdowns and video storyboards.

```mermaid
graph TD
    %% Entry
    subgraph Entry ["Screenwriter Entry Point"]
        ConceptInput["Concept Input (Genre, Tone, Characters, Duration)"]
        MusicUpload["Attach Master Track (Audio File)"]
        ReferenceInspo["Reference Inspiration (Mood Boards, Clips)"]
    end

    %% AI Generation
    subgraph AIGen ["AI Script Generation"]
        CreativeAgent["CreativeAgent (Story Intent)"]
        AudioAnalyzer["Audio Analyzer (Extract Beat, Dynamics)"]
        ScreenplayGen["Gemini 3.1 Pro (Generate Screenplay)"]
        SceneBreakdown["Scene Breakdown (Timing, Transitions)"]
    end

    %% Script Editor
    subgraph ScriptEdit ["Screenplay Editor"]
        ScriptCanvas["Screenplay Canvas (Full Script + Metadata)"]
        ScenePanel["Scene Panel (Edit Individual Scenes)"]
        TimingSync["Audio-to-Script Timing Sync"]
    end

    %% Storyboarding
    subgraph Storyboard ["Visual Storyboarding"]
        GenerateStoryboard["AI Storyboard Generation (Gemini 3.1 Vision)"]
        StoryboardGallery["Storyboard Frame Gallery"]
        FrameDescs["Frame Descriptions & Transitions"]
    end

    %% Data Persistence
    subgraph Data ["Data & Persistence"]
        ScreenwriterCollection["Firestore (`screenwriter` collection)"]
        ScriptStorage["Cloud Storage (PDF/Markdown Scripts)"]
        StoryboardStorage["Cloud Storage (Storyboard Images)"]
    end

    %% Export & Distribution
    subgraph Export ["Export & Distribution"]
        ExportPDF["Export to PDF (Professional Format)"]
        ShareLink["Shareable Link (Feedback Collection)"]
        SyncToProduction["Sync to Production Management (DaVinci, Final Cut)"]
    end

    %% Flow
    ConceptInput -->|"Describe Vision"| CreativeAgent
    MusicUpload -->|"Analyze for Pacing"| AudioAnalyzer
    ReferenceInspo -->|"Contextual Embedding"| CreativeAgent
    
    CreativeAgent -->|"Refined Prompt"| ScreenplayGen
    AudioAnalyzer -->|"Beat Map, Dynamics"| ScreenplayGen
    ScreenplayGen -->|"Generate Draft"| SceneBreakdown
    SceneBreakdown -->|"Map scenes to beat moments"| ScriptCanvas
    
    ScriptCanvas -->|"Load Screenplay"| ScenePanel
    ScenePanel -->|"Edit Scene Text"| ScriptCanvas
    TimingSync -->|"Sync markers to audio"| ScenePanel
    
    ScriptCanvas -->|"Extract scenes + descriptions"| GenerateStoryboard
    AudioAnalyzer -->|"Provide timing context"| GenerateStoryboard
    GenerateStoryboard -->|"Generate Visual Storyboard"| StoryboardGallery
    StoryboardGallery -->|"Display Frame + Desc"| FrameDescs
    
    ScriptCanvas -->|"Save Draft"| ScreenwriterCollection
    ScriptCanvas -->|"Export to PDF"| ExportPDF
    ExportPDF -->|"Archive"| ScriptStorage
    StoryboardGallery -->|"Export Frames"| StoryboardStorage
    
    ExportPDF -->|"Generate URL"| ShareLink
    ShareLink -->|"Gather Feedback"| ScriptCanvas
    
    ScriptCanvas -->|"Finalize & Export"| SyncToProduction

    %% Styling
    style ConceptInput fill:#00D4FF,color:#000
    style MusicUpload fill:#00D4FF,color:#000
    style ReferenceInspo fill:#00D4FF,color:#000

    style CreativeAgent fill:#FF00FF,color:#FFF
    style AudioAnalyzer fill:#8A2BE2,color:#FFF
    style ScreenplayGen fill:#39FF14,color:#000
    style SceneBreakdown fill:#8A2BE2,color:#FFF

    style ScriptCanvas fill:#00D4FF,color:#000
    style ScenePanel fill:#00D4FF,color:#000
    style TimingSync fill:#8A2BE2,color:#FFF

    style GenerateStoryboard fill:#39FF14,color:#000
    style StoryboardGallery fill:#00D4FF,color:#000
    style FrameDescs fill:#00D4FF,color:#000

    style ScreenwriterCollection fill:#39FF14,color:#000
    style ScriptStorage fill:#39FF14,color:#000
    style StoryboardStorage fill:#39FF14,color:#000

    style ExportPDF fill:#FF8C00,color:#000
    style ShareLink fill:#FF8C00,color:#000
    style SyncToProduction fill:#FF8C00,color:#000
```

## Transition Breakdown

1. **Concept Input:** User describes the music video concept—genre, tone, characters, duration. They upload the master track and optionally provide reference mood boards or video clips.

2. **Audio Analysis:** The **Audio Analyzer** extracts tempo, beat map, dynamic peaks, and sections (intro, verse, chorus, bridge). This temporal metadata guides screenplay pacing.

3. **AI Screenplay Generation:** The **Creative Agent** synthesizes the user's concept with the audio analysis and generates a draft screenplay via **Gemini 3.1 Pro**. The output is a full script with scene numbers, action lines, and dialogue.

4. **Scene Breakdown:** The **Scene Breakdown** engine maps each scene to specific moments in the audio (e.g., "Scene 3 starts at 1:32 (kick drop)"). This ensures the visual pacing aligns with the music.

5. **Screenplay Editor:** User loads the draft into the **Screenplay Canvas**—a full-page editor for the complete script. The **Scene Panel** allows frame-by-frame editing of individual scenes, with **Audio-to-Script Timing Sync** markers pinned to beat moments.

6. **Storyboarding:** Once the screenplay is locked, the system **generates a visual storyboard** using **Gemini 3.1 Vision** (image generation). Each frame has a visual description, transitions, and camera direction tied to the audio.

7. **Storyboard Gallery:** User browses the **Frame Gallery**, adjusting visual directions (e.g., "Make the lighting more blue") and adding notes for the production team.

8. **Export & Feedback:** User exports to **PDF** (professional screenplay format) and generates a **Shareable Link** for feedback from collaborators. Comments are synced back to the script.

9. **Production Handoff:** The finalized screenplay and storyboards are exported and synced to video editing software (**DaVinci Resolve, Final Cut Pro**) with embedded timing references.


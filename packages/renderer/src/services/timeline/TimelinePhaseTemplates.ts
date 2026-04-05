/**
 * TimelinePhaseTemplates.ts
 *
 * Pre-built phase templates for common multi-month campaign patterns.
 * These templates define phase structures with relative timing so they
 * scale to any duration the user chooses.
 *
 * Templates available:
 * - Single Release (8 weeks)
 * - Album Rollout (16 weeks)
 * - Merch Drop (4 weeks)
 * - Tour Promotion (12 weeks)
 * - indii 28-Day Frontloaded Growth Protocol (4 weeks)
 */

import type {
    TimelineTemplate,
    TimelineTemplateId,
} from './TimelineTypes';

// ============================================================================
// Single Release — 8 Week Campaign
// ============================================================================

const SINGLE_RELEASE_8W: TimelineTemplate = {
    id: 'single_release_8w',
    name: 'Single Release',
    description: 'An 8-week progressive campaign for releasing a single. Builds from mystery teasers to a full launch push, then sustains momentum post-release.',
    recommendedWeeks: 8,
    domains: ['marketing', 'social', 'publicist'],
    phases: [
        {
            name: 'Tease',
            relativeStartPercent: 0.0,
            relativeEndPercent: 0.25,
            cadence: 'sparse',
            agentId: 'social',
            description: 'Create mystery and curiosity. Cryptic visuals, vague dates, aesthetic posts that hint without revealing.',
            milestoneTemplates: [
                {
                    relativePosition: 0.1,
                    type: 'asset_creation',
                    instruction: 'Generate a cryptic teaser image — abstract, moody, aligned with the brand aesthetic. No release title yet, just atmosphere.',
                    assetStrategy: 'create_new',
                    platform: 'Instagram',
                },
                {
                    relativePosition: 0.3,
                    type: 'post',
                    instruction: 'Post the cryptic teaser with a mysterious one-line caption. No hashtags, no context. Let fans speculate.',
                    assetStrategy: 'auto',
                    platform: 'Instagram',
                },
                {
                    relativePosition: 0.5,
                    type: 'post',
                    instruction: 'Post a short text-only tweet with a single emoji or cryptic lyric fragment. Build curiosity on Twitter/X.',
                    assetStrategy: 'auto',
                    platform: 'Twitter',
                },
                {
                    relativePosition: 0.8,
                    type: 'asset_creation',
                    instruction: 'Generate a 15-second atmospheric video loop or animated visual that teases the vibe of the upcoming release.',
                    assetStrategy: 'create_new',
                },
            ],
        },
        {
            name: 'Build Hype',
            relativeStartPercent: 0.25,
            relativeEndPercent: 0.5,
            cadence: 'moderate',
            agentId: 'marketing',
            description: 'Gradually reveal more details. Behind-the-scenes content, snippets, announce the title and release date.',
            milestoneTemplates: [
                {
                    relativePosition: 0.0,
                    type: 'post',
                    instruction: 'Official title reveal post! Announce the single name with styled cover art or a graphic. Use relevant hashtags.',
                    assetStrategy: 'auto',
                    platform: 'Instagram',
                },
                {
                    relativePosition: 0.15,
                    type: 'post',
                    instruction: 'Cross-post the title reveal to Twitter/X with a shortened, punchier caption.',
                    assetStrategy: 'use_existing',
                    platform: 'Twitter',
                },
                {
                    relativePosition: 0.3,
                    type: 'pre_save_push',
                    instruction: 'Set up and share pre-save links across all platforms. Create a dedicated pre-save landing page.',
                    assetStrategy: 'create_new',
                },
                {
                    relativePosition: 0.5,
                    type: 'asset_creation',
                    instruction: 'Generate a behind-the-scenes style image or visual showing the creative process. Authentic, not polished.',
                    assetStrategy: 'create_new',
                },
                {
                    relativePosition: 0.6,
                    type: 'post',
                    instruction: 'Share a behind-the-scenes post about the making of the track. Personal story, studio vibes.',
                    assetStrategy: 'auto',
                    platform: 'Instagram',
                },
                {
                    relativePosition: 0.8,
                    type: 'post',
                    instruction: 'Post a 15-30 second audio snippet or lyric video teaser. Make fans want to hear the full thing.',
                    assetStrategy: 'auto',
                    platform: 'TikTok',
                },
                {
                    relativePosition: 0.9,
                    type: 'email_blast',
                    instruction: 'Send email to mailing list announcing the release date, pre-save link, and exclusive behind-the-scenes content.',
                    assetStrategy: 'create_new',
                },
            ],
        },
        {
            name: 'Launch Week',
            relativeStartPercent: 0.5,
            relativeEndPercent: 0.75,
            cadence: 'intense',
            agentId: 'marketing',
            description: 'Maximum intensity. Daily posts, multi-platform push, engage with every comment, collaborate with influencers.',
            milestoneTemplates: [
                {
                    relativePosition: 0.0,
                    type: 'post',
                    instruction: 'RELEASE DAY! Post the official cover art with streaming links across ALL platforms. High energy, celebratory tone.',
                    assetStrategy: 'use_existing',
                    platform: 'Instagram',
                },
                {
                    relativePosition: 0.0,
                    type: 'post',
                    instruction: 'Release day tweet thread: streaming links, thank yous, the story behind the song. Pin the main tweet.',
                    assetStrategy: 'use_existing',
                    platform: 'Twitter',
                },
                {
                    relativePosition: 0.1,
                    type: 'post',
                    instruction: 'Create and post a TikTok with a catchy clip from the song. Use trending format or challenge.',
                    assetStrategy: 'create_new',
                    platform: 'TikTok',
                },
                {
                    relativePosition: 0.2,
                    type: 'email_blast',
                    instruction: 'Send release day email blast with streaming links, personal note from artist, and exclusive content.',
                    assetStrategy: 'create_new',
                },
                {
                    relativePosition: 0.3,
                    type: 'asset_creation',
                    instruction: 'Generate a series of story/reel graphics showing streaming stats, fan reactions, and thank you messages.',
                    assetStrategy: 'create_new',
                },
                {
                    relativePosition: 0.4,
                    type: 'post',
                    instruction: 'Day 2 post: Share early reactions, fan comments, first-day streaming milestones.',
                    assetStrategy: 'auto',
                    platform: 'Instagram',
                },
                {
                    relativePosition: 0.5,
                    type: 'analytics_check',
                    instruction: 'Pull streaming data and social engagement metrics. Identify which platform is performing best and double down.',
                    assetStrategy: 'auto',
                },
                {
                    relativePosition: 0.6,
                    type: 'post',
                    instruction: 'Mid-week push: Create a carousel post showing lyrics, story, and visual art from the release.',
                    assetStrategy: 'create_new',
                    platform: 'Instagram',
                },
                {
                    relativePosition: 0.8,
                    type: 'post',
                    instruction: 'End of launch week: Gratitude post. Thank fans, shout out collaborators, tease what\'s next.',
                    assetStrategy: 'create_new',
                    platform: 'Instagram',
                },
                {
                    relativePosition: 0.9,
                    type: 'review_checkpoint',
                    instruction: 'Review launch week performance. Summarize metrics and recommend adjustments for the sustain phase.',
                    assetStrategy: 'auto',
                },
            ],
        },
        {
            name: 'Sustain',
            relativeStartPercent: 0.75,
            relativeEndPercent: 1.0,
            cadence: 'moderate',
            agentId: 'social',
            description: 'Keep the momentum alive. Remix teasers, user-generated content, playlist pitching updates, live session clips.',
            milestoneTemplates: [
                {
                    relativePosition: 0.1,
                    type: 'post',
                    instruction: 'Share user-generated content or fan covers. Engage with the community. Repost the best fan content.',
                    assetStrategy: 'auto',
                    platform: 'Instagram',
                },
                {
                    relativePosition: 0.25,
                    type: 'post',
                    instruction: 'Post a "1 week later" reflection — what the song means, how fans have responded, streaming milestones.',
                    assetStrategy: 'create_new',
                    platform: 'Twitter',
                },
                {
                    relativePosition: 0.4,
                    type: 'asset_creation',
                    instruction: 'Generate a visual recap graphic or infographic showing first-month performance (streams, adds, fan growth).',
                    assetStrategy: 'create_new',
                },
                {
                    relativePosition: 0.5,
                    type: 'post',
                    instruction: 'Post the performance recap with a heartfelt caption. Highlight streaming numbers and fan engagement.',
                    assetStrategy: 'auto',
                    platform: 'Instagram',
                },
                {
                    relativePosition: 0.7,
                    type: 'post',
                    instruction: 'Tease what\'s coming next. Could be a remix, music video, or the next single. Keep fans hooked.',
                    assetStrategy: 'create_new',
                    platform: 'TikTok',
                },
                {
                    relativePosition: 0.9,
                    type: 'review_checkpoint',
                    instruction: 'Final campaign review. Compile all metrics, identify wins and lessons. Archive the timeline.',
                    assetStrategy: 'auto',
                },
            ],
        },
    ],
};

// ============================================================================
// Album Rollout — 16 Week Campaign
// ============================================================================

const ALBUM_ROLLOUT_16W: TimelineTemplate = {
    id: 'album_rollout_16w',
    name: 'Album Rollout',
    description: 'A 16-week progressive rollout for a full album. Staggered singles, visual drops, and a coordinated multi-week launch campaign.',
    recommendedWeeks: 16,
    domains: ['marketing', 'social', 'publicist', 'distribution'],
    phases: [
        {
            name: 'Announce & First Single',
            relativeStartPercent: 0.0,
            relativeEndPercent: 0.2,
            cadence: 'sparse',
            agentId: 'marketing',
            description: 'Announce the album is coming. Drop the lead single, set the visual direction.',
            milestoneTemplates: [
                {
                    relativePosition: 0.1,
                    type: 'asset_creation',
                    instruction: 'Generate the album announcement graphic — title, artist name, and a "coming soon" message. Set the visual tone.',
                    assetStrategy: 'create_new',
                },
                {
                    relativePosition: 0.3,
                    type: 'post',
                    instruction: 'Official album announcement across all platforms. Share the announcement graphic with release window.',
                    assetStrategy: 'use_existing',
                    platform: 'Instagram',
                },
                {
                    relativePosition: 0.6,
                    type: 'pre_save_push',
                    instruction: 'Launch album pre-save links and landing page.',
                    assetStrategy: 'create_new',
                },
                {
                    relativePosition: 0.8,
                    type: 'agent_task',
                    instruction: 'Release the lead single. Coordinate with distribution agent for DSP delivery and marketing agent for push.',
                    assetStrategy: 'auto',
                    agentId: 'distribution',
                },
            ],
        },
        {
            name: 'Build with Singles',
            relativeStartPercent: 0.2,
            relativeEndPercent: 0.5,
            cadence: 'moderate',
            agentId: 'marketing',
            description: 'Drop additional singles every 2-3 weeks. Each one builds anticipation for the full album.',
            milestoneTemplates: [
                {
                    relativePosition: 0.0,
                    type: 'post',
                    instruction: 'Preview the next single — a short snippet, lyric tease, or behind-the-scenes from the recording session.',
                    assetStrategy: 'create_new',
                    platform: 'TikTok',
                },
                {
                    relativePosition: 0.2,
                    type: 'agent_task',
                    instruction: 'Release second single. Full marketing push — posts, stories, email blast.',
                    assetStrategy: 'auto',
                    agentId: 'distribution',
                },
                {
                    relativePosition: 0.4,
                    type: 'post',
                    instruction: 'Share track-by-track story posts for released singles. Give context, inspiration, collaborators.',
                    assetStrategy: 'create_new',
                    platform: 'Instagram',
                },
                {
                    relativePosition: 0.6,
                    type: 'agent_task',
                    instruction: 'Release third single (if applicable). Another marketing push cycle.',
                    assetStrategy: 'auto',
                    agentId: 'distribution',
                },
                {
                    relativePosition: 0.8,
                    type: 'email_blast',
                    instruction: 'Album countdown email — share tracklist, pre-order links, and exclusive behind-the-scenes content.',
                    assetStrategy: 'create_new',
                },
                {
                    relativePosition: 0.9,
                    type: 'review_checkpoint',
                    instruction: 'Mid-rollout check: analyze single performance, fan sentiment, pre-save numbers. Adjust remaining strategy.',
                    assetStrategy: 'auto',
                },
            ],
        },
        {
            name: 'Album Launch',
            relativeStartPercent: 0.5,
            relativeEndPercent: 0.7,
            cadence: 'intense',
            agentId: 'marketing',
            description: 'The main album release week(s). Maximum output, daily content, full-court press.',
            milestoneTemplates: [
                {
                    relativePosition: 0.0,
                    type: 'post',
                    instruction: 'ALBUM DROP DAY! Post the official cover art and streaming links across ALL platforms. Maximum energy.',
                    assetStrategy: 'use_existing',
                    platform: 'Instagram',
                },
                {
                    relativePosition: 0.1,
                    type: 'email_blast',
                    instruction: 'Album release email — streaming links, personal letter from artist, track-by-track guide.',
                    assetStrategy: 'create_new',
                },
                {
                    relativePosition: 0.2,
                    type: 'post',
                    instruction: 'Track-by-track commentary series: Post about individual songs with lyric cards and stories.',
                    assetStrategy: 'create_new',
                    platform: 'Instagram',
                },
                {
                    relativePosition: 0.4,
                    type: 'analytics_check',
                    instruction: 'Pull day-3 streaming data. Which tracks are resonating? Adjust push accordingly.',
                    assetStrategy: 'auto',
                },
                {
                    relativePosition: 0.6,
                    type: 'post',
                    instruction: 'Create TikTok content around the standout track identified by analytics.',
                    assetStrategy: 'create_new',
                    platform: 'TikTok',
                },
                {
                    relativePosition: 0.9,
                    type: 'review_checkpoint',
                    instruction: 'Week 1 album performance review. Compile all data and recommend sustain strategy.',
                    assetStrategy: 'auto',
                },
            ],
        },
        {
            name: 'Sustain & Tour Push',
            relativeStartPercent: 0.7,
            relativeEndPercent: 1.0,
            cadence: 'moderate',
            agentId: 'social',
            description: 'Keep streaming numbers growing. Transition into tour/merch promotion. Fan engagement focus.',
            milestoneTemplates: [
                {
                    relativePosition: 0.1,
                    type: 'post',
                    instruction: 'Share fan reactions, playlist features, and streaming milestones.',
                    assetStrategy: 'create_new',
                    platform: 'Instagram',
                },
                {
                    relativePosition: 0.3,
                    type: 'asset_creation',
                    instruction: 'Generate a visual recap infographic of album performance: total streams, top tracks, fan demographics.',
                    assetStrategy: 'create_new',
                },
                {
                    relativePosition: 0.5,
                    type: 'agent_task',
                    instruction: 'If tour dates exist, begin tour promotion cycle. Share venue/city-specific content.',
                    assetStrategy: 'auto',
                    agentId: 'road',
                },
                {
                    relativePosition: 0.7,
                    type: 'post',
                    instruction: 'Late-cycle surprise content: acoustic version snippet, remix tease, or music video BTS.',
                    assetStrategy: 'create_new',
                    platform: 'TikTok',
                },
                {
                    relativePosition: 0.95,
                    type: 'review_checkpoint',
                    instruction: 'Final album rollout review. Full campaign metrics, lessons learned, next project recommendations.',
                    assetStrategy: 'auto',
                },
            ],
        },
    ],
};

// ============================================================================
// Merch Drop — 4 Week Campaign
// ============================================================================

const MERCH_DROP_4W: TimelineTemplate = {
    id: 'merch_drop_4w',
    name: 'Merch Drop',
    description: 'A 4-week campaign for a merchandise drop. Tease designs, open pre-orders, ship, and handle the restock cycle.',
    recommendedWeeks: 4,
    domains: ['merchandise', 'marketing', 'social'],
    phases: [
        {
            name: 'Design Tease',
            relativeStartPercent: 0.0,
            relativeEndPercent: 0.3,
            cadence: 'sparse',
            agentId: 'merchandise',
            description: 'Tease the merchandise designs with close-up shots, fabric swatches, and mystery reveals.',
            milestoneTemplates: [
                {
                    relativePosition: 0.2,
                    type: 'asset_creation',
                    instruction: 'Generate a mystery teaser image showing a close-up detail or texture of the merch without revealing the full design.',
                    assetStrategy: 'create_new',
                },
                {
                    relativePosition: 0.5,
                    type: 'post',
                    instruction: 'Post the teaser with a "something\'s coming" caption. Minimal, intriguing.',
                    assetStrategy: 'auto',
                    platform: 'Instagram',
                },
                {
                    relativePosition: 0.9,
                    type: 'post',
                    instruction: 'Reveal the full design(s) with product mockups. Announce the pre-order date.',
                    assetStrategy: 'create_new',
                    platform: 'Instagram',
                },
            ],
        },
        {
            name: 'Pre-Order',
            relativeStartPercent: 0.3,
            relativeEndPercent: 0.55,
            cadence: 'moderate',
            agentId: 'marketing',
            description: 'Open pre-orders with urgency messaging. Limited editions, countdown timers.',
            milestoneTemplates: [
                {
                    relativePosition: 0.0,
                    type: 'post',
                    instruction: 'Pre-orders are LIVE! Share the store link with product photos and sizing info.',
                    assetStrategy: 'use_existing',
                    platform: 'Instagram',
                },
                {
                    relativePosition: 0.3,
                    type: 'email_blast',
                    instruction: 'Send merch drop email to mailing list with product images, pricing, and direct store link.',
                    assetStrategy: 'create_new',
                },
                {
                    relativePosition: 0.6,
                    type: 'post',
                    instruction: 'Showcase the merch in lifestyle context — someone wearing it, styled shots. Make it aspirational.',
                    assetStrategy: 'create_new',
                    platform: 'TikTok',
                },
                {
                    relativePosition: 0.9,
                    type: 'post',
                    instruction: 'Urgency post: "X days left to pre-order" or "Limited stock remaining". Drive final conversions.',
                    assetStrategy: 'create_new',
                    platform: 'Instagram',
                },
            ],
        },
        {
            name: 'Shipping & Unboxing',
            relativeStartPercent: 0.55,
            relativeEndPercent: 0.8,
            cadence: 'moderate',
            agentId: 'social',
            description: 'Orders shipping out. Encourage unboxing posts, share customer photos.',
            milestoneTemplates: [
                {
                    relativePosition: 0.2,
                    type: 'notification',
                    instruction: 'Notify: Orders have started shipping! Consider posting a packing video or shipping update.',
                    assetStrategy: 'auto',
                },
                {
                    relativePosition: 0.5,
                    type: 'post',
                    instruction: 'Repost customer unboxing photos/videos. Build social proof. Tag happy customers.',
                    assetStrategy: 'auto',
                    platform: 'Instagram',
                },
                {
                    relativePosition: 0.8,
                    type: 'post',
                    instruction: 'Compile the best customer photos into a carousel or collage. Community celebration post.',
                    assetStrategy: 'create_new',
                    platform: 'Instagram',
                },
            ],
        },
        {
            name: 'Restock & Next',
            relativeStartPercent: 0.8,
            relativeEndPercent: 1.0,
            cadence: 'sparse',
            agentId: 'merchandise',
            description: 'Handle restock demand, tease next drop.',
            milestoneTemplates: [
                {
                    relativePosition: 0.3,
                    type: 'post',
                    instruction: 'If items sold out: "Due to incredible demand, we\'re restocking [item]. Sign up to be notified."',
                    assetStrategy: 'create_new',
                    platform: 'Instagram',
                },
                {
                    relativePosition: 0.8,
                    type: 'review_checkpoint',
                    instruction: 'Merch drop analysis: units sold, revenue, top items, customer feedback. Plan the next drop.',
                    assetStrategy: 'auto',
                },
            ],
        },
    ],
};

// ============================================================================
// Tour Promotion — 12 Week Campaign
// ============================================================================

const TOUR_PROMO_12W: TimelineTemplate = {
    id: 'tour_promo_12w',
    name: 'Tour Promotion',
    description: 'A 12-week campaign for promoting a tour. From date reveals to post-show content.',
    recommendedWeeks: 12,
    domains: ['road', 'marketing', 'social'],
    phases: [
        {
            name: 'Announce Dates',
            relativeStartPercent: 0.0,
            relativeEndPercent: 0.2,
            cadence: 'moderate',
            agentId: 'road',
            description: 'Reveal tour dates, venues, and ticket links. Generate excitement.',
            milestoneTemplates: [
                {
                    relativePosition: 0.1,
                    type: 'asset_creation',
                    instruction: 'Generate the official tour poster with dates, cities, and venues. On-brand design.',
                    assetStrategy: 'create_new',
                },
                {
                    relativePosition: 0.3,
                    type: 'post',
                    instruction: 'Tour announcement! Share the poster with ticket links. High-energy caption.',
                    assetStrategy: 'use_existing',
                    platform: 'Instagram',
                },
                {
                    relativePosition: 0.5,
                    type: 'email_blast',
                    instruction: 'Tour announcement email with dates, ticket links, and VIP/early access options.',
                    assetStrategy: 'create_new',
                },
                {
                    relativePosition: 0.8,
                    type: 'post',
                    instruction: 'City-specific posts tagging local venues: "See you in [City]!" for top markets.',
                    assetStrategy: 'create_new',
                    platform: 'Twitter',
                },
            ],
        },
        {
            name: 'Early Bird & Ticket Push',
            relativeStartPercent: 0.2,
            relativeEndPercent: 0.45,
            cadence: 'moderate',
            agentId: 'marketing',
            description: 'Drive ticket sales. Early bird pricing, VIP packages, local market targeting.',
            milestoneTemplates: [
                {
                    relativePosition: 0.1,
                    type: 'post',
                    instruction: 'Early bird pricing ending soon! Create urgency around discounted tickets.',
                    assetStrategy: 'create_new',
                    platform: 'Instagram',
                },
                {
                    relativePosition: 0.4,
                    type: 'post',
                    instruction: 'Share a throwback clip or photo from a previous live show. Create FOMO.',
                    assetStrategy: 'auto',
                    platform: 'TikTok',
                },
                {
                    relativePosition: 0.7,
                    type: 'analytics_check',
                    instruction: 'Check ticket sales data. Identify underperforming dates and boost marketing for those cities.',
                    assetStrategy: 'auto',
                },
                {
                    relativePosition: 0.9,
                    type: 'post',
                    instruction: 'Ticket status update: "Almost sold out in [City]!" or "Just added VIP upgrades for [City]".',
                    assetStrategy: 'create_new',
                    platform: 'Instagram',
                },
            ],
        },
        {
            name: 'Countdown',
            relativeStartPercent: 0.45,
            relativeEndPercent: 0.7,
            cadence: 'intense',
            agentId: 'social',
            description: 'Final countdown to tour start. Daily content, rehearsal clips, setlist teasers.',
            milestoneTemplates: [
                {
                    relativePosition: 0.1,
                    type: 'post',
                    instruction: 'Rehearsal BTS content — show the band/artist prepping. Authentic, unpolished.',
                    assetStrategy: 'create_new',
                    platform: 'TikTok',
                },
                {
                    relativePosition: 0.3,
                    type: 'post',
                    instruction: '"1 week until tour starts!" countdown graphic with the first venue and date.',
                    assetStrategy: 'create_new',
                    platform: 'Instagram',
                },
                {
                    relativePosition: 0.6,
                    type: 'post',
                    instruction: 'Setlist tease — share 2-3 songs that will be played. Build anticipation for the live experience.',
                    assetStrategy: 'create_new',
                    platform: 'Twitter',
                },
                {
                    relativePosition: 0.9,
                    type: 'notification',
                    instruction: 'Tour starts tomorrow! Final reminder to check gear, merch inventory, and tech setup.',
                    assetStrategy: 'auto',
                },
            ],
        },
        {
            name: 'Live & Post-Show',
            relativeStartPercent: 0.7,
            relativeEndPercent: 1.0,
            cadence: 'intense',
            agentId: 'social',
            description: 'During and after shows — real-time content, crowd shots, city highlights, thank you posts.',
            milestoneTemplates: [
                {
                    relativePosition: 0.1,
                    type: 'post',
                    instruction: 'Post show recap from opening night: crowd photo, highlights, "Thank you [City]!"',
                    assetStrategy: 'auto',
                    platform: 'Instagram',
                },
                {
                    relativePosition: 0.3,
                    type: 'post',
                    instruction: 'Share a crowd-shot video or live performance clip. Tag the venue.',
                    assetStrategy: 'auto',
                    platform: 'TikTok',
                },
                {
                    relativePosition: 0.5,
                    type: 'post',
                    instruction: 'Mid-tour update: "X cities down, Y to go!" with a photo collage.',
                    assetStrategy: 'create_new',
                    platform: 'Instagram',
                },
                {
                    relativePosition: 0.8,
                    type: 'post',
                    instruction: 'Tour wrap post: heartfelt thank you to fans, crew, and venues. Highlight reel or carousel.',
                    assetStrategy: 'create_new',
                    platform: 'Instagram',
                },
                {
                    relativePosition: 0.95,
                    type: 'review_checkpoint',
                    instruction: 'Final tour debrief: total attendance, merch revenue, social growth during tour, city rankings.',
                    assetStrategy: 'auto',
                },
            ],
        },
    ],
};

// ============================================================================
// indii 28-Day Frontloaded Growth Protocol — 4 Week Cycle
// ============================================================================

/**
 * The indii Growth Protocol template — a 28-day front-loaded campaign cycle
 * optimized for triggering Spotify's algorithmic thresholds.
 *
 * Strategy: Concentrate Meta ad spend in the first 72 hours to create a stream
 * velocity spike (the `72_hour_spike` growth pattern), then sustain momentum
 * through the remaining 25 days to hit track popularity score milestones
 * (20 → 30 → 40 → 50+) which unlock Discover Weekly, Radio, and Autoplay placements.
 *
 * This template is designed to be used in a repeating 28-day cadence,
 * compounding artist popularity across multiple release cycles.
 */
const INDII_28_DAY_FRONTLOADED: TimelineTemplate = {
    id: 'indii_28_day_frontloaded',
    name: 'indii Growth Protocol',
    description: 'A 28-day front-loaded growth cycle that concentrates Meta ad spend in the first 72 hours to trigger Spotify algorithm thresholds, then sustains momentum to compound artist popularity.',
    recommendedWeeks: 4,
    domains: ['marketing', 'social', 'distribution'],
    phases: [
        // ── Phase 1: BLITZ (Days 1–3) ──────────────────────────────────────
        {
            name: 'Blitz',
            relativeStartPercent: 0.0,
            relativeEndPercent: 0.107,  // ~3 days of 28
            cadence: 'daily',
            agentId: 'marketing',
            description: 'Maximum intensity. Front-load 60–70% of total ad budget in the first 72 hours to trigger the 72-hour spike pattern and signal momentum to Spotify\'s algorithm.',
            milestoneTemplates: [
                {
                    relativePosition: 0.0,
                    type: 'agent_task',
                    instruction: 'RELEASE DAY: Coordinate with Distribution Agent to confirm the track is live on all DSPs. Verify Spotify URI is active and pre-save conversions have landed.',
                    assetStrategy: 'auto',
                    agentId: 'distribution',
                },
                {
                    relativePosition: 0.0,
                    type: 'asset_creation',
                    instruction: 'Generate 5 ad creative variants for Meta Ads: 3 short-form video clips (15s, using veo-3.1-generate-preview) and 2 static image ads (using gemini-3-pro-image-preview). Each must include a clear CTA routing to the Spotify track link.',
                    assetStrategy: 'create_new',
                },
                {
                    relativePosition: 0.1,
                    type: 'agent_task',
                    instruction: 'Deploy all 5 ad creatives to Meta Ads Manager via Instagram Graph API. Target: pixel-tracked landing page conversions routing to Spotify. Set budget to 60% of total campaign allocation. Audience: lookalike of existing listeners + interest-based targeting.',
                    assetStrategy: 'auto',
                    agentId: 'marketing',
                },
                {
                    relativePosition: 0.1,
                    type: 'post',
                    instruction: 'Release day announcement across ALL social platforms. Cover art, streaming links, personal message from the artist. Maximum energy.',
                    assetStrategy: 'use_existing',
                    platform: 'Instagram',
                },
                {
                    relativePosition: 0.2,
                    type: 'post',
                    instruction: 'Create and post a TikTok with the catchiest 15-second clip. Use a trending format or challenge mechanic.',
                    assetStrategy: 'create_new',
                    platform: 'TikTok',
                },
                {
                    relativePosition: 0.3,
                    type: 'email_blast',
                    instruction: 'Send release day email blast to the full mailing list: streaming links, personal note, and a "listen now" CTA with urgency.',
                    assetStrategy: 'create_new',
                },
                {
                    relativePosition: 0.5,
                    type: 'analytics_check',
                    instruction: 'Pull Day 1 streaming velocity data. Check stream count, save rate, and completion rate. If velocity is below 1.5x target, increase ad spend by 20% for Days 2–3.',
                    assetStrategy: 'auto',
                },
                {
                    relativePosition: 0.7,
                    type: 'post',
                    instruction: 'Day 2 push: Share early streaming milestones, fan reactions, and social proof. Repost the best UGC.',
                    assetStrategy: 'auto',
                    platform: 'Instagram',
                },
                {
                    relativePosition: 0.9,
                    type: 'analytics_check',
                    instruction: 'End of 72-hour blitz: Pull comprehensive data — total streams, track popularity score, save rate, completion rate. Determine if the 72_hour_spike pattern triggered. Report to indii Conductor for tactical decisions.',
                    assetStrategy: 'auto',
                },
            ],
        },
        // ── Phase 2: SUSTAIN (Days 4–10) ───────────────────────────────────
        {
            name: 'Sustain',
            relativeStartPercent: 0.107,
            relativeEndPercent: 0.357,  // ~days 4-10 of 28
            cadence: 'moderate',
            agentId: 'marketing',
            description: 'Maintain stream velocity above the algorithmic threshold. Reduce ad spend to 20% of budget but sustain consistent daily reach. Monitor popularity score milestones (20, 30, 40).',
            milestoneTemplates: [
                {
                    relativePosition: 0.0,
                    type: 'agent_task',
                    instruction: 'Adjust Meta ad budget to sustain phase allocation (20% of total). Pause underperforming creatives, scale winners. Maintain daily impression floor to prevent score tapering.',
                    assetStrategy: 'auto',
                    agentId: 'marketing',
                },
                {
                    relativePosition: 0.15,
                    type: 'post',
                    instruction: 'Behind-the-scenes content: studio session clips, lyric breakdown, or production story. Authentic, personal.',
                    assetStrategy: 'create_new',
                    platform: 'TikTok',
                },
                {
                    relativePosition: 0.3,
                    type: 'asset_creation',
                    instruction: 'Generate 2 new ad creative variants based on best-performing elements from the Blitz phase. Refresh the creative to combat ad fatigue.',
                    assetStrategy: 'create_new',
                },
                {
                    relativePosition: 0.5,
                    type: 'analytics_check',
                    instruction: 'Mid-sustain check: Pull track popularity score. If approaching a 10-point milestone (20, 30, 40), trigger a micro-burst of increased ad spend to push past the threshold.',
                    assetStrategy: 'auto',
                },
                {
                    relativePosition: 0.7,
                    type: 'post',
                    instruction: 'Engagement post: Ask fans a question about the track, run a poll, or share a lyric card. Drive saves and shares.',
                    assetStrategy: 'create_new',
                    platform: 'Instagram',
                },
                {
                    relativePosition: 0.9,
                    type: 'review_checkpoint',
                    instruction: 'Sustain phase review: track popularity score delta, ad ROAS, save rate trend, and playlist adds. Determine if organic momentum is building or still ad-dependent.',
                    assetStrategy: 'auto',
                },
            ],
        },
        // ── Phase 3: ALGORITHMIC CLIMB (Days 11–21) ────────────────────────
        {
            name: 'Algorithmic Climb',
            relativeStartPercent: 0.357,
            relativeEndPercent: 0.75,  // ~days 11-21 of 28
            cadence: 'moderate',
            agentId: 'social',
            description: 'Ride the algorithmic wave. Spotify should be recommending the track in Discover Weekly, Radio, and Autoplay by now. Shift focus from paid to organic amplification. Maintain 10–15% of budget on retargeting.',
            milestoneTemplates: [
                {
                    relativePosition: 0.0,
                    type: 'analytics_check',
                    instruction: 'Check Discover Weekly inclusion, Radio placements, and Autoplay data. Confirm algorithmic pickup. If not yet triggered, execute contingency: targeted playlist pitching and micro-influencer UGC push.',
                    assetStrategy: 'auto',
                },
                {
                    relativePosition: 0.15,
                    type: 'post',
                    instruction: 'Share a "thank you" milestone post if key streaming numbers have been hit. Show gratitude, build community.',
                    assetStrategy: 'create_new',
                    platform: 'Instagram',
                },
                {
                    relativePosition: 0.3,
                    type: 'post',
                    instruction: 'Create a remix, acoustic, or live version snippet for TikTok/Reels to re-stimulate social discovery.',
                    assetStrategy: 'create_new',
                    platform: 'TikTok',
                },
                {
                    relativePosition: 0.5,
                    type: 'analytics_check',
                    instruction: 'Weekly growth check: track popularity score, velocity trend, save-to-stream ratio. Compare against the previous 28-day cycle if one exists. Report to indii Conductor.',
                    assetStrategy: 'auto',
                },
                {
                    relativePosition: 0.65,
                    type: 'post',
                    instruction: 'Cross-platform content push: Twitter lyric thread, Instagram carousel of fan favorites, YouTube community post. Cast a wide net.',
                    assetStrategy: 'create_new',
                    platform: 'Twitter',
                },
                {
                    relativePosition: 0.85,
                    type: 'agent_task',
                    instruction: 'Reduce Meta retargeting to minimum viable spend. The algorithm should be self-sustaining at this phase. Reallocate remaining budget to the next cycle\'s Blitz reserve.',
                    assetStrategy: 'auto',
                    agentId: 'marketing',
                },
            ],
        },
        // ── Phase 4: HARVEST & PREP (Days 22–28) ──────────────────────────
        {
            name: 'Harvest & Prep',
            relativeStartPercent: 0.75,
            relativeEndPercent: 1.0,  // ~days 22-28 of 28
            cadence: 'sparse',
            agentId: 'marketing',
            description: 'Harvest final data from this cycle. Compile the growth report. Begin pre-production for the NEXT 28-day cycle — the compounding effect is the key to exponential growth.',
            milestoneTemplates: [
                {
                    relativePosition: 0.1,
                    type: 'analytics_check',
                    instruction: 'Full cycle analytics: final track popularity score, total streams, ROAS, cost-per-stream, save rate, playlist adds, follower growth. Compare to previous cycle.',
                    assetStrategy: 'auto',
                },
                {
                    relativePosition: 0.3,
                    type: 'asset_creation',
                    instruction: 'Generate a visual performance report graphic showing the growth curve, key milestones hit, and popularity score trajectory.',
                    assetStrategy: 'create_new',
                },
                {
                    relativePosition: 0.5,
                    type: 'post',
                    instruction: 'Tease the next release or content drop. Keep fans engaged in the transition between cycles. Mystery, countdowns, or snippet reveals.',
                    assetStrategy: 'create_new',
                    platform: 'Instagram',
                },
                {
                    relativePosition: 0.7,
                    type: 'agent_task',
                    instruction: 'Begin next-cycle pre-production: coordinate with Creative Director to start generating ad creatives for the next Blitz phase. Ensure the asset pipeline is primed before Day 1.',
                    assetStrategy: 'auto',
                    agentId: 'director',
                },
                {
                    relativePosition: 0.9,
                    type: 'review_checkpoint',
                    instruction: 'CYCLE COMPLETE: Full indii Growth Protocol report. Include: popularity score delta, algorithmic placement status, cycle-over-cycle growth rate, budget efficiency, and recommended adjustments for the next 28-day cycle.',
                    assetStrategy: 'auto',
                },
            ],
        },
    ],
};

// ============================================================================
// indii Curator Playlist Builder — Ongoing (Between Releases)
// ============================================================================

/**
 * The indii Curator Playlist Builder template — a secondary steady-state campaign
 * for building owned algorithmic authority between releases.
 *
 * Strategy: The artist builds and promotes 60-100 song genre-specific playlists
 * on Spotify, running low-budget Meta ads to grow playlist followers. This creates:
 *   1. An owned media channel with algorithmic weight
 *   2. A direct injection point for future releases (add your track to YOUR playlist)
 *   3. Saver Lookalike audience training data for future blitz campaigns
 *   4. Passive income potential via playlist placement deals
 *
 * Designed to run continuously between 28-day release cycles.
 */
const INDII_CURATOR_PLAYLIST_BUILDER: TimelineTemplate = {
    id: 'indii_curator_playlist_builder',
    name: 'indii Curator Playlist Builder',
    description: 'An ongoing, low-budget campaign to build owned genre playlists on Spotify. Grows algorithmic authority and creates injection points for future releases.',
    recommendedWeeks: 8,  // Initial setup + growth phase; designed to repeat indefinitely
    domains: ['marketing', 'social'],
    phases: [
        // ── Phase 1: CURATE (Weeks 1-2) ──────────────────────────────────
        {
            name: 'Curate',
            relativeStartPercent: 0.0,
            relativeEndPercent: 0.25,
            cadence: 'moderate',
            agentId: 'social',
            description: 'Build 2-3 genre playlists (60-100 tracks each) on Spotify. Source tracks from similar artists, trending sounds, and the artist\'s own catalog. Title and brand them for discoverability.',
            milestoneTemplates: [
                {
                    relativePosition: 0.1,
                    type: 'agent_task',
                    instruction: 'Research and compile a list of 60-100 tracks for the primary genre playlist. Mix established artists (30%), rising artists (40%), and the indii artist\'s own tracks (30%). Title the playlist for SEO discoverability.',
                    assetStrategy: 'auto',
                },
                {
                    relativePosition: 0.4,
                    type: 'asset_creation',
                    instruction: 'Generate branded playlist cover art for each playlist using gemini-3-pro-image-preview. Must match artist brand kit aesthetic. Include playlist name and artist branding.',
                    assetStrategy: 'create_new',
                },
                {
                    relativePosition: 0.7,
                    type: 'post',
                    instruction: 'Announce the playlist on social media. Share the Spotify URI with a personal note about why these songs were curated. Authentic, music-lover tone.',
                    assetStrategy: 'auto',
                    platform: 'Instagram',
                },
                {
                    relativePosition: 0.9,
                    type: 'review_checkpoint',
                    instruction: 'Verify all playlists are live with correct artwork, descriptions, and track ordering. Confirm Spotify playlist URIs are accessible for ad campaigns.',
                    assetStrategy: 'auto',
                },
            ],
        },
        // ── Phase 2: PROMOTE (Weeks 3-5) ─────────────────────────────────
        {
            name: 'Promote',
            relativeStartPercent: 0.25,
            relativeEndPercent: 0.625,
            cadence: 'sparse',
            agentId: 'marketing',
            description: 'Run low-budget Meta ads ($3-5/day) driving playlist follows. Instagram-Only placement (Stories + Reels). Track follower growth rate.',
            milestoneTemplates: [
                {
                    relativePosition: 0.0,
                    type: 'asset_creation',
                    instruction: 'Generate 3 ad creative variants for playlist promotion: vertical video (15s mood reel with track previews), static carousel, and a story-format testimonial. All must route to Spotify playlist link.',
                    assetStrategy: 'create_new',
                },
                {
                    relativePosition: 0.1,
                    type: 'agent_task',
                    instruction: 'Deploy playlist ads to Meta. STRICT: Instagram-Only placements (Stories, Reels, Feed). Ban Audience Network, Facebook Feed, Messenger. Budget: $3-5/day per playlist. Audience: genre-interest based.',
                    assetStrategy: 'auto',
                    agentId: 'marketing',
                },
                {
                    relativePosition: 0.5,
                    type: 'analytics_check',
                    instruction: 'Mid-promotion check: playlist follower count, cost-per-follow, ad CTR. If CPF > $0.50, refresh creatives. Target: 500+ followers in first 3 weeks.',
                    assetStrategy: 'auto',
                },
                {
                    relativePosition: 0.8,
                    type: 'post',
                    instruction: 'Share a "playlist update" post highlighting new tracks added this week. Tag featured artists to drive organic discovery.',
                    assetStrategy: 'auto',
                    platform: 'Instagram',
                },
            ],
        },
        // ── Phase 3: GROW & MAINTAIN (Weeks 6-8) ─────────────────────────
        {
            name: 'Grow & Maintain',
            relativeStartPercent: 0.625,
            relativeEndPercent: 1.0,
            cadence: 'sparse',
            agentId: 'social',
            description: 'Sustain playlist growth with weekly track refreshes and organic social pushes. Begin monetizing placement requests from other artists.',
            milestoneTemplates: [
                {
                    relativePosition: 0.2,
                    type: 'agent_task',
                    instruction: 'Refresh playlist: remove 5-10 underperforming tracks, add 5-10 fresh tracks. Keep the artist\'s own tracks in prominent positions (top 10, mid-playlist feature).',
                    assetStrategy: 'auto',
                },
                {
                    relativePosition: 0.5,
                    type: 'analytics_check',
                    instruction: 'Full playlist audit: total followers, monthly listener reach, follower growth rate, engagement metrics. Assess readiness for next release injection.',
                    assetStrategy: 'auto',
                },
                {
                    relativePosition: 0.8,
                    type: 'review_checkpoint',
                    instruction: 'Curator cycle review: total followers gained, cost per follower, organic growth rate, playlist save rate. Recommend whether to continue, scale up, or create additional genre playlists.',
                    assetStrategy: 'auto',
                },
            ],
        },
    ],
};

// ============================================================================
// Registry
// ============================================================================

/**
 * All available timeline templates indexed by ID.
 */
export const TIMELINE_TEMPLATES: Record<TimelineTemplateId, TimelineTemplate | null> = {
    single_release_8w: SINGLE_RELEASE_8W,
    album_rollout_16w: ALBUM_ROLLOUT_16W,
    merch_drop_4w: MERCH_DROP_4W,
    tour_promo_12w: TOUR_PROMO_12W,
    indii_28_day_frontloaded: INDII_28_DAY_FRONTLOADED,
    indii_curator_playlist_builder: INDII_CURATOR_PLAYLIST_BUILDER,
    custom: null, // Custom timelines are generated purely by AI
};

/**
 * Get a template by ID.
 */
export function getTimelineTemplate(id: TimelineTemplateId): TimelineTemplate | null {
    return TIMELINE_TEMPLATES[id] ?? null;
}

/**
 * List all available templates with descriptions.
 */
export function listTimelineTemplates(): Array<{ id: TimelineTemplateId; name: string; description: string; recommendedWeeks: number }> {
    return Object.entries(TIMELINE_TEMPLATES)
        .filter(([_, template]) => template !== null)
        .map(([id, template]) => ({
            id: id as TimelineTemplateId,
            name: template!.name,
            description: template!.description,
            recommendedWeeks: template!.recommendedWeeks,
        }));
}

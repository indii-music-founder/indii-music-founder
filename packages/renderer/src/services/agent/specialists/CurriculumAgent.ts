/* eslint-disable @typescript-eslint/no-explicit-any -- Service layer uses dynamic types for external API responses */
import { BaseAgent } from '../BaseAgent';
import { AgentConfig, AgentContext } from '../types';
import systemPrompt from '@agents/indii_curriculum/prompt.md?raw';

export class CurriculumAgent extends BaseAgent {
    constructor() {
        const config: AgentConfig = {
            id: 'curriculum',
            name: 'Music Education Specialist',
            description: 'Teaches independent artists the music business — copyright, royalties, contracts, distribution, and building a sustainable career.',
            color: 'bg-pink-500',
            category: 'specialist',
            systemPrompt,
            authorizedTools: ['create_learning_path', 'generate_quiz', 'search_knowledge'],
            tools: [
                {
                    functionDeclarations: [
                        {
                            name: 'create_learning_path',
                            description: 'Generates a structured, progressive learning path for a given music business topic and skill level. Returns modules, priority order, and time estimates.',
                            parameters: {
                                type: 'OBJECT',
                                properties: {
                                    level: {
                                        type: 'STRING',
                                        enum: ['beginner', 'intermediate', 'advanced'],
                                        description: 'The artist\'s current knowledge level for this topic.'
                                    },
                                    focus: {
                                        type: 'STRING',
                                        description: 'The topic area to build a path for (e.g. "music_business_foundations", "label_deal_preparation", "scaling_independent_career", "publishing_basics").'
                                    },
                                    artistGoal: {
                                        type: 'STRING',
                                        enum: ['fully-independent', 'label-deal', 'hybrid'],
                                        description: 'The artist\'s career goal — affects which modules are prioritized.'
                                    }
                                },
                                required: ['level', 'focus']
                            }
                        },
                        {
                            name: 'generate_quiz',
                            description: 'Generates knowledge-check quiz questions based on completed modules and skill level.',
                            parameters: {
                                type: 'OBJECT',
                                properties: {
                                    modules: {
                                        type: 'ARRAY',
                                        items: { type: 'STRING' },
                                        description: 'List of module IDs the quiz should cover (e.g. ["copyright_basics", "pro_registration", "distributor_setup"]).'
                                    },
                                    level: {
                                        type: 'STRING',
                                        enum: ['entry', 'intermediate', 'expert'],
                                        description: 'Difficulty level of quiz questions.'
                                    },
                                    questionCount: {
                                        type: 'NUMBER',
                                        description: 'Number of questions to generate (default: 5).'
                                    }
                                },
                                required: ['modules', 'level']
                            }
                        },
                        {
                            name: 'search_knowledge',
                            description: 'Searches the indii knowledge base for up-to-date music industry information, rate schedules, and legal context.',
                            parameters: {
                                type: 'OBJECT',
                                properties: {
                                    query: {
                                        type: 'STRING',
                                        description: 'The search query (e.g. "CRB mechanical royalty rates 2026", "SoundExchange registration steps", "ASCAP vs BMI comparison").'
                                    }
                                },
                                required: ['query']
                            }
                        }
                    ]
                }
            ]
        };
        super(config);

        // -- Tool Implementations --

        this.functions['create_learning_path'] = async (args: any, _context?: AgentContext) => {
            const { level, focus, artistGoal } = args;

            const pathTemplates: Record<string, Record<string, string[]>> = {
                music_business_foundations: {
                    beginner: [
                        'Module 1 — The Two Copyrights (composition vs. master recording)',
                        'Module 2 — PRO Registration (ASCAP or BMI) + MLC + SoundExchange',
                        'Module 3 — Choosing a Distributor (DistroKid, TuneCore, CD Baby comparison)',
                        'Module 4 — What ISRC and UPC codes are and why they matter',
                        'Module 5 — Split Sheets: why you need one for every collaboration',
                        'Module 6 — Copyright Registration (US Copyright Office, $45/song)',
                        'Module 7 — How royalties flow: DSP → distributor → your bank account',
                        'Module 8 — Music Business Entity (LLC) and separating business finances'
                    ],
                    intermediate: [
                        'Module 1 — Mechanical royalties: statutory rates, CRB Phonorecords IV',
                        'Module 2 — Neighboring rights: SoundExchange and international collection',
                        'Module 3 — Publishing splits: writer share vs. publisher share',
                        'Module 4 — Sync licensing basics: master + sync license, fee structures',
                        'Module 5 — Distribution comparison: 100% royalty vs. label services',
                        'Module 6 — Music income tax: Schedule C, SE tax, deductions',
                        'Module 7 — Streaming analytics: save rate, completion rate, playlist metrics'
                    ],
                    advanced: [
                        'Module 1 — Publishing administration: self-publishing vs. co-publishing vs. full pub deals',
                        'Module 2 — International royalty collection: sub-publishing and reciprocal agreements',
                        'Module 3 — YouTube Content ID: monetizing UGC and claim management',
                        'Module 4 — S-Corp election and music income tax optimization',
                        'Module 5 — Direct-to-fan economics: email list vs. streaming dependency',
                        'Module 6 — Team structure: manager commission structures and conflict of interest',
                        'Module 7 — Data-driven release strategy: release windows, DSP pitching timelines'
                    ]
                },
                label_deal_preparation: {
                    beginner: [
                        'Module 1 — Recoupment explained: the advance is a loan, not a gift',
                        'Module 2 — Royalty rates: what\'s standard (15-20%), what\'s good (22%+)',
                        'Module 3 — Work-for-hire vs. copyright assignment: the permanent difference',
                        'Module 4 — 360 deal anatomy: which revenue streams labels typically claim',
                        'Module 5 — Building pre-deal leverage: know your numbers before they do',
                        'Module 6 — The team you need before signing: attorney, accountant, manager',
                        'Module 7 — Option periods: how many albums does the deal control?',
                        'Module 8 — Reversion rights: when do your masters come back?'
                    ],
                    intermediate: [
                        'Module 1 — Key person clause: protecting yourself if your A&R leaves',
                        'Module 2 — Territory and term negotiation: worldwide forever vs. limited',
                        'Module 3 — Marketing commitments: how to get guarantees in writing',
                        'Module 4 — Joint venture vs. distribution deal vs. label services',
                        'Module 5 — Audit rights: your right to verify royalty accounting',
                        'Module 6 — Creative control clauses: approval rights over singles, videos, artwork'
                    ],
                    advanced: []
                },
                scaling_independent_career: {
                    beginner: [],
                    intermediate: [],
                    advanced: [
                        'Module 1 — Neighboring rights for established artists: PPL and international agencies',
                        'Module 2 — Sync licensing strategy: catalog positioning and agent relationships',
                        'Module 3 — YouTube Content ID: capturing UGC monetization at scale',
                        'Module 4 — International sub-publishing: collecting the 40-60% you\'re missing',
                        'Module 5 — Direct-to-fan conversion: 2% of your Spotify listeners = your email list',
                        'Module 6 — S-Corp election at $60k+ income: saving $5-8k/year',
                        'Module 7 — Team ROI analysis: when commission-based hires pay for themselves'
                    ]
                }
            };

            const focusKey = focus.toLowerCase().replace(/[^a-z_]/g, '_');
            const modules = pathTemplates[focusKey]?.[level] || [
                `Module 1 — ${focus}: Foundations and key concepts`,
                `Module 2 — ${focus}: Practical application`,
                `Module 3 — ${focus}: Common mistakes and how to avoid them`,
                `Module 4 — ${focus}: Advanced strategy and optimization`
            ];

            return {
                success: true,
                data: {
                    path: {
                        focus,
                        level,
                        artistGoal: artistGoal || 'fully-independent',
                        modules,
                        estimatedTime: `${modules.length * 15}-${modules.length * 25} minutes total`,
                        nextStep: modules[0] || 'Start with the foundations'
                    }
                },
                message: `Learning path created for ${focus} at ${level} level — ${modules.length} modules.`
            };
        };

        this.functions['generate_quiz'] = async (args: any, _context?: AgentContext) => {
            const { modules, level, questionCount = 5 } = args;

            const moduleQuestions: Record<string, any[]> = {
                copyright_basics: [
                    {
                        q: 'You write a song and record it in your bedroom. How many copyrights exist in this recording?',
                        options: ['a) One', 'b) Two — composition and master', 'c) Three', 'd) None until registered'],
                        answer: 'b',
                        explanation: 'Two copyrights: the composition (melody + lyrics) and the master recording. You own both automatically.'
                    },
                    {
                        q: 'True or False: You must register a song with the US Copyright Office before you own the copyright.',
                        options: ['True', 'False'],
                        answer: 'False',
                        explanation: 'Copyright exists automatically upon creation. Registration strengthens your ability to sue and enables statutory damages.'
                    }
                ],
                pro_registration: [
                    {
                        q: 'You registered with ASCAP. Your music gets played on a Spotify playlist. Which royalty does ASCAP collect for you?',
                        options: ['a) Mechanical royalties', 'b) Performance royalties', 'c) Master use royalties', 'd) Neighboring rights'],
                        answer: 'b',
                        explanation: 'PROs collect performance royalties when music is publicly performed — including on streaming services.'
                    },
                    {
                        q: 'Which organization collects mechanical royalties for interactive streaming in the US?',
                        options: ['a) ASCAP', 'b) BMI', 'c) The MLC', 'd) SoundExchange'],
                        answer: 'c',
                        explanation: 'The Mechanical Licensing Collective (themlc.com) was established under the Music Modernization Act to collect mechanical royalties for interactive streaming.'
                    }
                ],
                distributor_setup: [
                    {
                        q: 'You uploaded through DistroKid. It\'s on Spotify, Apple Music, and Tidal. DistroKid collected $400 in royalties. What type is this?',
                        options: ['a) Performance royalty', 'b) Master recording royalty / streaming revenue', 'c) Publishing royalty', 'd) Sync fee'],
                        answer: 'b',
                        explanation: 'Your distributor collects master recording royalties (the streaming payout). Publishing royalties go through your PRO and the MLC separately.'
                    }
                ],
                recoupment: [
                    {
                        q: 'A label offers you a $200k advance with a 20% royalty rate. Your album generates $1M in streaming revenue for the label. How much do you receive?',
                        options: ['a) $200,000', 'b) $0 (still recouping)', 'c) $200,000 minus taxes', 'd) $1,000,000'],
                        answer: 'b',
                        explanation: '$1M × 20% = $200k in royalties — exactly the advance amount. You have to exceed the advance before seeing additional money. Many artists never recoup.'
                    }
                ]
            };

            const allQuestions: any[] = [];
            for (const moduleId of modules) {
                const qs = moduleQuestions[moduleId] || [];
                allQuestions.push(...qs);
            }

            // Fill with generic questions if not enough specific ones
            while (allQuestions.length < questionCount) {
                allQuestions.push({
                    q: `What is the primary purpose of registering with a PRO as a songwriter?`,
                    options: ['a) To register copyright', 'b) To collect performance royalties', 'c) To distribute music', 'd) To protect your stage name'],
                    answer: 'b',
                    explanation: 'PROs collect performance royalties when your music is publicly performed (radio, streaming, live venues).'
                });
            }

            return {
                success: true,
                data: {
                    quiz: {
                        modules,
                        level,
                        questions: allQuestions.slice(0, questionCount),
                        totalQuestions: Math.min(questionCount, allQuestions.length)
                    }
                },
                message: `Quiz generated: ${Math.min(questionCount, allQuestions.length)} questions covering ${modules.join(', ')}.`
            };
        };

        this.functions['search_knowledge'] = async (args: any, context?: AgentContext) => {
            const { query } = args;

            try {
                const { knowledgeBaseService } = await import('@/modules/knowledge/services/KnowledgeBaseService');
                const result = await knowledgeBaseService.chat(query, null, context?.projectId ?? undefined);
                return {
                    success: true,
                    data: { result },
                    message: 'Knowledge base search complete.'
                };
            } catch (__err: unknown) {
                return {
                    success: false,
                    error: 'Knowledge base unavailable. Answering from training data.'
                };
            }
        };
    }
}

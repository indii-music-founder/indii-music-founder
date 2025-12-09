import { v4 as uuidv4 } from 'uuid';
import { SavedWorkflow, Status } from '../types';

export const WORKFLOW_TEMPLATES: SavedWorkflow[] = [
    {
        id: 'template-simple-image',
        name: 'Simple Concept Art',
        description: 'Generate a concept art image from a text prompt.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [
            {
                id: 'start',
                type: 'inputNode',
                position: { x: 100, y: 200 },
                data: {
                    nodeType: 'input',
                    prompt: 'A futuristic city with neon lights',
                    status: Status.PENDING
                }
            },
            {
                id: 'art-1',
                type: 'departmentNode',
                position: { x: 400, y: 200 },
                data: {
                    nodeType: 'department',
                    departmentName: 'Art Department',
                    selectedJobId: 'art-department-job-0', // Concept Art
                    status: Status.PENDING
                }
            },
            {
                id: 'end',
                type: 'outputNode',
                position: { x: 700, y: 200 },
                data: {
                    nodeType: 'output',
                    status: Status.PENDING
                }
            }
        ],
        edges: [
            { id: 'e1', source: 'start', target: 'art-1', sourceHandle: 'trigger', targetHandle: 'trigger' },
            { id: 'e2', source: 'art-1', target: 'end', sourceHandle: 'trigger_out', targetHandle: 'trigger' }
        ]
    },
    {
        id: 'template-video-teaser',
        name: 'Video Teaser Campaign',
        description: 'Create concept art, animate it, and write a tweet.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [
            {
                id: 'start',
                type: 'inputNode',
                position: { x: 50, y: 250 },
                data: {
                    nodeType: 'input',
                    prompt: 'A cyberpunk detective in the rain',
                    status: Status.PENDING
                }
            },
            {
                id: 'art-1',
                type: 'departmentNode',
                position: { x: 350, y: 250 },
                data: {
                    nodeType: 'department',
                    departmentName: 'Art Department',
                    selectedJobId: 'art-department-job-0',
                    status: Status.PENDING
                }
            },
            {
                id: 'video-1',
                type: 'departmentNode',
                position: { x: 650, y: 250 },
                data: {
                    nodeType: 'department',
                    departmentName: 'Video Department',
                    selectedJobId: 'video-img-to-video',
                    status: Status.PENDING
                }
            },
            {
                id: 'social-1',
                type: 'departmentNode',
                position: { x: 950, y: 250 },
                data: {
                    nodeType: 'department',
                    departmentName: 'Social Media Department',
                    selectedJobId: 'social-media-department-job-0',
                    status: Status.PENDING
                }
            },
            {
                id: 'end',
                type: 'outputNode',
                position: { x: 1250, y: 250 },
                data: {
                    nodeType: 'output',
                    status: Status.PENDING
                }
            }
        ],
        edges: [
            { id: 'e1', source: 'start', target: 'art-1', sourceHandle: 'trigger', targetHandle: 'trigger' },
            { id: 'e2', source: 'art-1', target: 'video-1', sourceHandle: 'trigger_out', targetHandle: 'trigger' },
            { id: 'e3', source: 'video-1', target: 'social-1', sourceHandle: 'trigger_out', targetHandle: 'trigger' },
            { id: 'e4', source: 'social-1', target: 'end', sourceHandle: 'trigger_out', targetHandle: 'trigger' }
        ]
    },
    {
        id: 'template-music-release',
        name: 'Music Release Package',
        description: 'Generate album art and marketing copy for a new track.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [
            {
                id: 'start',
                type: 'inputNode',
                position: { x: 50, y: 200 },
                data: {
                    nodeType: 'input',
                    prompt: 'New summer house track "Sunset Vibes"',
                    status: Status.PENDING
                }
            },
            {
                id: 'art-1',
                type: 'departmentNode',
                position: { x: 350, y: 100 },
                data: {
                    nodeType: 'department',
                    departmentName: 'Art Department',
                    selectedJobId: 'art-department-job-0',
                    status: Status.PENDING
                }
            },
            {
                id: 'marketing-1',
                type: 'departmentNode',
                position: { x: 350, y: 300 },
                data: {
                    nodeType: 'department',
                    departmentName: 'Marketing Department',
                    selectedJobId: 'marketing-department-job-0',
                    status: Status.PENDING
                }
            },
            {
                id: 'end',
                type: 'outputNode',
                position: { x: 700, y: 200 },
                data: {
                    nodeType: 'output',
                    status: Status.PENDING
                }
            }
        ],
        edges: [
            { id: 'e1', source: 'start', target: 'art-1', sourceHandle: 'trigger', targetHandle: 'trigger' },
            { id: 'e2', source: 'start', target: 'marketing-1', sourceHandle: 'trigger', targetHandle: 'trigger' },
            { id: 'e3', source: 'art-1', target: 'end', sourceHandle: 'trigger_out', targetHandle: 'trigger' },
            { id: 'e4', source: 'marketing-1', target: 'end', sourceHandle: 'trigger_out', targetHandle: 'trigger' }
        ]
    }
];

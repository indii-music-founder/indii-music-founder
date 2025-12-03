import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoadManagerAgent } from './index';

// Mock Google Maps Client
const mockDistanceMatrix = vi.fn();
vi.mock('@googlemaps/google-maps-services-js', () => {
    return {
        Client: class {
            distancematrix = mockDistanceMatrix;
        }
    };
});

// Mock Google Generative AI
const mockGenerateContent = vi.fn();
vi.mock('@google/generative-ai', () => {
    return {
        GoogleGenerativeAI: class {
            getGenerativeModel() {
                return { generateContent: mockGenerateContent };
            }
        }
    };
});

describe('RoadManagerAgent', () => {
    let agent: RoadManagerAgent;

    beforeEach(() => {
        vi.clearAllMocks();
        agent = new RoadManagerAgent();
    });

    it('should calculate distances and include them in the prompt', async () => {
        // Mock Google Maps response
        mockDistanceMatrix.mockResolvedValue({
            data: {
                status: 'OK',
                rows: [
                    {
                        elements: [
                            { status: 'OK', distance: { text: '100 km' }, duration: { text: '1 hour' } }
                        ]
                    }
                ]
            }
        });

        // Mock Gemini response
        mockGenerateContent.mockResolvedValue({
            response: {
                text: () => JSON.stringify({
                    tourName: "Test Tour",
                    stops: [],
                    totalDistance: "100 km",
                    estimatedBudget: "$1000"
                })
            }
        });

        const result = await agent.generateItinerary(['City A', 'City B'], { start: '2023-01-01', end: '2023-01-05' });

        expect(mockDistanceMatrix).toHaveBeenCalled();
        expect(mockGenerateContent).toHaveBeenCalledWith(expect.stringContaining('City A to City B: 100 km, 1 hour'));
        expect(result.tourName).toBe("Test Tour");
    });

    it('should handle Google Maps API errors gracefully', async () => {
        // Mock Google Maps error
        mockDistanceMatrix.mockRejectedValue(new Error('API Error'));

        // Mock Gemini response
        mockGenerateContent.mockResolvedValue({
            response: {
                text: () => JSON.stringify({
                    tourName: "Test Tour",
                    stops: [],
                    totalDistance: "0 km",
                    estimatedBudget: "$0"
                })
            }
        });

        await agent.generateItinerary(['City A', 'City B'], { start: '2023-01-01', end: '2023-01-05' });

        expect(mockDistanceMatrix).toHaveBeenCalled();
        expect(mockGenerateContent).toHaveBeenCalledWith(expect.stringContaining('Travel data unavailable'));
    });
});

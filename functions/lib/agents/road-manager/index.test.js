"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const index_1 = require("./index");
// Mock Google Maps Client
const mockDistanceMatrix = vitest_1.vi.fn();
vitest_1.vi.mock('@googlemaps/google-maps-services-js', () => {
    return {
        Client: class {
            constructor() {
                this.distancematrix = mockDistanceMatrix;
            }
        }
    };
});
// Mock Google Generative AI
const mockGenerateContent = vitest_1.vi.fn();
vitest_1.vi.mock('@google/generative-ai', () => {
    return {
        GoogleGenerativeAI: class {
            getGenerativeModel() {
                return { generateContent: mockGenerateContent };
            }
        }
    };
});
(0, vitest_1.describe)('RoadManagerAgent', () => {
    let agent;
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        agent = new index_1.RoadManagerAgent();
    });
    (0, vitest_1.it)('should calculate distances and include them in the prompt', async () => {
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
        (0, vitest_1.expect)(mockDistanceMatrix).toHaveBeenCalled();
        (0, vitest_1.expect)(mockGenerateContent).toHaveBeenCalledWith(vitest_1.expect.stringContaining('City A to City B: 100 km, 1 hour'));
        (0, vitest_1.expect)(result.tourName).toBe("Test Tour");
    });
    (0, vitest_1.it)('should handle Google Maps API errors gracefully', async () => {
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
        (0, vitest_1.expect)(mockDistanceMatrix).toHaveBeenCalled();
        (0, vitest_1.expect)(mockGenerateContent).toHaveBeenCalledWith(vitest_1.expect.stringContaining('Travel data unavailable'));
    });
});
//# sourceMappingURL=index.test.js.map
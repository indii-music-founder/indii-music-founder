import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReceiptOCRService } from './ReceiptOCRService';

vi.mock('@/services/ai/FirebaseAIService', () => {
    const mockFirebaseAI = {
        bootstrap: vi.fn().mockResolvedValue(true),
        rawGenerateContent: vi.fn().mockResolvedValue({ response: { text: () => '{}' } }),
        generateText: vi.fn().mockResolvedValue('Mock AI response'),
        generateStructuredData: vi.fn().mockResolvedValue({ data: {} }),
        generateImage: vi.fn().mockResolvedValue({ url: 'https://mock-image.png' }),
        analyzeImage: vi.fn().mockResolvedValue({ analysis: {} })
    };
    return {
        FirebaseAIService: class {
            bootstrap = mockFirebaseAI.bootstrap;
            rawGenerateContent = mockFirebaseAI.rawGenerateContent;
            generateText = mockFirebaseAI.generateText;
            generateStructuredData = mockFirebaseAI.generateStructuredData;
            generateImage = mockFirebaseAI.generateImage;
            analyzeImage = mockFirebaseAI.analyzeImage;
            static getInstance() { return mockFirebaseAI; }
        },
        firebaseAI: mockFirebaseAI
    };
});

describe('ReceiptOCRService', () => {
    let service: ReceiptOCRService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new ReceiptOCRService();
    });

    describe('processReceipt', () => {
        it('should successfully extract data from a valid receipt image', async () => {
            // Mock the file
            const mockFile = new File(['mock content'], 'receipt.jpg', { type: 'image/jpeg' });

            // Set up mock AI response
            const mockAiResponse = {
                amount: 150.50,
                currency: 'USD',
                vendor: 'Home Depot',
                date: '2023-10-25',
                category: 'equipment',
                confidence: 0.95
            };

            // Get the mock instance
            const aiServiceMock = (service as any).aiService;

            aiServiceMock.rawGenerateContent.mockResolvedValue({
                response: {
                    text: () => JSON.stringify(mockAiResponse)
                }
            });

            // Need to mock FileReader using class syntax since it's instantiated with new
            class MockFileReader {
                result = '';
                onload: any = null;
                onerror: any = null;

                readAsDataURL() {
                    setTimeout(() => {
                        this.result = 'data:image/jpeg;base64,mockbase64data';
                        if (this.onload) this.onload();
                    }, 0);
                }
            }

            vi.stubGlobal('FileReader', MockFileReader);

            const result = await service.processReceipt(mockFile);

            // Assertions
            expect(aiServiceMock.bootstrap).toHaveBeenCalled();
            expect(aiServiceMock.rawGenerateContent).toHaveBeenCalled();

            const [contentsArgs, modelArgs, configArgs] = aiServiceMock.rawGenerateContent.mock.calls[0];
            expect(contentsArgs[0].parts[1].inlineData.data).toBe('mockbase64data');
            // Check for the actual model used in the service (gemini-3-pro-preview or similar image model)
            expect(modelArgs).toBe('gemini-3-pro-preview');
            expect(configArgs.responseMimeType).toBe('application/json');

            expect(result).toMatchObject(mockAiResponse);
            expect(result.extractedText).toBe(JSON.stringify(mockAiResponse));
        });

        it('should handle errors during processing', async () => {
            const mockFile = new File(['mock content'], 'receipt.jpg', { type: 'image/jpeg' });

            const aiServiceMock = (service as any).aiService;
            aiServiceMock.bootstrap.mockRejectedValueOnce(new Error('AI Service unavailable'));

            await expect(service.processReceipt(mockFile)).rejects.toThrow('AI Service unavailable');
        });

        it('should handle FileReader errors', async () => {
            const mockFile = new File(['mock content'], 'receipt.jpg', { type: 'image/jpeg' });

            class MockFileReaderError {
                onerror: any = null;
                readAsDataURL() {
                    setTimeout(() => {
                        if (this.onerror) this.onerror(new Error('File read failed'));
                    }, 0);
                }
            }

            vi.stubGlobal('FileReader', MockFileReaderError);

            await expect(service.processReceipt(mockFile)).rejects.toThrow('File read failed');
            expect((service as any).aiService.rawGenerateContent).not.toHaveBeenCalled();
        });
    });
});

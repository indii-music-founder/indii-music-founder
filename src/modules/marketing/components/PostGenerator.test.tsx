
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PostGenerator from './PostGenerator';
import { AI } from '@/services/ai/AIService';

// --- Mocks ---

// Mock Lucide icons to avoid rendering issues and keep DOM clean
vi.mock('lucide-react', () => ({
  Megaphone: () => <span data-testid="icon-megaphone" />,
  Copy: () => <span data-testid="icon-copy" />,
  Image: () => <span data-testid="icon-image" />,
  Loader2: () => <span data-testid="icon-loader" />,
  Wand2: () => <span data-testid="icon-wand" />,
  Upload: () => <span data-testid="icon-upload" />,
}));

// Mock Store
vi.mock('@/core/store', () => ({
  useStore: () => ({
    userProfile: {
      brandKit: {
        targetAudience: 'Gen Z',
        visualIdentity: 'Edgy',
        brandDescription: 'Indie Pop Artist'
      },
      displayName: 'Test Artist'
    }
  })
}));

// Mock Toast
vi.mock('@/core/context/ToastContext', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn()
  })
}));

// Mock AI Service
vi.mock('@/services/ai/AIService', () => ({
  AI: {
    generateStructuredData: vi.fn(),
    generateImage: vi.fn()
  }
}));

// Mock Social Service
vi.mock('@/services/social/SocialService', () => ({
  SocialService: {
    schedulePost: vi.fn()
  }
}));

// Mock child component AIEnhancePostModal if needed (though we likely won't trigger it in this specific interaction test)
vi.mock('./AIEnhancePostModal', () => ({
  default: () => <div data-testid="enhance-modal">Enhance Modal</div>
}));

describe('PostGenerator Interaction', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
  });

  it('handles the "Generate Post" button lifecycle: Idle -> Enabled -> Loading -> Success', async () => {
    // 1. Setup & Render
    // Mock AI response
    const mockPostData = {
      caption: 'Check out my new single Void Ocean! #music',
      hashtags: ['#music', '#void'],
      imagePrompt: 'A dark ocean void'
    };
    (AI.generateStructuredData as any).mockResolvedValue(mockPostData);
    (AI.generateImage as any).mockResolvedValue('base64imagecontent');

    render(<PostGenerator />);

    const generateBtn = screen.getByTestId('generate-post-btn');
    const topicInput = screen.getByLabelText(/concept \/ topic/i);

    // 2. Check Idle State
    expect(generateBtn).toBeDisabled();
    // Removed toHaveClass('disabled:opacity-50') per journal instructions

    // 3. Action: Type into topic
    await user.type(topicInput, 'New Album Launch');

    // 4. Check Ready State
    expect(generateBtn).not.toBeDisabled();

    // 5. Action: Click "Generate Post"
    // We use a delayed promise to verify the loading state
    let resolveAI: (value: any) => void;
    const aiPromise = new Promise((resolve) => { resolveAI = resolve; });
    (AI.generateStructuredData as any).mockReturnValue(aiPromise);

    const clickPromise = user.click(generateBtn);

    // 6. Check Loading State
    await waitFor(() => {
        expect(screen.getByTestId('generating-status')).toBeInTheDocument();
    });

    expect(screen.getByTestId('icon-loader')).toBeInTheDocument();
    expect(generateBtn).toBeDisabled();

    // 7. Simulate Response
    resolveAI!(mockPostData);
    await clickPromise; // Finish the click action

    // 8. Check Success State
    // Wait for the preview panel to appear (Caption label is a good anchor)
    await waitFor(() => {
      expect(screen.getByLabelText('Caption')).toHaveValue(mockPostData.caption);
    });

    // Verify AI was called with correct prompts
    expect(AI.generateStructuredData).toHaveBeenCalledTimes(1);
    expect(AI.generateStructuredData).toHaveBeenCalledWith(
        expect.stringContaining('New Album Launch'),
        expect.anything()
    );

    // Verify button resets
    expect(screen.queryByTestId('generating-status')).not.toBeInTheDocument();
    expect(generateBtn).not.toBeDisabled();

    // Verify Image Generation kicked off automatically
    // The component code: generateImage(newResult.imagePrompt) is called after setResult.
    expect(AI.generateImage).toHaveBeenCalledTimes(1);
    expect(AI.generateImage).toHaveBeenCalledWith({
        model: expect.anything(), // AI_MODELS.IMAGE.GENERATION
        prompt: mockPostData.imagePrompt
    });
  });

  it('disables "Generate Post" button when topic is cleared', async () => {
    render(<PostGenerator />);
    const generateBtn = screen.getByTestId('generate-post-btn');
    const topicInput = screen.getByLabelText(/concept \/ topic/i);

    // Enable it
    await user.type(topicInput, 'Something');
    expect(generateBtn).toBeEnabled();

    // Clear it
    await user.clear(topicInput);
    expect(generateBtn).toBeDisabled();
  });
});

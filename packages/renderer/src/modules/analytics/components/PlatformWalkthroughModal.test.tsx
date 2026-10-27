import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlatformWalkthroughModal } from './PlatformWalkthroughModal';

describe('PlatformWalkthroughModal', () => {
    const mockOnClose = vi.fn();
    const mockOnConnect = vi.fn().mockResolvedValue(undefined);
    const defaultStatus = {
        spotify: false,
        youtube: false,
        tiktok: false,
        apple_music: false,
        instagram: false,
        twitter: false,
        bluesky: false,
        linkedin: false,
    };

    it('does not render when isOpen is false', () => {
        const { container } = render(
            <PlatformWalkthroughModal
                isOpen={false}
                onClose={mockOnClose}
                connectionStatus={defaultStatus}
                onConnectPlatform={mockOnConnect}
            />
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('renders platform details and step instructions when open', () => {
        render(
            <PlatformWalkthroughModal
                isOpen={true}
                onClose={mockOnClose}
                initialPlatform="instagram"
                connectionStatus={defaultStatus}
                onConnectPlatform={mockOnConnect}
            />
        );

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Platform Connection Copilot')).toBeInTheDocument();
        expect(screen.getByText('Instagram Reels & Graph API')).toBeInTheDocument();
        expect(screen.getByText('Verify Professional Account Type')).toBeInTheDocument();
        expect(screen.getByText('Connect Instagram Now')).toBeInTheDocument();
    });

    it('switches platform guide when platform tab is clicked', () => {
        render(
            <PlatformWalkthroughModal
                isOpen={true}
                onClose={mockOnClose}
                initialPlatform="instagram"
                connectionStatus={defaultStatus}
                onConnectPlatform={mockOnConnect}
            />
        );

        const youtubeTab = screen.getByRole('button', { name: /YouTube/i });
        fireEvent.click(youtubeTab);

        expect(screen.getByText('YouTube Shorts & Channel Analytics')).toBeInTheDocument();
        expect(screen.getByText('Verify YouTube Studio Channel')).toBeInTheDocument();
        expect(screen.getByText('Connect YouTube Now')).toBeInTheDocument();
    });

    it('toggles step checklist completion on click', () => {
        render(
            <PlatformWalkthroughModal
                isOpen={true}
                onClose={mockOnClose}
                initialPlatform="tiktok"
                connectionStatus={defaultStatus}
                onConnectPlatform={mockOnConnect}
            />
        );

        const checkBtn = screen.getByLabelText('Mark step 1 as complete');
        fireEvent.click(checkBtn);

        expect(screen.getByLabelText('Mark step 1 as incomplete')).toBeInTheDocument();
    });

    it('invokes onConnectPlatform with active platform ID when connect button is clicked', async () => {
        render(
            <PlatformWalkthroughModal
                isOpen={true}
                onClose={mockOnClose}
                initialPlatform="twitter"
                connectionStatus={defaultStatus}
                onConnectPlatform={mockOnConnect}
            />
        );

        const connectBtn = screen.getByRole('button', { name: 'Connect Twitter Now' });
        fireEvent.click(connectBtn);

        expect(mockOnConnect).toHaveBeenCalledWith('twitter');
    });

    it('renders Bluesky guide with custom domain handle and app password steps', () => {
        render(
            <PlatformWalkthroughModal
                isOpen={true}
                onClose={mockOnClose}
                initialPlatform="bluesky"
                connectionStatus={defaultStatus}
                onConnectPlatform={mockOnConnect}
            />
        );

        expect(screen.getByText('Bluesky Social (AT Protocol)')).toBeInTheDocument();
        expect(screen.getByText('Configure Custom Domain Handle (@indii.music)')).toBeInTheDocument();
        expect(screen.getByText('Generate an App Password')).toBeInTheDocument();
        expect(screen.getByText('Connect Bluesky Now')).toBeInTheDocument();
    });

    it('renders LinkedIn guide with mobile identity verification and company admin steps', () => {
        render(
            <PlatformWalkthroughModal
                isOpen={true}
                onClose={mockOnClose}
                initialPlatform="linkedin"
                connectionStatus={defaultStatus}
                onConnectPlatform={mockOnConnect}
            />
        );

        expect(screen.getByText('LinkedIn Company & Founder Network')).toBeInTheDocument();
        expect(screen.getByText('Complete Mobile Identity Verification')).toBeInTheDocument();
        expect(screen.getByText('Verify Company Page Administrator Access')).toBeInTheDocument();
        expect(screen.getByText('Connect LinkedIn Now')).toBeInTheDocument();
    });

    it('closes when close button is clicked', () => {
        render(
            <PlatformWalkthroughModal
                isOpen={true}
                onClose={mockOnClose}
                initialPlatform="instagram"
                connectionStatus={defaultStatus}
                onConnectPlatform={mockOnConnect}
            />
        );

        const closeBtn = screen.getByLabelText('Close walkthrough guide');
        fireEvent.click(closeBtn);

        expect(mockOnClose).toHaveBeenCalled();
    });
});

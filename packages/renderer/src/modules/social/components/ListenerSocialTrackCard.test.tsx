import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ListenerSocialTrackCard } from './ListenerSocialTrackCard';

describe('ListenerSocialTrackCard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders track metadata, viral hook preview bar, and initial fan discussion', async () => {
        render(
            <ListenerSocialTrackCard
                trackTitle="Detroit Midnight"
                artistName="Sarah Vance"
                bpm={126}
                genre="Electronic"
                initialComments={[
                    {
                        id: 'c1',
                        authorName: 'Alex Beats',
                        text: 'This drop at 0:45 is crazy!',
                        timestamp: '5m ago',
                    },
                ]}
            />
        );

        expect(screen.getByText('Detroit Midnight')).toBeInTheDocument();
        expect(screen.getByText('Sarah Vance')).toBeInTheDocument();
        expect(screen.getByText('126 BPM')).toBeInTheDocument();
        expect(screen.getByText('Electronic')).toBeInTheDocument();
        expect(screen.getByText('This drop at 0:45 is crazy!')).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText(/15s Viral Earworm Hook/i)).toBeInTheDocument();
        });
    });

    it('toggles audio play/pause when the album play button is clicked', async () => {
        render(
            <ListenerSocialTrackCard
                trackTitle="Detroit Midnight"
                artistName="Sarah Vance"
            />
        );

        await waitFor(() => {
            expect(screen.getByText(/15s Viral Earworm Hook/i)).toBeInTheDocument();
        });

        const playBtn = screen.getByLabelText('Play 15s viral hook');
        expect(playBtn).toBeInTheDocument();

        fireEvent.click(playBtn);

        expect(screen.getByLabelText('Pause 15s viral hook')).toBeInTheDocument();

        fireEvent.click(screen.getByLabelText('Pause 15s viral hook'));
        expect(screen.getByLabelText('Play 15s viral hook')).toBeInTheDocument();
    });

    it('submits a valid fan comment and adds it to the conversation list', async () => {
        render(
            <ListenerSocialTrackCard
                trackTitle="Detroit Midnight"
                artistName="Sarah Vance"
            />
        );

        const input = screen.getByPlaceholderText(/Join the discussion/i);
        const submitBtn = screen.getByLabelText('Post comment');

        fireEvent.change(input, { target: { value: 'Best song of the year hands down!' } });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(screen.getByText('Best song of the year hands down!')).toBeInTheDocument();
            expect(screen.getByText('You (Fan)')).toBeInTheDocument();
        });
    });

    it('rejects spam comment and displays real-time Jev moderation warning', async () => {
        render(
            <ListenerSocialTrackCard
                trackTitle="Detroit Midnight"
                artistName="Sarah Vance"
            />
        );

        const input = screen.getByPlaceholderText(/Join the discussion/i);
        const submitBtn = screen.getByLabelText('Post comment');

        // Toxic / spam pattern intercepted by Jev
        fireEvent.change(input, { target: { value: 'check out my free followers at t.me/spam' } });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(screen.getByText(/Flagged for self-promotional spam link/i)).toBeInTheDocument();
        });

        // Comment should NOT be in the comments list
        expect(screen.queryByText('check out my free followers at t.me/spam')).not.toBeInTheDocument();
    });

    it('triggers merch purchase and direct artist tip callbacks', async () => {
        const onMerchBuyMock = vi.fn();
        const onTipMock = vi.fn();

        render(
            <ListenerSocialTrackCard
                trackTitle="Detroit Midnight"
                artistName="Sarah Vance"
                onMerchBuy={onMerchBuyMock}
                onTip={onTipMock}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Cop Merch')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Cop Merch'));
        expect(onMerchBuyMock).toHaveBeenCalledTimes(1);

        // Open Tipping
        const tipBtn = screen.getByText('Tip Artist');
        fireEvent.click(tipBtn);

        const fiveDollarBtn = screen.getByText('$5');
        fireEvent.click(fiveDollarBtn);

        expect(onTipMock).toHaveBeenCalledWith(5);
        expect(screen.getByText(/Tip sent directly to the artist/i)).toBeInTheDocument();
    });
});

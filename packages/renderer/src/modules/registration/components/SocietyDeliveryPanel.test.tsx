/** Component wiring tests only; mocked service responses are not customer acceptance. */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { SocietyDeliveryPanel } from './SocietyDeliveryPanel';
const operation = vi.hoisted(() => vi.fn());
vi.mock('@/services/rights/HostedRightsService', () => ({ rightsOperation: operation }));
const run = async (task: () => Promise<void>) => task();
afterEach(() => { cleanup(); operation.mockReset(); });
describe('receiver delivery controls (structural only)', () => {
  it('keeps sending disabled until receiver access and exact batch approval both exist', async () => {
    operation.mockResolvedValue({ enabled: false, configured: false, reason: 'Receiver access missing' });
    render(<SocietyDeliveryPanel recipient="the_mlc" batch={{ batchId: 'batch-1', state: 'approved_export' }} busy={false} run={run} />);
    await screen.findByText('Receiver access missing');
    expect(screen.getByRole('button', { name: 'Transmit approved batch' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Retrieve receiver ACK' })).toBeDisabled();
  });
  it('sends only the selected approved batch and reports server receipt', async () => {
    operation.mockImplementation(async (action: string) => action === 'society_delivery_status' ? { enabled: true, configured: true, reason: 'Approved receiver' } : { transmitted: true });
    render(<SocietyDeliveryPanel recipient="musicmark" batch={{ batchId: 'selected-batch', state: 'approved_export' }} busy={false} run={run} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Transmit approved batch' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Transmit approved batch' }));
    await screen.findByText('Exact approved batch transmitted. Awaiting receiver acknowledgment.');
    expect(operation).toHaveBeenCalledWith('deliver_cwr', { batchId: 'selected-batch' });
  });
  it('restores onboarding fields without resubmitting server status or approval fields', async () => {
    operation.mockResolvedValue({ enabled: false, configured: false, reason: 'Pending review', onboarding: { senderName: 'ACTUAL PUBLISHER', senderIpi: '00123456789', senderCode: 'PUB', authorityDescription: 'Actual authority description', state: 'requested', requestedAt: 123 } });
    render(<SocietyDeliveryPanel recipient="sesac" busy={false} run={run} />);
    await screen.findByDisplayValue('ACTUAL PUBLISHER');
    fireEvent.click(screen.getByRole('button', { name: 'Save onboarding request', hidden: true }));
    await waitFor(() => expect(operation).toHaveBeenCalledWith('save_society_onboarding', { recipient: 'sesac', senderName: 'ACTUAL PUBLISHER', senderIpi: '00123456789', senderCode: 'PUB', authorityDescription: 'Actual authority description' }));
  });
});

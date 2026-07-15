import React, { useState } from 'react';
import { FileText, Mail, Calendar, MapPin, Users, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '@/core/context/ToastContext';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { Itinerary, ItineraryStop } from '../types';
import { DaySheetModal } from './DaySheetModal';
import { ResendEmailService } from '@/services/email/ResendEmailService';
import { logger } from '@/utils/logger';

interface TourBookTabProps {
    itinerary: Itinerary | null;
    onUpdateStop: (updatedStop: ItineraryStop) => void;
}

export const TourBookTab: React.FC<TourBookTabProps> = ({ itinerary, onUpdateStop }) => {
    const { success, error } = useToast();
    const [selectedStop, setSelectedStop] = useState<ItineraryStop | null>(null);
    const [expandedStopId, setExpandedStopId] = useState<string | null>(null);
    const [sendingEmailFor, setSendingEmailFor] = useState<string | null>(null);

    const handleDaySheetSave = (updatedStop: ItineraryStop) => {
        onUpdateStop(updatedStop);
        setSelectedStop(null);
    };

    const handleSendAdvanceEmail = async (stop: ItineraryStop) => {
        setSendingEmailFor(stop.id || null);
        try {
            // Get venue contact (promoter) from stop contacts
            const promoterContact = stop.contacts?.find(c => c.role === 'Promoter');
            if (!promoterContact?.phone && !promoterContact?.name) {
                error('Add Promoter contact information before sending advance email');
                setSendingEmailFor(null);
                return;
            }

            // Build advance email content from day sheet data
            const scheduleText = stop.schedule
                ?.map(s => `${s.time} - ${s.event}`)
                .join('\n') || 'No schedule provided';

            const contactsText = stop.contacts
                ?.filter(c => c.name)
                ?.map(c => `${c.role}: ${c.name} ${c.phone ? `(${c.phone})` : ''}`)
                .join('\n') || 'No contacts provided';

            const body = `
Technical Rider & Day Sheet Information

Venue: ${stop.venue}
Date: ${new Date(stop.date).toLocaleDateString()}
City: ${stop.city}

SCHEDULE (Run of Show):
${scheduleText}

CONTACTS:
${contactsText}

Guarantee: $${stop.guarantee || 0}
${stop.door_count ? `Expected Door Count: ${stop.door_count}` : ''}
${stop.split_pct ? `Revenue Split: ${stop.split_pct}%` : ''}

Please confirm receipt of this information.
            `.trim();

            // Send via ResendEmailService
            await ResendEmailService.send({
                to: promoterContact?.name || 'venue@example.com', // ISSUE-705: use actual contact email when available
                subject: `Advance Information - ${stop.venue} on ${new Date(stop.date).toLocaleDateString()}`,
                html: body.replace(/\n/g, '<br />'),
                text: body
            });

            success(`Advance email sent to ${promoterContact?.name || stop.venue}`);
            logger.info('Advance email sent for stop:', stop.city);
        } catch (err) {
            logger.error('Failed to send advance email:', err);
            error(err instanceof Error ? err.message : 'Failed to send advance email');
        } finally {
            setSendingEmailFor(null);
        }
    };

    if (!itinerary || !itinerary.stops || itinerary.stops.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                    <FileText size={48} className="mx-auto mb-4 opacity-20" />
                    <p>No tour itinerary. Create one in the Plan tab.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 h-full overflow-y-auto p-6">
            <div>
                <h2 className="text-2xl font-bold text-white mb-2">Tour Book</h2>
                <p className="text-sm text-gray-400">{itinerary.stops.length} stops • {itinerary.tourName}</p>
            </div>

            <div className="space-y-4 flex-1">
                {itinerary.stops.map((stop, idx) => (
                    <motion.div
                        key={stop.id || idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                    >
                        <Card className="bg-[#161b22] border-gray-800 overflow-hidden">
                            <CardHeader
                                className="pb-3 cursor-pointer hover:bg-gray-900/50 transition-colors"
                                onClick={() => setExpandedStopId(expandedStopId === stop.id ? null : (stop.id || null))}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            <Calendar size={16} className="text-blue-400" />
                                            <CardTitle className="text-lg text-white">
                                                {new Date(stop.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                            </CardTitle>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2 ml-7 text-gray-400">
                                            <MapPin size={14} />
                                            <span className="font-semibold text-white">{stop.city}</span>
                                            <span className="text-sm">@ {stop.venue}</span>
                                        </div>
                                    </div>
                                    <motion.div
                                        animate={{ rotate: expandedStopId === stop.id ? 180 : 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <ChevronDown size={20} className="text-gray-500" />
                                    </motion.div>
                                </div>
                            </CardHeader>

                            <AnimatePresence>
                                {expandedStopId === stop.id && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <CardContent className="pt-0 border-t border-gray-800 space-y-4">
                                            {/* Quick Overview */}
                                            <div className="grid grid-cols-2 gap-4">
                                                {stop.guarantee !== undefined && (
                                                    <div>
                                                        <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Guarantee</p>
                                                        <p className="text-lg font-bold text-amber-400">${stop.guarantee}</p>
                                                    </div>
                                                )}
                                                {stop.contacts && stop.contacts.length > 0 && (
                                                    <div>
                                                        <p className="text-xs text-gray-500 uppercase tracking-widest font-bold flex items-center gap-1">
                                                            <Users size={12} /> Contacts
                                                        </p>
                                                        <p className="text-sm text-white">{stop.contacts.length} on file</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Schedule Preview */}
                                            {stop.schedule && stop.schedule.length > 0 && (
                                                <div>
                                                    <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-2">Schedule</p>
                                                    <div className="space-y-1 text-xs text-gray-400">
                                                        {stop.schedule.slice(0, 3).map((s, i) => (
                                                            <div key={i}>{s.time} - {s.event}</div>
                                                        ))}
                                                        {stop.schedule.length > 3 && <div className="text-gray-600">+{stop.schedule.length - 3} more</div>}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Actions */}
                                            <div className="flex gap-2 pt-2">
                                                <Button
                                                    onClick={() => setSelectedStop(stop)}
                                                    variant="secondary"
                                                    className="flex-1 text-xs"
                                                >
                                                    Edit Day Sheet
                                                </Button>
                                                <Button
                                                    onClick={() => handleSendAdvanceEmail(stop)}
                                                    disabled={sendingEmailFor === stop.id}
                                                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-xs flex items-center justify-center gap-2"
                                                >
                                                    <Mail size={14} />
                                                    {sendingEmailFor === stop.id ? 'Sending...' : 'Send Advance Email'}
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </Card>
                    </motion.div>
                ))}
            </div>

            {/* Day Sheet Modal */}
            {selectedStop && (
                <DaySheetModal
                    isOpen={!!selectedStop}
                    stop={selectedStop}
                    onClose={() => setSelectedStop(null)}
                    onSave={handleDaySheetSave}
                />
            )}
        </div>
    );
};

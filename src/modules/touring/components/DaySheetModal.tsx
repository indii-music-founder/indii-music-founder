import React, { useState } from 'react';
import { X, Clock, User, Phone, Save, Plus, Trash2, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ScheduleItem {
    time: string;
    event: string;
}

interface Contact {
    role: string;
    name: string;
    phone: string;
}

interface DaySheetModalProps {
    isOpen: boolean;
    stop: any;
    onClose: () => void;
    onSave: (updatedStop: any) => void;
}

export const DaySheetModal: React.FC<DaySheetModalProps> = ({ isOpen, stop, onClose, onSave }) => {
    // Hooks must be unconditional
    const [schedule, setSchedule] = useState<ScheduleItem[]>(stop?.schedule || [
        { time: '14:00', event: 'Load In' },
        { time: '16:00', event: 'Sound Check' },
        { time: '18:00', event: 'Dinner' },
        { time: '19:00', event: 'Doors' },
        { time: '20:00', event: 'Support' },
        { time: '21:00', event: 'Set Time' },
        { time: '23:00', event: 'Curfew' },
    ]);

    const [contacts, setContacts] = useState<Contact[]>(stop?.contacts || [
        { role: 'Promoter', name: '', phone: '' },
        { role: 'Venue Rep', name: '', phone: '' },
        { role: 'Sound Guy', name: '', phone: '' },
    ]);

    const handleScheduleChange = (index: number, field: keyof ScheduleItem, value: string) => {
        const newSchedule = [...schedule];
        newSchedule[index] = { ...newSchedule[index], [field]: value };
        setSchedule(newSchedule);
    };

    const handleContactChange = (index: number, field: keyof Contact, value: string) => {
        const newContacts = [...contacts];
        newContacts[index] = { ...newContacts[index], [field]: value };
        setContacts(newContacts);
    };

    const handleSave = () => {
        onSave({
            ...stop,
            schedule,
            contacts
        });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Content */}
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="relative w-full max-w-4xl bg-[#0d1117] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
                {/* Header */}
                <div className="p-8 border-b border-gray-800 bg-gradient-to-r from-blue-500/10 to-transparent flex items-center justify-between">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center ring-1 ring-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
                            <Calendar className="text-blue-400" size={28} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic font-mono flex items-center gap-3">
                                <span className="text-blue-500/50">::</span> Day Sheet <span className="text-blue-500/50">::</span> {stop.city}
                            </h2>
                            <p className="text-xs text-gray-500 font-mono uppercase tracking-[0.3em] font-bold mt-1">
                                {new Date(stop.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} <span className="text-gray-700">|</span> {stop.venue}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 hover:bg-white/5 rounded-full text-gray-500 hover:text-white transition-all transform hover:rotate-90"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-10 grid grid-cols-1 md:grid-cols-2 gap-12 custom-scrollbar">
                    {/* Schedule Section */}
                    <section className="space-y-8">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em] flex items-center gap-3">
                                <Clock size={14} className="animate-pulse" /> Run of Show
                            </h3>
                            <button
                                onClick={() => setSchedule([...schedule, { time: '', event: '' }])}
                                className="text-[10px] font-bold text-gray-500 hover:text-blue-400 uppercase tracking-widest flex items-center gap-2 transition-colors group"
                            >
                                <Plus size={12} className="group-hover:rotate-90 transition-transform" /> Add Phase
                            </button>
                        </div>

                        <div className="space-y-3">
                            <AnimatePresence mode="popLayout">
                                {schedule.map((item, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.03 }}
                                        className="group flex gap-4 p-4 bg-black/40 border border-gray-800/50 rounded-xl focus-within:border-blue-500/40 focus-within:bg-blue-500/5 transition-all"
                                    >
                                        <input
                                            type="time"
                                            value={item.time}
                                            onChange={(e) => handleScheduleChange(i, 'time', e.target.value)}
                                            className="w-24 bg-transparent text-sm font-mono text-blue-400 outline-none placeholder:text-gray-800"
                                        />
                                        <input
                                            type="text"
                                            value={item.event}
                                            onChange={(e) => handleScheduleChange(i, 'event', e.target.value)}
                                            className="flex-1 bg-transparent text-sm text-gray-300 font-medium outline-none placeholder:text-gray-800"
                                            placeholder="Event Phase..."
                                        />
                                        <button
                                            onClick={() => setSchedule(schedule.filter((_, idx) => idx !== i))}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-700 hover:text-red-500 transition-all"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </section>

                    {/* Contacts Section */}
                    <section className="space-y-8">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-black text-green-400 uppercase tracking-[0.4em] flex items-center gap-3">
                                <User size={14} /> Intelligence
                            </h3>
                            <button
                                onClick={() => setContacts([...contacts, { role: '', name: '', phone: '' }])}
                                className="text-[10px] font-bold text-gray-500 hover:text-green-400 uppercase tracking-widest flex items-center gap-2 transition-colors group"
                            >
                                <Plus size={12} className="group-hover:rotate-90 transition-transform" /> Add Contact
                            </button>
                        </div>

                        <div className="space-y-4">
                            <AnimatePresence mode="popLayout">
                                {contacts.map((contact, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.03 }}
                                        className="group p-5 bg-black/40 border border-gray-800/50 rounded-xl space-y-4 focus-within:border-green-500/40 focus-within:bg-green-500/5 transition-all"
                                    >
                                        <div className="flex gap-4">
                                            <input
                                                className="w-28 bg-transparent text-[10px] uppercase font-mono font-black text-green-500 outline-none placeholder:text-gray-800"
                                                placeholder="OPERATIVE"
                                                value={contact.role}
                                                onChange={(e) => handleContactChange(i, 'role', e.target.value)}
                                            />
                                            <input
                                                className="flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-gray-800 border-b border-transparent focus:border-green-500/20"
                                                placeholder="IDENT_NAME"
                                                value={contact.name}
                                                onChange={(e) => handleContactChange(i, 'name', e.target.value)}
                                            />
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-green-500/5 rounded-lg">
                                                <Phone size={14} className="text-green-500/60" />
                                            </div>
                                            <input
                                                className="flex-1 bg-transparent text-sm font-mono text-gray-500 outline-none placeholder:text-gray-800"
                                                placeholder="+X XXX XXX XXXX"
                                                value={contact.phone}
                                                onChange={(e) => handleContactChange(i, 'phone', e.target.value)}
                                            />
                                            <button
                                                onClick={() => setContacts(contacts.filter((_, idx) => idx !== i))}
                                                className="opacity-0 group-hover:opacity-100 p-1 text-gray-700 hover:text-red-500 transition-all"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </section>
                </div>

                {/* Footer */}
                <div className="p-8 border-t border-gray-800 bg-black/40 flex justify-end gap-5">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 rounded-xl text-xs font-black text-gray-500 hover:text-white hover:bg-white/5 transition-all uppercase tracking-[0.2em]"
                    >
                        Abort
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black shadow-[0_0_30px_rgba(59,130,246,0.3)] transition-all flex items-center gap-3 uppercase tracking-[0.2em] group"
                    >
                        <Save size={16} className="group-hover:scale-125 transition-transform" />
                        Sync Intelligence
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

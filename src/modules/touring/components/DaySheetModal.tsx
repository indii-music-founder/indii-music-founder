import React, { useState } from 'react';
import { X, Clock, User, Phone, Save, Plus, Trash2 } from 'lucide-react';

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
    stop: any;
    onClose: () => void;
    onSave: (updatedStop: any) => void;
}

export const DaySheetModal: React.FC<DaySheetModalProps> = ({ stop, onClose, onSave }) => {
    const [schedule, setSchedule] = useState<ScheduleItem[]>(stop.schedule || [
        { time: '14:00', event: 'Load In' },
        { time: '16:00', event: 'Sound Check' },
        { time: '18:00', event: 'Dinner' },
        { time: '19:00', event: 'Doors' },
        { time: '20:00', event: 'Support' },
        { time: '21:00', event: 'Set Time' },
        { time: '23:00', event: 'Curfew' },
    ]);

    const [contacts, setContacts] = useState<Contact[]>(stop.contacts || [
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

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
            <div className="bg-[#1c1c1c] border border-gray-700 rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gradient-to-r from-gray-900 to-[#1c1c1c]">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <span className="bg-orange-600 text-white text-xs px-2 py-1 rounded">DAY SHEET</span>
                            {stop.city}
                        </h2>
                        <p className="text-gray-400 text-sm mt-1">{new Date(stop.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} @ {stop.venue}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                    {/* Schedule Section */}
                    <div>
                        <h3 className="text-lg font-bold text-blue-400 mb-4 flex items-center gap-2">
                            <Clock size={18} />
                            Run of Show
                        </h3>
                        <div className="space-y-2 bg-black/20 p-4 rounded-xl border border-gray-800">
                            {schedule.map((item: ScheduleItem, i: number) => (
                                <div key={i} className="flex gap-4 items-center">
                                    <input
                                        type="time"
                                        value={item.time}
                                        onChange={(e) => handleScheduleChange(i, 'time', e.target.value)}
                                        className="bg-[#0d1117] border border-gray-700 rounded px-3 py-2 text-white text-sm font-mono w-32 focus:border-blue-500 outline-none"
                                    />
                                    <input
                                        type="text"
                                        value={item.event}
                                        onChange={(e) => handleScheduleChange(i, 'event', e.target.value)}
                                        className="flex-1 bg-[#0d1117] border border-gray-700 rounded px-3 py-2 text-white text-sm focus:border-blue-500 outline-none"
                                        placeholder="Event Name"
                                    />
                                    <button
                                        onClick={() => setSchedule(schedule.filter((_, idx) => idx !== i))}
                                        className="text-gray-500 hover:text-red-400 transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                            <button
                                onClick={() => setSchedule([...schedule, { time: '', event: '' }])}
                                className="mt-2 text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
                            >
                                <Plus size={14} /> Add Item
                            </button>
                        </div>
                    </div>

                    {/* Contacts Section */}
                    <div>
                        <h3 className="text-lg font-bold text-green-400 mb-4 flex items-center gap-2">
                            <User size={18} />
                            Key Contacts
                        </h3>
                        <div className="space-y-3 bg-black/20 p-4 rounded-xl border border-gray-800">
                            {contacts.map((contact: Contact, i: number) => (
                                <div key={i} className="grid grid-cols-3 gap-3">
                                    <input
                                        type="text"
                                        value={contact.role}
                                        onChange={(e) => handleContactChange(i, 'role', e.target.value)}
                                        className="bg-[#0d1117] border border-gray-700 rounded px-3 py-2 text-gray-400 text-sm focus:border-green-500 outline-none"
                                        placeholder="Role"
                                    />
                                    <input
                                        type="text"
                                        value={contact.name}
                                        onChange={(e) => handleContactChange(i, 'name', e.target.value)}
                                        className="bg-[#0d1117] border border-gray-700 rounded px-3 py-2 text-white text-sm focus:border-green-500 outline-none"
                                        placeholder="Name"
                                    />
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                            <input
                                                type="text"
                                                value={contact.phone}
                                                onChange={(e) => handleContactChange(i, 'phone', e.target.value)}
                                                className="w-full bg-[#0d1117] border border-gray-700 rounded px-3 py-2 pl-9 text-white text-sm focus:border-green-500 outline-none"
                                                placeholder="Phone"
                                            />
                                        </div>
                                        <button
                                            onClick={() => setContacts(contacts.filter((_, idx) => idx !== i))}
                                            className="text-gray-500 hover:text-red-400 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            <button
                                onClick={() => setContacts([...contacts, { role: '', name: '', phone: '' }])}
                                className="mt-2 text-sm text-green-400 hover:text-green-300 flex items-center gap-1"
                            >
                                <Plus size={14} /> Add Contact
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-700 bg-[#161b22] flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center gap-2 font-medium"
                    >
                        <Save size={18} />
                        Save Day Sheet
                    </button>
                </div>
            </div>
        </div>
    );
};

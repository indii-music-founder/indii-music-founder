import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Contact } from '../types';
import { User, Star, TrendingUp, Radio } from 'lucide-react';

interface ContactListProps {
    contacts: Contact[];
}

export function ContactList({ contacts }: ContactListProps) {
    return (
        <div className="space-y-3">
            <AnimatePresence mode="popLayout">
                {contacts.map((contact, index) => (
                    <motion.div
                        key={contact.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        layout
                        transition={{
                            delay: index * 0.05,
                            duration: 0.3,
                            ease: "easeOut"
                        }}
                        className="group flex items-center gap-4 p-3 bg-card/40 border border-transparent hover:border-border rounded-xl hover:bg-card transition-all cursor-pointer"
                    >
                        {/* Avatar */}
                        <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-muted overflow-hidden border border-border">
                                {contact.avatarUrl ? (
                                    <img src={contact.avatarUrl} alt={contact.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                        <User size={16} />
                                    </div>
                                )}
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5 bg-background rounded-full p-0.5">
                                {contact.tier === 'Top' && <div className="w-3 h-3 bg-sonic-yellow rounded-full border border-background" />}
                                {contact.tier === 'Mid' && <div className="w-3 h-3 bg-sonic-blue rounded-full border border-background" />}
                                {contact.tier === 'Blog' && <div className="w-3 h-3 bg-muted-foreground rounded-full border border-background" />}
                            </div>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold text-foreground truncate group-hover:text-sonic-blue transition-colors">
                                    {contact.name}
                                </h4>
                                <div className="flex items-center gap-1">
                                    {contact.influenceScore > 90 && (
                                        <span className="px-1.5 py-0.5 bg-sonic-purple/10 border border-sonic-purple/20 rounded text-[10px] font-bold text-sonic-purple uppercase">
                                            Influencer
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="truncate max-w-[120px]">{contact.outlet}</span>
                                <span className="w-0.5 h-0.5 bg-muted-foreground rounded-full" />
                                <span>{contact.role}</span>
                            </div>
                        </div>

                        {/* Score */}
                        <div className="flex flex-col items-end">
                            <div className="flex items-center gap-1 text-xs font-bold text-sonic-yellow">
                                <Star size={10} fill="currentColor" />
                                {contact.influenceScore}
                            </div>
                            <div className={`text-[10px] font-medium ${contact.relationshipStrength === 'Strong' ? 'text-green-500' :
                                contact.relationshipStrength === 'Neutral' ? 'text-muted-foreground' :
                                    'text-red-500'
                                }`}>
                                {contact.relationshipStrength}
                            </div>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}

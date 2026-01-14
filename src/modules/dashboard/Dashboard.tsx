import React from 'react';
import { motion } from 'framer-motion';
import AgentWorkspace from './components/AgentWorkspace';

export default function Dashboard() {
    return (
        <div className="min-h-screen bg-bg-dark p-8 overflow-y-auto w-full">
            <div className="max-w-7xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                >
                    <AgentWorkspace />
                </motion.div>
            </div>
        </div>
    );
}

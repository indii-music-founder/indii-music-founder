import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { ScheduledPost } from '../types';

interface EditableCopyModalProps {
    post: ScheduledPost;
    onClose: () => void;
    onSave: (postId: string, newContent: string) => void;
}

const EditableCopyModal: React.FC<EditableCopyModalProps> = ({ post, onClose, onSave }) => {
    const [content, setContent] = useState(post.copy);

    useEffect(() => {
        setContent(post.copy);
    }, [post]);

    const handleSave = () => {
        onSave(post.id, content);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-6 border-b border-gray-800">
                    <h3 className="text-xl font-bold text-white">Edit Post for Day {post.day}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto">
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                            Platform: <span className={post.platform === 'Twitter' ? 'text-sky-400' : 'text-pink-500'}>{post.platform}</span>
                        </label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full h-64 bg-black/50 border border-gray-700 rounded-xl p-4 text-white focus:outline-none focus:border-purple-500 transition-colors resize-none font-mono text-sm"
                            placeholder="Write your post copy here..."
                        />
                    </div>
                </div>

                <div className="p-6 border-t border-gray-800 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-500 transition-colors font-bold"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditableCopyModal;

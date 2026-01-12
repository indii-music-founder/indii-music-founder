import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CandidatesCarousel } from '../src/modules/creative/components/CandidatesCarousel';
import '../src/index.css';

const App = () => {
    const [candidates, setCandidates] = useState([
        { id: '1', url: 'https://via.placeholder.com/150', prompt: 'Test Candidate 1' },
        { id: '2', url: 'https://via.placeholder.com/150', prompt: 'Test Candidate 2' }
    ]);

    return (
        <div className='p-10 bg-gray-900 h-screen w-screen relative'>
            <h1 className='text-white mb-4'>Candidates Carousel Demo</h1>
            <button className='text-white mb-4' id='focus-start'>Start Focus</button>
            <div className='relative h-[300px] w-full border border-gray-700 bg-black'>
                <CandidatesCarousel
                    candidates={candidates}
                    onSelect={(c) => console.log('Selected', c)}
                    onClose={() => console.log('Closed')}
                />
            </div>
        </div>
    );
};

const root = createRoot(document.getElementById('root'));
root.render(<App />);

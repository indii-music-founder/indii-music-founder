'use client';

import React from 'react';

export default function SelectOrgPage() {
    console.log("Rendering SelectOrgPage");
    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'black',
            color: 'white',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            zIndex: 99999
        }}>
            <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>Select Organization</h1>
            <p style={{ color: '#ccc' }}>System Status: Operational</p>
        </div>
    );
}

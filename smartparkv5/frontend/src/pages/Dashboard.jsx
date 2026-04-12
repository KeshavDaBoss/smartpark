import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
    const [search, setSearch] = useState('');
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [showMenu, setShowMenu] = useState(false);

    const malls = [
        { id: 'mall1', name: 'Mall 1 (Levels 1 & 2)', location: 'Downtown' },
        { id: 'mall2', name: 'Mall 2 (Level 1)', location: 'Uptown' }
    ];

    const filteredMalls = malls.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div style={{ padding: '2rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
                <img src="/smartparklogo-clear.png" alt="SmartPark" style={{ height: '150px' }} />
                <div style={{ position: 'relative' }}>
                    <div
                        onClick={() => setShowMenu(!showMenu)}
                        style={{
                            width: '40px', height: '40px', borderRadius: '50%',
                            background: 'var(--primary)', display: 'flex',
                            justifyContent: 'center', alignItems: 'center', cursor: 'pointer'
                        }}
                    >
                        {user.username[0].toUpperCase()}
                    </div>
                    {showMenu && (
                        <div style={{
                            position: 'absolute', top: '50px', right: '0',
                            background: 'var(--bg-card)', padding: '10px',
                            borderRadius: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
                            minWidth: '150px', zIndex: 10
                        }}>
                            <div style={{ padding: '8px', borderBottom: '1px solid #333', marginBottom: '8px' }}>
                                <small style={{ color: '#888' }}>Signed in as</small><br />
                                <strong>{user.username}</strong>
                            </div>
                            <button
                                style={{ width: '100%', textAlign: 'left', background: 'transparent', color: 'white', padding: '8px' }}
                                onClick={() => navigate('/my-bookings')}
                            >
                                My Bookings
                            </button>
                            <button
                                style={{ width: '100%', textAlign: 'left', background: 'transparent', color: '#ff4d4d', padding: '8px' }}
                                onClick={logout}
                            >
                                Logout
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Search */}
            <input
                className="input-field"
                style={{ fontSize: '1.2rem', padding: '1rem' }}
                placeholder="Search Malls..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />

            {/* Results */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '2rem', marginTop: '2rem' }}>
                {filteredMalls.map(mall => (
                    <div key={mall.id} className="card" style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                        onClick={() => navigate(`/mall/${mall.id}`)}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        <h2 style={{ color: 'var(--success)' }}>{mall.name}</h2>
                        <p style={{ color: '#888', marginTop: '0.5rem' }}>{mall.location}</p>
                        <button style={{ marginTop: '1.5rem', width: '100%' }}>View Availability</button>
                    </div>
                ))}
            </div>
        </div>
    );
}

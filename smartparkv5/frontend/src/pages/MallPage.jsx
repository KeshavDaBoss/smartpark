import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSlots } from '../utils/api';
import FloorPlan from '../components/FloorPlan';
import gsap from 'gsap';

export default function MallPage() {
    const { mallId } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();

    // State
    const [level, setLevel] = useState(1);
    const [slots, setSlots] = useState([]);
    const [viewDate, setViewDate] = useState('today'); // VIEWING date (for map coloring)
    const [navTrigger, setNavTrigger] = useState(0); // integer to trigger nav effect

    const mallName = mallId === 'mall1' ? 'Mall 1' : 'Mall 2';
    const levels = mallId === 'mall1' ? [1, 2] : [1];

    const fetchSlots = async () => {
        try {
            const dateObj = new Date();
            if (viewDate === 'tomorrow') {
                dateObj.setDate(dateObj.getDate() + 1);
            }
            const dateStr = formatDate(dateObj);
            const data = await getSlots(dateStr, user.user_id);
            setSlots(data);
        } catch (e) {
            console.error(e);
        }
    };

    const formatDate = (d) => {
        let dd = d.getDate();
        let mm = d.getMonth() + 1;
        let yyyy = d.getFullYear();
        if (dd < 10) dd = '0' + dd;
        if (mm < 10) mm = '0' + mm;
        return '' + dd + mm + yyyy;
    };

    useEffect(() => {
        fetchSlots();
        // Poll every 2 seconds for real-time updates
        const interval = setInterval(fetchSlots, 2000);
        return () => clearInterval(interval);
    }, [mallId, viewDate]);

    return (
        <div style={{ padding: '2rem' }}>
            <button onClick={() => navigate('/dashboard')} style={{ background: 'transparent', paddingLeft: 0, marginBottom: '1rem' }}>
                ← Back to Dashboard
            </button>

            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1>{mallName} <span style={{ fontSize: '0.6em', opacity: 0.7 }}>Level {level}</span></h1>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    {/* View Date Selector (To see future availability) */}
                    <select
                        className="input-field"
                        style={{ width: 'auto', margin: 0 }}
                        value={viewDate}
                        onChange={(e) => setViewDate(e.target.value)}
                    >
                        <option value="today">Today's Status</option>
                        <option value="tomorrow">Tomorrow's Avail.</option>
                    </select>

                    <button onClick={() => setNavTrigger(p => p + 1)} style={{ background: 'var(--accent)' }}>
                        Navigate to Closest
                    </button>
                </div>
            </div>

            {/* Level Tabs */}
            <div style={{ display: 'flex', gap: '5px', marginBottom: '1rem' }}>
                {levels.map(l => (
                    <div
                        key={l}
                        onClick={() => setLevel(l)}
                        style={{
                            padding: '10px 20px',
                            background: level === l ? 'var(--primary)' : '#333',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        Level {l}
                    </div>
                ))}
            </div>

            <FloorPlan
                mallId={mallId}
                level={level}
                slots={slots}
                refreshSlots={fetchSlots}
                onNavigate={navTrigger > 0 ? navTrigger : null}
            />

            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', gap: '2rem' }}>
                <Legend color="var(--slot-free)" label="Available" />
                <Legend color="var(--slot-occupied)" label="Occupied" />
                <Legend color="var(--slot-booked)" label="Booked" />
                <Legend color="var(--slot-my-booking)" label="My Booking" />
            </div>
        </div>
    );
}

const Legend = ({ color, label }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '20px', height: '20px', background: color, borderRadius: '4px' }}></div>
        <span>{label}</span>
    </div>
);

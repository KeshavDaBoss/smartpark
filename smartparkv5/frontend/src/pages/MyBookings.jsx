import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSlots, cancelBooking } from '../utils/api';

export default function MyBookings() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [bookings, setBookings] = useState([]);

    const fetchBookings = async () => {
        // We fetch slots for both today and tomorrow and filter by user_id
        // In a real app, we'd have a specific /my-bookings endpoint.
        // For here, we'll brute force for demo simplicity: fetch slots for today, then tomorrow.
        const todayStr = formatDate(new Date());
        const tmrw = new Date(); tmrw.setDate(tmrw.getDate() + 1);
        const tmrwStr = formatDate(tmrw);

        const slotData = [];
        try {
            // Parallel fetch
            const [todaySlots, tmrwSlots] = await Promise.all([
                getSlots(todayStr, user.user_id),
                getSlots(tmrwStr, user.user_id)
            ]);

            // Filter
            const myToday = todaySlots.filter(s => s.is_my_booking);
            myToday.forEach(s => { s._date = 'Today'; s._dateStr = todayStr; });
            const myTmrw = tmrwSlots.filter(s => s.is_my_booking);
            myTmrw.forEach(s => { s._date = 'Tomorrow'; s._dateStr = tmrwStr; });

            setBookings([...myToday, ...myTmrw]);
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

    const handleCancel = async (slotId, dateStr) => {
        if (window.confirm("Cancel this booking?")) {
            await cancelBooking(slotId, user.user_id, dateStr);
            fetchBookings();
        }
    };

    useEffect(() => {
        fetchBookings();
    }, []);

    return (
        <div style={{ padding: '2rem' }}>
            <button onClick={() => navigate('/dashboard')} style={{ background: 'transparent', paddingLeft: 0, marginBottom: '1rem' }}>
                ← Back to Dashboard
            </button>
            <h1>My Bookings</h1>

            <div style={{ display: 'grid', gap: '1rem', marginTop: '2rem' }}>
                {bookings.length === 0 && <p>No active bookings.</p>}
                {bookings.map((b, i) => (
                    <div key={i} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h3>Slot {b.slot_number}</h3>
                            <p style={{ color: '#888' }}>Mall {b.mall_id} • Level {b.level_id}</p>
                            <p style={{ color: 'var(--accent)' }}>{b._date}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button onClick={() => navigate(`/mall/${b.mall_id}`)}>Navigate to Slot</button>
                            <button style={{ background: '#ff4d4d' }} onClick={() => handleCancel(b.id, b._dateStr)}>Cancel</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

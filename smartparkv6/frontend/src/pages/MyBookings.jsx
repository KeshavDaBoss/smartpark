import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSlots, cancelBooking } from '../utils/api';
import gsap from 'gsap';

export default function MyBookings() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [bookings, setBookings] = useState([]);
    const [statusMessage, setStatusMessage] = useState(null);
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef(null);
    const pageRef = useRef(null);
    const headingRef = useRef(null);
    const bookingsRef = useRef(null);

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
        try {
            await cancelBooking(slotId, user.user_id, dateStr);
            setStatusMessage({ type: 'success', text: 'Booking cancelled successfully.' });
            fetchBookings();
        } catch (e) {
            setStatusMessage({ type: 'error', text: e.message || 'Failed to cancel booking.' });
        }
    };

    useEffect(() => {
        fetchBookings();
    }, []);

    useEffect(() => {
        if (!pageRef.current) return;

        const ctx = gsap.context(() => {
            const bookingCards = bookingsRef.current?.querySelectorAll('.sp-booking-card') || [];
            const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

            tl.fromTo(headingRef.current, { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 0.52 })
                .fromTo(bookingCards, { autoAlpha: 0, y: 28, scale: 0.98 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.08 }, '-=0.2');
        }, pageRef);

        return () => ctx.revert();
    }, [bookings.length]);

    useEffect(() => {
        const onPointerDown = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowMenu(false);
            }
        };

        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('touchstart', onPointerDown);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('touchstart', onPointerDown);
        };
    }, []);

    return (
        <>
            <header className="sp-topbar">
                <div className="sp-topbar-inner">
                    <button className="sp-brand-btn" onClick={() => navigate('/dashboard')} aria-label="Go to Dashboard">
                        <img src="/SmartPark_Logo_Clear.png" alt="SmartPark" className="sp-brand-logo" />
                    </button>
                    <div ref={menuRef} style={{ position: 'relative' }}>
                        <button className="sp-avatar-btn" aria-label="Profile" onClick={() => setShowMenu(!showMenu)}>
                            <img src="/account_circle_1000dp_E3E3E3_FILL0_wght400_GRAD0_opsz48.png" alt="User account" className="sp-avatar-icon" />
                        </button>
                        {showMenu && (
                            <div className="sp-card sp-menu-panel" style={{ position: 'absolute', right: 0, top: '3rem', minWidth: '210px', padding: '0.8rem', zIndex: 80 }}>
                                <div style={{ padding: '0.55rem', marginBottom: '0.55rem', borderBottom: '1px solid rgba(72,72,71,0.45)' }}>
                                    <div className="sp-muted" style={{ fontSize: '0.72rem' }}>Signed in as</div>
                                    <strong>{user.username}</strong>
                                </div>
                                <button className="sp-ghost-btn" style={{ width: '100%', textAlign: 'left', padding: '0.6rem 0.7rem', marginBottom: '0.45rem' }} onClick={() => { setShowMenu(false); navigate('/dashboard'); }}>
                                    Dashboard
                                </button>
                                <button className="sp-ghost-btn" style={{ width: '100%', textAlign: 'left', padding: '0.6rem 0.7rem', color: 'var(--error)' }} onClick={() => { setShowMenu(false); logout(); }}>
                                    Logout
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="sp-shell" ref={pageRef}>
                <button className="sp-ghost-btn" onClick={() => navigate('/dashboard')} style={{ padding: '0.55rem 0.9rem', marginBottom: '1rem' }}>
                    <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: '0.35rem' }}>arrow_back</span>
                    Back to Dashboard
                </button>

                <h1 ref={headingRef} style={{ fontSize: 'clamp(2rem, 6vw, 3.4rem)', marginBottom: '1.5rem' }}>My Bookings</h1>

                {statusMessage && (
                    <div className="sp-card" style={{ padding: '0.8rem 1rem', marginBottom: '1rem', borderColor: statusMessage.type === 'error' ? 'rgba(255,110,132,0.45)' : 'rgba(128,249,200,0.45)', color: statusMessage.type === 'error' ? 'var(--error)' : 'var(--status-free)' }}>
                        {statusMessage.text}
                    </div>
                )}

                <section ref={bookingsRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '1.1rem' }}>
                    {bookings.length === 0 && (
                        <div className="sp-card" style={{ padding: '1.4rem' }}>
                            <p className="sp-muted" style={{ margin: 0 }}>No active bookings.</p>
                        </div>
                    )}

                    {bookings.map((b, i) => (
                        <article key={i} className="sp-card sp-booking-card" style={{ padding: '1.3rem', borderRadius: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                                <div>
                                    <div className="sp-pill" style={{ marginBottom: '0.5rem' }}>{b._date}</div>
                                    <h3 style={{ fontSize: '2rem' }}>Slot {b.slot_number}</h3>
                                    <p className="sp-muted" style={{ margin: '0.2rem 0 0 0' }}>
                                         {String(b.mall_id).toUpperCase()} • Level {b.level_id}
                                    </p>
                                </div>
                                
                            </div>

                            <div style={{ display: 'grid', gap: '0.55rem' }}>
                                <button className="sp-primary-btn" style={{ width: '100%', padding: '0.82rem' }} onClick={() => navigate(`/mall/${b.mall_id}`)}>
                                    Navigate to Slot
                                </button>
                                <button className="sp-ghost-btn" style={{ width: '100%', padding: '0.82rem', color: 'var(--error)' }} onClick={() => handleCancel(b.id, b._dateStr)}>
                                    Cancel Booking
                                </button>
                            </div>
                        </article>
                    ))}
                </section>
            </main>
        </>
    );
}

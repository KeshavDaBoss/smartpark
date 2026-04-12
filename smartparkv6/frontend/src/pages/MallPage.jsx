import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSlots } from '../utils/api';
import FloorPlan from '../components/FloorPlan';
import gsap from 'gsap';

export default function MallPage() {
    const { mallId } = useParams();
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    // State
    const [level, setLevel] = useState(1);
    const [slots, setSlots] = useState([]);
    const [viewDate, setViewDate] = useState('today'); // VIEWING date (for map coloring)
    const [navTrigger, setNavTrigger] = useState(0); // integer to trigger nav effect
    const [showRoiConfig, setShowRoiConfig] = useState(false);
    const [rois1, setRois1] = useState({});
    const [rois2, setRois2] = useState({});
    const [activeCam, setActiveCam] = useState('camera1');
    const [currentSlotConfig, setCurrentSlotConfig] = useState('M2-L1-S1');
    const [drawing, setDrawing] = useState(false);
    const [liveDetection, setLiveDetection] = useState({ car_count: 0, slot_status: {} });
    const [roiSaveStatus, setRoiSaveStatus] = useState(null);
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef(null);
    const pageRef = useRef(null);
    const headerRef = useRef(null);
    const levelsRef = useRef(null);
    const legendRef = useRef(null);

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

    useEffect(() => {
        if (!pageRef.current) return;

        const ctx = gsap.context(() => {
            const legendNodes = legendRef.current?.querySelectorAll('.sp-legend-pill') || [];
            const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

            tl.fromTo(headerRef.current, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.52 })
                .fromTo(levelsRef.current, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.44 }, '-=0.25')
                .fromTo('.sp-floorplan-wrap', { autoAlpha: 0, y: 28, scale: 0.99 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.62 }, '-=0.2')
                .fromTo(legendNodes, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.35, stagger: 0.05 }, '-=0.28');
        }, pageRef);

        return () => ctx.revert();
    }, [mallId]);

    const camPort = activeCam === 'camera1' ? 5001 : 5002;
    const ROI_WIDTH = 640;
    const ROI_HEIGHT = 480;
    const activeRois = activeCam === 'camera1' ? rois1 : rois2;
    const setActiveRois = activeCam === 'camera1' ? setRois1 : setRois2;
    const M2_SLOTS = ['M2-L1-S1', 'M2-L1-S2', 'M2-L1-S3', 'M2-L1-S4'];
    const configuredCount = M2_SLOTS.filter((sid) => (activeRois[sid] || []).length > 1).length;
    const progressPct = Math.round((configuredCount / M2_SLOTS.length) * 100);

    useEffect(() => {
        if (!showRoiConfig) return;

        let isMounted = true;
        const fetchLiveStatus = () => {
            fetch(`http://localhost:${camPort}/live_status`)
                .then(res => res.json())
                .then((data) => {
                    if (isMounted) {
                        setLiveDetection({
                            car_count: data.car_count || 0,
                            slot_status: data.slot_status || {}
                        });
                    }
                })
                .catch(() => {
                    if (isMounted) {
                        setLiveDetection({ car_count: 0, slot_status: {} });
                    }
                });
        };

        fetchLiveStatus();
        const interval = setInterval(fetchLiveStatus, 1000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [showRoiConfig, camPort]);

    const toRoiPoint = (event, element) => {
        const rect = element.getBoundingClientRect();
        const x = Math.round(((event.clientX - rect.left) / rect.width) * ROI_WIDTH);
        const y = Math.round(((event.clientY - rect.top) / rect.height) * ROI_HEIGHT);
        return [
            Math.max(0, Math.min(ROI_WIDTH, x)),
            Math.max(0, Math.min(ROI_HEIGHT, y))
        ];
    };

    const openRoiConfig = () => {
        const loadCam = (port) => fetch(`http://localhost:${port}/get_rois`)
            .then(res => res.json())
            .then(data => {
                const updatedRois = {};
                if (data.rois) {
                    for (const key in data.rois) {
                        const val = data.rois[key];
                        if (val && typeof val[0] === 'number') {
                            updatedRois[key] = [
                                [val[0], val[1]],
                                [val[0] + val[2], val[1]],
                                [val[0] + val[2], val[1] + val[3]],
                                [val[0], val[1] + val[3]]
                            ];
                        } else {
                            updatedRois[key] = val;
                        }
                    }
                }
                return updatedRois;
            });

        Promise.all([loadCam(5001), loadCam(5002)])
            .then(([r1, r2]) => {
                setRois1(r1);
                setRois2(r2);
                setActiveCam('camera1');
                setRoiSaveStatus(null);
                setShowRoiConfig(true);
            })
            .catch((err) => {
                console.error(err);
                setRois1({});
                setRois2({});
                setActiveCam('camera1');
                setRoiSaveStatus(null);
                setShowRoiConfig(true);
            });
    };

    return (
        <>
            <header className="sp-topbar">
                <div className="sp-topbar-inner">
                    <button className="sp-brand-btn" onClick={() => navigate('/dashboard')} aria-label="Go to Dashboard">
                        <img src="/SmartPark_Logo_Clear.png" alt="SmartPark" className="sp-brand-logo" />
                    </button>
                    <div ref={menuRef} style={{ position: 'relative' }}>
                        <button className="sp-avatar-btn" onClick={() => setShowMenu(!showMenu)} aria-label="Open account menu">
                            <img src="/account_circle_1000dp_E3E3E3_FILL0_wght400_GRAD0_opsz48.png" alt="User account" className="sp-avatar-icon" />
                        </button>
                        {showMenu && (
                            <div className="sp-card sp-menu-panel" style={{ position: 'absolute', right: 0, top: '3rem', minWidth: '210px', padding: '0.8rem', zIndex: 80 }}>
                                <div style={{ padding: '0.55rem', marginBottom: '0.55rem', borderBottom: '1px solid rgba(72,72,71,0.45)' }}>
                                    <div className="sp-muted" style={{ fontSize: '0.72rem' }}>Signed in as</div>
                                    <strong>{user.username}</strong>
                                </div>
                                <button className="sp-ghost-btn" style={{ width: '100%', textAlign: 'left', padding: '0.6rem 0.7rem', marginBottom: '0.45rem' }} onClick={() => { setShowMenu(false); navigate('/my-bookings'); }}>
                                    My Bookings
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

                <header ref={headerRef} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
                    <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.6rem)' }}>{mallName}</h1>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', alignItems: 'center' }}>
                        {mallId === 'mall2' && level === 1 && user?.username === 'user4' && (
                            <button className="sp-ghost-btn" onClick={openRoiConfig} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.6rem 0.8rem' }}>
                                <span className="material-symbols-outlined">tune</span>
                                Configure ROIs
                            </button>
                        )}

                        {mallId !== 'mall2' && (
                            <div style={{ display: 'flex', gap: '0.35rem', padding: '0.25rem', borderRadius: '0.8rem', background: 'rgba(38,38,38,0.75)', border: '1px solid rgba(72,72,71,0.6)' }}>
                                <button
                                    className={viewDate === 'today' ? 'sp-primary-btn' : 'sp-ghost-btn'}
                                    style={{ padding: '0.45rem 0.8rem', borderRadius: '0.6rem' }}
                                    onClick={() => setViewDate('today')}
                                >
                                    Today
                                </button>
                                <button
                                    className={viewDate === 'tomorrow' ? 'sp-primary-btn' : 'sp-ghost-btn'}
                                    style={{ padding: '0.45rem 0.8rem', borderRadius: '0.6rem' }}
                                    onClick={() => setViewDate('tomorrow')}
                                >
                                    Tomorrow
                                </button>
                            </div>
                        )}

                        <button className="sp-primary-btn" onClick={() => setNavTrigger(p => p + 1)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.62rem 0.95rem' }}>
                            <span className="material-symbols-outlined">near_me</span>
                            Navigate to Closest
                        </button>
                    </div>
                </header>

                <div ref={levelsRef} style={{ display: 'flex', gap: '0.35rem', padding: '0.25rem', borderRadius: '0.9rem', background: 'rgba(38,38,38,0.74)', width: 'fit-content', marginBottom: '1rem' }}>
                    {levels.map(l => (
                        <button
                            key={l}
                            onClick={() => setLevel(l)}
                            className={level === l ? 'sp-primary-btn' : 'sp-ghost-btn'}
                            style={{ padding: '0.5rem 0.9rem', borderRadius: '0.7rem', fontWeight: 700 }}
                        >
                            Level {l}
                        </button>
                    ))}
                </div>

                <div className="sp-floorplan-wrap">
                    <FloorPlan
                        mallId={mallId}
                        level={level}
                        slots={slots}
                        refreshSlots={fetchSlots}
                        onNavigate={navTrigger > 0 ? navTrigger : null}
                    />
                </div>

                <div ref={legendRef} style={{ marginTop: '1.4rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.6rem' }}>
                    <Legend color="var(--status-free)" label="Available" className="sp-legend-pill" />
                    <Legend color="var(--status-occupied)" label="Occupied" className="sp-legend-pill" />
                    <Legend color="var(--status-booked)" label="Booked" className="sp-legend-pill" />
                    <Legend color="var(--status-my-booking)" label="My Booking" className="sp-legend-pill" />
                    <Legend color="var(--status-disabled)" label="Disabled" className="sp-legend-pill" />
                    <Legend color="var(--status-elderly)" label="Elderly" className="sp-legend-pill" />
                </div>
            </main>

            {/* ROI Configuration Modal */}
            {showRoiConfig && (
                <div className="sp-modal-backdrop" style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(2,9,24,0.94)',
                    zIndex: 1000,
                    display: 'grid',
                    placeItems: 'center',
                    padding: '1rem'
                }}>
                    <div className="sp-modal-panel"
                        style={{
                            width: 'min(96vw, 1240px)',
                            maxHeight: '94vh',
                            borderRadius: '14px',
                            overflow: 'hidden',
                            border: '1px solid rgba(50,84,136,0.5)',
                            background: 'linear-gradient(180deg, rgba(8,17,38,0.96) 0%, rgba(2,9,24,0.96) 100%)',
                            boxShadow: '0 40px 100px rgba(0,0,0,0.8)',
                            display: 'grid',
                            gridTemplateRows: 'auto 1fr auto'
                        }}
                    >
                        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.8rem', padding: '1rem 1.2rem', borderBottom: '1px solid rgba(50,84,136,0.3)', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                                <button 
                                    className="sp-ghost-btn" 
                                    onClick={() => { setShowRoiConfig(false); navigate('/mall/mall2'); }} 
                                    style={{ padding: '0.45rem 0.55rem', marginRight: '0.35rem', display: 'inline-flex', alignItems: 'center' }}
                                    title="Back to Mall 2"
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_back</span>
                                </button>
                                <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontVariationSettings: "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24" }}>settings_video_camera</span>
                                <h2 style={{ margin: 0, fontSize: '1.55rem' }}>Configure Regions of Interest</h2>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                                <button className="sp-ghost-btn" onClick={() => setActiveRois(prev => ({ ...prev, [currentSlotConfig]: [] }))} style={{ padding: '0.5rem 0.75rem', color: 'var(--status-elderly)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>ink_eraser</span>
                                    Clear Slot
                                </button>
                                <button className="sp-ghost-btn" onClick={() => { setRoiSaveStatus(null); setShowRoiConfig(false); }} style={{ padding: '0.5rem 0.75rem' }}>Cancel</button>
                                <button
                                    onClick={() => {
                                        setRoiSaveStatus({ type: 'info', text: 'Saving ROI configuration...' });
                                        fetch(`http://localhost:${camPort}/config_rois`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify(activeRois)
                                        })
                                            .then(res => res.json())
                                            .then(() => {
                                                setRoiSaveStatus({ type: 'success', text: 'ROIs saved successfully.' });
                                            })
                                            .catch(err => setRoiSaveStatus({ type: 'error', text: 'Failed to save ROIs: ' + err.message }));
                                    }}
                                    style={{
                                        padding: '0.52rem 1rem',
                                        borderRadius: '0.7rem',
                                        fontWeight: 700,
                                        color: '#033022',
                                        background: 'linear-gradient(135deg, #80f9c8 0%, #5deeb7 100%)',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.38rem'
                                    }}
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>save</span>
                                    Save Configuration
                                </button>
                            </div>
                            {roiSaveStatus && (
                                <div style={{ width: '100%', marginTop: '0.4rem', padding: '0.55rem 0.7rem', borderRadius: '0.6rem', border: `1px solid ${roiSaveStatus.type === 'error' ? 'rgba(255,110,132,0.55)' : 'rgba(128,249,200,0.45)'}`, color: roiSaveStatus.type === 'error' ? 'var(--error)' : roiSaveStatus.type === 'info' ? 'var(--muted)' : 'var(--status-free)', background: 'rgba(8,17,38,0.6)' }}>
                                    {roiSaveStatus.text}
                                </div>
                            )}
                        </header>

                        <div style={{ overflow: 'auto' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '290px 1fr', minHeight: '620px' }}>
                                <aside style={{ borderRight: '1px solid rgba(72,72,71,0.28)', padding: '1rem', display: 'grid', gap: '1.1rem', alignContent: 'start', background: 'rgba(16,16,16,0.7)' }}>
                                    <section>
                                        <div className="sp-muted" style={{ fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.19em', marginBottom: '0.55rem', fontWeight: 700 }}>Camera Interface</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem', padding: '0.25rem', borderRadius: '0.65rem', background: 'var(--surface-low)', border: '1px solid rgba(72,72,71,0.4)' }}>
                                            {['camera1', 'camera2'].map((cam) => (
                                                <button
                                                    key={cam}
                                                    onClick={() => setActiveCam(cam)}
                                                    style={{
                                                        padding: '0.55rem 0.45rem',
                                                        borderRadius: '0.5rem',
                                                        fontSize: '0.82rem',
                                                        fontWeight: 700,
                                                        color: activeCam === cam ? 'var(--primary)' : 'var(--muted)',
                                                        background: activeCam === cam ? 'rgba(38,38,38,0.95)' : 'transparent',
                                                        border: activeCam === cam ? '1px solid rgba(224,142,254,0.35)' : '1px solid transparent'
                                                    }}
                                                >
                                                    Camera {cam === 'camera1' ? '1' : '2'}
                                                </button>
                                            ))}
                                        </div>
                                        <div style={{ marginTop: '0.6rem', padding: '0.5rem 0.65rem', borderRadius: '0.6rem', border: '1px solid rgba(72,72,71,0.35)', background: 'rgba(10,16,30,0.65)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span className="sp-muted" style={{ fontSize: '0.72rem' }}>Cars Detected</span>
                                            <span style={{ color: liveDetection.car_count > 0 ? 'var(--status-occupied)' : 'var(--status-free)', fontWeight: 700, fontSize: '0.82rem' }}>{liveDetection.car_count}</span>
                                        </div>
                                    </section>

                                    <section style={{ background: 'rgba(19,19,19,0.85)', border: '1px solid rgba(72,72,71,0.32)', borderRadius: '0.8rem', padding: '0.9rem' }}>
                                        <div style={{ color: 'var(--primary)', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.19em', marginBottom: '0.75rem', fontWeight: 700 }}>Configuration Steps</div>
                                        <div style={{ display: 'grid', gap: '0.75rem', color: 'var(--muted)', fontSize: '0.87rem', lineHeight: 1.45 }}>
                                            <StepItem number="1" text="Select a slot ID from the grid below to focus." />
                                            <StepItem number="2" text="Click and drag on the live feed to paint the ROI area." />
                                            <StepItem number="3" text="Verify boundary and click Save when all slots are configured." />
                                        </div>
                                    </section>

                                    <section>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.55rem' }}>
                                            <div className="sp-muted" style={{ fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.19em', fontWeight: 700 }}>Slot Directory</div>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem' }}>
                                            {M2_SLOTS.map((sid) => {
                                                const isActive = sid === currentSlotConfig;
                                                const isDone = (activeRois[sid] || []).length > 1;
                                                const liveStatus = liveDetection.slot_status?.[sid];
                                                return (
                                                    <button
                                                        key={sid}
                                                        onClick={() => setCurrentSlotConfig(sid)}
                                                        style={{
                                                            padding: '0.62rem 0.45rem',
                                                            borderRadius: '0.65rem',
                                                            background: isActive ? 'rgba(224,142,254,0.15)' : 'rgba(19,19,19,0.92)',
                                                            border: isActive ? '1px solid var(--primary)' : isDone ? '1px solid rgba(128,249,200,0.45)' : '1px solid rgba(72,72,71,0.4)',
                                                            color: isActive ? 'var(--primary)' : isDone ? 'var(--secondary)' : 'var(--muted)',
                                                            fontSize: '0.74rem',
                                                            display: 'grid',
                                                            gap: '0.12rem'
                                                        }}
                                                    >
                                                        <span style={{ opacity: 0.65, fontSize: '0.58rem' }}>ID</span>
                                                        <span style={{ fontWeight: 700 }}>{sid}</span>
                                                        {liveStatus && <span style={{ fontSize: '0.56rem', color: liveStatus === 'OCCUPIED' ? 'var(--status-occupied)' : 'var(--status-free)' }}>{liveStatus}</span>}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </section>
                                </aside>

                                <section style={{ background: 'var(--surface-low)', position: 'relative', padding: '1rem', display: 'grid' }}>
                                    <div
                                        style={{
                                            position: 'relative',
                                            width: '100%',
                                            aspectRatio: '640 / 480',
                                            border: '1px solid rgba(224,142,254,0.25)',
                                            borderRadius: '0.6rem',
                                            overflow: 'hidden',
                                            cursor: 'crosshair',
                                            userSelect: 'none',
                                            background: '#080b10'
                                        }}
                                        onMouseDown={(e) => {
                                            const [x, y] = toRoiPoint(e, e.currentTarget);
                                            setDrawing(true);
                                            setActiveRois(prev => {
                                                const currentPoints = prev[currentSlotConfig] || [];
                                                const last = currentPoints[currentPoints.length - 1];
                                                if (last && Math.abs(x - last[0]) < 2 && Math.abs(y - last[1]) < 2) return prev;
                                                return {
                                                    ...prev,
                                                    [currentSlotConfig]: [...currentPoints, [x, y]]
                                                };
                                            });
                                        }}
                                        onMouseMove={(e) => {
                                            if (!drawing) return;
                                            const [x, y] = toRoiPoint(e, e.currentTarget);
                                            setActiveRois(prev => {
                                                const currentPoints = prev[currentSlotConfig] || [];
                                                const last = currentPoints[currentPoints.length - 1];
                                                if (last && Math.abs(x - last[0]) < 2 && Math.abs(y - last[1]) < 2) return prev;
                                                return {
                                                    ...prev,
                                                    [currentSlotConfig]: [...currentPoints, [x, y]]
                                                };
                                            });
                                        }}
                                        onMouseUp={() => setDrawing(false)}
                                        onMouseLeave={() => setDrawing(false)}
                                    >
                                        <img
                                            src={`http://localhost:${camPort}/video_feed`}
                                            draggable="false"
                                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.82, pointerEvents: 'none' }}
                                            alt=""
                                        />
                                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.55) 100%)' }} />

                                        <svg viewBox="0 0 640 480" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}>
                                            {Object.entries(activeRois).map(([sid, pts]) => {
                                                if (!pts || pts.length < 2) return null;
                                                const isCurrent = sid === currentSlotConfig;
                                                const pointsStr = pts.map(p => `${p[0]},${p[1]}`).join(' ');
                                                return (
                                                    <g key={sid}>
                                                        <polyline
                                                            points={pointsStr}
                                                            fill="none"
                                                            stroke={isCurrent ? 'rgba(224, 142, 254, 0.45)' : 'rgba(128, 249, 200, 0.38)'}
                                                            strokeWidth="36"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                        />
                                                        <text x={pts[0][0]} y={pts[0][1] - 18} fill={isCurrent ? '#f4b9ff' : '#9cf9d6'} fontSize="11" fontWeight="bold" textAnchor="middle" style={{ textShadow: '0 0 4px #000' }}>
                                                            {sid}
                                                        </text>
                                                    </g>
                                                );
                                            })}
                                        </svg>

                                        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' }} />
                                        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' }} />

                                    </div>
                                </section>
                            </div>
                        </div>

                        <footer style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap', padding: '0.8rem 1.2rem', borderTop: '1px solid rgba(72,72,71,0.28)', background: 'rgba(26,25,25,0.8)' }}>
                            <div>
                                <div style={{ fontSize: '0.62rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: '0.35rem', fontWeight: 700 }}>Configuration Progress</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                    <div style={{ width: '140px', height: '6px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                                        <div style={{ width: `${progressPct}%`, height: '100%', background: 'var(--primary)' }} />
                                    </div>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700 }}>{configuredCount} / {M2_SLOTS.length} Slots</span>
                                </div>
                            </div>


                        </footer>
                    </div>
                </div>
            )}
        </>
    );
}

function StepItem({ number, text }) {
    return (
        <div style={{ display: 'flex', gap: '0.55rem', alignItems: 'flex-start' }}>
            <span style={{ width: '20px', height: '20px', borderRadius: '999px', background: 'var(--surface-highest)', border: '1px solid rgba(224,142,254,0.35)', color: 'var(--primary)', display: 'grid', placeItems: 'center', fontSize: '0.65rem', fontWeight: 700, flexShrink: 0 }}>
                {number}
            </span>
            <span>{text}</span>
        </div>
    );
}

const Legend = ({ color, label, className = '' }) => (
    <div className={`sp-pill ${className}`.trim()}>
        <div style={{ width: '10px', height: '10px', background: color, borderRadius: '999px', boxShadow: `0 0 3px ${color}` }}></div>
        <span>{label}</span>
    </div>
);

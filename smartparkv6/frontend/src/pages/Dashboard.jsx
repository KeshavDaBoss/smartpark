import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import gsap from 'gsap';

export default function Dashboard() {
    const [search, setSearch] = useState('');
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef(null);
    const pageRef = useRef(null);
    const heroRef = useRef(null);
    const searchRef = useRef(null);

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
        ['/mall_1_card_opt.jpg', '/mall_2_card_opt.jpg'].forEach((src) => {
            const image = new Image();
            image.src = src;
        });
    }, []);

    useEffect(() => {
        if (!pageRef.current) return;

        const ctx = gsap.context(() => {
            const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

            tl.fromTo(heroRef.current, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.16 })
                .fromTo(searchRef.current, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.14 }, '-=0.08');
        }, pageRef);

        return () => ctx.revert();
    }, []);

    const malls = [
        { id: 'mall1', name: 'Mall 1', image: '/mall_1_card_opt.jpg' },
        { id: 'mall2', name: 'Mall 2', image: '/mall_2_card_opt.jpg' }
    ];

    const filteredMalls = malls.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));

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
                            <div className="sp-card sp-menu-panel" style={{ position: 'absolute', right: 0, top: '3rem', minWidth: '200px', padding: '0.8rem', zIndex: 8 }}>
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
                <section ref={heroRef} style={{ marginBottom: '2.6rem' }}>
                    <h1 style={{ fontSize: 'clamp(2.2rem, 6vw, 4.4rem)', lineHeight: 1, marginBottom: '0.8rem' }}>
                        Find your <span style={{ color: 'var(--primary)' }}>space.</span>
                    </h1>
                </section>

                <section ref={searchRef} style={{ marginBottom: '2rem' }}>
                    <div style={{ position: 'relative' }}>
                        <span className="material-symbols-outlined" style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}>
                            search
                        </span>
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search shopping malls..."
                            style={{
                                width: '100%',
                                background: 'rgba(38,38,38,0.82)',
                                color: 'var(--text)',
                                border: '1px solid rgba(72,72,71,0.5)',
                                borderRadius: '1rem',
                                padding: '1rem 1rem 1rem 2.9rem',
                                fontSize: '1rem'
                            }}
                        />
                    </div>
                </section>

                <section style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem' }}>
                    {filteredMalls.map((mall) => (
                        <article key={mall.id} className="sp-card sp-mall-card" style={{ borderRadius: '2rem', overflow: 'hidden', cursor: 'pointer' }} onClick={() => navigate(`/mall/${mall.id}`)}>
                            <div style={{ 
                                height: '280px', 
                                background: 'linear-gradient(135deg, rgba(8,17,38,0.85), rgba(13,26,53,0.9))',
                                display: 'flex',
                                alignItems: 'flex-end',
                                padding: '1.8rem',
                                position: 'relative'
                            }}>
                                <img
                                    src={mall.image}
                                    alt=""
                                    loading="eager"
                                    fetchPriority="high"
                                    decoding="async"
                                    style={{
                                        position: 'absolute',
                                        inset: 0,
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                        zIndex: 0
                                    }}
                                />
                                <div style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: 'linear-gradient(90deg, rgba(2,9,24,0.08) 0%, rgba(2,9,24,0.45) 58%, rgba(2,9,24,0.7) 100%), linear-gradient(135deg, rgba(0,0,0,0.18), rgba(0,0,0,0.35))',
                                    zIndex: 1,
                                    pointerEvents: 'none'
                                }} />
                                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 2 }}>
                                    <h2 style={{ fontSize: '2.4rem', fontWeight: 800 }}>{mall.name}</h2>
                                    <button className="sp-primary-btn" style={{ padding: '0.9rem 1.35rem', color: '#ffffff', border: '1px solid rgba(255,255,255,0.3)', boxShadow: '0 6px 14px rgba(0,0,0,0.28)', textShadow: '0 1px 1px rgba(0,0,0,0.28)' }} onClick={(e) => { e.stopPropagation(); navigate(`/mall/${mall.id}`); }}>
                                        View Availability
                                    </button>
                                </div>
                            </div>
                        </article>
                    ))}
                </section>
            </main>
        </>
    );
}

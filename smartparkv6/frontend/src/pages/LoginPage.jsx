import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { loginUser, signupUser } from '../utils/api';

export default function LoginPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isDisabled, setIsDisabled] = useState(false);
    const [isElderly, setIsElderly] = useState(false);
    const [error, setError] = useState('');

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            if (isLogin) {
                const data = await loginUser(username, password);
                login(data);
                navigate('/dashboard');
            } else {
                await signupUser(username, password, isDisabled, isElderly);
                // Auto login after signup
                const data = await loginUser(username, password);
                login(data);
                navigate('/dashboard');
            }
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '2rem 1.25rem' }}>
            <div style={{ width: '100%', display: 'grid', justifyItems: 'center' }}>
            <div style={{ width: '100%', textAlign: 'center', marginBottom: '1.2rem' }}>
                    <img
                        src="/SmartPark_Logo_Clear.png"
                        alt="SmartPark"
                        style={{ width: 'min(500px, 88vw)', height: 'auto', margin: '0 auto', display: 'block' }}
                    />
                    <p className="sp-muted" style={{ margin: '0.15rem 0 0 0', letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '0.72rem' }}>
                        {isLogin ? 'Login' : 'Sign Up'}
                    </p>
                </div>

                <div className="sp-card" style={{ width: '100%', maxWidth: '420px', padding: '1.8rem', borderRadius: '2rem' }}>
                    <div style={{ display: 'flex', gap: '0.35rem', background: 'rgba(0,0,0,0.35)', borderRadius: '999px', padding: '0.35rem', marginBottom: '1.5rem' }}>
                        <button
                            type="button"
                            className={isLogin ? 'sp-primary-btn' : 'sp-ghost-btn'}
                            style={{ flex: 1, padding: '0.55rem 0.7rem', borderRadius: '999px', fontWeight: 700 }}
                            onClick={() => setIsLogin(true)}
                        >
                            Login
                        </button>
                        <button
                            type="button"
                            className={!isLogin ? 'sp-primary-btn' : 'sp-ghost-btn'}
                            style={{ flex: 1, padding: '0.55rem 0.7rem', borderRadius: '999px', fontWeight: 700 }}
                            onClick={() => setIsLogin(false)}
                        >
                            Sign Up
                        </button>
                    </div>

                    {error && <div style={{ color: 'var(--error)', marginBottom: '0.9rem', textAlign: 'center' }}>{error}</div>}

                    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.9rem' }}>
                        <input
                            type="text"
                            aria-label="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            placeholder="Username"
                            style={{ width: '100%', background: 'var(--surface-highest)', color: 'var(--text)', border: '1px solid rgba(72,72,71,0.55)', borderRadius: '0.85rem', padding: '0.85rem 1rem' }}
                        />

                        <input
                            type="password"
                            aria-label="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="Password"
                            style={{ width: '100%', background: 'var(--surface-highest)', color: 'var(--text)', border: '1px solid rgba(72,72,71,0.55)', borderRadius: '0.85rem', padding: '0.85rem 1rem' }}
                        />

                        {!isLogin && (
                            <div style={{ display: 'grid', gap: '0.55rem', marginTop: '0.2rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', color: 'var(--muted)' }}>
                                    <input
                                        type="checkbox"
                                        checked={isDisabled}
                                        onChange={(e) => setIsDisabled(e.target.checked)}
                                    />
                                    Disabled parking needed
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', color: 'var(--muted)' }}>
                                    <input
                                        type="checkbox"
                                        checked={isElderly}
                                        onChange={(e) => setIsElderly(e.target.checked)}
                                    />
                                    Elderly profile
                                </label>
                            </div>
                        )}

                        <button type="submit" className="sp-primary-btn" style={{ width: '100%', padding: '0.9rem', marginTop: '0.5rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            {isLogin ? 'Access System' : 'Create Account'}
                        </button>
                    </form>

                    <div style={{ marginTop: '1.1rem', textAlign: 'center', fontSize: '0.82rem', color: 'var(--muted)' }}>
                        {isLogin ? "Don't have an account? " : 'Already have an account? '}
                        <button
                            type="button"
                            onClick={() => setIsLogin(!isLogin)}
                            style={{ background: 'transparent', color: 'var(--primary)', fontWeight: 600, padding: 0 }}
                        >
                            {isLogin ? 'Sign Up' : 'Login'}
                        </button>
                    </div>
                </div>

                {isLogin && (
                    <div style={{ marginTop: '1.4rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.8rem' }}>
                            <div style={{ flex: 1, height: '1px', background: 'rgba(72,72,71,0.5)' }} />
                            <span style={{ fontSize: '0.62rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.18em' }}>Quick Access</span>
                            <div style={{ flex: 1, height: '1px', background: 'rgba(72,72,71,0.5)' }} />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.55rem' }}>
                            <DemoBtn label="User 1" onClick={() => { setUsername('user1'); setPassword('password'); }} />
                            <DemoBtn label="User 2 (Disabled)" onClick={() => { setUsername('user2'); setPassword('password'); }} />
                            <DemoBtn label="User 3 (Elderly)" onClick={() => { setUsername('user3'); setPassword('password'); }} />
                            <DemoBtn label="User 4 (Admin)" onClick={() => { setUsername('user4'); setPassword('password'); }} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function DemoBtn({ label, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                background: 'rgba(26,25,25,0.8)',
                border: '1px solid rgba(72,72,71,0.6)',
                color: 'var(--muted)',
                borderRadius: '0.8rem',
                padding: '0.7rem 0.75rem',
                textAlign: 'left',
                fontSize: '0.78rem'
            }}
        >
            {label}
        </button>
    );
}

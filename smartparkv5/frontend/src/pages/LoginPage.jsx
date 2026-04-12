import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { loginUser, signupUser } from '../utils/api';
import gsap from 'gsap';

export default function LoginPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isDisabled, setIsDisabled] = useState(false);
    const [isElderly, setIsElderly] = useState(false);
    const [error, setError] = useState('');

    const { login } = useAuth();
    const navigate = useNavigate();
    const formRef = useRef(null);

    useEffect(() => {
        gsap.fromTo(formRef.current,
            { y: 50, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" }
        );
    }, [isLogin]);

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
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column' }}>
            <img src="/smartparklogo-clear.png" alt="SmartPark" style={{ maxWidth: '90%', height: 'auto', marginBottom: '2rem' }} />
            <div className="card" ref={formRef} style={{ width: '350px' }}>
                <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                    {isLogin ? 'Login' : 'Sign Up'}
                </h2>

                {error && <div style={{ color: 'var(--error)', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}

                <form onSubmit={handleSubmit}>
                    <input
                        className="input-field"
                        type="text"
                        placeholder="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />
                    <input
                        className="input-field"
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />

                    {!isLogin && (
                        <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                    type="checkbox"
                                    checked={isDisabled}
                                    onChange={(e) => setIsDisabled(e.target.checked)}
                                />
                                I need Disabled Parking
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                    type="checkbox"
                                    checked={isElderly}
                                    onChange={(e) => setIsElderly(e.target.checked)}
                                />
                                I am Elderly (Senior Citizen)
                            </label>
                        </div>
                    )}

                    <button type="submit" style={{ width: '100%', marginTop: '1rem' }}>
                        {isLogin ? 'Login' : 'Create Account'}
                    </button>
                </form>

                <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem', color: '#888' }}>
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <span
                        style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}
                        onClick={() => setIsLogin(!isLogin)}
                    >
                        {isLogin ? 'Sign Up' : 'Login'}
                    </span>
                </p>

                {/* Quick login for judges */}
                {isLogin && (
                    <div style={{ marginTop: '2rem', borderTop: '1px solid #444', paddingTop: '1rem' }}>
                        <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.5rem' }}>Demo Logins:</p>
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                            <button style={{ fontSize: '0.7rem', padding: '5px' }} onClick={() => { setUsername('user1'); setPassword('password'); }}>User1 (Normal)</button>
                            <button style={{ fontSize: '0.7rem', padding: '5px' }} onClick={() => { setUsername('user2'); setPassword('password'); }}>User2 (Disabled)</button>
                            <button style={{ fontSize: '0.7rem', padding: '5px' }} onClick={() => { setUsername('user3'); setPassword('password'); }}>User3 (Elderly)</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

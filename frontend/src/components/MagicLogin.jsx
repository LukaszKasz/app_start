import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { authAPI } from '../api';

function MagicLogin() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('loading');
    const [inviteUser, setInviteUser] = useState(null);
    const [formData, setFormData] = useState({
        password: '',
        confirmPassword: '',
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [saving, setSaving] = useState(false);

    const token = searchParams.get('token');

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setError('Brak tokenu w linku aktywacyjnym.');
            return;
        }

        const validateLink = async () => {
            try {
                const response = await authAPI.validateInviteLink(token);
                setInviteUser(response);
                setStatus('ready');
            } catch (validationError) {
                setStatus('error');
                setError(validationError.response?.data?.detail || 'Link jest nieprawidłowy albo wygasł.');
            }
        };

        validateLink();
    }, [token]);

    const handleChange = (event) => {
        setFormData((current) => ({
            ...current,
            [event.target.name]: event.target.value,
        }));
        setError('');
        setSuccess('');
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setSuccess('');

        if (formData.password.length < 6) {
            setError('Hasło musi mieć co najmniej 6 znaków.');
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setError('Hasła nie są takie same.');
            return;
        }

        setSaving(true);

        try {
            await authAPI.setPassword(token, formData.password);
            setSuccess('Hasło zostało ustawione. Za chwilę przejdziesz do logowania.');
            setTimeout(() => navigate('/login', { replace: true }), 1200);
        } catch (submitError) {
            setError(submitError.response?.data?.detail || 'Nie udało się ustawić hasła.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-10">
            <div className="card max-w-md w-full">
                <div className="mb-8 space-y-3">
                    <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
                        Aktywacja konta
                    </span>
                    <h1 className="text-3xl font-bold text-slate-900">Ustaw hasło</h1>
                    <p className="text-slate-600">
                        {status === 'ready' && inviteUser
                            ? `Konto dla ${inviteUser.first_name} ${inviteUser.last_name} (${inviteUser.email}) jest gotowe do aktywacji.`
                            : 'Sprawdzam ważność linku aktywacyjnego.'}
                    </p>
                </div>

                {status === 'loading' && <p className="text-slate-600">Weryfikacja linku...</p>}

                {error && (
                    <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
                        {success}
                    </div>
                )}

                {status === 'ready' && (
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
                                Nowe hasło
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                value={formData.password}
                                onChange={handleChange}
                                className="input-field"
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-slate-700">
                                Powtórz hasło
                            </label>
                            <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                className="input-field"
                                required
                            />
                        </div>

                        <button type="submit" disabled={saving} className="btn-primary w-full">
                            {saving ? 'Zapisywanie...' : 'Ustaw hasło'}
                        </button>
                    </form>
                )}

                {status === 'error' && (
                    <Link to="/login" className="btn-secondary mt-2 inline-flex justify-center">
                        Wróć do logowania
                    </Link>
                )}
            </div>
        </div>
    );
}

export default MagicLogin;

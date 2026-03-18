import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { authAPI, tokenManager } from '../api';

function LoginForm() {
    const [formData, setFormData] = useState({
        username: 'admin',
        password: 'admin',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (event) => {
        setFormData((current) => ({
            ...current,
            [event.target.name]: event.target.value,
        }));
        setError('');
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await authAPI.login(formData.username, formData.password);
            tokenManager.setToken(response.access_token);
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.detail || 'Logowanie nie powiodło się.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-10">
            <div className="card max-w-md w-full">
                <div className="mb-8 space-y-3">
                    <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">
                        POC administracyjny
                    </span>
                    <h1 className="text-3xl font-bold text-slate-900">Panel logowania</h1>
                    <p className="text-slate-600">
                        Zaloguj się jako administrator używając danych <strong>admin / admin</strong>.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                            {error}
                        </div>
                    )}

                    <div>
                        <label htmlFor="username" className="mb-2 block text-sm font-medium text-slate-700">
                            Login
                        </label>
                        <input
                            id="username"
                            name="username"
                            type="text"
                            value={formData.username}
                            onChange={handleChange}
                            className="input-field"
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
                            Hasło
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

                    <button type="submit" disabled={loading} className="btn-primary w-full">
                        {loading ? 'Logowanie...' : 'Zaloguj'}
                    </button>
                </form>

                <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    Admin loguje się przez `admin / admin`. Użytkownik końcowy najpierw otwiera link aktywacyjny, ustawia własne hasło i dopiero potem loguje się mailem oraz hasłem.
                </div>
            </div>
        </div>
    );
}

export default LoginForm;

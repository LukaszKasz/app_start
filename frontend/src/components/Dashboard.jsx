import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { authAPI, tokenManager } from '../api';

const emptyForm = {
    email: '',
    firstName: '',
    lastName: '',
};

function Dashboard() {
    const [user, setUser] = useState(null);
    const [users, setUsers] = useState([]);
    const [formData, setFormData] = useState(emptyForm);
    const [generatedLink, setGeneratedLink] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const navigate = useNavigate();

    const loadDashboard = async () => {
        try {
            const currentUser = await authAPI.getCurrentUser();
            setUser(currentUser);

            if (currentUser.role === 'admin') {
                const fetchedUsers = await authAPI.listUsers();
                setUsers(fetchedUsers);
            }
        } catch (err) {
            tokenManager.removeToken();
            navigate('/login', { replace: true });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDashboard();
    }, []);

    const handleLogout = () => {
        tokenManager.removeToken();
        navigate('/login', { replace: true });
    };

    const handleChange = (event) => {
        setFormData((current) => ({
            ...current,
            [event.target.name]: event.target.value,
        }));
        setError('');
        setSuccess('');
    };

    const handleCreateUser = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');
        setGeneratedLink('');

        try {
            const response = await authAPI.createUser(formData);
            setGeneratedLink(response.login_link);
            setSuccess(`Użytkownik ${response.user.first_name} ${response.user.last_name} został dodany.`);
            setFormData(emptyForm);
            await loadDashboard();
        } catch (err) {
            setError(err.response?.data?.detail || 'Nie udało się utworzyć użytkownika.');
        } finally {
            setSaving(false);
        }
    };

    const handleRegenerateLink = async (userId) => {
        setError('');
        setSuccess('');
        try {
            const response = await authAPI.regenerateLoginLink(userId);
            setGeneratedLink(response.login_link);
            setSuccess(`Wygenerowano nowy link dla ${response.user.email}.`);
        } catch (err) {
            setError(err.response?.data?.detail || 'Nie udało się wygenerować nowego linku.');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-slate-600">Ładowanie panelu...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 px-4 py-10">
            <div className="mx-auto max-w-6xl space-y-6">
                <div className="card flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                        <span className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-sm font-medium text-white">
                            {user?.role === 'admin' ? 'Administrator' : 'Użytkownik'}
                        </span>
                        <h1 className="text-3xl font-bold text-slate-900">
                            {user?.first_name} {user?.last_name}
                        </h1>
                        <div className="space-y-1 text-sm text-slate-600">
                            <p>Email: {user?.email}</p>
                            <p>Login techniczny: {user?.username}</p>
                        </div>
                    </div>

                    <button onClick={handleLogout} className="btn-secondary">
                        Wyloguj
                    </button>
                </div>

                {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
                        {success}
                    </div>
                )}

                {generatedLink && (
                    <div className="card space-y-4">
                        <div>
                            <h2 className="text-xl font-semibold text-slate-900">Wygenerowany link aktywacyjny</h2>
                            <p className="text-sm text-slate-600">
                                Ten link możesz wkleić do maila lub komunikatora. Po otwarciu użytkownik ustawi własne hasło.
                            </p>
                        </div>
                        <textarea
                            readOnly
                            value={generatedLink}
                            className="input-field min-h-28 resize-y font-mono text-sm"
                        />
                    </div>
                )}

                {user?.role === 'admin' ? (
                    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                        <div className="card">
                            <div className="mb-6">
                                <h2 className="text-xl font-semibold text-slate-900">Dodaj użytkownika</h2>
                                <p className="text-sm text-slate-600">
                                    Wymagane pola: email, imię i nazwisko. Hasło nie jest potrzebne.
                                </p>
                            </div>

                            <form onSubmit={handleCreateUser} className="space-y-4">
                                <div>
                                    <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
                                        Email
                                    </label>
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        className="input-field"
                                        required
                                    />
                                </div>

                                <div>
                                    <label htmlFor="firstName" className="mb-2 block text-sm font-medium text-slate-700">
                                        Imię
                                    </label>
                                    <input
                                        id="firstName"
                                        name="firstName"
                                        type="text"
                                        value={formData.firstName}
                                        onChange={handleChange}
                                        className="input-field"
                                        required
                                    />
                                </div>

                                <div>
                                    <label htmlFor="lastName" className="mb-2 block text-sm font-medium text-slate-700">
                                        Nazwisko
                                    </label>
                                    <input
                                        id="lastName"
                                        name="lastName"
                                        type="text"
                                        value={formData.lastName}
                                        onChange={handleChange}
                                        className="input-field"
                                        required
                                    />
                                </div>

                                <button type="submit" disabled={saving} className="btn-primary w-full">
                                    {saving ? 'Zapisywanie...' : 'Dodaj użytkownika i wygeneruj link'}
                                </button>
                            </form>
                        </div>

                        <div className="card">
                            <div className="mb-6">
                                <h2 className="text-xl font-semibold text-slate-900">Użytkownicy</h2>
                                <p className="text-sm text-slate-600">Lista kont dostępnych w tym POC.</p>
                            </div>

                            <div className="space-y-3">
                                {users.map((listedUser) => (
                                    <div
                                        key={listedUser.id}
                                        className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <p className="font-semibold text-slate-900">
                                                    {listedUser.first_name} {listedUser.last_name}
                                                </p>
                                                <p className="text-sm text-slate-600">{listedUser.email}</p>
                                                <p className="text-xs uppercase tracking-wide text-slate-500">
                                                    {listedUser.role}
                                                </p>
                                            </div>
                                            {listedUser.role !== 'admin' && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRegenerateLink(listedUser.id)}
                                                    className="btn-secondary px-4 py-2 text-sm"
                                                >
                                                    Nowy link
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                        <div className="card">
                            <h2 className="text-xl font-semibold text-slate-900">Panel użytkownika</h2>
                            <p className="mt-2 text-slate-600">
                            Konto jest aktywne. W tym POC użytkownik loguje się już standardowo mailem i ustawionym wcześniej hasłem.
                            </p>
                        </div>
                )}
            </div>
        </div>
    );
}

export default Dashboard;

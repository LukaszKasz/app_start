import axios from 'axios';

const API_BASE_URL = 'http://localhost:18001';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

export const authAPI = {
    login: async (username, password) => {
        const response = await api.post('/login', { username, password });
        return response.data;
    },

    validateInviteLink: async (token) => {
        const response = await api.post('/invite-link/validate', { token });
        return response.data;
    },

    setPassword: async (token, password) => {
        const response = await api.post('/set-password', { token, password });
        return response.data;
    },

    getCurrentUser: async () => {
        const response = await api.get('/me');
        return response.data;
    },

    listUsers: async () => {
        const response = await api.get('/users');
        return response.data;
    },

    createUser: async ({ email, firstName, lastName }) => {
        const response = await api.post('/users', {
            email,
            first_name: firstName,
            last_name: lastName,
        });
        return response.data;
    },

    regenerateLoginLink: async (userId) => {
        const response = await api.post(`/users/${userId}/login-link`);
        return response.data;
    },
};

export const tokenManager = {
    setToken: (token) => {
        localStorage.setItem('token', token);
    },

    getToken: () => localStorage.getItem('token'),

    removeToken: () => {
        localStorage.removeItem('token');
    },

    isAuthenticated: () => !!localStorage.getItem('token'),
};

export default api;

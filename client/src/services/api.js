import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 60000,
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred';
    const err = new Error(message);
    err.status = error.response?.status;
    err.details = error.response?.data?.details;
    return Promise.reject(err);
  }
);

// Repositories
export const repositoriesApi = {
  create: (url) => api.post('/repositories', { url }),
  list: (params) => api.get('/repositories', { params }),
  get: (id) => api.get(`/repositories/${id}`),
  reindex: (id) => api.post(`/repositories/${id}/reindex`),
};

// Files
export const filesApi = {
  list: (repoId, params) => api.get(`/repositories/${repoId}/files`, { params }),
  get: (repoId, filePath) => api.get(`/repositories/${repoId}/files/${filePath}`),
};

// Search
export const searchApi = {
  search: (repoId, query, mode = 'hybrid', limit = 10) =>
    api.post(`/repositories/${repoId}/search`, { query, mode, limit }),
};

// Ask
export const askApi = {
  ask: (repoId, question, sessionId) =>
    api.post(`/repositories/${repoId}/ask`, { question, sessionId }),
  listSessions: (repoId) => api.get(`/repositories/${repoId}/ask/sessions`),
  getMessages: (repoId, sessionId) =>
    api.get(`/repositories/${repoId}/ask/sessions/${sessionId}/messages`),
};

// Jobs
export const jobsApi = {
  get: (jobId) => api.get(`/jobs/${jobId}`),
};

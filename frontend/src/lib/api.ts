const API_BASE_URL =
  import.meta.env.VITE_API_URL || '';

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    let errorMessage = `API error ${res.status}`;

    try {
      const errorData = await res.json();

      if (typeof errorData === 'string') {
        errorMessage = errorData;
      } else if (errorData?.detail) {
        errorMessage =
          typeof errorData.detail === 'string'
            ? errorData.detail
            : JSON.stringify(errorData.detail);
      } else if (errorData?.message) {
        errorMessage = errorData.message;
      } else {
        errorMessage = JSON.stringify(errorData);
      }
    } catch {
      const text = await res.text();
      if (text) errorMessage = text;
    }

    throw new Error(errorMessage);
  }

  return res.json();
}
export const apiClient = {
  bills: {
    list: (params?: Record<string, string>) =>
      api<import('../types').Bill[]>(`/bills?${new URLSearchParams(params).toString()}`),
    dashboard: () => api<any>('/bills/dashboard'),
    create: (data: any) => api<any>('/bills', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => api<any>(`/bills/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => api<any>(`/bills/${id}`, { method: 'DELETE' }),
  },
  budget: {
    get: () => api<any>('/budget'),
    update: (code: string, data: any) => api<any>(`/budget/${code}`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  transfers: {
    stats: () => api<any>('/transfers'),
    records: () => api<import('../types').Transfer[]>('/transfers/records'),
    create: (data: any) => api<any>('/transfers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => api<any>(`/transfers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => api<any>(`/transfers/${id}`, { method: 'DELETE' }),
  },
  districts: {
    stats: () => api<any>('/districts'),
    records: () => api<import('../types').District[]>('/districts/records'),
    update: (id: string, data: any) => api<any>(`/districts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },
};

const API_BASE_URL =
  import.meta.env.VITE_API_URL || '';

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const deviceId = localStorage.getItem('mitra-device-id');
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(deviceId ? { 'X-Device-ID': deviceId } : {}),
      ...options?.headers,
    },
    credentials: 'include',
    ...options,
  });

  if (!res.ok) {
    let errorMessage = `API error ${res.status}`;
    const responseBody = await res.text();
    if (responseBody) {
      let errorData: any = responseBody;
      try {
        errorData = JSON.parse(responseBody);
      } catch {
        errorMessage = responseBody;
      }

      if (typeof errorData === 'string') {
        errorMessage = errorData;
      } else if (errorData?.detail) {
        errorMessage =
          typeof errorData.detail === 'string'
            ? errorData.detail
            : JSON.stringify(errorData.detail);
      } else if (errorData?.message) {
        errorMessage = errorData.message;
      } else if (typeof errorData === 'object' && errorData !== null) {
        errorMessage = JSON.stringify(errorData);
      }
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
    get: (fiscalYear: string) => api<any>(`/budget?${new URLSearchParams({ fiscalYear })}`),
    update: (fiscalYear: string, code: string, data: any) => api<any>(`/budget/${encodeURIComponent(fiscalYear)}/${code}`, { method: 'PUT', body: JSON.stringify(data) }),
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
    create: (data: Omit<import('../types').District, 'id'>) => api<import('../types').District>('/districts', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => api<any>(`/districts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  users: {
    list: () => api<import('../types').UserProfile[]>('/users'),
    registerDevice: (deviceId: string, userAgent: string) =>
      api<{ user: import('../types').UserProfile | null; accessEnabled: boolean }>('/users/device', {
        method: 'POST',
        body: JSON.stringify({ deviceId, userAgent }),
      }),
    claimDevice: (deviceId: string, name: string) =>
      api<import('../types').UserProfile>('/users/claim', {
        method: 'POST',
        body: JSON.stringify({ deviceId, name }),
      }),
    update: (id: string, data: Pick<import('../types').UserProfile, 'name' | 'programs' | 'districts'>) =>
      api<import('../types').UserProfile>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    dashboard: (id: string) =>
      api<any>(`/users/dashboard/${encodeURIComponent(id)}`),
  },
  search: (query: string) =>
    api<import('../types').GlobalSearchResult[]>(`/search?${new URLSearchParams({ q: query })}`),
};

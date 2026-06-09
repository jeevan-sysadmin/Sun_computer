const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

export const API_BASE_URL = (rawApiBaseUrl && rawApiBaseUrl.length > 0
  ? rawApiBaseUrl
  : "http://localhost/sun_computers/api"
).replace(/\/+$/, "");

export const buildApiUrl = (endpoint: string) => {
  const normalizedEndpoint = endpoint.replace(/^\/+/, "");
  return `${API_BASE_URL}/${normalizedEndpoint}`;
};

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const defaultApiUrl = "http://localhost:3001";
const apiUrl = stripTrailingSlash(
  import.meta.env.VITE_API_URL?.trim() || defaultApiUrl,
);

export const env = {
  apiUrl,
  wsUrl: import.meta.env.VITE_WS_URL?.trim() || "",
};

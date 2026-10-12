let csrfToken = "";

export const setCsrfToken = (token = "") => {
  csrfToken = token;
};

export const getCsrfToken = () => csrfToken;

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (csrfToken && !["GET", "HEAD"].includes((options.method || "GET").toUpperCase())) {
    headers.set("X-CSRF-Token", csrfToken);
  }
  const response = await fetch(path, {
    ...options,
    headers,
    credentials: "same-origin",
  });
  const contentType = response.headers.get("content-type") || "";
  const result = contentType.includes("application/json") ? await response.json() : null;
  if (response.ok && !result) throw new Error("Respons API tidak valid. Pastikan server Express sedang berjalan.");
  if (!response.ok) {
    if (response.status === 401) {
      setCsrfToken("");
      if (location.pathname.startsWith("/admin") && location.pathname !== "/admin") {
        location.assign("/admin");
      }
    }
    throw new Error(result?.error || `Permintaan gagal (${response.status}).`);
  }
  return result;
}

export async function initializeAdminSession() {
  const session = await api("/api/admin/session");
  setCsrfToken(session.csrfToken);
  return session;
}

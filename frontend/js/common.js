// Shared helpers loaded before the page scripts.

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

// Call when the API answers 401 (expired token, deactivated account...).
// Clears the stale login and sends the person back to sign in.
function handleExpiredSession(loginPage = "login.html") {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    alert("Your session has expired. Please sign in again.");
    window.location.href = loginPage;
}

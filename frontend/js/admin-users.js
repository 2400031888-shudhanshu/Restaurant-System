const accountList = document.getElementById("accountList");
const accountSearch = document.getElementById("accountSearch");
const roleFilter = document.getElementById("roleFilter");
const statusFilter = document.getElementById("statusFilter");
const accountToken = localStorage.getItem("token");
const accountUser = JSON.parse(localStorage.getItem("user") || "null");
let accounts = [];

if (!accountToken) {
    window.location.replace("admin-login.html");
} else if (accountUser?.role !== "ADMIN") {
    window.location.replace("admin.html");
} else {
    loadAccounts();
}

accountSearch.addEventListener("input", renderAccounts);
roleFilter.addEventListener("change", renderAccounts);
statusFilter.addEventListener("change", renderAccounts);

async function loadAccounts() {
    try {
        const response = await fetch("/api/admin/users", {
            headers: {
                "Authorization": `Bearer ${accountToken}`
            }
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Unable to load accounts.");
        }

        accounts = data;
        document.getElementById("totalAccounts").textContent = accounts.length;
        document.getElementById("activeAccounts").textContent = accounts.filter(account => Number(account.is_active) === 1).length;
        document.getElementById("staffAccounts").textContent = accounts.filter(account => ["STAFF", "DELIVERY"].includes(account.role)).length;
        renderAccounts();
    } catch (error) {
        console.error(error);
        accountList.replaceChildren();
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 8;
        cell.textContent = error.message;
        row.appendChild(cell);
        accountList.appendChild(row);
    }
}

function renderAccounts() {
    const query = accountSearch.value.trim().toLowerCase();
    const selectedRole = roleFilter.value;
    const selectedStatus = statusFilter.value;
    const visibleAccounts = accounts.filter(account => {
        const matchesSearch = [account.name, account.email, account.phone || ""]
            .some(value => value.toLowerCase().includes(query));
        const matchesRole = selectedRole === "ALL" || account.role === selectedRole;
        const active = Number(account.is_active) === 1;
        const matchesStatus = selectedStatus === "ALL" ||
            (selectedStatus === "ACTIVE" && active) ||
            (selectedStatus === "INACTIVE" && !active);
        return matchesSearch && matchesRole && matchesStatus;
    });

    accountList.replaceChildren();
    if (visibleAccounts.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 8;
        cell.textContent = "No matching accounts.";
        row.appendChild(cell);
        accountList.appendChild(row);
        return;
    }

    visibleAccounts.forEach(account => {
        const row = document.createElement("tr");
        appendCell(row, account.name);
        appendCell(row, account.email);
        appendCell(row, account.phone || "—");

        const roleCell = document.createElement("td");
        const roleBadge = document.createElement("span");
        roleBadge.className = "account-role";
        roleBadge.textContent = account.role;
        roleCell.appendChild(roleBadge);
        row.appendChild(roleCell);

        const statusCell = document.createElement("td");
        const statusBadge = document.createElement("span");
        const active = Number(account.is_active) === 1;
        statusBadge.className = `account-state${active ? "" : " account-state-inactive"}`;
        statusBadge.textContent = active ? "Active" : "Inactive";
        statusCell.appendChild(statusBadge);
        row.appendChild(statusCell);

        appendCell(row, formatDate(account.created_at));
        appendCell(row, formatDate(account.last_login_at));

        const accessCell = document.createElement("td");
        const accessButton = document.createElement("button");
        const isActive = Number(account.is_active) === 1;
        const isCurrentAdmin = Number(account.user_id) === Number(accountUser?.user_id);
        accessButton.type = "button";
        accessButton.className = isActive ? "staff-remove-button" : "";
        accessButton.textContent = isActive ? "Deactivate" : "Activate";
        accessButton.disabled = isActive && isCurrentAdmin;
        accessButton.title = accessButton.disabled
            ? "You cannot deactivate your own account"
            : `${isActive ? "Deactivate" : "Activate"} this account`;
        accessButton.addEventListener("click", () => changeAccountAccess(account, !isActive));
        accessCell.appendChild(accessButton);
        row.appendChild(accessCell);
        accountList.appendChild(row);
    });
}

async function changeAccountAccess(account, isActive) {
    const action = isActive ? "activate" : "deactivate";
    if (!window.confirm(`Are you sure you want to ${action} ${account.name}'s account?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/users/${account.user_id}/access`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accountToken}`
            },
            body: JSON.stringify({ is_active: isActive })
        });
        const data = await response.json();

        if (!response.ok) {
            window.alert(data.message || "Unable to update account access.");
            return;
        }

        await loadAccounts();
    } catch (error) {
        console.error(error);
        window.alert("Unable to connect to the server.");
    }
}

function appendCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = value;
    row.appendChild(cell);
}

function formatDate(value) {
    if (!value) {
        return "Never";
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}
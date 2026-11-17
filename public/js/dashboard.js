
// =====================================
// GLOBAL ELEMENTS AND VARIABLES
// =====================================

const usernameElement = document.getElementById("username");
const roleElement = document.getElementById("userRole");
const logoutButton = document.getElementById("logoutButton");

const userManagementLink = document.getElementById("userManagementLink");
const userManagementSection = document.getElementById("userManagementSection");

const createStaffForm = document.getElementById("createStaffForm");
const staffMessage = document.getElementById("staffMessage");
const createStaffButton = document.getElementById("createStaffButton");
const usersTableBody = document.getElementById("usersTableBody");

const categoriesLink = document.getElementById("categoriesLink");
const categoriesSection = document.getElementById("categoriesSection");
const categoryForm = document.getElementById("categoryForm");

const productsLink = document.getElementById("productsLink");
const productsSection = document.getElementById("productsSection");
const productForm = document.getElementById("productForm");

let currentUser = null;
let allProducts = [];
let allCategories = [];


// =====================================
// COMMON HELPERS
// =====================================

function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
}

async function fetchJSON(url, options = {}) {
    const response = await fetch(url, options);

    let data;

    try {
        data = await response.json();
    } catch {
        throw new Error("Invalid server response.");
    }

    if (!response.ok) {
        throw new Error(data.message || "Request failed.");
    }

    return data;
}

function isAdmin() {
    return currentUser?.role === "admin";
}


// =====================================
// LOGIN AND USER ROLE
// =====================================

async function checkLogin() {
    try {
        const data = await fetchJSON("/api/auth/me");

        if (!data.success || !data.user) {
            window.location.replace("/");
            return false;
        }

        currentUser = data.user;

        if (usernameElement) {
            usernameElement.textContent = currentUser.username;
        }

        if (roleElement) {
            roleElement.textContent = currentUser.role.toUpperCase();
        }

        // Admin-only navigation
        const adminOnlyElements = [
            categoriesLink,
            categoriesSection,
            userManagementLink,
            userManagementSection
        ];

        adminOnlyElements.forEach(element => {
            if (element) {
                element.style.display = isAdmin() ? "" : "none";
            }
        });

        // Product Add is available to both roles
        if (productForm) {
            productForm.style.display = "";
        }

        // Load users only for admin
        if (isAdmin()) {
            await loadUsers();
        }

        return true;

    } catch (error) {
        console.error("Login check failed:", error);
        window.location.replace("/");
        return false;
    }
}


// =====================================
// USER MANAGEMENT - ADMIN ONLY
// =====================================

async function loadUsers() {
    if (!isAdmin() || !usersTableBody) return;

    try {
        const data = await fetchJSON("/api/users");

        usersTableBody.innerHTML = "";

        if (!data.users || data.users.length === 0) {
            usersTableBody.innerHTML = `
                <tr>
                    <td colspan="4">No users found.</td>
                </tr>
            `;
            return;
        }

        data.users.forEach(user => {
            const row = document.createElement("tr");

            const usernameCell = document.createElement("td");
            usernameCell.textContent = user.username;

            const roleCell = document.createElement("td");
            roleCell.textContent = user.role;

            const statusCell = document.createElement("td");
            statusCell.textContent = user.is_active ? "Active" : "Inactive";

            const actionCell = document.createElement("td");

            if (user.role === "staff") {
                const button = document.createElement("button");

                button.textContent = user.is_active
                    ? "Deactivate"
                    : "Activate";

                button.addEventListener("click", () => {
                    updateUserStatus(user.id, !user.is_active);
                });

                actionCell.appendChild(button);
            } else {
                actionCell.textContent = "Admin account";
            }

            [usernameCell, roleCell, statusCell, actionCell].forEach(cell => {
                cell.style.padding = "12px";
                cell.style.borderBottom = "1px solid #e2e8f0";
                row.appendChild(cell);
            });

            usersTableBody.appendChild(row);
        });

    } catch (error) {
        usersTableBody.innerHTML = `
            <tr>
                <td colspan="4">${escapeHTML(error.message)}</td>
            </tr>
        `;
    }
}


if (createStaffForm) {
    createStaffForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        if (!isAdmin()) return;

        const username =
            document.getElementById("staffUsername").value.trim();

        const password =
            document.getElementById("staffPassword").value;

        if (staffMessage) staffMessage.textContent = "";

        if (createStaffButton) {
            createStaffButton.disabled = true;
            createStaffButton.textContent = "Creating...";
        }

        try {
            await fetchJSON("/api/users", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ username, password })
            });

            if (staffMessage) {
                staffMessage.style.color = "#15803d";
                staffMessage.textContent =
                    "Staff account created successfully!";
            }

            createStaffForm.reset();

            await loadUsers();

        } catch (error) {
            if (staffMessage) {
                staffMessage.style.color = "#dc2626";
                staffMessage.textContent = error.message;
            }

        } finally {
            if (createStaffButton) {
                createStaffButton.disabled = false;
                createStaffButton.textContent = "Create Staff Account";
            }
        }
    });
}


async function updateUserStatus(userId, isActive) {
    if (!isAdmin()) return;

    const action = isActive ? "activate" : "deactivate";

    if (!confirm(`Are you sure you want to ${action} this staff account?`)) {
        return;
    }

    try {
        await fetchJSON(`/api/users/${userId}/status`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ is_active: isActive })
        });

        await loadUsers();

    } catch (error) {
        alert(error.message);
    }
}


if (userManagementLink && userManagementSection) {
    userManagementLink.addEventListener("click", function (event) {
        event.preventDefault();

        if (!isAdmin()) return;

        userManagementSection.scrollIntoView({
            behavior: "smooth"
        });
    });
}


// =====================================
// LOGOUT
// =====================================

if (logoutButton) {
    logoutButton.addEventListener("click", async function () {
        logoutButton.disabled = true;
        logoutButton.textContent = "Logging out...";

        try {
            await fetchJSON("/api/auth/logout", {
                method: "POST"
            });

            window.location.replace("/");

        } catch (error) {
            alert(error.message);

            logoutButton.disabled = false;
            logoutButton.textContent = "Logout";
        }
    });
}


// =====================================
// CATEGORY MANAGEMENT - ADMIN ONLY
// =====================================

if (categoriesLink && categoriesSection) {
    categoriesLink.addEventListener("click", async function (event) {
        event.preventDefault();

        if (!isAdmin()) return;

        categoriesSection.scrollIntoView({
            behavior: "smooth"
        });

        await loadCategories();
    });
}


async function loadCategories() {
    const container = document.getElementById("categoriesList");

    if (!container) return;

    try {
        const data = await fetchJSON("/api/categories");

        allCategories = Array.isArray(data.categories)
            ? data.categories
            : [];

        if (allCategories.length === 0) {
            container.innerHTML = "<p>No categories added yet.</p>";
        } else {
            container.innerHTML = allCategories.map(category => `
                <div style="padding:15px; border-bottom:1px solid #ddd;">
                    <strong>${escapeHTML(category.name)}</strong>
                </div>
            `).join("");
        }

        populateProductCategories();

    } catch (error) {
        container.textContent = error.message;
    }
}


if (categoryForm) {
    categoryForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        if (!isAdmin()) return;

        const name =
            document.getElementById("categoryName").value.trim();

        const message =
            document.getElementById("categoryMessage");

        if (!name) return;

        try {
            await fetchJSON("/api/categories", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ name })
            });

            if (message) {
                message.textContent = "Category added successfully!";
                message.style.color = "green";
            }

            categoryForm.reset();

            await loadCategories();
            await loadProductData();

        } catch (error) {
            if (message) {
                message.textContent = error.message;
                message.style.color = "red";
            }
        }
    });
}


// =====================================
// PRODUCT MANAGEMENT
// =====================================

if (productsLink && productsSection) {
    productsLink.addEventListener("click", async function (event) {
        event.preventDefault();

        productsSection.scrollIntoView({
            behavior: "smooth"
        });

        await loadProductData();
    });
}


// LOAD CATEGORIES AND PRODUCTS

async function loadProductData() {
    const tbody = document.getElementById("productsTableBody");

    try {
        if (tbody) {
            tbody.innerHTML =
                '<tr><td colspan="7">Loading products...</td></tr>';
        }

        const [categoryData, productData] = await Promise.all([
            fetchJSON("/api/categories"),
            fetchJSON("/api/products")
        ]);

        allCategories = Array.isArray(categoryData.categories)
            ? categoryData.categories
            : [];
        const categoryStat = document.getElementById("totalCategoriesStat");
        if (categoryStat) categoryStat.textContent = allCategories.length.toLocaleString();

        allProducts = Array.isArray(productData.products)
            ? productData.products
            : [];
        populateMovementProducts();

        populateProductCategories();
        renderProducts();

    } catch (error) {
        console.error("Product loading error:", error);

        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6">${escapeHTML(error.message)}</td>
                </tr>
            `;
        }
    }
}


// POPULATE CATEGORY DROPDOWNS

function populateProductCategories() {
    const categorySelect =
        document.getElementById("productCategory");

    const filterSelect =
        document.getElementById("stockCategoryFilter");

    if (!categorySelect || !filterSelect) return;

    const selectedCategory = categorySelect.value;
    const selectedFilter = filterSelect.value;

    categorySelect.innerHTML =
        '<option value="">Select Category</option>';

    filterSelect.innerHTML =
        '<option value="">All Categories</option>';

    allCategories.forEach(category => {
        categorySelect.add(
            new Option(category.name, category.id)
        );

        filterSelect.add(
            new Option(category.name, category.id)
        );
    });

    if (allCategories.some(c => String(c.id) === selectedCategory)) {
        categorySelect.value = selectedCategory;
    }

    if (allCategories.some(c => String(c.id) === selectedFilter)) {
        filterSelect.value = selectedFilter;
    }
}


// SUBCATEGORY DROPDOWN

const productCategorySelect =
    document.getElementById("productCategory");

if (productCategorySelect) {
    productCategorySelect.addEventListener("change", function () {
        const subcategorySelect =
            document.getElementById("productSubcategory");

        if (!subcategorySelect) return;

        const category = allCategories.find(
            item => String(item.id) === String(this.value)
        );

        subcategorySelect.innerHTML =
            '<option value="">Select Subcategory (Optional)</option>';

        if (category && Array.isArray(category.subcategories)) {
            category.subcategories.forEach(subcategory => {
                subcategorySelect.add(
                    new Option(subcategory.name, subcategory.id)
                );
            });
        }
    });
}


// ADD PRODUCT - ADMIN AND STAFF

if (productForm) {
    productForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        if (!currentUser) return;

        const message =
            document.getElementById("productMessage");

        const button =
            document.getElementById("saveProductButton");

        const payload = {
            name: document.getElementById("productName").value.trim(),
            category_id: document.getElementById("productCategory").value,
            subcategory_id:
                document.getElementById("productSubcategory").value || null,
            base_unit: document.getElementById("productUnit").value,
            opening_stock: document.getElementById("openingStock").value,
            minimum_stock: document.getElementById("minimumStock").value,
            purchase_price: document.getElementById("purchasePrice").value,
            selling_price: document.getElementById("sellingPrice").value
        };

        if (button) {
            button.disabled = true;
            button.textContent = "Saving...";
        }

        try {
            await fetchJSON("/api/products", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (message) {
                message.textContent = "Product added successfully!";
                message.style.color = "green";
            }

            productForm.reset();

            const subcategorySelect =
                document.getElementById("productSubcategory");

            if (subcategorySelect) {
                subcategorySelect.innerHTML =
                    '<option value="">Select Subcategory</option>';
            }

            await loadProductData();

        } catch (error) {
            if (message) {
                message.textContent = error.message;
                message.style.color = "red";
            }

        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = "Add Product";
            }
        }
    });
}


// =====================================
// DISPLAY AND FILTER PRODUCTS
// =====================================

function renderProducts() {
    const tbody =
        document.getElementById("productsTableBody");

    if (!tbody) return;

    const search =
        document.getElementById("productSearch")?.value
            .toLowerCase() || "";

    const categoryFilter =
        document.getElementById("stockCategoryFilter")?.value || "";

    const filtered = allProducts.filter(product => {
        const matchesSearch =
            String(product.name).toLowerCase().includes(search);

        const matchesCategory =
            !categoryFilter ||
            String(product.category_id) === String(categoryFilter);

        return matchesSearch && matchesCategory;
    });

    if (filtered.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="7">No products found.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(product => `
        <tr>
            <td>${escapeHTML(product.name)}</td>
            <td>${escapeHTML(product.category_name || "-")}</td>
            <td>${escapeHTML(product.subcategory_name || "-")}</td>
            <td>${escapeHTML(product.base_unit)}</td>
            <td>${Number(product.current_stock).toFixed(3)}</td>
            <td>${Number(product.minimum_stock).toFixed(3)}</td>
            <td>${isAdmin() ? `<button type="button" class="delete-product-button" data-product-id="${Number(product.id)}">Delete</button>` : '<span class="muted-action">—</span>'}</td>
        </tr>
    `).join("");
}


document.getElementById("productsTableBody")?.addEventListener("click", async event => {
    const button = event.target.closest("[data-product-id]");
    if (!button || !isAdmin()) return;
    const product = allProducts.find(item => String(item.id) === button.dataset.productId);
    if (!product || !confirm(`Remove ${product.name} from the active inventory? Historical transactions will remain.`)) return;
    button.disabled = true;
    try {
        await fetchJSON(`/api/products/${button.dataset.productId}`, { method: "DELETE" });
        await loadProductData();
        await loadDashboardSummary();
    } catch (error) { alert(error.message); button.disabled = false; }
});

const productSearch =
    document.getElementById("productSearch");

if (productSearch) {
    productSearch.addEventListener("input", renderProducts);
}


const stockCategoryFilter =
    document.getElementById("stockCategoryFilter");

if (stockCategoryFilter) {
    stockCategoryFilter.addEventListener("change", renderProducts);
}


// =====================================
// PRINT STOCK REPORT
// =====================================

function printStockReport(products, title) {
    const rows = products.map((product, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${escapeHTML(product.name)}</td>
            <td>${escapeHTML(product.category_name || "-")}</td>
            <td>${escapeHTML(product.base_unit)}</td>
            <td>${Number(product.current_stock).toFixed(3)}</td>
        </tr>
    `).join("");

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
        alert("Please allow pop-ups to print the stock report.");
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${escapeHTML(title)}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 25px;
                }

                h2, p {
                    text-align: center;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 25px;
                }

                th, td {
                    border: 1px solid #555;
                    padding: 9px;
                    text-align: left;
                }

                th {
                    background: #eee;
                }

                .date {
                    text-align: right;
                    font-size: 12px;
                }
            </style>
        </head>
        <body>
            <h2>STOCK REPORT</h2>
            <p>${escapeHTML(title)}</p>
            <p class="date">
                Generated: ${new Date().toLocaleString()}
            </p>

            <table>
                <thead>
                    <tr>
                        <th>SN</th>
                        <th>Product</th>
                        <th>Category</th>
                        <th>Unit</th>
                        <th>Current Stock</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>

            <p>Total Products: ${products.length}</p>

            <script>
                window.onload = function () {
                    window.print();
                };
            </script>
        </body>
        </html>
    `);

    printWindow.document.close();
}


const printAllStockButton =
    document.getElementById("printAllStockButton");

if (printAllStockButton) {
    printAllStockButton.addEventListener("click", function () {
        printStockReport(allProducts, "All Stock");
    });
}


const printFilteredStockButton =
    document.getElementById("printFilteredStockButton");

if (printFilteredStockButton) {
    printFilteredStockButton.addEventListener("click", function () {
        const categoryId =
            document.getElementById("stockCategoryFilter")?.value || "";

        const filtered = categoryId
            ? allProducts.filter(
                product => String(product.category_id) === String(categoryId)
            )
            : allProducts;

        printStockReport(filtered, "Category-wise Stock");
    });
}




// STOCK MOVEMENTS + LIVE DASHBOARD TOTALS
async function loadDashboardSummary() {
    try {
        const data = await fetchJSON('/api/products/summary/today');
        const summary = data.summary || {};
        const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = Number(value || 0).toLocaleString(); };
        set('totalProductsStat', summary.total_products);
        set('lowStockStat', summary.low_stock);
        set('soldTodayStat', summary.sold_today);
        set('purchasedTodayStat', summary.purchased_today);
        set('transactionsTodayStat', summary.transactions_today);
    } catch (error) { console.error('Dashboard summary:', error); }
}

function populateMovementProducts() {
    const select = document.getElementById('movementProduct');
    if (!select) return;
    const selected = select.value;
    select.innerHTML = '<option value="">Select a product</option>' + allProducts.map(p =>
        `<option value="${Number(p.id)}">${escapeHTML(p.name)} — ${Number(p.current_stock).toLocaleString()} ${escapeHTML(p.base_unit)} available</option>`
    ).join('');
    if (selected) select.value = selected;
}

async function loadRecentTransactions() {
    const tbody = document.getElementById('recentTransactionsBody');
    if (!tbody) return;
    try {
        const data = await fetchJSON('/api/products/transactions/recent');
        if (!data.transactions.length) { tbody.innerHTML = '<tr><td colspan="5">No stock activity recorded yet.</td></tr>'; return; }
        tbody.innerHTML = data.transactions.map(tx => {
            const date = new Date(tx.created_at).toLocaleString();
            const incoming = tx.transaction_type === 'IN';
            return `<tr><td><strong>${escapeHTML(tx.product_name)}</strong><small>${escapeHTML(tx.notes || '')}</small></td><td><span class="movement-pill ${incoming ? 'in' : 'out'}">${incoming ? 'Purchase' : 'Sale'}</span></td><td>${incoming ? '+' : '−'}${Number(tx.base_quantity).toLocaleString()} ${escapeHTML(tx.unit)}</td><td>${escapeHTML(tx.username || 'System')}</td><td>${escapeHTML(date)}</td></tr>`;
        }).join('');
    } catch (error) { tbody.innerHTML = `<tr><td colspan="5">${escapeHTML(error.message)}</td></tr>`; }
}

const movementForm = document.getElementById('stockMovementForm');
if (movementForm) movementForm.addEventListener('submit', async event => {
    event.preventDefault();
    const productId = document.getElementById('movementProduct').value;
    const type = document.getElementById('movementType').value;
    const quantity = Number(document.getElementById('movementQuantity').value);
    const message = document.getElementById('movementMessage');
    const button = document.getElementById('movementSubmit');
    message.textContent = '';
    button.disabled = true; button.textContent = 'Saving…';
    try {
        const data = await fetchJSON(`/api/products/${encodeURIComponent(productId)}/transactions`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, quantity, notes: document.getElementById('movementNotes').value })
        });
        message.className = 'message movement-message success';
        message.textContent = `${data.message} Current stock: ${Number(data.current_stock).toLocaleString()}.`;
        movementForm.reset();
        await loadProductData();
        populateMovementProducts();
        await Promise.all([loadDashboardSummary(), loadRecentTransactions()]);
    } catch (error) {
        message.className = 'message movement-message error'; message.textContent = error.message;
    } finally { button.disabled = false; button.textContent = 'Record movement'; }
});

document.getElementById('refreshActivity')?.addEventListener('click', loadRecentTransactions);
document.getElementById('stockMovementLink')?.addEventListener('click', e => { e.preventDefault(); document.getElementById('stockMovementSection')?.scrollIntoView({ behavior: 'smooth' }); });
document.getElementById('activityLink')?.addEventListener('click', e => { e.preventDefault(); document.getElementById('dailyActivitySection')?.scrollIntoView({ behavior: 'smooth' }); });


// =====================================
// INITIALIZE DASHBOARD
// =====================================

async function initializeDashboard() {
    const loggedIn = await checkLogin();

    if (!loggedIn) return;

    // Categories are loaded for product dropdowns too
    await loadCategories();
    await loadProductData();
    populateMovementProducts();
    await Promise.all([loadDashboardSummary(), loadRecentTransactions()]);
}

initializeDashboard();

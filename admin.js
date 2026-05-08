window.addEventListener('error', function (e) { alert("Admin JS Error: " + e.message); });

// --- Admin Panel Logic ---

// Supabase Configuration
const SUPABASE_URL = 'https://wlmhpwamorpbyjtnfcfl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsbWhwd2Ftb3JwYnlqdG5mY2ZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NjQzOTAsImV4cCI6MjA4ODQ0MDM5MH0.zNNXs29mO00h-cvhceoAXbzZLwlNU5jL8oQSUQTEqAA';

// Initialize Supabase Client (safe check)
let supabaseClient;
let ADMIN_PASSCODE = 'Vijay@2025'; // Fallback passcode

try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("Supabase client initialized.");
} catch (e) {
    console.error("Failed to initialize Supabase:", e);
}

// State
let menuData = [];
let offersData = [];
let promoData = [];
let ordersData = [];
let currentSettings = null; // Move this up

// DOM Elements - will be populated after DOM loads
let loginOverlay, dashboardWrapper, loginForm, passcodeInp, loginError, logoutBtn;
let navBtns, mgmtSections;
let settingsForm;
let menuTableBody, addMenuBtn, menuModal, menuForm;
let offersTableBody, addOfferBtn, offerModal, offerForm;
let promoTableBody, addPromoBtn, promoModal, promoForm;
let ordersTableBody;

// --- Function to notify clients of updates ---
function notifyClientsRefresh(settingsData = null) {
    try {
        localStorage.setItem('site_update', Date.now().toString());

        if (supabaseClient) {
            const channel = supabaseClient.channel('system-updates');
            channel.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    channel.send({
                        type: 'broadcast',
                        event: 'site_update',
                        payload: {
                            timestamp: Date.now(),
                            settings: settingsData
                        }
                    });
                    setTimeout(() => supabaseClient.removeChannel(channel), 1000);
                }
            });
        }

        if (!settingsData) {
            showAdminToast('Changes saved. All live devices will refresh automatically...', 'success');
        }
    } catch (err) {
        console.error("Error notifying clients:", err);
    }
}

// --- Initialize DOM elements and event listeners after DOM loads ---
document.addEventListener('DOMContentLoaded', function () {
    // Get DOM Elements
    loginOverlay = document.getElementById('login-overlay');
    dashboardWrapper = document.getElementById('dashboard-wrapper');
    loginForm = document.getElementById('login-form');
    passcodeInp = document.getElementById('admin-passcode');
    loginError = document.getElementById('login-error');
    logoutBtn = document.getElementById('logout-btn');
    navBtns = document.querySelectorAll('.nav-btn[data-target]');
    mgmtSections = document.querySelectorAll('.mgmt-section');
    settingsForm = document.getElementById('settings-form');
    menuTableBody = document.getElementById('menu-table-body');
    addMenuBtn = document.getElementById('add-menu-btn');
    menuModal = document.getElementById('menu-modal');
    menuForm = document.getElementById('menu-form');
    offersTableBody = document.getElementById('offers-table-body');
    addOfferBtn = document.getElementById('add-offer-btn');
    offerModal = document.getElementById('offer-modal');
    offerForm = document.getElementById('offer-form');
    promoTableBody = document.getElementById('promo-table-body');
    addPromoBtn = document.getElementById('add-promo-btn');
    promoModal = document.getElementById('promo-modal');
    promoForm = document.getElementById('promo-form');
    ordersTableBody = document.getElementById('orders-table-body');

    // Setup navigation
    setupNavigation();

    // Setup modal close buttons
    setupModals();

    // Setup settings form
    setupSettingsForm();

    // Setup menu form
    setupMenuForm();

    // Setup offer form
    setupOfferForm();

    // Setup promo form
    setupPromoForm();

    const offlineToggle = document.getElementById('setting-offline');
    if (offlineToggle) {
        offlineToggle.addEventListener('change', async (e) => {
            const isOffline = !e.target.checked;
            updateShopStatusLabel(isOffline);

            // Proactive save for toggle
            if (currentSettings) {
                currentSettings.is_offline = isOffline;
                try {
                    const { error } = await supabaseClient.from('settings').upsert({ id: 'site_config', value: currentSettings });
                    if (error) throw error;
                    notifyClientsRefresh(currentSettings);
                    showAdminToast(`Shop is now ${isOffline ? 'OFFLINE' : 'ONLINE'}. Refreshing dashboard...`, 'info');

                    // User requested refresh behavior for toggle updates
                    setTimeout(() => window.location.reload(), 1500);
                } catch (err) {
                    console.error("Error saving toggle status:", err);
                    showAdminToast('Failed to sync status', 'error');
                }
            }
        });
    }

    // Fetch Admin Passcode from Database
    if (supabaseClient) {
        supabaseClient.from('settings').select('value').eq('id', 'admin_auth').single().then(({ data, error }) => {
            if (data && data.value && data.value.passcode) {
                ADMIN_PASSCODE = data.value.passcode;
            }
        }).catch(err => console.error("Error fetching admin auth:", err));
    }

    // Setup Logout Button Correctly Inside DOM Load
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            try { localStorage.removeItem('admin_auth'); } catch (err) { }
            dashboardWrapper.classList.add('d-none');
            loginOverlay.classList.remove('d-none');
            passcodeInp.value = '';
        });
    }

    // Check login status
    checkLoginStatus();
});

// --- Check login status ---
function checkLoginStatus() {
    try {
        if (localStorage.getItem('admin_auth') === 'true') {
            loginOverlay.classList.add('d-none');
            dashboardWrapper.classList.remove('d-none');
            initDashboard();
        }
    } catch (e) {
        console.warn("Storage restricted", e);
    }
}

// --- Login handler ---
window.handleAdminLogin = function (e) {
    if (e) e.preventDefault();
    const enteredPasscode = passcodeInp.value.trim();
    console.log("Login attempt with:", enteredPasscode);

    if (enteredPasscode === ADMIN_PASSCODE) {
        try { localStorage.setItem('admin_auth', 'true'); } catch (err) { }
        loginOverlay.classList.add('d-none');
        dashboardWrapper.classList.remove('d-none');
        loginError.classList.add('d-none');
        initDashboard();
        console.log("Login success.");
    } else {
        loginError.classList.remove('d-none');
        console.log("Login failed: Incorrect passcode.");
    }
    return false;
};

// --- Setup navigation ---
function setupNavigation() {
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            navBtns.forEach(b => b.classList.remove('active'));
            mgmtSections.forEach(s => s.classList.remove('active'));

            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
        });
    });
}

// --- Setup modals ---
function setupModals() {
    document.querySelectorAll('.close-modal, .close-modal-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (menuModal) menuModal.classList.add('d-none');
            if (offerModal) offerModal.classList.add('d-none');
            if (promoModal) promoModal.classList.add('d-none');
        });
    });
}

// --- Toast Notifications ---
function showAdminToast(message, type = 'success') {
    const container = document.getElementById('admin-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-xmark';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;

    container.appendChild(toast);

    // Trigger reflow
    toast.offsetHeight;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- Initialize Dashboard ---
async function initDashboard() {
    await fetchSettings();
    await fetchMenuItems();
    await fetchOffers();
    await fetchPromos();
    await fetchOrders();
    setupRealtimeOrders();
    updateSalesDashboard(); // Also initialize sales dashboard
}

// --- Realtime Order Notifications ---
function setupRealtimeOrders() {
    if (!supabaseClient) return;

    console.log("Setting up realtime order notifications...");

    // Create a new channel with a unique name
    const channel = supabaseClient.channel('admin-order-monitor');

    channel
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'orders' },
            (payload) => {
                console.log('Realtime Notification: New Order Received!', payload);
                const orderNotif = document.getElementById('order-notification');
                const notifText = document.getElementById('order-notif-text');

                if (orderNotif && notifText) {
                    const order = payload.new;
                    notifText.textContent = `Order ${order.order_id} via ${order.table_number || (order.phone_number ? 'Phone' : 'Unknown')}`;

                    // Play sound
                    const soundFx = document.getElementById('new-order-sound');
                    if (soundFx) {
                        soundFx.currentTime = 0; // Reset to start
                        soundFx.play().catch(e => console.warn('Audio auto-play blocked by browser. User interaction required content.', e));
                    }

                    // Show visual notification
                    orderNotif.classList.remove('d-none');
                    // Ensure it's active and visible
                    orderNotif.style.display = 'flex';

                    setTimeout(() => {
                        orderNotif.classList.add('d-none');
                        orderNotif.style.display = 'none';
                    }, 10000);
                }

                // Refresh orders table automatically
                if (typeof fetchOrders === 'function') fetchOrders();
            }
        )
        .subscribe((status) => {
            console.log("Realtime Orders Subscription Status:", status);
        });
}

// --- Settings Management ---
function setupSettingsForm() {
    if (!settingsForm) return;

    settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const cgst = parseFloat(document.getElementById('setting-cgst').value) || 0;
        const sgst = parseFloat(document.getElementById('setting-sgst').value) || 0;
        const newAdminPass = document.getElementById('setting-admin-pass').value.trim();

        // Collect Category Priorities
        const categoryPriorities = {};
        document.querySelectorAll('.cat-priority-input').forEach(input => {
            const cat = input.dataset.category;
            const priority = parseInt(input.value) || 0;
            if (priority > 0) {
                categoryPriorities[cat] = priority;
            }
        });

        // Online = Checked, Offline = Unchecked
        const isOffline = !document.getElementById('setting-offline').checked;
        const newSettings = { cgst, sgst, category_priorities: categoryPriorities, is_offline: isOffline };
        const saveBtn = document.getElementById('save-settings-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
            const { error: configError } = await supabaseClient.from('settings').upsert({ id: 'site_config', value: newSettings });
            if (configError) throw configError;

            if (newAdminPass) {
                const { error: authError } = await supabaseClient.from('settings').upsert({ id: 'admin_auth', value: { passcode: newAdminPass } });
                if (authError) throw authError;
                ADMIN_PASSCODE = newAdminPass;
                document.getElementById('setting-admin-pass').value = '';
            }

            showAdminToast('Settings saved successfully!');
            currentSettings = newSettings;
            updateShopStatusLabel(newSettings.is_offline);
            notifyClientsRefresh(); // Notify clients
        } catch (err) {
            console.error("Error saving settings:", err);
            showAdminToast('Failed to save settings', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Settings';
        }
    });
}

async function fetchSettings() {
    try {
        const { data, error } = await supabaseClient
            .from('settings')
            .select('*')
            .eq('id', 'site_config')
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (data) {
            currentSettings = data.value;
            if (document.getElementById('setting-cgst')) {
                document.getElementById('setting-cgst').value = currentSettings.cgst || 0;
                document.getElementById('setting-sgst').value = currentSettings.sgst || 0;
            }
            if (document.getElementById('setting-offline')) {
                const isOffline = currentSettings.is_offline || false;
                // Checked if NOT offline
                document.getElementById('setting-offline').checked = !isOffline;
                updateShopStatusLabel(isOffline);
            }
            renderCategoryPriorities(); // Initial render if settings load first
        }
    } catch (err) {
        console.error("Error fetching settings:", err);
    }
}

// --- Menu Management ---
function updateShopStatusLabel(isOffline) {
    const label = document.getElementById('shop-status-label');
    if (!label) return;
    if (isOffline) {
        label.textContent = 'Offline';
        label.className = 'status-label offline';
    } else {
        label.textContent = 'Online';
        label.className = 'status-label online';
    }
}


// --- Menu Management ---
function setupMenuForm() {
    if (!menuForm) return;

    // Add menu button
    if (addMenuBtn) {
        addMenuBtn.addEventListener('click', () => {
            menuForm.reset();
            document.getElementById('menu-id').value = '';
            document.getElementById('menu-modal-title').textContent = 'Add Menu Item';

            // Reset Category Input UI
            const catCustom = document.getElementById('menu-cat-custom');
            if (catCustom) {
                catCustom.style.display = 'none';
                catCustom.required = false;
            }

            menuModal.classList.remove('d-none');
        });

        // Add event listener for category toggle
        const catSelect = document.getElementById('menu-cat-select');
        const catCustom = document.getElementById('menu-cat-custom');
        if (catSelect && catCustom) {
            catSelect.addEventListener('change', (e) => {
                if (e.target.value === '__ADD_NEW__') {
                    catCustom.style.display = 'block';
                    catCustom.required = true;
                    catCustom.focus();
                } else {
                    catCustom.style.display = 'none';
                    catCustom.required = false;
                    catCustom.value = '';
                }
            });
        }
    }

    // Submit form
    menuForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveBtn = document.getElementById('save-menu-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        const id = document.getElementById('menu-id').value;
        const selectedCat = document.getElementById('menu-cat-select').value;
        const finalCategory = selectedCat === '__ADD_NEW__' ? document.getElementById('menu-cat-custom').value : selectedCat;

        const itemData = {
            name: document.getElementById('menu-name').value,
            description: document.getElementById('menu-desc').value,
            price: parseFloat(document.getElementById('menu-price').value),
            discount_percentage: parseFloat(document.getElementById('menu-discount').value) || 0,
            category: finalCategory.trim().toLowerCase(), // Normalize category
            diet_type: document.getElementById('menu-diet').value,
            image_url: document.getElementById('menu-img').value,
            is_available: document.getElementById('menu-active').checked
        };

        try {
            if (id) {
                const { error } = await supabaseClient.from('menu_items').update(itemData).eq('id', id);
                if (error) throw error;
                showAdminToast('Menu item updated successfully');
            } else {
                const { error } = await supabaseClient.from('menu_items').insert([itemData]);
                if (error) throw error;
                showAdminToast('Menu item added successfully');
            }

            menuModal.classList.add('d-none');
            await fetchMenuItems();
            notifyClientsRefresh(); // Notify clients
        } catch (err) {
            console.error(err);
            showAdminToast('Error saving menu item', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Item';
        }
    });
}

// Edit menu item (global function for onclick)
window.editMenuItem = (id) => {
    const item = menuData.find(i => i.id === id);
    if (!item) return;

    document.getElementById('menu-id').value = item.id;
    document.getElementById('menu-name').value = item.name;
    document.getElementById('menu-desc').value = item.description;
    document.getElementById('menu-price').value = item.price;
    document.getElementById('menu-discount').value = item.discount_percentage || 0;

    // Smart Category assignment
    const catSelect = document.getElementById('menu-cat-select');
    const catCustom = document.getElementById('menu-cat-custom');

    if (catSelect && catCustom) {
        const optionExists = Array.from(catSelect.options).some(opt => opt.value === item.category);

        if (optionExists) {
            catSelect.value = item.category;
            catCustom.style.display = 'none';
            catCustom.required = false;
            catCustom.value = '';
        } else {
            catSelect.value = '__ADD_NEW__';
            catCustom.style.display = 'block';
            catCustom.required = true;
            catCustom.value = item.category;
        }
    }
    document.getElementById('menu-diet').value = item.diet_type;
    document.getElementById('menu-img').value = item.image_url;
    document.getElementById('menu-active').checked = item.is_available;

    document.getElementById('menu-modal-title').textContent = 'Edit Menu Item';
    menuModal.classList.remove('d-none');
};

// Delete menu item
window.deleteMenuItem = async (id) => {
    if (confirm('Are you sure you want to delete this menu item?')) {
        try {
            const { error } = await supabaseClient.from('menu_items').delete().eq('id', id);
            if (error) throw error;
            showAdminToast('Item deleted successfully');
            await fetchMenuItems();
            notifyClientsRefresh(); // Notify clients
        } catch (err) {
            console.error(err);
            showAdminToast('Error deleting item', 'error');
        }
    }
};

async function fetchMenuItems() {
    try {
        const { data, error } = await supabaseClient
            .from('menu_items')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        menuData = data || [];
        updateDynamicCategories();
        renderMenuTable();
    } catch (err) {
        console.error("Error fetching menu:", err);
        showAdminToast('Failed to load menu items', 'error');
    }
}

// Extract unique categories and populate lists dynamically
function updateDynamicCategories() {
    if (!menuData) return;

    // Get unique, normalized categories
    const categories = [...new Set(menuData.map(item => item.category.trim().toLowerCase()))].filter(Boolean);

    // Populate form select
    const catSelect = document.getElementById('menu-cat-select');
    if (catSelect) {
        const currentVal = catSelect.value;
        catSelect.innerHTML = [
            '<option value="" disabled selected>Select Category</option>',
            ...categories.map(cat => `<option value="${cat}" style="text-transform: capitalize;">${cat}</option>`),
            '<option value="__ADD_NEW__" style="font-weight:bold; color:var(--clr-primary);">+ Add Custom Category</option>'
        ].join('');

        if (currentVal && Array.from(catSelect.options).some(opt => opt.value === currentVal)) {
            catSelect.value = currentVal;
        }
    }

    // Populate POS category filters
    const posCatContainer = document.querySelector('.pos-categories');
    if (posCatContainer) {
        // Sort categories by priority
        const priorities = (currentSettings && currentSettings.category_priorities) ? currentSettings.category_priorities : {};
        const sortedCategories = [...categories].sort((a, b) => {
            const prioA = priorities[a] || 999;
            const prioB = priorities[b] || 999;
            return prioA - prioB;
        });

        const catButtonsHtml = [
            '<button class="btn btn-outline pos-cat-btn active" data-cat="all">All</button>',
            ...sortedCategories.map(cat => `<button class="btn btn-outline pos-cat-btn" data-cat="${cat}" style="text-transform: capitalize;">${cat}</button>`)
        ].join('');
        posCatContainer.innerHTML = catButtonsHtml;

        // Re-attach POS category filter events
        setupPosCategoryFilters();
    }

    renderCategoryPriorities();
}

function renderCategoryPriorities() {
    const container = document.getElementById('category-priority-list');
    if (!container || !menuData || menuData.length === 0) return;

    const categories = [...new Set(menuData.map(item => item.category.trim().toLowerCase()))].filter(Boolean);
    if (categories.length === 0) {
        container.innerHTML = '<p class="text-muted italic">Add menu items to see categories here.</p>';
        return;
    }

    const priorities = (currentSettings && currentSettings.category_priorities) ? currentSettings.category_priorities : {};

    container.innerHTML = categories.map(cat => {
        const currentPrio = priorities[cat] || '';
        return `
            <div class="category-priority-item">
                <span class="cat-name">${cat}</span>
                <div class="cat-priority-input-wrapper">
                    <label style="margin:0; font-size:0.75rem; color:var(--text-muted);">Priority:</label>
                    <input type="number" class="cat-priority-input" data-category="${cat}" value="${currentPrio}" min="0" placeholder="0">
                </div>
            </div>
        `;
    }).join('');
}

function renderMenuTable() {
    if (!menuTableBody) return;

    if (menuData.length === 0) {
        menuTableBody.innerHTML = `<tr><td colspan="7" class="text-center">No menu items found. Add one!</td></tr>`;
        return;
    }

    menuTableBody.innerHTML = menuData.map(item => `
        <tr>
            <td data-label="Image"><img src="${item.image_url || 'https://via.placeholder.com/150'}" class="item-img-preview" alt="Preview"></td>
            <td data-label="Name" style="font-weight: 500;">${item.name} ${item.discount_percentage > 0 ? `<span style="font-size:0.7rem; color:#E65100; font-weight:700;">(${item.discount_percentage}% OFF)</span>` : ''}</td>
            <td data-label="Category" style="text-transform: capitalize;">${item.category}</td>
            <td data-label="Diet" style="text-transform: capitalize;">${item.diet_type}</td>
            <td data-label="Price">₹${item.price}</td>
            <td data-label="Status">
                <span class="status-badge ${item.is_available ? 'active' : 'inactive'}">
                    ${item.is_available ? 'Available' : 'Out of Stock'}
                </span>
            </td>
            <td>
                <button class="btn-icon edit" onclick="editMenuItem('${item.id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-icon delete" onclick="deleteMenuItem('${item.id}')" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
            </td>
        </tr>
    `).join('');
}

// --- Offers Management ---
function setupOfferForm() {
    if (!offerForm) return;

    if (addOfferBtn) {
        addOfferBtn.addEventListener('click', () => {
            offerForm.reset();
            document.getElementById('offer-id').value = '';
            document.getElementById('offer-modal-title').textContent = 'Add Offer';
            offerModal.classList.remove('d-none');
        });
    }

    offerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveBtn = document.getElementById('save-offer-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        const id = document.getElementById('offer-id').value;
        const offerData = {
            title: document.getElementById('offer-title').value,
            subtitle: document.getElementById('offer-subtitle').value,
            condition: document.getElementById('offer-condition').value,
            is_active: document.getElementById('offer-active').checked
        };

        try {
            if (id) {
                const { error } = await supabaseClient.from('offers').update(offerData).eq('id', id);
                if (error) throw error;
                showAdminToast('Offer updated successfully');
            } else {
                const { error } = await supabaseClient.from('offers').insert([offerData]);
                if (error) throw error;
                showAdminToast('Offer added successfully');
            }

            offerModal.classList.add('d-none');
            await fetchOffers();
            notifyClientsRefresh(); // Notify clients
        } catch (err) {
            console.error(err);
            showAdminToast('Error saving offer', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Offer';
        }
    });
}

window.editOffer = (id) => {
    const offer = offersData.find(o => o.id === id);
    if (!offer) return;

    document.getElementById('offer-id').value = offer.id;
    document.getElementById('offer-title').value = offer.title;
    document.getElementById('offer-subtitle').value = offer.subtitle;
    document.getElementById('offer-condition').value = offer.condition;
    document.getElementById('offer-active').checked = offer.is_active;

    document.getElementById('offer-modal-title').textContent = 'Edit Offer';
    offerModal.classList.remove('d-none');
};

window.deleteOffer = async (id) => {
    if (confirm('Are you sure you want to delete this offer?')) {
        try {
            const { error } = await supabaseClient.from('offers').delete().eq('id', id);
            if (error) throw error;
            showAdminToast('Offer deleted successfully');
            await fetchOffers();
            notifyClientsRefresh(); // Notify clients
        } catch (err) {
            console.error(err);
            showAdminToast('Error deleting offer', 'error');
        }
    }
};

async function fetchOffers() {
    try {
        const { data, error } = await supabaseClient
            .from('offers')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        offersData = data || [];
        renderOffersTable();
    } catch (err) {
        console.error("Error fetching offers:", err);
        showAdminToast('Failed to load offers', 'error');
    }
}

function renderOffersTable() {
    if (!offersTableBody) return;

    if (offersData.length === 0) {
        offersTableBody.innerHTML = `<tr><td colspan="5" class="text-center">No active offers.</td></tr>`;
        return;
    }

    offersTableBody.innerHTML = offersData.map(offer => `
        <tr>
            <td data-label="Title" style="font-weight: 600; color: var(--clr-primary);">${offer.title}</td>
            <td data-label="Subtitle">${offer.subtitle}</td>
            <td data-label="Condition"><span style="background: #FFFBEB; color: #D97706; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem;">${offer.condition}</span></td>
            <td data-label="Status">
                <span class="status-badge ${offer.is_active ? 'active' : 'inactive'}">
                    ${offer.is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>
                <button class="btn-icon edit" onclick="editOffer('${offer.id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-icon delete" onclick="deleteOffer('${offer.id}')" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
            </td>
        </tr>
    `).join('');
}

// --- Promo Codes Management ---
function setupPromoForm() {
    if (!promoForm) return;

    if (addPromoBtn) {
        addPromoBtn.addEventListener('click', () => {
            promoForm.reset();
            document.getElementById('promo-id').value = '';
            document.getElementById('promo-modal-title').textContent = 'Add Promo Code';
            promoModal.classList.remove('d-none');
        });
    }

    promoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveBtn = document.getElementById('save-promo-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        const id = document.getElementById('promo-id').value;
        const rawCode = document.getElementById('promo-code').value.toUpperCase().trim();
        const promoDataBlock = {
            code: rawCode,
            discount_type: document.getElementById('promo-type').value,
            discount_value: parseFloat(document.getElementById('promo-value').value),
            min_cart_value: parseFloat(document.getElementById('promo-min').value) || 0,
            is_active: document.getElementById('promo-active').checked,
            is_public: document.getElementById('promo-public').checked
        };

        try {
            // Basic code uniqueness check on frontend (DB will also enforce unique constraint)
            const existing = promoData.find(p => p.code === rawCode && p.id !== id);
            if (existing) {
                showAdminToast('Promo Code already exists!', 'error');
                return;
            }

            if (id) {
                const { error } = await supabaseClient.from('promo_codes').update(promoDataBlock).eq('id', id);
                if (error) {
                    console.error("Supabase Update Error:", error);
                    throw error;
                }
                showAdminToast('Promo updated successfully');
            } else {
                const { error } = await supabaseClient.from('promo_codes').insert([promoDataBlock]);
                if (error) {
                    console.error("Supabase Insert Error:", error);
                    throw error;
                }
                showAdminToast('Promo added successfully');
            }

            if (promoModal) promoModal.classList.add('d-none');
            await fetchPromos();
            notifyClientsRefresh();
        } catch (err) {
            console.error("Promo Save Error:", err);
            // Check for duplicate key Postgres error code
            if (err.code === '23505') {
                showAdminToast('This promo code string is already in use.', 'error');
            } else {
                showAdminToast('Error saving promo code', 'error');
            }
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Promo';
        }
    });
}

window.editPromo = (id) => {
    const promo = promoData.find(p => p.id === id);
    if (!promo) return;

    document.getElementById('promo-id').value = promo.id;
    document.getElementById('promo-code').value = promo.code;
    document.getElementById('promo-type').value = promo.discount_type;
    document.getElementById('promo-value').value = promo.discount_value;
    document.getElementById('promo-min').value = promo.min_cart_value || 0;
    document.getElementById('promo-active').checked = promo.is_active;
    document.getElementById('promo-public').checked = !!promo.is_public; // Handle legacy NULLs

    document.getElementById('promo-modal-title').textContent = 'Edit Promo Code';
    promoModal.classList.remove('d-none');
};

window.deletePromo = async (id) => {
    if (confirm('Are you sure you want to delete this promo code?')) {
        try {
            const { error } = await supabaseClient.from('promo_codes').delete().eq('id', id);
            if (error) throw error;
            showAdminToast('Promo code deleted');
            await fetchPromos();
            notifyClientsRefresh();
        } catch (err) {
            console.error(err);
            showAdminToast('Error deleting promo', 'error');
        }
    }
};

async function fetchPromos() {
    try {
        const { data, error } = await supabaseClient
            .from('promo_codes')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        promoData = data || [];
        renderPromosTable();
    } catch (err) {
        console.error("Error fetching promos:", err);
        showAdminToast('Failed to load promo codes', 'error');
    }
}

function renderPromosTable() {
    if (!promoTableBody) return;

    if (promoData.length === 0) {
        promoTableBody.innerHTML = `<tr><td colspan="6" class="text-center">No promo codes found.</td></tr>`;
        return;
    }

    promoTableBody.innerHTML = promoData.map(promo => {
        const valStr = promo.discount_type === 'percentage' ? `${promo.discount_value}%` : `₹${promo.discount_value}`;
        const typeBadgeClass = promo.discount_type === 'percentage' ? 'percentage' : 'fixed';
        const publicStr = promo.is_public ? '<i class="fa-solid fa-eye text-success" title="Visible to Customers"></i> Public' : '<i class="fa-solid fa-eye-slash text-muted" title="Hidden/Secret Code"></i> Hidden';

        return `
        <tr>
            <td data-label="Code" style="font-weight: 700; color: var(--clr-primary); letter-spacing: 1px;">${promo.code}</td>
            <td data-label="Discount">
                <span class="promo-type-badge ${typeBadgeClass} mr-2">${promo.discount_type === 'percentage' ? '%' : 'FIXED'}</span> 
                <strong>${valStr}</strong> OFF
            </td>
            <td data-label="Min Order">${promo.min_cart_value > 0 ? `₹${promo.min_cart_value}` : 'No Min'}</td>
            <td data-label="Visibility">${publicStr}</td>
            <td data-label="Status">
                <span class="status-badge ${promo.is_active ? 'active' : 'inactive'}">
                    ${promo.is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>
                <button class="btn-icon edit" onclick="editPromo('${promo.id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-icon delete" onclick="deletePromo('${promo.id}')" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
            </td>
        </tr>
    `}).join('');
}

// --- Orders Management ---
let currentOrdersPage = 1;
const ordersPageSize = 10;
let totalOrdersCount = 0;

async function fetchOrders() {
    try {
        const from = (currentOrdersPage - 1) * ordersPageSize;
        const to = from + ordersPageSize - 1;

        const { data, count, error } = await supabaseClient
            .from('orders')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw error;

        ordersData = data || [];
        totalOrdersCount = count || 0;

        renderOrdersTable();
        updatePaginationUI();

        updateSalesDashboard(); // Refresh sales if active
    } catch (err) {
        console.error("Error fetching orders:", err);
        showAdminToast('Failed to load orders', 'error');
    }
}

function updatePaginationUI() {
    const prevBtn = document.getElementById('page-prev-btn');
    const nextBtn = document.getElementById('page-next-btn');
    const indicator = document.getElementById('page-indicator');

    if (!prevBtn || !nextBtn || !indicator) return;

    const totalPages = Math.ceil(totalOrdersCount / ordersPageSize) || 1;

    indicator.textContent = `Page ${currentOrdersPage} of ${totalPages}`;

    prevBtn.disabled = currentOrdersPage <= 1;
    nextBtn.disabled = currentOrdersPage >= totalPages;
}

window.changeOrdersPage = function (delta) {
    const totalPages = Math.ceil(totalOrdersCount / ordersPageSize) || 1;
    const newPage = currentOrdersPage + delta;

    if (newPage >= 1 && newPage <= totalPages) {
        currentOrdersPage = newPage;
        fetchOrders();
    }
};

function renderOrdersTable() {
    if (!ordersTableBody) return;

    if (ordersData.length === 0) {
        ordersTableBody.innerHTML = `<tr><td colspan="7" class="text-center">No orders today.</td></tr>`;
        return;
    }

    ordersTableBody.innerHTML = ordersData.map(order => {
        const dateObj = new Date(order.created_at);
        const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString();

        let itemsHTML = '<ul style="padding-left: 20px; margin: 0; font-size: 0.85rem;">';
        if (order.items && Array.isArray(order.items)) {
            order.items.forEach(item => {
                itemsHTML += `<li>${item.quantity}x ${item.name}</li>`;
            });
        }
        itemsHTML += '</ul>';

        const statusOptions = ['Pending', 'Preparing', 'Completed', 'Cancelled']
            .map(s => `<option value="${s}" ${order.status === s ? 'selected' : ''}>${s}</option>`)
            .join('');

        const isNew = order.status === 'Pending';
        const newBadge = isNew ? `<span style="background:#EF4444; color:white; padding:2px 6px; border-radius:12px; font-size:0.65rem; font-weight:800; letter-spacing:0.5px; margin-left:0.5rem; animation: pulse 2s infinite;">NEW</span>` : '';

        return `
            <tr>
                <td data-label="Order ID" style="font-weight: 600; color: var(--clr-primary); font-size: 0.85rem; display: flex; align-items: center;">
                    ${order.order_id} ${newBadge}
                </td>
                <td data-label="Date/Time" style="font-size: 0.85rem;">${dateStr}</td>
                <td data-label="Table/Phone">
                    <div><strong>Table:</strong> ${order.table_number || 'N/A'}</div>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">${order.phone_number || ''}</div>
                </td>
                <td data-label="Items">${itemsHTML}</td>
                <td data-label="Total" style="font-weight: 600;">
                    ₹${order.total_price}
                    ${order.promo_code ? `<div style="font-size: 0.7rem; color: #03543F; font-weight: 500;">${order.promo_code}: -₹${order.discount_amount}</div>` : ''}
                </td>
                <td data-label="Status">
                    <select class="status-select" onchange="updateOrderStatus('${order.id}', this.value)" style="padding: 4px; border-radius: 4px; font-size: 0.8rem; border: 1px solid var(--border-clr);">
                        ${statusOptions}
                    </select>
                </td>
                <td>
                    <button class="btn-icon" onclick="printInvoice('${order.order_id}')" title="Print Receipt" style="color:var(--clr-primary)"><i class="fa-solid fa-print"></i></button>
                    <button class="btn-icon delete" onclick="deleteOrder('${order.id}')" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

window.updateOrderStatus = async (id, newStatus) => {
    try {
        const { error } = await supabaseClient.from('orders').update({ status: newStatus }).eq('id', id);
        if (error) throw error;
        showAdminToast('Order status updated');
        fetchOrders(); // Required to update local data for sales dashboard
    } catch (err) {
        console.error(err);
        showAdminToast('Error updating status', 'error');
        fetchOrders();
    }
};

window.deleteOrder = async (id) => {
    if (confirm('Are you sure you want to delete this order?')) {
        try {
            const { error } = await supabaseClient.from('orders').delete().eq('id', id);
            if (error) throw error;
            showAdminToast('Order deleted successfully');
            fetchOrders();
        } catch (err) {
            console.error(err);
            showAdminToast('Error deleting order', 'error');
        }
    }
};

// --- Sales Analysis Dashboard ---
let salesChartInstance = null;
let currentSalesDateRange = { start: null, end: null };

function getLocalYYMMDD(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseLocalDate(dateString) {
    if (!dateString) return new Date();
    const parts = dateString.split('-');
    if (parts.length !== 3) return new Date();
    return new Date(parts[0], parts[1] - 1, parts[2]);
}

document.addEventListener('DOMContentLoaded', () => {
    const startDateInput = document.getElementById('sales-start-date');
    const endDateInput = document.getElementById('sales-end-date');
    const filterBtn = document.getElementById('apply-date-filter');
    const quickFilters = document.querySelectorAll('.quick-filter');

    // Default to Today
    const today = new Date();

    if (startDateInput && endDateInput) {
        startDateInput.value = getLocalYYMMDD(today);
        endDateInput.value = getLocalYYMMDD(today);

        const start = parseLocalDate(startDateInput.value);
        start.setHours(0, 0, 0, 0);

        const end = parseLocalDate(endDateInput.value);
        end.setHours(23, 59, 59, 999);

        currentSalesDateRange = { start, end };
    }

    if (filterBtn) {
        filterBtn.addEventListener('click', () => {
            quickFilters.forEach(btn => btn.classList.remove('active'));
            const start = parseLocalDate(document.getElementById('sales-start-date').value);
            start.setHours(0, 0, 0, 0);
            const end = parseLocalDate(document.getElementById('sales-end-date').value);
            end.setHours(23, 59, 59, 999);

            if (start > end) {
                showAdminToast('Start date cannot be after end date', 'error');
                return;
            }

            currentSalesDateRange = { start, end };
            updateSalesDashboard();
        });
    }

    if (quickFilters.length > 0) {
        quickFilters.forEach(btn => {
            btn.addEventListener('click', (e) => {
                quickFilters.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                const filterType = e.target.getAttribute('data-filter');
                const start = new Date();
                const end = new Date();

                if (filterType === 'today') {
                    start.setHours(0, 0, 0, 0);
                    end.setHours(23, 59, 59, 999);
                } else if (filterType === 'yesterday') {
                    start.setDate(start.getDate() - 1);
                    start.setHours(0, 0, 0, 0);
                    end.setDate(end.getDate() - 1);
                    end.setHours(23, 59, 59, 999);
                } else if (filterType === '7days') {
                    start.setDate(start.getDate() - 7);
                    start.setHours(0, 0, 0, 0);
                    end.setHours(23, 59, 59, 999);
                } else if (filterType === '30days') {
                    start.setDate(start.getDate() - 30);
                    start.setHours(0, 0, 0, 0);
                    end.setHours(23, 59, 59, 999);
                }

                if (startDateInput && endDateInput) {
                    startDateInput.value = getLocalYYMMDD(start);
                    endDateInput.value = getLocalYYMMDD(end);
                }

                currentSalesDateRange = { start, end };
                updateSalesDashboard();
            });
        });
    }

    // Trigger update if nav opens
    const salesNavBtn = document.querySelector('.nav-btn[data-target="sales-analysis"]');
    if (salesNavBtn) {
        salesNavBtn.addEventListener('click', () => {
            // Need a slight delay for sections to actually show
            setTimeout(updateSalesDashboard, 100);
        });
    }
});

async function updateSalesDashboard() {
    const sectionActive = document.getElementById('sales-analysis')?.classList.contains('active');
    if (!sectionActive) return;

    const { start, end } = currentSalesDateRange;
    if (!start || !end) return;

    // Normalize end date time to encompass the whole day
    const normalizedEnd = new Date(end);
    normalizedEnd.setHours(23, 59, 59, 999);

    // Fetch all orders in date range explicitly bypassing pagination restrictions
    try {
        const { data: dashboardOrders, error } = await supabaseClient
            .from('orders')
            .select('*')
            .gte('created_at', start.toISOString())
            .lte('created_at', normalizedEnd.toISOString());

        if (error) throw error;

        if (!dashboardOrders || dashboardOrders.length === 0) {
            renderSalesMetrics(0, 0, 0);
            renderSalesChart(new Map(), start, normalizedEnd);
            renderTopItems([]);
            // Clear exports
            window.lastFilteredOrders = [];
            return;
        }

        const filteredOrders = dashboardOrders.filter(o => o.status !== 'Cancelled');

        // Store globally for CSV export
        window.lastFilteredOrders = filteredOrders;

        let totalRevenue = 0;
        const itemsMap = new Map();
        const dailyRevenueMap = new Map();

        filteredOrders.forEach(order => {
            totalRevenue += (parseFloat(order.total_price) || 0);

            // Map items for top selling logic
            if (order.items && Array.isArray(order.items)) {
                order.items.forEach(item => {
                    const qty = parseInt(item.quantity) || 1;
                    if (itemsMap.has(item.name)) {
                        itemsMap.set(item.name, itemsMap.get(item.name) + qty);
                    } else {
                        itemsMap.set(item.name, qty);
                    }
                });
            }

            // Map revenue by date for charts (Using Local Time to avoid UTC offsets)
            const d = new Date(order.created_at);
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

            if (dailyRevenueMap.has(dateStr)) {
                dailyRevenueMap.set(dateStr, dailyRevenueMap.get(dateStr) + (parseFloat(order.total_price) || 0));
            } else {
                dailyRevenueMap.set(dateStr, parseFloat(order.total_price) || 0);
            }
        });

        const totalOrders = filteredOrders.length;
        const aov = totalOrders > 0 ? (totalRevenue / totalOrders) : 0;

        renderSalesMetrics(totalRevenue, totalOrders, aov);

        // Sort and get Top 5
        const topItems = Array.from(itemsMap.entries())
            .map(([name, qty]) => ({ name, qty }))
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 5);

        renderTopItems(topItems);

        // Prepare chart data grouping by days between start and end
        renderSalesChart(dailyRevenueMap, start, normalizedEnd);

    } catch (err) {
        console.error("Error fetching dashboard orders:", err);
        showAdminToast('Failed to load dashboard metrics', 'error');
    }
}

function renderSalesMetrics(revenue, totalOrders, aov) {
    document.getElementById('metric-revenue').textContent = `₹${revenue.toFixed(2)}`;
    document.getElementById('metric-orders').textContent = totalOrders;
    document.getElementById('metric-aov').textContent = `₹${aov.toFixed(2)}`;
}

function renderTopItems(items) {
    const tbody = document.getElementById('top-items-body');
    if (!tbody) return;

    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" class="text-center text-muted">No items sold in this period</td></tr>`;
        return;
    }

    tbody.innerHTML = items.map((item, i) => `
        <tr>
            <td>
                <span style="display:inline-block; width:20px; color:var(--text-muted); font-size:0.8rem;">#${i + 1}</span>
                <span style="font-weight:500;">${item.name}</span>
            </td>
            <td><strong>${item.qty}</strong></td>
        </tr>
    `).join('');
}

function renderSalesChart(dailyRevenueMap, start, end) {
    const ctx = document.getElementById('salesChart');
    if (!ctx) return;

    // Generate date sequence based on start/end
    const dates = [];
    const revenues = [];

    let currDate = new Date(start);
    while (currDate <= end) {
        const dStr = `${currDate.getFullYear()}-${String(currDate.getMonth() + 1).padStart(2, '0')}-${String(currDate.getDate()).padStart(2, '0')}`;

        // Format label nicely: "Mar 07"
        const formattedLabel = currDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        dates.push(formattedLabel);

        revenues.push(dailyRevenueMap.get(dStr) || 0);

        currDate.setDate(currDate.getDate() + 1);
    }

    const chartConfig = {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Revenue (₹)',
                data: revenues,
                borderColor: '#6A1B1A',
                backgroundColor: 'rgba(106, 27, 26, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointBackgroundColor: '#6A1B1A',
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return '₹' + context.parsed.y.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return '₹' + value;
                        }
                    }
                }
            }
        }
    };

    if (salesChartInstance) {
        salesChartInstance.destroy();
    }

    if (window.Chart) {
        salesChartInstance = new window.Chart(ctx, chartConfig);
    }
}

// --- Data Export & Printing ---
document.addEventListener('DOMContentLoaded', () => {
    const exportBtn = document.getElementById('export-sales-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportSalesToCSV);
    }
});

function exportSalesToCSV() {
    const ordersToExport = window.lastFilteredOrders;

    if (!ordersToExport || ordersToExport.length === 0) {
        showAdminToast('No sales data to export for this date range.', 'error');
        return;
    }

    // Define CSV Headers
    const headers = ['Order ID', 'Date', 'Time', 'Table Number', 'Phone Number', 'Items & Quantity', 'Subtotal (INR)', 'Promo Code', 'Discount', 'CGST', 'SGST', 'Grand Total (INR)', 'Status'];
    const csvRows = [headers.join(',')];

    // Grab percentages
    const cgstRate = parseFloat(currentSettings?.cgst || 0);
    const sgstRate = parseFloat(currentSettings?.sgst || 0);

    // Map order data
    ordersToExport.forEach(order => {
        const dateObj = new Date(order.created_at);
        const fullDateStr = dateObj.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        const [datePart, timePart] = fullDateStr.split(', ');

        const tableStr = order.table_number ? `"${order.table_number.replace(/"/g, '""')}"` : 'Walk-in';
        const phoneStr = order.phone_number ? `"${order.phone_number.replace(/"/g, '""')}"` : 'N/A';

        let itemsStr = '';
        let subtotal = 0;
        if (order.items && Array.isArray(order.items)) {
            itemsStr = order.items.map(i => `${i.quantity}x ${i.name}`).join(' | ');
            subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        }

        const discountAmt = parseFloat(order.discount_amount || 0);
        const promoCode = order.promo_code || '';
        const discountedSubtotal = Math.max(0, subtotal - discountAmt);

        // Calculate explicit tax payload for row based on discounted amount
        const cgstAmt = (discountedSubtotal * cgstRate) / 100;
        const sgstAmt = (discountedSubtotal * sgstRate) / 100;

        // Escape quotes for CSV
        itemsStr = `"${itemsStr.replace(/"/g, '""')}"`;

        const row = [
            order.order_id,
            datePart,
            timePart,
            tableStr,
            phoneStr,
            itemsStr,
            subtotal.toFixed(2),
            promoCode,
            discountAmt.toFixed(2),
            cgstAmt.toFixed(2),
            sgstAmt.toFixed(2),
            order.total_price.toFixed(2),
            order.status
        ];
        csvRows.push(row.join(','));
    });

    // Create Blob and Download
    const csvData = csvRows.join('\r\n');
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `vijay_cafe_sales_export_${getLocalYYMMDD(new Date())}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

window.printInvoice = function (orderIdStr) {
    const order = ordersData.find(o => o.order_id === orderIdStr);
    if (!order) {
        showAdminToast('Order details not found', 'error');
        return;
    }

    // Populate Print Template
    document.getElementById('print-order-id').textContent = order.order_id;
    document.getElementById('print-order-date').textContent = new Date(order.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
    document.getElementById('print-order-table').textContent = order.table_number || order.phone_number || 'Walk-in';

    // Items
    const tbody = document.getElementById('print-items-body');
    if (order.items && Array.isArray(order.items)) {
        tbody.innerHTML = order.items.map(item => `
            <tr>
                <td class="text-left" style="width: 60%">${item.name}</td>
                <td class="text-center" style="width: 15%">${item.quantity}</td>
                <td class="text-right" style="width: 25%">₹${item.price.toFixed(2)}</td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = '';
    }

    // Totals logic
    let subtotal = 0;
    if (order.items) {
        subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    }

    const cgstRate = parseFloat(currentSettings?.cgst || 0);
    const sgstRate = parseFloat(currentSettings?.sgst || 0);

    const discountAmount = parseFloat(order.discount_amount || 0);
    const discountedSubtotal = Math.max(0, subtotal - discountAmount);

    const cgstAmt = (discountedSubtotal * cgstRate) / 100;
    const sgstAmt = (discountedSubtotal * sgstRate) / 100;

    document.getElementById('print-subtotal').textContent = `₹${subtotal.toFixed(2)}`;

    const discountRow = document.getElementById('print-discount-row');
    if (discountAmount > 0) {
        discountRow.classList.remove('d-none');
        document.getElementById('print-promo-code').textContent = order.promo_code || 'PROMO';
        document.getElementById('print-discount').textContent = `-₹${discountAmount.toFixed(2)}`;
    } else {
        discountRow.classList.add('d-none');
    }

    document.getElementById('print-cgst-rate').textContent = cgstRate;
    document.getElementById('print-cgst').textContent = `₹${cgstAmt.toFixed(2)}`;
    document.getElementById('print-sgst-rate').textContent = sgstRate;
    document.getElementById('print-sgst').textContent = `₹${sgstAmt.toFixed(2)}`;
    document.getElementById('print-grand-total').textContent = `₹${order.total_price.toFixed(2)}`;

    // Trigger Print
    const printContainer = document.getElementById('print-receipt-container');
    printContainer.classList.remove('d-none');
    window.print();
    printContainer.classList.add('d-none');
};

// --- Point of Sale (POS) Billing System ---
let posCart = [];
let currentPosCategory = 'all';
let currentPosSearch = '';
let currentPosPromo = null;

document.addEventListener('DOMContentLoaded', () => {
    // Nav Button Trigger for POS
    const posNavBtn = document.querySelector('.nav-btn[data-target="billing-mgmt"]');
    if (posNavBtn) {
        posNavBtn.addEventListener('click', () => {
            setTimeout(() => {
                if (menuData && menuData.length > 0) {
                    renderPosMenu();
                } else {
                    document.getElementById('pos-menu-grid').innerHTML = '<p class="text-muted p-3">No menu items found. Please add items in the Menu tab.</p>';
                }
            }, 100);
        });
    }

    // POS Search and Filter Listeners
    const posSearchInput = document.getElementById('pos-search');
    if (posSearchInput) {
        posSearchInput.addEventListener('input', (e) => {
            currentPosSearch = e.target.value.toLowerCase();
            renderPosMenu();
        });
    }

    // Function used to attach click events to dynamic POS cat buttons
    window.setupPosCategoryFilters = function () {
        const posCatWins = document.querySelectorAll('.pos-cat-btn');
        if (posCatWins) {
            posCatWins.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    posCatWins.forEach(b => b.classList.remove('active'));
                    e.currentTarget.classList.add('active'); // Use currentTarget to ensure the button is targeted, not child elements if any
                    currentPosCategory = e.currentTarget.getAttribute('data-cat');
                    renderPosMenu();
                });
            });
        }
    };
    // Initial attach (though it will be re-attached dynamically)
    setupPosCategoryFilters();

    // Complete Order Button
    const posCheckoutBtn = document.getElementById('pos-checkout-btn');
    if (posCheckoutBtn) {
        posCheckoutBtn.addEventListener('click', submitPosOrder);
    }

    // POS Promo Apply
    const posPromoApplyBtn = document.getElementById('pos-apply-promo-btn');
    if (posPromoApplyBtn) {
        posPromoApplyBtn.addEventListener('click', () => {
            if (typeof window.applyPosPromo === 'function') window.applyPosPromo();
        });
    }
});

// Render the grid of selectable POS items
function renderPosMenu() {
    const grid = document.getElementById('pos-menu-grid');
    if (!grid) return;

    if (!menuData || menuData.length === 0) {
        grid.innerHTML = '<p class="text-muted">Loading menu items...</p>';
        return;
    }

    let itemsToRender = menuData.filter(item => {
        const matchesCat = currentPosCategory === 'all' || item.category === currentPosCategory;
        const matchesSearch = item.name.toLowerCase().includes(currentPosSearch);
        return matchesCat && matchesSearch; // Keep active and inactive for admin to override if needed
    });

    if (itemsToRender.length === 0) {
        grid.innerHTML = '<p class="text-muted w-100 text-center py-4">No items match your filters.</p>';
        return;
    }

    grid.innerHTML = itemsToRender.map(item => `
        <div class="pos-item-card ${item.is_available === false ? 'pos-item-inactive' : ''}" ${item.is_available !== false ? `onclick="addToPosCart('${item.id}', '${item.name.replace(/'/g, "\\'")}', ${item.price})"` : ''}>
            <img src="${item.image_url}" alt="${item.name}" class="pos-item-img" onerror="this.src='https://placehold.co/400x300?text=No+Image'">
            <div class="pos-item-info">
                <h5>${item.name}</h5>
                <div class="d-flex justify-content-between align-items-center mt-2">
                    <span class="pos-item-price">₹${item.price}</span>
                    ${item.is_available === false ? '<span class="badge" style="background:#f44336">Inactive</span>' : '<button class="btn btn-primary pos-add-btn"><i class="fa-solid fa-plus"></i></button>'}
                </div>
            </div>
        </div>
    `).join('');
}

// Add item to the POS Cart
window.addToPosCart = function (id, name, price) {
    const existing = posCart.find(i => i.id === id);
    if (existing) {
        existing.quantity += 1;
    } else {
        posCart.push({ id, name, price, quantity: 1 });
    }
    showAdminToast(`Added ${name} to cart`);
    renderPosCart();
};

// Update Quantity of cart item
window.updatePosCartQuantity = function (id, delta) {
    const index = posCart.findIndex(i => i.id === id);
    if (index === -1) return;

    posCart[index].quantity += delta;

    if (posCart[index].quantity <= 0) {
        posCart.splice(index, 1);
    }
    renderPosCart();
};

// Re-render the cart UI sidebar and calculate totals
function renderPosCart() {
    const cartContainer = document.getElementById('pos-cart-items');
    if (!cartContainer) return;

    if (posCart.length === 0) {
        cartContainer.innerHTML = '<div class="text-center text-muted" style="padding: 2rem 0;">Cart is empty</div>';
        updatePosTotals(0);
        return;
    }

    cartContainer.innerHTML = posCart.map(item => `
        <div class="pos-cart-item">
            <div class="pos-cart-item-info">
                <div class="pos-cart-item-name">${item.name}</div>
                <div class="pos-cart-item-price">₹${item.price}</div>
            </div>
            <div class="pos-qty-controls">
                <button class="pos-qty-btn" onclick="updatePosCartQuantity('${item.id}', -1)"><i class="fa-solid fa-minus"></i></button>
                <div class="pos-qty-val">${item.quantity}</div>
                <button class="pos-qty-btn" onclick="updatePosCartQuantity('${item.id}', 1)"><i class="fa-solid fa-plus"></i></button>
            </div>
        </div>
    `).join('');

    // Calculate Subtotal
    const subtotal = posCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    updatePosTotals(subtotal);
}

// Update the summary section with taxes
function updatePosTotals(subtotal) {
    document.getElementById('pos-subtotal').textContent = `₹${subtotal.toFixed(2)}`;

    // Handle Promo Application Logic First
    let discountAmount = 0;
    const promoContainer = document.getElementById('pos-applied-promo-container');
    const promoCodeSpan = document.getElementById('pos-applied-promo-code');
    const promoDiscountSpan = document.getElementById('pos-applied-promo-discount');
    const discountRow = document.getElementById('pos-discount-row');
    const discountValElem = document.getElementById('pos-discount-val');
    const promoInputWrapper = document.getElementById('pos-promo-wrapper');

    if (currentPosPromo) {
        // Validate minimum cart value
        if (subtotal < currentPosPromo.min_cart_value) {
            showAdminToast(`Cart must be at least ₹${currentPosPromo.min_cart_value} to use this promo`, 'error');
            removePosPromo(); // Auto-remove if they drop below threshold
        } else {
            // Calculate discount
            if (currentPosPromo.discount_type === 'percentage') {
                discountAmount = (subtotal * currentPosPromo.discount_value) / 100;
            } else {
                discountAmount = currentPosPromo.discount_value;
            }

            // Prevent discount from exceeding subtotal
            if (discountAmount > subtotal) {
                discountAmount = subtotal;
            }

            // Update UI for applied promo
            if (promoContainer) promoContainer.classList.remove('d-none');
            if (promoInputWrapper) promoInputWrapper.classList.add('d-none');
            if (promoCodeSpan) promoCodeSpan.textContent = currentPosPromo.code;
            if (promoDiscountSpan) promoDiscountSpan.textContent = `-₹${discountAmount.toFixed(2)}`;
            if (discountRow) discountRow.classList.remove('d-none');
            if (discountValElem) discountValElem.textContent = `-₹${discountAmount.toFixed(2)}`;
        }
    } else {
        // Hide applied promo UI
        if (promoContainer) promoContainer.classList.add('d-none');
        if (promoInputWrapper) promoInputWrapper.classList.remove('d-none');
        if (discountRow) discountRow.classList.add('d-none');
        document.getElementById('pos-promo-input').value = '';
    }

    const discountedSubtotal = Math.max(0, subtotal - discountAmount);

    if (discountedSubtotal <= 0 && posCart.length === 0) {
        document.getElementById('pos-cgst-val').textContent = `₹0.00`;
        document.getElementById('pos-sgst-val').textContent = `₹0.00`;
        document.getElementById('pos-platform-val').textContent = `₹0.00`;
        document.getElementById('pos-grand-total').textContent = `₹0.00`;
        return;
    }

    const cgstRate = parseFloat(currentSettings?.cgst || 0);
    const sgstRate = parseFloat(currentSettings?.sgst || 0);

    document.getElementById('pos-cgst-rate').textContent = cgstRate;
    document.getElementById('pos-sgst-rate').textContent = sgstRate;

    const cgstAmount = (discountedSubtotal * cgstRate) / 100;
    const sgstAmount = (discountedSubtotal * sgstRate) / 100;
    const platformFee = 0; // Configured not to have a flat admin platform fee by default

    document.getElementById('pos-cgst-val').textContent = `₹${cgstAmount.toFixed(2)}`;
    document.getElementById('pos-sgst-val').textContent = `₹${sgstAmount.toFixed(2)}`;
    document.getElementById('pos-platform-val').textContent = `₹${platformFee.toFixed(2)}`;

    const grandTotal = discountedSubtotal + cgstAmount + sgstAmount + platformFee;
    document.getElementById('pos-grand-total').textContent = `₹${grandTotal.toFixed(2)}`;

    // Attach invisible dataset attribute for submit reading
    document.getElementById('pos-checkout-btn').dataset.grandTotal = grandTotal.toFixed(2);
    document.getElementById('pos-checkout-btn').dataset.discountAmount = discountAmount.toFixed(2);
}

// POS Promo Handlers
window.applyPosPromo = function () {
    const inputField = document.getElementById('pos-promo-input');
    const enteredCode = inputField.value.trim().toUpperCase();

    if (!enteredCode) {
        showAdminToast('Please enter a promo code', 'error');
        return;
    }

    const promo = promoData.find(p => p.code === enteredCode && p.is_active);

    if (!promo) {
        showAdminToast('Invalid or inactive promo code', 'error');
        return;
    }

    const currentSubtotal = posCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    if (currentSubtotal < promo.min_cart_value) {
        showAdminToast(`Minimum cart value for this promo is ₹${promo.min_cart_value}`, 'error');
        return;
    }

    currentPosPromo = promo;
    showAdminToast('Promo code applied!', 'success');
    renderPosCart(); // Re-trigger total calculation
};

window.removePosPromo = function () {
    currentPosPromo = null;
    document.getElementById('pos-promo-input').value = '';
    renderPosCart();
};

// Finalize and insert order into Supabase
async function submitPosOrder() {
    if (posCart.length === 0) {
        showAdminToast('Cart is empty', 'error');
        return;
    }

    const btn = document.getElementById('pos-checkout-btn');
    btn.textContent = 'Processing...';
    btn.disabled = true;

    try {
        const grandTotal = parseFloat(btn.dataset.grandTotal || 0);
        let tableOrNote = document.getElementById('pos-table-number').value.trim();
        if (!tableOrNote) tableOrNote = 'POS Order / Walk-in';

        const orderId = 'ORD-POS-' + Math.floor(1000 + Math.random() * 9000);

        // Map cart specifically to DB JSON expectations
        const mappedItems = posCart.map(i => ({ name: i.name, quantity: i.quantity, price: i.price }));

        // Include promo details in payload if present
        const orderPayload = {
            order_id: orderId,
            items: mappedItems,
            total_price: grandTotal,
            table_number: tableOrNote,
            status: 'Completed', // POS orders immediately fulfill
            created_at: new Date().toISOString()
        };

        if (currentPosPromo) {
            orderPayload.promo_code = currentPosPromo.code;
            orderPayload.discount_amount = parseFloat(btn.dataset.discountAmount || 0);
        }

        const { error } = await supabaseClient.from('orders').insert([orderPayload]);

        if (error) throw error;

        showAdminToast('Order processing successful', 'success');

        // Reset POS State
        posCart = [];
        currentPosPromo = null;
        document.getElementById('pos-table-number').value = '';
        renderPosCart();

        // Trigger background refreshes
        fetchOrders();
    } catch (err) {
        console.error("POS Checkout error:", err);
        showAdminToast('Failed to process POS order', 'error');
    } finally {
        btn.textContent = 'Complete Order';
        btn.disabled = false;
    }
}
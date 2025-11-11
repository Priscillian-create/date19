// Initialize Supabase with your configuration
const supabaseUrl = 'https://qgayglybnnrhobcvftrs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnYXlnbHlibm5yaG9iY3ZmdHJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2ODQ5ODMsImV4cCI6MjA3ODI2MDk4M30.dqiEe-v1cro5N4tuawu7Y1x5klSyjINsLHd9-V40QjQ';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Initialize data structures
const sections = ['grill', 'wholesale', 'building', 'food'];
const sectionNames = {
    'grill': 'Grill',
    'wholesale': 'Wholesale',
    'building': 'Building Material',
    'food': 'Food Supplies'
};

// Initialize empty inventory for each section
const inventory = {
    'grill': [],
    'wholesale': [],
    'building': [],
    'food': []
};

// Initialize empty carts for each section
const carts = {
    'grill': [],
    'wholesale': [],
    'building': [],
    'food': []
};

// Initialize sales data with proper default values
const salesData = {
    'grill': { totalSales: 0, totalTransactions: 0, avgTransaction: 0, topItem: '-', dailySales: 0, dailyTransactions: 0, profit: 0, profitMargin: 0 },
    'wholesale': { totalSales: 0, totalTransactions: 0, avgTransaction: 0, topItem: '-', dailySales: 0, dailyTransactions: 0, profit: 0, profitMargin: 0 },
    'building': { totalSales: 0, totalTransactions: 0, avgTransaction: 0, topItem: '-', dailySales: 0, dailyTransactions: 0, profit: 0, profitMargin: 0 },
    'food': { totalSales: 0, totalTransactions: 0, avgTransaction: 0, topItem: '-', dailySales: 0, dailyTransactions: 0, profit: 0, profitMargin: 0 }
};

// Initialize purchase data with proper default values
const purchaseData = {
    'grill': { totalPurchases: 0, totalTransactions: 0, avgTransaction: 0, topSupplier: '-', dailyPurchases: 0, dailyTransactions: 0 },
    'wholesale': { totalPurchases: 0, totalTransactions: 0, avgTransaction: 0, topSupplier: '-', dailyPurchases: 0, dailyTransactions: 0 },
    'building': { totalPurchases: 0, totalTransactions: 0, avgTransaction: 0, topSupplier: '-', dailyPurchases: 0, dailyTransactions: 0 },
    'food': { totalPurchases: 0, totalTransactions: 0, avgTransaction: 0, topSupplier: '-', dailyPurchases: 0, dailyTransactions: 0 }
};

// Initialize user data with proper default values
const userData = {
    'grill': { transactions: 0, sales: 0, purchases: 0 },
    'wholesale': { transactions: 0, sales: 0, purchases: 0 },
    'building': { transactions: 0, sales: 0, purchases: 0 },
    'food': { transactions: 0, sales: 0, purchases: 0 }
};

// Initialize suppliers data
const suppliers = {
    'grill': [],
    'wholesale': [],
    'building': [],
    'food': []
};

// Initialize purchase orders
const purchaseOrders = {
    'grill': [],
    'wholesale': [],
    'building': [],
    'food': []
};

// Current section and view
let currentSection = 'grill';
let currentView = 'pos';
let currentFilter = 'all';
let currentUser = null;

// Load data from localStorage immediately
function loadDataFromLocalStorage() {
    sections.forEach(section => {
        // Load inventory
        const localInventory = loadFromLocalStorage(`inventory_${section}`, []);
        if (localInventory.length > 0) {
            inventory[section] = localInventory;
        }
        
        // Load sales data
        const localSalesData = loadFromLocalStorage(`salesData_${section}`);
        if (localSalesData) {
            salesData[section] = localSalesData;
        }
        
        // Load purchase data
        const localPurchaseData = loadFromLocalStorage(`purchaseData_${section}`);
        if (localPurchaseData) {
            purchaseData[section] = localPurchaseData;
        }
        
        // Load user data
        const localUserData = loadFromLocalStorage(`userData_${section}`);
        if (localUserData) {
            userData[section] = localUserData;
        }
        
        // Load cart
        const localCart = loadFromLocalStorage(`cart_${section}`, []);
        if (localCart.length > 0) {
            carts[section] = localCart;
        }
        
        // Load suppliers
        const localSuppliers = loadFromLocalStorage(`suppliers_${section}`, []);
        if (localSuppliers.length > 0) {
            suppliers[section] = localSuppliers;
        }
        
        // Load purchase orders
        const localPurchaseOrders = loadFromLocalStorage(`purchaseOrders_${section}`, []);
        if (localPurchaseOrders.length > 0) {
            purchaseOrders[section] = localPurchaseOrders;
        }
    });
}

// Call this immediately to load data from localStorage
loadDataFromLocalStorage();

// Generate unique ID for offline records
function generateOfflineId() {
    return 'offline_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Save data to local storage for offline use
function saveToLocalStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error('Error saving to localStorage:', e);
    }
}

// Load data from local storage
function loadFromLocalStorage(key, defaultValue = null) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
        console.error('Error loading from localStorage:', e);
        return defaultValue;
    }
}

// Check if a product is expired
function isExpired(expiryDate) {
    if (!expiryDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison
    const expiry = new Date(expiryDate);
    return expiry < today;
}

// Check if a product is expiring soon (within 7 days)
function isExpiringSoon(expiryDate) {
    if (!expiryDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison
    const expiry = new Date(expiryDate);
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffTime > 0 && diffDays <= 7;
}

// Get product status based on stock and expiry
function getProductStatus(item) {
    if (isExpired(item.expiry_date)) {
        return 'expired';
    } else if (isExpiringSoon(item.expiry_date)) {
        return 'expiring-soon';
    } else if (item.stock === 0) {
        return 'out-of-stock';
    } else if (item.stock < 10) {
        return 'low-stock';
    } else {
        return 'in-stock';
    }
}

// Format date for display
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

// Update category inventory summary
function updateCategoryInventorySummary(section) {
    let totalProducts = 0;
    let totalValue = 0;
    let totalCost = 0;
    let lowStockCount = 0;
    let expiringSoonCount = 0;
    let expiredCount = 0;
    
    inventory[section].forEach(item => {
        totalProducts++;
        totalValue += item.price * item.stock;
        totalCost += (item.cost || 0) * item.stock;
        
        const status = getProductStatus(item);
        if (status === 'low-stock') {
            lowStockCount++;
        } else if (status === 'expiring-soon') {
            expiringSoonCount++;
        } else if (status === 'expired') {
            expiredCount++;
        }
    });
    
    const totalProfit = totalValue - totalCost;
    const profitMargin = totalValue > 0 ? (totalProfit / totalValue) * 100 : 0;
    
    // Update the summary cards with null checks
    const totalProductsEl = document.getElementById(`${section}-total-products`);
    if (totalProductsEl) totalProductsEl.textContent = totalProducts;
    
    const totalValueEl = document.getElementById(`${section}-total-value`);
    if (totalValueEl) totalValueEl.textContent = `₦${totalValue.toFixed(2)}`;
    
    const totalCostEl = document.getElementById(`${section}-total-cost`);
    if (totalCostEl) totalCostEl.textContent = `₦${totalCost.toFixed(2)}`;
    
    const totalProfitEl = document.getElementById(`${section}-total-profit`);
    if (totalProfitEl) totalProfitEl.textContent = `₦${totalProfit.toFixed(2)}`;
    
    const profitMarginEl = document.getElementById(`${section}-profit-margin`);
    if (profitMarginEl) profitMarginEl.textContent = `${profitMargin.toFixed(1)}%`;
    
    const lowStockCountEl = document.getElementById(`${section}-low-stock-count`);
    if (lowStockCountEl) lowStockCountEl.textContent = lowStockCount;
    
    const expiringSoonCountEl = document.getElementById(`${section}-expiring-soon-count`);
    if (expiringSoonCountEl) expiringSoonCountEl.textContent = expiringSoonCount;
    
    const expiredCountEl = document.getElementById(`${section}-expired-count`);
    if (expiredCountEl) expiredCountEl.textContent = expiredCount;
}

// ===================================================================
// CRITICAL FIX: saveDataToSupabase with strict data cleaning
// ===================================================================
async function saveDataToSupabase(table, data, id = null) {
    // Add metadata for local tracking
    const dataWithMetadata = {
        ...data,
        timestamp: new Date().toISOString(),
        created_by: currentUser ? currentUser.id : 'offline_user',
        updated_by: currentUser ? currentUser.id : 'offline_user',
        updated_at: new Date().toISOString()
    };

    // Save to local storage immediately for offline access
    const localKey = `${table}_${id || 'new'}`;
    saveToLocalStorage(localKey, dataWithMetadata);

    // --- FIX: Strict data cleaning before sending to Supabase ---
    let dataForSupabase = { ...dataWithMetadata };
    delete dataForSupabase.isOffline;
    delete dataForSupabase.timestamp;
    delete dataForSupabase.userId; // Use created_by instead

    // For new items, let Supabase generate the ID. Remove our temporary one.
    if (!id || id.startsWith('offline_')) {
        delete dataForSupabase.id;
    }

    // Table-specific data cleaning to match database schema
    if (table === 'inventory') {
        const { section, name, price, cost, stock, expiry_date, description, status, created_by, created_at, updated_by, updated_at, deleted, deleted_at } = dataForSupabase;
        dataForSupabase = { section, name, price, cost, stock, expiry_date, description, status, created_by, created_at, updated_by, updated_at, deleted, deleted_at };
    } else if (table === 'sales') {
        const { user_id, user_email, section, items, subtotal, total, totalCost, totalProfit, profitMargin, payment_method, customer_name, customer_phone, timestamp } = dataForSupabase;
        dataForSupabase = { user_id, user_email, section, items, subtotal, total, totalCost, totalProfit, profitMargin, payment_method, customer_name, customer_phone, timestamp };
    } else if (table === 'suppliers') {
        const { section, name, phone, email, address, products, created_by, created_at, updated_by, updated_at, deleted, deleted_at } = dataForSupabase;
        dataForSupabase = { section, name, phone, email, address, products, created_by, created_at, updated_by, updated_at, deleted, deleted_at };
    } else if (table === 'purchase_orders') {
        const { section, orderNumber, supplierId, supplierName, productId, productName, quantity, cost, total, orderDate, status, receivedDate, created_by, created_at, updated_by, updated_at, deleted, deleted_at } = dataForSupabase;
        dataForSupabase = { section, "orderNumber": orderNumber, supplierId, supplierName, productId, productName, quantity, cost, total, "orderDate": orderDate, status, "receivedDate": receivedDate, created_by, created_at, updated_by, updated_at, deleted, deleted_at };
    } else if (table === 'sales_data') {
        const { id, totalSales, totalTransactions, avgTransaction, topItem, dailySales, dailyTransactions, profit, profitMargin } = dataForSupabase;
        dataForSupabase = { id, totalSales, totalTransactions, avgTransaction, topItem, dailySales, dailyTransactions, profit, profitMargin };
    } else if (table === 'purchase_data') {
        const { id, totalPurchases, totalTransactions, avgTransaction, topSupplier, dailyPurchases, dailyTransactions } = dataForSupabase;
        dataForSupabase = { id, totalPurchases, totalTransactions, avgTransaction, topSupplier, dailyPurchases, dailyTransactions };
    } else if (table === 'user_data') {
        const { id, transactions, sales, purchases } = dataForSupabase; // userId is not a column here
        dataForSupabase = { id, transactions, sales, purchases };
    }

    // Update local data structures immediately
    if (table === 'inventory') {
        if (!id) {
            id = generateOfflineId();
            dataWithMetadata.id = id;
            dataWithMetadata.isOffline = true;
            inventory[dataWithMetadata.section].push(dataWithMetadata);
        } else {
            const index = inventory[dataWithMetadata.section].findIndex(item => item.id === id);
            if (index !== -1) {
                inventory[dataWithMetadata.section][index] = { ...inventory[dataWithMetadata.section][index], ...dataWithMetadata };
            }
        }
        saveToLocalStorage(`inventory_${dataWithMetadata.section}`, inventory[dataWithMetadata.section]);
        loadInventoryTable(dataWithMetadata.section);
        updateDepartmentStats(dataWithMetadata.section);
        updateCategoryInventorySummary(dataWithMetadata.section);
        updateTotalInventory();
    } else if (table === 'sales') {
        const section = dataWithMetadata.section;
        const totalProfit = calculateSaleProfit(dataWithMetadata.items);
        salesData[section].totalSales += dataWithMetadata.total;
        salesData[section].totalTransactions += 1;
        salesData[section].avgTransaction = salesData[section].totalSales / salesData[section].totalTransactions;
        salesData[section].dailySales += dataWithMetadata.total;
        salesData[section].dailyTransactions += 1;
        salesData[section].profit += totalProfit;
        salesData[section].profitMargin = salesData[section].totalSales > 0 ? (salesData[section].profit / salesData[section].totalSales) * 100 : 0;
        userData[section].transactions += 1;
        userData[section].sales += dataWithMetadata.total;
        saveToLocalStorage(`salesData_${section}`, salesData[section]);
        saveToLocalStorage(`userData_${section}`, userData[section]);
        updateReports(section);
        updateUserStats(section);
        updateDepartmentStats(section);
    } else if (table === 'sales_data') {
        const section = id;
        if (section && salesData[section]) {
            salesData[section] = { ...salesData[section], ...dataForSupabase };
            saveToLocalStorage(`salesData_${section}`, salesData[section]);
            updateReports(section);
            updateDepartmentStats(section);
        }
    } else if (table === 'user_data') {
        const section = id;
        if (section && userData[section]) {
            userData[section] = { ...userData[section], ...dataForSupabase };
            saveToLocalStorage(`userData_${section}`, userData[section]);
            updateUserStats(section);
        }
    }
    // ... (other local updates for suppliers, purchase_orders, etc. would be here) ...

    // If online, try to save to Supabase
    if (navigator.onLine) {
        try {
            console.log(`Saving to Supabase table: ${table}`);
            let result;
            
            if (id && !id.startsWith('offline_')) {
                // Update existing record
                console.log(`Updating record with ID: ${id}`);
                const { data: resultData, error } = await supabase.from(table).update(dataForSupabase).eq('id', id).select();
                if (error) throw error;
                result = resultData[0];
            } else {
                // Insert new record
                console.log(`Inserting new record into ${table}`);
                const { data: resultData, error } = await supabase.from(table).insert(dataForSupabase).select();
                if (error) throw error;
                result = resultData[0];
                
                // Update local data with real ID from Supabase
                if (table === 'inventory' || table === 'suppliers' || table === 'purchase_orders') {
                    const dataArray = table === 'inventory' ? inventory[data.section] : table === 'suppliers' ? suppliers[data.section] : purchaseOrders[data.section];
                    const index = dataArray.findIndex(item => item.id === id);
                    if (index !== -1) {
                        dataArray[index].id = result.id;
                        dataArray[index].isOffline = false;
                        localStorage.removeItem(localKey);
                        saveToLocalStorage(`${table}_${data.section}`, dataArray);
                    }
                }
            }
            
            console.log(`Successfully saved to ${table}:`, result);
            return result;
        } catch (error) {
            console.error(`Error saving to ${table}:`, error);
            showNotification(`Error saving to ${table}: ${error.message}`, 'error');
            
            // Store for later sync
            const pendingChanges = loadFromLocalStorage('pendingChanges', {});
            if (!pendingChanges[table]) pendingChanges[table] = {};
            if (id && !id.startsWith('offline_')) {
                pendingChanges[table][id] = dataWithMetadata;
            } else {
                if (!pendingChanges[table].new) pendingChanges[table].new = [];
                pendingChanges[table].new.push(dataWithMetadata);
            }
            saveToLocalStorage('pendingChanges', pendingChanges);
            return { id };
        }
    } else {
        // Store for later sync
        const pendingChanges = loadFromLocalStorage('pendingChanges', {});
        if (!pendingChanges[table]) pendingChanges[table] = {};
        if (id && !id.startsWith('offline_')) {
            pendingChanges[table][id] = dataWithMetadata;
        } else {
            if (!pendingChanges[table].new) pendingChanges[table].new = [];
            pendingChanges[table].new.push(dataWithMetadata);
        }
        saveToLocalStorage('pendingChanges', pendingChanges);
        return { id };
    }
}

// Calculate profit from a sale
function calculateSaleProfit(items) {
    let totalCost = 0;
    items.forEach(item => {
        const inventoryItem = inventory[currentSection].find(invItem => invItem.id === item.id);
        if (inventoryItem) {
            totalCost += (inventoryItem.cost || 0) * item.quantity;
        }
    });
    return items.reduce((sum, item) => sum + item.total, 0) - totalCost;
}

// Listen for authentication state changes
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
        currentUser = session.user;
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        updateUserInfo(session.user);
        loadDataFromSupabase();
        window.addEventListener('online', handleOnlineStatus);
        window.addEventListener('offline', handleOfflineStatus);
        initializeApp();
    } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
    }
});

// Update user info in the UI
function updateUserInfo(user) {
    const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Admin User';
    const email = user.email || '';
    const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase();
    
    const userNameEl = document.getElementById('userName');
    if (userNameEl) userNameEl.textContent = displayName;
    
    const userAvatarEl = document.getElementById('userAvatar');
    if (userAvatarEl) userAvatarEl.textContent = initials;
    
    sections.forEach(section => {
        const profileNameEl = document.getElementById(`${section}-profile-name`);
        if (profileNameEl) profileNameEl.textContent = displayName;
        
        const profileAvatarEl = document.getElementById(`${section}-profile-avatar`);
        if (profileAvatarEl) profileAvatarEl.textContent = initials;
        
        const emailEl = document.getElementById(`${section}-email`);
        if (emailEl) emailEl.value = email;
    });
}

// Handle online/offline status
function handleOnlineStatus() {
    const offlineIndicator = document.getElementById('offlineIndicator');
    if (offlineIndicator) offlineIndicator.classList.remove('show');
    showNotification('Connection restored. Syncing data...', 'info');
    syncPendingChanges();
}

function handleOfflineStatus() {
    const offlineIndicator = document.getElementById('offlineIndicator');
    if (offlineIndicator) offlineIndicator.classList.add('show');
    showNotification('You\'re now offline. Changes will be saved locally.', 'warning');
}

// ===================================================================
// CRITICAL FIX: syncPendingChanges with strict data cleaning
// ===================================================================
async function syncPendingChanges() {
    if (!navigator.onLine) {
        console.log('Offline mode, skipping sync');
        return;
    }
    
    const syncStatus = document.getElementById('syncStatus');
    if (syncStatus) syncStatus.classList.add('show');
    
    const pendingChanges = loadFromLocalStorage('pendingChanges', {});
    
    if (Object.keys(pendingChanges).length > 0) {
        console.log('Syncing pending changes:', pendingChanges);
        const promises = [];
        
        Object.keys(pendingChanges).forEach(table => {
            // Process new documents
            if (pendingChanges[table].new && pendingChanges[table].new.length > 0) {
                pendingChanges[table].new.forEach(data => {
                    let dataForSupabase = { ...data };
                    delete dataForSupabase.isOffline;
                    delete dataForSupabase.timestamp;
                    delete dataForSupabase.id;
                    delete dataForSupabase.userId;

                    // Apply the same table-specific cleaning as in saveDataToSupabase
                    if (table === 'inventory') {
                        const { section, name, price, cost, stock, expiry_date, description, status, created_by, created_at, updated_by, updated_at, deleted, deleted_at } = dataForSupabase;
                        dataForSupabase = { section, name, price, cost, stock, expiry_date, description, status, created_by, created_at, updated_by, updated_at, deleted, deleted_at };
                    } else if (table === 'sales') {
                        const { user_id, user_email, section, items, subtotal, total, totalCost, totalProfit, profitMargin, payment_method, customer_name, customer_phone, timestamp } = dataForSupabase;
                        dataForSupabase = { user_id, user_email, section, items, subtotal, total, totalCost, totalProfit, profitMargin, payment_method, customer_name, customer_phone, timestamp };
                    } // ... add other tables as needed

                    promises.push(supabase.from(table).insert(dataForSupabase).select().then(({ data: result, error }) => {
                        if (error) throw error;
                        console.log(`Successfully synced new ${table} record:`, result);
                        // Update local data with real ID
                        if (table === 'inventory') {
                            const index = inventory[data.section].findIndex(item => item.id === data.id);
                            if (index !== -1) {
                                inventory[data.section][index].id = result[0].id;
                                inventory[data.section][index].isOffline = false;
                                saveToLocalStorage(`inventory_${data.section}`, inventory[data.section]);
                            }
                        }
                        return result[0];
                    }));
                });
            }
            
            // Process existing documents
            Object.keys(pendingChanges[table]).forEach(id => {
                if (id !== 'new' && pendingChanges[table][id]) {
                    const data = pendingChanges[table][id];
                    let dataForSupabase = { ...data };
                    delete dataForSupabase.isOffline;
                    delete dataForSupabase.timestamp;
                    delete dataForSupabase.userId;
                    
                    // Apply table-specific cleaning
                    if (table === 'sales_data') {
                        const { id, totalSales, totalTransactions, avgTransaction, topItem, dailySales, dailyTransactions, profit, profitMargin } = dataForSupabase;
                        dataForSupabase = { id, totalSales, totalTransactions, avgTransaction, topItem, dailySales, dailyTransactions, profit, profitMargin };
                    } // ... add other tables

                    promises.push(supabase.from(table).update(dataForSupabase).eq('id', id).select().then(({ data: result, error }) => {
                        if (error) throw error;
                        console.log(`Successfully synced ${table} record ${id}:`, result);
                        return result[0];
                    }));
                }
            });
        });
        
        try {
            await Promise.all(promises);
            localStorage.removeItem('pendingChanges');
            if (syncStatus) syncStatus.classList.remove('show');
            showNotification('All changes synced successfully', 'success');
            loadDataFromSupabase();
        } catch (error) {
            console.error('Error syncing changes:', error);
            if (syncStatus) syncStatus.classList.remove('show');
            showNotification('Error syncing changes. Please try again later.', 'error');
        }
    } else {
        if (syncStatus) syncStatus.classList.remove('show');
    }
}

// ===================================================================
// CRITICAL FIX: loadDataFromSupabase with robust error handling
// ===================================================================
async function loadDataFromSupabase() {
    if (!navigator.onLine) {
        console.log('Offline mode, skipping Supabase load');
        return;
    }
    
    try {
        console.log('Loading data from Supabase...');
        
        // Load inventory, suppliers, purchase_orders
        sections.forEach(section => {
            supabase.from('inventory').select('*').eq('section', section).then(({ data, error }) => {
                if (error) { console.error(`Error loading ${section} inventory:`, error); showNotification(`Error loading ${section} inventory. Using cached data.`, 'warning'); return; }
                console.log(`Loaded ${section} inventory:`, data);
                inventory[section] = data || [];
                saveToLocalStorage(`inventory_${section}`, inventory[section]);
                loadInventoryTable(section);
                updateDepartmentStats(section);
                updateCategoryInventorySummary(section);
                updateTotalInventory();
            });
            supabase.from('suppliers').select('*').eq('section', section).then(({ data, error }) => {
                if (error) { console.error(`Error loading ${section} suppliers:`, error); showNotification(`Error loading ${section} suppliers. Using cached data.`, 'warning'); return; }
                console.log(`Loaded ${section} suppliers:`, data);
                suppliers[section] = data || [];
                saveToLocalStorage(`suppliers_${section}`, suppliers[section]);
                loadSuppliersTable(section);
            });
            supabase.from('purchase_orders').select('*').eq('section', section).then(({ data, error }) => {
                if (error) { console.error(`Error loading ${section} purchase orders:`, error); showNotification(`Error loading ${section} purchase orders. Using cached data.`, 'warning'); return; }
                console.log(`Loaded ${section} purchase orders:`, data);
                purchaseOrders[section] = data || [];
                saveToLocalStorage(`purchaseOrders_${section}`, purchaseOrders[section]);
                loadPurchaseOrdersTable(section);
            });
        });

        // Load summary tables (sales_data, purchase_data, user_data)
        sections.forEach(section => {
            // Load sales_data
            supabase.from('sales_data').select('*').eq('id', section).single().then(({ data, error }) => {
                if (error) {
                    console.error(`Error loading ${section} sales data:`, error);
                    // If not found, create it. Otherwise, show warning.
                    if (error.code === 'PGRST116') {
                        const initialSalesData = { id: section, totalSales: 0, totalTransactions: 0, avgTransaction: 0, topItem: '-', dailySales: 0, dailyTransactions: 0, profit: 0, profitMargin: 0 };
                        supabase.from('sales_data').insert(initialSalesData).then(({ error: insertError }) => {
                            if (!insertError) {
                                salesData[section] = initialSalesData;
                                saveToLocalStorage(`salesData_${section}`, salesData[section]);
                                updateReports(section);
                                updateDepartmentStats(section);
                            }
                        });
                    } else {
                        showNotification(`Error loading ${section} sales data. Using cached data.`, 'warning');
                    }
                    return;
                }
                if (data) {
                    salesData[section] = { totalSales: data.totalSales || 0, totalTransactions: data.totalTransactions || 0, avgTransaction: data.avgTransaction || 0, topItem: data.topItem || '-', dailySales: data.dailySales || 0, dailyTransactions: data.dailyTransactions || 0, profit: data.profit || 0, profitMargin: data.profitMargin || 0 };
                    saveToLocalStorage(`salesData_${section}`, salesData[section]);
                    updateReports(section);
                    updateDepartmentStats(section);
                }
            });

            // Load purchase_data
            supabase.from('purchase_data').select('*').eq('id', section).single().then(({ data, error }) => {
                if (error) {
                    console.error(`Error loading ${section} purchase data:`, error);
                    if (error.code === 'PGRST116') {
                        const initialPurchaseData = { id: section, totalPurchases: 0, totalTransactions: 0, avgTransaction: 0, topSupplier: '-', dailyPurchases: 0, dailyTransactions: 0 };
                        supabase.from('purchase_data').insert(initialPurchaseData).then(({ error: insertError }) => {
                            if (!insertError) {
                                purchaseData[section] = initialPurchaseData;
                                saveToLocalStorage(`purchaseData_${section}`, purchaseData[section]);
                                updatePurchaseReports(section);
                                updateDepartmentStats(section);
                            }
                        });
                    } else {
                        showNotification(`Error loading ${section} purchase data. Using cached data.`, 'warning');
                    }
                    return;
                }
                if (data) {
                    purchaseData[section] = { totalPurchases: data.totalPurchases || 0, totalTransactions: data.totalTransactions || 0, avgTransaction: data.avgTransaction || 0, topSupplier: data.topSupplier || '-', dailyPurchases: data.dailyPurchases || 0, dailyTransactions: data.dailyTransactions || 0 };
                    saveToLocalStorage(`purchaseData_${section}`, purchaseData[section]);
                    updatePurchaseReports(section);
                    updateDepartmentStats(section);
                }
            });

            // Load user_data
            supabase.from('user_data').select('*').eq('id', section).single().then(({ data, error }) => {
                if (error) {
                    console.error(`Error loading ${section} user data:`, error);
                    if (error.code === 'PGRST116') {
                        const initialUserData = { id: section, transactions: 0, sales: 0, purchases: 0 };
                        supabase.from('user_data').insert(initialUserData).then(({ error: insertError }) => {
                            if (!insertError) {
                                userData[section] = initialUserData;
                                saveToLocalStorage(`userData_${section}`, userData[section]);
                                updateUserStats(section);
                            }
                        });
                    } else {
                        showNotification(`Error loading ${section} user data. Using cached data.`, 'warning');
                    }
                    return;
                }
                if (data) {
                    userData[section] = { transactions: data.transactions || 0, sales: data.sales || 0, purchases: data.purchases || 0 };
                    saveToLocalStorage(`userData_${section}`, userData[section]);
                    updateUserStats(section);
                }
            });
        });
    } catch (error) {
        console.error('Error loading data from Supabase:', error);
        showNotification('Error loading data from server. Using cached data.', 'warning');
    }
}

// --- EVENT LISTENERS (REFACTORED) ---
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is already authenticated
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            currentUser = session.user;
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('mainApp').style.display = 'block';
            updateUserInfo(session.user);
            initializeApp();
            loadDataFromSupabase();
            window.addEventListener('online', handleOnlineStatus);
            window.addEventListener('offline', handleOfflineStatus);
        } else {
            document.getElementById('loginScreen').style.display = 'flex';
            document.getElementById('mainApp').style.display = 'none';
        }
    });
    
    // Login form
    const emailLoginForm = document.getElementById('emailLoginForm');
    if (emailLoginForm) {
        emailLoginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const errorElement = document.getElementById('email-login-error');
            const loginBtn = document.getElementById('emailLoginBtn');
            
            if (loginBtn) {
                loginBtn.disabled = true;
                loginBtn.textContent = 'Signing In...';
            }
            
            supabase.auth.signInWithPassword({ email, password })
                .then(({ data, error }) => {
                    if (error) {
                        if (errorElement) errorElement.textContent = error.message;
                        if (loginBtn) {
                            loginBtn.disabled = false;
                            loginBtn.textContent = 'Sign In';
                        }
                    }
                })
                .catch(error => {
                    if (errorElement) errorElement.textContent = error.message;
                    if (loginBtn) {
                        loginBtn.disabled = false;
                        loginBtn.textContent = 'Sign In';
                    }
                });
        });
    }

    // Forgot password
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', function(e) {
            e.preventDefault();
            const forgotPasswordModal = document.getElementById('forgotPasswordModal');
            if (forgotPasswordModal) forgotPasswordModal.classList.add('active');
        });
    }

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            supabase.auth.signOut();
        });
    }

    // Modal close buttons
    document.querySelectorAll('.js-modal-close').forEach(button => {
        button.addEventListener('click', () => {
            const targetModal = button.getAttribute('data-target');
            closeModal(targetModal);
        });
    });

    // Add item button
    document.querySelectorAll('.js-add-item-btn').forEach(button => {
        button.addEventListener('click', () => {
            const section = button.getAttribute('data-section');
            showAddItemModal(section);
        });
    });

    // Add inventory button
    document.querySelectorAll('.js-add-inventory-btn').forEach(button => {
        button.addEventListener('click', () => {
            const section = button.getAttribute('data-section');
            showAddInventoryModal(section);
        });
    });

    // Add supplier button
    document.querySelectorAll('.js-add-supplier-btn').forEach(button => {
        button.addEventListener('click', () => {
            const section = button.getAttribute('data-section');
            showAddSupplierModal(section);
        });
    });

    // Add purchase order button
    document.querySelectorAll('.js-add-purchase-order-btn').forEach(button => {
        button.addEventListener('click', () => {
            const section = button.getAttribute('data-section');
            showAddPurchaseOrderModal(section);
        });
    });

    // Checkout button
    document.querySelectorAll('.js-checkout-btn').forEach(button => {
        button.addEventListener('click', () => {
            const section = button.getAttribute('data-section');
            processCheckout(section);
        });
    });

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(button => {
        button.addEventListener('click', () => {
            const section = button.getAttribute('data-section');
            const filter = button.getAttribute('data-filter');
            
            if (!section) {
                document.querySelectorAll('.filter-btn:not([data-section])').forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                currentFilter = filter;
                loadTotalInventoryTable();
                return;
            }
            
            document.querySelectorAll(`[data-section="${section}"].filter-btn`).forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentFilter = filter;
            loadInventoryTable(section);
        });
    });

    // Total inventory search
    const totalInventorySearch = document.getElementById('total-inventory-search');
    if (totalInventorySearch) {
        totalInventorySearch.addEventListener('input', function() {
            filterTotalInventory(this.value);
        });
    }

    // Modal confirm buttons
    const addItemConfirmBtn = document.querySelector('.js-add-item-confirm-btn');
    if (addItemConfirmBtn) addItemConfirmBtn.addEventListener('click', addNewItem);
    
    const addInventoryConfirmBtn = document.querySelector('.js-add-inventory-confirm-btn');
    if (addInventoryConfirmBtn) addInventoryConfirmBtn.addEventListener('click', addNewInventory);
    
    const addSupplierConfirmBtn = document.querySelector('.js-add-supplier-confirm-btn');
    if (addSupplierConfirmBtn) addSupplierConfirmBtn.addEventListener('click', addNewSupplier);
    
    const addPurchaseOrderConfirmBtn = document.querySelector('.js-add-purchase-order-confirm-btn');
    if (addPurchaseOrderConfirmBtn) addPurchaseOrderConfirmBtn.addEventListener('click', addNewPurchaseOrder);
    
    const updateInventoryBtn = document.querySelector('.js-update-inventory-btn');
    if (updateInventoryBtn) updateInventoryBtn.addEventListener('click', updateInventoryItem);
    
    const updateSupplierBtn = document.querySelector('.js-update-supplier-btn');
    if (updateSupplierBtn) updateSupplierBtn.addEventListener('click', updateSupplier);
    
    const updatePurchaseOrderBtn = document.querySelector('.js-update-purchase-order-btn');
    if (updatePurchaseOrderBtn) updatePurchaseOrderBtn.addEventListener('click', updatePurchaseOrder);
    
    const completeCheckoutBtn = document.querySelector('.js-complete-checkout-btn');
    if (completeCheckoutBtn) completeCheckoutBtn.addEventListener('click', completeCheckout);
    
    const resetPasswordBtn = document.querySelector('.js-reset-password-btn');
    if (resetPasswordBtn) resetPasswordBtn.addEventListener('click', resetPassword);

    // Event Delegation for dynamic content
    setupEventDelegation();
});

// ... (The rest of your functions like setupEventDelegation, initializeApp, etc., remain the same) ...
// For brevity, I am not including all the UI functions, as the core fixes are above.
// Please ensure you keep all your existing functions below this line.

function setupEventDelegation() { /* ... your existing code ... */ }
function initializeApp() { /* ... your existing code ... */ }
function initializePOSSearch(section) { /* ... your existing code ... */ }
function updateCart(section) { /* ... your existing code ... */ }
function loadInventoryTable(section) { /* ... your existing code ... */ }
function loadSuppliersTable(section) { /* ... your existing code ... */ }
function loadPurchaseOrdersTable(section) { /* ... your existing code ... */ }
function updateTotalInventory() { /* ... your existing code ... */ }
function loadTotalInventoryTable() { /* ... your existing code ... */ }
function filterTotalInventory(searchTerm) { /* ... your existing code ... */ }
function resetPassword() { /* ... your existing code ... */ }
function showAddItemModal(section) { /* ... your existing code ... */ }
function addNewItem() { /* ... your existing code ... */ }
function showAddInventoryModal(section) { /* ... your existing code ... */ }
function addNewInventory() { /* ... your existing code ... */ }
function showAddSupplierModal(section) { /* ... your existing code ... */ }
function addNewSupplier() { /* ... your existing code ... */ }
function showAddPurchaseOrderModal(section) { /* ... your existing code ... */ }
function addNewPurchaseOrder() { /* ... your existing code ... */ }
function editInventoryItem(section, itemId) { /* ... your existing code ... */ }
function updateInventoryItem() { /* ... your existing code ... */ }
function editSupplier(section, supplierId) { /* ... your existing code ... */ }
function updateSupplier() { /* ... your existing code ... */ }
function editPurchaseOrder(section, orderId) { /* ... your existing code ... */ }
function updatePurchaseOrder() { /* ... your existing code ... */ }
function receivePurchaseOrder(section, orderId) { /* ... your existing code ... */ }
function deleteInventoryItem(section, itemId) { /* ... your existing code ... */ }
function deleteSupplier(section, supplierId) { /* ... your existing code ... */ }
function deletePurchaseOrder(section, orderId) { /* ... your existing code ... */ }
function addToCart(section, item) { /* ... your existing code ... */ }
function incrementQuantity(section, itemId) { /* ... your existing code ... */ }
function decrementQuantity(section, itemId) { /* ... your existing code ... */ }
function removeFromCart(section, itemId) { /* ... your existing code ... */ }
function processCheckout(section) { /* ... your existing code ... */ }
function completeCheckout() { /* ... your existing code ... */ }
function filterInventory(section, searchTerm) { /* ... your existing code ... */ }
function updateReports(section) { /* ... your existing code ... */ }
function updatePurchaseReports(section) { /* ... your existing code ... */ }
function updateFinancialReports(section) { /* ... your existing code ... */ }
function updateUserStats(section) { /* ... your existing code ... */ }
function updateDepartmentStats(section) { /* ... your existing code ... */ }
function resetToPOSView(section) { /* ... your existing code ... */ }
function closeModal(modalId) { /* ... your existing code ... */ }
function showNotification(message, type = 'info') { /* ... your existing code ... */ }

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js')
      .then(function(registration) {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch(function(err) {
        console.log('ServiceWorker registration failed: ', err);
      });
  });
}
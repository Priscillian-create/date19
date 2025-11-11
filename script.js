// =============================================================================
// CORRECTED script.js - Resolves Supabase Schema Mismatch Errors
// =============================================================================

// Initialize Supabase
const supabase = window.supabase.createClient(
    'https://qgayglybnnrhobcvftrs.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnYXlnbHlibm5yaG9iY3ZmdHJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2ODQ5ODMsImV4cCI6MjA3ODI2MDk4M30.dqiEe-v1cro5N4tuawu7Y1x5klSyjINsLHd9-V40QjQ'
  );
  
  // App configuration
  const sections = ['grill', 'wholesale', 'building', 'food'];
  const sectionNames = {
    'grill': 'Grill', 'wholesale': 'Wholesale',
    'building': 'Building Material', 'food': 'Food Supplies'
  };
  
  // Initialize data structures
  const dataStores = {
    inventory: {}, carts: {}, salesData: {}, purchaseData: {},
    userData: {}, suppliers: {}, purchaseOrders: {}
  };
  
  // Initialize empty data for each section
  sections.forEach(section => {
    dataStores.inventory[section] = [];
    dataStores.carts[section] = [];
    dataStores.salesData[section] = {
      totalSales: 0, totalTransactions: 0, avgTransaction: 0, topItem: '-',
      dailySales: 0, dailyTransactions: 0, profit: 0, profitMargin: 0
    };
    dataStores.purchaseData[section] = {
      totalPurchases: 0, totalTransactions: 0, avgTransaction: 0,
      topSupplier: '-', dailyPurchases: 0, dailyTransactions: 0
    };
    dataStores.userData[section] = { transactions: 0, sales: 0, purchases: 0 };
    dataStores.suppliers[section] = [];
    dataStores.purchaseOrders[section] = [];
  });
  
  // App state
  let currentSection = 'grill';
  let currentView = 'pos';
  let currentFilter = 'all';
  let currentUser = null;
  
  // Utility functions
  const utils = {
    generateOfflineId: () => 'offline_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
  
    saveToLocalStorage: (key, data) => {
      try { localStorage.setItem(key, JSON.stringify(data)); }
      catch (e) { console.error('Error saving to localStorage:', e); }
    },
  
    loadFromLocalStorage: (key, defaultValue = null) => {
      try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultValue;
      } catch (e) {
        console.error('Error loading from localStorage:', e);
        return defaultValue;
      }
    },
  
    isExpired: (expiryDate) => {
      if (!expiryDate) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expiry = new Date(expiryDate);
      return expiry < today;
    },
  
    isExpiringSoon: (expiryDate) => {
      if (!expiryDate) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expiry = new Date(expiryDate);
      const diffTime = expiry - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffTime > 0 && diffDays <= 7;
    },
  
    getProductStatus: (item) => {
      if (utils.isExpired(item.expiry_date)) return 'expired';
      if (utils.isExpiringSoon(item.expiry_date)) return 'expiring-soon';
      if (item.stock === 0) return 'out-of-stock';
      if (item.stock < 10) return 'low-stock';
      return 'in-stock';
    },
  
    formatDate: (dateString) => {
      if (!dateString) return 'N/A';
      return new Date(dateString).toLocaleDateString();
    },
  
    validateForm: (formId, requiredFields) => {
      const form = document.getElementById(formId);
      if (!form) return { isValid: false, message: 'Form not found.' };
  
      const missingFields = [];
      requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (!field || field.value.trim() === '') {
          missingFields.push(field?.getAttribute('data-label') || fieldId);
        }
      });
  
      return missingFields.length > 0
        ? { isValid: false, message: `Please fill in all required fields: ${missingFields.join(', ')}.` }
        : { isValid: true };
    },
  
    showNotification: (message, type = 'info') => {
      const notification = document.getElementById('notification');
      if (!notification) return;
  
      notification.textContent = message;
      notification.className = `notification ${type}`;
      notification.classList.add('show');
      setTimeout(() => notification.classList.remove('show'), 3000);
    }
  };
  
  // Data management
  const dataManager = {
    loadDataFromLocalStorage: () => {
      sections.forEach(section => {
        Object.keys(dataStores).forEach(store => {
          const localData = utils.loadFromLocalStorage(`${store}_${section}`,
            Array.isArray(dataStores[store][section]) ? [] : {});
          if (store === 'salesData' || store === 'purchaseData' || store === 'userData') {
            if (Object.keys(localData).length > 0) dataStores[store][section] = localData;
          } else if (localData.length > 0) {
            dataStores[store][section] = localData;
          }
        });
      });
    },
  
    // =============================================================================
    // CRITICAL FIX: saveDataToSupabase function
    // This function now strictly filters data to match the database schema.
    // =============================================================================
    saveDataToSupabase: async (table, data, id = null) => {
      data.timestamp = new Date().toISOString();
      data.userId = currentUser ? currentUser.id : 'offline_user';
  
      const localKey = `${table}_${id || 'new'}`;
      utils.saveToLocalStorage(localKey, data);
  
      // Update local data structures (this part remains the same)
      if (table === 'inventory') {
        if (!id) {
          id = utils.generateOfflineId();
          data.id = id;
          data.isOffline = true;
          dataStores.inventory[data.section].push(data);
        } else {
          const index = dataStores.inventory[data.section].findIndex(item => item.id === id);
          if (index !== -1) {
            dataStores.inventory[data.section][index] = {
              ...dataStores.inventory[data.section][index], ...data
            };
          }
        }
        utils.saveToLocalStorage(`inventory_${data.section}`, dataStores.inventory[data.section]);
        uiManager.loadInventoryTable(data.section);
        uiManager.updateDepartmentStats(data.section);
        uiManager.updateCategoryInventorySummary(data.section);
        uiManager.updateTotalInventory();
      } else if (table === 'sales') {
        const section = data.section;
        const totalProfit = dataManager.calculateSaleProfit(data.items);
  
        dataStores.salesData[section].totalSales += data.total;
        dataStores.salesData[section].totalTransactions += 1;
        dataStores.salesData[section].avgTransaction =
          dataStores.salesData[section].totalSales / dataStores.salesData[section].totalTransactions;
        dataStores.salesData[section].dailySales += data.total;
        dataStores.salesData[section].dailyTransactions += 1;
        dataStores.salesData[section].profit += totalProfit;
        dataStores.salesData[section].profitMargin = dataStores.salesData[section].totalSales > 0 ?
          (dataStores.salesData[section].profit / dataStores.salesData[section].totalSales) * 100 : 0;
  
        dataStores.userData[section].transactions += 1;
        dataStores.userData[section].sales += data.total;
  
        utils.saveToLocalStorage(`salesData_${section}`, dataStores.salesData[section]);
        utils.saveToLocalStorage(`userData_${section}`, dataStores.userData[section]);
  
        uiManager.updateReports(section);
        uiManager.updateUserStats(section);
        uiManager.updateDepartmentStats(section);
      } else if (table === 'purchases') {
        const section = data.section;
  
        dataStores.purchaseData[section].totalPurchases += data.total;
        dataStores.purchaseData[section].totalTransactions += 1;
        dataStores.purchaseData[section].avgTransaction =
          dataStores.purchaseData[section].totalPurchases / dataStores.purchaseData[section].totalTransactions;
        dataStores.purchaseData[section].dailyPurchases += data.total;
        dataStores.purchaseData[section].dailyTransactions += 1;
  
        dataStores.userData[section].purchases += data.total;
  
        utils.saveToLocalStorage(`purchaseData_${section}`, dataStores.purchaseData[section]);
        utils.saveToLocalStorage(`userData_${section}`, dataStores.userData[section]);
  
        uiManager.updatePurchaseReports(section);
        uiManager.updateUserStats(section);
        uiManager.updateDepartmentStats(section);
      } else if (table === 'suppliers') {
        const section = data.section;
        if (!id) {
          id = utils.generateOfflineId();
          data.id = id;
          data.isOffline = true;
          dataStores.suppliers[section].push(data);
        } else {
          const index = dataStores.suppliers[section].findIndex(supplier => supplier.id === id);
          if (index !== -1) {
            dataStores.suppliers[section][index] = {
              ...dataStores.suppliers[section][index], ...data
            };
          }
        }
        utils.saveToLocalStorage(`suppliers_${section}`, dataStores.suppliers[section]);
        uiManager.loadSuppliersTable(section);
      } else if (table === 'purchase_orders') {
        const section = data.section;
        if (!id) {
          id = utils.generateOfflineId();
          data.id = id;
          data.isOffline = true;
          data.status = 'pending';
          dataStores.purchaseOrders[section].push(data);
        } else {
          const index = dataStores.purchaseOrders[section].findIndex(order => order.id === id);
          if (index !== -1) {
            dataStores.purchaseOrders[section][index] = {
              ...dataStores.purchaseOrders[section][index], ...data
            };
          }
        }
        utils.saveToLocalStorage(`purchaseOrders_${section}`, dataStores.purchaseOrders[section]);
        uiManager.loadPurchaseOrdersTable(section);
      } else if (table === 'sales_data') {
        const section = id;
        if (section && dataStores.salesData[section]) {
          dataStores.salesData[section] = { ...dataStores.salesData[section], ...data };
          utils.saveToLocalStorage(`salesData_${section}`, dataStores.salesData[section]);
          uiManager.updateReports(section);
          uiManager.updateDepartmentStats(section);
        }
      } else if (table === 'purchase_data') {
        const section = id;
        if (section && dataStores.purchaseData[section]) {
          dataStores.purchaseData[section] = { ...dataStores.purchaseData[section], ...data };
          utils.saveToLocalStorage(`purchaseData_${section}`, dataStores.purchaseData[section]);
          uiManager.updatePurchaseReports(section);
          uiManager.updateDepartmentStats(section);
        }
      } else if (table === 'user_data') {
        const section = id;
        if (section && dataStores.userData[section]) {
          dataStores.userData[section] = { ...dataStores.userData[section], ...data };
          utils.saveToLocalStorage(`userData_${section}`, dataStores.userData[section]);
          uiManager.updateUserStats(section);
        }
      }
  
      // Sync with Supabase if online
      if (navigator.onLine) {
        try {
          let dataForSupabase = { ...data };
          delete dataForSupabase.isOffline;
          delete dataForSupabase.timestamp; // timestamp is not a DB column
          delete dataForSupabase.userId;   // userId is not a DB column
  
          if (!id || id.startsWith('offline_')) {
            delete dataForSupabase.id;
          }
  
          // --- Table-specific data cleaning: ONLY INCLUDE COLUMNS THAT EXIST IN YOUR DATABASE ---
          if (table === 'inventory') {
            const { section, name, price, cost, stock, expiry_date, description, status, created_by, created_at, updated_by, updated_at, deleted, deleted_at } = dataForSupabase;
            const cleanExpiryDate = expiry_date && expiry_date.trim() !== '' ? expiry_date : null;
            dataForSupabase = { section, name, price, cost, stock, expiry_date: cleanExpiryDate, description, status, created_by, created_at, updated_by, updated_at, deleted, deleted_at };
          } else if (table === 'sales') {
            // FIX: Removed 'profitMargin' as it's not a column in the DB.
            const { user_id, user_email, section, items, subtotal, total, totalCost, totalProfit, payment_method, customer_name, customer_phone, timestamp } = dataForSupabase;
            dataForSupabase = { user_id, user_email, section, items, subtotal, total, totalCost, totalProfit, payment_method, customer_name, customer_phone, timestamp };
          } else if (table === 'sales_data') {
            // FIX: Removed 'avgTransaction' and 'profitMargin' as they are not columns in the DB.
            const { id, totalSales, totalTransactions, topItem, dailySales, dailyTransactions, profit } = dataForSupabase;
            dataForSupabase = { id, totalSales, totalTransactions, topItem, dailySales, dailyTransactions, profit };
          } else if (table === 'user_data') {
            // FIX: Removed 'userId' as it's not a column in the DB.
            const { id, transactions, sales, purchases } = dataForSupabase;
            dataForSupabase = { id, transactions, sales, purchases };
          } else if (table === 'purchase_orders') {
            const { section, orderNumber, supplierId, supplierName, productName, quantity, cost, total, orderDate, status, created_by, created_at, updated_by, updated_at, deleted, deleted_at, receivedDate } = dataForSupabase;
            dataForSupabase = { section, orderNumber, supplierId, supplierName, productName, quantity, cost, total, orderDate, status, created_by, created_at, updated_by, updated_at, deleted, deleted_at, receivedDate };
          }
          // --- END OF FIX ---
  
          let result;
          if (id && !id.startsWith('offline_')) {
            const { data: resultData, error } = await supabase
              .from(table)
              .update(dataForSupabase)
              .eq('id', id)
              .select();
  
            if (error) throw error;
            result = resultData[0];
          } else {
            const { data: resultData, error } = await supabase
              .from(table)
              .insert(dataForSupabase)
              .select();
  
            if (error) throw error;
            result = resultData[0];
  
            // Update local data with real ID
            if (table === 'inventory' || table === 'suppliers' || table === 'purchase_orders') {
              const dataArray = table === 'inventory' ? dataStores.inventory[data.section] :
                table === 'suppliers' ? dataStores.suppliers[data.section] :
                  dataStores.purchaseOrders[data.section];
  
              const index = dataArray.findIndex(item => item.id === id);
              if (index !== -1) {
                dataArray[index].id = result.id;
                dataArray[index].isOffline = false;
                localStorage.removeItem(localKey);
                utils.saveToLocalStorage(`${table}_${data.section}`, dataArray);
              }
            }
          }
  
          return result;
        } catch (error) {
          console.error(`Error saving to ${table}:`, error);
          utils.showNotification(`Error saving to ${table}: ${error.message}`, 'error');
  
          // Store for later sync
          const pendingChanges = utils.loadFromLocalStorage('pendingChanges', {});
          if (!pendingChanges[table]) pendingChanges[table] = {};
  
          if (id && !id.startsWith('offline_')) {
            pendingChanges[table][id] = data;
          } else {
            if (!pendingChanges[table].new) pendingChanges[table].new = [];
            pendingChanges[table].new.push(data);
          }
  
          utils.saveToLocalStorage('pendingChanges', pendingChanges);
          return { id };
        }
      } else {
        // Store for later sync
        const pendingChanges = utils.loadFromLocalStorage('pendingChanges', {});
        if (!pendingChanges[table]) pendingChanges[table] = {};
  
        if (id && !id.startsWith('offline_')) {
          pendingChanges[table][id] = data;
        } else {
          if (!pendingChanges[table].new) pendingChanges[table].new = [];
          pendingChanges[table].new.push(data);
        }
  
        utils.saveToLocalStorage('pendingChanges', pendingChanges);
        return { id };
      }
    },
  
    calculateSaleProfit: (items) => {
      let totalCost = 0;
      items.forEach(item => {
        const inventoryItem = dataStores.inventory[currentSection].find(invItem => invItem.id === item.id);
        if (inventoryItem) {
          totalCost += (inventoryItem.cost || 0) * item.quantity;
        }
      });
      return items.reduce((sum, item) => sum + item.total, 0) - totalCost;
    },
  
    // =============================================================================
    // CRITICAL FIX: syncPendingChanges function
    // This function also needs to filter data to match the database schema.
    // =============================================================================
    syncPendingChanges: async () => {
      if (!navigator.onLine) return;
  
      const syncStatus = document.getElementById('syncStatus');
      if (syncStatus) syncStatus.classList.add('show');
  
      const pendingChanges = utils.loadFromLocalStorage('pendingChanges', {});
  
      if (Object.keys(pendingChanges).length > 0) {
        const promises = [];
  
        Object.keys(pendingChanges).forEach(table => {
          // Process new documents
          if (pendingChanges[table].new && pendingChanges[table].new.length > 0) {
            pendingChanges[table].new.forEach(data => {
              let dataForSupabase = { ...data };
              delete dataForSupabase.isOffline;
              delete dataForSupabase.timestamp;
              delete dataForSupabase.id;
  
              // --- Table-specific data cleaning: ONLY INCLUDE COLUMNS THAT EXIST IN YOUR DATABASE ---
              if (table === 'inventory') {
                const { section, name, price, cost, stock, expiry_date, description, status, created_by, created_at, updated_by, updated_at, deleted, deleted_at } = dataForSupabase;
                const cleanExpiryDate = expiry_date && expiry_date.trim() !== '' ? expiry_date : null;
                dataForSupabase = { section, name, price, cost, stock, expiry_date: cleanExpiryDate, description, status, created_by, created_at, updated_by, updated_at, deleted, deleted_at };
              } else if (table === 'sales') {
                const { user_id, user_email, section, items, subtotal, total, totalCost, totalProfit, payment_method, customer_name, customer_phone, timestamp } = dataForSupabase;
                dataForSupabase = { user_id, user_email, section, items, subtotal, total, totalCost, totalProfit, payment_method, customer_name, customer_phone, timestamp };
              } else if (table === 'sales_data') {
                const { id, totalSales, totalTransactions, topItem, dailySales, dailyTransactions, profit } = dataForSupabase;
                dataForSupabase = { id, totalSales, totalTransactions, topItem, dailySales, dailyTransactions, profit };
              } else if (table === 'user_data') {
                const { id, transactions, sales, purchases } = dataForSupabase;
                dataForSupabase = { id, transactions, sales, purchases };
              } else if (table === 'purchase_orders') {
                const { section, orderNumber, supplierId, supplierName, productName, quantity, cost, total, orderDate, status, created_by, created_at, updated_by, updated_at, deleted, deleted_at, receivedDate } = dataForSupabase;
                dataForSupabase = { section, orderNumber, supplierId, supplierName, productName, quantity, cost, total, orderDate, status, created_by, created_at, updated_by, updated_at, deleted, deleted_at, receivedDate };
              }
              // --- END OF FIX ---
  
              promises.push(
                supabase
                  .from(table)
                  .insert(dataForSupabase)
                  .select()
                  .then(({ data: result, error }) => {
                    if (error) throw error;
                    // Update local data with real ID logic here...
                    return result[0];
                  })
              );
            });
          }
  
          // Process existing documents
          Object.keys(pendingChanges[table]).forEach(id => {
            if (id !== 'new' && pendingChanges[table][id]) {
              const data = pendingChanges[table][id];
              let dataForSupabase = { ...data };
              delete dataForSupabase.isOffline;
              delete dataForSupabase.timestamp;
  
              // --- Table-specific data cleaning: ONLY INCLUDE COLUMNS THAT EXIST IN YOUR DATABASE ---
              // (Same cleaning logic as above for updates)
              if (table === 'inventory') {
                const { section, name, price, cost, stock, expiry_date, description, status, created_by, created_at, updated_by, updated_at, deleted, deleted_at } = dataForSupabase;
                const cleanExpiryDate = expiry_date && expiry_date.trim() !== '' ? expiry_date : null;
                dataForSupabase = { section, name, price, cost, stock, expiry_date: cleanExpiryDate, description, status, created_by, created_at, updated_by, updated_at, deleted, deleted_at };
              } else if (table === 'sales') {
                const { user_id, user_email, section, items, subtotal, total, totalCost, totalProfit, payment_method, customer_name, customer_phone, timestamp } = dataForSupabase;
                dataForSupabase = { user_id, user_email, section, items, subtotal, total, totalCost, totalProfit, payment_method, customer_name, customer_phone, timestamp };
              } else if (table === 'sales_data') {
                const { id, totalSales, totalTransactions, topItem, dailySales, dailyTransactions, profit } = dataForSupabase;
                dataForSupabase = { id, totalSales, totalTransactions, topItem, dailySales, dailyTransactions, profit };
              } else if (table === 'user_data') {
                const { id, transactions, sales, purchases } = dataForSupabase;
                dataForSupabase = { id, transactions, sales, purchases };
              } else if (table === 'purchase_orders') {
                const { section, orderNumber, supplierId, supplierName, productName, quantity, cost, total, orderDate, status, created_by, created_at, updated_by, updated_at, deleted, deleted_at, receivedDate } = dataForSupabase;
                dataForSupabase = { section, orderNumber, supplierId, supplierName, productName, quantity, cost, total, orderDate, status, created_by, created_at, updated_by, updated_at, deleted, deleted_at, receivedDate };
              }
              // --- END OF FIX ---
  
              promises.push(
                supabase
                  .from(table)
                  .update(dataForSupabase)
                  .eq('id', id)
                  .select()
                  .then(({ data: result, error }) => {
                    if (error) throw error;
                    return result[0];
                  })
              );
            }
          });
        });
  
        try {
          await Promise.all(promises);
          localStorage.removeItem('pendingChanges');
          if (syncStatus) syncStatus.classList.remove('show');
          utils.showNotification('All changes synced successfully', 'success');
          dataManager.loadDataFromSupabase();
        } catch (error) {
          console.error('Error syncing changes:', error);
          if (syncStatus) syncStatus.classList.remove('show');
          utils.showNotification('Error syncing changes. Please try again later.', 'error');
        }
      } else {
        if (syncStatus) syncStatus.classList.remove('show');
      }
    },
  
    loadDataFromSupabase: async () => {
      if (!navigator.onLine) return;
  
      try {
        // Load inventory
        sections.forEach(section => {
          supabase
            .from('inventory')
            .select('*')
            .eq('section', section)
            .then(({ data, error }) => {
              if (error) {
                console.error(`Error loading ${section} inventory:`, error);
                utils.showNotification(`Error loading ${section} inventory. Using cached data.`, 'warning');
                return;
              }
  
              dataStores.inventory[section] = data || [];
              utils.saveToLocalStorage(`inventory_${section}`, dataStores.inventory[section]);
              uiManager.loadInventoryTable(section);
              uiManager.updateDepartmentStats(section);
              uiManager.updateCategoryInventorySummary(section);
              uiManager.updateTotalInventory();
            });
        });
  
        // Load suppliers
        sections.forEach(section => {
          supabase
            .from('suppliers')
            .select('*')
            .eq('section', section)
            .then(({ data, error }) => {
              if (error) {
                console.error(`Error loading ${section} suppliers:`, error);
                utils.showNotification(`Error loading ${section} suppliers. Using cached data.`, 'warning');
                return;
              }
  
              dataStores.suppliers[section] = data || [];
              utils.saveToLocalStorage(`suppliers_${section}`, dataStores.suppliers[section]);
              uiManager.loadSuppliersTable(section);
            });
        });
  
        // Load purchase orders
        sections.forEach(section => {
          supabase
            .from('purchase_orders')
            .select('*')
            .eq('section', section)
            .then(({ data, error }) => {
              if (error) {
                console.error(`Error loading ${section} purchase orders:`, error);
                utils.showNotification(`Error loading ${section} purchase orders. Using cached data.`, 'warning');
                return;
              }
  
              dataStores.purchaseOrders[section] = data || [];
              utils.saveToLocalStorage(`purchaseOrders_${section}`, dataStores.purchaseOrders[section]);
              uiManager.loadPurchaseOrdersTable(section);
            });
        });
  
        // Load sales data
        sections.forEach(section => {
          supabase
            .from('sales_data')
            .select('*')
            .eq('id', section)
            .single()
            .then(({ data, error }) => {
              if (error && error.code !== 'PGRST116') {
                console.error(`Error loading ${section} sales data:`, error);
                utils.showNotification(`Error loading ${section} sales data. Using cached data.`, 'warning');
                return;
              }
  
              if (data) {
                dataStores.salesData[section] = {
                  totalSales: data.totalSales || 0,
                  totalTransactions: data.totalTransactions || 0,
                  avgTransaction: data.totalSales && data.totalTransactions ? data.totalSales / data.totalTransactions : 0,
                  topItem: data.topItem || '-',
                  dailySales: data.dailySales || 0,
                  dailyTransactions: data.dailyTransactions || 0,
                  profit: data.profit || 0,
                  profitMargin: data.totalSales && data.profit ? (data.profit / data.totalSales) * 100 : 0
                };
                utils.saveToLocalStorage(`salesData_${section}`, dataStores.salesData[section]);
                uiManager.updateReports(section);
                uiManager.updateDepartmentStats(section);
              } else {
                // Create initial record
                const initialSalesData = {
                  id: section,
                  totalSales: 0, totalTransactions: 0, topItem: '-',
                  dailySales: 0, dailyTransactions: 0, profit: 0
                };
                supabase
                  .from('sales_data')
                  .insert(initialSalesData)
                  .then(({ data, error }) => {
                    if (!error) {
                      dataStores.salesData[section] = {
                        totalSales: 0, totalTransactions: 0, avgTransaction: 0, topItem: '-',
                        dailySales: 0, dailyTransactions: 0, profit: 0, profitMargin: 0
                      };
                      utils.saveToLocalStorage(`salesData_${section}`, dataStores.salesData[section]);
                      uiManager.updateReports(section);
                      uiManager.updateDepartmentStats(section);
                    }
                  });
              }
            });
        });
  
        // Load purchase data
        sections.forEach(section => {
          supabase
            .from('purchase_data')
            .select('*')
            .eq('id', section)
            .single()
            .then(({ data, error }) => {
              if (error && error.code !== 'PGRST116') {
                console.error(`Error loading ${section} purchase data:`, error);
                utils.showNotification(`Error loading ${section} purchase data. Using cached data.`, 'warning');
                return;
              }
  
              if (data) {
                dataStores.purchaseData[section] = {
                  totalPurchases: data.totalPurchases || 0,
                  totalTransactions: data.totalTransactions || 0,
                  avgTransaction: data.totalPurchases && data.totalTransactions ? data.totalPurchases / data.totalTransactions : 0,
                  topSupplier: data.topSupplier || '-',
                  dailyPurchases: data.dailyPurchases || 0,
                  dailyTransactions: data.dailyTransactions || 0
                };
                utils.saveToLocalStorage(`purchaseData_${section}`, dataStores.purchaseData[section]);
                uiManager.updatePurchaseReports(section);
                uiManager.updateDepartmentStats(section);
              } else {
                // Create initial record
                const initialPurchaseData = {
                  id: section,
                  totalPurchases: 0, totalTransactions: 0,
                  topSupplier: '-', dailyPurchases: 0, dailyTransactions: 0
                };
                supabase
                  .from('purchase_data')
                  .insert(initialPurchaseData)
                  .then(({ data, error }) => {
                    if (!error) {
                      dataStores.purchaseData[section] = {
                        totalPurchases: 0, totalTransactions: 0, avgTransaction: 0,
                        topSupplier: '-', dailyPurchases: 0, dailyTransactions: 0
                      };
                      utils.saveToLocalStorage(`purchaseData_${section}`, dataStores.purchaseData[section]);
                      uiManager.updatePurchaseReports(section);
                      uiManager.updateDepartmentStats(section);
                    }
                  });
              }
            });
        });
  
        // Load user data
        sections.forEach(section => {
          supabase
            .from('user_data')
            .select('*')
            .eq('id', section)
            .single()
            .then(({ data, error }) => {
              if (error && error.code !== 'PGRST116') {
                console.error(`Error loading ${section} user data:`, error);
                utils.showNotification(`Error loading ${section} user data. Using cached data.`, 'warning');
                return;
              }
  
              if (data) {
                dataStores.userData[section] = {
                  transactions: data.transactions || 0,
                  sales: data.sales || 0,
                  purchases: data.purchases || 0
                };
                utils.saveToLocalStorage(`userData_${section}`, dataStores.userData[section]);
                uiManager.updateUserStats(section);
              } else {
                // Create initial record
                const initialUserData = {
                  id: section,
                  transactions: 0, sales: 0, purchases: 0
                };
                supabase
                  .from('user_data')
                  .insert(initialUserData)
                  .then(({ data, error }) => {
                    if (!error) {
                      dataStores.userData[section] = {
                        transactions: 0, sales: 0, purchases: 0
                      };
                      utils.saveToLocalStorage(`userData_${section}`, dataStores.userData[section]);
                      uiManager.updateUserStats(section);
                    }
                  });
              }
            });
        });
      } catch (error) {
        console.error('Error loading data from Supabase:', error);
        utils.showNotification('Error loading data from server. Using cached data.', 'warning');
      }
    }
  };
  
  // UI management
  const uiManager = {
    updateUserInfo: (user) => {
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
    },
  
    handleOnlineStatus: () => {
      const offlineIndicator = document.getElementById('offlineIndicator');
      if (offlineIndicator) offlineIndicator.classList.remove('show');
      utils.showNotification('Connection restored. Syncing data...', 'info');
      dataManager.syncPendingChanges();
    },
  
    handleOfflineStatus: () => {
      const offlineIndicator = document.getElementById('offlineIndicator');
      if (offlineIndicator) offlineIndicator.classList.add('show');
      utils.showNotification('You\'re now offline. Changes will be saved locally.', 'warning');
    },
  
    initializeApp: () => {
      sections.forEach(section => {
        uiManager.initializePOSSearch(section);
        uiManager.updateCart(section);
        uiManager.updateDepartmentStats(section);
        uiManager.loadInventoryTable(section);
        uiManager.updateReports(section);
        uiManager.updatePurchaseReports(section);
        uiManager.updateFinancialReports(section);
        uiManager.loadSuppliersTable(section);
        uiManager.loadPurchaseOrdersTable(section);
        uiManager.updateUserStats(section);
        uiManager.updateCategoryInventorySummary(section);
  
        const form = document.getElementById(`${section}-account-form`);
        if (form) {
          form.addEventListener('submit', function(e) {
            e.preventDefault();
            // saveAccountInfo(section);
          });
        }
  
        const searchInput = document.querySelector(`.js-inventory-search[data-section="${section}"]`);
        if (searchInput) {
          searchInput.addEventListener('input', function() {
            uiManager.filterInventory(section, this.value);
          });
        }
      });
  
      uiManager.updateTotalInventory();
    },
  
    initializePOSSearch: (section) => {
      const searchInput = document.querySelector(`.js-pos-search[data-section="${section}"]`);
      const searchResults = document.querySelector(`.js-pos-search-results[data-section="${section}"]`);
  
      if (searchInput) {
        searchInput.addEventListener('input', function() {
          const searchTerm = this.value.trim().toLowerCase();
  
          if (searchTerm.length === 0) {
            searchResults.innerHTML = `
              <div class="empty-state">
                <div class="empty-state-icon"><i class="fas fa-search"></i></div>
                <h3 class="empty-state-title">Search for Products</h3>
                <p class="empty-state-description">Type in the search box above to find products from your inventory.</p>
              </div>
            `;
            return;
          }
  
          const filteredItems = dataStores.inventory[section].filter(item =>
            item.name.toLowerCase().includes(searchTerm)
          );
  
          if (filteredItems.length === 0) {
            searchResults.innerHTML = `
              <div class="empty-state">
                <div class="empty-state-icon"><i class="fas fa-search"></i></div>
                <h3 class="empty-state-title">No Products Found</h3>
                <p class="empty-state-description">Try a different search term or add new products to your inventory.</p>
              </div>
            `;
          } else {
            searchResults.innerHTML = '';
            filteredItems.forEach(item => {
              const resultItem = document.createElement('div');
              resultItem.className = 'pos-search-result-item';
              resultItem.setAttribute('data-id', item.id);
  
              resultItem.innerHTML = `
                <div class="pos-item-info">
                  <div class="pos-item-name">${item.name}</div>
                  <div class="pos-item-stock">Stock: ${item.stock}</div>
                </div>
                <div class="pos-item-price">₦${item.price.toFixed(2)}</div>
              `;
  
              searchResults.appendChild(resultItem);
            });
          }
        });
      }
    },
  
    updateCart: (section) => {
      const cartItemsContainer = document.querySelector(`.js-cart-items[data-section="${section}"]`);
      if (!cartItemsContainer) return;
  
      cartItemsContainer.innerHTML = '';
      let subtotal = 0;
  
      if (dataStores.carts[section].length === 0) {
        cartItemsContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon"><i class="fas fa-shopping-cart"></i></div>
            <h3 class="empty-state-title">Your Cart is Empty</h3>
            <p class="empty-state-description">Search for products to add to your cart.</p>
          </div>
        `;
        const checkoutBtn = document.querySelector(`.js-checkout-btn[data-section="${section}"]`);
        if (checkoutBtn) checkoutBtn.disabled = true;
      } else {
        dataStores.carts[section].forEach(item => {
          const cartItem = document.createElement('div');
          cartItem.className = 'cart-item';
          cartItem.setAttribute('data-item-id', item.id);
          const itemTotal = item.price * item.quantity;
          subtotal += itemTotal;
  
          cartItem.innerHTML = `
            <div class="cart-item-info">
              <div class="cart-item-name">${item.name}</div>
              <div class="cart-item-details">₦${item.price.toFixed(2)} × ${item.quantity}</div>
            </div>
            <div class="cart-item-actions">
              <button class="quantity-btn">-</button>
              <span>${item.quantity}</span>
              <button class="quantity-btn">+</button>
              <button class="action-btn delete"><i class="fas fa-trash"></i></button>
            </div>
          `;
          cartItemsContainer.appendChild(cartItem);
        });
        const checkoutBtn = document.querySelector(`.js-checkout-btn[data-section="${section}"]`);
        if (checkoutBtn) checkoutBtn.disabled = false;
      }
  
      const subtotalEl = document.querySelector(`.js-subtotal[data-section="${section}"]`);
      if (subtotalEl) subtotalEl.textContent = `₦${subtotal.toFixed(2)}`;
  
      const totalEl = document.querySelector(`.js-total[data-section="${section}"]`);
      if (totalEl) totalEl.textContent = `₦${subtotal.toFixed(2)}`;
    },
  
    loadInventoryTable: (section) => {
      const inventoryContainer = document.querySelector(`.js-inventory-container[data-section="${section}"]`);
      if (!inventoryContainer) return;
  
      inventoryContainer.innerHTML = '';
  
      const searchInput = document.querySelector(`.js-inventory-search[data-section="${section}"]`);
      const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
  
      let filteredItems = dataStores.inventory[section];
      if (currentFilter !== 'all') {
        filteredItems = dataStores.inventory[section].filter(item => {
          const status = utils.getProductStatus(item);
          return status === currentFilter;
        });
      }
  
      if (searchTerm) {
        filteredItems = filteredItems.filter(item =>
          item.name.toLowerCase().includes(searchTerm)
        );
      }
  
      if (filteredItems.length === 0) {
        inventoryContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon"><i class="fas fa-warehouse"></i></div>
            <h3 class="empty-state-title">${searchTerm ? 'No Products Found' : 'No Products in Inventory'}</h3>
            <p class="empty-state-description">${searchTerm ? 'Try a different search term or add new products.' : 'Start by adding products to your inventory.'}</p>
            <button class="btn btn-primary js-add-inventory-btn" data-section="${section}">
              <i class="fas fa-plus"></i> Add Your First Product
            </button>
          </div>
        `;
        return;
      }
  
      const inventoryTable = document.createElement('table');
      inventoryTable.className = 'inventory-table';
  
      inventoryTable.innerHTML = `
        <thead>
          <tr>
            <th>Product</th>
            <th>Price</th>
            <th>Cost</th>
            <th>Profit</th>
            <th>Stock</th>
            <th>Expiry Date</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${filteredItems.map(item => {
            const status = utils.getProductStatus(item);
            let statusClass = '';
            let statusText = '';
  
            if (status === 'in-stock') {
              statusClass = 'status-in-stock';
              statusText = 'In Stock';
            } else if (status === 'low-stock') {
              statusClass = 'status-low-stock';
              statusText = 'Low Stock';
            } else if (status === 'out-of-stock') {
              statusClass = 'status-out-of-stock';
              statusText = 'Out of Stock';
            } else if (status === 'expired') {
              statusClass = 'status-expired';
              statusText = 'Expired';
            } else if (status === 'expiring-soon') {
              statusClass = 'status-expiring-soon';
              statusText = 'Expiring Soon';
            }
  
            const profit = item.price - (item.cost || 0);
            const profitMargin = item.price > 0 ? (profit / item.price) * 100 : 0;
  
            return `
              <tr data-item-id="${item.id}">
                <td>${item.name} ${item.isOffline ? '<i class="fas fa-wifi" style="color: #f39c12;" title="Pending sync"></i>' : ''}</td>
                <td>₦${item.price.toFixed(2)}</td>
                <td>₦${(item.cost || 0).toFixed(2)}</td>
                <td>₦${profit.toFixed(2)} (${profitMargin.toFixed(1)}%)</td>
                <td>${item.stock}</td>
                <td>${utils.formatDate(item.expiry_date)}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                  <button class="action-btn"><i class="fas fa-edit"></i></button>
                  <button class="action-btn delete"><i class="fas fa-trash"></i></button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      `;
  
      inventoryContainer.appendChild(inventoryTable);
    },
  
    loadSuppliersTable: (section) => {
      const suppliersContainer = document.querySelector(`.js-suppliers-container[data-section="${section}"]`);
      if (!suppliersContainer) return;
  
      suppliersContainer.innerHTML = '';
  
      if (dataStores.suppliers[section].length === 0) {
        suppliersContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon"><i class="fas fa-truck"></i></div>
            <h3 class="empty-state-title">No Suppliers Added</h3>
            <p class="empty-state-description">Start by adding suppliers to your department.</p>
            <button class="btn btn-primary js-add-supplier-btn" data-section="${section}">
              <i class="fas fa-plus"></i> Add Your First Supplier
            </button>
          </div>
        `;
        return;
      }
  
      const suppliersTable = document.createElement('table');
      suppliersTable.className = 'inventory-table';
  
      suppliersTable.innerHTML = `
        <thead>
          <tr>
            <th>Supplier</th>
            <th>Contact</th>
            <th>Email</th>
            <th>Products</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${dataStores.suppliers[section].map(supplier => `
            <tr data-item-id="${supplier.id}">
              <td>${supplier.name} ${supplier.isOffline ? '<i class="fas fa-wifi" style="color: #f39c12;" title="Pending sync"></i>' : ''}</td>
              <td>${supplier.phone || 'N/A'}</td>
              <td>${supplier.email || 'N/A'}</td>
              <td>${supplier.products || 'N/A'}</td>
              <td>
                <button class="action-btn"><i class="fas fa-edit"></i></button>
                <button class="action-btn delete"><i class="fas fa-trash"></i></button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      `;
  
      suppliersContainer.appendChild(suppliersTable);
    },
  
    loadPurchaseOrdersTable: (section) => {
      const purchaseOrdersContainer = document.querySelector(`.js-purchase-orders-container[data-section="${section}"]`);
      if (!purchaseOrdersContainer) return;
  
      purchaseOrdersContainer.innerHTML = '';
  
      if (dataStores.purchaseOrders[section].length === 0) {
        purchaseOrdersContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon"><i class="fas fa-file-invoice"></i></div>
            <h3 class="empty-state-title">No Purchase Orders</h3>
            <p class="empty-state-description">Start by creating purchase orders for your department.</p>
            <button class="btn btn-primary js-add-purchase-order-btn" data-section="${section}">
              <i class="fas fa-plus"></i> Create Your First Purchase Order
            </button>
          </div>
        `;
        return;
      }
  
      const purchaseOrdersTable = document.createElement('table');
      purchaseOrdersTable.className = 'inventory-table';
  
      purchaseOrdersTable.innerHTML = `
        <thead>
          <tr>
            <th>Order #</th>
            <th>Supplier</th>
            <th>Date</th>
            <th>Total</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${dataStores.purchaseOrders[section].map(order => {
            let statusClass = '';
            let statusText = '';
  
            if (order.status === 'pending') {
              statusClass = 'status-pending';
              statusText = 'Pending';
            } else if (order.status === 'received') {
              statusClass = 'status-received';
              statusText = 'Received';
            } else if (order.status === 'cancelled') {
              statusClass = 'status-cancelled';
              statusText = 'Cancelled';
            }
  
            return `
              <tr data-item-id="${order.id}">
                <td>${order.orderNumber || order.id} ${order.isOffline ? '<i class="fas fa-wifi" style="color: #f39c12;" title="Pending sync"></i>' : ''}</td>
                <td>${order.supplierName || 'N/A'}</td>
                <td>${utils.formatDate(order.orderDate)}</td>
                <td>₦${order.total.toFixed(2)}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                  <button class="action-btn"><i class="fas fa-edit"></i></button>
                  ${order.status === 'pending' ? `<button class="action-btn receive"><i class="fas fa-check"></i></button>` : ''}
                  <button class="action-btn delete"><i class="fas fa-trash"></i></button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      `;
  
      purchaseOrdersContainer.appendChild(purchaseOrdersTable);
    },
  
    updateTotalInventory: () => {
      let totalProducts = 0;
      let totalValue = 0;
      let totalCost = 0;
      let totalExpired = 0;
      let totalExpiringSoon = 0;
  
      sections.forEach(section => {
        dataStores.inventory[section].forEach(item => {
          totalProducts++;
          totalValue += item.price * item.stock;
          totalCost += (item.cost || 0) * item.stock;
  
          if (utils.isExpired(item.expiry_date)) {
            totalExpired++;
          } else if (utils.isExpiringSoon(item.expiry_date)) {
            totalExpiringSoon++;
          }
        });
      });
  
      const totalProfit = totalValue - totalCost;
      const profitMargin = totalValue > 0 ? (totalProfit / totalValue) * 100 : 0;
  
      const totalProductsEl = document.getElementById('total-products');
      if (totalProductsEl) totalProductsEl.textContent = totalProducts;
  
      const totalValueEl = document.getElementById('total-value');
      if (totalValueEl) totalValueEl.textContent = `₦${totalValue.toFixed(2)}`;
  
      const totalCostEl = document.getElementById('total-cost');
      if (totalCostEl) totalCostEl.textContent = `₦${totalCost.toFixed(2)}`;
  
      const totalProfitEl = document.getElementById('total-profit');
      if (totalProfitEl) totalProfitEl.textContent = `₦${totalProfit.toFixed(2)}`;
  
      const profitMarginEl = document.getElementById('total-profit-margin');
      if (profitMarginEl) profitMarginEl.textContent = `${profitMargin.toFixed(1)}%`;
  
      const totalExpiredEl = document.getElementById('total-expired');
      if (totalExpiredEl) totalExpiredEl.textContent = totalExpired;
  
      const totalExpiringSoonEl = document.getElementById('total-expiring-soon');
      if (totalExpiringSoonEl) totalExpiringSoonEl.textContent = totalExpiringSoon;
  
      uiManager.loadTotalInventoryTable();
    },
  
    loadTotalInventoryTable: () => {
      const inventoryContainer = document.querySelector('.js-total-inventory-container');
      if (!inventoryContainer) return;
  
      inventoryContainer.innerHTML = '';
  
      const searchInput = document.getElementById('total-inventory-search');
      const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
  
      // Combine all inventory items
      let allItems = [];
      sections.forEach(section => {
        dataStores.inventory[section].forEach(item => {
          allItems.push({ ...item, section });
        });
      });
  
      // Filter items
      let filteredItems = allItems;
      if (currentFilter !== 'all') {
        filteredItems = allItems.filter(item => {
          const status = utils.getProductStatus(item);
          return status === currentFilter;
        });
      }
  
      if (searchTerm) {
        filteredItems = filteredItems.filter(item =>
          item.name.toLowerCase().includes(searchTerm)
        );
      }
  
      if (filteredItems.length === 0) {
        inventoryContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon"><i class="fas fa-warehouse"></i></div>
            <h3 class="empty-state-title">${searchTerm ? 'No Products Found' : 'No Products in Inventory'}</h3>
            <p class="empty-state-description">${searchTerm ? 'Try a different search term.' : 'Start by adding products to your inventory.'}</p>
          </div>
        `;
        return;
      }
  
      const inventoryTable = document.createElement('table');
      inventoryTable.className = 'inventory-table';
  
      inventoryTable.innerHTML = `
        <thead>
          <tr>
            <th>Product</th>
            <th>Department</th>
            <th>Price</th>
            <th>Cost</th>
            <th>Profit</th>
            <th>Stock</th>
            <th>Expiry Date</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${filteredItems.map(item => {
            const status = utils.getProductStatus(item);
            let statusClass = '';
            let statusText = '';
  
            if (status === 'in-stock') {
              statusClass = 'status-in-stock';
              statusText = 'In Stock';
            } else if (status === 'low-stock') {
              statusClass = 'status-low-stock';
              statusText = 'Low Stock';
            } else if (status === 'out-of-stock') {
              statusClass = 'status-out-of-stock';
              statusText = 'Out of Stock';
            } else if (status === 'expired') {
              statusClass = 'status-expired';
              statusText = 'Expired';
            } else if (status === 'expiring-soon') {
              statusClass = 'status-expiring-soon';
              statusText = 'Expiring Soon';
            }
  
            const profit = item.price - (item.cost || 0);
            const profitMargin = item.price > 0 ? (profit / item.price) * 100 : 0;
  
            let sectionColor = '';
            if (item.section === 'grill') sectionColor = 'var(--grill-color)';
            else if (item.section === 'wholesale') sectionColor = 'var(--wholesale-color)';
            else if (item.section === 'building') sectionColor = 'var(--building-color)';
            else if (item.section === 'food') sectionColor = 'var(--food-color)';
  
            return `
              <tr data-item-id="${item.id}" data-section="${item.section}">
                <td>${item.name} ${item.isOffline ? '<i class="fas fa-wifi" style="color: #f39c12;" title="Pending sync"></i>' : ''}</td>
                <td><span style="color: ${sectionColor}; font-weight: 600;">${sectionNames[item.section]}</span></td>
                <td>₦${item.price.toFixed(2)}</td>
                <td>₦${(item.cost || 0).toFixed(2)}</td>
                <td>₦${profit.toFixed(2)} (${profitMargin.toFixed(1)}%)</td>
                <td>${item.stock}</td>
                <td>${utils.formatDate(item.expiry_date)}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                  <button class="action-btn"><i class="fas fa-edit"></i></button>
                  <button class="action-btn delete"><i class="fas fa-trash"></i></button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      `;
  
      inventoryContainer.appendChild(inventoryTable);
    },
  
    filterTotalInventory: (searchTerm) => {
      uiManager.loadTotalInventoryTable();
    },
  
    updateCategoryInventorySummary: (section) => {
      let totalProducts = 0;
      let totalValue = 0;
      let totalCost = 0;
      let lowStockCount = 0;
      let expiringSoonCount = 0;
      let expiredCount = 0;
  
      dataStores.inventory[section].forEach(item => {
        totalProducts++;
        totalValue += item.price * item.stock;
        totalCost += (item.cost || 0) * item.stock;
  
        const status = utils.getProductStatus(item);
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
      const elements = [
        { id: `${section}-total-products`, value: totalProducts },
        { id: `${section}-total-value`, value: `₦${totalValue.toFixed(2)}` },
        { id: `${section}-total-cost`, value: `₦${totalCost.toFixed(2)}` },
        { id: `${section}-total-profit`, value: `₦${totalProfit.toFixed(2)}` },
        { id: `${section}-profit-margin`, value: `${profitMargin.toFixed(1)}%` },
        { id: `${section}-low-stock-count`, value: lowStockCount },
        { id: `${section}-expiring-soon-count`, value: expiringSoonCount },
        { id: `${section}-expired-count`, value: expiredCount }
      ];
  
      elements.forEach(el => {
        const element = document.getElementById(el.id);
        if (element) element.textContent = el.value;
      });
    },
  
    updateReports: (section) => {
      const totalSales = dataStores.salesData[section]?.totalSales || 0;
      const avgTransaction = dataStores.salesData[section]?.avgTransaction || 0;
      const profit = dataStores.salesData[section]?.profit || 0;
      const profitMargin = dataStores.salesData[section]?.profitMargin || 0;
  
      const elements = [
        { id: `${section}-total-sales`, value: `₦${totalSales.toFixed(2)}` },
        { id: `${section}-total-transactions`, value: dataStores.salesData[section]?.totalTransactions || 0 },
        { id: `${section}-avg-transaction`, value: `₦${avgTransaction.toFixed(2)}` },
        { id: `${section}-top-item`, value: dataStores.salesData[section]?.topItem || '-' },
        { id: `${section}-total-profit`, value: `₦${profit.toFixed(2)}` },
        { id: `${section}-profit-margin`, value: `${profitMargin.toFixed(1)}%` }
      ];
  
      elements.forEach(el => {
        const element = document.getElementById(el.id);
        if (element) element.textContent = el.value;
      });
    },
  
    updatePurchaseReports: (section) => {
      const totalPurchases = dataStores.purchaseData[section]?.totalPurchases || 0;
      const avgTransaction = dataStores.purchaseData[section]?.avgTransaction || 0;
  
      const elements = [
        { id: `${section}-total-purchases`, value: `₦${totalPurchases.toFixed(2)}` },
        { id: `${section}-total-purchase-transactions`, value: dataStores.purchaseData[section]?.totalTransactions || 0 },
        { id: `${section}-avg-purchase-transaction`, value: `₦${avgTransaction.toFixed(2)}` },
        { id: `${section}-top-supplier`, value: dataStores.purchaseData[section]?.topSupplier || '-' }
      ];
  
      elements.forEach(el => {
        const element = document.getElementById(el.id);
        if (element) element.textContent = el.value;
      });
    },
  
    updateFinancialReports: (section) => {
      const totalSales = dataStores.salesData[section]?.totalSales || 0;
      const totalPurchases = dataStores.purchaseData[section]?.totalPurchases || 0;
      const totalProfit = dataStores.salesData[section]?.profit || 0;
      const profitMargin = dataStores.salesData[section]?.profitMargin || 0;
  
      // Calculate inventory value and cost
      let inventoryValue = 0;
      let inventoryCost = 0;
  
      dataStores.inventory[section].forEach(item => {
        inventoryValue += item.price * item.stock;
        inventoryCost += (item.cost || 0) * item.stock;
      });
  
      const inventoryProfit = inventoryValue - inventoryCost;
      const inventoryProfitMargin = inventoryValue > 0 ? (inventoryProfit / inventoryValue) * 100 : 0;
  
      const elements = [
        { id: `${section}-financial-total-sales`, value: `₦${totalSales.toFixed(2)}` },
        { id: `${section}-financial-total-purchases`, value: `₦${totalPurchases.toFixed(2)}` },
        { id: `${section}-financial-total-profit`, value: `₦${totalProfit.toFixed(2)}` },
        { id: `${section}-financial-profit-margin`, value: `${profitMargin.toFixed(1)}%` },
        { id: `${section}-financial-inventory-value`, value: `₦${inventoryValue.toFixed(2)}` },
        { id: `${section}-financial-inventory-cost`, value: `₦${inventoryCost.toFixed(2)}` },
        { id: `${section}-financial-inventory-profit`, value: `₦${inventoryProfit.toFixed(2)}` },
        { id: `${section}-financial-inventory-profit-margin`, value: `${inventoryProfitMargin.toFixed(1)}%` }
      ];
  
      elements.forEach(el => {
        const element = document.getElementById(el.id);
        if (element) element.textContent = el.value;
      });
    },
  
    updateUserStats: (section) => {
      const sales = dataStores.userData[section]?.sales || 0;
      const purchases = dataStores.userData[section]?.purchases || 0;
  
      const elements = [
        { id: `${section}-user-transactions`, value: dataStores.userData[section]?.transactions || 0 },
        { id: `${section}-user-sales`, value: `₦${sales.toFixed(2)}` },
        { id: `${section}-user-purchases`, value: `₦${purchases.toFixed(2)}` },
        { id: `${section}-user-net`, value: `₦${(sales - purchases).toFixed(2)}` }
      ];
  
      elements.forEach(el => {
        const element = document.getElementById(el.id);
        if (element) element.textContent = el.value;
      });
    },
  
    updateDepartmentStats: (section) => {
      const lowStockItems = dataStores.inventory[section].filter(item => {
        const status = utils.getProductStatus(item);
        return status === 'low-stock';
      }).length;
  
      const dailySales = dataStores.salesData[section]?.dailySales || 0;
      const dailyPurchases = dataStores.purchaseData[section]?.dailyPurchases || 0;
      const dailyProfit = dataStores.salesData[section]?.profit || 0;
  
      const elements = [
        { id: `${section}-daily-sales`, value: `₦${dailySales.toFixed(2)}` },
        { id: `${section}-daily-purchases`, value: `₦${dailyPurchases.toFixed(2)}` },
        { id: `${section}-daily-profit`, value: `₦${dailyProfit.toFixed(2)}` },
        { id: `${section}-daily-transactions`, value: dataStores.salesData[section]?.dailyTransactions || 0 },
        { id: `${section}-daily-purchase-transactions`, value: dataStores.purchaseData[section]?.dailyTransactions || 0 },
        { id: `${section}-low-stock`, value: lowStockItems }
      ];
  
      elements.forEach(el => {
        const element = document.getElementById(el.id);
        if (element) element.textContent = el.value;
      });
    },
  
    resetToPOSView: (section) => {
      document.querySelectorAll(`#${section}-section .sub-nav-item`).forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-view') === 'pos') item.classList.add('active');
      });
      document.querySelectorAll(`#${section}-section .view-content`).forEach(view => {
        view.classList.remove('active');
        if (view.id === `${section}-pos-view`) view.classList.add('active');
      });
      currentView = 'pos';
    },
  
    filterInventory: (section, searchTerm) => {
      uiManager.loadInventoryTable(section);
    },
  
    closeModal: (modalId) => {
      const modal = document.getElementById(modalId);
      if (modal) modal.classList.remove('active');
    }
  };
  
  // Cart management
  const cartManager = {
    addToCart: (section, item) => {
      if (item.stock <= 0) {
        utils.showNotification(`${item.name} is out of stock`, 'error');
        return;
      }
  
      const existingItem = dataStores.carts[section].find(cartItem => cartItem.id === item.id);
      if (existingItem) {
        if (existingItem.quantity >= item.stock) {
          utils.showNotification(`Cannot add more ${item.name}. Only ${item.stock} in stock.`, 'warning');
          return;
        }
        existingItem.quantity += 1;
      } else {
        dataStores.carts[section].push({ id: item.id, name: item.name, price: item.price, quantity: 1 });
      }
  
      utils.saveToLocalStorage(`cart_${section}`, dataStores.carts[section]);
      uiManager.updateCart(section);
      utils.showNotification(`${item.name} added to cart`, 'success');
    },
  
    incrementQuantity: (section, itemId) => {
      const item = dataStores.carts[section].find(cartItem => cartItem.id === itemId);
      const inventoryItem = dataStores.inventory[section].find(invItem => invItem.id === itemId);
      if (item && inventoryItem && item.quantity < inventoryItem.stock) {
        item.quantity += 1;
        utils.saveToLocalStorage(`cart_${section}`, dataStores.carts[section]);
        uiManager.updateCart(section);
      }
      else if (item && inventoryItem) {
        utils.showNotification(`Cannot add more ${item.name}. Only ${inventoryItem.stock} in stock.`, 'warning');
      }
    },
  
    decrementQuantity: (section, itemId) => {
      const item = dataStores.carts[section].find(cartItem => cartItem.id === itemId);
      if (item && item.quantity > 1) {
        item.quantity -= 1;
        utils.saveToLocalStorage(`cart_${section}`, dataStores.carts[section]);
        uiManager.updateCart(section);
      }
    },
  
    removeFromCart: (section, itemId) => {
      dataStores.carts[section] = dataStores.carts[section].filter(cartItem => cartItem.id !== itemId);
      utils.saveToLocalStorage(`cart_${section}`, dataStores.carts[section]);
      uiManager.updateCart(section);
    },
  
    processCheckout: (section) => {
      if (dataStores.carts[section].length === 0) {
        utils.showNotification('Your cart is empty', 'error');
        return;
      }
  
      const checkoutModal = document.getElementById('checkoutModal');
      if (!checkoutModal) return;
  
      const checkoutSummary = document.getElementById('checkout-summary');
      let subtotal = 0;
      let totalCost = 0;
      let summaryHTML = '<table class="inventory-table">';
  
      dataStores.carts[section].forEach(item => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;
  
        const inventoryItem = dataStores.inventory[section].find(invItem => invItem.id === item.id);
        const itemCost = inventoryItem ? (inventoryItem.cost || 0) * item.quantity : 0;
        totalCost += itemCost;
  
        summaryHTML += `<tr><td>${item.name}</td><td>₦${item.price.toFixed(2)}</td><td>₦${(itemCost / item.quantity).toFixed(2)}</td><td>${item.quantity}</td><td>₦${itemTotal.toFixed(2)}</td></tr>`;
      });
  
      const totalProfit = subtotal - totalCost;
      const profitMargin = subtotal > 0 ? (totalProfit / subtotal) * 100 : 0;
      summaryHTML += `<tr><td colspan="4" class="total-label">Total</td><td>₦${subtotal.toFixed(2)}</td></tr>`;
      summaryHTML += `<tr><td colspan="4" class="total-label">Cost</td><td>₦${totalCost.toFixed(2)}</td></tr>`;
      summaryHTML += `<tr><td colspan="4" class="total-label">Profit</td><td>₦${totalProfit.toFixed(2)} (${profitMargin.toFixed(1)}%)</td></tr></table>`;
  
      checkoutSummary.innerHTML = summaryHTML;
      checkoutModal.setAttribute('data-section', section);
      checkoutModal.classList.add('active');
    },
  
    // =============================================================================
    // CRITICAL FIX: completeCheckout function
    // The saleRecord object is now created without the invalid 'profitMargin' property.
    // =============================================================================
    completeCheckout: () => {
      const checkoutModal = document.getElementById('checkoutModal');
      if (!checkoutModal) return;
  
      const section = checkoutModal.getAttribute('data-section');
  
      const validation = utils.validateForm('checkoutForm', ['paymentMethod']);
      if (!validation.isValid) {
        utils.showNotification(validation.message, 'error');
        return;
      }
  
      let subtotal = 0;
      let totalCost = 0;
      const saleItems = [];
  
      dataStores.carts[section].forEach(item => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;
  
        const inventoryItem = dataStores.inventory[section].find(invItem => invItem.id === item.id);
        const itemCost = inventoryItem ? (inventoryItem.cost || 0) * item.quantity : 0;
        totalCost += itemCost;
  
        saleItems.push({
          id: item.id,
          name: item.name,
          price: item.price,
          cost: inventoryItem ? inventoryItem.cost || 0 : 0,
          quantity: item.quantity,
          total: itemTotal,
          itemCost: itemCost
        });
  
        if (inventoryItem) {
          inventoryItem.stock -= item.quantity;
          inventoryItem.status = utils.getProductStatus(inventoryItem);
          utils.saveToLocalStorage(`inventory_${section}`, dataStores.inventory[section]);
          dataManager.saveDataToSupabase('inventory', inventoryItem, inventoryItem.id)
            .catch(error => console.error('Error updating inventory:', error));
        }
      });
  
      const totalProfit = subtotal - totalCost;
  
      // FIX: The saleRecord object now only contains fields that exist in the 'sales' table.
      const saleRecord = {
        user_id: currentUser ? currentUser.id : 'offline_user',
        user_email: currentUser ? currentUser.email : 'offline@example.com',
        section,
        items: saleItems,
        subtotal,
        total: subtotal,
        totalCost,
        totalProfit,
        payment_method: document.getElementById('paymentMethod').value,
        customer_name: document.getElementById('customerName').value,
        customer_phone: document.getElementById('customerPhone').value,
        timestamp: new Date().toISOString()
        // NOTE: 'profitMargin' is calculated on the fly for reports and is NOT stored here.
      };
  
      dataManager.saveDataToSupabase('sales', saleRecord).then(() => {
        // Update sales data
        dataStores.salesData[section].totalSales += subtotal;
        dataStores.salesData[section].totalTransactions += 1;
        dataStores.salesData[section].avgTransaction = dataStores.salesData[section].totalSales / dataStores.salesData[section].totalTransactions;
        dataStores.salesData[section].dailySales += subtotal;
        dataStores.salesData[section].dailyTransactions += 1;
        dataStores.salesData[section].profit += totalProfit;
        dataStores.salesData[section].profitMargin = dataStores.salesData[section].totalSales > 0 ?
          (dataStores.salesData[section].profit / dataStores.salesData[section].totalSales) * 100 : 0;
  
        dataStores.userData[section].transactions += 1;
        dataStores.userData[section].sales += subtotal;
  
        // Save updated stats
        dataManager.saveDataToSupabase('sales_data', dataStores.salesData[section], section);
        dataManager.saveDataToSupabase('user_data', dataStores.userData[section], section);
  
        // Clear cart and remove from local storage
        dataStores.carts[section] = [];
        utils.saveToLocalStorage(`cart_${section}`, []);
  
        uiManager.updateCart(section);
        uiManager.loadInventoryTable(section);
        uiManager.updateReports(section);
        uiManager.updateFinancialReports(section);
        uiManager.updateUserStats(section);
        uiManager.updateDepartmentStats(section);
        uiManager.updateCategoryInventorySummary(section);
        uiManager.updateTotalInventory();
        checkoutModal.classList.remove('active');
        utils.showNotification(`Sale completed successfully${navigator.onLine ? '' : ' (will sync when online)'}`, 'success');
      }).catch(error => {
        console.error('Error saving sale:', error);
        utils.showNotification('Error saving sale. Please try again.', 'error');
      });
    }
  };
  
  // Item management
  const itemManager = {
    showAddItemModal: (section) => {
      const modal = document.getElementById('addItemModal');
      if (modal) {
        document.getElementById('addItemForm').reset();
        modal.setAttribute('data-section', section);
        modal.classList.add('active');
      }
    },
  
    addNewItem: () => {
      const modal = document.getElementById('addItemModal');
      if (!modal) return;
  
      const section = modal.getAttribute('data-section');
      const name = document.getElementById('addItemName').value;
      const price = parseFloat(document.getElementById('addItemPrice').value);
      const cost = parseFloat(document.getElementById('addItemCost').value) || 0;
      const stock = parseInt(document.getElementById('addItemStock').value);
      const expiryDate = document.getElementById('addItemExpiry').value;
  
      const newItem = {
        section,
        name,
        price,
        cost,
        stock,
        expiry_date: expiryDate,
        status: stock > 10 ? 'in-stock' : (stock > 0 ? 'low-stock' : 'out-of-stock'),
        created_by: currentUser ? currentUser.id : 'offline_user',
        created_at: new Date().toISOString()
      };
  
      dataManager.saveDataToSupabase('inventory', newItem).then(() => {
        modal.classList.remove('active');
        utils.showNotification(`${name} added successfully${navigator.onLine ? '' : ' (will sync when online)'}`, 'success');
      }).catch(error => {
        console.error('Error adding item:', error);
        utils.showNotification('Error adding item', 'error');
      });
    },
  
    showAddInventoryModal: (section) => {
      const modal = document.getElementById('addInventoryModal');
      if (modal) {
        document.getElementById('addInventoryForm').reset();
        modal.setAttribute('data-section', section);
        modal.classList.add('active');
      }
    },
  
    addNewInventory: () => {
      const modal = document.getElementById('addInventoryModal');
      if (!modal) return;
  
      const section = modal.getAttribute('data-section');
  
      const validation = utils.validateForm('addInventoryForm', [
        'addInventoryName',
        'addInventoryPrice',
        'addInventoryStock'
      ]);
      if (!validation.isValid) {
        utils.showNotification(validation.message, 'error');
        return;
      }
  
      const name = document.getElementById('addInventoryName').value;
      const price = parseFloat(document.getElementById('addInventoryPrice').value);
      const cost = parseFloat(document.getElementById('addInventoryCost').value) || 0;
      const stock = parseInt(document.getElementById('addInventoryStock').value);
      const expiryDate = document.getElementById('addInventoryExpiry').value;
      const description = document.getElementById('addInventoryDescription').value;
  
      const newItem = {
        section,
        name,
        price,
        cost,
        stock,
        expiry_date: expiryDate,
        description,
        status: stock > 10 ? 'in-stock' : (stock > 0 ? 'low-stock' : 'out-of-stock'),
        created_by: currentUser ? currentUser.id : 'offline_user',
        created_at: new Date().toISOString()
      };
  
      dataManager.saveDataToSupabase('inventory', newItem).then(() => {
        modal.classList.remove('active');
        utils.showNotification(`${name} added successfully${navigator.onLine ? '' : ' (will sync when online)'}`, 'success');
      }).catch(error => {
        console.error('Error adding item:', error);
        utils.showNotification('Error adding item', 'error');
      });
    },
  
    editInventoryItem: (section, itemId) => {
      const item = dataStores.inventory[section].find(invItem => invItem.id === itemId);
      if (!item) return;
  
      document.getElementById('editInventoryName').value = item.name;
      document.getElementById('editInventoryPrice').value = item.price;
      document.getElementById('editInventoryCost').value = item.cost || 0;
      document.getElementById('editInventoryStock').value = item.stock;
      document.getElementById('editInventoryExpiry').value = item.expiry_date || '';
      document.getElementById('editInventoryDescription').value = item.description || '';
  
      const editModal = document.getElementById('editInventoryModal');
      if (editModal) {
        editModal.setAttribute('data-section', section);
        editModal.setAttribute('data-item-id', itemId);
        editModal.classList.add('active');
      }
    },
  
    updateInventoryItem: () => {
      const editModal = document.getElementById('editInventoryModal');
      if (!editModal) return;
  
      const section = editModal.getAttribute('data-section');
      const itemId = editModal.getAttribute('data-item-id');
      const name = document.getElementById('editInventoryName').value;
      const price = parseFloat(document.getElementById('editInventoryPrice').value);
      const cost = parseFloat(document.getElementById('editInventoryCost').value) || 0;
      const stock = parseInt(document.getElementById('editInventoryStock').value);
      const expiryDate = document.getElementById('editInventoryExpiry').value;
      const description = document.getElementById('editInventoryDescription').value;
      const item = dataStores.inventory[section].find(invItem => invItem.id === itemId);
  
      if (!item) return;
  
      const updatedItem = {
        ...item,
        name,
        price,
        cost,
        stock,
        expiry_date: expiryDate,
        description,
        status: stock > 10 ? 'in-stock' : (stock > 0 ? 'low-stock' : 'out-of-stock'),
        updated_by: currentUser ? currentUser.id : 'offline_user',
        updated_at: new Date().toISOString()
      };
  
      dataManager.saveDataToSupabase('inventory', updatedItem, itemId).then(() => {
        editModal.classList.remove('active');
        utils.showNotification(`${name} updated successfully${navigator.onLine ? '' : ' (will sync when online)'}`, 'success');
      }).catch(error => {
        console.error('Error updating item:', error);
        utils.showNotification('Error updating item', 'error');
      });
    },
  
    deleteInventoryItem: (section, itemId) => {
      if (!confirm('Are you sure you want to delete this item?')) return;
  
      const item = dataStores.inventory[section].find(invItem => invItem.id === itemId);
      if (!item) return;
  
      // Mark as deleted locally
      item.deleted = true;
      item.deleted_at = new Date().toISOString();
  
      dataManager.saveDataToSupabase('inventory', item, itemId).then(() => {
        dataStores.inventory[section] = dataStores.inventory[section].filter(invItem => invItem.id !== itemId);
        utils.saveToLocalStorage(`inventory_${section}`, dataStores.inventory[section]);
        uiManager.loadInventoryTable(section);
        uiManager.updateDepartmentStats(section);
        uiManager.updateCategoryInventorySummary(section);
        uiManager.updateTotalInventory();
        utils.showNotification('Item deleted successfully', 'success');
      }).catch(error => {
        console.error('Error deleting item:', error);
        utils.showNotification('Error deleting item', 'error');
      });
    }
  };
  
  // Supplier management
  const supplierManager = {
    showAddSupplierModal: (section) => {
      const modal = document.getElementById('addSupplierModal');
      if (modal) {
        document.getElementById('addSupplierForm').reset();
        modal.setAttribute('data-section', section);
        modal.classList.add('active');
      }
    },
  
    addNewSupplier: () => {
      const modal = document.getElementById('addSupplierModal');
      if (!modal) return;
  
      const section = modal.getAttribute('data-section');
  
      const validation = utils.validateForm('addSupplierForm', ['addSupplierName']);
      if (!validation.isValid) {
        utils.showNotification(validation.message, 'error');
        return;
      }
  
      const name = document.getElementById('addSupplierName').value;
      const phone = document.getElementById('addSupplierPhone').value;
      const email = document.getElementById('addSupplierEmail').value;
      const address = document.getElementById('addSupplierAddress').value;
      const products = document.getElementById('addSupplierProducts').value;
  
      const newSupplier = {
        section,
        name,
        phone,
        email,
        address,
        products,
        created_by: currentUser ? currentUser.id : 'offline_user',
        created_at: new Date().toISOString()
      };
  
      dataManager.saveDataToSupabase('suppliers', newSupplier).then(() => {
        modal.classList.remove('active');
        utils.showNotification(`${name} added successfully${navigator.onLine ? '' : ' (will sync when online)'}`, 'success');
      }).catch(error => {
        console.error('Error adding supplier:', error);
        utils.showNotification('Error adding supplier', 'error');
      });
    },
  
    editSupplier: (section, supplierId) => {
      const supplier = dataStores.suppliers[section].find(s => s.id === supplierId);
      if (!supplier) return;
  
      document.getElementById('editSupplierName').value = supplier.name;
      document.getElementById('editSupplierPhone').value = supplier.phone || '';
      document.getElementById('editSupplierEmail').value = supplier.email || '';
      document.getElementById('editSupplierAddress').value = supplier.address || '';
      document.getElementById('editSupplierProducts').value = supplier.products || '';
  
      const editModal = document.getElementById('editSupplierModal');
      if (editModal) {
        editModal.setAttribute('data-section', section);
        editModal.setAttribute('data-item-id', supplierId);
        editModal.classList.add('active');
      }
    },
  
    updateSupplier: () => {
      const editModal = document.getElementById('editSupplierModal');
      if (!editModal) return;
  
      const section = editModal.getAttribute('data-section');
      const supplierId = editModal.getAttribute('data-item-id');
      const name = document.getElementById('editSupplierName').value;
      const phone = document.getElementById('editSupplierPhone').value;
      const email = document.getElementById('editSupplierEmail').value;
      const address = document.getElementById('editSupplierAddress').value;
      const products = document.getElementById('editSupplierProducts').value;
      const supplier = dataStores.suppliers[section].find(s => s.id === supplierId);
  
      if (!supplier) return;
  
      const updatedSupplier = {
        ...supplier,
        name,
        phone,
        email,
        address,
        products,
        updated_by: currentUser ? currentUser.id : 'offline_user',
        updated_at: new Date().toISOString()
      };
  
      dataManager.saveDataToSupabase('suppliers', updatedSupplier, supplierId).then(() => {
        editModal.classList.remove('active');
        utils.showNotification(`${name} updated successfully${navigator.onLine ? '' : ' (will sync when online)'}`, 'success');
      }).catch(error => {
        console.error('Error updating supplier:', error);
        utils.showNotification('Error updating supplier', 'error');
      });
    },
  
    deleteSupplier: (section, supplierId) => {
      if (!confirm('Are you sure you want to delete this supplier?')) return;
  
      const supplier = dataStores.suppliers[section].find(s => s.id === supplierId);
      if (!supplier) return;
  
      // Mark as deleted locally
      supplier.deleted = true;
      supplier.deleted_at = new Date().toISOString();
  
      dataManager.saveDataToSupabase('suppliers', supplier, supplierId).then(() => {
        dataStores.suppliers[section] = dataStores.suppliers[section].filter(s => s.id !== supplierId);
        utils.saveToLocalStorage(`suppliers_${section}`, dataStores.suppliers[section]);
        uiManager.loadSuppliersTable(section);
        utils.showNotification('Supplier deleted successfully', 'success');
      }).catch(error => {
        console.error('Error deleting supplier:', error);
        utils.showNotification('Error deleting supplier', 'error');
      });
    }
  };
  
  // Purchase order management
  const purchaseOrderManager = {
    showAddPurchaseOrderModal: (section) => {
      const modal = document.getElementById('addPurchaseOrderModal');
      if (modal) {
        document.getElementById('addPurchaseOrderForm').reset();
  
        // Populate supplier dropdown
        const supplierSelect = document.getElementById('addPurchaseOrderSupplier');
        if (supplierSelect) {
          supplierSelect.innerHTML = '<option value="">Select Supplier</option>';
  
          dataStores.suppliers[section].forEach(supplier => {
            const option = document.createElement('option');
            option.value = supplier.id;
            option.textContent = supplier.name;
            supplierSelect.appendChild(option);
          });
        }
  
        // Populate product dropdown
        const productSelect = document.getElementById('addPurchaseOrderProduct');
        if (productSelect) {
          productSelect.innerHTML = '<option value="">Select Product</option>';
  
          dataStores.inventory[section].forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = `${item.name} (Current Stock: ${item.stock})`;
            productSelect.appendChild(option);
          });
        }
  
        modal.setAttribute('data-section', section);
        modal.classList.add('active');
      }
    },
  
    addNewPurchaseOrder: () => {
      const modal = document.getElementById('addPurchaseOrderModal');
      if (!modal) return;
  
      const section = modal.getAttribute('data-section');
  
      const validation = utils.validateForm('addPurchaseOrderForm', [
        'addPurchaseOrderSupplier',
        'addPurchaseOrderProduct',
        'addPurchaseOrderQuantity',
        'addPurchaseOrderCost'
      ]);
      if (!validation.isValid) {
        utils.showNotification(validation.message, 'error');
        return;
      }
  
      const supplierId = document.getElementById('addPurchaseOrderSupplier').value;
      const productId = document.getElementById('addPurchaseOrderProduct').value;
      const quantity = parseInt(document.getElementById('addPurchaseOrderQuantity').value);
      const cost = parseFloat(document.getElementById('addPurchaseOrderCost').value);
      const orderDate = document.getElementById('addPurchaseOrderDate').value || new Date().toISOString().split('T')[0];
  
      const supplier = dataStores.suppliers[section].find(s => s.id === supplierId);
      const product = dataStores.inventory[section].find(p => p.id === productId);
  
      if (!supplier || !product) {
        utils.showNotification('Please select a valid supplier and product', 'error');
        return;
      }
  
      const total = cost * quantity;
      const orderNumber = `PO-${Date.now()}`;
  
      const newPurchaseOrder = {
        section,
        orderNumber,
        supplierId,
        supplierName: supplier.name,
        productId, // This is used locally but won't be sent to Supabase
        productName: product.name,
        quantity,
        cost,
        total,
        orderDate,
        status: 'pending',
        created_by: currentUser ? currentUser.id : 'offline_user',
        created_at: new Date().toISOString()
      };
  
      dataManager.saveDataToSupabase('purchase_orders', newPurchaseOrder).then(() => {
        modal.classList.remove('active');
        utils.showNotification(`Purchase order ${orderNumber} created successfully${navigator.onLine ? '' : ' (will sync when online)'}`, 'success');
      }).catch(error => {
        console.error('Error creating purchase order:', error);
        utils.showNotification('Error creating purchase order', 'error');
      });
    },
  
    editPurchaseOrder: (section, orderId) => {
      const order = dataStores.purchaseOrders[section].find(o => o.id === orderId);
      if (!order) return;
  
      document.getElementById('editPurchaseOrderQuantity').value = order.quantity;
      document.getElementById('editPurchaseOrderCost').value = order.cost;
      document.getElementById('editPurchaseOrderStatus').value = order.status;
  
      const editModal = document.getElementById('editPurchaseOrderModal');
      if (editModal) {
        editModal.setAttribute('data-section', section);
        editModal.setAttribute('data-item-id', orderId);
        editModal.classList.add('active');
      }
    },
  
    updatePurchaseOrder: () => {
      const editModal = document.getElementById('editPurchaseOrderModal');
      if (!editModal) return;
  
      const section = editModal.getAttribute('data-section');
      const orderId = editModal.getAttribute('data-item-id');
      const quantity = parseInt(document.getElementById('editPurchaseOrderQuantity').value);
      const cost = parseFloat(document.getElementById('editPurchaseOrderCost').value);
      const status = document.getElementById('editPurchaseOrderStatus').value;
      const order = dataStores.purchaseOrders[section].find(o => o.id === orderId);
  
      if (!order) return;
  
      const total = cost * quantity;
      const updatedOrder = {
        ...order,
        quantity,
        cost,
        total,
        status,
        updated_by: currentUser ? currentUser.id : 'offline_user',
        updated_at: new Date().toISOString()
      };
  
      dataManager.saveDataToSupabase('purchase_orders', updatedOrder, orderId).then(() => {
        editModal.classList.remove('active');
        utils.showNotification(`Purchase order updated successfully${navigator.onLine ? '' : ' (will sync when online)'}`, 'success');
      }).catch(error => {
        console.error('Error updating purchase order:', error);
        utils.showNotification('Error updating purchase order', 'error');
      });
    },
  
    receivePurchaseOrder: (section, orderId) => {
      const order = dataStores.purchaseOrders[section].find(o => o.id === orderId);
      if (!order) return;
  
      const product = dataStores.inventory[section].find(p => p.id === order.productId);
      if (!product) return;
  
      // Update product stock and cost
      product.stock += order.quantity;
      product.cost = order.cost;
      product.status = utils.getProductStatus(product);
  
      // Update order status
      order.status = 'received';
      order.receivedDate = new Date().toISOString().split('T')[0];
  
      // Save both changes
      Promise.all([
        dataManager.saveDataToSupabase('inventory', product, product.id),
        dataManager.saveDataToSupabase('purchase_orders', order, orderId)
      ]).then(() => {
        utils.showNotification(`Purchase order received successfully. Stock updated for ${product.name}`, 'success');
      }).catch(error => {
        console.error('Error receiving purchase order:', error);
        utils.showNotification('Error receiving purchase order', 'error');
      });
    },
  
    deletePurchaseOrder: (section, orderId) => {
      if (!confirm('Are you sure you want to delete this purchase order?')) return;
  
      const order = dataStores.purchaseOrders[section].find(o => o.id === orderId);
      if (!order) return;
  
      // Mark as deleted locally
      order.deleted = true;
      order.deleted_at = new Date().toISOString();
  
      dataManager.saveDataToSupabase('purchase_orders', order, orderId).then(() => {
        dataStores.purchaseOrders[section] = dataStores.purchaseOrders[section].filter(o => o.id !== orderId);
        utils.saveToLocalStorage(`purchaseOrders_${section}`, dataStores.purchaseOrders[section]);
        uiManager.loadPurchaseOrdersTable(section);
        utils.showNotification('Purchase order deleted successfully', 'success');
      }).catch(error => {
        console.error('Error deleting purchase order:', error);
        utils.showNotification('Error deleting purchase order', 'error');
      });
    }
  };
  
  // Authentication
  const authManager = {
    resetPassword: () => {
      const email = document.getElementById('resetEmail').value;
      const errorElement = document.getElementById('reset-password-error');
      const successElement = document.getElementById('reset-password-success');
  
      supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin
      })
        .then(({ data, error }) => {
          if (error) {
            if (errorElement) errorElement.textContent = error.message;
            if (successElement) successElement.textContent = '';
          } else {
            if (successElement) successElement.textContent = 'Password reset email sent. Check your inbox.';
            if (errorElement) errorElement.textContent = '';
          }
        });
    }
  };
  
  // Initialize app
  document.addEventListener('DOMContentLoaded', function () {
    // Load data from localStorage immediately
    dataManager.loadDataFromLocalStorage();
  
    // Check if user is already authenticated
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        currentUser = session.user;
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        uiManager.updateUserInfo(session.user);
  
        // Initialize the app with already loaded data
        uiManager.initializeApp();
  
        // Then try to sync with Supabase
        dataManager.loadDataFromSupabase();
  
        // Set up online/offline listeners
        window.addEventListener('online', uiManager.handleOnlineStatus);
        window.addEventListener('offline', uiManager.handleOfflineStatus);
      } else {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
      }
    });
  
    // Login form
    const emailLoginForm = document.getElementById('emailLoginForm');
    if (emailLoginForm) {
      emailLoginForm.addEventListener('submit', function (e) {
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
      forgotPasswordLink.addEventListener('click', function (e) {
        e.preventDefault();
        const forgotPasswordModal = document.getElementById('forgotPasswordModal');
        if (forgotPasswordModal) forgotPasswordModal.classList.add('active');
      });
    }
  
    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        supabase.auth.signOut();
      });
    }
  
    // Modal close buttons
    document.querySelectorAll('.js-modal-close').forEach(button => {
      button.addEventListener('click', () => {
        const targetModal = button.getAttribute('data-target');
        uiManager.closeModal(targetModal);
      });
    });
  
    // Event Delegation for dynamic content
    setupEventDelegation();
  
    // Modal confirm buttons
    const addItemConfirmBtn = document.querySelector('.js-add-item-confirm-btn');
    if (addItemConfirmBtn) addItemConfirmBtn.addEventListener('click', itemManager.addNewItem);
  
    const addInventoryConfirmBtn = document.querySelector('.js-add-inventory-confirm-btn');
    if (addInventoryConfirmBtn) addInventoryConfirmBtn.addEventListener('click', itemManager.addNewInventory);
  
    const addSupplierConfirmBtn = document.querySelector('.js-add-supplier-confirm-btn');
    if (addSupplierConfirmBtn) addSupplierConfirmBtn.addEventListener('click', supplierManager.addNewSupplier);
  
    const addPurchaseOrderConfirmBtn = document.querySelector('.js-add-purchase-order-confirm-btn');
    if (addPurchaseOrderConfirmBtn) addPurchaseOrderConfirmBtn.addEventListener('click', purchaseOrderManager.addNewPurchaseOrder);
  
    const updateInventoryBtn = document.querySelector('.js-update-inventory-btn');
    if (updateInventoryBtn) updateInventoryBtn.addEventListener('click', itemManager.updateInventoryItem);
  
    const updateSupplierBtn = document.querySelector('.js-update-supplier-btn');
    if (updateSupplierBtn) updateSupplierBtn.addEventListener('click', supplierManager.updateSupplier);
  
    const updatePurchaseOrderBtn = document.querySelector('.js-update-purchase-order-btn');
    if (updatePurchaseOrderBtn) updatePurchaseOrderBtn.addEventListener('click', purchaseOrderManager.updatePurchaseOrder);
  
    const completeCheckoutBtn = document.querySelector('.js-complete-checkout-btn');
    if (completeCheckoutBtn) completeCheckoutBtn.addEventListener('click', cartManager.completeCheckout);
  
    const resetPasswordBtn = document.querySelector('.js-reset-password-btn');
    if (resetPasswordBtn) resetPasswordBtn.addEventListener('click', authManager.resetPassword);
  });
  
  function setupEventDelegation() {
    // Main nav tabs
    const navTabs = document.querySelector('.nav-tabs');
    if (navTabs) {
      navTabs.addEventListener('click', (e) => {
        const tab = e.target.closest('.nav-tab');
        if (tab) {
          const section = tab.getAttribute('data-section');
  
          // Handle total inventory tab
          if (section === 'total-inventory') {
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.section-container').forEach(s => s.classList.remove('active'));
            const totalInventorySection = document.getElementById('total-inventory-section');
            if (totalInventorySection) totalInventorySection.classList.add('active');
            currentSection = 'total-inventory';
            uiManager.updateTotalInventory();
            return;
          }
  
          document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          document.querySelectorAll('.section-container').forEach(s => s.classList.remove('active'));
          const sectionElement = document.getElementById(`${section}-section`);
          if (sectionElement) sectionElement.classList.add('active');
          currentSection = section;
          uiManager.resetToPOSView(section);
        }
      });
    }
  
    // Sub nav tabs
    document.querySelectorAll('.sub-nav').forEach(nav => {
      nav.addEventListener('click', (e) => {
        const item = e.target.closest('.sub-nav-item');
        if (item) {
          const view = item.getAttribute('data-view');
          const section = nav.closest('.section-container').id.replace('-section', '');
  
          document.querySelectorAll(`#${section}-section .sub-nav-item`).forEach(i => i.classList.remove('active'));
          item.classList.add('active');
          document.querySelectorAll(`#${section}-section .view-content`).forEach(v => v.classList.remove('active'));
  
          const viewElement = document.getElementById(`${section}-${view}-view`);
          if (viewElement) viewElement.classList.add('active');
  
          currentView = view;
          if (view === 'inventory') {
            uiManager.loadInventoryTable(section);
            uiManager.updateCategoryInventorySummary(section);
          } else if (view === 'reports') {
            uiManager.updateReports(section);
          } else if (view === 'financial') {
            uiManager.updateFinancialReports(section);
          } else if (view === 'suppliers') {
            uiManager.loadSuppliersTable(section);
          } else if (view === 'purchase-orders') {
            uiManager.loadPurchaseOrdersTable(section);
          } else if (view === 'account') {
            uiManager.updateUserStats(section);
          }
        }
      });
    });
  
    // POS Search Results (Add to cart)
    document.querySelectorAll('.js-pos-search-results').forEach(container => {
      container.addEventListener('click', (e) => {
        const resultItem = e.target.closest('.pos-search-result-item');
        if (resultItem) {
          const section = container.getAttribute('data-section');
          const itemId = resultItem.getAttribute('data-id');
          const item = dataStores.inventory[section].find(invItem => invItem.id == itemId);
          if (item) {
            cartManager.addToCart(section, item);
            const searchInput = document.querySelector(`.js-pos-search[data-section="${section}"]`);
            if (searchInput) {
              searchInput.value = '';
              container.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><i class="fas fa-search"></i></div><h3 class="empty-state-title">Search for Products</h3><p class="empty-state-description">Type in search box above to find products from your inventory.</p></div>`;
            }
          }
        }
      });
    });
  
    // Cart Actions (Increment, Decrement, Remove)
    document.querySelectorAll('.js-pos-cart').forEach(cart => {
      cart.addEventListener('click', (e) => {
        const section = cart.getAttribute('data-section');
        if (e.target.closest('.quantity-btn')) {
          const btn = e.target.closest('.quantity-btn');
          const cartItem = btn.closest('.cart-item');
          const itemId = cartItem.getAttribute('data-item-id');
          if (btn.textContent === '+') cartManager.incrementQuantity(section, itemId);
          else if (btn.textContent === '-') cartManager.decrementQuantity(section, itemId);
        } else if (e.target.closest('.action-btn.delete')) {
          const btn = e.target.closest('.action-btn.delete');
          const cartItem = btn.closest('.cart-item');
          const itemId = cartItem.getAttribute('data-item-id');
          cartManager.removeFromCart(section, itemId);
        }
      });
    });
  
    // Inventory Table Actions (Edit, Delete)
    document.querySelectorAll('.js-inventory-container').forEach(container => {
      container.addEventListener('click', (e) => {
        const section = container.getAttribute('data-section');
        if (e.target.closest('.action-btn')) {
          const btn = e.target.closest('.action-btn');
          const row = btn.closest('tr');
          const itemId = row.getAttribute('data-item-id');
          if (btn.classList.contains('delete')) {
            itemManager.deleteInventoryItem(section, itemId);
          } else {
            itemManager.editInventoryItem(section, itemId);
          }
        }
      });
    });
  
    // Suppliers Table Actions (Edit, Delete)
    document.querySelectorAll('.js-suppliers-container').forEach(container => {
      container.addEventListener('click', (e) => {
        const section = container.getAttribute('data-section');
        if (e.target.closest('.action-btn')) {
          const btn = e.target.closest('.action-btn');
          const row = btn.closest('tr');
          const itemId = row.getAttribute('data-item-id');
          if (btn.classList.contains('delete')) {
            supplierManager.deleteSupplier(section, itemId);
          } else {
            supplierManager.editSupplier(section, itemId);
          }
        }
      });
    });
  
    // Purchase Orders Table Actions (Edit, Delete, Receive)
    document.querySelectorAll('.js-purchase-orders-container').forEach(container => {
      container.addEventListener('click', (e) => {
        const section = container.getAttribute('data-section');
        if (e.target.closest('.action-btn')) {
          const btn = e.target.closest('.action-btn');
          const row = btn.closest('tr');
          const itemId = row.getAttribute('data-item-id');
          if (btn.classList.contains('delete')) {
            purchaseOrderManager.deletePurchaseOrder(section, itemId);
          } else if (btn.classList.contains('receive')) {
            purchaseOrderManager.receivePurchaseOrder(section, itemId);
          } else {
            purchaseOrderManager.editPurchaseOrder(section, itemId);
          }
        }
      });
    });
  
    // Total Inventory Table Actions (Edit, Delete)
    const totalInventoryContainer = document.querySelector('.js-total-inventory-container');
    if (totalInventoryContainer) {
      totalInventoryContainer.addEventListener('click', (e) => {
        if (e.target.closest('.action-btn')) {
          const btn = e.target.closest('.action-btn');
          const row = btn.closest('tr');
          const itemId = row.getAttribute('data-item-id');
          const section = row.getAttribute('data-section');
          if (btn.classList.contains('delete')) {
            itemManager.deleteInventoryItem(section, itemId);
          } else {
            itemManager.editInventoryItem(section, itemId);
          }
        }
      });
    }
  
    // Add item button
    document.querySelectorAll('.js-add-item-btn').forEach(button => {
      button.addEventListener('click', () => {
        const section = button.getAttribute('data-section');
        itemManager.showAddItemModal(section);
      });
    });
  
    // Add inventory button
    document.querySelectorAll('.js-add-inventory-btn').forEach(button => {
      button.addEventListener('click', () => {
        const section = button.getAttribute('data-section');
        itemManager.showAddInventoryModal(section);
      });
    });
  
    // Add supplier button
    document.querySelectorAll('.js-add-supplier-btn').forEach(button => {
      button.addEventListener('click', () => {
        const section = button.getAttribute('data-section');
        supplierManager.showAddSupplierModal(section);
      });
    });
  
    // Add purchase order button
    document.querySelectorAll('.js-add-purchase-order-btn').forEach(button => {
      button.addEventListener('click', () => {
        const section = button.getAttribute('data-section');
        purchaseOrderManager.showAddPurchaseOrderModal(section);
      });
    });
  
    // Checkout button
    document.querySelectorAll('.js-checkout-btn').forEach(button => {
      button.addEventListener('click', () => {
        const section = button.getAttribute('data-section');
        cartManager.processCheckout(section);
      });
    });
  
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(button => {
      button.addEventListener('click', () => {
        const section = button.getAttribute('data-section');
        const filter = button.getAttribute('data-filter');
  
        // Handle total inventory filter buttons (no section attribute)
        if (!section) {
          document.querySelectorAll('.filter-btn:not([data-section])').forEach(btn => btn.classList.remove('active'));
          button.classList.add('active');
          currentFilter = filter;
          uiManager.loadTotalInventoryTable();
          return;
        }
  
        document.querySelectorAll(`[data-section="${section}"].filter-btn`).forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        currentFilter = filter;
        uiManager.loadInventoryTable(section);
      });
    });
  
    // Total inventory search
    const totalInventorySearch = document.getElementById('total-inventory-search');
    if (totalInventorySearch) {
      totalInventorySearch.addEventListener('input', function () {
        uiManager.filterTotalInventory(this.value);
      });
    }
  }
  
  // Listen for authentication state changes
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
      currentUser = session.user;
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('mainApp').style.display = 'block';
      uiManager.updateUserInfo(session.user);
      dataManager.loadDataFromSupabase();
      window.addEventListener('online', uiManager.handleOnlineStatus);
      window.addEventListener('offline', uiManager.handleOfflineStatus);
      uiManager.initializeApp();
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      document.getElementById('loginScreen').style.display = 'flex';
      document.getElementById('mainApp').style.display = 'none';
    }
  });
  
  // Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js')
        .then(function (registration) {
          console.log('ServiceWorker registration successful with scope: ', registration.scope);
        })
        .catch(function (err) {
          console.log('ServiceWorker registration failed: ', err);
        });
    });
  }
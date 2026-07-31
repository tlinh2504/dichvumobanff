// sync.js - Hệ thống đồng bộ dữ liệu thời gian thực 24/7
// Sử dụng BroadcastChannel API + localStorage + IndexedDB

class SyncManager {
  constructor() {
    this.channel = null;
    this.dbName = 'toolBandSyncDB';
    this.dbVersion = 3;
    this.db = null;
    this.tabId = this.generateTabId();
    this.syncInterval = null;
    this.lastSyncTime = null;
    this.useIndexedDB = false;
    
    this.initChannel();
    this.initIndexedDB();
    this.startAutoSync();
    this.listenForStorageChanges();
    
    console.log(`[SyncManager] Tab ${this.tabId} initialized`);
  }

  // ============================================
  // TAB IDENTIFICATION
  // ============================================
  generateTabId() {
    let id = sessionStorage.getItem('sync_tab_id');
    if (!id) {
      id = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('sync_tab_id', id);
    }
    return id;
  }

  isAdminTab() {
    return window.location.pathname.includes('admin');
  }

  // ============================================
  // BROADCAST CHANNEL
  // ============================================
  initChannel() {
    try {
      this.channel = new BroadcastChannel('tool_band_sync_channel');
      
      this.channel.onmessage = (event) => {
        const { type, data, source } = event.data;
        
        // Không xử lý message từ chính mình
        if (source === this.tabId) return;
        
        console.log(`[SyncManager] Received: ${type} from ${source}`);
        
        switch(type) {
          case 'ORDER_CREATED':
            this.handleRemoteOrderCreated(data);
            break;
          case 'ORDER_UPDATED':
            this.handleRemoteOrderUpdated(data);
            break;
          case 'ORDER_DELETED':
            this.handleRemoteOrderDeleted(data);
            break;
          case 'VISITOR_ADDED':
            this.handleRemoteVisitor(data);
            break;
          case 'LOG_ADDED':
            this.handleRemoteLog(data);
            break;
          case 'SETTINGS_CHANGED':
            this.handleSettingsChanged(data);
            break;
          case 'BAN_IP':
            this.handleBanIP(data);
            break;
          case 'UNBAN_IP':
            this.handleUnbanIP(data);
            break;
          case 'SYNC_REQUEST':
            this.syncAll();
            break;
          case 'DATA_CLEARED':
            this.handleDataCleared();
            break;
        }
      };

      console.log('[SyncManager] BroadcastChannel connected');
    } catch (error) {
      console.error('[SyncManager] BroadcastChannel failed:', error);
    }
  }

  sendMessage(type, data) {
    if (this.channel) {
      try {
        this.channel.postMessage({
          type,
          data,
          source: this.tabId,
          timestamp: Date.now()
        });
      } catch (e) {
        console.error('[SyncManager] Send failed:', e);
      }
    }
    
    // Fallback: lưu vào localStorage để sync
    try {
      localStorage.setItem(`tool_band_sync_msg_${Date.now()}`, JSON.stringify({
        type,
        data,
        source: this.tabId,
        timestamp: Date.now()
      }));
    } catch(e) {}
  }

  // ============================================
  // INDEXEDDB
  // ============================================
  async initIndexedDB() {
    return new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(this.dbName, this.dbVersion);
        
        request.onerror = (event) => {
          console.warn('[SyncManager] IndexedDB not available, using localStorage only');
          this.useIndexedDB = false;
          resolve(false);
        };
        
        request.onsuccess = (event) => {
          this.db = event.target.result;
          this.useIndexedDB = true;
          console.log('[SyncManager] IndexedDB ready');
          resolve(true);
        };
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          
          // Orders store
          if (!db.objectStoreNames.contains('orders')) {
            const ordersStore = db.createObjectStore('orders', { keyPath: 'orderId' });
            ordersStore.createIndex('status', 'status', { unique: false });
            ordersStore.createIndex('createdAt', 'createdAt', { unique: false });
            ordersStore.createIndex('ip', 'ip', { unique: false });
          }
          
          // Visitors store
          if (!db.objectStoreNames.contains('visitors')) {
            const visitorsStore = db.createObjectStore('visitors', { keyPath: 'id' });
            visitorsStore.createIndex('ip', 'ip', { unique: false });
            visitorsStore.createIndex('timestamp', 'timestamp', { unique: false });
          }
          
          // Logs store
          if (!db.objectStoreNames.contains('logs')) {
            const logsStore = db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
            logsStore.createIndex('type', 'type', { unique: false });
            logsStore.createIndex('timestamp', 'timestamp', { unique: false });
          }
          
          // Settings store
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'key' });
          }
          
          // Banned IPs store
          if (!db.objectStoreNames.contains('bannedIps')) {
            const bannedStore = db.createObjectStore('bannedIps', { keyPath: 'ip' });
            bannedStore.createIndex('bannedAt', 'bannedAt', { unique: false });
          }
        };
      } catch(e) {
        console.warn('[SyncManager] IndexedDB init error:', e);
        this.useIndexedDB = false;
        resolve(false);
      }
    });
  }

  // Helper function to get all from IndexedDB store
  async getAllFromStore(storeName) {
    if (!this.useIndexedDB || !this.db) {
      return this.getFromLocalStorage(storeName, []);
    }
    
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction([storeName], 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.getAll();
        
        request.onsuccess = () => {
          const result = request.result;
          // Đảm bảo trả về array
          resolve(Array.isArray(result) ? result : []);
        };
        
        request.onerror = () => {
          resolve(this.getFromLocalStorage(storeName, []));
        };
      } catch(e) {
        resolve(this.getFromLocalStorage(storeName, []));
      }
    });
  }

  // Helper function to get one from IndexedDB store
  async getFromStore(storeName, key) {
    if (!this.useIndexedDB || !this.db) {
      const items = this.getFromLocalStorage(storeName, []);
      return items.find(item => (item.orderId || item.ip || item.key || item.id) === key) || null;
    }
    
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction([storeName], 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.get(key);
        
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      } catch(e) {
        resolve(null);
      }
    });
  }

  // Helper function to put into IndexedDB store
  async putToStore(storeName, data) {
    // Luôn lưu vào localStorage
    const items = this.getFromLocalStorage(storeName, []);
    
    if (storeName === 'orders') {
      const index = items.findIndex(item => item.orderId === data.orderId);
      if (index >= 0) {
        items[index] = data;
      } else {
        items.unshift(data);
      }
    } else if (storeName === 'bannedIps') {
      const index = items.findIndex(item => item.ip === data.ip);
      if (index >= 0) {
        items[index] = data;
      } else {
        items.push(data);
      }
    } else if (storeName === 'settings') {
      const index = items.findIndex(item => item.key === data.key);
      if (index >= 0) {
        items[index] = data;
      } else {
        items.push(data);
      }
    } else {
      // visitors, logs - thêm vào đầu
      items.unshift(data);
    }
    
    // Giới hạn số lượng
    const maxItems = storeName === 'logs' ? 200 : storeName === 'visitors' ? 1000 : storeName === 'orders' ? 500 : 100;
    this.saveToLocalStorage(storeName, items.slice(0, maxItems));
    
    // Lưu vào IndexedDB nếu có
    if (this.useIndexedDB && this.db) {
      try {
        const tx = this.db.transaction([storeName], 'readwrite');
        const store = tx.objectStore(storeName);
        store.put(data);
      } catch(e) {
        // Silent fail, đã lưu localStorage rồi
      }
    }
  }

  // Helper function to delete from IndexedDB store
  async deleteFromStore(storeName, key) {
    // Xóa từ localStorage
    let items = this.getFromLocalStorage(storeName, []);
    
    if (storeName === 'orders') {
      items = items.filter(item => item.orderId !== key);
    } else if (storeName === 'bannedIps') {
      items = items.filter(item => item.ip !== key);
    } else {
      items = items.filter(item => item.id !== key && item.orderId !== key && item.ip !== key);
    }
    
    this.saveToLocalStorage(storeName, items);
    
    // Xóa từ IndexedDB
    if (this.useIndexedDB && this.db) {
      try {
        const tx = this.db.transaction([storeName], 'readwrite');
        const store = tx.objectStore(storeName);
        store.delete(key);
      } catch(e) {}
    }
  }

  // ============================================
  // CRUD OPERATIONS - ORDERS
  // ============================================
  async addOrder(orderData) {
    try {
      const order = {
        ...orderData,
        orderId: orderData.orderId || `FF-${Date.now().toString(36).toUpperCase()}`,
        status: orderData.status || 'pending',
        createdAt: orderData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await this.putToStore('orders', order);
      this.sendMessage('ORDER_CREATED', order);
      console.log(`[SyncManager] Order created: #${order.orderId}`);
      return order;
    } catch (error) {
      console.error('[SyncManager] addOrder error:', error);
      // Fallback: chỉ lưu localStorage
      const orders = this.getFromLocalStorage('orders', []);
      orders.unshift(orderData);
      this.saveToLocalStorage('orders', orders.slice(0, 500));
      return orderData;
    }
  }

  async updateOrder(orderId, updates) {
    try {
      let order = await this.getFromStore('orders', orderId);
      
      if (order) {
        order = { ...order, ...updates, updatedAt: new Date().toISOString() };
      } else {
        // Nếu không tìm thấy, tạo mới từ localStorage
        const orders = this.getFromLocalStorage('orders', []);
        order = orders.find(o => o.orderId === orderId);
        if (order) {
          order = { ...order, ...updates, updatedAt: new Date().toISOString() };
        } else {
          order = { orderId, ...updates, updatedAt: new Date().toISOString() };
        }
      }
      
      await this.putToStore('orders', order);
      this.sendMessage('ORDER_UPDATED', { orderId, updates: order });
      console.log(`[SyncManager] Order updated: #${orderId} -> ${order.status}`);
      return order;
    } catch (error) {
      console.error('[SyncManager] updateOrder error:', error);
      return null;
    }
  }

  async deleteOrder(orderId) {
    try {
      await this.deleteFromStore('orders', orderId);
      this.sendMessage('ORDER_DELETED', { orderId });
      console.log(`[SyncManager] Order deleted: #${orderId}`);
      return true;
    } catch (error) {
      console.error('[SyncManager] deleteOrder error:', error);
      return false;
    }
  }

  async getAllOrders() {
    const orders = await this.getAllFromStore('orders');
    // Đảm bảo luôn trả về array
    return Array.isArray(orders) ? orders : [];
  }

  async getOrdersByStatus(status) {
    const orders = await this.getAllOrders();
    return orders.filter(o => o.status === status);
  }

  async getOrder(orderId) {
    return await this.getFromStore('orders', orderId);
  }

  // ============================================
  // CRUD OPERATIONS - VISITORS
  // ============================================
  async addVisitor(visitorData) {
    try {
      const visitor = {
        ...visitorData,
        id: visitorData.id || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: visitorData.timestamp || new Date().toISOString(),
        tabId: this.tabId,
        page: window.location.pathname
      };

      await this.putToStore('visitors', visitor);
      this.sendMessage('VISITOR_ADDED', visitor);
      console.log(`[SyncManager] Visitor added: ${visitor.ip} from ${visitor.location?.city || 'Unknown'}`);
      return visitor;
    } catch (error) {
      console.error('[SyncManager] addVisitor error:', error);
      return null;
    }
  }

  async getAllVisitors() {
    const visitors = await this.getAllFromStore('visitors');
    return Array.isArray(visitors) ? visitors : [];
  }

  async getVisitorsByIP(ip) {
    const visitors = await this.getAllVisitors();
    return visitors.filter(v => v.ip === ip);
  }

  // ============================================
  // CRUD OPERATIONS - LOGS
  // ============================================
  async addLog(type, message, data = null) {
    try {
      const log = {
        type,
        message,
        data: data ? JSON.stringify(data) : null,
        timestamp: new Date().toISOString(),
        source: this.tabId,
        page: window.location.pathname
      };

      await this.putToStore('logs', log);
      this.sendMessage('LOG_ADDED', log);
      return log;
    } catch (error) {
      console.error('[SyncManager] addLog error:', error);
      return null;
    }
  }

  async getLogs(limit = 100) {
    const logs = await this.getAllFromStore('logs');
    const logArray = Array.isArray(logs) ? logs : [];
    return logArray
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  // ============================================
  // CRUD OPERATIONS - SETTINGS
  // ============================================
  async saveSetting(key, value) {
    try {
      const setting = { key, value, updatedAt: new Date().toISOString() };
      await this.putToStore('settings', setting);
      this.sendMessage('SETTINGS_CHANGED', { key, value });
      return true;
    } catch (error) {
      console.error('[SyncManager] saveSetting error:', error);
      return false;
    }
  }

  async getSetting(key, defaultValue = null) {
    try {
      const result = await this.getFromStore('settings', key);
      return result ? result.value : defaultValue;
    } catch {
      const settings = this.getFromLocalStorage('settings', []);
      const setting = settings.find(s => s.key === key);
      return setting ? setting.value : defaultValue;
    }
  }

  // ============================================
  // CRUD OPERATIONS - BANNED IPs
  // ============================================
  async banIP(ip, reason = '') {
    try {
      const banData = {
        ip,
        reason,
        bannedAt: new Date().toISOString(),
        bannedBy: this.tabId
      };

      await this.putToStore('bannedIps', banData);
      this.sendMessage('BAN_IP', banData);
      await this.addLog('IP_BANNED', `IP ${ip} has been banned. Reason: ${reason || 'No reason'}`);
      console.log(`[SyncManager] IP banned: ${ip}`);
      return banData;
    } catch (error) {
      console.error('[SyncManager] banIP error:', error);
      return null;
    }
  }

  async unbanIP(ip) {
    try {
      await this.deleteFromStore('bannedIps', ip);
      this.sendMessage('UNBAN_IP', { ip });
      await this.addLog('IP_UNBANNED', `IP ${ip} has been unbanned`);
      console.log(`[SyncManager] IP unbanned: ${ip}`);
      return true;
    } catch (error) {
      console.error('[SyncManager] unbanIP error:', error);
      return false;
    }
  }

  async isIPBanned(ip) {
    try {
      const bannedIPs = await this.getAllBannedIPs();
      return bannedIPs.some(b => b.ip === ip);
    } catch {
      const bannedIPs = this.getFromLocalStorage('bannedIps', []);
      return bannedIPs.some(b => b.ip === ip);
    }
  }

  async getAllBannedIPs() {
    const bannedIPs = await this.getAllFromStore('bannedIps');
    return Array.isArray(bannedIPs) ? bannedIPs : [];
  }

  // ============================================
  // STATISTICS
  // ============================================
  async getStatistics() {
    try {
      const orders = await this.getAllOrders();
      const visitors = await this.getAllVisitors();
      const now = new Date();
      
      // Đảm bảo orders và visitors là array
      const ordersArray = Array.isArray(orders) ? orders : [];
      const visitorsArray = Array.isArray(visitors) ? visitors : [];
      
      const today = ordersArray.filter(o => {
        try {
          const d = new Date(o.createdAt);
          return d.toDateString() === now.toDateString();
        } catch(e) { return false; }
      });

      // Unique IPs today
      const uniqueIPs = new Set(
        visitorsArray
          .filter(v => {
            try {
              const d = new Date(v.timestamp);
              return d.toDateString() === now.toDateString();
            } catch(e) { return false; }
          })
          .map(v => v.ip)
          .filter(ip => ip)
      );

      // Stats by game
      const byGame = {};
      ordersArray.forEach(o => {
        if (o.game) {
          byGame[o.game] = (byGame[o.game] || 0) + 1;
        }
      });

      // Stats by server
      const byServer = {};
      ordersArray.forEach(o => {
        if (o.server) {
          byServer[o.server] = (byServer[o.server] || 0) + 1;
        }
      });

      return {
        orders: {
          total: ordersArray.length,
          pending: ordersArray.filter(o => o.status === 'pending').length,
          processing: ordersArray.filter(o => o.status === 'processing').length,
          completed: ordersArray.filter(o => o.status === 'completed').length,
          rejected: ordersArray.filter(o => o.status === 'rejected').length,
          today: today.length,
          todayCompleted: today.filter(o => o.status === 'completed').length
        },
        revenue: {
          total: ordersArray
            .filter(o => o.status === 'completed')
            .reduce((s, o) => s + (parseInt(o.price) || 0), 0),
          today: today
            .filter(o => o.status === 'completed')
            .reduce((s, o) => s + (parseInt(o.price) || 0), 0)
        },
        visitors: {
          total: visitorsArray.length,
          today: uniqueIPs.size
        },
        byGame,
        byServer
      };
    } catch(error) {
      console.error('[SyncManager] getStatistics error:', error);
      return {
        orders: { total: 0, pending: 0, processing: 0, completed: 0, rejected: 0, today: 0, todayCompleted: 0 },
        revenue: { total: 0, today: 0 },
        visitors: { total: 0, today: 0 },
        byGame: {},
        byServer: {}
      };
    }
  }

  // ============================================
  // SYNC OPERATIONS
  // ============================================
  async syncAll() {
    try {
      const orders = await this.getAllOrders();
      const visitors = await this.getAllVisitors();
      const logs = await this.getLogs(50);
      const bannedIPs = await this.getAllBannedIPs();
      const stats = await this.getStatistics();
      
      const syncData = {
        orders: Array.isArray(orders) ? orders : [],
        visitors: Array.isArray(visitors) ? visitors : [],
        logs: Array.isArray(logs) ? logs : [],
        bannedIPs: Array.isArray(bannedIPs) ? bannedIPs : [],
        stats,
        timestamp: Date.now()
      };

      this.saveToLocalStorage('last_sync', syncData);
      this.lastSyncTime = Date.now();

      return syncData;
    } catch (error) {
      console.error('[SyncManager] syncAll error:', error);
      return null;
    }
  }

  startAutoSync(intervalMs = 5000) {
    if (this.syncInterval) clearInterval(this.syncInterval);
    
    this.syncInterval = setInterval(() => {
      this.syncAll().catch(e => console.error('[SyncManager] Auto-sync error:', e));
    }, intervalMs);
    
    console.log(`[SyncManager] Auto-sync started (${intervalMs}ms)`);
  }

  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // ============================================
  // LOCAL STORAGE HELPERS
  // ============================================
  getFromLocalStorage(key, defaultValue) {
    try {
      const data = localStorage.getItem(`tool_band_${key}`);
      if (!data) return defaultValue;
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  saveToLocalStorage(key, value) {
    try {
      const jsonStr = JSON.stringify(value);
      localStorage.setItem(`tool_band_${key}`, jsonStr);
    } catch (e) {
      console.error('[SyncManager] localStorage save error:', e);
      // Nếu hết dung lượng, xóa dữ liệu cũ
      try {
        localStorage.clear();
        localStorage.setItem(`tool_band_${key}`, JSON.stringify(value));
      } catch(e2) {
        console.error('[SyncManager] localStorage completely full');
      }
    }
  }

  listenForStorageChanges() {
    window.addEventListener('storage', (event) => {
      if (event.key && event.key.startsWith('tool_band_sync_msg_')) {
        try {
          const msg = JSON.parse(event.newValue);
          if (msg && msg.source !== this.tabId) {
            this.handleSyncMessage(msg);
          }
          // Cleanup old sync messages
          localStorage.removeItem(event.key);
        } catch (e) {}
      }
    });
  }

  handleSyncMessage(msg) {
    switch(msg.type) {
      case 'ORDER_CREATED':
        this.handleRemoteOrderCreated(msg.data);
        break;
      case 'ORDER_UPDATED':
        this.handleRemoteOrderUpdated(msg.data);
        break;
      case 'ORDER_DELETED':
        this.handleRemoteOrderDeleted(msg.data);
        break;
      case 'VISITOR_ADDED':
        this.handleRemoteVisitor(msg.data);
        break;
      case 'LOG_ADDED':
        this.handleRemoteLog(msg.data);
        break;
      case 'BAN_IP':
        this.handleBanIP(msg.data);
        break;
      case 'UNBAN_IP':
        this.handleUnbanIP(msg.data);
        break;
      case 'DATA_CLEARED':
        this.handleDataCleared();
        break;
    }
  }

  // ============================================
  // REMOTE EVENT HANDLERS
  // ============================================
  handleRemoteOrderCreated(order) {
    const orders = this.getFromLocalStorage('orders', []);
    if (!orders.find(o => o.orderId === order.orderId)) {
      orders.unshift(order);
      this.saveToLocalStorage('orders', orders.slice(0, 500));
      
      if (this.isAdminTab() && window.showNotification) {
        window.showNotification('🆕 Đơn hàng mới', `#${order.orderId} - ${order.game || 'N/A'}`);
      }
    }
  }

  handleRemoteOrderUpdated(data) {
    const orders = this.getFromLocalStorage('orders', []);
    const index = orders.findIndex(o => o.orderId === data.orderId);
    if (index !== -1 && data.updates) {
      orders[index] = { ...orders[index], ...data.updates, updatedAt: new Date().toISOString() };
      this.saveToLocalStorage('orders', orders);
    }
  }

  handleRemoteOrderDeleted(data) {
    const orders = this.getFromLocalStorage('orders', []);
    this.saveToLocalStorage('orders', orders.filter(o => o.orderId !== data.orderId));
  }

  handleRemoteVisitor(visitor) {
    const visitors = this.getFromLocalStorage('visitors', []);
    if (!visitors.find(v => v.id === visitor.id)) {
      visitors.unshift(visitor);
      this.saveToLocalStorage('visitors', visitors.slice(0, 1000));
    }
  }

  handleRemoteLog(log) {
    const logs = this.getFromLocalStorage('logs', []);
    logs.unshift(log);
    this.saveToLocalStorage('logs', logs.slice(0, 200));
  }

  handleSettingsChanged(data) {
    const settings = this.getFromLocalStorage('settings', []);
    const index = settings.findIndex(s => s.key === data.key);
    if (index >= 0) {
      settings[index] = { key: data.key, value: data.value, updatedAt: new Date().toISOString() };
    } else {
      settings.push({ key: data.key, value: data.value, updatedAt: new Date().toISOString() });
    }
    this.saveToLocalStorage('settings', settings);
  }

  handleBanIP(data) {
    const bannedIPs = this.getFromLocalStorage('bannedIps', []);
    const index = bannedIPs.findIndex(b => b.ip === data.ip);
    if (index >= 0) {
      bannedIPs[index] = data;
    } else {
      bannedIPs.push(data);
    }
    this.saveToLocalStorage('bannedIps', bannedIPs);
  }

  handleUnbanIP(data) {
    const bannedIPs = this.getFromLocalStorage('bannedIps', []);
    this.saveToLocalStorage('bannedIps', bannedIPs.filter(b => b.ip !== data.ip));
  }

  handleDataCleared() {
    ['orders', 'visitors', 'logs', 'bannedIps', 'settings'].forEach(key => {
      this.saveToLocalStorage(key, []);
    });
  }

  // ============================================
  // DATA MANAGEMENT
  // ============================================
  async exportData() {
    try {
      const data = {
        orders: await this.getAllOrders(),
        visitors: await this.getAllVisitors(),
        logs: await this.getLogs(1000),
        bannedIPs: await this.getAllBannedIPs(),
        stats: await this.getStatistics(),
        exportDate: new Date().toISOString(),
        version: '3.0'
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tool_band_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log('[SyncManager] Data exported');
      return data;
    } catch(e) {
      console.error('[SyncManager] Export error:', e);
      return null;
    }
  }

  async importData(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target.result);
          
          if (data.orders && Array.isArray(data.orders)) {
            this.saveToLocalStorage('orders', data.orders);
          }
          if (data.visitors && Array.isArray(data.visitors)) {
            this.saveToLocalStorage('visitors', data.visitors);
          }
          if (data.logs && Array.isArray(data.logs)) {
            this.saveToLocalStorage('logs', data.logs);
          }
          if (data.bannedIPs && Array.isArray(data.bannedIPs)) {
            this.saveToLocalStorage('bannedIPs', data.bannedIPs);
          }
          
          await this.syncAll();
          console.log('[SyncManager] Data imported');
          resolve(data);
        } catch (error) {
          console.error('[SyncManager] Import error:', error);
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  async clearAllData() {
    try {
      ['orders', 'visitors', 'logs', 'bannedIps', 'settings'].forEach(key => {
        this.saveToLocalStorage(key, []);
        localStorage.removeItem(`tool_band_sync_msg_`);
      });
      
      // Clear sync messages
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('tool_band_sync_msg_')) {
          localStorage.removeItem(key);
        }
      });
      
      if (this.useIndexedDB && this.db) {
        const stores = ['orders', 'visitors', 'logs', 'bannedIps', 'settings'];
        for (const storeName of stores) {
          try {
            const tx = this.db.transaction([storeName], 'readwrite');
            await tx.objectStore(storeName).clear();
          } catch(e) {}
        }
      }
      
      this.sendMessage('DATA_CLEARED', { timestamp: Date.now() });
      await this.addLog('DATA_CLEARED', 'All data cleared');
      console.log('[SyncManager] All data cleared');
      return true;
    } catch(e) {
      console.error('[SyncManager] Clear error:', e);
      return false;
    }
  }
}

// Tạo instance global
window.SyncManager = SyncManager;

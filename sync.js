// sync.js - Hệ thống đồng bộ dữ liệu thời gian thực 24/7
// Sử dụng BroadcastChannel API + localStorage

class SyncManager {
  constructor() {
    this.channel = null;
    this.tabId = this.generateTabId();
    this.syncInterval = null;
    this.lastSyncTime = null;
    this.listeners = {};
    
    this.initChannel();
    this.startAutoSync();
    this.listenForStorageChanges();
    
    console.log(`[SyncManager] Tab ${this.tabId} initialized`);
  }

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

  initChannel() {
    try {
      this.channel = new BroadcastChannel('tool_band_sync_channel');
      
      this.channel.onmessage = (event) => {
        const { type, data, source } = event.data;
        if (source === this.tabId) return;
        
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
          case 'DATA_CLEARED':
            this.handleDataCleared();
            break;
          case 'SYNC_REQUEST':
            this.syncAll();
            break;
        }
      };
    } catch (error) {
      console.warn('[SyncManager] BroadcastChannel not available, using localStorage only');
    }
  }

  sendMessage(type, data) {
    if (this.channel) {
      try {
        this.channel.postMessage({ type, data, source: this.tabId, timestamp: Date.now() });
      } catch (e) {}
    }
    
    // Fallback localStorage
    try {
      const key = `tool_band_sync_msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      localStorage.setItem(key, JSON.stringify({ type, data, source: this.tabId, timestamp: Date.now() }));
      // Cleanup sau 10 giây
      setTimeout(() => localStorage.removeItem(key), 10000);
    } catch(e) {}
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
      localStorage.setItem(`tool_band_${key}`, JSON.stringify(value));
    } catch (e) {
      console.error('[SyncManager] Storage full, clearing old data');
      try {
        // Xóa sync messages cũ
        const keys = Object.keys(localStorage);
        keys.forEach(k => {
          if (k.startsWith('tool_band_sync_msg_')) localStorage.removeItem(k);
        });
        localStorage.setItem(`tool_band_${key}`, JSON.stringify(value));
      } catch(e2) {}
    }
  }

  // ============================================
  // ORDERS CRUD
  // ============================================
  async addOrder(orderData) {
    const order = {
      ...orderData,
      orderId: orderData.orderId || `FF-${Date.now().toString(36).toUpperCase()}`,
      status: orderData.status || 'pending',
      createdAt: orderData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const orders = this.getFromLocalStorage('orders', []);
    orders.unshift(order);
    this.saveToLocalStorage('orders', orders.slice(0, 500));
    
    this.sendMessage('ORDER_CREATED', order);
    this.addLog('ORDER_CREATED', `New order #${order.orderId}`);
    return order;
  }

  async updateOrder(orderId, updates) {
    const orders = this.getFromLocalStorage('orders', []);
    const index = orders.findIndex(o => o.orderId === orderId);
    
    let order;
    if (index >= 0) {
      order = { ...orders[index], ...updates, updatedAt: new Date().toISOString() };
      orders[index] = order;
    } else {
      order = { orderId, ...updates, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      orders.unshift(order);
    }
    
    this.saveToLocalStorage('orders', orders);
    this.sendMessage('ORDER_UPDATED', { orderId, updates: order });
    return order;
  }

  async deleteOrder(orderId) {
    const orders = this.getFromLocalStorage('orders', []);
    this.saveToLocalStorage('orders', orders.filter(o => o.orderId !== orderId));
    this.sendMessage('ORDER_DELETED', { orderId });
    return true;
  }

  async getAllOrders() {
    return this.getFromLocalStorage('orders', []);
  }

  async getOrder(orderId) {
    const orders = this.getFromLocalStorage('orders', []);
    return orders.find(o => o.orderId === orderId) || null;
  }

  // ============================================
  // VISITORS CRUD
  // ============================================
  async addVisitor(visitorData) {
    const visitor = {
      ...visitorData,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: visitorData.timestamp || new Date().toISOString()
    };

    const visitors = this.getFromLocalStorage('visitors', []);
    visitors.unshift(visitor);
    this.saveToLocalStorage('visitors', visitors.slice(0, 1000));
    
    this.sendMessage('VISITOR_ADDED', visitor);
    return visitor;
  }

  async getAllVisitors() {
    return this.getFromLocalStorage('visitors', []);
  }

  // ============================================
  // LOGS CRUD
  // ============================================
  async addLog(type, message, data = null) {
    const log = {
      type,
      message,
      data: data ? JSON.stringify(data) : null,
      timestamp: new Date().toISOString(),
      source: this.tabId
    };

    const logs = this.getFromLocalStorage('logs', []);
    logs.unshift(log);
    this.saveToLocalStorage('logs', logs.slice(0, 200));
    
    this.sendMessage('LOG_ADDED', log);
    return log;
  }

  async getLogs(limit = 100) {
    const logs = this.getFromLocalStorage('logs', []);
    return logs.slice(0, limit);
  }

  // ============================================
  // SETTINGS CRUD
  // ============================================
  async saveSetting(key, value) {
    const settings = this.getFromLocalStorage('settings', {});
    settings[key] = value;
    this.saveToLocalStorage('settings', settings);
    this.sendMessage('SETTINGS_CHANGED', { key, value });
    return true;
  }

  async getSetting(key, defaultValue = null) {
    const settings = this.getFromLocalStorage('settings', {});
    return settings[key] !== undefined ? settings[key] : defaultValue;
  }

  // ============================================
  // BANNED IPs CRUD
  // ============================================
  async banIP(ip, reason = '') {
    const banData = {
      ip,
      reason,
      bannedAt: new Date().toISOString()
    };

    const bannedIPs = this.getFromLocalStorage('bannedIps', []);
    const index = bannedIPs.findIndex(b => b.ip === ip);
    if (index >= 0) {
      bannedIPs[index] = banData;
    } else {
      bannedIPs.push(banData);
    }
    
    this.saveToLocalStorage('bannedIps', bannedIPs);
    this.sendMessage('BAN_IP', banData);
    this.addLog('IP_BANNED', `IP ${ip} banned. Reason: ${reason || 'No reason'}`);
    return banData;
  }

  async unbanIP(ip) {
    const bannedIPs = this.getFromLocalStorage('bannedIps', []);
    this.saveToLocalStorage('bannedIps', bannedIPs.filter(b => b.ip !== ip));
    this.sendMessage('UNBAN_IP', { ip });
    this.addLog('IP_UNBANNED', `IP ${ip} unbanned`);
    return true;
  }

  async isIPBanned(ip) {
    if (!ip || ip === 'unknown' || ip.startsWith('unknown_')) return false;
    const bannedIPs = this.getFromLocalStorage('bannedIps', []);
    return bannedIPs.some(b => b.ip === ip);
  }

  async getAllBannedIPs() {
    return this.getFromLocalStorage('bannedIps', []);
  }

  // ============================================
  // STATISTICS
  // ============================================
  async getStatistics() {
    const orders = this.getFromLocalStorage('orders', []);
    const visitors = this.getFromLocalStorage('visitors', []);
    const now = new Date();
    
    const today = orders.filter(o => {
      try {
        return new Date(o.createdAt).toDateString() === now.toDateString();
      } catch(e) { return false; }
    });

    const uniqueIPs = new Set(
      visitors
        .filter(v => {
          try { return new Date(v.timestamp).toDateString() === now.toDateString(); }
          catch(e) { return false; }
        })
        .map(v => v.ip)
        .filter(ip => ip && ip !== 'unknown' && !ip.startsWith('unknown_'))
    );

    return {
      orders: {
        total: orders.length,
        pending: orders.filter(o => o.status === 'pending').length,
        processing: orders.filter(o => o.status === 'processing').length,
        completed: orders.filter(o => o.status === 'completed').length,
        rejected: orders.filter(o => o.status === 'rejected').length,
        today: today.length,
        todayCompleted: today.filter(o => o.status === 'completed').length
      },
      revenue: {
        total: orders.filter(o => o.status === 'completed').reduce((s, o) => s + (parseInt(o.price) || 0), 0),
        today: today.filter(o => o.status === 'completed').reduce((s, o) => s + (parseInt(o.price) || 0), 0)
      },
      visitors: {
        total: visitors.length,
        today: uniqueIPs.size
      }
    };
  }

  // ============================================
  // SYNC
  // ============================================
  async syncAll() {
    try {
      const data = {
        orders: this.getFromLocalStorage('orders', []),
        visitors: this.getFromLocalStorage('visitors', []),
        bannedIPs: this.getFromLocalStorage('bannedIps', []),
        stats: await this.getStatistics(),
        timestamp: Date.now()
      };
      this.lastSyncTime = Date.now();
      return data;
    } catch(e) {
      console.error('[SyncManager] syncAll error:', e);
      return null;
    }
  }

  startAutoSync(intervalMs = 5000) {
    if (this.syncInterval) clearInterval(this.syncInterval);
    this.syncInterval = setInterval(() => {
      this.syncAll();
    }, intervalMs);
  }

  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // ============================================
  // STORAGE CHANGE LISTENER
  // ============================================
  listenForStorageChanges() {
    window.addEventListener('storage', (event) => {
      if (event.key && event.key.startsWith('tool_band_sync_msg_')) {
        try {
          const msg = JSON.parse(event.newValue);
          if (msg && msg.source !== this.tabId) {
            this.handleSyncMessage(msg);
          }
        } catch (e) {}
      }
    });
  }

  handleSyncMessage(msg) {
    switch(msg.type) {
      case 'ORDER_CREATED': this.handleRemoteOrderCreated(msg.data); break;
      case 'ORDER_UPDATED': this.handleRemoteOrderUpdated(msg.data); break;
      case 'ORDER_DELETED': this.handleRemoteOrderDeleted(msg.data); break;
      case 'VISITOR_ADDED': this.handleRemoteVisitor(msg.data); break;
      case 'LOG_ADDED': this.handleRemoteLog(msg.data); break;
      case 'BAN_IP': this.handleBanIP(msg.data); break;
      case 'UNBAN_IP': this.handleUnbanIP(msg.data); break;
      case 'DATA_CLEARED': this.handleDataCleared(); break;
    }
  }

  handleRemoteOrderCreated(order) {
    const orders = this.getFromLocalStorage('orders', []);
    if (!orders.find(o => o.orderId === order.orderId)) {
      orders.unshift(order);
      this.saveToLocalStorage('orders', orders.slice(0, 500));
      if (this.isAdminTab() && window.showNotification) {
        window.showNotification('🆕 Đơn mới', `#${order.orderId}`);
      }
    }
  }

  handleRemoteOrderUpdated(data) {
    const orders = this.getFromLocalStorage('orders', []);
    const index = orders.findIndex(o => o.orderId === data.orderId);
    if (index >= 0 && data.updates) {
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
    const settings = this.getFromLocalStorage('settings', {});
    settings[data.key] = data.value;
    this.saveToLocalStorage('settings', settings);
  }

  handleBanIP(data) {
    const bannedIPs = this.getFromLocalStorage('bannedIps', []);
    const index = bannedIPs.findIndex(b => b.ip === data.ip);
    if (index >= 0) bannedIPs[index] = data;
    else bannedIPs.push(data);
    this.saveToLocalStorage('bannedIps', bannedIPs);
  }

  handleUnbanIP(data) {
    const bannedIPs = this.getFromLocalStorage('bannedIps', []);
    this.saveToLocalStorage('bannedIps', bannedIPs.filter(b => b.ip !== data.ip));
  }

  handleDataCleared() {
    ['orders', 'visitors', 'logs', 'bannedIps', 'settings'].forEach(key => {
      this.saveToLocalStorage(key, key === 'settings' ? {} : []);
    });
  }

  // ============================================
  // DATA MANAGEMENT
  // ============================================
  async exportData() {
    const data = {
      orders: this.getFromLocalStorage('orders', []),
      visitors: this.getFromLocalStorage('visitors', []),
      logs: await this.getLogs(1000),
      bannedIPs: this.getFromLocalStorage('bannedIps', []),
      stats: await this.getStatistics(),
      exportDate: new Date().toISOString()
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
    
    return data;
  }

  async importData(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (data.orders) this.saveToLocalStorage('orders', data.orders);
          if (data.visitors) this.saveToLocalStorage('visitors', data.visitors);
          if (data.logs) this.saveToLocalStorage('logs', data.logs);
          if (data.bannedIPs) this.saveToLocalStorage('bannedIPs', data.bannedIPs);
          resolve(data);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  async clearAllData() {
    ['orders', 'visitors', 'logs', 'bannedIps'].forEach(key => {
      this.saveToLocalStorage(key, []);
    });
    this.saveToLocalStorage('settings', {});
    
    // Xóa sync messages
    const keys = Object.keys(localStorage);
    keys.forEach(k => {
      if (k.startsWith('tool_band_sync_msg_')) localStorage.removeItem(k);
    });
    
    this.sendMessage('DATA_CLEARED', { timestamp: Date.now() });
    return true;
  }
}

window.SyncManager = SyncManager;

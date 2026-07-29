// ============================================
// SYNC MANAGER - Đồng bộ dữ liệu 24/24
// Hỗ trợ đa tab, đa cửa sổ
// Tích hợp bảo mật
// ============================================

class SyncManager {
  constructor() {
    this.syncInterval = null;
    this.intervalTime = 5000;
    this.lastSyncTime = null;
    this.isSyncing = false;
    this.listeners = [];
    this.syncKey = 'sync_timestamp';
    this.dataKeys = ['orders', 'banned_ips', 'visitors', 'security_logs'];
    this.broadcastChannel = null;
    
    try {
      this.broadcastChannel = new BroadcastChannel('sync_channel');
      this.broadcastChannel.onmessage = (event) => {
        if (event.data && event.data.type === 'sync') {
          console.log('🔄 Nhận tín hiệu đồng bộ từ tab khác');
          this.handleSyncMessage(event.data);
        }
      };
    } catch (e) {
      console.log('⚠️ Broadcast Channel không được hỗ trợ, sử dụng localStorage fallback');
    }
    
    this.init();
  }

  init() {
    console.log('🔄 Sync Manager khởi động...');
    
    window.addEventListener('storage', (e) => {
      if (this.dataKeys.includes(e.key) || e.key === this.syncKey) {
        this.notifyListeners('syncing');
        setTimeout(() => this.notifyListeners('connected'), 500);
        this.handleDataChange(e.key, e.newValue);
      }
    });

    this.startSync();

    window.addEventListener('online', () => {
      console.log('🔄 Kết nối mạng khôi phục, bắt đầu đồng bộ...');
      this.startSync();
      this.triggerSync();
    });

    window.addEventListener('offline', () => {
      console.log('⚠️ Mất kết nối mạng!');
      this.notifyListeners('disconnected');
    });

    setInterval(() => {
      if (navigator.onLine && !this.isSyncing) {
        this.syncData();
      }
    }, this.intervalTime);

    setTimeout(() => this.syncData(), 1000);
    this.watchDataChanges();
  }

  startSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      if (navigator.onLine) {
        this.syncData();
      }
    }, this.intervalTime);

    this.notifyListeners('connected');
  }

  syncData() {
    if (this.isSyncing) return;
    
    this.isSyncing = true;
    this.notifyListeners('syncing');

    try {
      const newTimestamp = Date.now().toString();
      
      const dataSnapshot = {};
      this.dataKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) {
          try {
            dataSnapshot[key] = JSON.parse(value);
          } catch (e) {
            dataSnapshot[key] = value;
          }
        }
      });
      
      localStorage.setItem(this.syncKey, newTimestamp);
      
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({
          type: 'sync',
          timestamp: newTimestamp,
          keys: this.dataKeys
        });
      }
      
      const ordersCount = dataSnapshot.orders ? dataSnapshot.orders.length : 0;
      const bannedCount = dataSnapshot.banned_ips ? dataSnapshot.banned_ips.length : 0;
      console.log(`🔄 Đồng bộ: ${ordersCount} đơn hàng, ${bannedCount} IP bị ban`);

      this.lastSyncTime = newTimestamp;
      this.notifyListeners('connected');

    } catch (error) {
      console.error('❌ Lỗi đồng bộ:', error);
      this.notifyListeners('disconnected');
    }

    this.isSyncing = false;
  }

  handleSyncMessage(data) {
    if (data.timestamp && data.timestamp !== this.lastSyncTime) {
      this.syncData();
    }
  }

  watchDataChanges() {
    this.dataKeys.forEach(key => {
      let oldValue = localStorage.getItem(key);
      
      setInterval(() => {
        const newValue = localStorage.getItem(key);
        if (newValue !== oldValue) {
          oldValue = newValue;
          this.handleDataChange(key, newValue);
        }
      }, 1000);
    });
  }

  handleDataChange(key, value) {
    if (this.dataKeys.includes(key)) {
      console.log(`📝 Dữ liệu thay đổi: ${key}`);
      clearTimeout(this._changeTimeout);
      this._changeTimeout = setTimeout(() => {
        if (navigator.onLine) {
          this.syncData();
        }
      }, 500);
    }
  }

  triggerSync() {
    if (navigator.onLine) {
      this.syncData();
    } else {
      console.warn('⚠️ Không có kết nối mạng, không thể đồng bộ');
    }
  }

  onSync(callback) {
    if (typeof callback === 'function') {
      this.listeners.push(callback);
    }
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notifyListeners(status) {
    this.listeners.forEach(callback => {
      try {
        if (typeof callback === 'function') {
          callback(status);
        }
      } catch (e) {
        console.error('Lỗi listener:', e);
      }
    });
  }

  getStatus() {
    if (!navigator.onLine) return 'disconnected';
    if (this.isSyncing) return 'syncing';
    return 'connected';
  }

  stopSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
    }
    this.notifyListeners('disconnected');
    console.log('🔄 Đã dừng đồng bộ');
  }

  restoreData() {
    try {
      const backup = localStorage.getItem('data_backup');
      if (backup) {
        const data = JSON.parse(backup);
        Object.keys(data).forEach(key => {
          localStorage.setItem(key, JSON.stringify(data[key]));
        });
        console.log('✅ Đã khôi phục dữ liệu từ backup');
        this.triggerSync();
      }
    } catch (e) {
      console.error('❌ Lỗi khôi phục dữ liệu:', e);
    }
  }

  backupData() {
    try {
      const data = {};
      this.dataKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) {
          try {
            data[key] = JSON.parse(value);
          } catch (e) {
            data[key] = value;
          }
        }
      });
      localStorage.setItem('data_backup', JSON.stringify(data));
      console.log('💾 Đã backup dữ liệu');
    } catch (e) {
      console.error('❌ Lỗi backup dữ liệu:', e);
    }
  }
}

// ============================================
// KHỞI TẠO SYNC MANAGER
// ============================================

// Kiểm tra document đã ready chưa
function initSyncManager() {
  if (window.syncManager) {
    console.log('⚠️ Sync Manager đã tồn tại');
    return;
  }
  
  const syncManager = new SyncManager();
  window.syncManager = syncManager;

  // Hàm tiện ích
  window.getSyncStatus = function() {
    return syncManager.getStatus();
  };

  window.triggerSync = function() {
    syncManager.triggerSync();
  };

  window.backupData = function() {
    syncManager.backupData();
  };

  window.restoreData = function() {
    syncManager.restoreData();
  };

  console.log('✅ Sync Manager đã sẵn sàng, đồng bộ 24/24!');

  // Backup mỗi 5 phút
  setInterval(() => {
    if (navigator.onLine) {
      syncManager.backupData();
    }
  }, 300000);

  // Backup trước khi đóng trang
  window.addEventListener('beforeunload', () => {
    const timestamp = Date.now().toString();
    localStorage.setItem('last_sync_before_unload', timestamp);
    syncManager.backupData();
    console.log('💾 Đã lưu trạng thái trước khi thoát');
  });
}

// Khởi tạo khi DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSyncManager);
} else {
  initSyncManager();
}

console.log('✅ Hệ thống đồng bộ 24/24 đã sẵn sàng!');

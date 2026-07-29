// ============================================
// SYNC MANAGER - Đồng bộ dữ liệu 24/24
// Hỗ trợ đa tab, đa cửa sổ
// Tích hợp bảo mật
// ============================================

class SyncManager {
  constructor() {
    this.syncInterval = null;
    this.intervalTime = 5000; // 5 giây
    this.lastSyncTime = null;
    this.isSyncing = false;
    this.listeners = [];
    this.syncKey = 'sync_timestamp';
    this.dataKeys = ['orders', 'banned_ips', 'visitors', 'security_logs'];
    this.broadcastChannel = null;
    
    // Khởi tạo Broadcast Channel cho đồng bộ real-time
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
    
    // Lắng nghe sự kiện storage từ các tab khác
    window.addEventListener('storage', (e) => {
      if (this.dataKeys.includes(e.key) || e.key === this.syncKey) {
        this.notifyListeners('syncing');
        setTimeout(() => this.notifyListeners('connected'), 500);
        this.handleDataChange(e.key, e.newValue);
      }
    });

    // Bắt đầu đồng bộ
    this.startSync();

    // Theo dõi trạng thái mạng
    window.addEventListener('online', () => {
      console.log('🔄 Kết nối mạng khôi phục, bắt đầu đồng bộ...');
      this.startSync();
      this.triggerSync();
    });

    window.addEventListener('offline', () => {
      console.log('⚠️ Mất kết nối mạng!');
      this.notifyListeners('disconnected');
    });

    // Đồng bộ định kỳ
    setInterval(() => {
      if (navigator.onLine && !this.isSyncing) {
        this.syncData();
      }
    }, this.intervalTime);

    // Đồng bộ ngay khi khởi động
    setTimeout(() => this.syncData(), 1000);

    // Theo dõi thay đổi dữ liệu
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
      
      // Đồng bộ tất cả dữ liệu
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
      
      // Lưu timestamp
      localStorage.setItem(this.syncKey, newTimestamp);
      
      // Gửi tín hiệu đồng bộ qua Broadcast Channel
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({
          type: 'sync',
          timestamp: newTimestamp,
          keys: this.dataKeys
        });
      }
      
      // Log
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

  // Xử lý tin nhắn từ Broadcast Channel
  handleSyncMessage(data) {
    if (data.timestamp && data.timestamp !== this.lastSyncTime) {
      // Có dữ liệu mới từ tab khác
      this.syncData();
    }
  }

  // Theo dõi thay đổi dữ liệu
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
      // Kích hoạt đồng bộ sau khi có thay đổi
      clearTimeout(this._changeTimeout);
      this._changeTimeout = setTimeout(() => {
        if (navigator.onLine) {
          this.syncData();
        }
      }, 500);
    }
  }

  // Kích hoạt đồng bộ thủ công
  triggerSync() {
    if (navigator.onLine) {
      this.syncData();
    } else {
      console.warn('⚠️ Không có kết nối mạng, không thể đồng bộ');
    }
  }

  // Đăng ký listener
  onSync(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  // Thông báo cho tất cả listener
  notifyListeners(status) {
    this.listeners.forEach(callback => {
      try {
        callback(status);
      } catch (e) {
        console.error('Lỗi listener:', e);
      }
    });
  }

  // Lấy trạng thái hiện tại
  getStatus() {
    if (!navigator.onLine) return 'disconnected';
    if (this.isSyncing) return 'syncing';
    return 'connected';
  }

  // Dừng đồng bộ
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

  // Khôi phục dữ liệu từ backup
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

  // Backup dữ liệu
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

// Tạo instance toàn cục
const syncManager = new SyncManager();

// Export để sử dụng
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

// ============================================
// TỰ ĐỘNG BACKUP
// ============================================

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

// ============================================
// KHÔI PHỤC KHI TẢI TRANG
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  const lastSync = localStorage.getItem('last_sync_before_unload');
  if (lastSync) {
    console.log(`🔄 Khôi phục từ lần đồng bộ cuối: ${new Date(parseInt(lastSync)).toLocaleString('vi-VN')}`);
    
    // Kiểm tra và khôi phục nếu cần
    const currentSync = localStorage.getItem('sync_timestamp');
    if (!currentSync || parseInt(currentSync) < parseInt(lastSync)) {
      console.log('🔄 Phát hiện dữ liệu cũ, đang đồng bộ...');
      setTimeout(() => {
        syncManager.restoreData();
        syncManager.triggerSync();
      }, 2000);
    }
  }
  
  // Đồng bộ sau khi tải trang
  setTimeout(() => {
    syncManager.triggerSync();
  }, 3000);
});

// ============================================
// XỬ LÝ LỖI VÀ RECOVERY
// ============================================

// Theo dõi lỗi localStorage
window.addEventListener('error', (e) => {
  if (e.message && e.message.includes('localStorage')) {
    console.warn('⚠️ Lỗi localStorage, thử khôi phục...');
    try {
      // Thử khởi tạo lại
      localStorage.setItem('test', 'test');
      localStorage.removeItem('test');
    } catch (err) {
      console.error('❌ Không thể truy cập localStorage:', err);
    }
  }
});

console.log('✅ Hệ thống đồng bộ 24/24 đã sẵn sàng!');

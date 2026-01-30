
import { useState, useEffect, useCallback, useRef } from 'react';
import { Table, TableStatus, MenuItem, OrderItem, OrderItemStatus, HistoryEntry, AppNotification, UserRole, User, BankConfig } from './types';
import { INITIAL_MENU } from './constants';

const STORAGE_KEY = 'restaurant_data_v4';
const CLOUD_CONFIG_KEY = 'restaurant_cloud_url_v4';
const DEFAULT_CLOUD_URL = 'https://smart-resto-e3a59-default-rtdb.asia-southeast1.firebasedatabase.app/data.json';

const DEFAULT_USERS: User[] = [
  { id: 'u-admin', username: 'admin', password: '123', role: UserRole.ADMIN, fullName: 'Quản lý Tổng' }
];

const DEFAULT_BANK: BankConfig = {
  bankId: 'ICB',
  accountNo: '',
  accountName: ''
};

export const useRestaurantStore = () => {
  const [tables, setTables] = useState<Table[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [users, setUsers] = useState<User[]>(DEFAULT_USERS);
  const [bankConfig, setBankConfig] = useState<BankConfig>(DEFAULT_BANK);
  const [cloudUrl, setCloudUrl] = useState<string>(localStorage.getItem(CLOUD_CONFIG_KEY) || DEFAULT_CLOUD_URL);
  const [syncStatus, setSyncStatus] = useState<'IDLE' | 'SYNCING' | 'ERROR' | 'SUCCESS'>('IDLE');
  const [lastSynced, setLastSynced] = useState<number>(Date.now());
  const [latency, setLatency] = useState<number>(0);
  const [errorDetail, setErrorDetail] = useState<string>('');

  const stateRef = useRef({ tables, menu, history, notifications, users, bankConfig, lastUpdated: 0 });

  // Đồng bộ hóa Ref với State để dùng trong các hàm callback
  useEffect(() => {
    stateRef.current = { 
      tables, menu, history, notifications, users, bankConfig, 
      lastUpdated: stateRef.current.lastUpdated 
    };
  }, [tables, menu, history, notifications, users, bankConfig]);

  const syncLock = useRef(false);
  const lastCloudDataHash = useRef<string>('');
  const isInitialPull = useRef(true);

  const updateCloudUrl = (url: string) => {
    let trimmedUrl = url.trim();
    if (trimmedUrl) {
      if (!trimmedUrl.startsWith('http')) trimmedUrl = 'https://' + trimmedUrl;
      if (!trimmedUrl.endsWith('.json')) {
        trimmedUrl = trimmedUrl.endsWith('/') ? trimmedUrl + 'data.json' : trimmedUrl + '/data.json';
      }
    } else {
      trimmedUrl = DEFAULT_CLOUD_URL;
    }
    localStorage.setItem(CLOUD_CONFIG_KEY, trimmedUrl);
    setCloudUrl(trimmedUrl);
    lastCloudDataHash.current = '';
    setErrorDetail('');
    setSyncStatus('IDLE');
    isInitialPull.current = true;
  };

  const saveAndPush = useCallback(async (t: Table[], m: MenuItem[], h: HistoryEntry[], n: AppNotification[], u: User[], b: BankConfig, forceTimestamp?: number) => {
    if (syncLock.current && !forceTimestamp) return; // Tránh ghi đè khi đang pull

    const timestamp = forceTimestamp || Date.now();
    stateRef.current.lastUpdated = timestamp;

    const normalizedTables = t.map(table => ({
        ...table,
        currentOrders: Array.isArray(table.currentOrders) ? table.currentOrders : []
    }));

    const dataToSave = { 
      tables: normalizedTables, 
      menu: m, 
      history: h, 
      notifications: n, 
      users: u.length > 0 ? u : DEFAULT_USERS,
      bankConfig: b,
      lastUpdated: timestamp 
    };
    
    const dataStr = JSON.stringify(dataToSave);
    
    // Cập nhật Local State ngay lập tức để UX mượt mà
    setTables(normalizedTables); 
    setMenu(m); 
    setHistory(h); 
    setNotifications(n); 
    setUsers(u.length > 0 ? u : DEFAULT_USERS);
    setBankConfig(b);
    
    localStorage.setItem(STORAGE_KEY, dataStr);
    lastCloudDataHash.current = dataStr;

    if (!cloudUrl) return;

    try {
      setSyncStatus('SYNCING');
      const isFirebase = cloudUrl.includes('firebaseio.com') || cloudUrl.includes('firebasedatabase.app');
      
      const response = await fetch(cloudUrl, {
        method: isFirebase ? 'PUT' : 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: dataStr
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      setSyncStatus('SUCCESS');
      setErrorDetail('');
      setLastSynced(Date.now());
    } catch (error: any) {
      console.error("Push Error:", error);
      setSyncStatus('ERROR');
      setErrorDetail(error.message || 'Không thể ghi dữ liệu lên Cloud');
    }
  }, [cloudUrl]);

  const pullFromCloud = useCallback(async (isManual = false) => {
    if (!cloudUrl || syncLock.current) return;
    
    syncLock.current = true;
    const startTime = Date.now();
    if (isManual) setSyncStatus('SYNCING');

    try {
      const response = await fetch(`${cloudUrl}?t=${Date.now()}`, {
        method: 'GET',
        mode: 'cors',
        headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' }
      });

      if (!response.ok) {
        if (response.status === 404) throw new Error("URL không tồn tại (404)");
        throw new Error(`Lỗi kết nối: ${response.status}`);
      }
      
      const cloudData = await response.json();
      
      // TRƯỜNG HỢP URL CHẾT/RỖNG: Nếu Cloud trả về null, đẩy dữ liệu hiện tại lên để khởi tạo
      if (cloudData === null) {
        console.warn("Cloud data is null, re-initializing...");
        syncLock.current = false; // Mở khóa để push
        await saveAndPush(
          stateRef.current.tables, 
          stateRef.current.menu, 
          stateRef.current.history, 
          stateRef.current.notifications, 
          stateRef.current.users, 
          stateRef.current.bankConfig,
          Date.now()
        );
        return;
      }

      const cloudDataStr = JSON.stringify(cloudData);
      
      // Kiểm tra thay đổi bằng Hash và Timestamp
      if (cloudDataStr !== lastCloudDataHash.current) {
        const cloudTimestamp = cloudData.lastUpdated || 0;
        
        // Chỉ cập nhật nếu dữ liệu trên Cloud MỚI hơn dữ liệu cục bộ
        if (cloudTimestamp > stateRef.current.lastUpdated || isInitialPull.current) {
          const processedTables = (cloudData.tables || []).map((t: any) => ({
            ...t,
            currentOrders: Array.isArray(t.currentOrders) ? t.currentOrders : []
          }));
          
          setTables(processedTables);
          setMenu(cloudData.menu || INITIAL_MENU);
          setHistory(cloudData.history || []);
          setNotifications(cloudData.notifications || []);
          setUsers(cloudData.users && cloudData.users.length > 0 ? cloudData.users : DEFAULT_USERS);
          setBankConfig(cloudData.bankConfig || DEFAULT_BANK);
          stateRef.current.lastUpdated = cloudTimestamp;
          
          localStorage.setItem(STORAGE_KEY, cloudDataStr);
          lastCloudDataHash.current = cloudDataStr;
          isInitialPull.current = false;
        } 
      }
      
      setLatency(Date.now() - startTime);
      setSyncStatus('SUCCESS');
      setErrorDetail('');
      setLastSynced(Date.now());
    } catch (error: any) {
      setSyncStatus('ERROR');
      setErrorDetail(error.message || 'Lỗi mạng');
    } finally {
      syncLock.current = false;
    }
  }, [cloudUrl, saveAndPush]);

  // Khởi tạo từ LocalStorage khi mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const p = JSON.parse(saved);
        setTables(p.tables || []);
        setMenu(p.menu || INITIAL_MENU);
        setHistory(p.history || []);
        setNotifications(p.notifications || []);
        setUsers(p.users && p.users.length > 0 ? p.users : DEFAULT_USERS);
        setBankConfig(p.bankConfig || DEFAULT_BANK);
        stateRef.current.lastUpdated = p.lastUpdated || 0;
        lastCloudDataHash.current = saved;
      } catch (e) {}
    } else {
        const initialTables = Array.from({ length: 12 }, (_, i) => ({
            id: i + 1, status: TableStatus.AVAILABLE, currentOrders: [], needsCleaning: false
        }));
        setTables(initialTables);
        setMenu(INITIAL_MENU);
        setUsers(DEFAULT_USERS);
        setBankConfig(DEFAULT_BANK);
        stateRef.current.lastUpdated = Date.now();
    }
  }, []);

  // Vòng lặp đồng bộ 1 giây - Đảm bảo luôn chạy nếu có Cloud URL
  useEffect(() => {
    if (!cloudUrl) return;
    pullFromCloud(true);
    const interval = setInterval(() => {
      pullFromCloud();
    }, 1000); 
    return () => clearInterval(interval);
  }, [cloudUrl, pullFromCloud]);

  const requestTableQr = (tableId: number) => {
    const newTables = stateRef.current.tables.map(t => t.id === tableId ? { ...t, qrRequested: true } : t);
    const newNotif: AppNotification = {
        id: `N-QRREQ-${Date.now()}-${tableId}`, targetRole: UserRole.ADMIN, title: 'Yêu cầu mã QR', message: `Nhân viên yêu cầu mã QR cho Bàn ${tableId}`, timestamp: Date.now(), read: false, type: 'qr_request'
    };
    saveAndPush(newTables, stateRef.current.menu, stateRef.current.history, [newNotif, ...stateRef.current.notifications], stateRef.current.users, stateRef.current.bankConfig);
  };

  const approveTableQr = (tableId: number) => {
    const token = Math.random().toString(36).substring(2, 10).toUpperCase();
    const newTables = stateRef.current.tables.map(t => t.id === tableId ? { ...t, qrRequested: false, sessionToken: token, status: TableStatus.OCCUPIED } : t);
    const newNotifs = stateRef.current.notifications.filter(n => !(n.type === 'qr_request' && n.message.includes(`Bàn ${tableId}`)));
    saveAndPush(newTables, stateRef.current.menu, stateRef.current.history, newNotifs, stateRef.current.users, stateRef.current.bankConfig);
  };

  const requestPayment = (tableId: number) => {
    const newTables = stateRef.current.tables.map(t => t.id === tableId ? { ...t, status: TableStatus.PAYING } : t);
    const newNotif: AppNotification = {
        id: `N-PAY-${Date.now()}-${Math.random()}`, targetRole: UserRole.STAFF, title: 'Yêu cầu thanh toán', message: `Bàn ${tableId} yêu cầu thanh toán`, timestamp: Date.now(), read: false, type: 'payment'
    };
    saveAndPush(newTables, stateRef.current.menu, stateRef.current.history, [newNotif, ...stateRef.current.notifications], stateRef.current.users, stateRef.current.bankConfig);
  };

  const confirmPayment = (tableId: number) => {
    const table = stateRef.current.tables.find(t => t.id === tableId);
    if (table) {
      const entry: HistoryEntry = {
        id: `H-${Date.now()}`, tableId, items: [...(table.currentOrders || [])],
        total: (table.currentOrders || []).reduce((acc, item) => acc + (item.price * item.quantity), 0),
        date: new Date().toLocaleString()
      };
      const newTables = stateRef.current.tables.map(t => t.id === tableId ? { ...t, status: TableStatus.BILLING, needsCleaning: true, sessionToken: undefined } : t);
      saveAndPush(newTables, stateRef.current.menu, [entry, ...stateRef.current.history], stateRef.current.notifications, stateRef.current.users, stateRef.current.bankConfig);
    }
  };

  const setTableEmpty = (tableId: number) => {
    const newTables = stateRef.current.tables.map(t => t.id === tableId ? { ...t, status: TableStatus.AVAILABLE, currentOrders: [], needsCleaning: false, sessionToken: undefined, qrRequested: false } : t);
    saveAndPush(newTables, stateRef.current.menu, stateRef.current.history, stateRef.current.notifications, stateRef.current.users, stateRef.current.bankConfig);
  };

  const placeOrder = (tableId: number, items: OrderItem[]) => {
    const newTables = stateRef.current.tables.map(t => t.id === tableId ? { 
        ...t, 
        status: TableStatus.OCCUPIED, 
        currentOrders: [...(Array.isArray(t.currentOrders) ? t.currentOrders : []), ...items] 
    } : t);
    
    const newNotif: AppNotification = {
      id: `N-ORD-${Date.now()}-${Math.random()}`, targetRole: UserRole.STAFF, title: 'Đơn mới', message: `Bàn ${tableId} vừa gọi món`, timestamp: Date.now(), read: false, type: 'order'
    };
    saveAndPush(newTables, stateRef.current.menu, stateRef.current.history, [newNotif, ...stateRef.current.notifications], stateRef.current.users, stateRef.current.bankConfig);
  };

  const updateOrderItemStatus = (tableId: number, itemId: string, status: OrderItemStatus) => {
    const newTables = stateRef.current.tables.map(t => t.id === tableId ? { ...t, currentOrders: (t.currentOrders || []).map(o => o.id === itemId ? { ...o, status } : o) } : t);
    let extraNotifs = [...stateRef.current.notifications];
    if (status === OrderItemStatus.READY) {
      const item = newTables.find(t => t.id === tableId)?.currentOrders.find(o => o.id === itemId);
      extraNotifs = [{
        id: `N-KITCHEN-${Date.now()}`, targetRole: UserRole.STAFF, title: 'Bếp xong món', message: `Bàn ${tableId}: ${item?.name} sẵn sàng`, timestamp: Date.now(), read: false, type: 'kitchen'
      }, ...extraNotifs];
    }
    saveAndPush(newTables, stateRef.current.menu, stateRef.current.history, extraNotifs, stateRef.current.users, stateRef.current.bankConfig);
  };

  const confirmBulkOrders = (tableId: number) => {
    const newTables = stateRef.current.tables.map(t => t.id === tableId ? { ...t, currentOrders: (t.currentOrders || []).map(o => o.status === OrderItemStatus.PENDING ? { ...o, status: OrderItemStatus.CONFIRMED } : o) } : t);
    const newNotif: AppNotification = {
      id: `N-CHEF-${Date.now()}`, targetRole: UserRole.KITCHEN, title: 'Chế biến mới', message: `Bàn ${tableId} có đơn mới`, timestamp: Date.now(), read: false, type: 'order'
    };
    saveAndPush(newTables, stateRef.current.menu, stateRef.current.history, [newNotif, ...stateRef.current.notifications], stateRef.current.users, stateRef.current.bankConfig);
  };

  const markAsCleaned = (tableId: number) => {
    const newTables = stateRef.current.tables.map(t => t.id === tableId ? { ...t, needsCleaning: false } : t);
    saveAndPush(newTables, stateRef.current.menu, stateRef.current.history, stateRef.current.notifications, stateRef.current.users, stateRef.current.bankConfig);
  };

  const manageUsers = (newUsers: User[]) => {
    saveAndPush(stateRef.current.tables, stateRef.current.menu, stateRef.current.history, stateRef.current.notifications, newUsers, stateRef.current.bankConfig);
  };

  const deleteNotification = (notifId: string) => {
    const newNotifs = stateRef.current.notifications.filter(n => n.id !== notifId);
    saveAndPush(stateRef.current.tables, stateRef.current.menu, stateRef.current.history, newNotifs, stateRef.current.users, stateRef.current.bankConfig);
  };

  const clearHistory = () => {
    saveAndPush(stateRef.current.tables, stateRef.current.menu, [], stateRef.current.notifications, stateRef.current.users, stateRef.current.bankConfig);
  };

  const updateBankConfig = (b: BankConfig) => {
    saveAndPush(stateRef.current.tables, stateRef.current.menu, stateRef.current.history, stateRef.current.notifications, stateRef.current.users, b);
  };

  return {
    tables, menu, history, notifications, users, bankConfig, syncStatus, lastSynced, cloudUrl, latency, errorDetail,
    updateCloudUrl, requestPayment, confirmPayment, setTableEmpty, placeOrder,
    updateOrderItemStatus, confirmBulkOrders, markAsCleaned, manageUsers, saveAndPush, deleteNotification,
    clearHistory, updateBankConfig, requestTableQr, approveTableQr,
    pullFromCloud: () => pullFromCloud(true)
  };
};

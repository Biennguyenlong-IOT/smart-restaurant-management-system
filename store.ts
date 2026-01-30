
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

  // Sử dụng Ref để lưu trữ trạng thái mới nhất cho các hàm callback và so sánh
  const stateRef = useRef({ 
    tables, 
    menu, 
    history, 
    notifications, 
    users, 
    bankConfig, 
    lastUpdated: 0,
    isPushing: false 
  });

  useEffect(() => {
    stateRef.current = { 
      ...stateRef.current,
      tables, 
      menu, 
      history, 
      notifications, 
      users, 
      bankConfig 
    };
  }, [tables, menu, history, notifications, users, bankConfig]);

  const lastCloudDataHash = useRef<string>('');
  const isInitialPull = useRef(true);

  const updateCloudUrl = useCallback((url: string) => {
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
    stateRef.current.lastUpdated = 0;
  }, []);

  const saveAndPush = useCallback(async (t: Table[], m: MenuItem[], h: HistoryEntry[], n: AppNotification[], u: User[], b: BankConfig, forceTimestamp?: number) => {
    // Tăng timestamp để đánh dấu phiên bản dữ liệu mới
    const timestamp = forceTimestamp || Date.now();
    
    // Cập nhật UI ngay lập tức (Optimistic UI)
    setTables(t);
    setMenu(m);
    setHistory(h);
    setNotifications(n);
    setUsers(u.length > 0 ? u : DEFAULT_USERS);
    setBankConfig(b);
    
    stateRef.current.lastUpdated = timestamp;
    stateRef.current.isPushing = true; // Khóa pull trong khi đang push

    const dataToSave = { 
      tables: t, 
      menu: m, 
      history: h, 
      notifications: n, 
      users: u, 
      bankConfig: b, 
      lastUpdated: timestamp 
    };
    
    const dataStr = JSON.stringify(dataToSave);
    localStorage.setItem(STORAGE_KEY, dataStr);
    lastCloudDataHash.current = dataStr;

    if (!cloudUrl) {
      stateRef.current.isPushing = false;
      return;
    }

    try {
      setSyncStatus('SYNCING');
      const isFirebase = cloudUrl.includes('firebasedatabase.app');
      const response = await fetch(cloudUrl, {
        method: isFirebase ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: dataStr
      });
      
      if (response.ok) {
        setSyncStatus('SUCCESS');
        setLastSynced(Date.now());
      } else {
        throw new Error("Push failed");
      }
    } catch (e) {
      console.error("Sync Error:", e);
      setSyncStatus('ERROR');
    } finally {
      // Đợi một khoảng ngắn sau khi push xong để đảm bảo server đã cập nhật ổn định trước khi pull lại
      setTimeout(() => {
        stateRef.current.isPushing = false;
      }, 500);
    }
  }, [cloudUrl]);

  const pullFromCloud = useCallback(async (isManual = false) => {
    // Không pull nếu đang trong quá trình push dữ liệu lên
    if (!cloudUrl || stateRef.current.isPushing) return;
    
    const startTime = Date.now();
    if (isManual) setSyncStatus('SYNCING');

    try {
      // Thêm timestamp để tránh cache trình duyệt
      const response = await fetch(`${cloudUrl}?nocache=${Date.now()}`, {
        headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' }
      });
      
      if (!response.ok) throw new Error("Network error");
      
      const cloudData = await response.json();
      if (!cloudData) return;

      const cloudDataStr = JSON.stringify(cloudData);
      
      // Kiểm tra xem dữ liệu có thực sự khác biệt không
      if (cloudDataStr !== lastCloudDataHash.current) {
        const cloudTimestamp = cloudData.lastUpdated || 0;
        
        // Chỉ cập nhật nếu dữ liệu từ cloud "mới hơn" dữ liệu hiện tại
        // hoặc là lần đầu tiên load ứng dụng
        if (cloudTimestamp > stateRef.current.lastUpdated || isInitialPull.current) {
          setTables(cloudData.tables || []);
          setMenu(cloudData.menu || INITIAL_MENU);
          setHistory(cloudData.history || []);
          setNotifications(cloudData.notifications || []);
          setUsers(cloudData.users || DEFAULT_USERS);
          setBankConfig(cloudData.bankConfig || DEFAULT_BANK);
          
          stateRef.current.lastUpdated = cloudTimestamp;
          lastCloudDataHash.current = cloudDataStr;
          localStorage.setItem(STORAGE_KEY, cloudDataStr);
          isInitialPull.current = false;
        } else {
          // Nếu dữ liệu cloud cũ hơn hoặc bằng, vẫn cập nhật hash để tránh so sánh lại
          lastCloudDataHash.current = cloudDataStr;
        }
      }
      
      setLatency(Date.now() - startTime);
      setSyncStatus('SUCCESS');
      setLastSynced(Date.now());
    } catch (error) {
      console.warn("Pull error:", error);
      if (isManual) setSyncStatus('ERROR');
    }
  }, [cloudUrl]);

  const userHeartbeat = useCallback((userId: string) => {
    const now = Date.now();
    const updatedUsers = stateRef.current.users.map(u => 
      u.id === userId ? { ...u, lastActive: now } : u
    );
    // Heartbeat chỉ đẩy dữ liệu, không cập nhật timestamp chính để tránh kích hoạt pull diện rộng
    saveAndPush(
      stateRef.current.tables,
      stateRef.current.menu,
      stateRef.current.history,
      stateRef.current.notifications,
      updatedUsers,
      stateRef.current.bankConfig,
      stateRef.current.lastUpdated
    );
  }, [saveAndPush]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const p = JSON.parse(saved);
        setTables(p.tables || []);
        setMenu(p.menu || INITIAL_MENU);
        setHistory(p.history || []);
        setNotifications(p.notifications || []);
        setUsers(p.users || DEFAULT_USERS);
        setBankConfig(p.bankConfig || DEFAULT_BANK);
        stateRef.current.lastUpdated = p.lastUpdated || 0;
        lastCloudDataHash.current = saved;
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (!cloudUrl) return;
    pullFromCloud(true);
    // Tần suất đồng bộ hợp lý (2.5 giây) để tránh quá tải và feedback loop
    const interval = setInterval(() => pullFromCloud(false), 2500); 
    return () => clearInterval(interval);
  }, [cloudUrl, pullFromCloud]);

  // Các hàm nghiệp vụ giữ nguyên logic nhưng bọc trong store logic chuẩn
  const requestTableQr = useCallback((tableId: number) => {
    const newTables = stateRef.current.tables.map(t => t.id === tableId ? { ...t, qrRequested: true } : t);
    const newNotif: AppNotification = {
        id: `N-QRREQ-${Date.now()}`, targetRole: UserRole.ADMIN, title: 'Yêu cầu mã QR', message: `Bàn ${tableId} yêu cầu mã QR`, timestamp: Date.now(), read: false, type: 'qr_request'
    };
    saveAndPush(newTables, stateRef.current.menu, stateRef.current.history, [newNotif, ...stateRef.current.notifications], stateRef.current.users, stateRef.current.bankConfig);
  }, [saveAndPush]);

  const approveTableQr = useCallback((tableId: number) => {
    const token = Math.random().toString(36).substring(2, 10).toUpperCase();
    const newTables = stateRef.current.tables.map(t => t.id === tableId ? { ...t, qrRequested: false, sessionToken: token, status: TableStatus.OCCUPIED } : t);
    const newNotifs = stateRef.current.notifications.filter(n => !(n.type === 'qr_request' && n.message.includes(`Bàn ${tableId}`)));
    saveAndPush(newTables, stateRef.current.menu, stateRef.current.history, newNotifs, stateRef.current.users, stateRef.current.bankConfig);
  }, [saveAndPush]);

  const placeOrder = useCallback((tableId: number, items: OrderItem[]) => {
    const newTables = stateRef.current.tables.map(t => t.id === tableId ? { 
        ...t, 
        status: TableStatus.OCCUPIED, 
        currentOrders: [...(t.currentOrders || []), ...items] 
    } : t);
    const newNotif: AppNotification = {
      id: `N-ORD-${Date.now()}`, targetRole: UserRole.STAFF, title: 'Đơn mới', message: `Bàn ${tableId} gọi món`, timestamp: Date.now(), read: false, type: 'order'
    };
    saveAndPush(newTables, stateRef.current.menu, stateRef.current.history, [newNotif, ...stateRef.current.notifications], stateRef.current.users, stateRef.current.bankConfig);
  }, [saveAndPush]);

  const updateOrderItemStatus = useCallback((tableId: number, itemId: string, status: OrderItemStatus) => {
    const newTables = stateRef.current.tables.map(t => t.id === tableId ? { ...t, currentOrders: (t.currentOrders || []).map(o => o.id === itemId ? { ...o, status } : o) } : t);
    saveAndPush(newTables, stateRef.current.menu, stateRef.current.history, stateRef.current.notifications, stateRef.current.users, stateRef.current.bankConfig);
  }, [saveAndPush]);

  const requestPayment = useCallback((tableId: number) => {
    const newTables = stateRef.current.tables.map(t => t.id === tableId ? { ...t, status: TableStatus.PAYING } : t);
    const newNotif: AppNotification = {
      id: `N-PAY-${Date.now()}`, targetRole: UserRole.STAFF, title: 'Yêu cầu thanh toán', message: `Bàn ${tableId} yêu cầu thanh toán`, timestamp: Date.now(), read: false, type: 'payment'
    };
    saveAndPush(newTables, stateRef.current.menu, stateRef.current.history, [newNotif, ...stateRef.current.notifications], stateRef.current.users, stateRef.current.bankConfig);
  }, [saveAndPush]);

  const confirmPayment = useCallback((tableId: number) => {
    const table = stateRef.current.tables.find(t => t.id === tableId);
    if (!table) return;
    const total = table.currentOrders.reduce((s, o) => s + (o.price * o.quantity), 0);
    const newHistory: HistoryEntry = {
      id: `H-${Date.now()}`,
      tableId,
      items: table.currentOrders,
      total,
      date: new Date().toLocaleString()
    };
    const newTables = stateRef.current.tables.map(t => t.id === tableId ? { ...t, status: TableStatus.BILLING, needsCleaning: true, sessionToken: undefined } : t);
    saveAndPush(newTables, stateRef.current.menu, [newHistory, ...stateRef.current.history], stateRef.current.notifications, stateRef.current.users, stateRef.current.bankConfig);
  }, [saveAndPush]);

  const setTableEmpty = useCallback((tableId: number) => {
    const newTables = stateRef.current.tables.map(t => t.id === tableId ? { ...t, status: TableStatus.AVAILABLE, currentOrders: [], needsCleaning: false, sessionToken: undefined, qrRequested: false } : t);
    saveAndPush(newTables, stateRef.current.menu, stateRef.current.history, stateRef.current.notifications, stateRef.current.users, stateRef.current.bankConfig);
  }, [saveAndPush]);

  const manageUsers = useCallback((u: User[]) => {
    saveAndPush(stateRef.current.tables, stateRef.current.menu, stateRef.current.history, stateRef.current.notifications, u, stateRef.current.bankConfig);
  }, [saveAndPush]);

  const updateBankConfig = useCallback((b: BankConfig) => {
    saveAndPush(stateRef.current.tables, stateRef.current.menu, stateRef.current.history, stateRef.current.notifications, stateRef.current.users, b);
  }, [saveAndPush]);

  const clearHistory = useCallback(() => {
    saveAndPush(stateRef.current.tables, stateRef.current.menu, [], stateRef.current.notifications, stateRef.current.users, stateRef.current.bankConfig);
  }, [saveAndPush]);

  const deleteNotification = useCallback((id: string) => {
    const filtered = stateRef.current.notifications.filter(n => n.id !== id);
    saveAndPush(stateRef.current.tables, stateRef.current.menu, stateRef.current.history, filtered, stateRef.current.users, stateRef.current.bankConfig);
  }, [saveAndPush]);

  return {
    tables, menu, history, notifications, users, bankConfig, syncStatus, lastSynced, cloudUrl, latency, errorDetail,
    updateCloudUrl, requestPayment, confirmPayment, 
    setTableEmpty, placeOrder, userHeartbeat,
    updateOrderItemStatus, confirmBulkOrders: (id:number) => {
        const newTables = stateRef.current.tables.map(t => t.id === id ? { ...t, currentOrders: t.currentOrders.map(o => o.status === OrderItemStatus.PENDING ? {...o, status: OrderItemStatus.CONFIRMED} : o) } : t);
        saveAndPush(newTables, stateRef.current.menu, stateRef.current.history, stateRef.current.notifications, stateRef.current.users, stateRef.current.bankConfig);
    }, markAsCleaned: (id:number) => setTableEmpty(id), 
    manageUsers, saveAndPush, deleteNotification,
    clearHistory, updateBankConfig, requestTableQr, approveTableQr,
    pullFromCloud: () => pullFromCloud(true)
  };
};

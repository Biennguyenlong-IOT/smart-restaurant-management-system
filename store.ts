
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

  useEffect(() => {
    stateRef.current = { tables, menu, history, notifications, users, bankConfig, lastUpdated: stateRef.current.lastUpdated };
  }, [tables, menu, history, notifications, users, bankConfig]);

  const syncLock = useRef(false);
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
  }, []);

  const saveAndPush = useCallback(async (t: Table[], m: MenuItem[], h: HistoryEntry[], n: AppNotification[], u: User[], b: BankConfig, forceTimestamp?: number) => {
    const timestamp = forceTimestamp || Date.now();
    
    setTables(t);
    setMenu(m);
    setHistory(h);
    setNotifications(n);
    setUsers(u.length > 0 ? u : DEFAULT_USERS);
    setBankConfig(b);
    
    stateRef.current.lastUpdated = timestamp;
    const dataToSave = { tables: t, menu: m, history: h, notifications: n, users: u, bankConfig: b, lastUpdated: timestamp };
    const dataStr = JSON.stringify(dataToSave);
    localStorage.setItem(STORAGE_KEY, dataStr);
    lastCloudDataHash.current = dataStr;

    if (!cloudUrl || syncLock.current) return;

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
      }
    } catch (e) {
      setSyncStatus('ERROR');
    }
  }, [cloudUrl]);

  const pullFromCloud = useCallback(async (isManual = false) => {
    if (!cloudUrl || syncLock.current) return;
    syncLock.current = true;
    const startTime = Date.now();
    if (isManual) setSyncStatus('SYNCING');

    try {
      const response = await fetch(`${cloudUrl}?t=${Date.now()}`, {
        headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' }
      });
      if (!response.ok) throw new Error("Network error");
      
      const cloudData = await response.json();
      if (!cloudData) {
        syncLock.current = false;
        return;
      }

      const cloudDataStr = JSON.stringify(cloudData);
      if (cloudDataStr !== lastCloudDataHash.current) {
        const cloudTimestamp = cloudData.lastUpdated || 0;
        
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
        }
      }
      
      setLatency(Date.now() - startTime);
      setSyncStatus('SUCCESS');
      setLastSynced(Date.now());
    } catch (error) {
      setSyncStatus('ERROR');
    } finally {
      syncLock.current = false;
    }
  }, [cloudUrl]);

  const userHeartbeat = useCallback((userId: string) => {
    const now = Date.now();
    const updatedUsers = stateRef.current.users.map(u => 
      u.id === userId ? { ...u, lastActive: now } : u
    );
    // Silent push for heartbeat to avoid excessive UI updates if possible
    saveAndPush(
      stateRef.current.tables,
      stateRef.current.menu,
      stateRef.current.history,
      stateRef.current.notifications,
      updatedUsers,
      stateRef.current.bankConfig,
      stateRef.current.lastUpdated // Keep same timestamp to not trigger heavy logic on others
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
    const interval = setInterval(pullFromCloud, 2000); 
    return () => clearInterval(interval);
  }, [cloudUrl, pullFromCloud]);

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

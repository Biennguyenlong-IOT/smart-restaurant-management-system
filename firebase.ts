
import { initializeApp, getApp, getApps, FirebaseApp } from "firebase/app";
import { getDatabase, Database } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "placeholder-key",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "placeholder.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "placeholder-project-id",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "placeholder.appspot.com",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "000000000000",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:000000000000:web:000000000000",
};

// Khởi tạo App không cần databaseURL ngay lập tức để tránh Fatal Error
let app: FirebaseApp;
try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
} catch (e) {
  app = initializeApp(firebaseConfig);
}

/**
 * Hàm lấy instance database an toàn.
 * Chỉ thực hiện khi URL hợp lệ.
 */
export const getRemoteDatabase = (url?: string): Database | null => {
  if (!url || !url.startsWith('http')) return null;
  
  try {
    const urlObj = new URL(url);
    // Firebase SDK yêu cầu origin (VD: https://project.firebaseio.com)
    // Không được bao gồm path như /data.json
    const rootUrl = urlObj.origin; 
    return getDatabase(app, rootUrl);
  } catch (e) {
    console.error("Firebase URL Invalid:", e);
    return null;
  }
};

export { app };

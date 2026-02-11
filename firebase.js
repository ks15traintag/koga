// Firebaseのライブラリを読み込む
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// ここにFirebaseコンソールで出た設定をコピペ
const firebaseConfig = {
  apiKey: "AIzaSyB_Xu1QHxEr91HGgBa27TyfhKnxZaGaZZI",
  authDomain: "railway-tag.firebaseapp.com",
  projectId: "railway-tag",
  storageBucket: "railway-tag.firebasestorage.app",
  messagingSenderId: "634653559098",
  appId: "1:634653559098:web:5772cc882513fff0d96803"
};

// Firebaseを初期化
const app = initializeApp(firebaseConfig);

// Firestoreを使えるようにする
export const db = getFirestore(app);

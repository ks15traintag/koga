/*************************
 * Firebase 初期設定
 *************************/
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  collection,
  onSnapshot,
  serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";


const firebaseConfig = {
  apiKey: "AIzaSyB_Xu1QHxEr91HGgBa27TyfhKnxZaGaZZI",
  authDomain: "railway-tag.firebaseapp.com",
  projectId: "railway-tag",
  storageBucket: "railway-tag.firebasestorage.app",
  messagingSenderId: "634653559098",
  appId: "1:634653559098:web:5772cc882513fff0d96803"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/*************************
 * 定数
 *************************/


/*************************
 * 変数
 *************************/
let map;
let playerId;
let playerName;
let playerRole;
let markers = {};
let timer;
let allowManual = false;
let gameStarted = false;
let gpsErrorNotified = false;
let missionTimerInterval = null;
let hunterInterval = 5 * 60 * 1000;
let runnerInterval = 5 * 60 * 1000;
let freezeUntil = null;
let realtimeUntil = null;
let realtimeLoop = null;

function initUpdateState() {
  if (!localStorage.getItem("lastUpdateAt")) {
    localStorage.setItem("lastUpdateAt", 0);
  }
}

/*************************
 * UI
 *************************/
const manualBtn = document.getElementById("manualBtn");
const companySelect = document.getElementById("companySelect");
const lineSelect = document.getElementById("lineSelect");
const stationSelect = document.getElementById("stationSelect");
const missionBox = document.getElementById("missionBox");
const missionTextEl = document.getElementById("missionText");
const missionTimerEl = document.getElementById("missionTimer");
const adminMissionDiv = document.getElementById("adminMission");


/*************************
 * ログイン
 *************************/
document.getElementById("loginBtn").onclick = () => {
  playerName = document.getElementById("name").value;
  playerRole = document.getElementById("role").value;

  if (!playerName || !playerRole) {
    alert("名前と役職を選択して！");
    return;
  }

  playerId = localStorage.getItem("playerId") || crypto.randomUUID();
  localStorage.setItem("playerId", playerId);
  localStorage.setItem("playerName", playerName);
  localStorage.setItem("playerRole", playerRole);

  initUpdateState();

  document.getElementById("login").style.display = "none";
  document.getElementById("game").style.display = "block";
if (playerRole === "admin") {
  document.getElementById("adminControl").style.display = "block";
}
  startGame();
};

/*************************
 * 自動ログイン
 *************************/
window.addEventListener("load", () => {
  const savedName = localStorage.getItem("playerName");
  const savedRole = localStorage.getItem("playerRole");
  const savedId = localStorage.getItem("playerId");

  if (savedName && savedRole && savedId) {
    playerName = savedName;
    playerRole = savedRole;
    playerId = savedId;

    initUpdateState();

    document.getElementById("login").style.display = "none";
    document.getElementById("game").style.display = "block";
if (playerRole === "admin") {
  document.getElementById("adminControl").style.display = "block";
}

    startGame();
  }
});

/*************************
 * 更新状態初期化
 *************************/


/*************************
 * ゲーム開始
 *************************/
function startGame() {
  setDoc(doc(db, "players", playerId), {
  name: playerName,
  role: playerRole,
  createdAt: serverTimestamp()
}, { merge: true });

  if (gameStarted) return;
  gameStarted = true;
if (playerRole === "admin") {
  adminMissionDiv.style.display = "block";
} else {
  adminMissionDiv.style.display = "none";
}

  map = L.map("map").setView([35.681236, 139.767125], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap"
  }).addTo(map);
// 🔵 個人ステータス監視（ここに置く）
onSnapshot(doc(db, "players", playerId), (docSnap) => {
  if (!docSnap.exists()) return;

  const data = docSnap.data();
  freezeUntil = data.freezeUntil?.toMillis?.() || null;
  realtimeUntil = data.realtimeUntil?.toMillis?.() || null;
});

  manualBtn.disabled = true;
updateButtonUI();
  startTimer();
  updateByGPS();

  onSnapshot(collection(db, "locations"), (snapshot) => {
    const aliveIds = new Set();

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (!data.visible) return;

      const id = docSnap.id;
      aliveIds.add(id);

      const pos = [data.lat, data.lng];
      const icon = getIconByRole(data.role);
      const updatedAtMs = data.updatedAt?.toMillis?.();
const popupContent = () => {
  if (!updatedAtMs) return "更新時刻不明";

  const diff = Date.now() - updatedAtMs;
  const min = Math.floor(diff / 60000);
  const sec = Math.floor((diff % 60000) / 1000);

  let adminControls = "";

  if (playerRole === "admin") {
    adminControls = `
      <br><br>
      <div>
        ⏸ 更新停止：
        <input type="number" id="freeze_${id}" style="width:60px" min="1"> 分
        <button onclick="freezePlayer('${id}')">実行</button>
      </div>
      <br>
      <div>
        ⚡ リアルタイム：
        <input type="number" id="realtime_${id}" style="width:60px" min="1"> 分
        <button onclick="realtimePlayer('${id}')">実行</button>
      </div>
    `;


  }

  return `
    <b>${data.name}</b><br>
    役職：${data.role}<br>
    最後の更新：
<span id="time_${id}">${min}分${sec}秒前</span>
    ${adminControls}
  `;
};



      if (markers[id]) {
        markers[id].setLatLng(pos);
        markers[id].setIcon(icon);
      } else {
        markers[id] = L.marker(pos, { icon })
  .addTo(map)
  .bindPopup("")
  .on("popupopen", function () {

  const marker = this;
  marker.setPopupContent(popupContent());

  const timeEl = document.getElementById(`time_${id}`);

  marker._popupInterval = setInterval(() => {

    const diff = Date.now() - updatedAtMs;
    const min = Math.floor(diff / 60000);
    const sec = Math.floor((diff % 60000) / 1000);

    if (timeEl) {
      timeEl.innerText = `${min}分${sec}秒前`;
    }

  }, 1000);

})
.on("popupclose", function () {
  if (this._popupInterval) {
    clearInterval(this._popupInterval);
    this._popupInterval = null;
  }
});

    

}
});

    Object.keys(markers).forEach((id) => {
      if (!aliveIds.has(id)) {
        map.removeLayer(markers[id]);
        delete markers[id];
      }
    });
  });
}

/*************************
 * GPS更新
 *************************/
function updateByGPS() {
  if (!canUpdateNow()) return;

  navigator.geolocation.getCurrentPosition(

    (pos) => {

      gpsErrorNotified = false;

      if (pos.coords.accuracy <= 100) {

        allowManual = false;
        manualBtn.disabled = true;

        const timerEl = document.getElementById("timer");
        const statusEl = document.getElementById("playerStatus");

        timerEl.innerText = "位置情報を取得しました";
        statusEl.innerText = "";

        updateButtonUI();

        applyUpdate(pos.coords.latitude, pos.coords.longitude);

      } else {
        enableManual("GPS精度が低いため地下モードに切り替わりました");
      }
    },

    () => {
      enableManual("GPS取得失敗。地下モードを使用してください");
    }

  );
}


function enableManual(msg) {
  allowManual = true;
  manualBtn.disabled = false;

  const timerEl = document.getElementById("timer");
  const statusEl = document.getElementById("playerStatus");

  timerEl.innerText = "⚠ 正確な位置情報が取得できません";
  statusEl.innerText = "地下モードで更新してください";

  if (!gpsErrorNotified) {
    alert(msg);
    gpsErrorNotified = true;
  }

  updateButtonUI();
}


/*************************
 * 更新処理
 *************************/
async function applyUpdate(lat, lng) {
  await setDoc(doc(db, "locations", playerId), {
    name: playerName,
    role: playerRole,
    lat,
    lng,
    visible: true,
    updatedAt: serverTimestamp()
  });

  localStorage.setItem("lastUpdateAt", Date.now())

  document.getElementById("updateStatus").innerText =
  "この時間内ですでに位置更新しました";
}

/*************************
 * タイマー
 *************************/
function startTimer() {
  clearInterval(timer);

  timer = setInterval(() => {
    const statusBox = document.getElementById("playerStatus");
const now = Date.now();

// 更新停止中
if (freezeUntil && freezeUntil > now) {
  const diff = freezeUntil - now;
  const min = Math.floor(diff / 60000);
  const sec = Math.floor((diff % 60000) / 1000);

  statusBox.innerText = `⏸ 更新停止中 残り ${min}分${sec}秒`;
  return; // 通常タイマー処理を止める
}

// リアルタイム中
if (realtimeUntil && realtimeUntil > now) {

  const diff = realtimeUntil - now;
  const min = Math.floor(diff / 60000);
  const sec = Math.floor((diff % 60000) / 1000);

  statusBox.innerText = `⚡ リアルタイム更新中 残り ${min}分${sec}秒`;

  // 🔥 リアルタイム更新ループ開始
  if (!realtimeLoop) {
    realtimeLoop = setInterval(() => {
      updateByGPS();
    }, 5000); // 5秒ごと更新（調整可能）
  }

} else {

  statusBox.innerText = "";

  // 🔥 リアルタイム終了時に停止
  if (realtimeLoop) {
    clearInterval(realtimeLoop);
    realtimeLoop = null;
    localStorage.setItem("lastUpdateAt", Date.now());
  }
}


    const last = Number(localStorage.getItem("lastUpdateAt"));
    const timerEl = document.getElementById("timer");
    const statusEl = document.getElementById("updateStatus");

    if (!last || last === 0) {

  if (allowManual) {
    timerEl.innerText = "地下モードで更新してください";
    statusEl.innerText = "GPSが使えません";
  } else {
    timerEl.innerText = "更新できます";
    statusEl.innerText = "この5分間ではまだ更新していません";
  }

  return;
}

    const next = last + getCurrentInterval();
    const diff = next - Date.now();

   if (diff <= 0) {
if (realtimeUntil && realtimeUntil > now) return;
  if (!allowManual) {
    updateByGPS(); // 🔥 自動更新
  }

  timerEl.innerText = "更新中...";
  statusEl.innerText = "";

  return;
}


    const remaining = Math.floor(diff / 1000);
    const min = Math.floor(remaining / 60);
    const sec = remaining % 60;

    timerEl.innerText = `次の更新まで ${min}分${sec}秒`;
    statusEl.innerText = "この5分間ですでに位置更新しました";
  }, 1000);
}

/*************************
 * 地下モード
 *************************/
let stationData = {};

fetch("./stations.json")
  .then(res => res.json())
  .then(data => {
    stationData = data;
    initCompanySelect();
  });

function initCompanySelect() {
  companySelect.innerHTML = '<option value="">会社を選択</option>';
  lineSelect.innerHTML = '<option value="">路線を選択</option>';
  stationSelect.innerHTML = '<option value="">駅を選択</option>';
  lineSelect.disabled = true;
  stationSelect.disabled = true;

  Object.keys(stationData).forEach(company => {
    const opt = document.createElement("option");
    opt.value = company;
    opt.textContent = company;
    companySelect.appendChild(opt);
  });
}

companySelect.onchange = () => {
  lineSelect.innerHTML = '<option value="">路線を選択</option>';
  stationSelect.innerHTML = '<option value="">駅を選択</option>';
  stationSelect.disabled = true;

  if (!companySelect.value) {
    lineSelect.disabled = true;
    return;
  }

  lineSelect.disabled = false;

  Object.keys(stationData[companySelect.value]).forEach(line => {
    const opt = document.createElement("option");
    opt.value = line;
    opt.textContent = line;
    lineSelect.appendChild(opt);
  });
};

lineSelect.onchange = () => {
  stationSelect.innerHTML = '<option value="">駅を選択</option>';
  if (!lineSelect.value) {
    stationSelect.disabled = true;
    return;
  }

  stationSelect.disabled = false;

  stationData[companySelect.value][lineSelect.value].forEach(st => {
    const opt = document.createElement("option");
    opt.value = st.name;
    opt.textContent = st.name;
    stationSelect.appendChild(opt);
  });
};

manualBtn.onclick = () => {
  if (!allowManual) return alert("地上では地下モードは使えません");
  if (!canUpdateNow()) return alert("この5分間ではすでに更新しています");

  const station =
    stationData[companySelect.value]?.[lineSelect.value]
      ?.find(s => s.name === stationSelect.value);

  if (!station) return alert("駅を選択してください");

  applyUpdate(station.lat, station.lng);
  alert(`${station.name}駅で位置更新しました`);
};
document.getElementById("setMissionBtn").onclick = async () => {
  if (playerRole !== "admin") return;

  const text = document.getElementById("missionInput").value;
  const minutes = Number(document.getElementById("missionMinutes").value);

  if (!text || !minutes) {
    alert("入力不足");
    return;
  }

  const expiresAt = Timestamp.fromMillis(
    Date.now() + minutes * 60 * 1000
  );

  await setDoc(doc(db, "missions", "current"), {
    text,
    expiresAt,
    createdAt: serverTimestamp()
  });

  alert("ミッションを設定しました");
};
/*************************
 * 更新間隔を保存（管理者用）
 *************************/
document.getElementById("setIntervalBtn").onclick = async () => {
  if (playerRole !== "admin") return;

 const hunterMin = Number(document.getElementById("hunterMinutes").value);
const runnerMin = Number(document.getElementById("runnerMinutes").value);

  if (!hunterMin || !runnerMin) {
    alert("時間を入力してください");
    return;
  }

  await setDoc(doc(db, "settings", "updateInterval"), {
    hunter: hunterMin * 60 * 1000,
    runner: runnerMin * 60 * 1000,
    updatedAt: serverTimestamp()
  });

  alert("更新間隔を変更しました");
};

/*************************
 * ログアウト
 *************************/
document.getElementById("logoutBtn").onclick = async () => {
  if (!confirm("ログアウトしますか？")) return;

  await setDoc(doc(db, "locations", playerId), {
    visible: false,
    updatedAt: serverTimestamp()
  }, { merge: true });

  localStorage.clear();
  clearInterval(timer);
  location.reload();
};

/*************************
 * アイコン
 *************************/
const iconRunner = new L.Icon({
  iconUrl: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32]
});

const iconHunter = new L.Icon({
  iconUrl: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32]
});

const iconMaster = new L.Icon({
  iconUrl: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32]
});

function getIconByRole(role) {
  if (role === "runner") return iconRunner;
  if (role === "hunter") return iconHunter;
  return iconMaster;
}
function canUpdateNow() {
  const now = Date.now();

  // 更新停止中
  if (freezeUntil && freezeUntil > now) {
    return false;
  }

  const last = Number(localStorage.getItem("lastUpdateAt"));
  if (!last) return true;

  return now >= last + getCurrentInterval();
}


function getCurrentInterval() {
  const now = Date.now();

  // リアルタイム中は即更新可能
  if (realtimeUntil && realtimeUntil > now) {
    return 0;
  }

  if (playerRole === "hunter") return hunterInterval;
  if (playerRole === "runner") return runnerInterval;

  return 5 * 60 * 1000;
}

onSnapshot(doc(db, "missions", "current"), (docSnap) => {
  if (!docSnap.exists()) {
    missionBox.style.display = "none";
    return;
  }

  const data = docSnap.data();
  const expiresAtMs = data.expiresAt?.toMillis?.();
  if (!expiresAtMs) return;

  missionBox.style.display = "block";
  missionTextEl.innerText = data.text;

  if (missionTimerInterval) {
    clearInterval(missionTimerInterval);
  }

  missionTimerInterval = setInterval(() => {
    const diff = expiresAtMs - Date.now();

    if (diff <= 0) {
      missionBox.style.display = "none";
      clearInterval(missionTimerInterval);
      missionTimerInterval = null;
      return;
    }

    const min = Math.floor(diff / 60000);
    const sec = Math.floor((diff % 60000) / 1000);

    missionTimerEl.innerText = `残り ${min}分${sec}秒`;
  }, 1000);
});
onSnapshot(doc(db, "settings", "updateInterval"), (docSnap) => {
  if (!docSnap.exists()) return;

  const data = docSnap.data();
  hunterInterval = data.hunter;
  runnerInterval = data.runner;
});


window.freezePlayer = async function(id) {
  const input = document.getElementById(`freeze_${id}`);
  const minutes = Number(input.value);

  if (!minutes || minutes <= 0) {
    alert("正しい分数を入力してください");
    return;
  }

  const until = Timestamp.fromMillis(Date.now() + minutes * 60 * 1000);

  await setDoc(doc(db, "players", id), {
    freezeUntil: until
  }, { merge: true });

  alert(`${minutes}分間 更新停止しました`);
};

window.realtimePlayer = async function(id) {
  const input = document.getElementById(`realtime_${id}`);
  const minutes = Number(input.value);

  if (!minutes || minutes <= 0) {
    alert("正しい分数を入力してください");
    return;
  }

  const until = Timestamp.fromMillis(Date.now() + minutes * 60 * 1000);

  await setDoc(doc(db, "players", id), {
    realtimeUntil: until
  }, { merge: true });

  alert(`${minutes}分間 リアルタイム更新にしました`);
};
function updateButtonUI() {

  if (manualBtn.disabled) {
    manualBtn.style.background = "#cccccc";
    manualBtn.style.opacity = "0.5";
  } else {
    manualBtn.style.background = "#ff5722";
    manualBtn.style.opacity = "1";
    manualBtn.style.color = "white";
  }
}
window.toggleAdminPanel = function() {
  const panel = document.getElementById("adminPanel");
  panel.style.display = panel.style.display === "none" ? "block" : "none";
};

// 画像縮小
async function resizeImage(file, maxWidth = 1600, maxHeight = 1600) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = e => {
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // アスペクト比を保って縮小
        if (width > maxWidth) {
          height = Math.round((maxWidth / width) * height);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((maxHeight / height) * width);
          height = maxHeight;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // JPEG に変換（品質 0.85）
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        resolve(dataUrl);
      };

      img.onerror = () => reject("画像の読み込みに失敗しました");
      img.src = e.target.result;
    };

    reader.onerror = () => reject("ファイルの読み込みに失敗しました");
    reader.readAsDataURL(file);
  });
}

// Storage
const CLOUD_URL = "https://script.google.com/macros/s/AKfycbyk2WBCCB9YxzdnWkxfQAbSOJDB-__mtyeogs0IBsz2Bwzk4On0wUtDYqmbIQ_2aSc/exec";

// クラウドから読み込み
async function loadGalleryFromCloud() {
  const res = await fetch(CLOUD_URL);
  const json = await res.json();
  return json;
}

// クラウドへ保存
async function saveGalleryToCloud(items) {
  await fetch(CLOUD_URL, {
    method: "POST",
    body: JSON.stringify(items),
  });
}

function getGallery() {
  try {
    const items = await loadGalleryFromCloud();
    return Array.isArray(items) ? items : [];
  } catch (e) {
    return [];
  }

}

function saveGallery(items) {
  await saveGalleryToCloud(items);
}

// Rendering
async function renderList() {
  const list = document.getElementById("items-list");
  const items = await getGallery();

  list.innerHTML = "";

  if (items.length === 0) {
    list.innerHTML = "<p>まだ登録された写真はありません。</p>";
    return;
  }

  items
    .slice()
    .reverse()
    .forEach(item => {
      const el = document.createElement("div");
      el.className = "item";

      el.innerHTML = `
        <div style="display:flex; gap:12px; align-items:flex-start">
          <img src="${item.src}" style="max-width:140px; max-height:120px"/>
          <div>
            <strong>${item.title ?? ""}</strong>
            <div style="color:#444">${item.description ?? ""}</div>
            <div style="color:#444">
              プレイ人数: ${item.players ?? "不明"}<br>
              プレイ時間: ${item.playTime ?? "不明"}<br>
              勝利条件: ${item.winCondition ?? "不明"}
            </div>
          </div>
        </div>
        <div style="margin-top:8px">
          <button data-id="${item.id}" class="delete-btn">削除</button>
        </div>
      `;

      list.appendChild(el);
    });

  // 削除ボタン
  document.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", async e => {
      const id = e.currentTarget.getAttribute("data-id");
      const items = (await getGallery()).filter(it => String(it.id) !== String(id));
      await saveGallery(items);
      renderList();
    });
  });
}

// Main
document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("file-input");
  const preview = document.getElementById("preview");
  const form = document.getElementById("add-form");
  const clearBtn = document.getElementById("clear-btn");
  const importFile = document.getElementById("import-file");

  // プレビュー
  fileInput.addEventListener("change", async e => {
    const f = e.target.files[0];
    if (!f) return;

    try {
      const data = await resizeImage(f, 800, 800); // プレビュー用は軽く
      preview.src = data;
      preview.style.display = "block";
    } catch (err) {
      alert("ファイルの読み込みに失敗しました");
    }
  });

  // 保存処理（縮小して保存）
  form.addEventListener("submit", async e => {
    e.preventDefault();

    const f = fileInput.files[0];
    if (!f) {
      alert("画像を選択してください");
      return;
    }

    try {
      // 画像を縮小してから保存
      const data = await resizeImage(f);

      const title = document.getElementById("title").value.trim();
      const description = document.getElementById("description").value.trim();
      const players = document.getElementById("players").value.trim();
      const playTime = document.getElementById("playTime").value.trim();
      const winCondition = document.getElementById("winCondition").value.trim();

      const items = getGallery();
      items.push({
        id: Date.now(),
        src: data,
        title,
        description,
        players,
        playTime,
        winCondition
      });

      saveGallery(items);

      form.reset();
      preview.style.display = "none";
      renderList();

      alert("保存しました（縮小して保存）");
    } catch (err) {
      alert("保存中にエラーが発生しました: " + err);
    }
  });

  // フォームクリア
  clearBtn.addEventListener("click", () => {
    form.reset();
    preview.style.display = "none";
  });

  // JSON インポート
  importFile.addEventListener("change", async e => {
    const f = e.target.files[0];
    if (!f) return;

    try {
      const txt = await f.text();
      const imported = JSON.parse(txt);

      if (!Array.isArray(imported)) throw new Error("JSON must be array");

      const items = getGallery().concat(
        imported.map(it => ({
          id: it.id || Date.now() + Math.random(),
          src: it.src,
          title: it.title,
          description: it.description,
          players: it.players,
          playTime: it.playTime,
          winCondition: it.winCondition
        }))
      );

      await saveGallery(items);
      renderList();
      alert("インポート完了");
    } catch (err) {
      alert("インポートに失敗しました: " + err.message);
    }
  });

  renderList();
});

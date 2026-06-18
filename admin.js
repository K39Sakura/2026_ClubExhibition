// Storage
const CLOUD_URL = "https://script.google.com/macros/s/AKfycbyk2WBCCB9YxzdnWkxfQAbSOJDB-__mtyeogs0IBsz2Bwzk4On0wUtDYqmbIQ_2aSc/exec";

// クラウドから読み込み
async function loadGalleryFromCloud() {
  const res = await fetch(CLOUD_URL);
  const json = await res.json();
  return json;
}
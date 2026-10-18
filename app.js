// ==========================================
// 1. PARÇA BAŞLANGICI - FIREBASE VE AYARLAR
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyCqNlKNZAqp2R7EFYin95UY67xp3WikVvA",
    authDomain: "azenia-stok-d5896.firebaseapp.com",
    projectId: "azenia-stok-d5896",
    storageBucket: "azenia-stok-d5896.firebasestorage.app",
    messagingSenderId: "200511374655",
    appId: "1:200511374655:web:947f20ca18e9aef4003f8a"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// Personel eklerken mevcut oturumu kapatmamak için ikincil uygulama
const secondaryApp = firebase.apps.find(a => a.name === "SecondaryApp") || firebase.initializeApp(firebaseConfig, "SecondaryApp");

const IMGBB_API_KEY = "794223bd269bc70ed757a5af6b695c94";
let currentUploadedImages = [];

let catalog = [];
let orders = [];
let materials = [];
let consumables = [];
let customers = [];
let settings = { hourlyRate: 5 };
let tempReqMaterials = [];
let tempReqConsumables = [];
let isAdmin = false;

// GİRİŞ VE YETKİLENDİRME
function firebaseLogin() {
    const userInput = document.getElementById("loginUser").value.trim().toLowerCase();
    const passInput = document.getElementById("loginPass").value;
    const errorEl = document.getElementById("loginError");

    if (!userInput || !passInput) {
        errorEl.innerText = "Lütfen alanları doldurun!";
        errorEl.classList.remove("hidden");
        errorEl.style.display = "block";
        return;
    }

    firebase.auth().signInWithEmailAndPassword(userInput + "@azeniastore.com", passInput)
        .then(() => {
            sessionStorage.setItem("azenia_logged_user", userInput);
            document.getElementById("adminLoginScreen").style.display = "none";
            yetkileriUygula(userInput);
        })
        .catch(() => {
            errorEl.innerText = "Hatalı kullanıcı adı veya şifre!";
            errorEl.classList.remove("hidden");
            errorEl.style.display = "block";
            setTimeout(() => { errorEl.style.display = "none"; }, 3000);
        });
}

function yetkileriUygula(username) {
    isAdmin = username.includes("admin");
    document.querySelectorAll('.admin-only').forEach(el => {
        if (!isAdmin) el.classList.add('hidden');
        else el.classList.remove('hidden');
    });
    updateDashboardStats();
}

function showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const toast = document.createElement("div");
    const colorClass = type === "error" ? "bg-rose-600 border-rose-400" : type === "warning" ? "bg-amber-500 border-amber-300 text-slate-900" : "bg-indigo-600 border-indigo-400";
    toast.className = `pointer-events-auto px-4 py-3 rounded-xl border shadow-xl text-white text-xs font-bold mb-2 flex items-center gap-2 transition ${colorClass}`;
    toast.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3400);
}

// PERSONEL KULLANICI OLUŞTURMA
async function createStaffUser() {
    const userInput = document.getElementById('newStaffUser').value.trim().toLowerCase();
    const passInput = document.getElementById('newStaffPass').value;

    if (!userInput || passInput.length < 6) {
        showToast("Kullanıcı adı ve en az 6 haneli şifre girin!", "error");
        return;
    }

    try {
        await secondaryApp.auth().createUserWithEmailAndPassword(userInput + "@azeniastore.com", passInput);
        await secondaryApp.auth().signOut();
        showToast(`Personel (${userInput}) başarıyla oluşturuldu!`);
        document.getElementById('newStaffUser').value = '';
        document.getElementById('newStaffPass').value = '';
    } catch (error) {
        showToast("Oluşturulamadı! İsim kullanılıyor veya şifre geçersiz.", "error");
    }
}

// ÇOKLU GÖRSEL VE GIF YÜKLEME (IMGBB)
async function handleImageUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const container = document.getElementById('imgPreviewContainer');

    showToast("Görseller yükleniyor, lütfen bekleyin...", "info");

    for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append("image", files[i]);

        const tempDiv = document.createElement('div');
        tempDiv.className = "w-20 h-20 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center relative flex-shrink-0";
        tempDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-indigo-400"></i>';
        container.appendChild(tempDiv);

        try {
            const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: formData });
            const data = await response.json();
            if (data && data.success) {
                const imgUrl = data.data.url;
                currentUploadedImages.push(imgUrl);
                tempDiv.innerHTML = `
                    <img src="${imgUrl}" class="w-full h-full object-cover rounded-xl">
                    <button type="button" onclick="removeUploadedImage('${imgUrl}', this)" class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-600 text-white rounded-full text-[10px] flex items-center justify-center shadow"><i class="fa-solid fa-xmark"></i></button>
                `;
            } else {
                tempDiv.remove();
                showToast("Bir görsel yüklenemedi!", "error");
            }
        } catch (e) {
            tempDiv.remove();
            showToast("ImgBB bağlantı hatası!", "error");
        }
    }
    showToast("Görsel yükleme tamamlandı!");
}

function removeUploadedImage(url, btnEl) {
    currentUploadedImages = currentUploadedImages.filter(item => item !== url);
    btnEl.parentElement.remove();
}

// VERİTABANI DİNLEYİCİLERİ
function initApp() {
    db.collection('guven3d_urunler').onSnapshot((snapshot) => {
        catalog = [];
        snapshot.forEach(doc => catalog.push({ id: doc.id, ...doc.data() }));
        renderVitrin();
        updateDashboardStats();
    });

    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            db.collection('guven3d_siparisler').orderBy('date', 'desc').onSnapshot((snap) => {
                orders = [];
                snap.forEach(d => orders.push({ id: d.id, ...d.data() }));
                renderOrders();
                updateDashboardStats();
            });

            db.collection('guven3d_filamentler').onSnapshot((snap) => {
                materials = [];
                snap.forEach(d => materials.push({ id: d.id, ...d.data() }));
                if (tempReqMaterials.length === 0 && materials.length > 0) {
                    tempReqMaterials = [{ id: materials[0].id, weight: 20 }];
                }
                renderMaterials();
                renderReqMaterialRows();
                updateDashboardStats();
            });

            db.collection('guven3d_sarf').onSnapshot((snap) => {
                consumables = [];
                snap.forEach(d => consumables.push({ id: d.id, ...d.data() }));
                renderConsumables();
                renderReqConsumablesRows();
            });

            db.collection('guven3d_musteriler').onSnapshot((snap) => {
                customers = [];
                snap.forEach(d => customers.push({ id: d.id, ...d.data() }));
                renderCustomers();
                populateOrderFormSelects();
            });
        }
    });

    const dot = document.getElementById("cloudStatusDot");
    const txt = document.getElementById("cloudStatusText");
    if (dot) dot.className = "w-2 h-2 rounded-full bg-emerald-400 inline-block";
    if (txt) txt.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span><span class="text-emerald-400">Sistem %100 Buluta Bağlı</span>';
}

function navSwitch(tabId) {
    document.querySelectorAll('.tab-section').forEach(sec => sec.classList.add('hidden'));
    document.getElementById(tabId)?.classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(btn => {
        if (btn.getAttribute('data-tab') === tabId) {
            btn.classList.add('active');
            btn.classList.remove('text-slate-300');
        } else {
            btn.classList.remove('active');
            btn.classList.add('text-slate-300');
        }
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// REÇETE & MALİYET HESAPLAMA
function renderReqMaterialRows() {
    const container = document.getElementById('reqMaterialsList');
    if (!container) return;
    container.innerHTML = tempReqMaterials.map((r, i) => `
        <div class="flex items-center gap-2">
            <select class="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white" onchange="tempReqMaterials[${i}].id=this.value; calculateCurrentRecipeCost()">
                ${materials.map(m => `<option value="${m.id}" ${m.id === r.id ? 'selected' : ''}>${m.name} (Stok:${m.stock}g)</option>`).join('')}
            </select>
            <div class="w-20 relative">
                <input type="number" class="w-full bg-slate-950 border border-slate-700 rounded-xl pl-2 pr-5 py-2 text-xs text-white" value="${r.weight}" oninput="tempReqMaterials[${i}].weight=parseFloat(this.value)||0; calculateCurrentRecipeCost()">
                <span class="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-500">g</span>
            </div>
            <button type="button" onclick="removeReqMaterialRow(${i})" class="bg-rose-600/20 text-rose-300 px-2.5 py-2 rounded-xl text-xs"><i class="fa-solid fa-trash"></i></button>
        </div>`).join('');
    calculateCurrentRecipeCost();
}

function removeReqMaterialRow(idx) {
    tempReqMaterials.splice(idx, 1);
    renderReqMaterialRows();
}

function renderReqConsumablesRows() {
    const container = document.getElementById('reqConsumablesList');
    if (!container) return;
    container.innerHTML = tempReqConsumables.map((r, i) => `
        <div class="flex items-center gap-2">
            <select class="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white" onchange="tempReqConsumables[${i}].id=this.value; calculateCurrentRecipeCost()">
                ${consumables.map(m => `<option value="${m.id}" ${m.id === r.id ? 'selected' : ''}>${m.name} (Birim:₺${Number(m.unitPrice || 0).toFixed(2)})</option>`).join('')}
            </select>
            <div class="w-20">
                <input type="number" class="w-full bg-slate-950 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white" value="${r.qty}" oninput="tempReqConsumables[${i}].qty=parseFloat(this.value)||0; calculateCurrentRecipeCost()">
            </div>
            <button type="button" onclick="removeReqConsumableRow(${i})" class="bg-rose-600/20 text-rose-300 px-2.5 py-2 rounded-xl text-xs"><i class="fa-solid fa-trash"></i></button>
        </div>`).join('');
    calculateCurrentRecipeCost();
}

function removeReqConsumableRow(idx) {
    tempReqConsumables.splice(idx, 1);
    renderReqConsumablesRows();
}

function calculateCurrentRecipeCost() {
    let cost = 0;
    tempReqMaterials.forEach(i => {
        const m = materials.find(x => x.id === i.id);
        if (m) cost += (Number(i.weight) || 0) * (Number(m.price) / 1000);
    });
    tempReqConsumables.forEach(i => {
        const c = consumables.find(x => x.id === i.id);
        if (c) cost += (Number(i.qty) || 0) * Number(c.unitPrice || 0);
    });

    const hours = parseFloat(document.getElementById('prodPrintTime')?.value || 0);
    const mins = parseFloat(document.getElementById('prodPrintTimeMin')?.value || 0);
    const timeCost = (hours + (mins / 60)) * settings.hourlyRate;
    const total = cost + timeCost;

    const disp = document.getElementById('calculatedCostDisplay');
    if (disp) disp.textContent = `₺${total.toFixed(2)}`;
    return Number(total.toFixed(4));
}

// === 1. PARÇA SONU ===

// ==========================================
// 2. PARÇA BAŞLANGICI - VİTRİN, MODAL VE STOK
// ==========================================
async function saveCatalogProduct() {
    const name = document.getElementById('prodName').value.trim();
    const price = parseFloat(document.getElementById('prodFinalPrice').value);

    if (!name || isNaN(price)) {
        showToast("Ürün Adı ve Satış Fiyatı zorunludur!", "error");
        return;
    }

    const hours = parseFloat(document.getElementById('prodPrintTime').value) || 0;
    const mins = parseFloat(document.getElementById('prodPrintTimeMin').value) || 0;

    const doc = {
        name: name,
        description: document.getElementById('prodDesc').value.trim(),
        tags: document.getElementById('prodTags').value.trim(),
        category: document.getElementById('prodCategory').value,
        stockCount: parseInt(document.getElementById('prodStockCount').value, 10) || 0,
        sellPrice: price,
        time: hours + (mins / 60),
        images: currentUploadedImages.length > 0 ? [...currentUploadedImages] : [],
        image: currentUploadedImages.length > 0 ? currentUploadedImages[0] : "",
        reqMaterials: tempReqMaterials.filter(i => i.id && Number(i.weight) > 0),
        reqConsumables: tempReqConsumables.filter(i => i.id && Number(i.qty) > 0),
        costProfile: calculateCurrentRecipeCost(),
        modelLink: document.getElementById('prodModelLink') ? document.getElementById('prodModelLink').value.trim() : "",
        dateAdded: new Date().toISOString()
    };

    try {
        await db.collection('guven3d_urunler').add(doc);
        showToast("Ürün buluta kaydedildi!");
        currentUploadedImages = [];
        document.getElementById('imgPreviewContainer').innerHTML = '';
        document.getElementById('prodName').value = '';
        document.getElementById('prodDesc').value = '';
        document.getElementById('prodTags').value = '';
        document.getElementById('prodFinalPrice').value = '';
        if (document.getElementById('prodModelLink')) document.getElementById('prodModelLink').value = '';
        tempReqConsumables = [];
        renderReqConsumablesRows();
        navSwitch('tabVitrin');
    } catch (e) {
        showToast("Kayıt sırasında hata oluştu!", "error");
    }
}

function renderVitrin() {
    const grid = document.getElementById('vitrinGrid');
    if (!grid) return;
    if (document.getElementById('badgeCatalogCount')) document.getElementById('badgeCatalogCount').textContent = catalog.length;

    const searchVal = (document.getElementById('vitrinSearchInput')?.value || '').toLowerCase().trim();
    const catVal = document.getElementById('vitrinCategoryFilter')?.value || 'Tümü';

    const filtered = catalog.filter(i => {
        const matchCat = catVal === 'Tümü' || i.category === catVal;
        const matchSearch = !searchVal || i.name.toLowerCase().includes(searchVal) || (i.tags && i.tags.toLowerCase().includes(searchVal));
        return matchCat && matchSearch;
    });

    populateOrderFormSelects();

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-10 text-slate-400">Ürün bulunamadı.</div>`;
        return;
    }

    grid.innerHTML = filtered.map(p => {
        const coverImg = (p.images && p.images.length > 0) ? p.images[0] : (p.image ? p.image : null);
        const imgHtml = coverImg ? `<img src="${coverImg}" class="w-full h-full object-cover">` : `<div class="w-full h-full flex items-center justify-center text-slate-600"><i class="fa-solid fa-cube text-3xl"></i></div>`;

        return `
            <div onclick="openProductModal('${p.id}')" class="glass-card rounded-2xl overflow-hidden border border-slate-800 flex flex-col cursor-pointer hover:border-indigo-500/50 transition transform hover:-translate-y-1">
                <div class="relative h-44 sm:h-52 bg-slate-950 overflow-hidden">
                    ${imgHtml}
                    ${p.images && p.images.length > 1 ? `<span class="absolute bottom-2 right-2 bg-slate-900/80 px-2 py-0.5 rounded text-[10px] text-white"><i class="fa-regular fa-images"></i> ${p.images.length}</span>` : ''}
                    <span class="absolute top-2 right-2 px-2 py-0.5 rounded-lg text-[10px] font-extrabold ${Number(p.stockCount) > 0 ? 'bg-emerald-500/90 text-slate-950' : 'bg-rose-600/90 text-white'}">Stok: ${Number(p.stockCount || 0)}</span>
                </div>
                <div class="p-3.5 text-center">
                    <h3 class="text-sm font-extrabold text-white truncate">${p.name}</h3>
                    <div class="text-base font-extrabold text-emerald-400 mt-1">₺${Number(p.sellPrice || 0).toFixed(0)}</div>
                </div>
            </div>`;
    }).join('');
}

function openProductModal(id) {
    const p = catalog.find(x => x.id === id);
    if (!p) return;

    const modal = document.getElementById('productModal');
    const content = document.getElementById('modalContent');

    const images = (p.images && p.images.length > 0) ? p.images : (p.image ? [p.image] : []);
    let galleryHtml = `<div class="h-64 bg-slate-950 flex items-center justify-center text-slate-600"><i class="fa-solid fa-image text-5xl"></i></div>`;

    if (images.length > 0) {
        const thumbs = images.length > 1 ? `<div class="flex gap-2 p-2.5 bg-slate-950 overflow-x-auto border-t border-slate-800">${images.map(img => `<img src="${img}" onclick="document.getElementById('modalMainImg').src='${img}'" class="w-16 h-16 object-cover rounded-lg cursor-pointer border-2 border-slate-700 hover:border-indigo-500 transition flex-shrink-0">`).join('')}</div>` : '';
        galleryHtml = `<div class="h-72 sm:h-80 bg-slate-950 relative"><img id="modalMainImg" src="${images[0]}" class="w-full h-full object-contain"></div>${thumbs}`;
    }

    const totalMins = Math.round((p.time || 0) * 60);
    const timeStr = `${Math.floor(totalMins / 60)}s ${totalMins % 60}dk`;

    let controlsHtml = '';
    if (isAdmin) {
        const profit = Number(p.sellPrice || 0) - Number(p.costProfile || 0);
        const reqMats = (p.reqMaterials || []).map(rm => {
            const m = materials.find(x => x.id === rm.id);
            return `<span class="bg-slate-900 px-2 py-1 rounded text-[11px] text-slate-300 border border-slate-700">${m ? m.name : (rm.name || 'Filament')}: <strong class="text-amber-400">${rm.weight}g</strong></span>`;
        }).join('');

        const reqCons = (p.reqConsumables || []).map(rc => {
            const c = consumables.find(x => x.id === rc.id);
            return `<span class="bg-sky-950 px-2 py-1 rounded text-[11px] text-sky-300 border border-sky-800">${c ? c.name : 'Malzeme'}: <strong class="text-white">${rc.qty} adet</strong></span>`;
        }).join('');

        controlsHtml = `
            <div class="mt-4 p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                <div class="flex justify-between items-center border-b border-slate-800 pb-2 text-xs">
                    <span class="text-slate-400">Maliyet: <strong class="text-amber-400">₺${Number(p.costProfile || 0).toFixed(2)}</strong> • Süre: <strong class="text-indigo-300">${timeStr}</strong></span>
                    <span class="font-extrabold text-sky-400">Net Kâr: +₺${profit.toFixed(2)}</span>
                </div>
                <div class="flex flex-wrap gap-1.5">${reqMats} ${reqCons}</div>
                <div class="grid grid-cols-2 gap-2 pt-2">
                    <button onclick="produceProductUnit('${p.id}'); closeProductModal()" class="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 rounded-xl transition"><i class="fa-solid fa-industry"></i> +1 Üret</button>
                    <button onclick="quickSellProduct('${p.id}'); closeProductModal()" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 rounded-xl transition"><i class="fa-solid fa-bolt"></i> Hızlı Sat</button>
                    ${p.modelLink ? `<a href="${p.modelLink}" target="_blank" class="bg-slate-800 hover:bg-slate-700 text-center text-sky-300 font-bold text-xs py-2.5 rounded-xl"><i class="fa-solid fa-link"></i> Model Linki</a>` : ''}
                    <button onclick="deleteCatalogProduct('${p.id}'); closeProductModal()" class="bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white font-bold text-xs py-2.5 rounded-xl transition"><i class="fa-solid fa-trash"></i> Ürünü Sil</button>
                </div>
            </div>`;
    } else {
        controlsHtml = `
            <div class="grid grid-cols-2 gap-2 mt-4">
                <button onclick="produceProductUnit('${p.id}'); closeProductModal()" class="bg-indigo-600 text-white font-bold text-xs py-3 rounded-xl"><i class="fa-solid fa-industry"></i> +1 Üret</button>
                <button onclick="quickSellProduct('${p.id}'); closeProductModal()" class="bg-emerald-600 text-white font-bold text-xs py-3 rounded-xl"><i class="fa-solid fa-bolt"></i> Hızlı Sat</button>
            </div>`;
    }

    content.innerHTML = `
        ${galleryHtml}
        <div class="p-5">
            <div class="flex justify-between items-start mb-2">
                <div>
                    <h2 class="text-xl font-extrabold text-white">${p.name}</h2>
                    <span class="text-[11px] text-slate-400">${p.category || ''} • Stok: <strong class="${Number(p.stockCount) > 0 ? 'text-emerald-400' : 'text-rose-400'}">${p.stockCount || 0}</strong></span>
                </div>
                <span class="text-2xl font-extrabold text-emerald-400">₺${Number(p.sellPrice || 0).toFixed(0)}</span>
            </div>
            ${p.description ? `<p class="text-xs text-slate-300 mt-2">${p.description}</p>` : ''}
            ${controlsHtml}
        </div>`;

    modal.classList.remove('hidden');
}

function closeProductModal() {
    document.getElementById('productModal')?.classList.add('hidden');
}

// ÜRETİM VE SATIŞ
async function produceProductUnit(prodId) {
    const p = catalog.find(x => x.id === prodId);
    if (!p) return;

    for (const req of (p.reqMaterials || [])) {
        const mat = materials.find(m => m.id === req.id);
        if (!mat || mat.stock < req.weight) return showToast(`${mat ? mat.name : 'Filament'} stoğu yetersiz!`, "error");
    }
    for (const req of (p.reqConsumables || [])) {
        const c = consumables.find(x => x.id === req.id);
        if (!c || c.stock < req.qty) return showToast(`${c ? c.name : 'Sarf malzemesi'} stoğu yetersiz!`, "error");
    }

    try {
        for (const req of (p.reqMaterials || [])) {
            const mat = materials.find(m => m.id === req.id);
            if (mat) await db.collection('guven3d_filamentler').doc(mat.id).update({ stock: mat.stock - req.weight });
        }
        for (const req of (p.reqConsumables || [])) {
            const c = consumables.find(x => x.id === req.id);
            if (c) await db.collection('guven3d_sarf').doc(c.id).update({ stock: c.stock - req.qty });
        }
        await db.collection('guven3d_urunler').doc(p.id).update({ stockCount: (p.stockCount || 0) + 1 });
        showToast("Üretildi ve stoklardan düşüldü!");
    } catch (e) {
        showToast("Üretim hatası!", "error");
    }
}

async function quickSellProduct(prodId) {
    const p = catalog.find(x => x.id === prodId);
    if (!p) return;
    try {
        if (p.stockCount > 0) {
            await db.collection('guven3d_urunler').doc(p.id).update({ stockCount: p.stockCount - 1 });
        }
        const now = new Date();
        await db.collection('guven3d_siparisler').add({
            date: now.toISOString(),
            dateDisplay: `${now.getDate()} ${now.toLocaleString('tr-TR', { month: 'short' })}`,
            productName: p.name,
            image: (p.images && p.images.length > 0) ? p.images[0] : (p.image || ""),
            customerId: "",
            platform: "Elden / Hızlı",
            cost: Number(p.costProfile || 0),
            sellPrice: Number(p.sellPrice || 0),
            status: "Ödendi"
        });
        showToast("Satıldı ve siparişlere eklendi!");
    } catch (e) {
        showToast("Satış hatası!", "error");
    }
}

// SİPARİŞ, FİLAMENT, SARF VE MÜŞTERİ LİSTELERİ
function populateOrderFormSelects() {
    const pSel = document.getElementById('newOrderProductSelect');
    if (pSel) pSel.innerHTML = catalog.map(p => `<option value="${p.id}">${p.name} (₺${p.sellPrice})</option>`).join('');
    const cSel = document.getElementById('newOrderCustomerSelect');
    if (cSel) cSel.innerHTML = `<option value="">Elden / Kayıtsız</option>` + customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

function renderOrders() {
    const c = document.getElementById('ordersListContainer');
    if (document.getElementById('badgeOrderCount')) document.getElementById('badgeOrderCount').textContent = orders.length;
    if (!c) return;
    if (orders.length === 0) {
        c.innerHTML = `<div class="text-center py-8 text-xs text-slate-400">Sipariş bulunamadı.</div>`;
        return;
    }
    c.innerHTML = orders.map(o => {
        const profit = Number(o.sellPrice || 0) - Number(o.cost || 0);
        return `
        <div class="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex justify-between items-center">
            <div class="flex items-center gap-3">
                ${o.image ? `<img src="${o.image}" class="w-10 h-10 rounded-lg object-cover hidden sm:block">` : ''}
                <div>
                    <div class="font-extrabold text-white text-sm">${o.productName} <span class="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 rounded">${o.platform}</span></div>
                    <div class="text-[11px] text-slate-400">${o.dateDisplay || ''}</div>
                </div>
            </div>
            <div class="flex items-center gap-3">
                <div class="text-right">
                    <div class="text-emerald-400 font-extrabold text-sm">₺${Number(o.sellPrice || 0).toFixed(0)}</div>
                    ${isAdmin ? `<div class="text-[10px] text-sky-400">Kâr: +₺${profit.toFixed(2)}</div>` : ''}
                </div>
                ${isAdmin ? `<button onclick="deleteOrder('${o.id}')" class="text-rose-500 hover:bg-rose-500/20 p-2 rounded-lg transition"><i class="fa-solid fa-trash"></i></button>` : ''}
            </div>
        </div>`;
    }).join('');
}

function renderMaterials() {
    const c = document.getElementById('materialsGridContainer');
    if (!c) return;

    const brandSet = new Set();
    const colorSet = new Set();
    materials.forEach(m => { if (m.brand) brandSet.add(m.brand); if (m.color) colorSet.add(m.color); });

    const bSelect = document.getElementById('filterMatBrand');
    const cSelect = document.getElementById('filterMatColor');
    if (bSelect && cSelect) {
        const currB = bSelect.value;
        const currC = cSelect.value;
        bSelect.innerHTML = `<option value="Tümü">Tüm Markalar</option>` + Array.from(brandSet).map(b => `<option value="${b}">${b}</option>`).join('');
        cSelect.innerHTML = `<option value="Tümü">Tüm Renkler</option>` + Array.from(colorSet).map(col => `<option value="${col}">${col}</option>`).join('');
        if (Array.from(brandSet).includes(currB)) bSelect.value = currB;
        if (Array.from(colorSet).includes(currC)) cSelect.value = currC;
    }

    const bFilter = bSelect?.value || "Tümü";
    const cFilter = cSelect?.value || "Tümü";
    const filtered = materials.filter(m => (bFilter === "Tümü" || m.brand === bFilter) && (cFilter === "Tümü" || m.color === cFilter));

    if (filtered.length === 0) {
        c.innerHTML = `<div class="col-span-full text-center py-8 text-xs text-slate-400">Filament bulunamadı.</div>`;
        return;
    }

    c.innerHTML = filtered.map(m => `
        <div class="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
            <div class="flex justify-between items-start mb-2">
                <div>
                    <h4 class="text-sm font-bold text-white">${m.name}</h4>
                    <p class="text-[10px] text-slate-400">Kg: ₺${m.price}</p>
                </div>
                <span class="text-xs font-extrabold text-amber-400 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">${m.stock}g</span>
            </div>
            <div class="mt-2 pt-2 border-t border-slate-800 flex justify-between items-center">
                <button onclick="manualStock('guven3d_filamentler','${m.id}','${m.name}','g')" class="text-[10px] bg-indigo-600/20 text-indigo-300 px-3 py-1.5 rounded hover:bg-indigo-600/40"><i class="fa-solid fa-pen"></i> Stok Gir</button>
                <div class="flex items-center gap-2">
                    <span class="text-[10px] text-slate-400 bg-slate-950 px-2 py-1 rounded">${m.type || 'PLA'}</span>
                    ${isAdmin ? `<button onclick="deleteMaterial('${m.id}')" class="text-rose-500 text-xs"><i class="fa-solid fa-trash"></i></button>` : ''}
                </div>
            </div>
        </div>`).join('');
}

function renderConsumables() {
    const c = document.getElementById('consumablesGridContainer');
    if (!c) return;
    if (consumables.length === 0) {
        c.innerHTML = `<div class="col-span-full text-center py-8 text-xs text-slate-400">Kayıtlı sarf malzemesi bulunamadı.</div>`;
        return;
    }
    c.innerHTML = consumables.map(m => `
        <div class="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
            <div class="flex justify-between items-start mb-2">
                <div>
                    <h4 class="text-sm font-bold text-white">${m.name}</h4>
                    <p class="text-[10px] text-slate-400">Birim Maliyet: ₺${Number(m.unitPrice || 0).toFixed(2)}</p>
                </div>
                <span class="text-xs font-extrabold text-sky-400 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">${m.stock} ${m.unit}</span>
            </div>
            <div class="mt-2 pt-2 border-t border-slate-800 flex justify-between items-center">
                <button onclick="manualStock('guven3d_sarf','${m.id}','${m.name}','${m.unit}')" class="text-[10px] bg-sky-600/20 text-sky-300 px-3 py-1.5 rounded hover:bg-sky-600/40"><i class="fa-solid fa-pen"></i> Stok Gir</button>
                ${isAdmin ? `<button onclick="deleteConsumable('${m.id}')" class="text-rose-500 text-xs"><i class="fa-solid fa-trash"></i></button>` : ''}
            </div>
        </div>`).join('');
}

function renderCustomers() {
    const c = document.getElementById('customersGridContainer');
    if (!c) return;
    c.innerHTML = customers.map(u => `
        <div class="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex justify-between items-center group">
            <div>
                <span class="font-bold text-white text-sm">${u.name}</span>
                ${u.nick ? `<span class="text-[11px] text-sky-400 bg-sky-500/10 px-1.5 rounded">@${u.nick}</span>` : ''}
                <div class="text-[11px] text-slate-400 mt-1">${u.phone || ''} • ${u.platform || ''}</div>
            </div>
            ${isAdmin ? `<button onclick="deleteCustomer('${u.id}')" class="text-rose-500 hidden group-hover:block"><i class="fa-solid fa-trash"></i></button>` : ''}
        </div>`).join('');
}

async function deleteCatalogProduct(id) { if (confirm("Ürünü silmek istiyor musunuz?")) { await db.collection('guven3d_urunler').doc(id).delete(); showToast("Ürün silindi!", "warning"); } }
async function deleteOrder(id) { if (confirm("Siparişi silmek istiyor musunuz?")) { await db.collection('guven3d_siparisler').doc(id).delete(); showToast("Sipariş silindi!", "warning"); } }
async function deleteMaterial(id) { if (confirm("Filamenti silmek istiyor musunuz?")) { await db.collection('guven3d_filamentler').doc(id).delete(); showToast("Filament silindi!", "warning"); } }
async function deleteConsumable(id) { if (confirm("Malzemeyi silmek istiyor musunuz?")) { await db.collection('guven3d_sarf').doc(id).delete(); showToast("Malzeme silindi!", "warning"); } }
async function deleteCustomer(id) { if (confirm("Müşteriyi silmek istiyor musunuz?")) { await db.collection('guven3d_musteriler').doc(id).delete(); showToast("Müşteri silindi!", "warning"); } }

async function manualStock(col, id, name, unit) {
    const amt = prompt(`${name} için eklenecek miktarı (${unit}) girin:\n(Azaltmak için başına eksi koyun: -10)`);
    if (amt === null || amt.trim() === '') return;
    const delta = parseFloat(amt);
    if (isNaN(delta)) return showToast("Geçersiz miktar!", "error");

    const item = col === 'guven3d_filamentler' ? materials.find(x => x.id === id) : consumables.find(x => x.id === id);
    if (item) {
        await db.collection(col).doc(id).update({ stock: Math.max(0, Number(item.stock || 0) + delta) });
        showToast("Stok güncellendi!");
    }
}

function updateDashboardStats() {
    if (document.getElementById('statTotalProducts')) document.getElementById('statTotalProducts').textContent = catalog.length;
    if (document.getElementById('statTotalStockUnits')) document.getElementById('statTotalStockUnits').textContent = catalog.reduce((a, p) => a + (Number(p.stockCount) || 0), 0);

    const rev = orders.reduce((a, o) => a + (Number(o.sellPrice) || 0), 0);
    const cost = orders.reduce((a, o) => a + (Number(o.cost) || 0), 0);

    if (document.getElementById('statTotalRevenue')) document.getElementById('statTotalRevenue').textContent = `₺${rev.toFixed(0)}`;
    if (document.getElementById('statTotalProfit')) document.getElementById('statTotalProfit').textContent = `₺${(rev - cost).toFixed(0)}`;
    if (document.getElementById('statOrderCountSub')) document.getElementById('statOrderCountSub').textContent = `${orders.length} sipariş`;
    if (document.getElementById('statTotalFilamentGrams')) document.getElementById('statTotalFilamentGrams').textContent = `${materials.reduce((a, m) => a + (Number(m.stock) || 0), 0)}g`;
}

// TÜM BUTON VE SEKME BAĞLANTILARI
document.addEventListener("DOMContentLoaded", () => {
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("sw.js").catch(e => console.log("SW:", e));
    }

    const savedUser = sessionStorage.getItem("azenia_logged_user");
    if (savedUser) {
        document.getElementById("adminLoginScreen").style.display = "none";
        yetkileriUygula(savedUser);
    }

    document.getElementById("loginPass")?.addEventListener("keypress", (e) => { if (e.key === "Enter") firebaseLogin(); });
    document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => navSwitch(btn.getAttribute('data-tab'))));

    // Filamentler / Sarf Malzemeler Alt Sekme Geçişi
    document.querySelectorAll('.inv-sub-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.inv-sub-btn').forEach(b => {
                b.classList.remove('active', 'text-indigo-400', 'border-indigo-500');
                b.classList.add('text-slate-500', 'border-transparent');
            });
            btn.classList.add('active', 'text-indigo-400', 'border-indigo-500');
            btn.classList.remove('text-slate-500', 'border-transparent');

            document.querySelectorAll('.inv-content').forEach(c => c.classList.add('hidden'));
            document.getElementById(btn.getAttribute('data-sub'))?.classList.remove('hidden');
        });
    });

    document.getElementById('prodImageInput')?.addEventListener('change', handleImageUpload);
    document.getElementById('saveCatalogProductBtn')?.addEventListener('click', saveCatalogProduct);

    document.getElementById('addReqMaterialRowBtn')?.addEventListener('click', () => {
        if (materials.length > 0) { tempReqMaterials.push({ id: materials[0].id, weight: 20 }); renderReqMaterialRows(); }
    });
    document.getElementById('addReqConsumableRowBtn')?.addEventListener('click', () => {
        if (consumables.length > 0) { tempReqConsumables.push({ id: consumables[0].id, qty: 1 }); renderReqConsumablesRows(); }
        else { showToast("Önce Stok & Envanter sekmesinden Sarf Malzemesi ekleyin!", "warning"); }
    });

    document.getElementById('prodPrintTime')?.addEventListener('input', calculateCurrentRecipeCost);
    document.getElementById('prodPrintTimeMin')?.addEventListener('input', calculateCurrentRecipeCost);

    document.getElementById('calcPrice2xBtn')?.addEventListener('click', () => { document.getElementById('prodFinalPrice').value = Math.ceil(calculateCurrentRecipeCost() * 2); });
    document.getElementById('calcPrice3xBtn')?.addEventListener('click', () => { document.getElementById('prodFinalPrice').value = Math.ceil(calculateCurrentRecipeCost() * 3); });
    document.getElementById('calcPrice4xBtn')?.addEventListener('click', () => { document.getElementById('prodFinalPrice').value = Math.ceil(calculateCurrentRecipeCost() * 4); });

    document.getElementById('createOrderBtn')?.addEventListener('click', async () => {
        const p = catalog.find(x => x.id === document.getElementById('newOrderProductSelect').value);
        if (!p) return;
        const inputPrice = parseFloat(document.getElementById('newOrderPriceInput').value);
        await db.collection('guven3d_siparisler').add({
            date: new Date().toISOString(),
            dateDisplay: `${new Date().getDate()} ${new Date().toLocaleString('tr-TR', { month: 'short' })}`,
            productName: p.name,
            image: (p.images && p.images.length > 0) ? p.images[0] : (p.image || ""),
            customerId: document.getElementById('newOrderCustomerSelect').value,
            platform: document.getElementById('newOrderPlatformSelect').value,
            cost: Number(p.costProfile || 0),
            sellPrice: !isNaN(inputPrice) ? inputPrice : Number(p.sellPrice || 0)
        });
        showToast("Sipariş eklendi!");
        document.getElementById('newOrderPriceInput').value = '';
    });

    document.getElementById('addMaterialBtn')?.addEventListener('click', async () => {
        const b = document.getElementById('newMatBrand').value.trim();
        const t = document.getElementById('newMatType').value.trim();
        const c = document.getElementById('newMatColor').value.trim();
        if (!b || !c) return showToast("Marka ve Renk zorunludur!", "error");

        const name = `${b} ${t} ${c}`;
        if (materials.some(m => m.name.toLowerCase() === name.toLowerCase())) {
            return showToast("Bu filament zaten var! Stok Gir butonunu kullanın.", "error");
        }

        await db.collection('guven3d_filamentler').add({
            brand: b, type: t, color: c, name: name,
            stock: parseFloat(document.getElementById('newMatStock').value) || 1000,
            price: parseFloat(document.getElementById('newMatPrice').value) || 650
        });
        showToast("Filament eklendi!");
        document.getElementById('newMatBrand').value = '';
        document.getElementById('newMatColor').value = '';
    });

    document.getElementById('addConsumableBtn')?.addEventListener('click', async () => {
        const n = document.getElementById('newConsName').value.trim();
        const u = document.getElementById('newConsUnit').value;
        const s = parseFloat(document.getElementById('newConsStock').value) || 0;
        const p = parseFloat(document.getElementById('newConsPrice').value) || 0;
        if (!n || s <= 0) return showToast("Malzeme adı ve geçerli miktar girin!", "error");

        if (consumables.some(c => c.name.toLowerCase() === n.toLowerCase())) {
            return showToast("Bu malzeme zaten var! Stok Gir butonunu kullanın.", "error");
        }

        await db.collection('guven3d_sarf').add({ name: n, unit: u, stock: s, unitPrice: (p / s) });
        showToast("Sarf Malzemesi eklendi!");
        document.getElementById('newConsName').value = '';
        document.getElementById('newConsStock').value = '';
        document.getElementById('newConsPrice').value = '';
    });

    document.getElementById('addCustomerBtn')?.addEventListener('click', async () => {
        const name = document.getElementById('newCustName').value.trim();
        if (!name) return;
        await db.collection('guven3d_musteriler').add({
            name: name,
            nick: document.getElementById('newCustNick').value.trim(),
            phone: document.getElementById('newCustPhone').value.trim(),
            platform: document.getElementById('newCustPlatform').value
        });
        showToast("Müşteri eklendi!");
        document.getElementById('newCustName').value = '';
        document.getElementById('newCustNick').value = '';
        document.getElementById('newCustPhone').value = '';
    });

    document.getElementById('saveSettingsBtn')?.addEventListener('click', () => {
        settings.hourlyRate = parseFloat(document.getElementById('settingHourlyRate').value) || 5;
        calculateCurrentRecipeCost();
        showToast("Ayarlar kaydedildi!");
    });

    document.getElementById('vitrinSearchInput')?.addEventListener('input', renderVitrin);
    document.getElementById('vitrinCategoryFilter')?.addEventListener('change', renderVitrin);
    document.getElementById('filterMatBrand')?.addEventListener('change', renderMaterials);
    document.getElementById('filterMatColor')?.addEventListener('change', renderMaterials);

    document.getElementById('importJsonInput')?.addEventListener('change', (e) => {
        const f = e.target.files[0];
        if (!f) return;
        showToast("JSON okunuyor...", "info");
        const r = new FileReader();
        r.onload = async (ev) => {
            try {
                const p = JSON.parse(ev.target.result);
                if (p.orders) p.orders.forEach(i => { const { id, ...rest } = i; db.collection('guven3d_siparisler').add(rest); });
                if (p.materials) p.materials.forEach(i => { const { id, ...rest } = i; db.collection('guven3d_filamentler').add(rest); });
                if (p.customers) p.customers.forEach(i => { const { id, ...rest } = i; db.collection('guven3d_musteriler').add(rest); });
                showToast("Veriler başarıyla yüklendi!");
            } catch (err) {
                showToast("Hata! Geçersiz JSON.", "error");
            }
        };
        r.readAsText(f);
    });

    initApp();
});
// === 2. PARÇA SONU (DOSYA TAMAMLANDI) ===


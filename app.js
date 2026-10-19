const firebaseConfig = {
    apiKey: "AIzaSyCqNlKNZAqp2R7EFYin95UY67xp3WikVvA",
    authDomain: "azenia-stok-d5896.firebaseapp.com",
    projectId: "azenia-stok-d5896",
    storageBucket: "azenia-stok-d5896.firebasestorage.app",
    messagingSenderId: "200511374655",
    appId: "1:200511374655:web:947f20ca18e9aef4003f8a"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const secondaryApp = firebase.apps.find(a => a.name === "SecondaryApp") || firebase.initializeApp(firebaseConfig, "SecondaryApp");

const IMGBB_API_KEY = "794223bd269bc70ed757a5af6b695c94";
let currentUploadedImages = [];
let catalog = [], orders = [], materials = [], consumables = [], customers = [];
let settings = { hourlyRate: 5 };
let tempReqMaterials = [], tempReqConsumables = [];
let isAdmin = false;
let currentOrderSubTab = "active"; // 'active' veya 'completed'

function firebaseLogin() {
    const u = document.getElementById("loginUser").value.trim().toLowerCase();
    const p = document.getElementById("loginPass").value;
    const err = document.getElementById("loginError");
    if (!u || !p) return;

    firebase.auth().signInWithEmailAndPassword(u + "@azeniastore.com", p)
        .then(() => {
            sessionStorage.setItem("azenia_logged_user", u);
            document.getElementById("adminLoginScreen").style.display = "none";
            yetkileriUygula(u);
        })
        .catch(() => {
            err.classList.remove("hidden");
            err.style.display = "block";
            setTimeout(() => { err.style.display = "none"; }, 3000);
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

function showToast(msg, type = "info") {
    const c = document.getElementById("toastContainer");
    if (!c) return;
    const t = document.createElement("div");
    const col = type === "error" ? "bg-rose-600 border-rose-400" : type === "warning" ? "bg-amber-500 border-amber-300 text-slate-950" : "bg-indigo-600 border-indigo-400";
    t.className = `pointer-events-auto px-4 py-3 rounded-xl border shadow-xl text-white text-xs font-bold flex items-center gap-2 ${col}`;
    t.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}"></i><span>${msg}</span>`;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3200);
}

async function createStaffUser() {
    const u = document.getElementById('newStaffUser').value.trim().toLowerCase();
    const p = document.getElementById('newStaffPass').value;
    if (!u || p.length < 6) return showToast("Kullanıcı adı ve en az 6 haneli şifre girin!", "error");
    try {
        await secondaryApp.auth().createUserWithEmailAndPassword(u + "@azeniastore.com", p);
        await secondaryApp.auth().signOut();
        showToast(`Kullanıcı (${u}) oluşturuldu!`);
        document.getElementById('newStaffUser').value = '';
        document.getElementById('newStaffPass').value = '';
    } catch (e) {
        showToast("Oluşturulamadı! İsim kullanımda veya şifre geçersiz.", "error");
    }
}

// ÇOKLU FOTOĞRAF YÜKLEME VE TAM EKRAN BÜYÜTME
async function handleImageUpload(event) {
    const files = event.target.files;
    if (!files || !files.length) return;
    const container = document.getElementById('imgPreviewContainer');
    showToast("Görseller yükleniyor...", "info");

    for (let i = 0; i < files.length; i++) {
        const fd = new FormData();
        fd.append("image", files[i]);
        const tempDiv = document.createElement('div');
        tempDiv.className = "w-16 h-16 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center relative";
        tempDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-indigo-400"></i>';
        container.appendChild(tempDiv);

        try {
            const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: fd });
            const data = await res.json();
            if (data && data.success) {
                const url = data.data.url;
                currentUploadedImages.push(url);
                tempDiv.innerHTML = `<img src="${url}" class="w-full h-full object-cover rounded-xl"><button type="button" onclick="removeUploadedImage('${url}', this)" class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-600 text-white rounded-full text-[10px] flex items-center justify-center"><i class="fa-solid fa-xmark"></i></button>`;
            } else tempDiv.remove();
        } catch (e) { tempDiv.remove(); }
    }
    showToast("Görseller yüklendi!");
}

function removeUploadedImage(url, btn) {
    currentUploadedImages = currentUploadedImages.filter(i => i !== url);
    btn.parentElement.remove();
}

function openLightbox(src) {
    if (!src) return;
    document.getElementById('lightboxImg').src = src;
    document.getElementById('lightboxModal').classList.remove('hidden');
}

function closeLightbox() {
    document.getElementById('lightboxModal').classList.add('hidden');
}

// VERİTABANI BAĞLANTISI
function initApp() {
    db.collection('guven3d_urunler').onSnapshot(snap => {
        catalog = [];
        snap.forEach(d => catalog.push({ id: d.id, ...d.data() }));
        renderVitrin();
        updateDashboardStats();
    });

    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            db.collection('guven3d_siparisler').orderBy('date', 'desc').onSnapshot(snap => {
                orders = [];
                snap.forEach(d => orders.push({ id: d.id, ...d.data() }));
                renderOrders();
                renderCustomers();
                updateDashboardStats();
            });
            db.collection('guven3d_filamentler').onSnapshot(snap => {
                materials = [];
                snap.forEach(d => materials.push({ id: d.id, ...d.data() }));
                if (!tempReqMaterials.length && materials.length) tempReqMaterials = [{ id: materials[0].id, weight: 20 }];
                renderMaterials();
                renderReqMaterialRows();
                updateDashboardStats();
            });
            db.collection('guven3d_sarf').onSnapshot(snap => {
                consumables = [];
                snap.forEach(d => consumables.push({ id: d.id, ...d.data() }));
                renderConsumables();
                renderReqConsumablesRows();
            });
            db.collection('guven3d_musteriler').onSnapshot(snap => {
                customers = [];
                snap.forEach(d => customers.push({ id: d.id, ...d.data() }));
                renderCustomers();
                populateOrderFormSelects();
            });
        }
    });

    const txt = document.getElementById("cloudStatusText");
    if (txt) txt.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span><span class="text-emerald-400">Sistem %100 Buluta Bağlı</span>';
}

function navSwitch(tabId) {
    document.querySelectorAll('.tab-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(tabId)?.classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(b => {
        if (b.getAttribute('data-tab') === tabId) { b.classList.add('active'); b.classList.remove('text-slate-300'); }
        else { b.classList.remove('active'); b.classList.add('text-slate-300'); }
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// REÇETE & MALİYET
function renderReqMaterialRows() {
    const c = document.getElementById('reqMaterialsList');
    if (!c) return;
    c.innerHTML = tempReqMaterials.map((r, i) => `
        <div class="flex items-center gap-2">
            <select class="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white" onchange="tempReqMaterials[${i}].id=this.value; calculateCurrentRecipeCost()">
                ${materials.map(m => `<option value="${m.id}" ${m.id === r.id ? 'selected' : ''}>${m.name} (${m.stock}g)</option>`).join('')}
            </select>
            <input type="number" class="w-20 bg-slate-950 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white" value="${r.weight}" oninput="tempReqMaterials[${i}].weight=parseFloat(this.value)||0; calculateCurrentRecipeCost()">
            <button type="button" onclick="tempReqMaterials.splice(${i},1); renderReqMaterialRows()" class="bg-rose-600/20 text-rose-300 px-2.5 py-2 rounded-xl text-xs"><i class="fa-solid fa-trash"></i></button>
        </div>`).join('');
    calculateCurrentRecipeCost();
}

function renderReqConsumablesRows() {
    const c = document.getElementById('reqConsumablesList');
    if (!c) return;
    c.innerHTML = tempReqConsumables.map((r, i) => `
        <div class="flex items-center gap-2">
            <select class="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white" onchange="tempReqConsumables[${i}].id=this.value; calculateCurrentRecipeCost()">
                ${consumables.map(m => `<option value="${m.id}" ${m.id === r.id ? 'selected' : ''}>${m.name} (₺${Number(m.unitPrice||0).toFixed(2)})</option>`).join('')}
            </select>
            <input type="number" class="w-20 bg-slate-950 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white" value="${r.qty}" oninput="tempReqConsumables[${i}].qty=parseFloat(this.value)||0; calculateCurrentRecipeCost()">
            <button type="button" onclick="tempReqConsumables.splice(${i},1); renderReqConsumablesRows()" class="bg-rose-600/20 text-rose-300 px-2.5 py-2 rounded-xl text-xs"><i class="fa-solid fa-trash"></i></button>
        </div>`).join('');
    calculateCurrentRecipeCost();
}

function calculateCurrentRecipeCost() {
    let cost = 0;
    tempReqMaterials.forEach(i => { const m = materials.find(x => x.id === i.id); if (m) cost += (Number(i.weight)||0) * (Number(m.price)/1000); });
    tempReqConsumables.forEach(i => { const c = consumables.find(x => x.id === i.id); if (c) cost += (Number(i.qty)||0) * Number(c.unitPrice||0); });
    const h = parseFloat(document.getElementById('prodPrintTime')?.value || 0);
    const m = parseFloat(document.getElementById('prodPrintTimeMin')?.value || 0);
    const total = cost + ((h + (m / 60)) * settings.hourlyRate);
    if (document.getElementById('calculatedCostDisplay')) document.getElementById('calculatedCostDisplay').textContent = `₺${total.toFixed(2)}`;
    return Number(total.toFixed(4));
}

async function saveCatalogProduct() {
    const name = document.getElementById('prodName').value.trim();
    const price = parseFloat(document.getElementById('prodFinalPrice').value);
    if (!name || isNaN(price)) return showToast("Ürün Adı ve Fiyat zorunludur!", "error");

    const h = parseFloat(document.getElementById('prodPrintTime').value) || 0;
    const m = parseFloat(document.getElementById('prodPrintTimeMin').value) || 0;

    await db.collection('guven3d_urunler').add({
        name,
        description: document.getElementById('prodDesc').value.trim(),
        tags: document.getElementById('prodTags').value.trim(),
        category: document.getElementById('prodCategory').value,
        stockCount: parseInt(document.getElementById('prodStockCount').value, 10) || 0,
        sellPrice: price,
        time: h + (m / 60),
        images: currentUploadedImages.length ? [...currentUploadedImages] : [],
        image: currentUploadedImages[0] || "",
        reqMaterials: tempReqMaterials.filter(i => i.id && Number(i.weight) > 0),
        reqConsumables: tempReqConsumables.filter(i => i.id && Number(i.qty) > 0),
        costProfile: calculateCurrentRecipeCost(),
        modelLink: document.getElementById('prodModelLink')?.value.trim() || "",
        dateAdded: new Date().toISOString()
    });

    showToast("Ürün kaydedildi!");
    currentUploadedImages = [];
    document.getElementById('imgPreviewContainer').innerHTML = '';
    document.getElementById('prodName').value = '';
    document.getElementById('prodDesc').value = '';
    document.getElementById('prodFinalPrice').value = '';
    navSwitch('tabVitrin');
}

// VİTRİN VE DETAY MODALI (ZOOM + VİTRİNDEN SİPARİŞ + ADMİN SATIŞ KARNESİ)
function renderVitrin() {
    const grid = document.getElementById('vitrinGrid');
    if (!grid) return;
    if (document.getElementById('badgeCatalogCount')) document.getElementById('badgeCatalogCount').textContent = catalog.length;

    const s = (document.getElementById('vitrinSearchInput')?.value || '').toLowerCase().trim();
    const cat = document.getElementById('vitrinCategoryFilter')?.value || 'Tümü';
    const filtered = catalog.filter(i => (cat === 'Tümü' || i.category === cat) && (!s || i.name.toLowerCase().includes(s) || (i.tags && i.tags.toLowerCase().includes(s))));

    populateOrderFormSelects();
    if (!filtered.length) { grid.innerHTML = `<div class="col-span-full text-center py-10 text-slate-400">Ürün bulunamadı.</div>`; return; }

    grid.innerHTML = filtered.map(p => {
        const cover = (p.images && p.images.length) ? p.images[0] : (p.image || null);
        const imgHtml = cover ? `<img src="${cover}" class="w-full h-full object-cover">` : `<div class="w-full h-full flex items-center justify-center text-slate-600"><i class="fa-solid fa-cube text-3xl"></i></div>`;
        return `
            <div onclick="openProductModal('${p.id}')" class="glass-card rounded-2xl overflow-hidden border border-slate-800 flex flex-col cursor-pointer hover:border-indigo-500/60 transition transform hover:-translate-y-1">
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

    const images = (p.images && p.images.length) ? p.images : (p.image ? [p.image] : []);
    let galleryHtml = `<div class="h-64 bg-slate-950 flex items-center justify-center text-slate-600"><i class="fa-solid fa-image text-5xl"></i></div>`;

    if (images.length) {
        const thumbs = images.length > 1 ? `<div class="flex gap-2 p-2.5 bg-slate-950 overflow-x-auto border-t border-slate-800">${images.map(img => `<img src="${img}" onclick="document.getElementById('modalMainImg').src='${img}'" class="w-16 h-16 object-cover rounded-lg cursor-pointer border-2 border-slate-700 hover:border-indigo-500 transition flex-shrink-0">`).join('')}</div>` : '';
        galleryHtml = `
            <div class="h-72 sm:h-80 bg-slate-950 relative group cursor-zoom-in" onclick="openLightbox(document.getElementById('modalMainImg').src)">
                <img id="modalMainImg" src="${images[0]}" class="w-full h-full object-contain">
                <div class="absolute bottom-3 left-3 bg-slate-900/80 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 pointer-events-none"><i class="fa-solid fa-magnifying-glass-plus text-indigo-400"></i> Tam Ekran Büyüt</div>
            </div>${thumbs}`;
    }

    // Vitrinden Direkt Sipariş Oluşturma Kutusu
    const custOptions = `<option value="">Elden / Müşteri Seçin</option>` + customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    const orderBoxHtml = `
        <div class="mt-4 p-3.5 bg-slate-950/90 border border-emerald-500/30 rounded-xl space-y-2.5">
            <div class="text-xs font-bold text-emerald-400 flex items-center gap-1.5"><i class="fa-solid fa-cart-plus"></i> Vitrinden Hızlı Sipariş Oluştur</div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select id="modalOrderCustomer" class="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white">${custOptions}</select>
                <select id="modalOrderPlatform" class="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"><option>Elden</option><option>Dolap</option><option>N11</option><option>Shopier</option><option>Instagram</option></select>
                <input type="number" id="modalOrderPrice" value="${p.sellPrice}" class="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white font-bold">
            </div>
            <button onclick="orderFromModal('${p.id}')" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs py-2.5 rounded-xl transition"><i class="fa-solid fa-check"></i> Siparişi Ver (Siparişler Ekranına Gönder)</button>
        </div>`;

    // Admin Özel Kontroller & Açılır/Kapanır Ürün Satış Karnesi
    let adminHtml = '';
    if (isAdmin) {
        const profit = Number(p.sellPrice || 0) - Number(p.costProfile || 0);
        const reqMats = (p.reqMaterials || []).map(rm => { const m = materials.find(x => x.id === rm.id); return `<span class="bg-slate-900 px-2 py-1 rounded text-[11px] text-slate-300 border border-slate-700">${m ? m.name : 'Filament'}: <strong class="text-amber-400">${rm.weight}g</strong></span>`; }).join('');
        const reqCons = (p.reqConsumables || []).map(rc => { const c = consumables.find(x => x.id === rc.id); return `<span class="bg-sky-950 px-2 py-1 rounded text-[11px] text-sky-300 border border-sky-800">${c ? c.name : 'Malzeme'}: <strong class="text-white">${rc.qty}x</strong></span>`; }).join('');

        // Bu ürüne ait geçmiş satışları filtrele
        const prodOrders = orders.filter(o => o.productId === p.id || o.productName === p.name);
        const totalSold = prodOrders.length;
        const totalRev = prodOrders.reduce((a, b) => a + Number(b.sellPrice || 0), 0);
        const lastSale = prodOrders.length > 0 ? prodOrders[0] : null;
        const lastCust = lastSale ? (customers.find(c => c.id === lastSale.customerId)?.name || lastSale.customerName || "Elden / Kayıtsız") : "-";

        const salesRows = prodOrders.length > 0 ? prodOrders.map(o => {
            const cName = customers.find(c => c.id === o.customerId)?.name || o.customerName || "Elden / Kayıtsız";
            return `<div class="flex justify-between items-center py-1.5 border-b border-slate-800/80 text-[11px]">
                <div><span class="font-bold text-white">${cName}</span> <span class="text-slate-400">(${o.platform})</span></div>
                <div class="flex items-center gap-3"><span class="text-slate-400">${o.dateDisplay || ''}</span><span class="font-bold text-emerald-400">₺${o.sellPrice}</span></div>
            </div>`;
        }).join('') : `<div class="text-xs text-slate-500 py-2">Bu ürün henüz satılmadı.</div>`;

        adminHtml = `
            <div class="mt-4 p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                <div class="flex justify-between items-center border-b border-slate-800 pb-2 text-xs">
                    <span class="text-slate-400">Birim Maliyet: <strong class="text-amber-400">₺${Number(p.costProfile || 0).toFixed(2)}</strong></span>
                    <span class="font-extrabold text-sky-400">Net Kâr: +₺${profit.toFixed(2)}</span>
                </div>
                <div class="flex flex-wrap gap-1.5">${reqMats} ${reqCons}</div>
                <div class="grid grid-cols-2 gap-2 pt-1">
                    <button onclick="produceProductUnit('${p.id}'); closeProductModal()" class="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 rounded-xl"><i class="fa-solid fa-industry"></i> +1 Üret (Stoktan Düş)</button>
                    <button onclick="deleteCatalogProduct('${p.id}'); closeProductModal()" class="bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white font-bold text-xs py-2.5 rounded-xl transition"><i class="fa-solid fa-trash"></i> Ürünü Sil</button>
                    ${p.modelLink ? `<a href="${p.modelLink}" target="_blank" class="col-span-2 bg-slate-800 text-center text-sky-300 font-bold text-xs py-2 rounded-xl"><i class="fa-solid fa-link"></i> Model Kaynak Linkini Aç</a>` : ''}
                </div>

                <!-- Açılır/Kapanır Ürün Satış Geçmişi -->
                <div class="pt-2 border-t border-slate-800">
                    <button type="button" onclick="document.getElementById('adminProdSalesBox').classList.toggle('hidden')" class="w-full flex items-center justify-between bg-slate-900 hover:bg-slate-800 px-3 py-2.5 rounded-xl text-xs font-bold text-indigo-300 transition">
                        <span><i class="fa-solid fa-chart-pie mr-1.5"></i> Ürün Satış Karnesi (${totalSold} Adet Satıldı)</span>
                        <i class="fa-solid fa-chevron-down text-[10px]"></i>
                    </button>
                    <div id="adminProdSalesBox" class="hidden mt-2 p-3 bg-slate-900/70 rounded-xl border border-slate-800 space-y-2">
                        <div class="grid grid-cols-3 gap-2 text-center bg-slate-950 p-2 rounded-lg text-[11px]">
                            <div><div class="text-slate-400">Toplam Satış</div><div class="font-extrabold text-white">${totalSold} Adet</div></div>
                            <div><div class="text-slate-400">Toplam Ciro</div><div class="font-extrabold text-emerald-400">₺${totalRev.toFixed(0)}</div></div>
                            <div><div class="text-slate-400">Son Alan</div><div class="font-extrabold text-sky-400 truncate">${lastCust}</div></div>
                        </div>
                        <div class="max-h-40 overflow-y-auto pr-1">${salesRows}</div>
                    </div>
                </div>
            </div>`;
    } else {
        adminHtml = `<div class="mt-3"><button onclick="produceProductUnit('${p.id}'); closeProductModal()" class="w-full bg-indigo-600 text-white font-bold text-xs py-3 rounded-xl"><i class="fa-solid fa-industry"></i> +1 Üret (Stoktan Düş)</button></div>`;
    }

    content.innerHTML = `
        ${galleryHtml}
        <div class="p-5">
            <div class="flex justify-between items-start">
                <div>
                    <h2 class="text-xl font-extrabold text-white">${p.name}</h2>
                    <span class="text-xs text-slate-400">${p.category || ''} • Hazır Stok: <strong class="${Number(p.stockCount) > 0 ? 'text-emerald-400' : 'text-rose-400'}">${p.stockCount || 0}</strong></span>
                </div>
                <span class="text-2xl font-extrabold text-emerald-400">₺${Number(p.sellPrice || 0).toFixed(0)}</span>
            </div>
            ${p.description ? `<p class="text-xs text-slate-300 mt-2">${p.description}</p>` : ''}
            ${orderBoxHtml}
            ${adminHtml}
        </div>`;

    modal.classList.remove('hidden');
}

function closeProductModal() {
    document.getElementById('productModal')?.classList.add('hidden');
}

// VİTRİNDEN SİPARİŞ VERME
async function orderFromModal(prodId) {
    const p = catalog.find(x => x.id === prodId);
    if (!p) return;
    const custId = document.getElementById('modalOrderCustomer')?.value || "";
    const custObj = customers.find(c => c.id === custId);
    const platform = document.getElementById('modalOrderPlatform')?.value || "Elden";
    const price = parseFloat(document.getElementById('modalOrderPrice')?.value) || Number(p.sellPrice || 0);
    const now = new Date();

    await db.collection('guven3d_siparisler').add({
        date: now.toISOString(),
        dateDisplay: `${now.getDate()} ${now.toLocaleString('tr-TR', { month: 'short' })} ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`,
        productId: p.id,
        productName: p.name,
        image: (p.images && p.images.length) ? p.images[0] : (p.image || ""),
        customerId: custId,
        customerName: custObj ? custObj.name : "Elden / Kayıtsız",
        platform: platform,
        cost: Number(p.costProfile || 0),
        sellPrice: price,
        status: "Beklemede"
    });

    closeProductModal();
    switchOrderSubTab('active');
    navSwitch('tabSiparisler');
    showToast("Sipariş oluşturuldu ve Beklemede listesine eklendi!");
}

// ÜRETİM
async function produceProductUnit(prodId) {
    const p = catalog.find(x => x.id === prodId);
    if (!p) return;
    for (const r of (p.reqMaterials || [])) { const m = materials.find(x => x.id === r.id); if (!m || m.stock < r.weight) return showToast(`${m ? m.name : 'Filament'} stoğu yetersiz!`, "error"); }
    for (const r of (p.reqConsumables || [])) { const c = consumables.find(x => x.id === r.id); if (!c || c.stock < r.qty) return showToast(`${c ? c.name : 'Malzeme'} stoğu yetersiz!`, "error"); }

    for (const r of (p.reqMaterials || [])) { const m = materials.find(x => x.id === r.id); if (m) await db.collection('guven3d_filamentler').doc(m.id).update({ stock: m.stock - r.weight }); }
    for (const r of (p.reqConsumables || [])) { const c = consumables.find(x => x.id === r.id); if (c) await db.collection('guven3d_sarf').doc(c.id).update({ stock: c.stock - r.qty }); }
    await db.collection('guven3d_urunler').doc(p.id).update({ stockCount: (p.stockCount || 0) + 1 });
    showToast("Üretildi ve stoklardan düşüldü!");
}

// SİPARİŞ SÜREÇ YÖNETİMİ (BEKLEMEDE -> HAZIRLANIYOR -> KARGODA -> TAMAMLANDI ARŞİVİ)
function switchOrderSubTab(sub) {
    currentOrderSubTab = sub;
    const btnAct = document.getElementById('btnShowActiveOrders');
    const btnComp = document.getElementById('btnShowCompletedOrders');
    if (sub === 'active') {
        btnAct.className = "px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white transition";
        btnComp.className = "px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition";
    } else {
        btnComp.className = "px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white transition";
        btnAct.className = "px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition";
    }
    renderOrders();
}

async function updateOrderStatus(orderId, newStatus) {
    const ord = orders.find(o => o.id === orderId);
    if (!ord) return;

    // Sipariş Tamamlandı seçilirse ve ürün stokta varsa 1 adet ürün stoğundan düş
    if (newStatus === "Tamamlandı" && ord.status !== "Tamamlandı" && ord.productId) {
        const prod = catalog.find(p => p.id === ord.productId);
        if (prod && Number(prod.stockCount) > 0) {
            await db.collection('guven3d_urunler').doc(prod.id).update({ stockCount: prod.stockCount - 1 });
        }
    }

    await db.collection('guven3d_siparisler').doc(orderId).update({ status: newStatus });
    showToast(`Sipariş durumu "${newStatus}" olarak güncellendi!`);
}

function renderOrders() {
    const c = document.getElementById('ordersListContainer');
    const activeList = orders.filter(o => !o.status || (o.status !== "Tamamlandı" && o.status !== "Ödendi"));
    const completedList = orders.filter(o => o.status === "Tamamlandı" || o.status === "Ödendi");

    if (document.getElementById('badgeOrderCount')) document.getElementById('badgeOrderCount').textContent = activeList.length;
    if (document.getElementById('countActiveOrders')) document.getElementById('countActiveOrders').textContent = activeList.length;
    if (document.getElementById('countCompletedOrders')) document.getElementById('countCompletedOrders').textContent = completedList.length;

    if (!c) return;
    const listToShow = currentOrderSubTab === 'active' ? activeList : completedList;

    if (!listToShow.length) {
        c.innerHTML = `<div class="text-center py-8 text-xs text-slate-400">${currentOrderSubTab === 'active' ? 'Bekleyen aktif sipariş yok.' : 'Tamamlanmış sipariş bulunmuyor.'}</div>`;
        return;
    }

    c.innerHTML = listToShow.map(o => {
        const custName = customers.find(cu => cu.id === o.customerId)?.name || o.customerName || "Elden / Kayıtsız";
        const st = o.status === "Ödendi" ? "Tamamlandı" : (o.status || "Beklemede");
        const badgeCol = st === "Beklemede" ? "bg-amber-500/20 text-amber-300 border-amber-500/40" : st === "Hazırlanıyor" ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40" : st === "Kargoda" ? "bg-sky-500/20 text-sky-300 border-sky-500/40" : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";

        return `
        <div class="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div class="flex items-center gap-3">
                ${o.image ? `<img src="${o.image}" onclick="openLightbox('${o.image}')" class="w-12 h-12 rounded-lg object-cover cursor-zoom-in">` : ''}
                <div>
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-extrabold text-white text-sm">${o.productName}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full border font-bold ${badgeCol}">${st}</span>
                        <span class="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">${o.platform}</span>
                    </div>
                    <div class="text-xs text-slate-400 mt-1"><i class="fa-regular fa-user text-[10px]"></i> ${custName} • ${o.dateDisplay || ''}</div>
                </div>
            </div>
            <div class="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                <select onchange="updateOrderStatus('${o.id}', this.value)" class="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold">
                    <option value="Beklemede" ${st === 'Beklemede' ? 'selected' : ''}>⏳ Beklemede</option>
                    <option value="Hazırlanıyor" ${st === 'Hazırlanıyor' ? 'selected' : ''}>⚙️ Hazırlanıyor</option>
                    <option value="Kargoda" ${st === 'Kargoda' ? 'selected' : ''}>📦 Kargoda</option>
                    <option value="Tamamlandı" ${st === 'Tamamlandı' ? 'selected' : ''}>✅ Tamamlandı</option>
                </select>
                <div class="text-right min-w-[60px]">
                    <div class="text-emerald-400 font-extrabold text-sm">₺${Number(o.sellPrice || 0).toFixed(0)}</div>
                </div>
                ${isAdmin ? `<button onclick="deleteOrder('${o.id}')" class="text-rose-500 hover:bg-rose-500/20 p-2 rounded-lg"><i class="fa-solid fa-trash"></i></button>` : ''}
            </div>
        </div>`;
    }).join('');
}

function populateOrderFormSelects() {
    const pSel = document.getElementById('newOrderProductSelect');
    if (pSel) pSel.innerHTML = catalog.map(p => `<option value="${p.id}">${p.name} (₺${p.sellPrice})</option>`).join('');
    const cSel = document.getElementById('newOrderCustomerSelect');
    if (cSel) cSel.innerHTML = `<option value="">Elden / Kayıtsız</option>` + customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

// MÜŞTERİLER VE MÜŞTERİ DETAY GEÇMİŞİ MODALI
function renderCustomers() {
    const c = document.getElementById('customersGridContainer');
    if (!c) return;
    if (!customers.length) { c.innerHTML = `<div class="col-span-full text-center py-8 text-xs text-slate-400">Kayıtlı müşteri yok.</div>`; return; }

    c.innerHTML = customers.map(u => {
        const custOrders = orders.filter(o => o.customerId === u.id || (o.customerName && o.customerName.toLowerCase() === u.name.toLowerCase()));
        const totalSpent = custOrders.reduce((a, b) => a + Number(b.sellPrice || 0), 0);
        return `
        <div onclick="openCustomerModal('${u.id}')" class="bg-slate-900/90 border border-slate-800 hover:border-sky-500/50 rounded-xl p-3.5 flex justify-between items-center cursor-pointer transition group">
            <div>
                <div class="flex items-center gap-2">
                    <span class="font-bold text-white text-sm">${u.name}</span>
                    ${u.nick ? `<span class="text-[11px] text-sky-400 bg-sky-500/10 px-1.5 rounded">@${u.nick}</span>` : ''}
                </div>
                <div class="text-[11px] text-slate-400 mt-1">${u.phone || 'Tel yok'} • ${u.platform || ''}</div>
                <div class="text-[11px] font-bold text-emerald-400 mt-1">${custOrders.length} Sipariş • Toplam: ₺${totalSpent.toFixed(0)}</div>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-xs text-slate-500 group-hover:text-sky-400"><i class="fa-solid fa-chevron-right"></i></span>
                ${isAdmin ? `<button onclick="event.stopPropagation(); deleteCustomer('${u.id}')" class="text-rose-500 hover:bg-rose-500/20 p-2 rounded-lg"><i class="fa-solid fa-trash"></i></button>` : ''}
            </div>
        </div>`;
    }).join('');
}

function openCustomerModal(custId) {
    const u = customers.find(x => x.id === custId);
    if (!u) return;
    const custOrders = orders.filter(o => o.customerId === u.id || (o.customerName && o.customerName.toLowerCase() === u.name.toLowerCase()));
    const totalSpent = custOrders.reduce((a, b) => a + Number(b.sellPrice || 0), 0);

    const rows = custOrders.length ? custOrders.map(o => `
        <div class="bg-slate-950 border border-slate-800 rounded-xl p-3 flex justify-between items-center">
            <div class="flex items-center gap-3">
                ${o.image ? `<img src="${o.image}" class="w-10 h-10 rounded-lg object-cover">` : ''}
                <div>
                    <div class="text-xs font-extrabold text-white">${o.productName}</div>
                    <div class="text-[11px] text-slate-400">${o.dateDisplay || ''} • ${o.platform} • <span class="text-indigo-300">${o.status || 'Tamamlandı'}</span></div>
                </div>
            </div>
            <div class="text-sm font-extrabold text-emerald-400">₺${Number(o.sellPrice || 0).toFixed(0)}</div>
        </div>`).join('') : `<div class="text-center py-6 text-xs text-slate-500">Bu müşteriye ait sipariş kaydı bulunamadı.</div>`;

    document.getElementById('customerModalContent').innerHTML = `
        <div class="border-b border-slate-800 pb-3 mb-4">
            <h3 class="text-lg font-extrabold text-white">${u.name} ${u.nick ? `<span class="text-xs text-sky-400">@${u.nick}</span>` : ''}</h3>
            <p class="text-xs text-slate-400 mt-0.5">${u.phone || ''} • Platform: ${u.platform || '-'}</p>
        </div>
        <div class="grid grid-cols-2 gap-3 mb-4 bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
            <div><div class="text-[11px] text-slate-400">Aldığı Ürün Sayısı</div><div class="text-lg font-extrabold text-white">${custOrders.length} Adet</div></div>
            <div><div class="text-[11px] text-slate-400">Toplam Ödediği Tutar</div><div class="text-lg font-extrabold text-emerald-400">₺${totalSpent.toFixed(0)}</div></div>
        </div>
        <h4 class="text-xs font-bold text-slate-300 mb-2">Satın Alma Geçmişi</h4>
        <div class="space-y-2 max-h-80 overflow-y-auto pr-1">${rows}</div>
    `;
    document.getElementById('customerModal').classList.remove('hidden');
}

function closeCustomerModal() {
    document.getElementById('customerModal')?.classList.add('hidden');
}

// STOK, FİLAMENT VE SARF MALZEMELER
function renderMaterials() {
    const c = document.getElementById('materialsGridContainer');
    if (!c) return;
    const bSet = new Set(), cSet = new Set();
    materials.forEach(m => { if (m.brand) bSet.add(m.brand); if (m.color) cSet.add(m.color); });

    const bSel = document.getElementById('filterMatBrand'), cSel = document.getElementById('filterMatColor');
    if (bSel && cSel) {
        const cb = bSel.value, cc = cSel.value;
        bSel.innerHTML = `<option value="Tümü">Tüm Markalar</option>` + Array.from(bSet).map(b => `<option value="${b}">${b}</option>`).join('');
        cSel.innerHTML = `<option value="Tümü">Tüm Renkler</option>` + Array.from(cSet).map(col => `<option value="${col}">${col}</option>`).join('');
        if (bSet.has(cb)) bSel.value = cb;
        if (cSet.has(cc)) cSel.value = cc;
    }

    const bf = bSel?.value || "Tümü", cf = cSel?.value || "Tümü";
    const filtered = materials.filter(m => (bf === "Tümü" || m.brand === bf) && (cf === "Tümü" || m.color === cf));

    c.innerHTML = filtered.map(m => `
        <div class="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
            <div class="flex justify-between items-start mb-2">
                <div><h4 class="text-sm font-bold text-white">${m.name}</h4><p class="text-[10px] text-slate-400">Kg: ₺${m.price}</p></div>
                <span class="text-xs font-extrabold text-amber-400 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">${m.stock}g</span>
            </div>
            <div class="mt-2 pt-2 border-t border-slate-800 flex justify-between items-center">
                <button onclick="manualStock('guven3d_filamentler','${m.id}','${m.name}','g')" class="text-[10px] bg-indigo-600/20 text-indigo-300 px-3 py-1.5 rounded"><i class="fa-solid fa-pen"></i> Stok Gir</button>
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
    c.innerHTML = consumables.map(m => `
        <div class="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
            <div class="flex justify-between items-start mb-2">
                <div><h4 class="text-sm font-bold text-white">${m.name}</h4><p class="text-[10px] text-slate-400">Birim: ₺${Number(m.unitPrice||0).toFixed(2)}</p></div>
                <span class="text-xs font-extrabold text-sky-400 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">${m.stock} ${m.unit}</span>
            </div>
            <div class="mt-2 pt-2 border-t border-slate-800 flex justify-between items-center">
                <button onclick="manualStock('guven3d_sarf','${m.id}','${m.name}','${m.unit}')" class="text-[10px] bg-sky-600/20 text-sky-300 px-3 py-1.5 rounded"><i class="fa-solid fa-pen"></i> Stok Gir</button>
                ${isAdmin ? `<button onclick="deleteConsumable('${m.id}')" class="text-rose-500 text-xs"><i class="fa-solid fa-trash"></i></button>` : ''}
            </div>
        </div>`).join('');
}

async function deleteCatalogProduct(id) { if (confirm("Ürünü silmek istiyor musunuz?")) await db.collection('guven3d_urunler').doc(id).delete(); }
async function deleteOrder(id) { if (confirm("Siparişi silmek istiyor musunuz?")) await db.collection('guven3d_siparisler').doc(id).delete(); }
async function deleteMaterial(id) { if (confirm("Filamenti silmek istiyor musunuz?")) await db.collection('guven3d_filamentler').doc(id).delete(); }
async function deleteConsumable(id) { if (confirm("Malzemeyi silmek istiyor musunuz?")) await db.collection('guven3d_sarf').doc(id).delete(); }
async function deleteCustomer(id) { if (confirm("Müşteriyi silmek istiyor musunuz?")) await db.collection('guven3d_musteriler').doc(id).delete(); }

async function manualStock(col, id, name, unit) {
    const amt = prompt(`${name} için eklenecek miktarı (${unit}) girin:\n(Azaltmak için başına eksi koyun: -10)`);
    if (!amt) return;
    const d = parseFloat(amt);
    if (isNaN(d)) return;
    const item = col === 'guven3d_filamentler' ? materials.find(x => x.id === id) : consumables.find(x => x.id === id);
    if (item) await db.collection(col).doc(id).update({ stock: Math.max(0, Number(item.stock || 0) + d) });
}

function updateDashboardStats() {
    if (!isAdmin) return;
    if (document.getElementById('statTotalProducts')) document.getElementById('statTotalProducts').textContent = catalog.length;
    if (document.getElementById('statTotalStockUnits')) document.getElementById('statTotalStockUnits').textContent = catalog.reduce((a, p) => a + (Number(p.stockCount) || 0), 0);
    const rev = orders.reduce((a, o) => a + (Number(o.sellPrice) || 0), 0);
    const cost = orders.reduce((a, o) => a + (Number(o.cost) || 0), 0);
    if (document.getElementById('statTotalRevenue')) document.getElementById('statTotalRevenue').textContent = `₺${rev.toFixed(0)}`;
    if (document.getElementById('statTotalProfit')) document.getElementById('statTotalProfit').textContent = `₺${(rev - cost).toFixed(0)}`;
    if (document.getElementById('statOrderCountSub')) document.getElementById('statOrderCountSub').textContent = `${orders.length} sipariş`;
    if (document.getElementById('statTotalFilamentGrams')) document.getElementById('statTotalFilamentGrams').textContent = `${materials.reduce((a, m) => a + (Number(m.stock) || 0), 0)}g`;
}

document.addEventListener("DOMContentLoaded", () => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
    const savedUser = sessionStorage.getItem("azenia_logged_user");
    if (savedUser) { document.getElementById("adminLoginScreen").style.display = "none"; yetkileriUygula(savedUser); }

    document.getElementById("loginPass")?.addEventListener("keypress", e => { if (e.key === "Enter") firebaseLogin(); });
    document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => navSwitch(btn.getAttribute('data-tab'))));

    document.querySelectorAll('.inv-sub-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.inv-sub-btn').forEach(b => { b.classList.remove('active', 'text-indigo-400', 'border-indigo-500'); b.classList.add('text-slate-500', 'border-transparent'); });
            btn.classList.add('active', 'text-indigo-400', 'border-indigo-500');
            document.querySelectorAll('.inv-content').forEach(c => c.classList.add('hidden'));
            document.getElementById(btn.getAttribute('data-sub'))?.classList.remove('hidden');
        });
    });

    document.getElementById('prodImageInput')?.addEventListener('change', handleImageUpload);
    document.getElementById('saveCatalogProductBtn')?.addEventListener('click', saveCatalogProduct);
    document.getElementById('addReqMaterialRowBtn')?.addEventListener('click', () => { if (materials.length) { tempReqMaterials.push({ id: materials[0].id, weight: 20 }); renderReqMaterialRows(); } });
    document.getElementById('addReqConsumableRowBtn')?.addEventListener('click', () => { if (consumables.length) { tempReqConsumables.push({ id: consumables[0].id, qty: 1 }); renderReqConsumablesRows(); } });

    document.getElementById('prodPrintTime')?.addEventListener('input', calculateCurrentRecipeCost);
    document.getElementById('prodPrintTimeMin')?.addEventListener('input', calculateCurrentRecipeCost);
    document.getElementById('calcPrice2xBtn')?.addEventListener('click', () => { document.getElementById('prodFinalPrice').value = Math.ceil(calculateCurrentRecipeCost() * 2); });
    document.getElementById('calcPrice3xBtn')?.addEventListener('click', () => { document.getElementById('prodFinalPrice').value = Math.ceil(calculateCurrentRecipeCost() * 3); });
    document.getElementById('calcPrice4xBtn')?.addEventListener('click', () => { document.getElementById('prodFinalPrice').value = Math.ceil(calculateCurrentRecipeCost() * 4); });

    document.getElementById('createOrderBtn')?.addEventListener('click', async () => {
        const p = catalog.find(x => x.id === document.getElementById('newOrderProductSelect').value);
        if (!p) return;
        const custId = document.getElementById('newOrderCustomerSelect').value;
        const custObj = customers.find(c => c.id === custId);
        const inpPrice = parseFloat(document.getElementById('newOrderPriceInput').value);
        const now = new Date();
        await db.collection('guven3d_siparisler').add({
            date: now.toISOString(),
            dateDisplay: `${now.getDate()} ${now.toLocaleString('tr-TR', { month: 'short' })} ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`,
            productId: p.id,
            productName: p.name,
            image: (p.images && p.images.length) ? p.images[0] : (p.image || ""),
            customerId: custId,
            customerName: custObj ? custObj.name : "Elden / Kayıtsız",
            platform: document.getElementById('newOrderPlatformSelect').value,
            cost: Number(p.costProfile || 0),
            sellPrice: !isNaN(inpPrice) ? inpPrice : Number(p.sellPrice || 0),
            status: "Beklemede"
        });
        showToast("Sipariş Beklemede listesine eklendi!");
        document.getElementById('newOrderPriceInput').value = '';
    });

    document.getElementById('addMaterialBtn')?.addEventListener('click', async () => {
        const b = document.getElementById('newMatBrand').value.trim(), t = document.getElementById('newMatType').value, c = document.getElementById('newMatColor').value.trim();
        if (!b || !c) return showToast("Marka ve Renk girin!", "error");
        const name = `${b} ${t} ${c}`;
        await db.collection('guven3d_filamentler').add({ brand: b, type: t, color: c, name, stock: parseFloat(document.getElementById('newMatStock').value) || 1000, price: parseFloat(document.getElementById('newMatPrice').value) || 650 });
        showToast("Filament eklendi!");
    });

    document.getElementById('addConsumableBtn')?.addEventListener('click', async () => {
        const n = document.getElementById('newConsName').value.trim(), u = document.getElementById('newConsUnit').value, s = parseFloat(document.getElementById('newConsStock').value) || 0, p = parseFloat(document.getElementById('newConsPrice').value) || 0;
        if (!n || s <= 0) return showToast("Ad ve miktar girin!", "error");
        await db.collection('guven3d_sarf').add({ name: n, unit: u, stock: s, unitPrice: (p / s) });
        showToast("Sarf malzemesi eklendi!");
    });

    document.getElementById('addCustomerBtn')?.addEventListener('click', async () => {
        const name = document.getElementById('newCustName').value.trim();
        if (!name) return;
        await db.collection('guven3d_musteriler').add({ name, nick: document.getElementById('newCustNick').value.trim(), phone: document.getElementById('newCustPhone').value.trim(), platform: document.getElementById('newCustPlatform').value });
        showToast("Müşteri eklendi!");
        document.getElementById('newCustName').value = ''; document.getElementById('newCustNick').value = ''; document.getElementById('newCustPhone').value = '';
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

    initApp();
});
// === DOSYA TAMAMLANDI ===

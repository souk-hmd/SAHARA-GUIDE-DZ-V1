(() => {
"use strict";

const $ = id => document.getElementById(id);
const toast = msg => {
  $("toast").textContent = msg;
  $("toast").classList.add("show");
  clearTimeout(window.__t);
  window.__t = setTimeout(() => $("toast").classList.remove("show"), 2400);
};

const map = L.map("map",{zoomControl:false,preferCanvas:true}).setView([31.68,6.07],8);
const layers = {
  standard:L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap contributors"}),
  satellite:L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxZoom:19,attribution:"© Esri"}),
  terrain:L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",{maxZoom:17,attribution:"© OpenTopoMap"})
};
let activeLayer=layers.standard; activeLayer.addTo(map);

document.querySelectorAll(".map-tools button[data-layer]").forEach(btn => btn.onclick=()=>{
  const layer=layers[btn.dataset.layer];
  if(layer===activeLayer)return;
  map.removeLayer(activeLayer); layer.addTo(map); activeLayer=layer;
  document.querySelectorAll(".map-tools button").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
});

const places=[
 {name:"حاسي مسعود",type:"مدينة",lat:31.6800,lon:6.0700,icon:"🏙️"},
 {name:"ورقلة",type:"مدينة",lat:31.9500,lon:5.3300,icon:"🏙️"},
 {name:"تقرت",type:"مدينة",lat:33.1000,lon:6.0600,icon:"🏙️"},
 {name:"إليزي",type:"مدينة",lat:26.5000,lon:8.4700,icon:"🏜️"},
 {name:"عين أميناس",type:"مدينة",lat:28.0500,lon:9.5500,icon:"🏜️"},
 {name:"تمنراست",type:"مدينة",lat:22.7900,lon:5.5200,icon:"🏔️"},
 {name:"أدرار",type:"مدينة",lat:27.8700,lon:-0.2800,icon:"🏜️"},
 {name:"بشار",type:"مدينة",lat:31.6200,lon:-2.2200,icon:"🏜️"},
 {name:"جانيت",type:"مدينة",lat:24.5550,lon:9.4840,icon:"🏜️"},
 {name:"غرداية",type:"واحة / مدينة",lat:32.4900,lon:3.6700,icon:"🌴"},
 {name:"تيميمون",type:"واحة",lat:29.2600,lon:0.2300,icon:"🌴"},
 {name:"تاغيت",type:"واحة / كثبان",lat:30.9200,lon:-2.0300,icon:"🏜️"}
];

const markers=[];
places.forEach(p=>{
  const m=L.marker([p.lat,p.lon]).addTo(map).bindPopup(`<b>${p.icon} ${p.name}</b><br><small>${p.type}</small>`);
  m.on("click",()=>setDestination(p));
  markers.push({p,m});
});

let current=null,userMarker=null,accuracyCircle=null,watchId=null;
let destination=null,tracking=false,track=[],trackLine=null;

function startGPS(){
  if(!navigator.geolocation){toast("GPS غير مدعوم في هذا الجهاز");return}
  if(watchId!==null)return;
  $("gpsStatus").textContent="● GPS...";
  watchId=navigator.geolocation.watchPosition(pos=>{
    const c=pos.coords;
    current={lat:c.latitude,lon:c.longitude,accuracy:c.accuracy||0,altitude:c.altitude,speed:c.speed||0,heading:c.heading};
    $("gpsStatus").textContent="● GPS ACTIVE"; $("gpsStatus").classList.add("on");
    $("coords").textContent=`${current.lat.toFixed(6)}, ${current.lon.toFixed(6)}`;
    $("accuracy").textContent=`±${Math.round(current.accuracy)}م`;
    $("speed").textContent=(current.speed*3.6).toFixed(1);
    $("altitude").textContent=Number.isFinite(current.altitude)?Math.round(current.altitude):"—";
    const ll=[current.lat,current.lon];
    if(!userMarker){
      userMarker=L.circleMarker(ll,{radius:8,color:"#fff",weight:3,fillColor:"#1976d2",fillOpacity:1}).addTo(map);
      accuracyCircle=L.circle(ll,{radius:current.accuracy,color:"#1976d2",weight:1,fillOpacity:.08}).addTo(map);
    }else{userMarker.setLatLng(ll);accuracyCircle.setLatLng(ll);accuracyCircle.setRadius(current.accuracy)}
    if(tracking)addTrackPoint(current);
    updateDestination();
  },err=>{
    $("gpsStatus").textContent="● GPS ERROR"; $("gpsStatus").classList.remove("on");
    toast("تعذر تحديد الموقع. فعّل GPS والسماح بالموقع.");
  },{enableHighAccuracy:true,maximumAge:1500,timeout:15000});
}
$("locateBtn").onclick=()=>{startGPS();if(current)map.setView([current.lat,current.lon],16)};
startGPS();

function distance(a,b){
 const R=6371,rad=Math.PI/180,dLat=(b.lat-a.lat)*rad,dLon=(b.lon-a.lon)*rad;
 const x=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLon/2)**2;
 return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}
function bearing(a,b){
 const p1=a.lat*Math.PI/180,p2=b.lat*Math.PI/180,dl=(b.lon-a.lon)*Math.PI/180;
 const y=Math.sin(dl)*Math.cos(p2),x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);
 return (Math.atan2(y,x)*180/Math.PI+360)%360;
}
function setDestination(p){
 destination=p;$("destination").classList.remove("hidden");$("destName").textContent=p.name;map.setView([p.lat,p.lon],13);updateDestination();
}
function updateDestination(){
 if(!destination||!current)return;
 $("destDistance").textContent=distance(current,destination).toFixed(1)+" كم";
 $("destBearing").textContent=Math.round(bearing(current,destination))+"°";
}
$("clearDest").onclick=()=>{destination=null;$("destination").classList.add("hidden")};

function addTrackPoint(p){
 const q={lat:p.lat,lon:p.lon},last=track[track.length-1];
 if(last && distance(last,q)<.005)return;
 track.push(q);
 if(!trackLine)trackLine=L.polyline(track.map(x=>[x.lat,x.lon]),{color:"#d49a3c",weight:5}).addTo(map);
 else trackLine.setLatLngs(track.map(x=>[x.lat,x.lon]));
 let d=0;for(let i=1;i<track.length;i++)d+=distance(track[i-1],track[i]);
 $("distance").textContent=d.toFixed(2);
}
$("trackBtn").onclick=()=>{
 tracking=!tracking;
 if(tracking){startGPS();$("trackBtn").textContent="⏹️ إيقاف الرحلة";$("trackBtn").classList.remove("primary");toast("بدأ تسجيل الرحلة");}
 else{$("trackBtn").textContent="▶️ ابدأ الرحلة";$("trackBtn").classList.add("primary");toast("تم إيقاف الرحلة");}
};

async function search(){
 const q=$("searchInput").value.trim(); if(!q)return;
 const local=markers.find(x=>x.p.name.includes(q));
 if(local){map.setView([local.p.lat,local.p.lon],13);local.m.openPopup();setDestination(local.p);return}
 try{
  const r=await fetch("https://nominatim.openstreetmap.org/search?format=json&accept-language=ar&q="+encodeURIComponent(q));
  const data=await r.json(); if(!data.length){toast("لم يتم العثور على المكان");return}
  const x=data[0],p={name:x.display_name,lat:Number(x.lat),lon:Number(x.lon)};
  map.setView([p.lat,p.lon],13);L.marker([p.lat,p.lon]).addTo(map).bindPopup(`<b>${p.name}</b>`).openPopup();setDestination(p);
 }catch(e){toast("البحث يحتاج إلى الإنترنت")}
}
$("searchBtn").onclick=search;$("searchInput").onkeydown=e=>{if(e.key==="Enter")search()};

function openSheet(title,html){
 $("sheetTitle").textContent=title;$("sheetBody").innerHTML=html;$("sheet").classList.add("show");
}
function closeSheet(){$("sheet").classList.remove("show")}
$("closeSheet").onclick=closeSheet;$("sheet").onclick=e=>{if(e.target.id==="sheet")closeSheet()};

const openMap={
 places:()=>openSheet("🏜️ الأماكن",places.map(p=>`<div class="item" data-lat="${p.lat}" data-lon="${p.lon}"><div class="ico">${p.icon}</div><div class="info"><b>${p.name}</b><small>${p.type}</small></div><span class="tag">عرض</span></div>`).join("")),
 water:()=>openSheet("💧 المياه والآبار",`
 <div class="item"><div class="ico">💧</div><div class="info"><b>قاعدة المياه</b><small>سيتم ربط الآبار الموثقة بقاعدة بيانات المنصة.</small></div><span class="tag">V1</span></div>
 <div class="item"><div class="ico">🟢</div><div class="info"><b>نظام الثقة</b><small>آخر تحديث + صورة + تأكيد المستخدمين قبل اعتبار المصدر موثوقًا.</small></div></div>`),
 trips:()=>openSheet("🚙 الرحلات",`<div class="item"><div class="ico">🧭</div><div class="info"><b>تسجيل الرحلة</b><small>GPS + المسافة + السرعة + المسار. دعم GPX سيكون في المرحلة التالية.</small></div></div>`),
 community:()=>openSheet("👥 المجتمع",`<div class="item"><div class="ico">📍</div><div class="info"><b>ساهم بمعلومة</b><small>أضف بئرًا أو طريقًا أو مكانًا أو تحذيرًا. النشر النهائي بعد التحقق.</small></div></div>`),
 points:()=>{
   const a=JSON.parse(localStorage.getItem("sahara_points")||"[]");
   openSheet("📌 نقاطي",a.length?a.map(p=>`<div class="item"><div class="ico">📌</div><div class="info"><b>${p.name}</b><small>${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}</small></div></div>`).join(""):`<p style="color:#83949b;font-size:10px">لا توجد نقاط محفوظة.</p>`);
 },
 support:()=>openSheet("💛 ادعم المشروع",`<div class="support"><div class="heart">💛</div><h3>ساعدنا على تطوير SAHARA GUIDE DZ</h3><p>مساهمتك تساعد في تطوير الخرائط، قاعدة المياه، GPS، السلامة والبيانات المحلية للصحراء الجزائرية.</p><button id="supportBtn">💛 أريد دعم المشروع</button><p>وسائل الدفع سيتم تفعيلها لاحقًا: BaridiMob / CCP / دفع إلكتروني.</p></div>`),
 settings:()=>openSheet("⚙️ الإعدادات",`<div class="setting"><span>📡 GPS عالي الدقة</span><button>ACTIVE</button></div><div class="setting"><span>💾 تخزين النقاط</span><button>LOCAL</button></div><button id="saveCurrent" style="width:100%;margin-top:12px;height:40px;border-radius:10px;border:1px solid #e2b34e;background:#d9aa4b;font-weight:900">📌 حفظ موقعي الحالي</button>`)
};

document.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>{const fn=openMap[b.dataset.open];if(fn)fn()});
document.querySelectorAll("[data-open]").forEach(b=>b.addEventListener("click",()=>setTimeout(bindSheetActions,0)));

function bindSheetActions(){
 document.querySelectorAll(".item[data-lat]").forEach(el=>el.onclick=()=>{map.setView([Number(el.dataset.lat),Number(el.dataset.lon)],14);closeSheet()});
 const s=$("supportBtn");if(s)s.onclick=()=>toast("سيتم تفعيل وسائل الدعم عند ربط الحسابات");
 const save=$("saveCurrent");if(save)save.onclick=savePoint;
}
$("saveCurrent")?.addEventListener("click",savePoint);

function savePoint(){
 if(!current){startGPS();toast("جاري تحديد موقعك...");return}
 const name=prompt("اسم النقطة:");if(!name)return;
 const a=JSON.parse(localStorage.getItem("sahara_points")||"[]");
 a.push({name,lat:current.lat,lon:current.lon,date:new Date().toISOString()});
 localStorage.setItem("sahara_points",JSON.stringify(a));
 L.marker([current.lat,current.lon]).addTo(map).bindPopup("📌 "+name);
 toast("تم حفظ النقطة");
 closeSheet();
}

$("sosBtn").onclick=async()=>{
 if(!current){startGPS();toast("جاري تحديد موقعك...");return}
 const text=`🆘 SAHARA GUIDE DZ - SOS\n📍 ${current.lat.toFixed(6)}, ${current.lon.toFixed(6)}\n📡 دقة GPS: ±${Math.round(current.accuracy)}م\n🕐 ${new Date().toLocaleString("ar-DZ")}`;
 try{
  if(navigator.share)await navigator.share({title:"SOS - SAHARA GUIDE DZ",text});
  else{await navigator.clipboard.writeText(text);toast("تم نسخ رسالة الطوارئ")}
 }catch(e){}
};

if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(()=>{}));
})();
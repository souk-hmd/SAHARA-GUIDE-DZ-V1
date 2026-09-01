const CACHE_NAME="sahara-guide-dz-v1.0.0";
const CORE=["./","./index.html","./style.css","./app.js","./manifest.json"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(u.origin===self.location.origin){
    e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{
      const copy=r.clone(); caches.open(CACHE_NAME).then(c=>c.put(e.request,copy)); return r;
    }).catch(()=>caches.match("./index.html"))));
  }
});
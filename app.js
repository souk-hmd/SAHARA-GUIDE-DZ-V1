const $ = (selector) =>
  document.querySelector(selector);


/* =========================
   STATE
========================= */

const state = {
  places: [],
  track: [],
  lastPosition: null,
  watchId: null,
  heading: 0
};


/* =========================
   ICONS
========================= */

const icons = {
  well: "💧",
  road: "🛣️",
  camp: "⛺",
  danger: "⚠️",
  other: "📍"
};


/* =========================
   STORAGE
========================= */

function saveData() {

  localStorage.setItem(
    "sahara_places",
    JSON.stringify(state.places)
  );

  localStorage.setItem(
    "sahara_track",
    JSON.stringify(state.track)
  );
}


function loadData() {

  try {

    state.places =
      JSON.parse(
        localStorage.getItem("sahara_places")
      ) || [];

  } catch {

    state.places = [];

  }


  try {

    state.track =
      JSON.parse(
        localStorage.getItem("sahara_track")
      ) || [];

  } catch {

    state.track = [];

  }

}


/* =========================
   DISTANCE
========================= */

function distanceKm(a, b) {

  const R = 6371;

  const rad = Math.PI / 180;

  const dLat =
    (b.lat - a.lat) * rad;

  const dLon =
    (b.lon - a.lon) * rad;

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) *
    Math.cos(b.lat * rad) *
    Math.sin(dLon / 2) ** 2;

  return (
    R *
    2 *
    Math.atan2(
      Math.sqrt(x),
      Math.sqrt(1 - x)
    )
  );
}


function totalTrackDistance() {

  let total = 0;

  for (
    let i = 1;
    i < state.track.length;
    i++
  ) {

    total += distanceKm(
      state.track[i - 1],
      state.track[i]
    );

  }

  return total;

}


/* =========================
   SECURITY
========================= */

function escapeHTML(value) {

  return String(value)
    .replace(
      /[&<>"']/g,
      char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[char]
    );

}


/* =========================
   RENDER PLACES
========================= */

function renderPlaces() {

  const container =
    $("#placesList");

  if (!state.places.length) {

    container.innerHTML =
      `<div class="hint">
        لا توجد نقاط محفوظة.
      </div>`;

  } else {

    container.innerHTML =
      state.places
        .map(place => {

          return `
            <div class="place">

              <div class="emoji">
                ${icons[place.type] || "📍"}
              </div>

              <div class="place-info">

                <strong>
                  ${escapeHTML(place.name)}
                </strong>

                <small>
                  ${escapeHTML(
                    place.note || "بدون ملاحظة"
                  )}
                </small>

                <small>
                  ${place.lat.toFixed(6)},
                  ${place.lon.toFixed(6)}
                </small>

              </div>

              <button
                onclick="openPoint('${place.id}')"
              >
                عرض
              </button>

            </div>
          `;

        })
        .join("");

  }

  $("#pointsValue").textContent =
    state.places.length;

}


/* =========================
   STATS
========================= */

function updateStats() {

  $("#distanceValue").textContent =
    totalTrackDistance().toFixed(2);

  $("#pointsValue").textContent =
    state.places.length;


  if (state.lastPosition) {

    $("#accuracyValue").textContent =
      Math.round(
        state.lastPosition.accuracy || 0
      ) + "م";

  }

}


/* =========================
   MAP
========================= */

function getBounds() {

  let all = [
    ...state.places,
    ...state.track
  ];

  if (state.lastPosition) {
    all.push(state.lastPosition);
  }


  if (!all.length) {

    return {
      minLat: 31.50,
      maxLat: 31.85,
      minLon: 5.85,
      maxLon: 6.35
    };

  }


  const lats =
    all.map(p => p.lat);

  const lons =
    all.map(p => p.lon);


  let minLat =
    Math.min(...lats);

  let maxLat =
    Math.max(...lats);

  let minLon =
    Math.min(...lons);

  let maxLon =
    Math.max(...lons);


  const padding =
    Math.max(
      maxLat - minLat,
      maxLon - minLon,
      .05
    ) * .25;


  return {
    minLat: minLat - padding,
    maxLat: maxLat + padding,
    minLon: minLon - padding,
    maxLon: maxLon + padding
  };

}


function project(
  lat,
  lon,
  width,
  height,
  bounds
) {

  const x =
    (
      (lon - bounds.minLon) /
      (bounds.maxLon - bounds.minLon)
    ) * width;


  const y =
    (
      (bounds.maxLat - lat) /
      (bounds.maxLat - bounds.minLat)
    ) * height;


  return [x, y];

}


function drawMap() {

  const map =
    $("#map");

  let canvas =
    map.querySelector("canvas");


  if (!canvas) {

    canvas =
      document.createElement("canvas");

    map.appendChild(canvas);

  }


  const rect =
    map.getBoundingClientRect();

  const ratio =
    window.devicePixelRatio || 1;


  canvas.width =
    rect.width * ratio;

  canvas.height =
    rect.height * ratio;


  const ctx =
    canvas.getContext("2d");


  ctx.setTransform(
    ratio,
    0,
    0,
    ratio,
    0,
    0
  );


  const width =
    rect.width;

  const height =
    rect.height;


  const bounds =
    getBounds();


  /* Desert */

  ctx.fillStyle =
    "#d7c59d";

  ctx.fillRect(
    0,
    0,
    width,
    height
  );


  /* Grid */

  ctx.strokeStyle =
    "rgba(80,65,40,.18)";

  ctx.lineWidth = 1;


  for (
    let x = 0;
    x < width;
    x += 45
  ) {

    ctx.beginPath();

    ctx.moveTo(x, 0);

    ctx.lineTo(x, height);

    ctx.stroke();

  }


  for (
    let y = 0;
    y < height;
    y += 45
  ) {

    ctx.beginPath();

    ctx.moveTo(0, y);

    ctx.lineTo(width, y);

    ctx.stroke();

  }


  /* Track */

  if (state.track.length > 1) {

    ctx.strokeStyle =
      "#9b5b25";

    ctx.lineWidth = 4;

    ctx.beginPath();


    state.track.forEach(
      (point, index) => {

        const [
          x,
          y
        ] =
          project(
            point.lat,
            point.lon,
            width,
            height,
            bounds
          );


        if (index === 0) {

          ctx.moveTo(x, y);

        } else {

          ctx.lineTo(x, y);

        }

      }
    );


    ctx.stroke();

  }


  /* Places */

  state.places.forEach(place => {

    const [
      x,
      y
    ] =
      project(
        place.lat,
        place.lon,
        width,
        height,
        bounds
      );


    if (place.type === "well") {

      ctx.fillStyle =
        "#168ba8";

    } else if (
      place.type === "danger"
    ) {

      ctx.fillStyle =
        "#b43b42";

    } else {

      ctx.fillStyle =
        "#63482d";

    }


    ctx.beginPath();

    ctx.arc(
      x,
      y,
      7,
      0,
      Math.PI * 2
    );

    ctx.fill();


    ctx.font =
      "12px system-ui";

    ctx.textAlign =
      "center";

    ctx.fillStyle =
      "#172027";

    ctx.fillText(
      icons[place.type] || "📍",
      x,
      y - 11
    );

  });


  /* Current location */

  if (state.lastPosition) {

    const [
      x,
      y
    ] =
      project(
        state.lastPosition.lat,
        state.lastPosition.lon,
        width,
        height,
        bounds
      );


    ctx.fillStyle =
      "#1768bd";

    ctx.beginPath();

    ctx.arc(
      x,
      y,
      8,
      0,
      Math.PI * 2
    );

    ctx.fill();


    ctx.strokeStyle =
      "#fff";

    ctx.lineWidth = 3;

    ctx.stroke();

  }

}


/* =========================
   GPS
========================= */

function locateUser() {

  if (!navigator.geolocation) {

    alert(
      "هذا الهاتف أو المتصفح لا يدعم GPS."
    );

    return;

  }


  $("#mapInfo").textContent =
    "جاري تحديد موقعك…";


  navigator.geolocation.getCurrentPosition(
    handlePosition,
    handleLocationError,
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 3000
    }
  );

}


function handlePosition(position) {

  const newPosition = {

    lat:
      position.coords.latitude,

    lon:
      position.coords.longitude,

    accuracy:
      position.coords.accuracy || 0,

    speed:
      position.coords.speed || 0,

    time:
      Date.now()

  };


  if (
    state.lastPosition &&
    $("#trackingToggle").checked
  ) {

    const movement =
      distanceKm(
        state.lastPosition,
        newPosition
      );


    if (movement > 0.005) {

      state.track.push(
        newPosition
      );

    }

  }


  state.lastPosition =
    newPosition;


  $("#accuracyValue").textContent =
    Math.round(
      newPosition.accuracy
    ) + "م";


  $("#speedValue").textContent =
    (
      (newPosition.speed || 0) * 3.6
    ).toFixed(1);


  $("#mapInfo").textContent =
    `${newPosition.lat.toFixed(6)}, ${newPosition.lon.toFixed(6)}`;


  saveData();

  renderPlaces();

  updateStats();

  drawMap();

}


function handleLocationError(error) {

  $("#mapInfo").textContent =
    "تعذر تحديد الموقع: " +
    error.message;

}


function startTracking() {

  if (
    state.watchId !== null ||
    !navigator.geolocation
  ) {
    return;
  }


  state.watchId =
    navigator.geolocation.watchPosition(
      handlePosition,
      () => {},
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 10000
      }
    );

}


/* =========================
   SAVE CURRENT LOCATION
========================= */

function prepareCurrentPoint() {

  if (!state.lastPosition) {

    locateUser();

    alert(
      "حدد موقعك أولاً، ثم اضغط حفظ موقعي."
    );

    return;

  }


  $("#latInput").value =
    state.lastPosition.lat.toFixed(6);

  $("#lonInput").value =
    state.lastPosition.lon.toFixed(6);

  $("#pointName").focus();

}


/* =========================
   OPEN POINT
========================= */

window.openPoint =
  function(id) {

    const place =
      state.places.find(
        item => item.id === id
      );


    if (!place) {
      return;
    }


    const url =
      `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lon}`;


    if (navigator.onLine) {

      window.open(
        url,
        "_blank"
      );

    } else {

      alert(
        `${place.name}\n\n` +
        `${place.lat}, ${place.lon}`
      );

    }

  };


/* =========================
   EXPORT
========================= */

function exportData() {

  const data = {

    app:
      "SAHARA GUIDE DZ",

    version:
      "V1",

    exportedAt:
      new Date().toISOString(),

    places:
      state.places,

    track:
      state.track

  };


  const blob =
    new Blob(
      [
        JSON.stringify(
          data,
          null,
          2
        )
      ],
      {
        type:
          "application/json"
      }
    );


  const url =
    URL.createObjectURL(blob);


  const link =
    document.createElement("a");

  link.href = url;

  link.download =
    "sahara-guide-dz-backup.json";

  link.click();


  URL.revokeObjectURL(url);

}


/* =========================
   COMPASS
========================= */

async function enableCompass() {

  try {

    if (
      typeof DeviceOrientationEvent !==
      "undefined" &&
      typeof DeviceOrientationEvent.requestPermission ===
      "function"
    ) {

      const permission =
        await DeviceOrientationEvent
          .requestPermission();


      if (
        permission !== "granted"
      ) {

        alert(
          "لم يتم السماح باستخدام البوصلة."
        );

        return;

      }

    }


    window.addEventListener(
      "deviceorientationabsolute",
      handleOrientation,
      {
        passive: true
      }
    );


    window.addEventListener(
      "deviceorientation",
      handleOrientation,
      {
        passive: true
      }
    );


    $("#mapInfo").textContent =
      "البوصلة مفعلة.";

  } catch {

    alert(
      "تعذر تفعيل البوصلة في هذا المتصفح."
    );

  }

}


function handleOrientation(event) {

  let heading;


  if (
    typeof event.webkitCompassHeading ===
    "number"
  ) {

    heading =
      event.webkitCompassHeading;

  } else {

    heading =
      (
        360 -
        (event.alpha || 0)
      ) % 360;

  }


  if (
    !Number.isFinite(heading)
  ) {
    return;
  }


  state.heading =
    heading;


  $("#headingText").textContent =
    Math.round(heading) + "°";


  $("#compassDegree").textContent =
    Math.round(heading) + "°";


  $("#compass").style.transform =
    `rotate(${-heading}deg)`;

}


/* =========================
   ONLINE STATUS
========================= */

function updateOnlineStatus() {

  if (navigator.onLine) {

    $("#onlineStatus").textContent =
      "● متصل";

    $("#onlineStatus").style.color =
      "#7cdda4";

  } else {

    $("#onlineStatus").textContent =
      "● بدون إنترنت";

    $("#onlineStatus").style.color =
      "#efc45d";

  }

}


/* =========================
   EVENTS
========================= */

$("#locateBtn").onclick =
  function() {

    locateUser();

    startTracking();

  };


$("#trackNav").onclick =
  function() {

    locateUser();

    startTracking();

  };


$("#saveCurrentBtn").onclick =
  prepareCurrentPoint;


$("#placesNav").onclick =
  function() {

    $("#placesList").scrollIntoView({
      behavior: "smooth"
    });

  };


$("#compassBtn").onclick =
  enableCompass;


$("#clearTrackBtn").onclick =
  function() {

    if (
      confirm(
        "هل تريد مسح مسار المشي؟"
      )
    ) {

      state.track = [];

      saveData();

      updateStats();

      drawMap();

    }

  };


$("#pointForm").onsubmit =
  function(event) {

    event.preventDefault();


    const name =
      $("#pointName").value.trim();

    const lat =
      Number(
        $("#latInput").value
      );

    const lon =
      Number(
        $("#lonInput").value
      );


    if (
      !name ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    ) {

      alert(
        "أدخل اسمًا وإحداثيات صحيحة."
      );

      return;

    }


    state.places.push({

      id:
        "point-" +
        Date.now(),

      name,

      type:
        $("#pointType").value,

      note:
        $("#pointNote").value.trim(),

      lat,

      lon

    });


    saveData();

    event.target.reset();

    renderPlaces();

    updateStats();

    drawMap();


    alert(
      "تم حفظ النقطة على جهازك."
    );

  };


$("#trackingToggle").onchange =
  function(event) {

    if (
      event.target.checked
    ) {

      startTracking();

    }

  };


$("#deleteDataBtn").onclick =
  function() {

    if (
      !confirm(
        "سيتم حذف جميع النقاط والمسار المحفوظين. متابعة؟"
      )
    ) {

      return;

    }


    state.places = [];

    state.track = [];

    state.lastPosition = null;


    localStorage.removeItem(
      "sahara_places"
    );

    localStorage.removeItem(
      "sahara_track"
    );


    renderPlaces();

    updateStats();

    drawMap();

  };


$("#exportBtn").onclick =
  exportData;


$("#settingsNav").onclick =
  function() {

    $("#settingsDialog").showModal();

  };


/* =========================
   PWA INSTALL
========================= */

let deferredInstallPrompt =
  null;


window.addEventListener(
  "beforeinstallprompt",
  event => {

    event.preventDefault();

    deferredInstallPrompt =
      event;

    $("#installBtn")
      .classList
      .remove("hidden");

  }
);


$("#installBtn").onclick =
  async function() {

    if (
      !deferredInstallPrompt
    ) {
      return;
    }


    deferredInstallPrompt.prompt();


    await deferredInstallPrompt.userChoice;


    deferredInstallPrompt =
      null;


    $("#installBtn")
      .classList
      .add("hidden");

  };


/* =========================
   SERVICE WORKER
========================= */

if (
  "serviceWorker" in navigator
) {

  window.addEventListener(
    "load",
    () => {

      navigator.serviceWorker
        .register(
          "service-worker.js"
        )
        .catch(
          error =>
            console.error(
              "Service Worker:",
              error
            )
        );

    }
  );

}


/* =========================
   INIT
========================= */

window.addEventListener(
  "resize",
  drawMap
);

window.addEventListener(
  "online",
  updateOnlineStatus
);

window.addEventListener(
  "offline",
  updateOnlineStatus
);


loadData();

renderPlaces();

updateStats();

drawMap();

updateOnlineStatus();
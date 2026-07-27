/**
 * The map document rendered inside a `WebView`.
 *
 * ## Why hand-written instead of react-native-maps / expo-maps
 *
 * Both native map libraries require a Google Maps API key on Android *and* a
 * custom development build — neither runs in Expo Go, and a reviewer without the
 * key would see a blank grey square. This renderer needs neither: it draws
 * OpenStreetMap raster tiles directly, so the Map tab behaves identically in
 * Expo Go, in a dev build and in the release APK, with nothing secret in the
 * repository.
 *
 * It is a real slippy map — Web Mercator projection, tile grid, drag to pan,
 * pinch and buttons to zoom, tap a pin to open its task — in about 200 lines and
 * with zero third-party JavaScript. The trade-off is documented in the README:
 * no offline tile cache and no vector styling.
 *
 * The bridge is deliberately tiny:
 *   RN  → web:  `window.__setMarkers(markers)` / `window.__focus(id)`
 *   web → RN:   postMessage `{ type: 'marker-press', id }` and `{ type: 'ready' }`
 */

export interface MapMarkerPayload {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  subtitle: string;
  /** Hex colour derived from the task status, so pins match the rest of the UI. */
  color: string;
}

interface BuildMapHtmlOptions {
  isDark: boolean;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  borderColor: string;
  fallbackLatitude: number;
  fallbackLongitude: number;
  fallbackZoom: number;
}

export const buildMapHtml = ({
  isDark,
  backgroundColor,
  surfaceColor,
  textColor,
  borderColor,
  fallbackLatitude,
  fallbackLongitude,
  fallbackZoom,
}: BuildMapHtmlOptions): string => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
<style>
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body { margin: 0; height: 100%; overflow: hidden; background: ${backgroundColor};
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  #viewport { position: absolute; inset: 0; overflow: hidden; touch-action: none; cursor: grab; }
  #viewport.dragging { cursor: grabbing; }
  #tiles { position: absolute; inset: 0; ${
    // A single filter turns the light OSM raster into a passable dark basemap.
    isDark ? 'filter: invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.9);' : ''
  } }
  .tile { position: absolute; width: 256px; height: 256px; user-select: none; -webkit-user-drag: none; }
  #pins { position: absolute; inset: 0; pointer-events: none; }
  .pin { position: absolute; pointer-events: auto; transform: translate(-50%, -100%);
    display: flex; flex-direction: column; align-items: center; }
  .pin-head { width: 26px; height: 26px; border-radius: 50%; border: 3px solid #fff;
    box-shadow: 0 2px 6px rgba(0,0,0,.45); }
  .pin-tail { width: 2px; height: 10px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.4); }
  .pin.active .pin-head { transform: scale(1.25); }
  #callout { position: absolute; left: 12px; right: 12px; bottom: 12px; padding: 12px 14px;
    background: ${surfaceColor}; color: ${textColor}; border: 1px solid ${borderColor};
    border-radius: 14px; box-shadow: 0 6px 20px rgba(0,0,0,.28); display: none; }
  #callout.visible { display: block; }
  #callout .title { font-size: 15px; font-weight: 700; margin-bottom: 2px; }
  #callout .subtitle { font-size: 12px; opacity: .72; margin-bottom: 10px; }
  #callout .open { display: inline-block; font-size: 13px; font-weight: 700; color: #fff;
    background: #2563EB; padding: 9px 14px; border-radius: 9px; }
  #zoom { position: absolute; right: 12px; top: 12px; display: flex; flex-direction: column;
    border-radius: 10px; overflow: hidden; border: 1px solid ${borderColor}; }
  #zoom button { width: 44px; height: 44px; font-size: 22px; line-height: 1; border: 0;
    background: ${surfaceColor}; color: ${textColor}; }
  #zoom button:active { opacity: .6; }
  #attribution { position: absolute; left: 6px; bottom: 4px; font-size: 9px; opacity: .65;
    color: ${textColor}; background: ${surfaceColor}; padding: 1px 5px; border-radius: 4px; }
  #empty { position: absolute; inset: 0; display: none; align-items: center; justify-content: center;
    text-align: center; padding: 24px; color: ${textColor}; font-size: 14px; opacity: .75; }
  #empty.visible { display: flex; }
</style>
</head>
<body>
<div id="viewport">
  <div id="tiles"></div>
  <div id="pins"></div>
</div>
<div id="zoom"><button id="zoom-in" aria-label="Zoom in">+</button><button id="zoom-out" aria-label="Zoom out">-</button></div>
<div id="attribution">© OpenStreetMap</div>
<div id="empty">No task has map coordinates yet.</div>
<div id="callout"><div class="title"></div><div class="subtitle"></div><span class="open">Open task</span></div>

<script>
(function () {
  var TILE = 256, MIN_ZOOM = 2, MAX_ZOOM = 18;
  var viewport = document.getElementById('viewport');
  var tileLayer = document.getElementById('tiles');
  var pinLayer = document.getElementById('pins');
  var callout = document.getElementById('callout');
  var emptyNote = document.getElementById('empty');

  var zoom = ${fallbackZoom};
  var markers = [];
  var selectedId = null;
  var center = project(${fallbackLatitude}, ${fallbackLongitude}, zoom);

  function send(payload) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  }

  // --- Web Mercator -------------------------------------------------------
  function project(lat, lon, z) {
    var scale = TILE * Math.pow(2, z);
    var sinLat = Math.sin(lat * Math.PI / 180);
    return {
      x: (lon + 180) / 360 * scale,
      y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale
    };
  }

  function size() { return { w: viewport.clientWidth, h: viewport.clientHeight }; }
  function topLeft() { var s = size(); return { x: center.x - s.w / 2, y: center.y - s.h / 2 }; }

  // --- Rendering ----------------------------------------------------------
  var tileCache = {};

  function renderTiles() {
    var s = size(), tl = topLeft(), max = Math.pow(2, zoom);
    var firstX = Math.floor(tl.x / TILE), firstY = Math.floor(tl.y / TILE);
    var lastX = Math.floor((tl.x + s.w) / TILE), lastY = Math.floor((tl.y + s.h) / TILE);
    var seen = {};

    for (var ty = firstY; ty <= lastY; ty++) {
      if (ty < 0 || ty >= max) continue;
      for (var tx = firstX; tx <= lastX; tx++) {
        // Wrap horizontally so panning past the antimeridian keeps working.
        var wrapped = ((tx % max) + max) % max;
        var key = zoom + '/' + wrapped + '/' + ty + '/' + tx;
        seen[key] = true;

        var img = tileCache[key];
        if (!img) {
          img = document.createElement('img');
          img.className = 'tile';
          img.draggable = false;
          img.src = 'https://tile.openstreetmap.org/' + zoom + '/' + wrapped + '/' + ty + '.png';
          tileCache[key] = img;
          tileLayer.appendChild(img);
        }
        img.style.transform = 'translate3d(' + (tx * TILE - tl.x) + 'px,' + (ty * TILE - tl.y) + 'px,0)';
      }
    }

    Object.keys(tileCache).forEach(function (key) {
      if (!seen[key]) { tileLayer.removeChild(tileCache[key]); delete tileCache[key]; }
    });
  }

  function renderPins() {
    var tl = topLeft(), s = size();
    pinLayer.innerHTML = '';

    markers.forEach(function (marker) {
      var p = project(marker.latitude, marker.longitude, zoom);
      var x = p.x - tl.x, y = p.y - tl.y;
      // Skip pins well outside the viewport rather than paying for their layout.
      if (x < -60 || y < -60 || x > s.w + 60 || y > s.h + 60) return;

      var pin = document.createElement('div');
      pin.className = 'pin' + (marker.id === selectedId ? ' active' : '');
      pin.style.left = x + 'px';
      pin.style.top = y + 'px';

      var head = document.createElement('div');
      head.className = 'pin-head';
      head.style.background = marker.color;
      var tail = document.createElement('div');
      tail.className = 'pin-tail';

      pin.appendChild(head);
      pin.appendChild(tail);
      pin.addEventListener('click', function (event) {
        event.stopPropagation();
        selectMarker(marker.id);
      });
      pinLayer.appendChild(pin);
    });
  }

  function render() { renderTiles(); renderPins(); }

  function selectMarker(id) {
    selectedId = id;
    var marker = markers.filter(function (m) { return m.id === id; })[0];
    if (!marker) return;
    callout.querySelector('.title').textContent = marker.title;
    callout.querySelector('.subtitle').textContent = marker.subtitle;
    callout.classList.add('visible');
    renderPins();
  }

  callout.addEventListener('click', function () {
    if (selectedId) send({ type: 'marker-press', id: selectedId });
  });

  viewport.addEventListener('click', function () {
    // A pan ends with a click event; don't let it dismiss the callout.
    if (moved) { moved = false; return; }
    selectedId = null;
    callout.classList.remove('visible');
    renderPins();
  });

  // --- Gestures -----------------------------------------------------------
  var pointers = {}, lastPinchDistance = 0, moved = false;

  viewport.addEventListener('pointerdown', function (event) {
    pointers[event.pointerId] = { x: event.clientX, y: event.clientY };
    viewport.setPointerCapture(event.pointerId);
    viewport.classList.add('dragging');
    moved = false;
  });

  viewport.addEventListener('pointermove', function (event) {
    var previous = pointers[event.pointerId];
    if (!previous) return;
    var ids = Object.keys(pointers);

    if (ids.length === 1) {
      center.x -= event.clientX - previous.x;
      center.y -= event.clientY - previous.y;
      if (Math.abs(event.clientX - previous.x) > 2 || Math.abs(event.clientY - previous.y) > 2) moved = true;
      pointers[event.pointerId] = { x: event.clientX, y: event.clientY };
      render();
      return;
    }

    pointers[event.pointerId] = { x: event.clientX, y: event.clientY };
    var a = pointers[ids[0]], b = pointers[ids[1]];
    var distance = Math.hypot(a.x - b.x, a.y - b.y);
    if (lastPinchDistance > 0 && Math.abs(distance - lastPinchDistance) > 12) {
      setZoom(zoom + (distance > lastPinchDistance ? 1 : -1));
      lastPinchDistance = distance;
    } else if (lastPinchDistance === 0) {
      lastPinchDistance = distance;
    }
    moved = true;
  });

  function endPointer(event) {
    delete pointers[event.pointerId];
    if (Object.keys(pointers).length < 2) lastPinchDistance = 0;
    if (Object.keys(pointers).length === 0) viewport.classList.remove('dragging');
  }
  viewport.addEventListener('pointerup', endPointer);
  viewport.addEventListener('pointercancel', endPointer);

  function setZoom(next) {
    var clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
    if (clamped === zoom) return;
    var factor = Math.pow(2, clamped - zoom);
    center = { x: center.x * factor, y: center.y * factor };
    zoom = clamped;
    tileLayer.innerHTML = '';
    tileCache = {};
    render();
  }

  document.getElementById('zoom-in').addEventListener('click', function (e) { e.stopPropagation(); setZoom(zoom + 1); });
  document.getElementById('zoom-out').addEventListener('click', function (e) { e.stopPropagation(); setZoom(zoom - 1); });
  window.addEventListener('resize', render);

  // --- Bridge -------------------------------------------------------------
  function fitToMarkers() {
    if (markers.length === 0) return;
    if (markers.length === 1) {
      zoom = 14;
      center = project(markers[0].latitude, markers[0].longitude, zoom);
      return;
    }

    var lats = markers.map(function (m) { return m.latitude; });
    var lons = markers.map(function (m) { return m.longitude; });
    var minLat = Math.min.apply(null, lats), maxLat = Math.max.apply(null, lats);
    var minLon = Math.min.apply(null, lons), maxLon = Math.max.apply(null, lons);
    var s = size();

    // Largest zoom at which every marker still fits, with a margin for the pins.
    for (var z = MAX_ZOOM; z >= MIN_ZOOM; z--) {
      var a = project(maxLat, minLon, z), b = project(minLat, maxLon, z);
      if (b.x - a.x < s.w - 80 && b.y - a.y < s.h - 140) { zoom = z; break; }
    }
    center = project((minLat + maxLat) / 2, (minLon + maxLon) / 2, zoom);
  }

  window.__setMarkers = function (next) {
    var hadMarkers = markers.length > 0;
    markers = next || [];
    emptyNote.classList.toggle('visible', markers.length === 0);
    if (!hadMarkers) fitToMarkers();
    render();
  };

  window.__focus = function (id) {
    var marker = markers.filter(function (m) { return m.id === id; })[0];
    if (!marker) return;
    zoom = Math.max(zoom, 14);
    center = project(marker.latitude, marker.longitude, zoom);
    tileLayer.innerHTML = '';
    tileCache = {};
    selectMarker(id);
    render();
  };

  window.__fit = function () { fitToMarkers(); tileLayer.innerHTML = ''; tileCache = {}; render(); };

  render();
  send({ type: 'ready' });
})();
</script>
</body>
</html>`;

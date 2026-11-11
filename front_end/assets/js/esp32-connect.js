/**
 * ==========================================================================
 * ESP32 CONNECTION CONTROLLER (esp32-connect.js)
 * Kết nối WebSocket thật tới Spring Boot IoT gateway, nhận telemetry,
 * log và sự kiện nhận diện trực tiếp; kiểm tra ping qua REST API.
 * ==========================================================================
 */

(function () {
  'use strict';

  var RECONNECT_DELAY_MS = 3000;
  var MAX_LOG_LINES = 60;

  var state = {
    status: 'disconnected',
    ping: null,
    rssi: null,
    freeHeap: null,
    packetsIn: 0,
    packetsOut: 0,
    autoReconnect: true
  };

  var ws = null;
  var reconnectTimer = null;
  var pendingPingStartedAt = null;
  var manualClose = false;

  function $(id) {
    return document.getElementById(id);
  }

  function notify(msg) {
    if (window.SmartBin && typeof window.SmartBin.toast === 'function') {
      window.SmartBin.toast(msg);
    }
  }

  function timestamp() {
    var d = new Date();
    return ('0' + d.getHours()).slice(-2) + ':' +
      ('0' + d.getMinutes()).slice(-2) + ':' +
      ('0' + d.getSeconds()).slice(-2);
  }

  /* =========================================================================
     1. CONSOLE LOG RENDERING
     ========================================================================= */
  function addLog(tag, msg, isErr) {
    var consoles = document.querySelectorAll('.esp-console-box');

    consoles.forEach(function (box) {
      var line = document.createElement('div');
      line.className = 'esp-log-line' + (isErr ? ' esp-log-err' : '');

      var timeEl = document.createElement('span');
      timeEl.className = 'esp-log-time';
      timeEl.textContent = '[' + timestamp() + ']';

      var tagEl = document.createElement('span');
      tagEl.className = 'esp-log-tag';
      tagEl.textContent = '[' + tag + ']';

      line.appendChild(timeEl);
      line.appendChild(tagEl);
      line.appendChild(document.createTextNode(' ' + msg));

      box.appendChild(line);
      box.scrollTop = box.scrollHeight;

      while (box.children.length > MAX_LOG_LINES) {
        box.removeChild(box.firstChild);
      }
    });
  }

  /* =========================================================================
     2. UI STATE
     ========================================================================= */
  function updateUi() {
    var isConnected = state.status === 'connected';
    var isConnecting = state.status === 'connecting';

    document.querySelectorAll('.esp-status-badge, .esp-status-pill').forEach(function (b) {
      b.className = 'esp-status-badge ' + state.status;
      b.innerHTML = isConnected
        ? '<span class="esp-pulse-dot"></span> ĐÃ KẾT NỐI (ESP32-S3)'
        : (isConnecting
          ? '<span class="esp-pulse-dot"></span> ĐANG KẾT NỐI...'
          : '<span class="esp-pulse-dot"></span> CHƯA KẾT NỐI');
    });

    document.querySelectorAll('.btn-esp-toggle').forEach(function (btn) {
      if (isConnected) {
        btn.textContent = 'Ngắt kết nối';
        btn.className = 'btn btn-disconnect btn-esp-toggle';
      } else if (isConnecting) {
        btn.textContent = 'Đang xử lý...';
        btn.className = 'btn ghost btn-esp-toggle';
      } else {
        btn.textContent = 'Kết nối ESP32';
        btn.className = 'btn btn-connect btn-esp-toggle';
      }
    });

    var elPing = $('espPing');
    if (elPing) elPing.textContent = isConnected && state.ping != null ? state.ping + ' ms' : '--';

    var elRssi = $('espRssi');
    if (elRssi) elRssi.textContent = isConnected && state.rssi != null ? state.rssi + ' dBm' : '--';

    var elPackets = $('espPackets');
    if (elPackets) {
      elPackets.textContent = isConnected ? (state.packetsIn + ' / ' + state.packetsOut) : '--';
    }

    var elHeap = $('espHeap');
    if (elHeap) elHeap.textContent = isConnected && state.freeHeap != null ? state.freeHeap + ' KB' : '--';

    ['sideOn', 'devOn'].forEach(function (id) {
      var el = $(id);
      if (el) {
        el.textContent = isConnected ? 'ONLINE' : 'OFFLINE';
        el.style.color = isConnected ? 'var(--ok, #059669)' : 'var(--bad, #dc2626)';
      }
    });

    var mBadge = document.querySelector('.m-controller-status-badge');
    if (mBadge) {
      if (isConnected) {
        mBadge.innerHTML = '<span class="m-pulse-dot">●</span> ĐANG KẾT NỐI';
        mBadge.style.color = '#166534';
      } else {
        mBadge.innerHTML = '<span class="m-pulse-dot" style="background:#dc2626">●</span> MẤT TÍN HIỆU';
        mBadge.style.color = '#dc2626';
      }
    }
  }

  /* =========================================================================
     3. TELEMETRY APPLICATION
     ========================================================================= */
  function applyTelemetry(payload) {
    if (!payload) return;

    var rssi = payload.rssi != null ? payload.rssi : payload.wifiRssi;
    if (rssi != null) state.rssi = rssi;

    var heap = payload.freeHeap != null ? payload.freeHeap : payload.freeHeapKb;
    if (heap != null) state.freeHeap = heap;

    if (payload.packetsIn != null) state.packetsIn = payload.packetsIn;
    if (payload.packetsOut != null) state.packetsOut = payload.packetsOut;
    if (payload.ping != null) state.ping = payload.ping;

    updateUi();
  }

  function describeTelemetry(payload) {
    if (!payload) return 'Nhận gói telemetry rỗng';
    var parts = [];
    if (payload.rssi != null || payload.wifiRssi != null) {
      parts.push('RSSI=' + (payload.rssi != null ? payload.rssi : payload.wifiRssi) + 'dBm');
    }
    if (payload.ping != null) parts.push('ping=' + payload.ping + 'ms');
    if (payload.freeHeap != null || payload.freeHeapKb != null) {
      parts.push('heap=' + (payload.freeHeap != null ? payload.freeHeap : payload.freeHeapKb) + 'KB');
    }
    if (payload.bin1Dist != null) parts.push('ngăn1=' + payload.bin1Dist + 'cm');
    if (payload.bin2Dist != null) parts.push('ngăn2=' + payload.bin2Dist + 'cm');
    if (payload.bin3Dist != null) parts.push('ngăn3=' + payload.bin3Dist + 'cm');
    return parts.length ? parts.join(' | ') : 'Telemetry đã cập nhật';
  }

  /* =========================================================================
     4. INCOMING WEBSOCKET MESSAGES
     ========================================================================= */
  function dispatchDetection(payload) {
    try {
      document.dispatchEvent(new CustomEvent('smartbin:new-detection', { detail: payload }));
    } catch (e) {
      /* CustomEvent không được hỗ trợ - bỏ qua */
    }
  }

  function handleMessage(event) {
    state.packetsIn += 1;

    var data;
    try {
      data = JSON.parse(event.data);
    } catch (e) {
      addLog('RAW', String(event.data));
      updateUi();
      return;
    }

    var type = data.type || 'UNKNOWN';

    switch (type) {
      case 'CONNECTION_ESTABLISHED':
        addLog('SERVER', data.message || 'Handshake OK với Spring Boot Server');
        break;

      case 'TELEMETRY_UPDATE':
        applyTelemetry(data.payload);
        addLog('TELEMETRY', describeTelemetry(data.payload));
        break;

      case 'TELEMETRY':
        applyTelemetry(data.payload);
        addLog('TELEMETRY', describeTelemetry(data.payload));
        break;

      case 'RAW_LOG':
      case 'CONSOLE_LOG':
        addLog(data.tag || 'LOG', data.message || data.payload || '');
        break;

      case 'NEW_DETECTION':
        if (data.payload) {
          addLog('AI',
            (data.payload.category || '?') + ' · ' + (data.payload.confidence || '?') +
            ' · ' + (data.payload.port || '') + ' → gạt vào ngăn ' + (data.payload.binNumber || '?'));
          dispatchDetection(data.payload);
        }
        break;

      case 'PONG':
        if (pendingPingStartedAt != null) {
          state.ping = Math.round(performance.now() - pendingPingStartedAt);
          pendingPingStartedAt = null;
          addLog('PING', 'PONG từ gateway · ' + state.ping + ' ms');
        } else {
          addLog('PING', data.message || 'PONG');
        }
        break;

      case 'TELEMETRY_ACK':
        break;

      default:
        addLog('SERVER', 'Nhận sự kiện ' + type);
        break;
    }

    updateUi();
  }

  /* =========================================================================
     5. CONNECTION LIFECYCLE
     ========================================================================= */
  function scheduleReconnect() {
    clearTimeout(reconnectTimer);
    if (!state.autoReconnect || manualClose) return;

    reconnectTimer = setTimeout(function () {
      if (state.status !== 'connected' && state.status !== 'connecting') {
        addLog('SYSTEM', 'Đang thử kết nối lại tới gateway...');
        connect();
      }
    }, RECONNECT_DELAY_MS);
  }

  function connect() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    manualClose = false;
    clearTimeout(reconnectTimer);
    state.status = 'connecting';
    updateUi();

    var url = window.WS_BASE || 'ws://localhost:8080/ws/iot';
    addLog('SYSTEM', 'Khởi tạo kết nối WebSocket ' + url + '...');

    try {
      ws = new WebSocket(url);
    } catch (e) {
      state.status = 'disconnected';
      updateUi();
      addLog('SYSTEM', 'Không thể tạo WebSocket: ' + e.message, true);
      scheduleReconnect();
      return;
    }

    ws.onopen = function () {
      state.status = 'connected';
      updateUi();
      addLog('ESP32-S3', 'Bắt tay thành công (Handshake OK) với gateway Spring Boot.');
      notify('Đã kết nối thành công tới gateway ESP32-S3!');
    };

    ws.onmessage = handleMessage;

    ws.onerror = function () {
      addLog('SYSTEM', 'Lỗi đường truyền WebSocket.', true);
    };

    ws.onclose = function (evt) {
      state.status = 'disconnected';
      updateUi();
      addLog('SYSTEM', 'Mất kết nối WebSocket' + (evt && evt.code ? ' (code ' + evt.code + ')' : '') + '.', true);

      if (!manualClose) {
        notify('Mất kết nối tới gateway ESP32. Đang thử kết nối lại...');
        scheduleReconnect();
      }
    };
  }

  function disconnect() {
    manualClose = true;
    clearTimeout(reconnectTimer);
    pendingPingStartedAt = null;

    if (ws) {
      try {
        ws.close(1000, 'Client disconnected');
      } catch (e) {
        /* bỏ qua */
      }
      ws = null;
    }

    state.status = 'disconnected';
    updateUi();
    addLog('SYSTEM', 'Đã ngắt kết nối với ESP32-S3.', true);
    notify('Đã ngắt kết nối với vi điều khiển ESP32');
  }

  function toggleConnection() {
    if (state.status === 'connected' || state.status === 'connecting') {
      disconnect();
    } else {
      connect();
    }
  }

  /* =========================================================================
     6. PING VIA REST API
     ========================================================================= */
  function testPing() {
    if (state.status !== 'connected') {
      notify('ESP32 chưa kết nối! Vui lòng kết nối trước.');
      return;
    }

    var startedAt = performance.now();
    addLog('PING', 'Gửi yêu cầu GET /iot/ping tới gateway...');

    window.SmartBin.request('/iot/ping')
      .then(function (res) {
        var latency = Math.round(performance.now() - startedAt);
        state.ping = latency;
        updateUi();
        addLog('PING',
          'Phản hồi /iot/ping: ' + latency + ' ms' +
          (res && res.latencyMs != null ? ' (server latency ' + res.latencyMs + ' ms)' : ''));
        notify('Ping gateway thành công: ' + latency + ' ms');
      })
      .catch(function (err) {
        addLog('PING', 'Ping thất bại: ' + err.message, true);
        notify('Ping thất bại: ' + err.message);
      });
  }

  /* =========================================================================
     7. MODAL
     ========================================================================= */
  function openModal() {
    var m = $('modalEspConnect');
    if (m) m.classList.add('open');
  }

  function closeModal() {
    var m = $('modalEspConnect');
    if (m) m.classList.remove('open');
  }

  /* =========================================================================
     8. INITIALISATION
     ========================================================================= */
  function init() {
    var autoInput = $('espAutoReconnect');
    if (autoInput) {
      state.autoReconnect = autoInput.checked;
      autoInput.addEventListener('change', function () {
        state.autoReconnect = autoInput.checked;
        addLog('SYSTEM', state.autoReconnect ? 'Đã bật tự động kết nối lại.' : 'Đã tắt tự động kết nối lại.');
        if (state.autoReconnect && state.status === 'disconnected') {
          connect();
        } else if (!state.autoReconnect) {
          clearTimeout(reconnectTimer);
        }
      });
    }

    document.addEventListener('click', function (e) {
      if (e.target && e.target.classList.contains('btn-esp-toggle')) {
        toggleConnection();
      }
      if (e.target && e.target.id === 'btnPingEsp') {
        testPing();
      }
      if (e.target && (e.target.id === 'modalEspClose' || e.target.closest('.btn-close-esp-modal'))) {
        closeModal();
      }
      if (e.target && e.target.id === 'modalEspConnect') {
        closeModal();
      }
      if (e.target && e.target.id === 'btnOpenEspModal') {
        openModal();
      }
      if (e.target && e.target.id === 'btnClearEspLog') {
        document.querySelectorAll('.esp-console-box').forEach(function (c) { c.innerHTML = ''; });
        addLog('LOG', 'Đã xóa toàn bộ nhật ký kết nối.');
      }
    });

    document.querySelectorAll('.hw, .m-controller-card').forEach(function (w) {
      w.classList.add('clickable');
      w.setAttribute('title', 'Bấm để cấu hình kết nối ESP32');
    });

    updateUi();
    connect();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.Esp32Connector = {
    connect: connect,
    disconnect: disconnect,
    toggle: toggleConnection,
    ping: testPing,
    openModal: openModal,
    closeModal: closeModal,
    addLog: addLog,
    getState: function () { return Object.assign({}, state); }
  };
})();

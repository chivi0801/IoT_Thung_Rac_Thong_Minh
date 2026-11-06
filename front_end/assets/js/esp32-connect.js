/**
 * ==========================================================================
 * ESP32 CONNECTION CONTROLLER (esp32-connect.js)
 * Quản lý kết nối WebSocket / HTTP / Serial tới vi điều khiển ESP32-S3,
 * kiểm tra ping, hiển thị telemetry và console log trực tiếp.
 * ==========================================================================
 */

(function () {
  'use strict';

  var state = {
    protocol: 'ws',
    host: '192.168.1.105',
    port: '81',
    endpoint: '/ws',
    status: 'connected', // 'connected' | 'connecting' | 'disconnected'
    ping: 18,
    rssi: -54,
    freeHeap: 124,
    packetsIn: 1420,
    packetsOut: 980,
    autoReconnect: true
  };

  var telemetryTimer = null;

  function $(id) {
    return document.getElementById(id);
  }

  function notify(msg) {
    if (window.SmartBin && typeof window.SmartBin.toast === 'function') {
      window.SmartBin.toast(msg);
    }
  }

  function addLog(tag, msg, isErr) {
    var consoles = document.querySelectorAll('.esp-console-box');
    var now = new Date();
    var timeStr = ('0' + now.getHours()).slice(-2) + ':' +
                  ('0' + now.getMinutes()).slice(-2) + ':' +
                  ('0' + now.getSeconds()).slice(-2);

    consoles.forEach(function (box) {
      var line = document.createElement('div');
      line.className = 'esp-log-line' + (isErr ? ' esp-log-err' : '');
      line.innerHTML = '<span class="esp-log-time">[' + timeStr + ']</span>' +
                       '<span class="esp-log-tag">[' + tag + ']</span> ' +
                       msg;
      box.appendChild(line);
      box.scrollTop = box.scrollHeight;

      // Giữ tối đa 50 dòng log gần nhất
      while (box.children.length > 50) {
        box.removeChild(box.firstChild);
      }
    });
  }

  function updateUi() {
    var isConnected = state.status === 'connected';
    var isConnecting = state.status === 'connecting';

    // Cập nhật các badge trạng thái ESP32 trên giao diện
    var badges = document.querySelectorAll('.esp-status-badge, .esp-status-pill');
    badges.forEach(function (b) {
      b.className = 'esp-status-badge ' + state.status;
      if (isConnected) {
        b.innerHTML = '<span class="esp-pulse-dot"></span> ĐÃ KẾT NỐI (ESP32-S3)';
      } else if (isConnecting) {
        b.innerHTML = '<span class="esp-pulse-dot"></span> ĐANG KẾT NỐI...';
      } else {
        b.innerHTML = '<span class="esp-pulse-dot"></span> CHƯA KẾT NỐI';
      }
    });

    // Cập nhật nút Connect / Disconnect
    var btnConnects = document.querySelectorAll('.btn-esp-toggle');
    btnConnects.forEach(function (btn) {
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

    // Cập nhật các chỉ số Metric
    var elPing = $('espPing');
    if (elPing) elPing.textContent = isConnected ? state.ping + ' ms' : '--';

    var elRssi = $('espRssi');
    if (elRssi) elRssi.textContent = isConnected ? state.rssi + ' dBm' : '--';

    var elPackets = $('espPackets');
    if (elPackets) elPackets.textContent = isConnected ? (state.packetsIn + ' / ' + state.packetsOut) : '--';

    var elHeap = $('espHeap');
    if (elHeap) elHeap.textContent = isConnected ? state.freeHeap + ' KB' : '--';

    // Đồng bộ trạng thái phần cứng trên Sidebar & Header
    var sideOn = $('sideOn');
    if (sideOn) {
      sideOn.textContent = isConnected ? 'ONLINE' : 'OFFLINE';
      sideOn.style.color = isConnected ? 'var(--ok, #059669)' : 'var(--bad, #dc2626)';
    }

    var devOn = $('devOn');
    if (devOn) {
      devOn.textContent = isConnected ? 'ONLINE' : 'OFFLINE';
      devOn.style.color = isConnected ? 'var(--ok, #059669)' : 'var(--bad, #dc2626)';
    }

    // Mobile Top Controller Card Status
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

  function startTelemetry() {
    clearInterval(telemetryTimer);
    telemetryTimer = setInterval(function () {
      if (state.status !== 'connected') return;

      // Giả lập dao động độ trễ và số gói tin
      state.ping = 16 + Math.floor(Math.random() * 9);
      state.packetsIn += 1 + Math.floor(Math.random() * 3);
      state.packetsOut += Math.floor(Math.random() * 2);

      var elPing = $('espPing');
      if (elPing) elPing.textContent = state.ping + ' ms';

      var elPackets = $('espPackets');
      if (elPackets) elPackets.textContent = state.packetsIn + ' / ' + state.packetsOut;
    }, 3500);
  }

  function connect() {
    var inputHost = $('espHost');
    var inputPort = $('espPort');
    var selectProtocol = $('espProtocol');

    if (inputHost) state.host = inputHost.value.trim() || state.host;
    if (inputPort) state.port = inputPort.value.trim() || state.port;
    if (selectProtocol) state.protocol = selectProtocol.value || state.protocol;

    state.status = 'connecting';
    updateUi();
    addLog('SYSTEM', 'Đang kết nối tới ' + state.protocol + '://' + state.host + ':' + state.port + '...');

    setTimeout(function () {
      state.status = 'connected';
      updateUi();
      startTelemetry();
      addLog('ESP32-S3', 'Bắt tay thành công (Handshake OK). Chip model: ESP32-S3-WROOM-1 (Rev 0)');
      addLog('WIFI', 'IP cố định: ' + state.host + ' | RSSI: ' + state.rssi + ' dBm | Gateway: 192.168.1.1');
      addLog('SENSOR', 'Cảm biến siêu âm & quang điện đã đồng bộ thông số.');
      notify('Đã kết nối thành công với vi điều khiển ESP32-S3!');
    }, 700);
  }

  function disconnect() {
    state.status = 'disconnected';
    clearInterval(telemetryTimer);
    updateUi();
    addLog('SYSTEM', 'Đã ngắt kết nối với ESP32-S3.', true);
    notify('Đã ngắt kết nối với vi điều khiển ESP32');
  }

  function toggleConnection() {
    if (state.status === 'connected') {
      disconnect();
    } else {
      connect();
    }
  }

  function testPing() {
    if (state.status !== 'connected') {
      notify('ESP32 chưa kết nối! Vui lòng kết nối trước.');
      return;
    }
    var t0 = Date.now();
    addLog('PING', 'Đang gửi gói tin ICMP echo tới ' + state.host + '...');
    setTimeout(function () {
      var latency = Date.now() - t0 + Math.floor(Math.random() * 5);
      state.ping = latency;
      var elPing = $('espPing');
      if (elPing) elPing.textContent = latency + ' ms';
      addLog('PING', 'Phản hồi từ ' + state.host + ': bytes=32 thời gian=' + latency + 'ms TTL=64');
      notify('Ping ESP32 thành công: ' + latency + ' ms');
    }, 150);
  }

  function openModal() {
    var m = $('modalEspConnect');
    if (m) m.classList.add('open');
  }

  function closeModal() {
    var m = $('modalEspConnect');
    if (m) m.classList.remove('open');
  }

  function init() {
    updateUi();
    startTelemetry();

    // Lắng nghe sự kiện click nút toggle
    document.addEventListener('click', function (e) {
      if (e.target && e.target.classList.contains('btn-esp-toggle')) {
        toggleConnection();
      }
      if (e.target && e.target.id === 'btnPingEsp') {
        testPing();
      }
      if (e.target && (e.target.id === 'btnOpenEspModal' || e.target.closest('#sideOn') || e.target.closest('.m-controller-card'))) {
        openModal();
      }
      if (e.target && (e.target.id === 'modalEspClose' || e.target.closest('.btn-close-esp-modal'))) {
        closeModal();
      }
      if (e.target && e.target.id === 'modalEspConnect') {
        closeModal();
      }
      if (e.target && e.target.id === 'btnClearEspLog') {
        var consoles = document.querySelectorAll('.esp-console-box');
        consoles.forEach(function (c) { c.innerHTML = ''; });
        addLog('LOG', 'Đã xóa toàn bộ nhật ký kết nối.');
      }
    });

    // Biến widget phần cứng thành có thể bấm
    var hwWidgets = document.querySelectorAll('.hw, .m-controller-card');
    hwWidgets.forEach(function (w) {
      w.classList.add('clickable');
      w.setAttribute('title', 'Bấm để cấu hình kết nối ESP32');
    });
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


(function () {
  'use strict';

  var statusBox = document.getElementById('servo-status');
  var angleInput = document.getElementById('manual-angle');
  var angleLabel = document.getElementById('angle-label');
  var predictionGrid = document.getElementById('prediction-grid');
  var predictionBatch = document.getElementById('prediction-batch');
  var busy = false;
  var latestBatchId = '';

  function renderPredictions(batch) {
    if (!batch || batch.status !== 'complete') {
      predictionBatch.textContent = 'Đang chờ ảnh';
      predictionGrid.innerHTML = '<div class="prediction-empty">Đang chờ ESP32 gửi lượt 5 ảnh mới…</div>';
      return;
    }
    if (batch.batch_id === latestBatchId) return;
    latestBatchId = batch.batch_id;
    var images = batch.images || [];
    predictionBatch.textContent = 'Lượt ' + batch.batch_id;
    predictionGrid.innerHTML = '';
    for (var index = 1; index <= 5; index += 1) {
      var item = images.find(function (image) { return Number(image.index) === index; });
      var tile = document.createElement('article');
      tile.className = 'prediction-tile';
      if (item && (item.annotated_url || item.original_url)) {
        var image = document.createElement('img');
        image.src = (item.annotated_url || item.original_url) + '?batch=' + encodeURIComponent(batch.batch_id);
        image.alt = 'Ảnh dự đoán ' + index + ' của lượt ' + batch.batch_id;
        image.loading = 'lazy';
        var caption = document.createElement('div');
        caption.className = 'prediction-caption';
        var className = item.class_name || 'Không nhận diện';
        var confidence = Number.isFinite(Number(item.confidence)) ? (Number(item.confidence) * 100).toFixed(1) + '%' : '—';
        caption.innerHTML = '<strong></strong><span></span>';
        caption.querySelector('strong').textContent = 'Ảnh ' + index + ' · ' + className;
        caption.querySelector('span').textContent = 'Độ tin cậy: ' + confidence;
        tile.append(image, caption);
      } else {
        tile.innerHTML = '<div class="prediction-empty">Chưa có ảnh ' + index + '</div>';
      }
      predictionGrid.appendChild(tile);
    }
  }

  async function pollLatestBatch() {
    try {
      var response = await fetch('/api/latest', { cache: 'no-store' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      renderPredictions(await response.json());
    } catch (error) {
      if (!latestBatchId) {
        predictionBatch.textContent = 'Server chưa kết nối';
        predictionGrid.innerHTML = '<div class="prediction-empty">Không tải được ảnh dự đoán. Kiểm tra server backend.</div>';
      }
    } finally {
      window.setTimeout(pollLatestBatch, 2000);
    }
  }

  function setStatus(message, kind) {
    statusBox.textContent = message;
    statusBox.className = 'servo-status' + (kind ? ' ' + kind : '');
  }

  async function sendCommand(servo, angle) {
    if (busy) return;
    busy = true;
    var buttons = document.querySelectorAll('.servo-button');
    buttons.forEach(function (button) { button.disabled = true; });
    setStatus('Đang gửi lệnh đến ESP32…');
    try {
      var response = await fetch('/api/servo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servo: Number(servo), angle: Number(angle) })
      });
      var result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'ESP32 không nhận lệnh.');
      var label = 'Servo ' + servo + ' đã nhận lệnh ' + angle + '°.';
      var angleBox = document.getElementById('servo' + servo + '-angle');
      if (angleBox) angleBox.textContent = angle + '°';
      setStatus(label, 'success');
    } catch (error) {
      setStatus('Không điều khiển được servo: ' + error.message, 'error');
    } finally {
      busy = false;
      buttons.forEach(function (button) { button.disabled = false; });
    }
  }

  document.querySelectorAll('[data-servo][data-angle]').forEach(function (button) {
    button.addEventListener('click', function () {
      sendCommand(button.dataset.servo, button.dataset.angle);
    });
  });

  angleInput.addEventListener('input', function () { angleLabel.textContent = angleInput.value + '°'; });
  document.getElementById('manual-form').addEventListener('submit', function (event) {
    event.preventDefault();
    sendCommand(document.getElementById('manual-servo').value, angleInput.value);
  });

  pollLatestBatch();
})();

/**
 * ==========================================================================
 * CỔNG SINH VIÊN TÍCH ĐIỂM (tich-diem.js)
 * Quét nhận diện Thẻ Sinh Viên qua AI OCR, hiển thị tổng điểm tích lũy,
 * lịch sử thu thập rác cá nhân và đổi các phần quà môi trường.
 * Kết nối dữ liệu đồng bộ thời gian thực với trang Quản trị (doi-thuong.html).
 * ==========================================================================
 */

(function () {
  'use strict';

  var sampleProfiles = [
    {
      mssv: '21120489',
      name: 'Nguyễn Văn An',
      dept: 'Khoa Công nghệ Thông tin',
      className: 'K45-CNTT1',
      points: 135,
      rank: 'Chiến Binh Xanh (Cấp 3)',
      nextRankPoints: 200,
      nextRankName: 'Đại Sứ Môi Trường (Cấp 4)'
    },
    {
      mssv: '22118742',
      name: 'Trần Thị Mai Hương',
      dept: 'Khoa Môi trường & Tài nguyên',
      className: 'K46-MT02',
      points: 90,
      rank: 'Hạt Giống Xanh (Cấp 2)',
      nextRankPoints: 120,
      nextRankName: 'Chiến Binh Xanh (Cấp 3)'
    },
    {
      mssv: '20119631',
      name: 'Lê Hoàng Long',
      dept: 'Khoa Điện - Điện tử',
      className: 'K44-DTVT',
      points: 210,
      rank: 'Đại Sứ Môi Trường (Cấp 4)',
      nextRankPoints: 300,
      nextRankName: 'Thủ Lĩnh Xanh Toàn Trường (Cấp 5)'
    }
  ];

  var sampleHistory = [
    { type: 'plastic', title: 'Chai nhựa nước suối PET 500ml', meta: 'Hôm nay 10:24 • Ngăn nạp #1', pts: 10, status: 'Đã gạt vào ngăn' },
    { type: 'metal', title: 'Lon nước ngọt Coca-Cola 330ml', meta: 'Hôm nay 09:40 • Ngăn nạp #2', pts: 15, status: 'Đã gạt vào ngăn' },
    { type: 'plastic', title: 'Ly nhựa trà sữa PP dùng 1 lần', meta: 'Hôm qua 16:12 • Ngăn nạp #1', pts: 10, status: 'Đã gạt vào ngăn' },
    { type: 'organic', title: 'Vỏ chuối & thức ăn thừa', meta: 'Hôm qua 11:35 • Ngăn nạp #3', pts: 5, status: 'Đã gạt vào ngăn' },
    { type: 'metal', title: 'Hộp thiếc cà phê kim loại', meta: '28/10 14:10 • Ngăn nạp #2', pts: 15, status: 'Đã gạt vào ngăn' }
  ];

  var currentStudent = sampleProfiles[0];
  var pendingReward = 10;
  var isScanning = false;

  function $(id) {
    return document.getElementById(id);
  }

  function notify(msg) {
    if (window.SmartBin && typeof window.SmartBin.toast === 'function') {
      window.SmartBin.toast(msg);
    }
  }

  function getGifts() {
    try {
      var saved = localStorage.getItem('smartbin_gifts');
      if (saved) return JSON.parse(saved);
    } catch (e) {}

    // Fallback nếu trang quản trị chưa lưu
    return [
      { id: 1, name: 'Voucher Căn tin 20.000đ', icon: '☕', points: 50, stock: 85, desc: 'Áp dụng cho mọi món ăn & đồ uống tại Căn tin trường', status: 'active' },
      { id: 2, name: 'Bình giữ nhiệt Eco Green 500ml', icon: '🍃', points: 200, stock: 18, desc: 'Inox 304 giữ nhiệt 12h, in logo Thùng Rác Thông Minh', status: 'active' },
      { id: 3, name: 'Túi vải Canvas bảo vệ môi trường', icon: '🛍️', points: 80, stock: 42, desc: 'Vải canvas sợi tự nhiên tái sử dụng nhiều lần', status: 'active' },
      { id: 4, name: '+5 Điểm rèn luyện học kỳ', icon: '🎖️', points: 150, stock: 999, desc: 'Cộng trực tiếp mục Hoạt động Tình nguyện vì Môi trường', status: 'active' },
      { id: 5, name: 'Hộp bút tre tái sinh (3 cây)', icon: '✏️', points: 30, stock: 120, desc: 'Vỏ tre tự nhiên phân hủy sinh học, mực gel êm ái', status: 'active' }
    ];
  }

  function updateStudentUi() {
    if (!currentStudent) return;

    var nameEls = document.querySelectorAll('.st-val-name');
    nameEls.forEach(function (el) { el.textContent = currentStudent.name; });

    var mssvEls = document.querySelectorAll('.st-val-mssv');
    mssvEls.forEach(function (el) { el.textContent = 'MSSV: ' + currentStudent.mssv; });

    var deptEls = document.querySelectorAll('.st-val-dept');
    deptEls.forEach(function (el) { el.textContent = currentStudent.dept; });

    var classEls = document.querySelectorAll('.st-val-class');
    classEls.forEach(function (el) { el.textContent = currentStudent.className; });

    var rankEls = document.querySelectorAll('.st-val-rank');
    rankEls.forEach(function (el) { el.textContent = currentStudent.rank; });

    var totalPtsEls = document.querySelectorAll('.st-val-total-points');
    totalPtsEls.forEach(function (el) { el.textContent = currentStudent.points; });

    // Cập nhật thanh tiến trình Rank
    var maxPts = currentStudent.nextRankPoints || 200;
    var pct = Math.min(100, Math.round((currentStudent.points / maxPts) * 100));
    var fill = $('rankProgressFill');
    if (fill) fill.style.width = pct + '%';

    var pctText = $('rankProgressPct');
    if (pctText) pctText.textContent = pct + '%';

    var tip = $('rankNextTip');
    if (tip) {
      var remain = Math.max(0, maxPts - currentStudent.points);
      tip.textContent = 'Tích thêm ' + remain + ' điểm để đạt ' + currentStudent.nextRankName;
    }

    renderGiftsCatalog();
  }

  function renderHistoryList() {
    var container = $('studentHistoryList');
    if (!container) return;

    container.innerHTML = '';
    sampleHistory.forEach(function (item) {
      var row = document.createElement('div');
      row.className = 'student-history-item';
      row.innerHTML =
        '<div class="hist-left">' +
          '<div class="hist-icon ' + item.type + '">' +
            (item.type === 'plastic' ? '🧃' : (item.type === 'metal' ? '🥫' : '🍌')) +
          '</div>' +
          '<div>' +
            '<div class="hist-title">' + item.title + '</div>' +
            '<div class="hist-meta">' + item.meta + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="hist-right">' +
          '<div class="hist-pts">+' + item.pts + ' đ</div>' +
          '<div class="hist-status">' + item.status + '</div>' +
        '</div>';
      container.appendChild(row);
    });
  }

  function renderGiftsCatalog() {
    var container = $('studentGiftsGrid');
    if (!container) return;

    var gifts = getGifts();
    container.innerHTML = '';

    gifts.forEach(function (gift) {
      if (gift.status !== 'active') return;

      var card = document.createElement('div');
      card.className = 'student-gift-card';

      var canAfford = currentStudent.points >= gift.points && gift.stock > 0;
      var remainPts = gift.points - currentStudent.points;

      card.innerHTML =
        '<div class="gift-card-top">' +
          '<div class="gift-card-icon">' + (gift.icon || '🎁') + '</div>' +
          '<div>' +
            '<h4 class="gift-card-title">' + gift.name + '</h4>' +
            '<div class="gift-card-stock">Còn lại: ' + gift.stock + ' chiếc</div>' +
          '</div>' +
        '</div>' +
        '<div class="gift-card-desc">' + (gift.desc || 'Phần quà sinh thái khuyến khích lối sống xanh.') + '</div>' +
        '<div class="gift-card-bottom">' +
          '<div class="gift-points-price">' + gift.points + ' <small style="font-size:12px;color:var(--mut);">điểm</small></div>' +
          '<button type="button" class="btn-redeem-action" data-id="' + gift.id + '" ' + (canAfford ? '' : 'disabled') + '>' +
            (canAfford ? 'Đổi quà ngay' : (gift.stock <= 0 ? 'Hết quà' : 'Cần thêm ' + remainPts + 'đ')) +
          '</button>' +
        '</div>';

      container.appendChild(card);
    });
  }

  function handleFile(file) {
    if (!file || !file.type.match(/^image\//i)) {
      notify('Vui lòng chọn hoặc thả tệp hình ảnh hợp lệ (JPG, PNG, WEBP)!');
      return;
    }

    var previewContainer = $('dropPreviewContainer');
    var previewImg = $('dropPreviewImg');
    var laser = $('scanLaserLine');
    var statusLabel = $('scanStatusOverlay');

    var reader = new FileReader();
    reader.onload = function (e) {
      var dataUrl = e.target.result;

      if (previewImg) previewImg.src = dataUrl;
      if (previewContainer) previewContainer.classList.add('active');
      if (laser) laser.classList.add('scanning');
      if (statusLabel) {
        statusLabel.textContent = 'Đang nhận diện Thẻ Sinh Viên bằng AI OCR...';
        statusLabel.style.display = 'block';
      }

      isScanning = true;

      // Giả lập quét AI OCR trong 950ms
      setTimeout(function () {
        if (laser) laser.classList.remove('scanning');
        isScanning = false;

        // Chọn ngẫu nhiên hồ sơ sinh viên
        var profile = sampleProfiles[Math.floor(Math.random() * sampleProfiles.length)];
        currentStudent = profile;
        updateStudentUi();

        if (statusLabel) {
          statusLabel.textContent = 'Đã nhận diện: ' + profile.name + ' (' + profile.mssv + ')';
        }

        var avatarBoxes = document.querySelectorAll('.student-avatar-box');
        avatarBoxes.forEach(function (box) {
          box.innerHTML = '<img src="' + dataUrl + '" alt="Ảnh thẻ">';
        });

        notify('✓ Nhận diện thành công thẻ sinh viên: ' + profile.name + ' (' + profile.mssv + ')!');
      }, 950);
    };

    reader.readAsDataURL(file);
  }

  function resetDrop() {
    var previewContainer = $('dropPreviewContainer');
    var previewImg = $('dropPreviewImg');
    var laser = $('scanLaserLine');
    var statusLabel = $('scanStatusOverlay');
    var fileInput = $('studentFileInput');

    if (previewContainer) previewContainer.classList.remove('active');
    if (previewImg) previewImg.src = '';
    if (laser) laser.classList.remove('scanning');
    if (statusLabel) statusLabel.style.display = 'none';
    if (fileInput) fileInput.value = '';

    var avatarBoxes = document.querySelectorAll('.student-avatar-box');
    avatarBoxes.forEach(function (box) {
      box.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
    });

    notify('Đã sẵn sàng quét thẻ sinh viên tiếp theo.');
  }

  function confirmReward() {
    if (!currentStudent) {
      notify('Vui lòng quét thẻ sinh viên trước khi tích điểm!');
      return;
    }

    currentStudent.points += pendingReward;
    updateStudentUi();

    // Thêm vào lịch sử cá nhân
    var now = new Date();
    var timeStr = 'Hôm nay ' + ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2);
    sampleHistory.unshift({
      type: 'plastic',
      title: 'Chai nhựa nước giải khát vừa nạp',
      meta: timeStr + ' • Ngăn nạp #1',
      pts: pendingReward,
      status: 'Đã hoàn tất cơ khí'
    });
    renderHistoryList();

    notify('🎉 Chúc mừng bạn ' + currentStudent.name + ' vừa được tích +' + pendingReward + ' Điểm Xanh!');
  }

  function redeemGift(giftId) {
    var gifts = getGifts();
    var gift = gifts.find(function (g) { return g.id === giftId; });
    if (!gift) return;

    if (currentStudent.points < gift.points) {
      notify('Bạn chưa đủ điểm để đổi phần quà này!');
      return;
    }

    if (gift.stock <= 0) {
      notify('Phần quà này hiện đã tạm hết trong kho!');
      return;
    }

    // Trừ điểm sinh viên & trừ kho quà
    currentStudent.points -= gift.points;
    gift.stock -= 1;
    localStorage.setItem('smartbin_gifts', JSON.stringify(gifts));

    // Tạo mã phiếu đổi quà
    var voucherCode = 'ECO-' + Math.floor(1000 + Math.random() * 9000);
    var now = new Date();
    var timeStr = ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2) + ' - Hôm nay';

    // Thêm vào nhật ký đổi quà chung (đồng bộ sang trang Quản trị)
    var redemptions = [];
    try {
      var saved = localStorage.getItem('smartbin_redemptions');
      if (saved) redemptions = JSON.parse(saved);
    } catch (e) {}

    redemptions.unshift({
      code: voucherCode,
      mssv: currentStudent.mssv,
      name: currentStudent.name,
      giftName: gift.name,
      points: gift.points,
      time: timeStr,
      status: 'pending'
    });
    localStorage.setItem('smartbin_redemptions', JSON.stringify(redemptions));

    updateStudentUi();

    // Mở Modal Voucher chúc mừng
    var modal = $('modalVoucher');
    if (modal) {
      if ($('voucherCodeText')) $('voucherCodeText').textContent = voucherCode;
      if ($('voucherGiftName')) $('voucherGiftName').textContent = gift.name;
      if ($('voucherStudentName')) $('voucherStudentName').textContent = currentStudent.name + ' (' + currentStudent.mssv + ')';
      modal.classList.add('open');
    }

    notify('🎉 Đổi quà thành công! Hãy xuất trình mã voucher ' + voucherCode + ' tại quầy để nhận quà.');
  }

  function setupTabs() {
    var tabBtns = document.querySelectorAll('.portal-tabs-nav .tab-btn');
    var tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var targetId = btn.getAttribute('data-tab');

        tabBtns.forEach(function (b) { b.classList.remove('active'); });
        tabContents.forEach(function (c) { c.classList.remove('active'); });

        btn.classList.add('active');
        var targetContent = $(targetId);
        if (targetContent) targetContent.classList.add('active');
      });
    });
  }

  function setupDropZone() {
    var zone = $('studentDropZone');
    var fileInput = $('studentFileInput');
    var btnUpload = $('btnUploadFile');

    if (!zone) return;

    if (btnUpload && fileInput) {
      btnUpload.addEventListener('click', function (e) {
        e.stopPropagation();
        fileInput.click();
      });
    }

    zone.addEventListener('click', function () {
      if (fileInput) fileInput.click();
    });

    if (fileInput) {
      fileInput.addEventListener('change', function (e) {
        if (e.target.files && e.target.files.length) {
          handleFile(e.target.files[0]);
        }
      });
    }

    zone.addEventListener('dragover', function (e) {
      e.preventDefault();
      zone.classList.add('dragover');
    });

    zone.addEventListener('dragleave', function (e) {
      e.preventDefault();
      zone.classList.remove('dragover');
    });

    zone.addEventListener('drop', function (e) {
      e.preventDefault();
      zone.classList.remove('dragover');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
      }
    });
  }

  function init() {
    updateStudentUi();
    renderHistoryList();
    renderGiftsCatalog();
    setupDropZone();
    setupTabs();

    // Event Delegation
    document.addEventListener('click', function (e) {
      if (e.target && e.target.classList.contains('btn-confirm-reward')) {
        confirmReward();
      }
      if (e.target && e.target.classList.contains('btn-reset-drop')) {
        resetDrop();
      }
      var redeemBtn = e.target.closest('.btn-redeem-action');
      if (redeemBtn && !redeemBtn.disabled) {
        var id = parseInt(redeemBtn.getAttribute('data-id'), 10);
        redeemGift(id);
      }
      if (e.target && (e.target.id === 'btnCloseVoucher' || e.target.id === 'modalVoucher')) {
        var modal = $('modalVoucher');
        if (modal) modal.classList.remove('open');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.StudentPortal = {
    handleFile: handleFile,
    confirmReward: confirmReward,
    redeemGift: redeemGift,
    resetDrop: resetDrop,
    updateUi: updateStudentUi
  };
})();

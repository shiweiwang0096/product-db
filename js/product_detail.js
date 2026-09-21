/* ===== 产品详情弹窗：历史规模(柱) + 收益率(折线) 双轴叠加，时间段可选 ===== */
(function () {
  "use strict";

  var current = null;       // 当前产品
  var chart = null;
  var startSel = null, endSel = null;

  function fmt(v, d) {
    if (v === null || v === undefined || isNaN(v)) return "-";
    return Number(v).toLocaleString("zh-CN", {
      minimumFractionDigits: d === undefined ? 2 : d,
      maximumFractionDigits: d === undefined ? 2 : d,
    });
  }
  function sign(v) {
    if (v === null || v === undefined || isNaN(v)) return "-";
    return (v > 0 ? "+" : "") + fmt(v);
  }
  function cls(v) {
    if (v === null || v === undefined || isNaN(v)) return "zero";
    return v > 0.000001 ? "pos" : (v < -0.000001 ? "neg" : "zero");
  }
  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s === null || s === undefined ? "" : String(s);
    return d.innerHTML;
  }

  function historyMonths(p) {
    return Object.keys(p.history || {}).sort();
  }

  /* ---------- 弹窗 DOM ---------- */
  function ensureDom() {
    if (document.getElementById("pd-modal")) return;
    var div = document.createElement("div");
    div.id = "pd-modal";
    div.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9999;display:none;align-items:flex-start;justify-content:center;overflow:auto;padding:30px 12px;box-sizing:border-box;";
    div.innerHTML =
      '<div style="background:#fff;border-radius:14px;max-width:960px;width:100%;padding:20px 22px;box-sizing:border-box;position:relative;">'
      + '<button id="pd-close" style="position:absolute;right:14px;top:12px;border:none;background:none;font-size:22px;cursor:pointer;color:#6B7280;line-height:1;">&times;</button>'
      + '<div id="pd-head" style="font-size:17px;font-weight:700;color:#1A1B1C;padding-right:40px;"></div>'
      + '<div id="pd-sub" style="font-size:12px;color:#6B7280;margin-top:6px;display:flex;gap:14px;flex-wrap:wrap;"></div>'
      + '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin:14px 0 8px;">'
      +   '<label style="font-size:12px;color:#6B7280;">起始月份 <select id="pd-start"></select></label>'
      +   '<label style="font-size:12px;color:#6B7280;">结束月份 <select id="pd-end"></select></label>'
      +   '<button id="pd-reset" class="btn ghost" style="font-size:12px;padding:6px 12px;">重置为全部</button>'
      + '</div>'
      + '<div id="pd-chart" style="width:100%;height:340px;"></div>'
      + '<div id="pd-note" style="font-size:12px;color:#6B7280;margin-top:8px;"></div>'
      + '</div>';
    document.body.appendChild(div);

    document.getElementById("pd-close").addEventListener("click", close);
    div.addEventListener("click", function (e) { if (e.target === div) close(); });
    document.getElementById("pd-start").addEventListener("change", render);
    document.getElementById("pd-end").addEventListener("change", render);
    document.getElementById("pd-reset").addEventListener("click", function () {
      if (!current) return;
      fillMonthOptions(current);
      render();
    });
  }

  function fillMonthOptions(p) {
    var months = historyMonths(p);
    startSel = document.getElementById("pd-start");
    endSel = document.getElementById("pd-end");
    var opts = months.map(function (m) {
      return '<option value="' + m + '">' + m + "</option>";
    }).join("");
    startSel.innerHTML = opts;
    endSel.innerHTML = opts;
    if (months.length) {
      startSel.value = months[0];
      endSel.value = months[months.length - 1];
    }
  }

  /* ---------- 渲染 ---------- */
  function render() {
    if (!current || !chart) return;
    var all = historyMonths(current);
    var s = startSel && startSel.value ? startSel.value : (all[0] || "");
    var e = endSel && endSel.value ? endSel.value : (all[all.length - 1] || "");
    if (s > e) { var t = s; s = e; e = t; }
    var months = all.filter(function (m) { return m >= s && m <= e; });

    var scales = [], yields = [];
    months.forEach(function (m) {
      var h = (current.history || {})[m] || {};
      scales.push(h.scale === null || h.scale === undefined ? null : h.scale);
      yields.push(h.yield === null || h.yield === undefined ? null : h.yield);
    });

    chart.setOption({
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        confine: true,
        formatter: function (params) {
          var r = params[0].axisValue + "<br/>";
          params.forEach(function (pp) {
            var v = pp.value;
            if (v === null || v === undefined || isNaN(v)) v = "-";
            else if (pp.seriesName === "规模(亿元)") v = fmt(v);
            else v = (v > 0 ? "+" : "") + fmt(v);
            r += pp.marker + pp.seriesName + ": " + v + "<br/>";
          });
          return r;
        },
      },
      legend: { data: ["规模(亿元)", "收益率(%)"], top: 0 },
      grid: { left: 60, right: 55, top: 34, bottom: 28 },
      xAxis: { type: "category", data: months, axisLabel: { fontSize: 11 } },
      yAxis: [
        { type: "value", name: "规模(亿元)", axisLabel: { fontSize: 11 }, splitLine: { lineStyle: { type: "dashed" } } },
        { type: "value", name: "收益率(%)", axisLabel: { fontSize: 11, formatter: function (v) { return v + "%"; } }, splitLine: { show: false } },
      ],
      series: [
        {
          name: "规模(亿元)", type: "bar", data: scales, yAxisIndex: 0,
          itemStyle: { color: "#2F6FED", borderRadius: [5, 5, 0, 0] },
          barMaxWidth: 34,
          label: { show: true, position: "top", fontSize: 10, color: "#555", formatter: function (p) { return p.value === null ? "" : fmt(p.value); }, labelLayout: { hideOverlap: true } },
        },
        {
          name: "收益率(%)", type: "line", data: yields, yAxisIndex: 1,
          smooth: true, symbolSize: 6, lineStyle: { width: 2.5 },
          itemStyle: { color: "#E1A93C" },
          label: { show: true, position: "top", fontSize: 10, color: "#B7791F", formatter: function (p) { return p.value === null ? "" : sign(p.value); }, labelLayout: { hideOverlap: true } },
        },
      ],
    });
    var hasScale = scales.some(function (v) { return v !== null; });
    var hasYield = yields.some(function (v) { return v !== null; });
    document.getElementById("pd-note").textContent =
      "蓝色柱 = 期末净资产（规模，亿元） · 橙色线 = 当月收益率（%）" +
      (hasScale ? "" : " · 该时间段暂无规模数据") +
      (hasYield ? "" : " · 该时间段暂无收益数据");
  }

  /* ---------- 打开 / 关闭 ---------- */
  function openProductDetail(p) {
    ensureDom();
    current = p;
    document.getElementById("pd-modal").style.display = "flex";
    document.getElementById("pd-head").textContent = p.name;

    var info = [
      esc(p.type || "-"),
      esc(p.mgr || "-"),
      "成立 " + esc(p.est || "-"),
      "最新规模 " + fmt(p.scale) + " 亿",
      "今年规模变化 " + '<span class="' + cls(p.scale_chg) + '">' + sign(p.scale_chg) + "</span> 亿",
      "今年以来收益 " + '<span class="' + cls(p.yield_ytd) + '">' + sign(p.yield_ytd) + "%</span>",
    ].join('<span style="opacity:0.4;"> | </span>');
    document.getElementById("pd-sub").innerHTML = info;

    fillMonthOptions(p);

    var box = document.getElementById("pd-chart");
    if (chart) { chart.dispose(); chart = null; }
    if (typeof echarts !== "undefined") {
      chart = echarts.init(box);
      render();
      setTimeout(function () { chart && chart.resize(); }, 50);
    } else {
      box.innerHTML = '<div style="color:#6B7280;font-size:13px;padding:20px;">图表库加载失败。</div>';
    }
  }

  function close() {
    document.getElementById("pd-modal").style.display = "none";
    if (chart) { chart.dispose(); chart = null; }
    current = null;
  }

  window.addEventListener("resize", function () {
    if (chart && document.getElementById("pd-modal").style.display !== "none") chart.resize();
  });

  // 全局接口
  window.openProductDetail = openProductDetail;
  window.closeProductDetail = close;
})();

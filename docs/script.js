import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================
//  1️⃣ 替换为你自己的 Supabase 配置
// ============================
const supabaseUrl = "https://gtseeznprlqpbklkfgup.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0c2Vlem5wcmxxcGJrbGtmZ3VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDcwNDAsImV4cCI6MjA3NzkyMzA0MH0.cPPS2UNhRtyJ0CMA7xdzqSd0ZVBwdncVFb0Ho0foJfU";
const supabase = createClient(supabaseUrl, supabaseKey);

// ======= 商品配置（改这里就能改所有商品 & 价格） =======
const PRODUCTS = [
  { id: "work1",  name: "春日",    price: 49, desc: "morino出品必属精品" },
  { id: "work2",     name: "开封府地契", price: 9999, desc: "购买即送开封府尹" },
  { id: "work3", name: "大鹅", price: 88, desc: "不羡仙驰名品牌，居家必备" },
  { id: "work4",     name: "寒姨", price: 99999, desc: "妈你快回来我要啃老" }
];

// ========== 通用小工具 ==========

// 显示当前登录用户（下单页 / 订单页 / 确认页 / 支付页）
function displayUserInfo() {
  const name = localStorage.getItem("name");
  const qq = localStorage.getItem("qq");
  const el = document.getElementById("userInfo");
  if (el && name && qq) {
    el.textContent = `当前用户：${name}（QQ: ${qq}）`;
  }
}
displayUserInfo();

// URL 取参数
function getQueryParam(key) {
  const params = new URLSearchParams(window.location.search);
  return params.get(key);
}

// 待确认订单存取（localStorage）
function setPendingOrder(data) {
  localStorage.setItem("pendingOrder", JSON.stringify(data));
}
function getPendingOrder() {
  const raw = localStorage.getItem("pendingOrder");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// 把 Supabase 返回的时间转成北京时间，给前端显示用
function formatCNTime(t) {
  if (!t) return "—";
  try {
    const d = new Date(t);
    return d.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
  } catch (e) {
    return t || "—";
  }
}


// ========== 下单页：渲染商品列表 ==========

function renderProductList() {
  const container = document.getElementById("productList");
  if (!container) return; // 不是下单页就不渲染

  container.innerHTML = "";
  PRODUCTS.forEach((p) => {
    const row = document.createElement("div");
    row.className = "product-item";
    row.innerHTML = `
      <div class="product-info">
        <div class="product-name">${p.name}</div>
        <div class="product-price">￥${p.price}</div>
        ${p.desc ? `<div class="product-desc">${p.desc}</div>` : ""}
      </div>
      <div class="product-qty">
        <input id="qty_${p.id}" type="number" min="0" value="0">
      </div>
    `;
    container.appendChild(row);
  });
}
// 从 pendingOrder 恢复下单页面的表单（收货信息 + 商品数量）
function restoreOrderFormFromPending() {
  // 不是下单页就不用恢复
  if (!document.getElementById("productList")) return;

  const pending = getPendingOrder();
  if (!pending) return;

  // 收货信息
  const recipientEl = document.getElementById("recipient");
  const phoneEl = document.getElementById("phone");
  const addressEl = document.getElementById("address");
  const remarkEL = document.getElementById("remark");
  
  if (recipientEl) recipientEl.value = pending.recipient || "";
  if (phoneEl) phoneEl.value = pending.phone || "";
  if (addressEl) addressEl.value = pending.address || "";
  if (remarkEL) remarkEL.value = pending.remark || "";


  // 商品数量
  if (pending.items && Array.isArray(pending.items)) {
    pending.items.forEach(it => {
      // 先按 id 找，如果没有 id 就按 name 匹配
      let prod = PRODUCTS.find(p => p.id === it.id);
      if (!prod) {
        prod = PRODUCTS.find(p => p.name === it.name);
      }
      if (!prod) return;
      const input = document.getElementById("qty_" + prod.id);
      if (input) {
        input.value = it.quantity;
      }
    });
  }
}

// ========== 登录 / 注册 ==========

window.loginOrRegister = async function () {
  const nameInput = document.getElementById("name");
  const qqInput = document.getElementById("qq");
  const pwdInput = document.getElementById("password");

  const name = nameInput ? nameInput.value.trim() : "";
  const qq = qqInput ? qqInput.value.trim() : "";
  const password = pwdInput ? pwdInput.value.trim() : "";

  if (!qq || !password) {
    alert("请填写 QQ 和密码！");
    return;
  }

  // 先看这个 QQ 是否已经注册
  const { data: existing, error: selectError } = await supabase
    .from("users")
    .select("*")
    .eq("qq", qq);

  if (selectError) {
    alert("登录失败：" + selectError.message);
    return;
  }

  let userId;
  let finalName;

  if (!existing || existing.length === 0) {
    // 这个 QQ 没出现过：走自动注册
    if (!name) {
      alert("新用户注册时请填写昵称！");
      return;
    }

    const { data, error } = await supabase
      .from("users")
      .insert({
        name,
        qq,
        password
      })
      .select()
      .single();

    if (error) {
      alert("注册失败：" + error.message);
      return;
    }

    userId = data.id;
    finalName = data.name;
    alert("注册成功，已自动登录！");

  } else {
    // 这个 QQ 已经存在：只允许用密码登录
    const user = existing[0];

    if (!user.password) {
      alert("该账号还没有设置密码，请先联系你自己手动在后台给它填一个密码再登录 😅");
      return;
    }

    if (user.password !== password) {
      alert("密码错误，请重试。");
      return;
    }

    userId = user.id;
    finalName = user.name;
    alert("登录成功！");
  }

  // 统一设置本地登录状态
  localStorage.setItem("userId", userId);
  localStorage.setItem("name", finalName || "");
  localStorage.setItem("qq", qq);

  window.location.href = "order.html";
};


// 退出登录
window.logout = function () {
  localStorage.clear();
  alert("已退出登录");
  window.location.href = "index.html";
};

// ========== 第一步：下单页 → 生成待确认订单，跳转确认页 ==========

// ========== 第一步：下单页 → 生成待确认订单，跳转确认页 ==========

window.goToConfirm = function () {
  const userId = localStorage.getItem("userId");
  if (!userId) {
    alert("请先登录！");
    window.location.href = "index.html";
    return;
  }

  const recipientEl = document.getElementById("recipient");
  const phoneEl = document.getElementById("phone");
  const addressEl = document.getElementById("address");
  const remarkEl = document.getElementById("remark"); // 🆕 备注输入框

  const recipient = recipientEl ? recipientEl.value.trim() : "";
  const phone = phoneEl ? phoneEl.value.trim() : "";
  const address = addressEl ? addressEl.value.trim() : "";
  const remark = remarkEl ? remarkEl.value.trim() : ""; // 🆕 买家备注

  const agreeEl = document.getElementById("agreePrivacy");
  if (!agreeEl || !agreeEl.checked) {
    alert("请先勾选“我已阅读并同意隐私说明与购买免责声明”");
    return;
  }
  if (!recipient || !phone || !address) {
    alert("收件人、联系方式和地址必须全部填写！");
    return;
  }

  const items = [];
  let totalAmount = 0;

  PRODUCTS.forEach((p) => {
    const input = document.getElementById("qty_" + p.id);
    if (!input) return;
    const qty = parseInt(input.value || "0", 10);
    if (qty > 0) {
      const subtotal = p.price * qty;
      totalAmount += subtotal;
      items.push({
        id: p.id,
        name: p.name,
        price: p.price,
        quantity: qty,
        subtotal,
      });
    }
  });

  if (items.length === 0) {
    alert("请至少选择一种商品（数量 > 0）");
    return;
  }

  const pending = {
    recipient,
    phone,
    address,
    remark,      // 🆕 把备注也放进待确认订单
    items,
    totalAmount,
  };
  setPendingOrder(pending);

  window.location.href = "confirm.html";
};

// ========== 第二步：确认页展示待确认订单 ==========

window.loadPendingOrder = function () {
  const userId = localStorage.getItem("userId");
  if (!userId) {
    alert("请先登录！");
    window.location.href = "index.html";
    return;
  }

  const pending = getPendingOrder();
  if (!pending) {
    alert("没有找到待确认的订单，请重新填写。");
    window.location.href = "order.html";
    return;
  }

  const shipEl = document.getElementById("confirmShipping");
  const itemsEl = document.getElementById("confirmItems");
  const totalEl = document.getElementById("confirmTotal");

  if (shipEl) {
    shipEl.innerHTML = `
      <h3>收货信息</h3>
      <p>收件人：${pending.recipient}</p>
      <p>联系方式：${pending.phone}</p>
      <p>地址：${pending.address}</p>
      ${
        pending.remark
          ? `<p>备注：${pending.remark}</p>`
          : `<p>备注：无</p>`
      }
    `;
  }

  if (itemsEl) {
    let html = "<h3>商品明细</h3><ul>";
    pending.items.forEach((it) => {
      html += `<li>${it.name} × ${it.quantity} 个，单价 ￥${it.price}，小计 ￥${it.subtotal}</li>`;
    });
    html += "</ul>";
    itemsEl.innerHTML = html;
  }

  if (totalEl) {
    totalEl.textContent = pending.totalAmount.toString();
  }
};

// 返回修改
window.backToEdit = function () {
  window.location.href = "order.html";
};

// ========== 第三步：确认下单 → 真正写入数据库 → 跳支付页 ==========

window.confirmOrder = async function () {
  const userId = localStorage.getItem("userId");
  if (!userId) {
    alert("请先登录！");
    window.location.href = "index.html";
    return;
  }

  const pending = getPendingOrder();
  if (!pending) {
    alert("没有找到待确认的订单，请重新填写。");
    window.location.href = "order.html";
    return;
  }

  const name = localStorage.getItem("name");
  const qq = localStorage.getItem("qq");

  const orderGroup =
    "OG" + Date.now().toString() + Math.floor(Math.random() * 1000);

  // 这里你已经用北京时间写入了
  const now = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });

  // 1）插 orders 主表（一单一行，含总金额）
  const { data: orderRow, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id: userId,
      recipient: pending.recipient,
      phone: pending.phone,
      address: pending.address,
      remark: pending.remark || "",    // 🆕 保存买家备注
      status: "待发货",
      tracking: "",
      payment_status: "未支付",
      pay_method: "",
      order_group: orderGroup,
      login_name: name,
      login_qq: qq,
      main_product: pending.items
        .map((i) => `${i.name}×${i.quantity}`)
        .join("、"),
      total_amount: pending.totalAmount,
      time: now,
    })
    .select()
    .single();

  if (orderError) {
    alert("下单失败：" + orderError.message);
    return;
  }

  const orderId = orderRow.id;

  // 2）插 order_items 明细
  const itemRows = pending.items.map((it) => ({
    order_id: orderId,
    product: it.name,
    quantity: it.quantity,
    unit_price: it.price,
    subtotal: it.subtotal,
  }));

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(itemRows);

  if (itemsError) {
    alert("主订单已创建，但明细保存失败：" + itemsError.message);
    // 不 return，让订单继续进入支付流程
  }

  // 清掉 pending，防止重复提交
  localStorage.removeItem("pendingOrder");

  window.location.href =
    "success.html?og=" + encodeURIComponent(orderGroup);
};

// ========== 支付页：加载订单汇总 ==========

window.loadOrderSummary = async function () {
  const userId = localStorage.getItem("userId");
  if (!userId) {
    alert("请先登录！");
    window.location.href = "index.html";
    return;
  }

  const og = getQueryParam("og");
  if (!og) {
    alert("缺少订单编号参数！");
    return;
  }

  // 1）查主订单
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .eq("order_group", og)
    .single();

  if (orderErr) {
    alert("加载订单失败：" + orderErr.message);
    return;
  }

  // 2）查明细
  const { data: items, error: itemsErr } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", order.id);

  if (itemsErr) {
    alert("加载订单明细失败：" + itemsErr.message);
    return;
  }

  let total = Number(order.total_amount || 0);
  if (!total && items && items.length > 0) {
    total = items.reduce(
      (sum, it) => sum + Number(it.subtotal || 0),
      0
    );
  }

  let detailsHtml = "<h3>订单明细</h3><ul>";
  (items || []).forEach((it) => {
    const unit = Number(it.unit_price || 0);
    const sub = Number(it.subtotal || 0);
    detailsHtml += `<li>${it.product} × ${it.quantity} 个，单价 ￥${unit}，小计 ￥${sub}</li>`;
  });
  detailsHtml += "</ul>";

  // 🆕 如果有备注，在支付页下面也提示一下
  if (order.remark) {
    detailsHtml += `<p style="margin-top:8px;font-size:12px;color:#666;">买家备注：${order.remark}</p>`;
  }

  const totalEl = document.getElementById("totalAmount");
  const ogEl = document.getElementById("orderGroup");
  const detailsEl = document.getElementById("orderDetails");

  if (totalEl) totalEl.textContent = total.toString();
  if (ogEl) ogEl.textContent = og;
  if (detailsEl) detailsEl.innerHTML = detailsHtml;

  const view = getQueryParam("view");
  if (view === "1") {
    const paySection = document.getElementById("paySection");
    if (paySection) paySection.style.display = "none";
  }
};

// 支付页：确认已付款（设置等待确认支付，跳我的订单）
window.confirmPayment = async function () {
  const userId = localStorage.getItem("userId");
  if (!userId) {
    alert("请先登录！");
    window.location.href = "index.html";
    return;
  }

  const og = getQueryParam("og");
  if (!og) {
    alert("缺少订单编号参数！");
    return;
  }

  const payMethodEl = document.getElementById("payMethod");
  const payMethod = payMethodEl ? payMethodEl.value : "";

  const { error } = await supabase
    .from("orders")
    .update({
      payment_status: "等待确认支付",
      pay_method: payMethod,
    })
    .eq("user_id", userId)
    .eq("order_group", og);

  if (error) {
    alert("提交支付信息失败：" + error.message);
  } else {
    alert("已提交支付信息，等待店主确认。");
    window.location.href = "myorders.html";
  }
};

window.loadDetail = async function () {
  const params = new URLSearchParams(window.location.search);
  const orderGroup = params.get("og");
  if (!orderGroup) {
    document.getElementById("orderDetail").innerText = "未找到订单编号。";
    return;
  }

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("order_group", orderGroup)
    .single();

  const box = document.getElementById("orderDetail");

  if (error || !data) {
    box.innerText = "加载订单失败。";
    return;
  }

  // 格式化为北京时间
  function formatCNTime(t) {
    if (!t) return "—";
    try {
      const d = new Date(t);
      return d.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
    } catch {
      return t || "—";
    }
  }

  box.innerHTML = `
    <p><b>订单编号：</b>${data.order_group}</p>
    <p><b>下单时间：</b>${formatCNTime(data.time)}</p>
    <p><b>商品：</b>${data.main_product}</p>
    <p><b>金额：</b>￥${data.total_amount}</p>
    <p><b>收件人：</b>${data.recipient}（${data.phone}）</p>
    <p><b>地址：</b>${data.address}</p>
    <p><b>支付状态：</b>${data.payment_status || "未支付"}</p>
    ${
      data.payment_status === "已支付" || data.paid_at
        ? `<p class="order-extra">支付时间：${formatCNTime(data.paid_at)}</p>`
        : ""
    }
    <p><b>发货状态：</b>${data.status || "待发货"}</p>
    ${
      data.status === "已发货" || data.shipped_at
        ? `<p class="order-extra">发货时间：${formatCNTime(data.shipped_at)}</p>`
        : ""
    }
    ${data.tracking ? `<p><b>快递单号：</b>${data.tracking}</p>` : ""}
    ${data.remark ? `<p><b>买家备注：</b>${data.remark}</p>` : ""}
    ${
      data.admin_reply
        ? `<div class="admin-reply">店主回复：${data.admin_reply}</div>`
        : ""
    }
  `;
};

// ========== 我的订单：每行一单 ==========

window.loadOrders = async function () {
  const userId = localStorage.getItem("userId");
  if (!userId) {
    alert("请先登录！");
    window.location.href = "index.html";
    return;
  }

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .order("time", { ascending: false });

  const list = document.getElementById("ordersList");
  if (!list) return;

  list.innerHTML = "";
  if (error) {
    list.innerHTML = `<li>加载失败：${error.message}</li>`;
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = "<li>暂无订单</li>";
    return;
  }

  data.forEach((o) => {
    const payStatus = o.payment_status || "未支付";
    const payMethod = o.pay_method ? `（${o.pay_method}）` : "";
    const orderNo = o.order_group || o.id;
    const amount =
      o.total_amount != null ? Number(o.total_amount) : null;

    const displayTime = o.time || "";

    list.innerHTML += `
      <li>
        订单编号：${orderNo}<br>
        金额：${amount !== null ? "￥" + amount : "—"}<br>
        收件人：${o.recipient || ""} / 联系方式：${o.phone || ""}<br>
        地址：${o.address || ""}<br>
        发货状态：${o.status || ""}<br>
        支付状态：${payStatus}${payMethod}<br>
        ${o.tracking ? "快递单号：📦 " + o.tracking + "<br>" : ""}
        <small>${displayTime}</small><br>
        <a href="success.html?og=${encodeURIComponent(orderNo)}">查看明细</a>
      </li><hr>`;
  });
};

// ========== 根据当前页面自动加载需要的数据 ==========

const path = window.location.pathname;

if (path.endsWith("order.html")) {
  // 下单页：先画商品，再从 pendingOrder 恢复表单
  renderProductList();
  restoreOrderFormFromPending();
}
if (path.endsWith("confirm.html")) {
  window.loadPendingOrder();
}
if (path.endsWith("success.html")) {
  window.loadOrderSummary();
}
if (path.endsWith("myorders.html")) {
  window.loadOrders();
}
if (path.endsWith("detail.html")) {
  window.loadDetail && window.loadDetail();
}

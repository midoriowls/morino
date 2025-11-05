import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================
//  1️⃣ 替换为你自己的 Supabase 配置
// ============================
const supabaseUrl = "https://gtseeznprlqpbklkfgup.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0c2Vlem5wcmxxcGJrbGtmZ3VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDcwNDAsImV4cCI6MjA3NzkyMzA0MH0.cPPS2UNhRtyJ0CMA7xdzqSd0ZVBwdncVFb0Ho0foJfU";
const supabase = createClient(supabaseUrl, supabaseKey);


// ========== 工具函数 ==========

// 显示当前登录用户
function displayUserInfo() {
  const name = localStorage.getItem("name");
  const qq = localStorage.getItem("qq");
  const el = document.getElementById("userInfo");
  if (el && name && qq) {
    el.textContent = `当前用户：${name}（QQ: ${qq}）`;
  }
}
displayUserInfo();

// 从 URL 获取参数
function getQueryParam(key) {
  const params = new URLSearchParams(window.location.search);
  return params.get(key);
}

// ========== 登录 / 注册 ==========

window.loginOrRegister = async function () {
  const name = (document.getElementById("name") || {}).value?.trim();
  const qq = (document.getElementById("qq") || {}).value?.trim();
  if (!name || !qq) return alert("请输入名字和QQ号！");

  const { data: existing, error: selectError } = await supabase
    .from("users")
    .select("*")
    .eq("name", name)
    .eq("qq", qq);

  if (selectError) return alert("登录失败：" + selectError.message);

  let userId;
  if (existing && existing.length > 0) {
    userId = existing[0].id;
    alert("登录成功！");
  } else {
    const { data, error } = await supabase
      .from("users")
      .insert({ name, qq })
      .select()
      .single();
    if (error) return alert("注册失败：" + error.message);
    userId = data.id;
    alert("注册成功！");
  }

  localStorage.setItem("userId", userId);
  localStorage.setItem("name", name);
  localStorage.setItem("qq", qq);

  window.location.href = "order.html";
};

// 退出登录
window.logout = function () {
  localStorage.clear();
  alert("已退出登录");
  window.location.href = "index.html";
};

// ========== 下单（主表 + 明细表） ==========

window.placeOrder = async function () {
  const userId = localStorage.getItem("userId");
  if (!userId) return alert("请先登录！");

  const recipient = document.getElementById("recipient").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const address = document.getElementById("address").value.trim();

  if (!recipient || !phone || !address) {
    return alert("收件人、联系方式和地址必须全部填写！");
  }

  const qtyTshirt = parseInt(
    document.getElementById("qty_tshirt").value || "0"
  );
  const qtyBag = parseInt(document.getElementById("qty_bag").value || "0");
  const qtySticker = parseInt(
    document.getElementById("qty_sticker").value || "0"
  );
  const qtyCup = parseInt(document.getElementById("qty_cup").value || "0");

  const items = [];
  if (qtyTshirt > 0) items.push({ product: "T恤", quantity: qtyTshirt });
  if (qtyBag > 0) items.push({ product: "帆布袋", quantity: qtyBag });
  if (qtySticker > 0) items.push({ product: "贴纸包", quantity: qtySticker });
  if (qtyCup > 0) items.push({ product: "马克杯", quantity: qtyCup });

  if (items.length === 0) {
    return alert("请至少选择一种商品（数量 > 0）");
  }

  // 计算总金额
  let totalAmount = 0;
  items.forEach((it) => {
    const price = PRICE_MAP[it.product] || 0;
    totalAmount += price * it.quantity;
  });

  const name = localStorage.getItem("name");
  const qq = localStorage.getItem("qq");

  // 生成订单编号（对你和用户都好记）
  const orderGroup =
    "OG" + Date.now().toString() + Math.floor(Math.random() * 1000);
  const now = new Date().toISOString();

  // 1）先插入主订单（orders：一单一行）
  const { data: orderRow, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id: userId,
      recipient,
      phone,
      address,
      status: "待发货",
      tracking: "",
      payment_status: "未支付",
      pay_method: "",
      order_group: orderGroup,
      login_name: name,
      login_qq: qq,
      total_amount: totalAmount,
      time: now,
    })
    .select()
    .single();

  if (orderError) {
    return alert("下单失败：" + orderError.message);
  }

  const orderId = orderRow.id;

  // 2）再插入明细（order_items：每个商品一行）
  const itemRows = items.map((it) => {
    const price = PRICE_MAP[it.product] || 0;
    const subtotal = price * it.quantity;
    return {
      order_id: orderId,
      product: it.product,
      quantity: it.quantity,
      unit_price: price,
      subtotal,
    };
  });

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(itemRows);

  if (itemsError) {
    alert("下单主记录已创建，但明细保存失败：" + itemsError.message);
  }

  // 跳转到成功页，带上订单编号
  window.location.href = "success.html?og=" + encodeURIComponent(orderGroup);
};

// ========== 成功页：加载订单汇总 ==========

window.loadOrderSummary = async function () {
  const userId = localStorage.getItem("userId");
  if (!userId) {
    alert("请先登录！");
    return (window.location.href = "index.html");
  }

  const og = getQueryParam("og");
  if (!og) {
    return alert("缺少订单编号参数！");
  }

  // 1）查主订单（只一行）
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .eq("order_group", og)
    .single();

  if (orderErr) {
    return alert("加载订单失败：" + orderErr.message);
  }

  // 2）查明细
  const { data: items, error: itemsErr } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", order.id);

  if (itemsErr) {
    return alert("加载订单明细失败：" + itemsErr.message);
  }

  // 总金额：优先用数据库里的 total_amount
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

  const totalEl = document.getElementById("totalAmount");
  const ogEl = document.getElementById("orderGroup");
  const detailsEl = document.getElementById("orderDetails");

  if (totalEl) totalEl.textContent = total.toString();
  if (ogEl) ogEl.textContent = og;
  if (detailsEl) detailsEl.innerHTML = detailsHtml;
};

// 成功页：确认支付（设置为等待确认支付）
window.confirmPayment = async function () {
  const userId = localStorage.getItem("userId");
  if (!userId) {
    alert("请先登录！");
    return (window.location.href = "index.html");
  }

  const og = getQueryParam("og");
  if (!og) {
    return alert("缺少订单编号参数！");
  }

  const payMethod = document.getElementById("payMethod").value;

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

// 如果当前页面是 success.html，自动加载汇总信息
if (window.location.pathname.endsWith("success.html")) {
  window.loadOrderSummary();
}

// ========== 我的订单：每行一单，含总金额 ==========

window.loadOrders = async function () {
  const userId = localStorage.getItem("userId");
  if (!userId) {
    alert("请先登录！");
    return (window.location.href = "index.html");
  }

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .order("time", { ascending: false });

  const list = document.getElementById("ordersList");
  list.innerHTML = "";
  if (error) {
    list.innerHTML = `<li>加载失败：${error.message}</li>`;
  } else if (!data || data.length === 0) {
    list.innerHTML = "<li>暂无订单</li>";
  } else {
    data.forEach((o) => {
      const payStatus = o.payment_status || "未支付";
      const payMethod = o.pay_method ? `（${o.pay_method}）` : "";
      const orderNo = o.order_group || o.id;
      const amount = o.total_amount != null ? Number(o.total_amount) : null;
      list.innerHTML += `
        <li>
          订单编号：${orderNo}<br>
          金额：${amount !== null ? "￥" + amount : "—"}<br>
          收件人：${o.recipient || ""} / 联系方式：${o.phone || ""}<br>
          地址：${o.address || ""}<br>
          发货状态：${o.status || ""}<br>
          支付状态：${payStatus}${payMethod}<br>
          ${o.tracking ? "快递单号：📦 " + o.tracking + "<br>" : ""}
          <small>${o.time ? new Date(o.time).toLocaleString() : ""}</small><br>
          <a href="success.html?og=${encodeURIComponent(orderNo)}">查看明细</a>
        </li><hr>`;
    });
  }
};

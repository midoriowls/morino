import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================
//  1️⃣ 替换为你自己的 Supabase 配置
// ============================
const supabaseUrl = "https://gtseeznprlqpbklkfgup.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0c2Vlem5wcmxxcGJrbGtmZ3VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDcwNDAsImV4cCI6MjA3NzkyMzA0MH0.cPPS2UNhRtyJ0CMA7xdzqSd0ZVBwdncVFb0Ho0foJfU";
const supabase = createClient(supabaseUrl, supabaseKey);

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ======= 填入你自己的 Supabase 项目信息 =======
const supabaseUrl = "https://YOUR_PROJECT_ID.supabase.co";
const supabaseKey = "YOUR_PUBLIC_ANON_KEY";
const supabase = createClient(supabaseUrl, supabaseKey);

// 商品价格表（自行修改）
const PRICE_MAP = {
  "T恤": 99,
  "帆布袋": 49,
  "贴纸包": 25,
  "马克杯": 79
};

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

window.loginOrRegister = async function() {
  const name = document.getElementById("name").value.trim();
  const qq = document.getElementById("qq").value.trim();
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
      .select();
    if (error) return alert("注册失败：" + error.message);
    userId = data[0].id;
    alert("注册成功！");
  }

  localStorage.setItem("userId", userId);
  localStorage.setItem("name", name);
  localStorage.setItem("qq", qq);

  window.location.href = "order.html";
};

// 退出登录
window.logout = function() {
  localStorage.clear();
  alert("已退出登录");
  window.location.href = "index.html";
};

// ========== 下单（多品类） ==========

window.placeOrder = async function() {
  const userId = localStorage.getItem("userId");
  if (!userId) return alert("请先登录！");

  const recipient = document.getElementById("recipient").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const address = document.getElementById("address").value.trim();

  if (!recipient || !phone || !address) {
    return alert("收件人、联系方式和地址必须全部填写！");
  }

  const qtyTshirt  = parseInt(document.getElementById("qty_tshirt").value || "0");
  const qtyBag     = parseInt(document.getElementById("qty_bag").value || "0");
  const qtySticker = parseInt(document.getElementById("qty_sticker").value || "0");
  const qtyCup     = parseInt(document.getElementById("qty_cup").value || "0");

  const items = [];
  if (qtyTshirt  > 0) items.push({ product: "T恤",    quantity: qtyTshirt  });
  if (qtyBag     > 0) items.push({ product: "帆布袋",  quantity: qtyBag     });
  if (qtySticker > 0) items.push({ product: "贴纸包",  quantity: qtySticker });
  if (qtyCup     > 0) items.push({ product: "马克杯",  quantity: qtyCup     });

  if (items.length === 0) {
    return alert("请至少选择一种商品（数量 > 0）");
  }

  // 生成本次下单的订单编号（order_group）
  const orderGroup = "OG" + Date.now().toString() + Math.floor(Math.random() * 1000);

  const now = new Date().toISOString();
  const rows = items.map(it => ({
    user_id:  userId,
    product:  it.product,
    quantity: it.quantity,
    recipient,
    phone,
    address,
    status:   "待发货",
    tracking: "",
    payment_status: "未支付",
    pay_method: "",
    order_group: orderGroup,
    login_name: name,
    login_qq:   qq,
    time:     now
  }));

  const { error } = await supabase.from("orders").insert(rows);

  if (error) {
    alert("下单失败：" + error.message);
  } else {
    // 下单成功后跳转到成功页，带上订单编号
    window.location.href = "success.html?og=" + encodeURIComponent(orderGroup);
  }
};

// ========== 成功页：加载订单汇总 ==========

window.loadOrderSummary = async function() {
  const userId = localStorage.getItem("userId");
  if (!userId) {
    alert("请先登录！");
    return (window.location.href = "index.html");
  }

  const og = getQueryParam("og");
  if (!og) {
    return alert("缺少订单编号参数！");
  }

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .eq("order_group", og);

  if (error) {
    return alert("加载订单失败：" + error.message);
  }

  if (!data || data.length === 0) {
    return alert("未找到该订单记录。");
  }

  let total = 0;
  data.forEach(o => {
    const price = PRICE_MAP[o.product] || 0;
    total += price * o.quantity;
  });

  const totalEl = document.getElementById("totalAmount");
  const ogEl = document.getElementById("orderGroup");
  if (totalEl) totalEl.textContent = total.toString();
  if (ogEl) ogEl.textContent = og;
};

// 成功页：确认支付（设置为等待确认支付）
window.confirmPayment = async function() {
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
      pay_method: payMethod
    })
    .eq("user_id", userId)
    .eq("order_group", og);

  if (error) {
    alert("提交支付信息失败：" + error.message);
  } else {
    alert("已提交支付信息，等待店主确认。");
  }
};

// 如果当前页面是 success.html，自动加载汇总信息
if (window.location.pathname.endsWith("success.html")) {
  window.loadOrderSummary();
}

// ========== 我的订单：显示支付状态 ==========

window.loadOrders = async function() {
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
    data.forEach(o => {
      const payStatus = o.payment_status || "未支付";
      const payMethod = o.pay_method ? `（${o.pay_method}）` : "";
      list.innerHTML += `
        <li>
          <b>${o.product}</b> × ${o.quantity}<br>
          📍 ${o.address}<br>
          收件人：${o.recipient || ""} / 联系方式：${o.phone || ""}<br>
          状态：${o.status}<br>
          支付状态：${payStatus}${payMethod}<br>
          ${o.tracking ? "快递单号：📦 " + o.tracking + "<br>" : ""}
          <small>${new Date(o.time).toLocaleString()} | 订单编号：${o.order_group || "-"}</small>
        </li><hr>`;
    });
  }
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================
//  1️⃣ 替换为你自己的 Supabase 配置
// ============================
const supabaseUrl = "https://gtseeznprlqpbklkfgup.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0c2Vlem5wcmxxcGJrbGtmZ3VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDcwNDAsImV4cCI6MjA3NzkyMzA0MH0.cPPS2UNhRtyJ0CMA7xdzqSd0ZVBwdncVFb0Ho0foJfU";
const supabase = createClient(supabaseUrl, supabaseKey);

// 登录或注册
window.loginOrRegister = async function() {
  const name = document.getElementById("name").value.trim();
  const qq = document.getElementById("qq").value.trim();
  if (!name || !qq) return alert("请输入名字和QQ号！");

  const { data: existing } = await supabase
    .from("users")
    .select("*")
    .eq("name", name)
    .eq("qq", qq);

  let userId;
  if (existing.length > 0) {
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

// 显示用户信息（在页面加载时调用）
function displayUserInfo() {
  const name = localStorage.getItem("name");
  const qq = localStorage.getItem("qq");
  const el = document.getElementById("userInfo");
  if (el && name && qq) {
    el.textContent = `当前用户：${name}（QQ: ${qq}）`;
  }
}
displayUserInfo();

// 退出登录
window.logout = function() {
  localStorage.clear();
  alert("已退出登录");
  window.location.href = "index.html";
};

// 下单
window.placeOrder = async function() {
  const userId = localStorage.getItem("userId");
  if (!userId) return alert("请先登录！");
  const product = document.getElementById("product").value;
  const quantity = parseInt(document.getElementById("quantity").value || "1");
  const address = document.getElementById("address").value.trim();

  const { error } = await supabase.from("orders").insert({
    user_id: userId,
    product,
    quantity,
    address,
    status: "待发货",
    tracking: "",
    time: new Date().toISOString()
  });

  if (error) alert("下单失败：" + error.message);
  else alert("下单成功！");
};

// 加载订单
window.loadOrders = async function() {
  const userId = localStorage.getItem("userId");
  if (!userId) return alert("请先登录！");
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .order("time", { ascending: false });

  const list = document.getElementById("ordersList");
  list.innerHTML = "";
  if (error) {
    list.innerHTML = `<li>加载失败：${error.message}</li>`;
  } else if (data.length === 0) {
    list.innerHTML = "<li>暂无订单</li>";
  } else {
    data.forEach(o => {
      list.innerHTML += `
        <li>
          <b>${o.product}</b> × ${o.quantity}<br>
          📍 ${o.address}<br>
          状态：${o.status}
          ${o.tracking ? "📦 " + o.tracking : ""}<br>
          <small>${new Date(o.time).toLocaleString()}</small>
        </li><hr>`;
    });
  }
};

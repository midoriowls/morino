import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================
//  1️⃣ 替换为你自己的 Supabase 配置
// ============================
const supabaseUrl = "https://gtseeznprlqpbklkfgup.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0c2Vlem5wcmxxcGJrbGtmZ3VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDcwNDAsImV4cCI6MjA3NzkyMzA0MH0.cPPS2UNhRtyJ0CMA7xdzqSd0ZVBwdncVFb0Ho0foJfU";
const supabase = createClient(supabaseUrl, supabaseKey);

// 保存用户信息
window.saveUser = function() {
  const name = document.getElementById("name").value.trim();
  const qq = document.getElementById("qq").value.trim();
  if (!name || !qq) return alert("请填写名字和QQ！");
  localStorage.setItem("name", name);
  localStorage.setItem("qq", qq);
  alert("保存成功！");
};

// 提交订单
window.placeOrder = async function() {
  const name = localStorage.getItem("name");
  const qq = localStorage.getItem("qq");
  const product = document.getElementById("product").value;
  const quantity = parseInt(document.getElementById("quantity").value || "1");

  if (!name || !qq) return alert("请先填写名字和QQ！");
  if (quantity <= 0) return alert("数量必须大于0！");

  const { error } = await supabase.from("orders").insert({
    name,
    qq,
    product,
    quantity,
    status: "待发货",
    tracking: "",
    address: "",
    payment: false,
    time: new Date().toISOString()
  });

  if (error) alert("下单失败：" + error.message);
  else alert("下单成功！");
};

// 加载订单
window.loadOrders = async function() {
  const qq = localStorage.getItem("qq");
  if (!qq) return alert("请先填写QQ！");
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("qq", qq)
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
          ${o.product} × ${o.quantity} — ${o.status}
          ${o.tracking ? " 📦 " + o.tracking : ""}
        </li>`;
    });
  }
};

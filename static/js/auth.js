import { API } from './api.js';
import { injectLayout, wireLogout, toast, clearSessionCache } from "./ui.js";

function byId(id){ return document.getElementById(id); }

export async function initLogin(){
  await injectLayout();
  wireLogout();

  const roleSel = byId("loginRole");
  const form = byId("loginForm");
  const labelA = byId("labelA");
  const inputA = byId("inputA");
  const inputB = byId("inputB");

  function syncFields(){
    const role = roleSel.value;
    if (role === "customer") {
      labelA.textContent = "Email";
      inputA.placeholder = "demo@demo.com";
      inputA.type = "email";
    } else {
      labelA.textContent = "Username";
      inputA.placeholder = "admin / staff1";
      inputA.type = "text";
    }
  }
  syncFields();
  roleSel.addEventListener("change", syncFields);

  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const role = roleSel.value;
    const username = inputA.value.trim();
    const password = inputB.value;

    if (!username || !password){
      toast("Missing fields", "Please fill all fields.", "bad");
      return;
    }

    try {
      const result = await API.login(role, username, password);
      if (result.success) {
        clearSessionCache();
        toast("Welcome!", result.user.name, "ok");

        if (result.user.type === "customer") {
          setTimeout(() => window.location.href = "customer.html", 450);
        } else if (result.user.role === "ADMIN") {
          setTimeout(() => window.location.href = "admin.html", 450);
        } else {
          setTimeout(() => window.location.href = "employee.html", 450);
        }
      }
    } catch (e) {
      toast("Login failed", e.message, "bad");
    }
  });
}

export async function initSignup(){
  await injectLayout();
  wireLogout();

  const form = byId("signupForm");
  form.addEventListener("submit", async (e)=>{
    e.preventDefault();

    const data = {
      firstName: byId("firstName").value.trim(),
      lastName: byId("lastName").value.trim(),
      email: byId("email").value.trim(),
      password: byId("password").value,
      phone: byId("phone").value.trim(),
      address: byId("address").value.trim()
    };

    if (!data.firstName || !data.lastName || !data.email || !data.password){
      toast("Missing fields", "Please fill required fields.", "bad");
      return;
    }

    try {
      await API.signup(data);
      toast("Account created", "You can now login.", "ok");
      setTimeout(() => window.location.href = "login.html", 650);
    } catch (e) {
      toast("Signup failed", e.message, "bad");
    }
  });
}
// register.js
// Simple registration for Supervisor / Lecturer + tiny captcha simulation

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("registerForm");
  const msgBox = document.getElementById("messageBox");
  const backToLoginBtn = document.getElementById("backToLogin");

  const fullNameInput = document.getElementById("fullName");
  const emailInput = document.getElementById("email");
  const usernameInput = document.getElementById("regUsername");
  const passInput = document.getElementById("regPassword");
  const pass2Input = document.getElementById("regPassword2");
  const captchaQEl = document.getElementById("captchaQuestion");
  const captchaAnsInput = document.getElementById("captchaAnswer");

  // יצירת captcha פשוט: a + b = ?
  let captchaResult = generateCaptcha();

  function generateCaptcha() {
    const a = getRandomInt(2, 9);
    const b = getRandomInt(1, 9);
    const result = a + b;
    captchaQEl.textContent = `${a} + ${b} = ?`;
    captchaAnsInput.value = "";
    return result;
  }

  function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function showMessage(text, type) {
    msgBox.textContent = text;
    msgBox.classList.remove("hidden");

    msgBox.classList.remove(
      "bg-red-50",
      "border-red-200",
      "text-red-700",
      "bg-emerald-50",
      "border-emerald-200",
      "text-emerald-700"
    );

    if (type === "error") {
      msgBox.classList.add("bg-red-50", "border", "border-red-200", "text-red-700");
    } else {
      msgBox.classList.add("bg-emerald-50", "border", "border-emerald-200", "text-emerald-700");
    }
  }

  // חזרה ללוגין
  backToLoginBtn.addEventListener("click", () => {
    window.location.href = "login.html";
  });

  // טיפול בשליחת טופס
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const fullname = fullNameInput.value.trim();
    const email = emailInput.value.trim();
    const username = usernameInput.value.trim();
    const password = passInput.value;
    const password2 = pass2Input.value;
    const role = getSelectedRole();
    const captchaAnswer = Number(captchaAnsInput.value);

    if (!role) {
      showMessage("Please select a role (Supervisor or Lecturer).", "error");
      return;
    }

    if (password !== password2) {
      showMessage("Passwords do not match.", "error");
      return;
    }

    if (captchaAnswer !== captchaResult) {
      showMessage("Security check failed. Please try again.", "error");
      captchaResult = generateCaptcha();
      return;
    }

    // בדיקה אם username כבר קיים ב-fakeAccounts או במשתמשים שנרשמו
    if (isUsernameTaken(username)) {
      showMessage("This username is already taken. Please choose another one.", "error");
      captchaResult = generateCaptcha();
      return;
    }

    // יצירת משתמש חדש
    const newUser = {
      username,
      password,
      fullname,
      email,
      role
    };

    saveRegisteredUser(newUser);

    showMessage("Account created successfully! Redirecting to login…", "success");

    // אחרי שניה וחצי נחזיר ללוגין
    setTimeout(() => {
      window.location.href = "login.html";
    }, 1500);
  });

  function getSelectedRole() {
    const radios = document.querySelectorAll('input[name="role"]');
    for (const r of radios) {
      if (r.checked) return r.value;
    }
    return null;
  }

  function isUsernameTaken(username) {
    const uname = username.trim();
    if (!uname) return false;

    // בדיקה מול fakeAccounts
    const baseUsers = Array.isArray(window.fakeAccounts) ? window.fakeAccounts : [];
    if (baseUsers.some(u => u.username === uname)) {
      return true;
    }

    // בדיקה מול משתמשים שנרשמו
    const existing = loadRegisteredUsers();
    if (existing.some(u => u.username === uname)) {
      return true;
    }

    return false;
  }

  function loadRegisteredUsers() {
    try {
      const raw = localStorage.getItem("examApp_registeredUsers");
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveRegisteredUser(user) {
    const arr = loadRegisteredUsers();
    arr.push(user);
    localStorage.setItem("examApp_registeredUsers", JSON.stringify(arr));
  }
});

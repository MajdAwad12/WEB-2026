// login.js
// Simple login logic using fakeAccounts from fakeData.js + registered users from localStorage

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const errorBox = document.getElementById("errorMessage");
  const errorText = document.getElementById("errorText");
  const goToRegisterBtn = document.getElementById("goToRegister");

  // ננקה משתמש ישן מהמערכת כשנכנסים למסך לוגין
  localStorage.removeItem("examApp_currentUser");

  // כפתור מעבר ל-register
  if (goToRegisterBtn) {
    goToRegisterBtn.addEventListener("click", () => {
      window.location.href = "register.html";
    });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    const allUsers = getAllUsers(); // fakeAccounts + registered users

    // למצוא משתמש
    const user = allUsers.find(
      acc => acc.username === username && acc.password === password
    );

    if (!user) {
      showError("Invalid username or password. Please try again.");
      shakeForm();
      return;
    }

    const userToStore = {
      username: user.username,
      fullname: user.fullname,
      role: user.role,
      studentId: user.studentId || null
    };

    localStorage.setItem("examApp_currentUser", JSON.stringify(userToStore));

    // הפניה לפי תפקיד (role)
    if (user.role === "student") {
      window.location.href = "studentSummary.html";
    } else {
      window.location.href = "dashboard.html";
    }
  });

  // ---- helpers ----

  function getAllUsers() {
    // 1) משתמשים מה-fakeData.js
    // כאן אנחנו משתמשים ישירות ב-fakeAccounts (כמו שהגדרת ב-fakeData.js)
    const baseUsers = Array.isArray(typeof fakeAccounts !== "undefined" ? fakeAccounts : [])
      ? fakeAccounts
      : [];

    // 2) משתמשים שנרשמו דרך register (נשמרים ב-localStorage)
    let extraUsers = [];
    try {
      const raw = localStorage.getItem("examApp_registeredUsers");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          extraUsers = parsed;
        }
      }
    } catch (err) {
      console.warn("Cannot parse examApp_registeredUsers from localStorage", err);
    }

    return [...baseUsers, ...extraUsers];
  }

  function showError(msg) {
    errorText.textContent = msg;
    errorBox.classList.remove("hidden");
  }

  function shakeForm() {
    const box = document.querySelector(".bg-white\\/95"); // ה-div של הטופס
    if (!box) return;
    box.classList.remove("shake");
    void box.offsetWidth; // לכפות reflow כדי שהאנימציה תרוץ שוב
    box.classList.add("shake");
  }
});

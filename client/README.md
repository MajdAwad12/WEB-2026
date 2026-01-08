# Exam Monitoring App  
**Advanced Web Development – Course Project (Braude College of Engineering)**

---

## 📌 Project Overview

**Exam Monitoring App** is a full-stack web application designed to manage and supervise on-site academic exams in real time.  
The system provides tools for supervisors, lecturers, and administrators to track attendance, manage classrooms, monitor student movements, generate reports, and receive assistance from an AI-powered chatbot during exams.

The project was developed as part of the **Advanced Web Development** course and demonstrates the use of modern web technologies, client–server architecture, database integration, external APIs, and AI services.

---

## 🎯 System Goals

- Provide **real-time exam supervision**
- Track **student attendance and movements**
- Support **multiple roles with different permissions**
- Enable **classroom management and student transfers**
- Generate **reports and statistics**
- Integrate an **AI assistant (GenAI)** to support supervisors
- Demonstrate full **MERN-style architecture**

---

## 👥 User Roles

### 1. Admin
- Manage users
- Create and manage exams
- View system-wide reports and statistics

### 2. Supervisor
- Monitor exam rooms
- Mark attendance (manual / QR scan)
- Track toilet breaks
- Request and approve student transfers
- Report incidents
- Use the AI chatbot during the exam

### 3. Lecturer
- View exam progress
- Access reports and attendance summaries
- Review incidents and violations

### 4. Student
- Login to the system
- View personal exam summary **after the exam only**

---

## 🧩 System Screens & Modules

### 🔐 Authentication
- Login
- Register
- Session-based authentication using cookies
- Role-based access control

---

### 🏠 Dashboard
- Overview of active and past exams
- Key statistics (attendance, incidents, rooms)
- Quick navigation to exam management screens

---

### 📝 Exam Management
- Create exams
- Start / resume exams
- End exams (time-window based)
- Assign classrooms and supervisors

---

### 🪑 Classroom Map
- Visual seat-based classroom layout
- Student status indicators:
  - `not_arrived`
  - `present`
  - `absent`
  - `temporary_out`
  - `moving`
  - `finished`
- Real-time updates
- Seat actions via modal

---

### 📋 Attendance Management
- Manual marking of attendance
- **QR Code scanning** for fast check-in
- Automatic status updates
- Attendance statistics per room

---

### 🚻 Toilet Break Tracking
- Start toilet break
- Live timer during absence
- Return confirmation
- Count and total time per student

---

### 🔁 Student Transfers
- Request transfer to another classroom
- Approve / reject transfer
- Visual “moving” state while transfer is pending
- Full audit of movements

---

### ⚠️ Incident Reporting
- Log violations or unusual events
- Attach student and exam context
- View incident history

---

### 📊 Reports & History
- Exam history view
- Attendance statistics
- Incident summaries
- Charts and analytics
- Export reports:
  - **PDF**
  - **CSV**

---

### 🤖 AI Chatbot (GenAI)
- Powered by **Google Gemini API**
- Features:
  - Exam procedure guidance
  - FAQ answers
  - Supervisor assistance during exam
- Rate-limited and cached
- Demo responses when API key is missing

---

## 🧠 Technologies Used

### Frontend (Client)
- React (Vite)
- React Router
- React Hooks:
  - `useState`
  - `useEffect`
  - `useMemo`
  - `useRef`
- Axios
- Chart.js
- Tailwind CSS

### Backend (Server)
- Node.js
- Express.js
- MongoDB
- Mongoose
- express-session (cookie-based sessions)
- CORS & Helmet
- PDFKit (PDF generation)

### AI & External APIs
- Google Gemini (Generative AI)
- REST API integration
- Async/Await data fetching

---

## 🗂️ Project Structure

├── client/
│ ├── src/
│ │ ├── components/
│ │ ├── pages/
│ │ ├── services/
│ │ ├── App.jsx
│ │ └── main.jsx
│ └── package.json
│
└── README.md
├── server/
  ├── src/
  │ ├── controllers/
  │ ├── routes/
  │ ├── models/
  │ ├── middleware/
  ├── index.js
  └── package.json


---

## ⚙️ Environment Variables

Create a file: `server/.env`

```env
PORT=5000
MONGO_URI=your_mongodb_atlas_connection_string
SESSION_SECRET=replace_with_strong_secret
CLIENT_ORIGIN=http://localhost:5173
NODE_ENV=development

# Gemini AI
GEMINI_API_KEY=your_api_key
GEMINI_MODEL=gemini-2.5-flash
GEMINI_MAX_PER_DAY=20
CHAT_MIN_GAP_MS=800
CHAT_SUMMARIZE_COOLDOWN_MS=300000
CHAT_SUMMARIZE_CACHE_TTL_MS=120000
CHAT_GEMINI_CACHE_TTL_MS=86400000


#Run Serveer
cd server (only if you in the WEB_HW2 Project)
npm install
npm run dev


#Run Client
cd client((only if you in the WEB_HW2 Project))
npm install
npm run dev

http://localhost:5173

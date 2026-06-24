# 🖥️ One Point Solutions — Customer KYC & Rental Agreement System

### 🌐 Live Website: [https://onesol-gamma.vercel.app/](https://onesol-gamma.vercel.app/)


A full-stack web application for managing customer KYC verification and electronics rental agreements. Built for One Point Solutions to streamline the onboarding and rental process with a clean admin dashboard.

---

## 📋 Project Description

One Point Solutions is a KYC (Know Your Customer) and rental management system designed for an electronics rental business. It allows administrators to:

- Register and manage customers with full KYC details
- Upload and verify ID proof documents
- Track rental agreements and device handovers
- Monitor risk flags and customer statuses
- Manage device inventory (available, rented, under repair)
- Export reports as CSV
- Send WhatsApp reminders to pending customers

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 | UI Framework |
| Vite | Build Tool |
| Vanilla CSS | Styling |
| Google Fonts (Inter, Outfit) | Typography |

### Backend
| Technology | Purpose |
|---|---|
| Node.js | Runtime |
| Express.js | REST API Framework |
| MySQL2 | Database Driver |
| Alasql | In-memory DB Fallback |
| dotenv | Environment Variables |
| CORS | Cross-Origin Requests |

### Deployment
| Platform | Service |
|---|---|
| Vercel | Frontend Hosting |
| Render | Backend API Hosting |
| GitHub | Version Control |

---

## 🚀 Installation & Setup

### Prerequisites
- Node.js v18+
- npm v9+
- MySQL 8.0 (optional — falls back to in-memory DB automatically)

### 1. Clone the Repository
```bash
git clone https://github.com/krishtam07/OneSol.git
cd OneSol
```

### 2. Install All Dependencies
```bash
npm install
```
This auto-installs both frontend and backend dependencies.

### 3. Configure Environment Variables
Create `backend/.env`:
```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=onesol_db
PORT=3001
```
> **Note:** If MySQL is not running, the backend automatically falls back to an in-memory database with pre-seeded demo data.

### 4. Run the Application Locally
```bash
npm run dev
```


---

## 🌐 Live Deployment

| Service | URL |
|---|---|
| 🖥️ **Frontend (Vercel)** | [https://onesol-gamma.vercel.app/](https://onesol-gamma.vercel.app/) |
| ⚙️ **Backend API (Render)** | [https://onesol-backend.onrender.com](https://onesol-backend.onrender.com) |
| 🔍 **API Health Check** | [https://onesol-backend.onrender.com/api/health](https://onesol-backend.onrender.com/api/health) |

> **Note:** The backend runs on Render's free tier and may take ~30 seconds to wake up after a period of inactivity.

---

## 📁 Project Structure

```
OneSol/
├── frontend/          # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx    # Main application component
│   │   ├── api.js     # API client (talks to backend)
│   │   └── index.css  # Global styles
│   └── package.json
│
├── backend/           # Node.js + Express backend
│   ├── routes/        # API route handlers
│   ├── db.js          # Database connection (MySQL + alasql fallback)
│   ├── index.js       # Express server entry point
│   ├── schema.sql     # Database schema & seed data
│   └── package.json
│
├── render.yaml        # Render deployment blueprint
├── vercel.json        # Vercel deployment config
└── package.json       # Root scripts
```

---

## 👥 Team

| Name | Role |
|---|---|
| **Shanmukhi** | Full Stack Developer |

---



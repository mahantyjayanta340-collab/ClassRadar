# ClassRadar 📡

> **Smart Academic Routine, Real-Time Class Radar & Notice Portal**  
> Built for B.Tech 1st Year students at ARKA JAIN University.

**ClassRadar** is a lightweight, mobile-first Progressive Web Application (PWA) designed to eliminate the daily hassle of checking static timetable PDFs. It delivers an instant, real-time status of current and upcoming lectures, faculty details, room numbers, and campus announcements with zero loading latency.

---

### ✨ Key Features

* **⚡ Real-Time Class Radar**: Displays the active ongoing lecture, room number, instructor, and a live countdown to the next period.
* **📱 100% Offline-First (PWA)**: Fully functional without an internet connection using Service Workers and local caching.
* **📊 Multi-Section & Lab Group Support**: Covers complete routines for Sections A, B, C, D, E, and F&G, including lab cohort splits (e.g., E1/E2, D1/D2).
* **☁️ Cloud Sync via Google Sheets JSON API**: Synchronizes live announcements, emergency circulars, and holiday suspensions directly from Google Sheets without requiring external API keys.
* **🌴 Automatic Holiday Suppression**: Detects scheduled university off-days and Sundays, cleanly replacing class timers with holiday notices and muting reminders.
* **🔔 Smart Period Reminders**: Configurable audio-visual alerts prior to lecture start times.

---

### 🛠️ Tech Stack

* **Frontend**: Vanilla HTML5, Modern CSS3 (CSS Variables, Flexbox, Grid), ES6+ JavaScript
* **PWA & Offline**: Service Worker API, Web App Manifest, CacheStorage API, `localStorage`
* **Data Layer**: Google Sheets Visualization API (`tqx=out:json`)
* **Deployment**: GitHub Pages

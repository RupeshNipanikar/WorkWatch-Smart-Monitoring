# WorkWatch AI — Smart Work Monitoring

A web-based work monitoring platform designed to help teams manage work sessions, track productivity, monitor tasks, and organize workplace activities through a centralized dashboard.

## 🚀 Live Demo

- **Live Application:** `https://work-watch-smart-monitoring.vercel.app/`
- **Demo Admin Name:** `Admin`
- **Demo Admin Password:** `123456`

- **Demo Employee Name:** `Demo Employee`
- **Demo Employee Password:** `123456`

> **Note:** Access Admin Account First to create your own employee from Employee tab, so that you can sign in as an employee to explore employee Panel.


> **Note:** The demo credentials are intended for recruiters, reviewers, and friends to explore the application. Please use the demo account rather than entering personal information.

## 📌 Overview

WorkWatch AI is a full-stack web application built to demonstrate modern web development, database integration, authentication, and dashboard-based workflows. It brings work monitoring and team management features into one interface.

## ✨ Features

- **Authentication:** Login interface for accessing the application.
- **Dashboard:** Centralized view of work-related information.
- **Work Session Monitoring:** Interface for tracking work sessions.
- **Task Management:** Organize and monitor tasks.
- **Alerts:** Display work-related notifications and alerts.
- **Team Management:** Support for team and user-related workflows.
- **Leave Management:** Manage leave requests.
- **Messaging:** Workplace communication features.
- **Support Tickets:** Organize support requests.
- **Payment Interface:** Demonstration of payment-related workflows, if enabled.

*Features may depend on the current implementation and demo account permissions.*

## 🛠️ Tech Stack

- **Frontend:** React, Vite, JavaScript
- **Backend / Database Services:** Supabase
- **Authentication:** Supabase Authentication
- **Database:** PostgreSQL through Supabase
- **Deployment:** Vercel
- **Version Control:** Git and GitHub

## 🖥️ Run Locally

### Prerequisites

- Node.js and npm
- A Supabase project
- Git

### 1. Clone the repository

```bash
git clone https://github.com/RupeshNipanikar/WorkWatch-Smart-Monitoring.git
cd WorkWatch-Smart-Monitoring
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project's root directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_publishable_key
```

Replace the example values with your own Supabase project URL and publishable key.

**Security:** Never commit your `.env` file or expose your Supabase secret/service-role key in frontend code.

### 4. Start the development server

```bash
npm run dev
```

Open the local URL shown in your terminal, typically `http://localhost:5173`.

### 5. Build for production

```bash
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

## 🌐 Deployment

The application can be deployed using Vercel.

1. Import the GitHub repository into Vercel.
2. Select Vite as the framework if it is not detected automatically.
3. Configure the required Supabase environment variables in Vercel.
4. Deploy the project.
5. Redeploy after changing environment variables if required.

## 🔐 Security Notes

- Keep private credentials out of the repository.
- Use Supabase Row Level Security (RLS) to protect database records.
- Restrict user access according to roles and permissions.
- Use fictional data for the public demo.
- Never grant administrative privileges to a public demo account.

## 🎯 Project Goals

This project demonstrates practical experience with:

- Building a modern frontend application.
- Integrating Supabase authentication and database services.
- Working with environment variables.
- Developing dashboard-based user interfaces.
- Managing source code with Git and GitHub.
- Deploying a web application to Vercel.

## 👨‍💻 Developer

**Rupesh Nipanikar**

- **GitHub:** [RupeshNipanikar](https://github.com/RupeshNipanikar)
- **LinkedIn:** [Rupesh Nipanikar](https://www.linkedin.com/in/rupesh-nipanikar/)

## 📄 License

This project is licensed under the [MIT License](LICENSE).
See the [LICENSE](LICENSE) file for the full license text.

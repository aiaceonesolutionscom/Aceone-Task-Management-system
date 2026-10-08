# AceOne Solutions — Enterprise Task Management & Collaboration Platform

A production-grade, database-driven internal task management, collaborative submission, visual review, approval, and daily reporting platform built for AceOne Solutions. Designed to completely replace fragmented WhatsApp workflows with structured, auditable, enterprise-grade operations.

---

## 🌟 Core Architecture & Key Pillars

1. **Zero Hardcoded Hierarchy (100% Database-Driven)**
   - No hardcoded departments, managers, roles, or approval flows.
   - Dynamic Categories (Departments) with custom prefix codes (e.g. `DES`, `DEV`, `SALES`, `ACC`).
   - Granular RBAC + User-level Permission Overrides (Grant / Deny).
   - Three-dimensional Operational Scopes:
     - **Category Scope**: Which departments a user can view.
     - **Assignment Scope**: Which departments a user has authority to assign work in.
     - **Approval Scope**: Which departments a user has authority to review/approve work in.

2. **WhatsApp Workflow Replacement (Delivery & Revision State Machine)**
   - **Delivery Tracking**: Real-time status badges (*Sent* → *Delivered* → *Seen*) tracking when assignees open and view tasks.
   - **Iterative Task Submissions**: Work iterations are stored as sequential versions (**V1, V2, V3...**) under the **same task entity**. No duplicate or confusing spin-off tasks.
   - **Dynamic Approval Rules**: Per-category configurable approval modes:
     - `ANY_ONE`: First authorized reviewer's approval finalizes the task.
     - `ALL_REQUIRED`: Every designated reviewer must sign off before the task is marked as Approved.
   - **Integrated Discussion & Mentions**: Task-specific comment feeds supporting `@name` tagging and automated in-app alerts.

3. **High-Resolution Visual Annotation Studio**
   - Pure client-side SVG/HTML5 canvas image markup and pin review.
   - Normalized relative coordinates (`0.0` to `1.0`), ensuring pinpoint feedback across all screen sizes and resolutions.
   - Direct change-request linkage to pin comments.

4. **Zero-Filesystem Database Binary Storage (`BYTEA`)**
   - Optimized for shared cPanel hosting where local file access might be volatile or ephemeral.
   - All assets, deliverables, and attachments are securely stored in PostgreSQL using `BYTEA` chunks with SHA-256 integrity verification.
   - High-performance streaming endpoint (`/api/files/[fileId]`) with strict authorization validation.

5. **Dynamic Category Custom Fields**
   - Create and bind arbitrary data fields (`TEXT`, `NUMBER`, `DATE`, `SELECT`, `BOOLEAN`, `URL`) to specific categories.
   - Seamlessly captured during task creation, review, and daily reporting.

6. **Automated End-of-Day Daily Reporting**
   - Departmental daily log submissions capturing tasks worked, blocker summaries, and dynamic department metrics.
   - Managerial sign-off and review workflows.

---

## 🛠️ Technology Stack

- **Framework**: Next.js 16 (App Router, Server Actions, Standalone Build)
- **Language**: TypeScript 5+ (Strict Mode)
- **Database ORM**: Prisma ORM 7 with PostgreSQL adapter
- **Database Engine**: PostgreSQL 14+ (Local dev / cPanel remote)
- **Styling**: Tailwind CSS v4, Lucide Icons, Radix UI primitives
- **Auth & Security**: Stateless JWT HTTP-only signed cookies, salt-hashed passwords via `bcryptjs`, and scoped access-control matrices
- **Testing**: Vitest with unit test suites for Rate-Limiting, Password Hashing, RBAC Permissions, Authorization Scopes, and Workflow Business Rules

---

## 🚀 Local Development Setup

### 1. Prerequisites
- Node.js 20 LTS or higher
- PostgreSQL running locally or accessible remotely
- npm, pnpm, or yarn

### 2. Environment Configuration
Create a `.env` file in the project root:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/aceone_dev?schema=public"
JWT_SECRET="your-super-secure-production-jwt-secret-min-32-chars"
NODE_ENV="development"
PORT="3007"
NEXT_PUBLIC_APP_URL="http://localhost:3007"
```

### 3. Database Migration & Initialization
Apply the complete AceOne schema and triggers:

```bash
# Push Prisma schema and custom triggers
npm run db:migrate:aceone

# (Optional) Seed initial system administrator
npm run db:seed:dev
```

### 4. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3007](http://localhost:3007) in your browser.

### 5. Running Tests & Quality Verification
```bash
# Run unit test suites
npm test

# Run strict TypeScript typechecking
npm run typecheck

# Verify production build
npm run build
```

---

## 📦 cPanel Node.js Deployment Guide

AceOne is engineered specifically to run smoothly on shared cPanel hosting with CloudLinux **"Setup Node.js App"** (Phusion Passenger or LiteSpeed WebADC).

### Key Architectural Optimizations for cPanel:
- **Standalone Build**: Configured via `next.config.ts` (`output: "standalone"`).
- **Single-Core Resource Restraint**: `experimental: { cpus: 1 }` prevents process limit (`EAGAIN`) issues on shared CPU allocations.
- **Universal Socket / Port Bridge (`server.js`)**: Automatically detects whether cPanel is running via Passenger (`PORT`) or LiteSpeed (`LSNODE_SOCKET` Unix Domain Socket).
- **Zero Native C++ Compilations**: All dependencies are 100% pure JavaScript (no `sharp`, no `node-canvas`, no native `bcrypt`).

### Deployment Steps:

1. **Build the Standalone Bundle Locally or in CI**:
   ```bash
   npm run build
   ```
   The `postbuild` hook will automatically copy `.next/static` and `public` into `.next/standalone`.

2. **Files to Upload to cPanel**:
   Upload the contents of the root application directory including:
   - `.next/standalone` contents (or upload the complete project with `.next`)
   - `server.js` (The universal cPanel entry point)
   - `prisma/` folder and `package.json`
   - `.env` file configured with your cPanel PostgreSQL credentials

3. **cPanel Node.js App Configuration**:
   - In cPanel, navigate to **Setup Node.js App**.
   - Create Application:
     - **Node.js version**: 20.x or 22.x
     - **Application mode**: `Production`
     - **Application root**: Path to your uploaded project
     - **Application startup file**: `server.js`
   - In **Environment Variables**, add:
     - `NODE_ENV` = `production`
     - `DATABASE_URL` = `postgresql://cpanel_user:cpanel_pass@localhost:5432/cpanel_dbname?schema=public`
     - `JWT_SECRET` = `(your generated 32+ character key)`
   - Click **Save** and then click **Run NPM Install** (or install dependencies via SSH terminal).
   - Click **Restart Application**.

---

## 🔒 Security & RBAC Model

- **System Roles**: Can be designated as `isSystem: true` (e.g. Super Admin) for automatic global bypass.
- **Custom Dynamic Roles**: Fully customizable permission matrix (Create Task, Assign Task, Approve Task, View Reports, Manage Settings, etc.).
- **Per-User Scopes**: Explicit list of departments a user can assign or approve in.
- **Per-User Overrides**: Granular `GRANT` or `DENY` rules that override role permissions without requiring a new role.

---

## 📄 License
Internal proprietary software for AceOne Solutions. All rights reserved.

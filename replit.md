# Ecomoving CRM

## Overview

This is a CRM (Customer Relationship Management) application for Ecomoving, a Chilean business. The system manages accounts (cuentas), contacts (contactos), quotations (cotizaciones), and sales (ventas). It's built as a full-stack TypeScript application with a React frontend and Express backend, using Supabase as the primary database.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: React Router DOM for client-side navigation
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom theme variables
- **Build Tool**: Vite

The frontend follows a page-based structure under `client/src/pages/` with dedicated folders for each domain entity (cuentas, contactos, cotizaciones, ventas). The application uses a collapsible sidebar layout for navigation.

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM configured for PostgreSQL
- **AI Integration**: Google Gemini AI for invoice scanning functionality
- **File Handling**: Multer for file uploads

The backend serves as an API layer with routes defined in `server/routes.ts`. In development, Vite middleware is used for HMR; in production, static files are served from the built output.

### Data Storage Solutions
- **Primary Database**: Supabase (PostgreSQL)
- **Client Connection**: Supabase JavaScript client (`@supabase/supabase-js`)
- **Schema Definition**: Drizzle ORM schema in `shared/schema.ts`

The application connects to Supabase directly from the frontend for CRUD operations on business entities. The backend uses PostgreSQL through Drizzle for any server-side database operations.

### Key Domain Entities
1. **Cuentas (Accounts)**: Business accounts with RUT, sector, contact info
2. **Contactos (Contacts)**: Individual contacts linked to accounts
3. **Cotizaciones (Quotations)**: Quotes with items, subcosts, margins, and workflow states
4. **Ventas (Sales)**: Sales/invoice tracking with payment status

### Quotation State Management
Quotation states are calculated dynamically based on document fields (`nro_oc`, `nro_guia`, `nro_factura`, `pagada`) through the `calcularEstadoCotizacion` function in `client/src/cotizacionEstado.tsx`.

## External Dependencies

### Database
- **Supabase**: Primary database and authentication platform
  - Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  - Tables: `cuentas`, `contactos`, `cotizaciones` (see `SUPABASE_SETUP.md` for schema)

### AI Services
- **Google Gemini AI**: Used for invoice OCR/scanning
  - Environment variables: `AI_INTEGRATIONS_GEMINI_API_KEY`, `AI_INTEGRATIONS_GEMINI_BASE_URL`
  - Endpoint: `/api/scan-invoice`

### Build & Development
- **Drizzle Kit**: Database migrations via `drizzle-kit push`
- **esbuild**: Server bundling for production
- **Vite plugins**: Replit-specific plugins for development (cartographer, dev-banner)
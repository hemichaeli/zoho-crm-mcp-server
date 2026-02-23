# Zoho CRM MCP Server

A comprehensive Model Context Protocol (MCP) server for Zoho CRM, providing full API coverage with 55+ tools for complete CRM management through Claude AI.

## Features

### Records Management (12 tools)
- **CRUD Operations**: Get, Create, Update, Upsert, Delete records in any module
- **Search**: Criteria-based, email, phone, and full-text search
- **COQL Queries**: SQL-like queries using CRM Object Query Language
- **Lead Conversion**: Convert leads to contacts/accounts/deals
- **Mass Update**: Bulk update records with same field values
- **Deleted Records**: Retrieve deleted/recycled records
- **Record Count**: Get counts with optional filtering

### Metadata and Settings (16 tools)
- Modules, Fields, Layouts, Custom Views, Related Lists
- Roles, Profiles, Territories, Pipelines
- Scoring Rules, Wizards, Assignment Rules

### Related Records and Notes (8 tools)
- Related Records: Get, update, delink
- Notes: Full CRUD
- Attachments: List and delete

### Users and Organization (7 tools)
- Users: List, create, update, delete, search
- Organization details

### Tags (6 tools)
- Tag Management: Create, update, delete
- Tag Records: Add/remove tags from records

### Advanced Operations (15+ tools)
- Blueprint transitions, Bulk read/write, Notifications
- Timeline, Activities, Email, Record Locking/Sharing
- Composite API, Approvals, Owner Transfer, Currencies

## Setup

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ZOHO_ACCESS_TOKEN` | OAuth access token | Yes |
| `ZOHO_REFRESH_TOKEN` | OAuth refresh token | Yes |
| `ZOHO_CLIENT_ID` | API client ID | Yes |
| `ZOHO_CLIENT_SECRET` | API client secret | Yes |
| `ZOHO_API_DOMAIN` | API domain (default: `https://www.zohoapis.com`) | No |
| `ZOHO_ACCOUNTS_DOMAIN` | Accounts domain (default: `https://accounts.zoho.com`) | No |
| `PORT` | Server port (default: 3000) | No |
| `TRANSPORT` | Transport type: `http` or `stdio` (default: `http`) | No |

### Regional Domains
- US: zohoapis.com / accounts.zoho.com
- EU: zohoapis.eu / accounts.zoho.eu
- India: zohoapis.in / accounts.zoho.in
- Australia: zohoapis.com.au / accounts.zoho.com.au
- Japan: zohoapis.jp / accounts.zoho.jp

## Quick Start

```bash
npm install
npm run build
npm start
```

## Docker

```bash
docker build -t zoho-crm-mcp-server .
docker run -p 3000:3000 -e ZOHO_ACCESS_TOKEN=... -e ZOHO_REFRESH_TOKEN=... -e ZOHO_CLIENT_ID=... -e ZOHO_CLIENT_SECRET=... zoho-crm-mcp-server
```

## Endpoints

- `GET /health` - Health check
- `POST /mcp` - Streamable HTTP MCP
- `GET /sse` - SSE endpoint for MCP
- `POST /messages` - Legacy message handler

## License
MIT

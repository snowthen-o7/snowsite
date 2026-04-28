# SnowSite Infrastructure Documentation

> **Last Updated**: 2026-03-25
> **Maintainer**: Engineering Team
> **Review Frequency**: Monthly or after major infrastructure changes

---

## Overview

**SnowSite** - Personal portfolio and blog site

**Tech Stack**:
- **Framework:** Astro
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Content:** Markdown / MDX
- **Hosting:** Vercel

**AWS Account**: `282128795857`
**Primary Region**: `us-east-2` (Ohio)

---

## AWS Infrastructure

⚠️ **Status**: To be documented when AWS resources are provisioned.

**Action Items**:
- [ ] Document S3 buckets if file storage is needed
- [ ] Configure CloudFront for CDN (if applicable)
- [ ] Set up IAM users with least-privilege access

---

## Database

**Database**: Upstash Redis (used by Webhook Inspector)

---

## Authentication

**Status**: Not applicable - This project does not require user authentication.

---

## Environment Variables

### Development
```bash
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Production
```bash
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://alexdiaz.me
```

---

## Deployment Architecture

**Hosting**: Vercel

**Domain**: `alexdiaz.me`

---

## Cost Management

**Total Estimated Monthly Cost**: TBD (to be calculated when infrastructure is provisioned)

---

## Security

**Best Practices**:
- ✅ All secrets in environment variables
- ✅ HTTPS only
- ⚠️ TODO: Configure security headers
- ⚠️ TODO: Implement rate limiting

---

## Maintenance Checklist

### Monthly
- [ ] **Review and update this document**
- [ ] Check costs and optimize
- [ ] Update dependencies

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-01-26 | Initial infrastructure documentation created | Engineering Team |
| 2026-03-25 | Updated production URL, hosting, and database details | Engineering Team |

---

*This document should be reviewed and updated monthly or after any major infrastructure changes.*

# Quick Fix: Apply Prisma Migrations

## The Issue
Your authentication routes are correctly written but reference database fields that haven't been created yet. The `prisma/schema.prisma` file has all the fields, but they need to be migrated to your PostgreSQL database.

## Quick Fix (5 minutes)

### Step 1: Set DATABASE_URL
Create or update `.env.local` in `frankstat_site/` directory:

```env
DATABASE_URL=postgresql://user:password@host:5432/frankstat
JWT_SECRET=your-super-secure-secret-key-at-least-32-characters-long
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Replace `user`, `password`, `host` with your actual PostgreSQL credentials.

### Step 2: Run Migration
```bash
cd frankstat_site
npx prisma migrate dev --name "add_auth_fields"
```

This will:
- ✅ Create/update the User table with `isActive`, `lastLoginAt`, `verifyToken`, `resetToken`, etc.
- ✅ Create the AuditLog table
- ✅ Regenerate Prisma client types
- ✅ All TypeScript errors will be resolved

### Step 3: Verify
```bash
npx prisma studio
```

You should see the `User` table with all auth fields.

## If Database Doesn't Exist Yet
```bash
cd frankstat_site
npx prisma db push
```

This will:
- Create the entire database from scratch
- Apply all schema changes
- Ready for testing

## After Migration: Test Login
1. Start dev server: `npm run dev`
2. Visit `http://localhost:3000/signup`
3. Create account with:
   - Full Name: `Lee Steve`
   - Email: `test@example.com`
   - Password: `SecurePass123`
4. Verify email (check console for verification link in dev mode)
5. Login and see **LS** in the navbar circle ✅

## Troubleshooting

**Error: "database does not exist"**
```bash
createdb frankstat
npx prisma db push
```

**Error: "permission denied"**
- Check PostgreSQL user has `CREATEDB` privilege
- Or create DB manually and set correct `DATABASE_URL`

**Error: "no password supplied"**
- Ensure `DATABASE_URL` includes credentials: `postgresql://user:password@host:5432/frankstat`

**Still getting TypeScript errors after migration?**
```bash
npx prisma generate
npx tsc --noEmit
```

That's it! Your auth system will be fully functional.

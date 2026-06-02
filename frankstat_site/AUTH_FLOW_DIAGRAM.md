# Frankstat Authentication Flow Diagram

## User Registration & Verification

```
┌─────────────────────────────────────────────────────────────┐
│                  User Registration                          │
└─────────────────────────────────────────────────────────────┘

1. User fills signup form → POST /api/auth/register
   {
     fullName: "Lee Steve",
     email: "lee@example.com",
     phone: "0712345678",
     password: "SecurePass123"
   }

2. Backend validates input (Zod schema)
   ✓ Email valid & unique
   ✓ Phone valid & unique  
   ✓ Password strong (8+ chars, uppercase, lowercase, number)
   ✓ Full name length (2-100 chars)

3. Hash password with bcrypt (cost 12)

4. Generate 256-bit random verification token
   Example: a3b2c1d4e5f6...0x1y2z (64 hex chars)

5. Create User in DB:
   {
     id: "cuid()",
     fullName: "Lee Steve",
     email: "lee@example.com",
     phone: "254712345678",
     passwordHash: "$2b$12$...",
     isVerified: false,
     verifyToken: "a3b2c1d4e5f6...",
     verifyTokenExpiry: now + 24h,
     role: "CUSTOMER",
     isActive: true,
     createdAt: now
   }

6. Send verification email (async, non-blocking)
   Subject: "Verify your Frankstat account"
   Content: Click link or copy:
   http://localhost:3000/api/auth/verify-email?token=a3b2c1d4e5f6...

7. Response: 201 Created
   {
     ok: true,
     message: "Account created. Check email to verify."
   }

8. User receives email → Clicks verification link
   GET /api/auth/verify-email?token=a3b2c1d4e5f6...

9. Backend validates token:
   ✓ Token found in DB (findUnique where { verifyToken })
   ✓ Not expired (verifyTokenExpiry > now)
   ✓ User not already verified (idempotent check)

10. Update User in DB:
    {
      isVerified: true,
      verifyToken: null,        ← Cleared (one-time use)
      verifyTokenExpiry: null
    }

11. Write AuditLog:
    {
      userId: "...",
      action: "EMAIL_VERIFIED",
      entity: "User",
      entityId: "...",
      ipAddress: "...",
      createdAt: now
    }

12. Response: 200 OK
    {
      ok: true,
      message: "Email verified successfully! You can now sign in."
    }

```

## User Login & Session

```
┌─────────────────────────────────────────────────────────────┐
│                       User Login                            │
└─────────────────────────────────────────────────────────────┘

1. User enters credentials → POST /api/auth/login
   {
     email: "lee@example.com",
     password: "SecurePass123"
   }

2. Backend validates input (Zod schema)

3. Look up User by email (select limited fields only)
   SELECT id, fullName, email, phone, passwordHash, 
           isVerified, isActive, role FROM users
   WHERE email = 'lee@example.com'

4. If user not found:
   - Run dummy bcrypt.compare() [timing attack prevention]
   - Response: 401 "Incorrect email or password."

5. Verify password:
   bcrypt.compare("SecurePass123", "$2b$12$...")
   
   ✓ If match → continue
   ✗ If mismatch → write failed AuditLog + 401

6. Check email verified:
   if (!user.isVerified) {
     Response: 403 "Please verify your email before logging in."
     Frontend shows "Resend verification" link
   }

7. Check account active:
   if (!user.isActive) {
     Response: 401 "Incorrect email or password." [generic]
   }

8. Sign JWT (24-hour expiry):
   Payload: {
     sub: user.id,
     email: user.email,
     role: user.role,
     iat: now,
     exp: now + 86400
   }
   Algorithm: HS256
   Secret: process.env.JWT_SECRET

9. Create HttpOnly cookie:
   fs_token=<JWT_STRING>
   Max-Age=86400
   Path=/
   HttpOnly
   SameSite=Lax
   Secure (in production)

10. Update User:
    {
      lastLoginAt: now
    }

11. Write AuditLog:
    {
      userId: user.id,
      action: "LOGIN",
      entity: "User",
      entityId: user.id,
      ipAddress: "...",
      createdAt: now
    }

12. Response: 200 OK
    {
      ok: true,
      user: {
        id: user.id,
        fullName: "Lee Steve",
        email: "lee@example.com",
        phone: "254712345678",
        role: "CUSTOMER"
      }
    }
    [Cookie automatically sent to browser]

```

## Frontend Session Check & Display

```
┌─────────────────────────────────────────────────────────────┐
│              Frontend (app/page.tsx)                        │
└─────────────────────────────────────────────────────────────┘

1. On page load, component mounts:
   useEffect(() => {
     fetch("/api/auth/me", { credentials: "include" })
       .then(r => r.json())
       .then(d => setUser(d.user ?? null))
       .catch(() => setUser(null))
       .finally(() => setAuthLoading(false))
   }, [])

2. Browser automatically includes fs_token cookie

3. Backend validates:
   - Read fs_token cookie
   - Verify JWT with HS256
   - Check session.sub is valid & not expired
   - Query User by id
   - Check isActive = true

4. Response (authenticated):
   {
     user: {
       id: "...",
       fullName: "Lee Steve",
       email: "lee@example.com",
       phone: "254712345678",
       isVerified: true,
       isActive: true,
       role: "CUSTOMER",
       createdAt: "2026-05-21T...",
       lastLoginAt: "2026-05-21T..."
     }
   }

5. Frontend renders user menu:
   
   ✓ AUTHENTICATED (user !== null):
   ┌─────────────────┐
   │  LS             │  ← getUserInitials("Lee Steve")
   │ (circular avatar)
   └─────────────────┘
        ↓ (click)
   ┌──────────────────────────┐
   │ Lee Steve                │ (user.fullName)
   │ lee@example.com          │ (user.email)
   ├──────────────────────────┤
   │ 🗂️  My Dashboard         │
   │ 📦 Place Order           │
   ├──────────────────────────┤
   │ 🚪 Sign Out              │
   └──────────────────────────┘

   ✗ NOT AUTHENTICATED (user === null):
   [Sign In] [Sign Up →]

6. Auto-fill order form with phone:
   if (user?.phone) {
     setFormData(f => ({
       ...f,
       mpesa: user.phone.replace(/^(\+?254|0)/, "")
     }))
   }
   // "254712345678" → "712345678"

```

## Password Reset Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   Password Reset                            │
└─────────────────────────────────────────────────────────────┘

1. User clicks "Forgot password?" on login page
   POST /api/auth/forgot-password
   { email: "lee@example.com" }

2. Backend:
   ✓ Finds user by email
   ✓ Always returns 200 (no email enumeration)
   ✗ If not found or inactive → silent success

3. For found users:
   - Generate 256-bit random reset token (64 hex)
   - Set resetTokenExpiry = now + 1 hour
   - Store in DB
   - Send email (async, non-blocking)

4. Email content:
   Subject: "Reset your Frankstat password"
   Link: http://localhost:3000/api/auth/reset-password?token=xyz...
   Expires in: 1 hour

5. User clicks link → password reset form
   Frontend shows:
   [ New Password ]
   [ Confirm Password ]
   [ Reset Password Button ]

6. Submit: POST /api/auth/reset-password
   {
     token: "xyz...",
     password: "NewSecurePass456",
     confirmPassword: "NewSecurePass456"
   }

7. Backend validates:
   ✓ Token format (64 hex chars)
   ✓ Token found in DB (findUnique where { resetToken })
   ✓ Token not expired (resetTokenExpiry > now)
   ✓ User account active
   ✓ New password meets strength requirements

8. Update User:
   {
     passwordHash: bcrypt.hash(newPassword),
     resetToken: null,              ← Cleared (one-time)
     resetTokenExpiry: null,
     updatedAt: now                 ← Touch to invalidate old sessions
   }

9. Write AuditLog:
   {
     userId: user.id,
     action: "PASSWORD_RESET_COMPLETED"
   }

10. Response: 200 OK
    {
      ok: true,
      message: "Password updated. You can now sign in."
    }

11. User logs in with new password

```

## Logout Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        Logout                               │
└─────────────────────────────────────────────────────────────┘

1. User clicks "Sign Out" button
   Frontend: fetch("/api/auth/logout", { method: "POST" })

2. Backend reads session from cookie

3. If authenticated:
   - Write AuditLog: { action: "LOGOUT", userId: session.sub }
   - (fire-and-forget, non-blocking)

4. Clear cookie:
   fs_token=
   Max-Age=0
   Path=/
   HttpOnly
   SameSite=Lax

5. Response: 200 OK
   { ok: true }

6. Frontend:
   - setUser(null)
   - Navbar switches to [Sign In] [Sign Up →]
   - Page auto-refreshes (router.refresh())

```

## Token Lifespans

```
JWT Session Token      → 24 hours
├─ Used for: Logged-in users
├─ Storage: HttpOnly cookie
└─ Renewal: Auto on each page load

Email Verification    → 24 hours
├─ Format: 256-bit random hex
├─ Used: One-time email verification
├─ Resendable: Yes via /api/auth/resend-verification
└─ Cleared: Immediately after use

Password Reset Token  → 1 hour
├─ Format: 256-bit random hex
├─ Used: One-time password reset
├─ Resendable: No (use forgot-password again)
└─ Cleared: Immediately after use
```

## Error Handling

```
Generic Errors (never leak user info):
- Login: "Incorrect email or password."
- Registration: "An account with this email already exists."

Specific Errors (help user):
- Login with unverified email: 403 "Please verify your email before logging in."
  └─ Frontend shows: [Resend verification] button

- Password mismatch: "Passwords do not match."
- Weak password: "Password must contain uppercase, lowercase, and number"

Security Events (AuditLog):
- LOGIN_FAILED
- EMAIL_VERIFIED
- PASSWORD_RESET_REQUESTED
- PASSWORD_RESET_COMPLETED
- REGISTER
- LOGIN
- LOGOUT
```

## Security Checkpoints

```
Every request validates:

✓ Request structure (JSON, required fields)
✓ Input types (Zod validation)
✓ Input length (min/max)
✓ Format (email regex, phone regex, password regex)
✓ Uniqueness (email, phone in DB)
✓ Token format (64-char hex)
✓ Token expiry (server-side timestamp)
✓ Account status (active, verified)
✓ Password strength
✓ Session validity (JWT signature + expiry)
✓ Rate limiting (optional, via Upstash)
✓ IP address logging (AuditLog)

Attack Prevention:

- Timing attacks: Dummy bcrypt on missing user
- Email enumeration: Always 200 for password reset
- Token brute-force: 256-bit entropy (2^256 space)
- XSS: HttpOnly cookies, HTML escaped emails
- CSRF: SameSite=Lax cookies
- Replay: Expiring tokens + one-time tokens
- Privilege escalation: Role-based endpoint guards
```

This entire flow is implemented and ready. Just apply the database migrations! 🚀

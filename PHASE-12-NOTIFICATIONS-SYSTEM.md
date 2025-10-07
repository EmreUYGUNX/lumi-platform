# PHASE 12: NOTIFICATIONS SYSTEM

**Status**: 🔄 In Progress
**Priority**: 🔴 High
**Dependencies**: Phase 1 (Express Server), Phase 2 (Database & Prisma), Phase 3 (Authentication & RBAC), Phase 4 (Core APIs), Phase 7 (Auth Orchestration), Phase 10 (Payment Integration)
**Estimated Time**: 7-10 days

---

## 📋 DOCUMENT OVERVIEW

This phase implements a comprehensive multi-channel notification system supporting email, SMS, and push notifications. The system provides transactional notifications (order confirmations, payment receipts), marketing campaigns, real-time alerts, notification preferences management, and delivery tracking with retry mechanisms.

**Key Components**:
- Email notifications with HTML templates (Nodemailer + Handlebars)
- SMS notifications via Twilio (Turkish mobile numbers)
- Web push notifications (Push API, Service Workers)
- Notification queue system (Bull for async processing)
- Notification preferences and opt-out management
- Email template designer for marketing campaigns
- Notification delivery tracking and analytics
- Retry logic with exponential backoff
- Rate limiting to prevent spam

**Technical Stack**:
- Nodemailer (email sending via SMTP)
- Twilio SDK (SMS delivery)
- Web Push (browser push notifications)
- Handlebars (email template engine)
- Bull (notification queue)
- Redis (queue storage, rate limiting)
- MJML (responsive email templates)
- Express.js (notification APIs)
- Next.js (notification preferences UI)

**Performance Standards**:
- **P1**: Email delivery <5s, SMS delivery <3s, push notification <1s
- **P2**: Template rendering <200ms
- Queue processing: 100 notifications/minute
- Retry logic: 3 attempts with exponential backoff (2s, 4s, 8s)

**Quality Standards**:
- **Q2**: All notification API responses follow standard format
- **Q3**: Timestamps consistent across notification logs
- ≥85% test coverage for notification services
- Email deliverability rate >95%
- SMS delivery rate >98%

---

## 🎯 PHASE OBJECTIVES

### Primary Goals
1. **Email System**: Implement transactional email sending with HTML templates
2. **SMS System**: Integrate Twilio for SMS notifications (order updates, OTP)
3. **Push Notifications**: Add web push notifications for real-time alerts
4. **Notification Queue**: Build async processing system with Bull queue
5. **Template Management**: Create reusable email templates with Handlebars/MJML
6. **Preferences Management**: User notification preferences (email, SMS, push opt-in/out)
7. **Delivery Tracking**: Track notification status (pending, sent, delivered, failed, bounced)
8. **Retry Mechanism**: Automatic retry for failed deliveries with exponential backoff

### Success Criteria
- [ ] Email system sends transactional emails (order confirmation, password reset, etc.)
- [ ] SMS system sends order updates to Turkish mobile numbers
- [ ] Push notifications work across Chrome, Firefox, Edge browsers
- [ ] Notification queue processes 100+ notifications/minute
- [ ] Email templates are responsive and render correctly across email clients
- [ ] Users can manage notification preferences (opt-in/opt-out per channel)
- [ ] Failed notifications retry automatically (max 3 attempts)
- [ ] Delivery tracking logs all notification attempts with status
- [ ] ≥85% test coverage for notification services
- [ ] Email deliverability rate >95%, SMS delivery rate >98%

---

## 🎯 CRITICAL REQUIREMENTS

### Performance Requirements (MANDATORY)

**P1: Delivery Speed**
```typescript
// ❌ WRONG: Blocking request with synchronous email sending
await sendEmail(user.email, 'Order Confirmed', orderDetails);
res.json({ success: true, orderId });

// ✅ CORRECT: Async queue processing
await notificationQueue.add('send-email', {
  to: user.email,
  template: 'order-confirmed',
  data: orderDetails
});
res.json({ success: true, orderId }); // Respond immediately

// Email sent asynchronously within 5s
```

**P2: Template Rendering Performance**
```typescript
// ✅ CORRECT: Cache compiled templates
const templateCache = new Map<string, HandlebarsTemplateDelegate>();

const getCompiledTemplate = (templateName: string) => {
  if (templateCache.has(templateName)) {
    return templateCache.get(templateName);
  }

  const templateSource = fs.readFileSync(`templates/${templateName}.hbs`, 'utf-8');
  const compiled = Handlebars.compile(templateSource);
  templateCache.set(templateName, compiled);

  return compiled;
};
```

### Security Requirements (MANDATORY)

**S2: Input Sanitization**
```typescript
// ❌ WRONG: No validation
await sendEmail(req.body.email, req.body.subject, req.body.message);

// ✅ CORRECT: Zod validation
import { z } from 'zod';

const SendEmailSchema = z.object({
  email: z.string().email(),
  subject: z.string().min(1).max(200),
  message: z.string().max(10000)
});

const validated = SendEmailSchema.parse(req.body);
await sendEmail(validated.email, validated.subject, validated.message);
```

**S4: API Keys Protection**
```typescript
// ❌ WRONG: Hardcoded credentials
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  auth: { user: 'noreply@lumi.com', pass: 'password123' }
});

// ✅ CORRECT: Environment variables
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

if (!process.env.SMTP_HOST) {
  throw new Error('SMTP_HOST not configured');
}
```

### Quality Requirements (MANDATORY)

**Q2: Standard API Format**
```typescript
// ❌ WRONG: Inconsistent format
res.json({ sent: true, messageId: 'xyz' });

// ✅ CORRECT: Standard format
res.json({
  success: true,
  data: {
    notificationId: 'notification_xyz',
    status: 'queued',
    channel: 'email'
  },
  meta: {
    timestamp: new Date().toISOString(),
    requestId: req.id
  }
});
```

---

## 🏗️ ARCHITECTURE OVERVIEW

### Directory Structure
```
lumi-platform/
├── packages/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── config/
│   │   │   │   ├── email.config.ts          # Nodemailer setup
│   │   │   │   ├── sms.config.ts            # Twilio setup
│   │   │   │   └── push.config.ts           # Web push setup
│   │   │   ├── routes/
│   │   │   │   ├── notifications.routes.ts  # Notification APIs
│   │   │   │   └── push-subscription.routes.ts # Push subscription
│   │   │   ├── services/
│   │   │   │   ├── email.service.ts         # Email sending logic
│   │   │   │   ├── sms.service.ts           # SMS sending logic
│   │   │   │   ├── push.service.ts          # Push notification logic
│   │   │   │   ├── notification-queue.service.ts # Queue management
│   │   │   │   └── template.service.ts      # Template rendering
│   │   │   ├── jobs/
│   │   │   │   ├── send-email.job.ts        # Email job processor
│   │   │   │   ├── send-sms.job.ts          # SMS job processor
│   │   │   │   └── send-push.job.ts         # Push job processor
│   │   │   ├── templates/
│   │   │   │   ├── email/
│   │   │   │   │   ├── order-confirmed.hbs  # Order confirmation
│   │   │   │   │   ├── password-reset.hbs   # Password reset
│   │   │   │   │   ├── payment-success.hbs  # Payment receipt
│   │   │   │   │   ├── order-shipped.hbs    # Shipping notification
│   │   │   │   │   └── welcome.hbs          # Welcome email
│   │   │   │   └── sms/
│   │   │   │       ├── order-confirmed.txt  # SMS templates
│   │   │   │       └── otp.txt
│   │   │   └── utils/
│   │   │       └── notification-helpers.utils.ts
│   │
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   └── account/
│   │   │   │       └── notifications/
│   │   │   │           └── page.tsx         # Notification preferences
│   │   │   ├── components/
│   │   │   │   └── notifications/
│   │   │   │       ├── NotificationPreferences.tsx
│   │   │   │       ├── PushSubscription.tsx
│   │   │   │       └── NotificationHistory.tsx
│   │   │   ├── hooks/
│   │   │   │   └── usePushNotifications.ts
│   │   │   └── public/
│   │   │       └── service-worker.js        # Push notification worker
```

### Notification Flow Architecture

**Email Flow**:
```
Trigger Event (Order Placed) → Backend Service
                                    ↓
                    Enqueue Email Job (Bull Queue)
                                    ↓
                    Worker Process → Load Template
                                    ↓
                    Render with Handlebars + Data
                                    ↓
                    Send via Nodemailer (SMTP)
                                    ↓
                    Track Delivery Status
                                    ↓
                    Log to Database (NotificationLog)
```

**SMS Flow**:
```
Trigger Event (Order Shipped) → Backend Service
                                    ↓
                    Check User SMS Preferences
                                    ↓
                    Enqueue SMS Job (Bull Queue)
                                    ↓
                    Worker Process → Twilio API
                                    ↓
                    Send SMS to Turkish Mobile Number
                                    ↓
                    Track Delivery (delivered/failed)
                                    ↓
                    Retry on Failure (3 attempts, exponential backoff)
```

**Push Notification Flow**:
```
Trigger Event (New Order) → Backend Service
                                ↓
                Load User Push Subscriptions
                                ↓
            Enqueue Push Jobs for Each Device
                                ↓
            Worker Process → Web Push API
                                ↓
            Send Push to Browser (Chrome/Firefox/Edge)
                                ↓
            Service Worker Displays Notification
                                ↓
            User Clicks → Navigate to Order Detail
```

---

## ✅ IMPLEMENTATION CHECKLIST

### 1. Backend: Email System (32 items)

#### 1.1 Nodemailer Setup (8 items)
- [ ] Install Nodemailer: `npm install nodemailer --save`
- [ ] Install Handlebars: `npm install handlebars --save`
- [ ] Install MJML: `npm install mjml --save`
- [ ] Create `src/config/email.config.ts` with SMTP transporter
- [ ] Add environment variables: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- [ ] Configure SMTP transporter with TLS
- [ ] Add connection health check: verify SMTP connection on startup
- [ ] Test with sandbox SMTP (Mailtrap or similar) in development

#### 1.2 Email Templates (12 items)
- [ ] Create `src/templates/email/` directory
- [ ] Create base layout template: `layout.hbs` (header, footer, styling)
- [ ] Create `order-confirmed.hbs`: order confirmation email
- [ ] Create `payment-success.hbs`: payment receipt email
- [ ] Create `order-shipped.hbs`: shipping notification email
- [ ] Create `order-delivered.hbs`: delivery confirmation email
- [ ] Create `password-reset.hbs`: password reset link email
- [ ] Create `welcome.hbs`: new user welcome email
- [ ] Create `account-verification.hbs`: email verification link
- [ ] Use MJML for responsive email design
- [ ] Add brand colors from deneme.html (B1)
- [ ] Test templates across email clients (Gmail, Outlook, Apple Mail)

#### 1.3 Email Service (12 items)
- [ ] Create `src/services/email.service.ts`
- [ ] Implement `sendEmail(to, subject, template, data)` function
- [ ] Load and compile Handlebars templates with caching
- [ ] Render email HTML with template data
- [ ] Support plain text fallback for email clients without HTML
- [ ] Add email attachments support (PDF invoices, etc.)
- [ ] Implement `sendOrderConfirmationEmail(order)` function
- [ ] Implement `sendPaymentSuccessEmail(payment)` function
- [ ] Implement `sendPasswordResetEmail(user, resetToken)` function
- [ ] Add email validation: verify email format before sending
- [ ] Add rate limiting: max 10 emails/minute per user
- [ ] Log all email sends to database (NotificationLog)

**Example**:
```typescript
// src/config/email.config.ts
import nodemailer from 'nodemailer';

if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
  throw new Error('SMTP configuration missing. Check .env file.');
}

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Health check
export const verifyEmailConnection = async () => {
  try {
    await transporter.verify();
    console.log('SMTP connection verified successfully');
    return { healthy: true };
  } catch (error) {
    console.error('SMTP connection failed:', error);
    return { healthy: false, error: error.message };
  }
};

// src/services/template.service.ts
import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import mjml2html from 'mjml';

const templateCache = new Map<string, HandlebarsTemplateDelegate>();

// Register Handlebars helpers
Handlebars.registerHelper('formatDate', (date: Date) => {
  return new Date(date).toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

Handlebars.registerHelper('formatCurrency', (amount: number) => {
  return `₺${amount.toFixed(2)}`;
});

export const renderEmailTemplate = (templateName: string, data: any): string => {
  // Check cache
  if (templateCache.has(templateName)) {
    const template = templateCache.get(templateName)!;
    return template(data);
  }

  // Load template
  const templatePath = path.join(__dirname, '../templates/email', `${templateName}.hbs`);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Email template not found: ${templateName}`);
  }

  const templateSource = fs.readFileSync(templatePath, 'utf-8');

  // Compile with MJML if needed
  let htmlSource = templateSource;
  if (templateSource.includes('<mjml>')) {
    const mjmlResult = mjml2html(templateSource);
    if (mjmlResult.errors.length > 0) {
      throw new Error(`MJML compilation errors: ${mjmlResult.errors.join(', ')}`);
    }
    htmlSource = mjmlResult.html;
  }

  // Compile with Handlebars
  const compiled = Handlebars.compile(htmlSource);
  templateCache.set(templateName, compiled);

  return compiled(data);
};

// src/services/email.service.ts
import { transporter } from '../config/email.config';
import { renderEmailTemplate } from './template.service';
import prisma from '../config/database';

interface SendEmailParams {
  to: string | string[];
  subject: string;
  template: string;
  data: any;
  attachments?: Array<{ filename: string; path: string }>;
}

export const sendEmail = async (params: SendEmailParams) => {
  const { to, subject, template, data, attachments } = params;

  // Render HTML
  const html = renderEmailTemplate(template, data);

  // Generate plain text fallback (strip HTML tags)
  const text = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

  // Send email
  const info = await transporter.sendMail({
    from: `"Lumi E-commerce" <${process.env.SMTP_FROM}>`,
    to: Array.isArray(to) ? to.join(', ') : to,
    subject,
    html,
    text,
    attachments
  });

  // Log to database
  await prisma.notificationLog.create({
    data: {
      channel: 'email',
      recipient: Array.isArray(to) ? to[0] : to,
      subject,
      template,
      status: 'sent',
      messageId: info.messageId,
      sentAt: new Date()
    }
  });

  return { messageId: info.messageId, status: 'sent' };
};

export const sendOrderConfirmationEmail = async (order: any) => {
  return sendEmail({
    to: order.user.email,
    subject: `Order Confirmation #${order.orderNumber}`,
    template: 'order-confirmed',
    data: {
      userName: order.user.name,
      orderNumber: order.orderNumber,
      orderDate: order.createdAt,
      items: order.items.map((item: any) => ({
        name: item.product.name,
        quantity: item.quantity,
        price: item.price
      })),
      subtotal: order.subtotal,
      shipping: order.shippingCost,
      total: order.total,
      shippingAddress: order.shippingAddress,
      trackingUrl: `${process.env.FRONTEND_URL}/orders/${order.id}`
    }
  });
};

export const sendPasswordResetEmail = async (user: any, resetToken: string) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  return sendEmail({
    to: user.email,
    subject: 'Password Reset Request',
    template: 'password-reset',
    data: {
      userName: user.name,
      resetUrl,
      expiresIn: '1 hour'
    }
  });
};

// templates/email/order-confirmed.hbs
<mjml>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#ffffff" padding="20px">
      <mj-column>
        <mj-text font-size="24px" font-weight="bold" color="#3B82F6">
          Order Confirmed! 🎉
        </mj-text>
        <mj-text font-size="16px" color="#333333">
          Hi {{userName}},
        </mj-text>
        <mj-text font-size="16px" color="#333333">
          Thank you for your order! Your order <strong>#{{orderNumber}}</strong> has been confirmed.
        </mj-text>
      </mj-column>
    </mj-section>

    <mj-section background-color="#ffffff" padding="20px">
      <mj-column>
        <mj-text font-size="18px" font-weight="bold" color="#333333">
          Order Summary
        </mj-text>
        {{#each items}}
        <mj-text font-size="14px" color="#666666">
          {{name}} - {{quantity}}x {{formatCurrency price}}
        </mj-text>
        {{/each}}
        <mj-divider border-color="#e0e0e0"></mj-divider>
        <mj-text font-size="16px" font-weight="bold" color="#333333">
          Total: {{formatCurrency total}}
        </mj-text>
      </mj-column>
    </mj-section>

    <mj-section background-color="#ffffff" padding="20px">
      <mj-column>
        <mj-button background-color="#3B82F6" href="{{trackingUrl}}">
          Track Your Order
        </mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
```

---

### 2. Backend: SMS System (24 items)

#### 2.1 Twilio Setup (8 items)
- [ ] Install Twilio SDK: `npm install twilio --save`
- [ ] Create `src/config/sms.config.ts` with Twilio client
- [ ] Add environment variables: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- [ ] Configure Twilio client with credentials
- [ ] Verify Twilio phone number (Turkish number required)
- [ ] Add connection health check: verify Twilio credentials
- [ ] Test with Twilio sandbox in development
- [ ] Handle Turkish phone number formatting (+90 prefix)

#### 2.2 SMS Templates (8 items)
- [ ] Create `src/templates/sms/` directory
- [ ] Create `order-confirmed.txt`: "Your order #{{orderNumber}} is confirmed. Track: {{url}}"
- [ ] Create `order-shipped.txt`: "Your order #{{orderNumber}} has been shipped. Tracking: {{trackingNumber}}"
- [ ] Create `order-delivered.txt`: "Your order #{{orderNumber}} has been delivered. Enjoy!"
- [ ] Create `otp.txt`: "Your verification code is {{code}}. Valid for 10 minutes."
- [ ] Create `payment-success.txt`: "Payment of ₺{{amount}} received for order #{{orderNumber}}"
- [ ] Keep SMS messages under 160 characters (single SMS)
- [ ] Test templates with various data

#### 2.3 SMS Service (8 items)
- [ ] Create `src/services/sms.service.ts`
- [ ] Implement `sendSMS(to, template, data)` function
- [ ] Validate Turkish phone number format (+90 5XX XXX XX XX)
- [ ] Load and render SMS templates
- [ ] Check user SMS preferences before sending (opt-in required)
- [ ] Implement `sendOrderConfirmationSMS(order)` function
- [ ] Implement `sendOTPSMS(user, code)` function
- [ ] Add rate limiting: max 5 SMS/hour per user (prevent spam)

**Example**:
```typescript
// src/config/sms.config.ts
import twilio from 'twilio';

if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
  throw new Error('Twilio configuration missing. Check .env file.');
}

export const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

// Health check
export const verifyTwilioConnection = async () => {
  try {
    await twilioClient.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
    console.log('Twilio connection verified successfully');
    return { healthy: true };
  } catch (error) {
    console.error('Twilio connection failed:', error);
    return { healthy: false, error: error.message };
  }
};

// src/services/sms.service.ts
import { twilioClient, TWILIO_PHONE_NUMBER } from '../config/sms.config';
import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import prisma from '../config/database';

const smsTemplateCache = new Map<string, HandlebarsTemplateDelegate>();

const renderSMSTemplate = (templateName: string, data: any): string => {
  if (smsTemplateCache.has(templateName)) {
    return smsTemplateCache.get(templateName)!(data);
  }

  const templatePath = path.join(__dirname, '../templates/sms', `${templateName}.txt`);
  const templateSource = fs.readFileSync(templatePath, 'utf-8');
  const compiled = Handlebars.compile(templateSource);
  smsTemplateCache.set(templateName, compiled);

  return compiled(data);
};

const formatTurkishPhoneNumber = (phone: string): string => {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');

  // Add +90 prefix if missing
  if (!cleaned.startsWith('90')) {
    cleaned = '90' + cleaned;
  }

  return '+' + cleaned;
};

interface SendSMSParams {
  to: string;
  template: string;
  data: any;
}

export const sendSMS = async (params: SendSMSParams) => {
  const { to, template, data } = params;

  // Format phone number
  const formattedPhone = formatTurkishPhoneNumber(to);

  // Check user SMS preferences
  const user = await prisma.user.findFirst({
    where: { phone: formattedPhone },
    select: { id: true, smsNotificationsEnabled: true }
  });

  if (user && !user.smsNotificationsEnabled) {
    throw new Error('User has disabled SMS notifications');
  }

  // Render SMS text
  const message = renderSMSTemplate(template, data);

  // Validate message length (160 chars for single SMS)
  if (message.length > 160) {
    console.warn(`SMS message exceeds 160 characters (${message.length}). Will be split into multiple messages.`);
  }

  // Send SMS via Twilio
  const result = await twilioClient.messages.create({
    body: message,
    from: TWILIO_PHONE_NUMBER,
    to: formattedPhone
  });

  // Log to database
  await prisma.notificationLog.create({
    data: {
      channel: 'sms',
      recipient: formattedPhone,
      message,
      template,
      status: result.status, // queued, sent, delivered, failed
      messageId: result.sid,
      sentAt: new Date()
    }
  });

  return { messageId: result.sid, status: result.status };
};

export const sendOrderConfirmationSMS = async (order: any) => {
  return sendSMS({
    to: order.user.phone,
    template: 'order-confirmed',
    data: {
      orderNumber: order.orderNumber,
      url: `${process.env.FRONTEND_URL}/orders/${order.id}`
    }
  });
};

export const sendOTPSMS = async (phone: string, code: string) => {
  return sendSMS({
    to: phone,
    template: 'otp',
    data: { code }
  });
};

// templates/sms/order-confirmed.txt
Siparişiniz #{{orderNumber}} onaylandı! Takip: {{url}}

// templates/sms/otp.txt
Doğrulama kodunuz: {{code}}. 10 dakika geçerlidir.
```

---

### 3. Backend: Push Notifications (28 items)

#### 3.1 Web Push Setup (10 items)
- [ ] Install Web Push: `npm install web-push --save`
- [ ] Create `src/config/push.config.ts` with VAPID keys
- [ ] Generate VAPID keys: `npx web-push generate-vapid-keys`
- [ ] Add environment variables: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- [ ] Configure Web Push with VAPID credentials
- [ ] Create `PushSubscription` model in Prisma schema
- [ ] Add `POST /api/push/subscribe`: save user push subscription
- [ ] Add `POST /api/push/unsubscribe`: remove push subscription
- [ ] Add `GET /api/push/vapid-public-key`: return public key for frontend
- [ ] Test push subscription flow

#### 3.2 Push Service (10 items)
- [ ] Create `src/services/push.service.ts`
- [ ] Implement `sendPushNotification(subscription, payload)` function
- [ ] Support notification title, body, icon, badge, data
- [ ] Handle expired subscriptions (remove from database)
- [ ] Implement `sendOrderUpdatePush(userId, order)` function
- [ ] Add rate limiting: max 20 push/hour per user
- [ ] Log all push notifications to database
- [ ] Add retry logic for failed push deliveries
- [ ] Support action buttons in push notifications
- [ ] Test across Chrome, Firefox, Edge browsers

#### 3.3 Service Worker (8 items)
- [ ] Create `public/service-worker.js` in frontend
- [ ] Register service worker on app load
- [ ] Listen for push events in service worker
- [ ] Display notification with custom icon and badge
- [ ] Handle notification click: navigate to relevant page
- [ ] Add notification actions (e.g., "View Order", "Dismiss")
- [ ] Request notification permission on user action (not on page load)
- [ ] Test service worker registration and push display

**Example**:
```typescript
// src/config/push.config.ts
import webpush from 'web-push';

if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  throw new Error('VAPID keys not configured. Run: npx web-push generate-vapid-keys');
}

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:noreply@lumi.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export { webpush };

// prisma/schema.prisma
model PushSubscription {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  endpoint   String   @unique
  keys       Json     // { p256dh, auth }
  userAgent  String?
  createdAt  DateTime @default(now())

  @@index([userId])
}

// src/services/push.service.ts
import { webpush } from '../config/push.config';
import prisma from '../config/database';

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: any;
  actions?: Array<{ action: string; title: string; icon?: string }>;
}

export const sendPushNotification = async (
  subscription: any,
  payload: PushPayload
) => {
  try {
    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/images/logo.png',
      badge: payload.badge || '/images/badge.png',
      data: payload.data || {},
      actions: payload.actions || []
    });

    await webpush.sendNotification(subscription, pushPayload);

    // Log to database
    await prisma.notificationLog.create({
      data: {
        channel: 'push',
        recipient: subscription.endpoint,
        message: payload.body,
        status: 'sent',
        sentAt: new Date()
      }
    });

    return { success: true };
  } catch (error) {
    // Handle expired subscription
    if (error.statusCode === 410) {
      // Remove expired subscription from database
      await prisma.pushSubscription.delete({
        where: { endpoint: subscription.endpoint }
      });
    }

    throw error;
  }
};

export const sendOrderUpdatePush = async (userId: string, order: any) => {
  // Load user's push subscriptions
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId }
  });

  if (subscriptions.length === 0) return;

  // Send push to all user devices
  const promises = subscriptions.map(sub =>
    sendPushNotification(
      {
        endpoint: sub.endpoint,
        keys: sub.keys
      },
      {
        title: 'Order Update',
        body: `Your order #${order.orderNumber} has been ${order.status}`,
        icon: '/images/order-icon.png',
        data: { orderId: order.id, url: `/orders/${order.id}` },
        actions: [
          { action: 'view', title: 'View Order', icon: '/images/view-icon.png' },
          { action: 'close', title: 'Dismiss' }
        ]
      }
    )
  );

  await Promise.allSettled(promises);
};

// src/routes/push-subscription.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import prisma from '../config/database';

const router = Router();

const PushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string()
  })
});

router.get('/vapid-public-key', (req, res) => {
  res.json({
    success: true,
    data: { publicKey: process.env.VAPID_PUBLIC_KEY },
    meta: { timestamp: new Date().toISOString() }
  });
});

router.post('/subscribe', authMiddleware, async (req, res) => {
  const validated = PushSubscriptionSchema.parse(req.body);

  const subscription = await prisma.pushSubscription.upsert({
    where: { endpoint: validated.endpoint },
    update: { keys: validated.keys },
    create: {
      userId: req.user.id,
      endpoint: validated.endpoint,
      keys: validated.keys,
      userAgent: req.headers['user-agent']
    }
  });

  res.json({
    success: true,
    data: { subscriptionId: subscription.id },
    meta: { timestamp: new Date().toISOString() }
  });
});

router.post('/unsubscribe', authMiddleware, async (req, res) => {
  const { endpoint } = req.body;

  await prisma.pushSubscription.delete({
    where: { endpoint }
  });

  res.json({
    success: true,
    data: { message: 'Unsubscribed successfully' },
    meta: { timestamp: new Date().toISOString() }
  });
});

export default router;

// public/service-worker.js (frontend)
self.addEventListener('push', (event) => {
  const data = event.data.json();

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    data: data.data,
    actions: data.actions,
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'view') {
    const url = event.notification.data.url;
    event.waitUntil(
      clients.openWindow(url)
    );
  }
});
```

---

### 4. Backend: Notification Queue (22 items)

#### 4.1 Queue Setup (8 items)
- [ ] Install Bull: `npm install bull --save`
- [ ] Create `src/services/notification-queue.service.ts`
- [ ] Set up notification queue with Redis connection
- [ ] Configure queue options: concurrency, retry, backoff
- [ ] Create separate queues: `emailQueue`, `smsQueue`, `pushQueue`
- [ ] Add queue monitoring with Bull Board dashboard
- [ ] Set queue concurrency: 10 jobs in parallel
- [ ] Configure exponential backoff: 2s, 4s, 8s for retries

#### 4.2 Job Processors (14 items)
- [ ] Create `src/jobs/send-email.job.ts`: email job processor
- [ ] Create `src/jobs/send-sms.job.ts`: SMS job processor
- [ ] Create `src/jobs/send-push.job.ts`: push job processor
- [ ] Implement retry logic: max 3 attempts
- [ ] Handle job failures: log to database, send alert to admins
- [ ] Add job progress tracking
- [ ] Implement job priority: high (transactional), normal (marketing)
- [ ] Add job delay for scheduled notifications
- [ ] Implement job deduplication: prevent duplicate notifications
- [ ] Add job timeouts: 30s for email, 10s for SMS, 5s for push
- [ ] Log job start, completion, failure events
- [ ] Track job processing metrics (duration, success rate)
- [ ] Add dead letter queue for permanently failed jobs
- [ ] Clean up completed jobs after 7 days

**Example**:
```typescript
// src/services/notification-queue.service.ts
import Queue from 'bull';
import redis from '../config/redis';

// Create queues
export const emailQueue = new Queue('email-notifications', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000 // 2s, 4s, 8s
    },
    removeOnComplete: {
      age: 7 * 24 * 3600 // 7 days
    },
    timeout: 30000 // 30s
  },
  settings: {
    maxStalledCount: 3
  }
});

export const smsQueue = new Queue('sms-notifications', {
  redis: { host: process.env.REDIS_HOST, port: parseInt(process.env.REDIS_PORT || '6379') },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    timeout: 10000 // 10s
  }
});

export const pushQueue = new Queue('push-notifications', {
  redis: { host: process.env.REDIS_HOST, port: parseInt(process.env.REDIS_PORT || '6379') },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    timeout: 5000 // 5s
  }
});

// Enqueue functions
export const enqueueEmail = async (params: any, priority = 'normal') => {
  const jobPriority = priority === 'high' ? 1 : 5;

  return emailQueue.add(params, {
    priority: jobPriority,
    jobId: `email-${params.to}-${params.template}-${Date.now()}` // Deduplication
  });
};

export const enqueueSMS = async (params: any, priority = 'normal') => {
  const jobPriority = priority === 'high' ? 1 : 5;

  return smsQueue.add(params, {
    priority: jobPriority,
    jobId: `sms-${params.to}-${params.template}-${Date.now()}`
  });
};

export const enqueuePush = async (params: any, priority = 'normal') => {
  const jobPriority = priority === 'high' ? 1 : 5;

  return pushQueue.add(params, {
    priority: jobPriority
  });
};

// src/jobs/send-email.job.ts
import { emailQueue } from '../services/notification-queue.service';
import { sendEmail } from '../services/email.service';
import logger from '../config/logger';

emailQueue.process(10, async (job) => {
  const { to, subject, template, data, attachments } = job.data;

  logger.info(`Processing email job: ${job.id}`, { to, template });

  try {
    const result = await sendEmail({ to, subject, template, data, attachments });

    logger.info(`Email sent successfully: ${job.id}`, { messageId: result.messageId });

    return result;
  } catch (error) {
    logger.error(`Email job failed: ${job.id}`, error);
    throw error; // Will trigger retry
  }
});

emailQueue.on('completed', (job, result) => {
  logger.info(`Email job completed: ${job.id}`, result);
});

emailQueue.on('failed', (job, error) => {
  logger.error(`Email job permanently failed: ${job.id}`, error);

  // Send alert to admin
  if (job.attemptsMade >= job.opts.attempts) {
    // TODO: Alert admin via Slack/email
  }
});

emailQueue.on('stalled', (job) => {
  logger.warn(`Email job stalled: ${job.id}`);
});

// Similar processors for SMS and Push queues
```

---

### 5. Backend: Notification Preferences (18 items)

#### 5.1 Preferences Model (8 items)
- [ ] Create `NotificationPreferences` model in Prisma schema
- [ ] Add fields: `emailEnabled`, `smsEnabled`, `pushEnabled`
- [ ] Add category preferences: `marketing`, `transactional`, `newsletter`
- [ ] Add default preferences on user creation (all transactional enabled, marketing opt-in)
- [ ] Add `GET /api/notifications/preferences`: get user preferences
- [ ] Add `PUT /api/notifications/preferences`: update preferences
- [ ] Add `POST /api/notifications/unsubscribe/:token`: unsubscribe via email link
- [ ] Generate unsubscribe token for email footer

#### 5.2 Preference Enforcement (10 items)
- [ ] Check email preferences before sending marketing emails
- [ ] Check SMS preferences before sending promotional SMS
- [ ] Always send transactional notifications (order updates, password reset)
- [ ] Add unsubscribe link to all marketing emails
- [ ] Handle unsubscribe requests: update preferences, confirm unsubscribe
- [ ] Add re-subscribe functionality
- [ ] Log preference changes for audit
- [ ] Display preference update confirmation
- [ ] Add GDPR compliance: clear consent tracking
- [ ] Test preference enforcement across all notification types

**Example**:
```typescript
// prisma/schema.prisma
model NotificationPreferences {
  id     String  @id @default(cuid())
  userId String  @unique
  user   User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Channel preferences
  emailEnabled Boolean @default(true)
  smsEnabled   Boolean @default(false) // Opt-in required for SMS
  pushEnabled  Boolean @default(true)

  // Category preferences
  transactionalEnabled Boolean @default(true) // Order updates, password reset
  marketingEnabled     Boolean @default(false) // Promotional campaigns
  newsletterEnabled    Boolean @default(false) // Weekly newsletters

  // Unsubscribe token for email links
  unsubscribeToken String  @unique @default(cuid())

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// src/services/email.service.ts (add preference check)
export const sendMarketingEmail = async (params: SendEmailParams) => {
  const { to } = params;

  // Check user preferences
  const user = await prisma.user.findUnique({
    where: { email: to },
    include: { notificationPreferences: true }
  });

  if (!user || !user.notificationPreferences?.emailEnabled || !user.notificationPreferences?.marketingEnabled) {
    throw new Error('User has disabled marketing emails');
  }

  // Add unsubscribe link to email data
  const unsubscribeUrl = `${process.env.FRONTEND_URL}/unsubscribe/${user.notificationPreferences.unsubscribeToken}`;
  params.data.unsubscribeUrl = unsubscribeUrl;

  return sendEmail(params);
};

// src/routes/notifications.routes.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import prisma from '../config/database';

const router = Router();

router.get('/preferences', authMiddleware, async (req, res) => {
  const preferences = await prisma.notificationPreferences.findUnique({
    where: { userId: req.user.id }
  });

  res.json({
    success: true,
    data: { preferences },
    meta: { timestamp: new Date().toISOString() }
  });
});

router.put('/preferences', authMiddleware, async (req, res) => {
  const { emailEnabled, smsEnabled, pushEnabled, marketingEnabled, newsletterEnabled } = req.body;

  const preferences = await prisma.notificationPreferences.upsert({
    where: { userId: req.user.id },
    update: {
      emailEnabled,
      smsEnabled,
      pushEnabled,
      marketingEnabled,
      newsletterEnabled
    },
    create: {
      userId: req.user.id,
      emailEnabled,
      smsEnabled,
      pushEnabled,
      marketingEnabled,
      newsletterEnabled
    }
  });

  res.json({
    success: true,
    data: { preferences },
    meta: { timestamp: new Date().toISOString() }
  });
});

router.post('/unsubscribe/:token', async (req, res) => {
  const { token } = req.params;

  const preferences = await prisma.notificationPreferences.findUnique({
    where: { unsubscribeToken: token }
  });

  if (!preferences) {
    return res.status(404).json({ success: false, error: 'Invalid unsubscribe token' });
  }

  await prisma.notificationPreferences.update({
    where: { id: preferences.id },
    data: {
      emailEnabled: false,
      marketingEnabled: false,
      newsletterEnabled: false
    }
  });

  res.json({
    success: true,
    data: { message: 'Successfully unsubscribed from all emails' },
    meta: { timestamp: new Date().toISOString() }
  });
});

export default router;
```

---

### 6. Frontend: Notification UI (26 items)

#### 6.1 Notification Preferences Page (12 items)
- [ ] Create `src/app/account/notifications/page.tsx`
- [ ] Display channel toggles: Email, SMS, Push
- [ ] Display category toggles: Marketing, Newsletter
- [ ] Add "Test Notification" button for each channel
- [ ] Show push notification permission status
- [ ] Request push permission when user enables push
- [ ] Display push subscription status (subscribed/unsubscribed)
- [ ] Save preferences with optimistic updates
- [ ] Show success toast on save
- [ ] Add "Unsubscribe from all" button
- [ ] Display last updated timestamp
- [ ] Use B1 brand colors from deneme.html

#### 6.2 Push Notification Component (8 items)
- [ ] Create `src/hooks/usePushNotifications.ts`
- [ ] Register service worker on app load
- [ ] Request notification permission on user action
- [ ] Subscribe to push notifications with VAPID key
- [ ] Send subscription to backend
- [ ] Handle permission denied gracefully
- [ ] Display push subscription status
- [ ] Add unsubscribe functionality

#### 6.3 Notification History (6 items)
- [ ] Create `src/components/notifications/NotificationHistory.tsx`
- [ ] Display list of sent notifications (email, SMS, push)
- [ ] Show notification status: sent, delivered, failed
- [ ] Add filtering: by channel, by date range
- [ ] Add pagination
- [ ] Fetch notification history from backend

**Example**:
```typescript
// src/hooks/usePushNotifications.ts
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const usePushNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      throw new Error('Push notifications not supported');
    }

    const result = await Notification.requestPermission();
    setPermission(result);

    if (result === 'granted') {
      await subscribeToPush();
    }

    return result;
  };

  const subscribeToPush = async () => {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Worker not supported');
    }

    // Register service worker
    const registration = await navigator.serviceWorker.register('/service-worker.js');

    // Get VAPID public key from backend
    const res = await fetch('/api/push/vapid-public-key');
    const { data } = await res.json();

    // Subscribe to push
    const sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.publicKey)
    });

    setSubscription(sub);

    // Send subscription to backend
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys: {
          p256dh: arrayBufferToBase64(sub.getKey('p256dh')),
          auth: arrayBufferToBase64(sub.getKey('auth'))
        }
      })
    });

    return sub;
  };

  const unsubscribe = async () => {
    if (!subscription) return;

    await subscription.unsubscribe();

    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint })
    });

    setSubscription(null);
  };

  return {
    permission,
    subscription,
    requestPermission,
    subscribeToPush,
    unsubscribe
  };
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// src/app/account/notifications/page.tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { toast } from 'sonner';

export default function NotificationPreferencesPage() {
  const queryClient = useQueryClient();
  const { permission, requestPermission, unsubscribe } = usePushNotifications();

  const { data, isLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: async () => {
      const res = await fetch('/api/notifications/preferences');
      return res.json();
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (preferences: any) => {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences)
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      toast.success('Preferences updated');
    }
  });

  if (isLoading) return <div>Loading...</div>;

  const preferences = data?.data?.preferences || {};

  const handleToggle = (field: string, value: boolean) => {
    updateMutation.mutate({ ...preferences, [field]: value });
  };

  const handleEnablePush = async () => {
    try {
      const result = await requestPermission();
      if (result === 'granted') {
        handleToggle('pushEnabled', true);
      }
    } catch (error) {
      toast.error('Failed to enable push notifications');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Notification Preferences</h1>

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        <div>
          <h2 className="text-xl font-bold mb-4">Channels</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Email Notifications</p>
                <p className="text-sm text-gray-600">Receive notifications via email</p>
              </div>
              <Switch
                checked={preferences.emailEnabled}
                onCheckedChange={(checked) => handleToggle('emailEnabled', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">SMS Notifications</p>
                <p className="text-sm text-gray-600">Receive notifications via SMS</p>
              </div>
              <Switch
                checked={preferences.smsEnabled}
                onCheckedChange={(checked) => handleToggle('smsEnabled', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Push Notifications</p>
                <p className="text-sm text-gray-600">
                  Receive browser push notifications
                  {permission === 'denied' && (
                    <span className="block text-red-600 text-xs">Permission denied in browser</span>
                  )}
                </p>
              </div>
              {permission === 'granted' ? (
                <Switch
                  checked={preferences.pushEnabled}
                  onCheckedChange={(checked) => handleToggle('pushEnabled', checked)}
                />
              ) : (
                <Button onClick={handleEnablePush} size="sm">
                  Enable Push
                </Button>
              )}
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-4">Categories</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Transactional</p>
                <p className="text-sm text-gray-600">Order updates, account notifications (always enabled)</p>
              </div>
              <Switch checked disabled />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Marketing</p>
                <p className="text-sm text-gray-600">Promotional offers and campaigns</p>
              </div>
              <Switch
                checked={preferences.marketingEnabled}
                onCheckedChange={(checked) => handleToggle('marketingEnabled', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Newsletter</p>
                <p className="text-sm text-gray-600">Weekly newsletter with product updates</p>
              </div>
              <Switch
                checked={preferences.newsletterEnabled}
                onCheckedChange={(checked) => handleToggle('newsletterEnabled', checked)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

### 7. Testing & Quality Assurance (24 items)

#### 7.1 Backend Notification Tests (12 items)
- [ ] Create `tests/notifications/email.test.ts`
- [ ] Test email sending with mock SMTP server
- [ ] Test email template rendering with various data
- [ ] Test SMS sending with Twilio sandbox
- [ ] Test push notification sending
- [ ] Test notification queue processing
- [ ] Test retry logic for failed notifications
- [ ] Test preference enforcement (don't send if disabled)
- [ ] Test unsubscribe functionality
- [ ] Test notification logging to database
- [ ] Test rate limiting (email, SMS, push)
- [ ] Achieve ≥85% test coverage for notification services

#### 7.2 Frontend Notification Tests (6 items)
- [ ] Create `src/components/notifications/__tests__/NotificationPreferences.test.tsx`
- [ ] Test preference toggles update state
- [ ] Test push permission request flow
- [ ] Test service worker registration
- [ ] Test push subscription
- [ ] Test notification display in browser

#### 7.3 E2E Notification Tests (6 items)
- [ ] Create `e2e/notifications/email.spec.ts`
- [ ] Test complete order flow triggers email notification
- [ ] Test password reset email flow
- [ ] Test notification preferences update
- [ ] Test push notification display
- [ ] Test unsubscribe via email link

---

## 🧪 VALIDATION CRITERIA

### Functional Validation
```typescript
// Email System
Order placed → Email sent within 5s → Order confirmation email received

// SMS System
Order shipped → SMS sent within 3s → SMS delivered to Turkish mobile number

// Push Notifications
Order update → Push sent within 1s → Browser displays notification

// Notification Queue
Enqueue 100 notifications → All processed within 60s (100/min throughput)

// Preferences
User disables marketing emails → No marketing emails sent → Transactional emails still sent

// Retry Logic
Email fails → Retry after 2s → Retry after 4s → Retry after 8s → Mark as failed
```

### Performance Validation (P1, P2)
```bash
# P1: Email delivery time
time enqueueEmail(...) && checkEmailSent()
# Expected: <5s from enqueue to sent

# P2: Template rendering time
time renderEmailTemplate('order-confirmed', data)
# Expected: <200ms

# Queue throughput
# Enqueue 100 notifications, measure processing time
# Expected: <60s (100 notifications/minute)
```

---

## 📊 SUCCESS METRICS

### Performance Metrics
- Email delivery time <5s (P1)
- SMS delivery time <3s (P1)
- Push notification delivery <1s (P1)
- Template rendering <200ms (P2)
- Queue throughput: 100 notifications/minute
- Retry latency: 2s, 4s, 8s (exponential backoff)

### Quality Metrics
- ≥85% test coverage for notification services
- Email deliverability rate >95%
- SMS delivery rate >98%
- Push notification delivery rate >90%
- TypeScript errors: 0 (Q1)

### Business Metrics
- Notification open rate (email: >20%, push: >10%)
- Unsubscribe rate <2%
- User opt-in rate for marketing (>40%)
- Average time to delivery <3s
- Failed notification rate <5%

---

## 🚨 COMMON PITFALLS TO AVOID

### Email Anti-Patterns
❌ **WRONG**: Blocking request with synchronous email
```typescript
await sendEmail(user.email, 'Welcome', data);
res.json({ success: true }); // User waits 5s!
```

✅ **CORRECT**: Async queue processing
```typescript
await enqueueEmail({ to: user.email, template: 'welcome', data });
res.json({ success: true }); // Respond immediately
```

❌ **WRONG**: No rate limiting
```typescript
// Spammer can trigger 1000s of emails
await sendEmail(req.body.email, req.body.subject, req.body.message);
```

✅ **CORRECT**: Rate limiting
```typescript
const key = `email-rate:${req.user.id}`;
const count = await redis.incr(key);
await redis.expire(key, 60);

if (count > 10) {
  throw new Error('Rate limit exceeded: max 10 emails/minute');
}
```

### SMS Anti-Patterns
❌ **WRONG**: Ignoring user preferences
```typescript
await sendSMS(user.phone, 'Promo: 50% off!');
```

✅ **CORRECT**: Check preferences
```typescript
if (!user.smsNotificationsEnabled || !user.marketingEnabled) {
  throw new Error('User has disabled SMS notifications');
}
```

### Push Notification Anti-Patterns
❌ **WRONG**: Not handling expired subscriptions
```typescript
await webpush.sendNotification(subscription, payload); // Fails silently
```

✅ **CORRECT**: Handle 410 Gone
```typescript
try {
  await webpush.sendNotification(subscription, payload);
} catch (error) {
  if (error.statusCode === 410) {
    await prisma.pushSubscription.delete({ where: { endpoint: subscription.endpoint } });
  }
}
```

---

## 📦 DELIVERABLES

### Backend Deliverables
- [ ] `src/config/email.config.ts` - Nodemailer SMTP setup
- [ ] `src/config/sms.config.ts` - Twilio SMS setup
- [ ] `src/config/push.config.ts` - Web Push VAPID setup
- [ ] `src/services/email.service.ts` - Email sending service
- [ ] `src/services/sms.service.ts` - SMS sending service
- [ ] `src/services/push.service.ts` - Push notification service
- [ ] `src/services/template.service.ts` - Template rendering
- [ ] `src/services/notification-queue.service.ts` - Bull queue management
- [ ] `src/jobs/send-email.job.ts` - Email job processor
- [ ] `src/jobs/send-sms.job.ts` - SMS job processor
- [ ] `src/jobs/send-push.job.ts` - Push job processor
- [ ] `src/routes/notifications.routes.ts` - Notification APIs
- [ ] `src/routes/push-subscription.routes.ts` - Push subscription APIs
- [ ] `src/templates/email/*.hbs` - All email templates
- [ ] `src/templates/sms/*.txt` - All SMS templates
- [ ] `prisma/schema.prisma` - NotificationPreferences, NotificationLog, PushSubscription models
- [ ] `tests/notifications/*.test.ts` - Notification tests (≥85% coverage)

### Frontend Deliverables
- [ ] `src/app/account/notifications/page.tsx` - Notification preferences page
- [ ] `src/components/notifications/NotificationPreferences.tsx` - Preferences UI
- [ ] `src/components/notifications/PushSubscription.tsx` - Push subscription component
- [ ] `src/components/notifications/NotificationHistory.tsx` - Notification history
- [ ] `src/hooks/usePushNotifications.ts` - Push notification hook
- [ ] `public/service-worker.js` - Service worker for push
- [ ] `e2e/notifications/*.spec.ts` - E2E notification tests

### Documentation Deliverables
- [ ] Email template guide (how to create/edit templates)
- [ ] SMS integration guide (Twilio setup, Turkish phone numbers)
- [ ] Push notification guide (VAPID keys, service worker, browser support)
- [ ] Notification queue architecture diagram
- [ ] Environment variables documentation (.env.example)

---

## 📝 PHASE COMPLETION REPORT TEMPLATE

```markdown
# Phase 12: Notifications System - Completion Report

## ✅ Completed Items
- Backend Email System: X/32 items
- Backend SMS System: X/24 items
- Backend Push Notifications: X/28 items
- Backend Notification Queue: X/22 items
- Backend Notification Preferences: X/18 items
- Frontend Notification UI: X/26 items
- Testing & QA: X/24 items

**Total Progress**: X/174 items (X%)

## 📊 Metrics Achieved
- Email delivery time: Xs
- SMS delivery time: Xs
- Push delivery time: Xs
- Template rendering time: Xms
- Queue throughput: X notifications/minute
- Email deliverability rate: X%
- SMS delivery rate: X%
- Test coverage: X%
- TypeScript errors: 0 ✅

## 🎯 Functional Validation
- Email System: ✅ Transactional emails sending correctly
- SMS System: ✅ SMS delivered to Turkish numbers
- Push Notifications: ✅ Working across browsers
- Notification Queue: ✅ Processing 100+ notifications/min
- Preferences: ✅ User preferences enforced
- Retry Logic: ✅ Failed notifications retry 3 times

## 🚧 Known Issues / Technical Debt
- [ ] Issue 1 description
- [ ] Issue 2 description

## 📚 Documentation
- [ ] Email template guide created
- [ ] SMS integration guide created
- [ ] Push notification guide created
- [ ] Environment variables documented

## 👥 Phase Review
**Reviewed by**: [Name]
**Date**: [Date]
**Approved**: ✅ / ⏸️ / ❌

**Next Phase**: Phase 13 - Performance & Optimization (Caching, CDN, Database Tuning)
```

---

**END OF PHASE 12 DOCUMENTATION**
**Total Checklist Items**: 174 items
**Estimated Completion Time**: 7-10 days
**Dependencies**: Phases 1-4, 7, 10 must be completed first
**Next Phase**: Phase 13 - Performance & Optimization (Advanced Caching, CDN, Query Optimization)

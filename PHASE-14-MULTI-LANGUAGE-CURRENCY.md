# PHASE 14: MULTI-LANGUAGE & CURRENCY SUPPORT

**Status**: 🔄 In Progress
**Priority**: 🟡 Medium
**Dependencies**: Phase 2 (Database & Prisma), Phase 4 (Core APIs), Phase 6 (Next.js Foundation), Phase 8 (E-commerce Interface), Phase 10 (Payment Integration)
**Estimated Time**: 5-7 days

---

## 📋 DOCUMENT OVERVIEW

This phase implements comprehensive internationalization (i18n) and multi-currency support, enabling the platform to serve customers in multiple languages and currencies. The system supports Turkish (default), English, and German languages, with TRY (default), USD, and EUR currencies. Features include dynamic language switching, currency conversion with real-time exchange rates, localized content, and region-specific formatting.

**Key Components**:
- Internationalization (i18n) with next-intl
- Multi-currency support with real-time exchange rates
- Language switcher UI component
- Currency switcher UI component
- Localized content storage (product names, descriptions in multiple languages)
- Region-specific number, date, and currency formatting
- Localized URLs (SEO-friendly: /tr/products, /en/products)
- Translation management system

**Technical Stack**:
- next-intl (Next.js i18n library)
- Intl API (JavaScript native internationalization)
- Exchange rate API (exchangerate-api.io or fixer.io)
- Prisma JSON fields (product translations)
- React Context (language/currency state)
- Middleware (locale detection, URL rewriting)

**Supported Languages**:
- Turkish (tr) - Default
- English (en)
- German (de)

**Supported Currencies**:
- Turkish Lira (TRY) - Default
- US Dollar (USD)
- Euro (EUR)

**Performance Standards**:
- **P1**: Exchange rate API response <500ms
- **P2**: Language switch <100ms (no page reload)
- Translation file size <50KB per language
- Cache exchange rates for 1 hour

**Quality Standards**:
- **Q1**: TypeScript strict mode, 0 errors
- **Q2**: All API responses follow standard format
- 100% translation coverage for core UI elements
- Proper pluralization and gender support

---

## 🎯 PHASE OBJECTIVES

### Primary Goals
1. **i18n Setup**: Configure next-intl for multi-language support
2. **Translation Management**: Create translation files for TR, EN, DE
3. **Language Switcher**: Build language switcher UI component
4. **Currency Support**: Implement multi-currency with real-time exchange rates
5. **Currency Switcher**: Build currency switcher UI component
6. **Localized Content**: Store product translations in database
7. **Localized URLs**: SEO-friendly URLs with language prefix (/tr, /en, /de)
8. **Regional Formatting**: Number, date, currency formatting per locale

### Success Criteria
- [ ] Users can switch between TR, EN, DE languages
- [ ] Users can switch between TRY, USD, EUR currencies
- [ ] All UI elements translated (buttons, labels, messages)
- [ ] Product names and descriptions available in multiple languages
- [ ] Prices displayed in selected currency with correct formatting
- [ ] Exchange rates updated automatically (1 hour cache)
- [ ] URLs localized (/tr/products, /en/products)
- [ ] No page reload on language/currency switch
- [ ] SEO-friendly localized metadata

---

## 🎯 CRITICAL REQUIREMENTS

### Internationalization Requirements (MANDATORY)

**Translation Coverage**
```typescript
// ❌ WRONG: Hardcoded strings
<button>Add to Cart</button>

// ✅ CORRECT: Translated strings
import { useTranslations } from 'next-intl';

const t = useTranslations('Product');
<button>{t('addToCart')}</button>
```

**Pluralization Support**
```typescript
// ❌ WRONG: Manual pluralization
{count === 1 ? '1 item' : `${count} items`}

// ✅ CORRECT: ICU Message Format with pluralization
// en.json: "itemCount": "{count, plural, =0 {No items} one {1 item} other {# items}}"
{t('itemCount', { count })}
```

**Date/Number Formatting**
```typescript
// ❌ WRONG: Hardcoded formatting
const price = `₺${amount.toFixed(2)}`;

// ✅ CORRECT: Locale-aware formatting
const formatter = new Intl.NumberFormat(locale, {
  style: 'currency',
  currency: currency
});
const price = formatter.format(amount);
```

---

## 🏗️ ARCHITECTURE OVERVIEW

### i18n Architecture
```
Request → Middleware (Detect Locale) → Rewrite URL (/tr/products)
                ↓
        Next.js Page (with locale)
                ↓
        useTranslations('Namespace')
                ↓
        Load Translation File (messages/tr.json)
                ↓
        Render Translated Content
```

### Currency Conversion Flow
```
Product Price (TRY 1000) → User Currency (USD)
                ↓
        Fetch Exchange Rate (TRY → USD = 0.033)
                ↓
        Cache in Redis (1 hour TTL)
                ↓
        Convert: 1000 * 0.033 = $33.00
                ↓
        Format with Intl.NumberFormat
                ↓
        Display: $33.00
```

---

## ✅ IMPLEMENTATION CHECKLIST

### 1. i18n Setup with next-intl (24 items)

#### 1.1 Installation & Configuration (10 items)
- [ ] Install next-intl: `npm install next-intl --save`
- [ ] Create `messages/` directory for translation files
- [ ] Create `messages/tr.json`: Turkish translations
- [ ] Create `messages/en.json`: English translations
- [ ] Create `messages/de.json`: German translations
- [ ] Create `src/i18n.ts`: next-intl configuration
- [ ] Configure supported locales: ['tr', 'en', 'de']
- [ ] Set default locale: 'tr'
- [ ] Create middleware for locale detection
- [ ] Configure localized URL routing

#### 1.2 Translation Files Structure (14 items)
- [ ] Create `common` namespace: header, footer, buttons, labels
- [ ] Create `product` namespace: product-related strings
- [ ] Create `cart` namespace: shopping cart strings
- [ ] Create `checkout` namespace: checkout flow strings
- [ ] Create `auth` namespace: authentication strings
- [ ] Create `account` namespace: user account strings
- [ ] Create `admin` namespace: admin dashboard strings
- [ ] Create `errors` namespace: error messages
- [ ] Create `validation` namespace: form validation messages
- [ ] Add pluralization support with ICU Message Format
- [ ] Add date/number formatting patterns
- [ ] Organize translations by feature/page
- [ ] Add translation keys documentation
- [ ] Test translation completeness (no missing keys)

**Example**:
```typescript
// src/i18n.ts
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`../messages/${locale}.json`)).default
}));

// middleware.ts
import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['tr', 'en', 'de'],
  defaultLocale: 'tr',
  localePrefix: 'always' // Always show locale in URL
});

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};

// next.config.js
const withNextIntl = require('next-intl/plugin')('./src/i18n.ts');

module.exports = withNextIntl({
  // ... other config
});

// messages/tr.json
{
  "Common": {
    "search": "Ara",
    "addToCart": "Sepete Ekle",
    "buyNow": "Hemen Al",
    "readMore": "Devamını Oku",
    "loading": "Yükleniyor...",
    "error": "Bir hata oluştu",
    "success": "İşlem başarılı"
  },
  "Product": {
    "title": "Ürünler",
    "addToCart": "Sepete Ekle",
    "price": "Fiyat",
    "stock": "Stok",
    "inStock": "Stokta var",
    "outOfStock": "Stokta yok",
    "itemCount": "{count, plural, =0 {Ürün yok} one {1 ürün} other {# ürün}}"
  },
  "Cart": {
    "title": "Sepetim",
    "empty": "Sepetiniz boş",
    "subtotal": "Ara Toplam",
    "shipping": "Kargo",
    "total": "Toplam",
    "checkout": "Ödeme Yap",
    "itemCount": "{count, plural, =0 {Sepetiniz boş} one {1 ürün} other {# ürün}}"
  },
  "Auth": {
    "login": "Giriş Yap",
    "register": "Kayıt Ol",
    "logout": "Çıkış Yap",
    "email": "E-posta",
    "password": "Şifre",
    "forgotPassword": "Şifremi Unuttum",
    "resetPassword": "Şifreyi Sıfırla"
  },
  "Validation": {
    "required": "Bu alan zorunludur",
    "email": "Geçerli bir e-posta adresi girin",
    "minLength": "En az {min} karakter olmalıdır",
    "maxLength": "En fazla {max} karakter olmalıdır",
    "passwordMismatch": "Şifreler eşleşmiyor"
  }
}

// messages/en.json
{
  "Common": {
    "search": "Search",
    "addToCart": "Add to Cart",
    "buyNow": "Buy Now",
    "readMore": "Read More",
    "loading": "Loading...",
    "error": "An error occurred",
    "success": "Success"
  },
  "Product": {
    "title": "Products",
    "addToCart": "Add to Cart",
    "price": "Price",
    "stock": "Stock",
    "inStock": "In stock",
    "outOfStock": "Out of stock",
    "itemCount": "{count, plural, =0 {No items} one {1 item} other {# items}}"
  },
  // ... other namespaces
}

// messages/de.json
{
  "Common": {
    "search": "Suchen",
    "addToCart": "In den Warenkorb",
    "buyNow": "Jetzt kaufen",
    "readMore": "Mehr lesen",
    "loading": "Wird geladen...",
    "error": "Ein Fehler ist aufgetreten",
    "success": "Erfolg"
  },
  // ... other namespaces
}

// Usage in component
'use client';

import { useTranslations } from 'next-intl';

export default function ProductCard({ product }) {
  const t = useTranslations('Product');

  return (
    <div>
      <h3>{product.name}</h3>
      <p>{t('price')}: {product.price}</p>
      <button>{t('addToCart')}</button>
      <p>{product.stock > 0 ? t('inStock') : t('outOfStock')}</p>
    </div>
  );
}
```

---

### 2. Language Switcher Component (16 items)

#### 2.1 Language Switcher UI (10 items)
- [ ] Create `src/components/i18n/LanguageSwitcher.tsx`
- [ ] Display current language with flag icon
- [ ] Add dropdown menu with available languages (TR, EN, DE)
- [ ] Display language names in native form (Türkçe, English, Deutsch)
- [ ] Add flag icons for each language
- [ ] Switch language on selection (update URL and reload)
- [ ] Persist language preference in cookie
- [ ] Add language switcher to header/footer
- [ ] Add aria-label for accessibility
- [ ] Test language switching across all pages

#### 2.2 Locale Detection (6 items)
- [ ] Detect user's browser language on first visit
- [ ] Redirect to appropriate locale (/tr, /en, /de)
- [ ] Store locale preference in cookie
- [ ] Read locale from URL pathname
- [ ] Fallback to default locale (tr) if unsupported
- [ ] Add locale selector for mobile devices

**Example**:
```typescript
// src/components/i18n/LanguageSwitcher.tsx
'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { Select } from '@/components/ui/select';

const languages = [
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' }
];

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleLanguageChange = (newLocale: string) => {
    // Remove current locale from pathname
    const pathWithoutLocale = pathname.replace(`/${locale}`, '');

    // Navigate to new locale
    router.push(`/${newLocale}${pathWithoutLocale}`);
  };

  const currentLanguage = languages.find(lang => lang.code === locale);

  return (
    <Select
      value={locale}
      onChange={(e) => handleLanguageChange(e.target.value)}
      aria-label="Select language"
    >
      {languages.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.flag} {lang.name}
        </option>
      ))}
    </Select>
  );
}

// middleware.ts (enhanced locale detection)
import createMiddleware from 'next-intl/middleware';
import { NextRequest } from 'next/server';

const intlMiddleware = createMiddleware({
  locales: ['tr', 'en', 'de'],
  defaultLocale: 'tr',
  localePrefix: 'always',
  localeDetection: true // Auto-detect from Accept-Language header
});

export default function middleware(request: NextRequest) {
  // Check for locale cookie
  const localeCookie = request.cookies.get('NEXT_LOCALE');

  if (localeCookie && !request.nextUrl.pathname.startsWith(`/${localeCookie.value}`)) {
    // Redirect to preferred locale
    const url = request.nextUrl.clone();
    url.pathname = `/${localeCookie.value}${url.pathname}`;
    return NextResponse.redirect(url);
  }

  return intlMiddleware(request);
}
```

---

### 3. Multi-Currency Support (28 items)

#### 3.1 Currency System Setup (10 items)
- [ ] Create `src/config/currency.config.ts`
- [ ] Define supported currencies: TRY, USD, EUR
- [ ] Set default currency: TRY
- [ ] Create `Currency` enum: TRY | USD | EUR
- [ ] Create currency symbols map: { TRY: '₺', USD: '$', EUR: '€' }
- [ ] Create currency names map: { TRY: 'Turkish Lira', ... }
- [ ] Add currency configuration to environment variables
- [ ] Create currency context provider
- [ ] Persist currency preference in cookie
- [ ] Add currency to API requests

#### 3.2 Exchange Rate Integration (10 items)
- [ ] Choose exchange rate API (exchangerate-api.io or fixer.io)
- [ ] Create free account and get API key
- [ ] Install axios: `npm install axios --save`
- [ ] Create `src/services/exchange-rate.service.ts`
- [ ] Implement `fetchExchangeRates(baseCurrency)` function
- [ ] Cache exchange rates in Redis (1 hour TTL)
- [ ] Fetch rates on app startup
- [ ] Update rates every hour with cron job
- [ ] Handle API failures gracefully (use cached rates)
- [ ] Add fallback exchange rates (hardcoded, updated monthly)

#### 3.3 Currency Conversion (8 items)
- [ ] Create `src/utils/currency.utils.ts`
- [ ] Implement `convertCurrency(amount, fromCurrency, toCurrency)` function
- [ ] Implement `formatCurrency(amount, currency, locale)` function
- [ ] Use Intl.NumberFormat for locale-aware formatting
- [ ] Handle rounding (2 decimal places for most currencies)
- [ ] Add currency conversion to product prices
- [ ] Add currency conversion to cart total
- [ ] Test conversion accuracy

**Example**:
```typescript
// src/config/currency.config.ts
export enum Currency {
  TRY = 'TRY',
  USD = 'USD',
  EUR = 'EUR'
}

export const CURRENCY_SYMBOLS = {
  [Currency.TRY]: '₺',
  [Currency.USD]: '$',
  [Currency.EUR]: '€'
};

export const CURRENCY_NAMES = {
  [Currency.TRY]: 'Turkish Lira',
  [Currency.USD]: 'US Dollar',
  [Currency.EUR]: 'Euro'
};

export const DEFAULT_CURRENCY = Currency.TRY;

// Fallback exchange rates (updated monthly)
export const FALLBACK_RATES = {
  TRY: 1,
  USD: 0.033,
  EUR: 0.030
};

// src/services/exchange-rate.service.ts
import axios from 'axios';
import redis from '../config/redis';
import { Currency, FALLBACK_RATES } from '../config/currency.config';

const EXCHANGE_RATE_API_KEY = process.env.EXCHANGE_RATE_API_KEY;
const EXCHANGE_RATE_API_URL = 'https://v6.exchangerate-api.com/v6';

interface ExchangeRates {
  base: Currency;
  rates: Record<Currency, number>;
  timestamp: number;
}

export const fetchExchangeRates = async (baseCurrency: Currency = Currency.TRY): Promise<ExchangeRates> => {
  // Check cache first
  const cacheKey = `exchange-rates:${baseCurrency}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  try {
    // Fetch from API
    const response = await axios.get(
      `${EXCHANGE_RATE_API_URL}/${EXCHANGE_RATE_API_KEY}/latest/${baseCurrency}`,
      { timeout: 5000 }
    );

    const rates: ExchangeRates = {
      base: baseCurrency,
      rates: {
        [Currency.TRY]: response.data.conversion_rates.TRY,
        [Currency.USD]: response.data.conversion_rates.USD,
        [Currency.EUR]: response.data.conversion_rates.EUR
      },
      timestamp: Date.now()
    };

    // Cache for 1 hour
    await redis.set(cacheKey, JSON.stringify(rates), 'EX', 3600);

    return rates;
  } catch (error) {
    console.error('Failed to fetch exchange rates:', error);

    // Use fallback rates
    return {
      base: baseCurrency,
      rates: FALLBACK_RATES,
      timestamp: Date.now()
    };
  }
};

// Update rates every hour (cron job)
import cron from 'node-cron';

cron.schedule('0 * * * *', async () => {
  console.log('Updating exchange rates...');
  await fetchExchangeRates(Currency.TRY);
  console.log('Exchange rates updated');
});

// src/utils/currency.utils.ts
import { Currency, CURRENCY_SYMBOLS } from '../config/currency.config';
import { fetchExchangeRates } from '../services/exchange-rate.service';

export const convertCurrency = async (
  amount: number,
  fromCurrency: Currency,
  toCurrency: Currency
): Promise<number> => {
  if (fromCurrency === toCurrency) return amount;

  const rates = await fetchExchangeRates(fromCurrency);
  const rate = rates.rates[toCurrency];

  return amount * rate;
};

export const formatCurrency = (
  amount: number,
  currency: Currency,
  locale: string = 'tr-TR'
): string => {
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return formatter.format(amount);
};

// Usage examples
// Convert 1000 TRY to USD
const usdAmount = await convertCurrency(1000, Currency.TRY, Currency.USD);
// Result: 33.00

// Format currency
formatCurrency(1000, Currency.TRY, 'tr-TR'); // ₺1.000,00
formatCurrency(33, Currency.USD, 'en-US');   // $33.00
formatCurrency(30, Currency.EUR, 'de-DE');   // 30,00 €
```

---

### 4. Currency Switcher Component (14 items)

#### 4.1 Currency Switcher UI (10 items)
- [ ] Create `src/components/i18n/CurrencySwitcher.tsx`
- [ ] Display current currency with symbol
- [ ] Add dropdown menu with available currencies (TRY, USD, EUR)
- [ ] Display currency names and symbols
- [ ] Switch currency on selection (update prices in real-time)
- [ ] Persist currency preference in cookie
- [ ] Add currency switcher to header
- [ ] Update all prices on page when currency changes
- [ ] Add loading indicator during currency switch
- [ ] Test currency switching across all pages

#### 4.2 Currency Context (4 items)
- [ ] Create `src/contexts/CurrencyContext.tsx`
- [ ] Provide current currency state
- [ ] Provide currency change handler
- [ ] Wrap app with CurrencyProvider

**Example**:
```typescript
// src/contexts/CurrencyContext.tsx
'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { Currency, DEFAULT_CURRENCY } from '@/config/currency.config';
import Cookies from 'js-cookie';

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  isLoading: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(DEFAULT_CURRENCY);
  const [isLoading, setIsLoading] = useState(false);

  // Load currency from cookie on mount
  useEffect(() => {
    const savedCurrency = Cookies.get('CURRENCY') as Currency;
    if (savedCurrency && Object.values(Currency).includes(savedCurrency)) {
      setCurrencyState(savedCurrency);
    }
  }, []);

  const setCurrency = (newCurrency: Currency) => {
    setIsLoading(true);

    // Save to cookie
    Cookies.set('CURRENCY', newCurrency, { expires: 365 });

    // Update state
    setCurrencyState(newCurrency);

    setTimeout(() => setIsLoading(false), 300);
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, isLoading }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within CurrencyProvider');
  }
  return context;
};

// src/components/i18n/CurrencySwitcher.tsx
'use client';

import { useCurrency } from '@/contexts/CurrencyContext';
import { Currency, CURRENCY_NAMES, CURRENCY_SYMBOLS } from '@/config/currency.config';
import { Select } from '@/components/ui/select';

const currencies = [
  { code: Currency.TRY, name: CURRENCY_NAMES[Currency.TRY], symbol: CURRENCY_SYMBOLS[Currency.TRY] },
  { code: Currency.USD, name: CURRENCY_NAMES[Currency.USD], symbol: CURRENCY_SYMBOLS[Currency.USD] },
  { code: Currency.EUR, name: CURRENCY_NAMES[Currency.EUR], symbol: CURRENCY_SYMBOLS[Currency.EUR] }
];

export default function CurrencySwitcher() {
  const { currency, setCurrency, isLoading } = useCurrency();

  return (
    <Select
      value={currency}
      onChange={(e) => setCurrency(e.target.value as Currency)}
      disabled={isLoading}
      aria-label="Select currency"
    >
      {currencies.map((curr) => (
        <option key={curr.code} value={curr.code}>
          {curr.symbol} {curr.code}
        </option>
      ))}
    </Select>
  );
}

// Usage: Display price with currency conversion
'use client';

import { useCurrency } from '@/contexts/CurrencyContext';
import { useEffect, useState } from 'react';
import { convertCurrency, formatCurrency } from '@/lib/currency.utils';
import { Currency } from '@/config/currency.config';

export function ProductPrice({ price, baseCurrency = Currency.TRY }) {
  const { currency } = useCurrency();
  const [convertedPrice, setConvertedPrice] = useState(price);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const convert = async () => {
      if (currency === baseCurrency) {
        setConvertedPrice(price);
        return;
      }

      setIsLoading(true);
      const converted = await convertCurrency(price, baseCurrency, currency);
      setConvertedPrice(converted);
      setIsLoading(false);
    };

    convert();
  }, [price, currency, baseCurrency]);

  if (isLoading) {
    return <span className="animate-pulse">...</span>;
  }

  return <span>{formatCurrency(convertedPrice, currency)}</span>;
}
```

---

### 5. Localized Product Content (18 items)

#### 5.1 Database Schema for Translations (8 items)
- [ ] Add `translations` JSON field to Product model
- [ ] Store translations: `{ tr: { name, description }, en: {...}, de: {...} }`
- [ ] Create migration for translations field
- [ ] Add default translation (Turkish) for all existing products
- [ ] Add `translations` field to Category model
- [ ] Create helper function to get translated content
- [ ] Add validation for required translations (at least default locale)
- [ ] Test translation storage and retrieval

#### 5.2 Admin Translation UI (10 items)
- [ ] Add translation tabs to product form (TR, EN, DE)
- [ ] Allow admins to add translations for each language
- [ ] Display translation status (translated/not translated)
- [ ] Add bulk translation import from CSV
- [ ] Add translation copy from default language
- [ ] Validate required fields for each language
- [ ] Show translation completeness percentage
- [ ] Add translation search in admin
- [ ] Export translations to CSV
- [ ] Test translation management workflow

**Example**:
```typescript
// prisma/schema.prisma
model Product {
  id          String   @id @default(cuid())
  sku         String   @unique
  price       Float
  stock       Int

  // Default content (Turkish)
  name        String
  description String

  // Translations for other languages
  translations Json?  // { en: { name, description }, de: { name, description } }

  // ... other fields
}

// Translation structure
interface ProductTranslations {
  en?: {
    name: string;
    description: string;
  };
  de?: {
    name: string;
    description: string;
  };
}

// src/utils/translation.utils.ts
export const getLocalizedContent = (
  product: Product,
  locale: string,
  field: 'name' | 'description'
): string => {
  // Return default (Turkish) if locale is 'tr' or translations not available
  if (locale === 'tr' || !product.translations) {
    return product[field];
  }

  const translations = product.translations as ProductTranslations;

  // Return localized content or fallback to default
  return translations[locale]?.[field] || product[field];
};

// Usage in component
import { useLocale } from 'next-intl';

export function ProductCard({ product }) {
  const locale = useLocale();

  const name = getLocalizedContent(product, locale, 'name');
  const description = getLocalizedContent(product, locale, 'description');

  return (
    <div>
      <h3>{name}</h3>
      <p>{description}</p>
    </div>
  );
}

// Admin product form with translations
'use client';

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export function ProductForm({ product }) {
  const [activeTab, setActiveTab] = useState('tr');
  const [translations, setTranslations] = useState(product?.translations || {});

  const handleTranslationChange = (locale: string, field: string, value: string) => {
    setTranslations({
      ...translations,
      [locale]: {
        ...translations[locale],
        [field]: value
      }
    });
  };

  return (
    <form>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="tr">🇹🇷 Türkçe</TabsTrigger>
          <TabsTrigger value="en">🇬🇧 English</TabsTrigger>
          <TabsTrigger value="de">🇩🇪 Deutsch</TabsTrigger>
        </TabsList>

        <TabsContent value="tr">
          <div className="space-y-4">
            <Input
              label="Product Name (Turkish)"
              name="name"
              defaultValue={product?.name}
              required
            />
            <Textarea
              label="Description (Turkish)"
              name="description"
              defaultValue={product?.description}
              required
            />
          </div>
        </TabsContent>

        <TabsContent value="en">
          <div className="space-y-4">
            <Input
              label="Product Name (English)"
              value={translations.en?.name || ''}
              onChange={(e) => handleTranslationChange('en', 'name', e.target.value)}
            />
            <Textarea
              label="Description (English)"
              value={translations.en?.description || ''}
              onChange={(e) => handleTranslationChange('en', 'description', e.target.value)}
            />
          </div>
        </TabsContent>

        <TabsContent value="de">
          <div className="space-y-4">
            <Input
              label="Product Name (German)"
              value={translations.de?.name || ''}
              onChange={(e) => handleTranslationChange('de', 'name', e.target.value)}
            />
            <Textarea
              label="Description (German)"
              value={translations.de?.description || ''}
              onChange={(e) => handleTranslationChange('de', 'description', e.target.value)}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Hidden field to store translations */}
      <input type="hidden" name="translations" value={JSON.stringify(translations)} />
    </form>
  );
}
```

---

### 6. SEO & Localized URLs (14 items)

#### 6.1 Localized Metadata (8 items)
- [ ] Add localized page titles for each language
- [ ] Add localized meta descriptions for each language
- [ ] Add hreflang tags for language alternatives
- [ ] Add Open Graph tags with locale
- [ ] Generate localized sitemap.xml (one per language)
- [ ] Add canonical URLs with locale prefix
- [ ] Test metadata in different languages
- [ ] Validate hreflang implementation

#### 6.2 URL Structure (6 items)
- [ ] Implement localized URLs: /tr/products, /en/products, /de/products
- [ ] Configure Next.js routing for locales
- [ ] Add language switcher with proper redirects
- [ ] Preserve query parameters on language switch
- [ ] Test URL routing for all locales
- [ ] Monitor SEO performance per locale

**Example**:
```typescript
// app/[locale]/layout.tsx
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({ params: { locale } }) {
  const t = await getTranslations({ locale, namespace: 'Metadata' });

  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: `https://lumi.com/${locale}`,
      languages: {
        'tr': 'https://lumi.com/tr',
        'en': 'https://lumi.com/en',
        'de': 'https://lumi.com/de'
      }
    },
    openGraph: {
      title: t('title'),
      description: t('description'),
      locale: locale,
      alternateLocale: ['tr', 'en', 'de'].filter(l => l !== locale)
    }
  };
}

// app/[locale]/products/[id]/page.tsx
export async function generateMetadata({ params: { locale, id } }) {
  const product = await fetchProduct(id);
  const name = getLocalizedContent(product, locale, 'name');
  const description = getLocalizedContent(product, locale, 'description');

  return {
    title: name,
    description: description,
    alternates: {
      canonical: `https://lumi.com/${locale}/products/${id}`,
      languages: {
        'tr': `https://lumi.com/tr/products/${id}`,
        'en': `https://lumi.com/en/products/${id}`,
        'de': `https://lumi.com/de/products/${id}`
      }
    }
  };
}

// Generate sitemap per locale
// app/sitemap.ts
import { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await prisma.product.findMany({ where: { isActive: true } });
  const locales = ['tr', 'en', 'de'];

  const productUrls = products.flatMap(product =>
    locales.map(locale => ({
      url: `https://lumi.com/${locale}/products/${product.id}`,
      lastModified: product.updatedAt,
      alternates: {
        languages: locales.reduce((acc, l) => ({
          ...acc,
          [l]: `https://lumi.com/${l}/products/${product.id}`
        }), {})
      }
    }))
  );

  return [
    ...locales.map(locale => ({
      url: `https://lumi.com/${locale}`,
      lastModified: new Date()
    })),
    ...productUrls
  ];
}
```

---

### 7. Testing & Validation (16 items)

#### 7.1 Translation Testing (8 items)
- [ ] Verify all UI elements are translated
- [ ] Test pluralization with different counts (0, 1, 2, 100)
- [ ] Test date formatting in all locales
- [ ] Test number formatting in all locales
- [ ] Test currency formatting in all locales
- [ ] Check for missing translation keys
- [ ] Test language switching preserves page state
- [ ] Validate translation file completeness

#### 7.2 Currency Testing (8 items)
- [ ] Test currency conversion accuracy
- [ ] Test exchange rate caching
- [ ] Test fallback rates when API fails
- [ ] Test currency switching updates all prices
- [ ] Test currency persistence in cookie
- [ ] Test checkout with different currencies
- [ ] Test payment integration with selected currency
- [ ] Monitor exchange rate API reliability

---

## 📊 SUCCESS METRICS

### Coverage Metrics
- Translation coverage: 100% for core UI elements
- Supported languages: 3 (TR, EN, DE)
- Supported currencies: 3 (TRY, USD, EUR)
- Product translations: >80% of products translated

### Performance Metrics
- Language switch time: <100ms (no reload)
- Currency switch time: <300ms (with conversion)
- Exchange rate API response: <500ms
- Translation file load time: <50ms

### Business Metrics
- International traffic: +15% (after multi-language launch)
- Conversion rate (international users): +20%
- Average order value (USD/EUR): tracked separately
- Bounce rate (non-Turkish users): -25%

---

## 📦 DELIVERABLES

### Backend Deliverables
- [ ] `src/i18n.ts` - next-intl configuration
- [ ] `src/services/exchange-rate.service.ts` - Exchange rate fetching
- [ ] `src/utils/currency.utils.ts` - Currency conversion utilities
- [ ] `src/utils/translation.utils.ts` - Translation helpers
- [ ] `prisma/schema.prisma` - Translations field added
- [ ] Exchange rate cron job

### Frontend Deliverables
- [ ] `messages/tr.json` - Turkish translations
- [ ] `messages/en.json` - English translations
- [ ] `messages/de.json` - German translations
- [ ] `src/components/i18n/LanguageSwitcher.tsx` - Language switcher
- [ ] `src/components/i18n/CurrencySwitcher.tsx` - Currency switcher
- [ ] `src/contexts/CurrencyContext.tsx` - Currency context
- [ ] `middleware.ts` - Locale detection middleware
- [ ] Localized metadata and sitemaps

### Documentation Deliverables
- [ ] i18n implementation guide
- [ ] Translation management guide
- [ ] Currency conversion guide
- [ ] Admin translation workflow documentation

---

## 📝 PHASE COMPLETION REPORT TEMPLATE

```markdown
# Phase 14: Multi-Language & Currency - Completion Report

## ✅ Completed Items
- i18n Setup: X/24 items
- Language Switcher: X/16 items
- Multi-Currency Support: X/28 items
- Currency Switcher: X/14 items
- Localized Product Content: X/18 items
- SEO & Localized URLs: X/14 items
- Testing & Validation: X/16 items

**Total Progress**: X/130 items (X%)

## 📊 Metrics Achieved
- Translation coverage: X%
- Supported languages: 3 (TR, EN, DE)
- Supported currencies: 3 (TRY, USD, EUR)
- Language switch time: Xms
- Currency switch time: Xms
- Product translations: X%

## 🎯 Functional Validation
- Language Switching: ✅ Working across all pages
- Currency Switching: ✅ Real-time price updates
- Translations: ✅ All UI elements translated
- Exchange Rates: ✅ Auto-updating every hour
- Localized URLs: ✅ SEO-friendly URLs
- Metadata: ✅ Localized for each language

## 🚧 Known Issues / Technical Debt
- [ ] Issue 1 description
- [ ] Issue 2 description

## 📚 Documentation
- [ ] i18n guide created
- [ ] Translation management documented
- [ ] Currency conversion guide created

## 👥 Phase Review
**Reviewed by**: [Name]
**Date**: [Date]
**Approved**: ✅ / ⏸️ / ❌

**Next Phase**: Phase 15 - Analytics & Reporting (Google Analytics, Custom Dashboards)
```

---

**END OF PHASE 14 DOCUMENTATION**
**Total Checklist Items**: 130 items
**Estimated Completion Time**: 5-7 days
**Dependencies**: Phases 2, 4, 6, 8, 10 must be completed first
**Next Phase**: Phase 15 - Analytics & Reporting

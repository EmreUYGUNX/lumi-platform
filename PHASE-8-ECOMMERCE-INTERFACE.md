# 🚀 PHASE 8: E-COMMERCE CUSTOMER INTERFACE

**Status**: 🔄 **IN PROGRESS**
**Priority**: 🔴 CRITICAL
**Dependencies**: Phase 0-7
**Estimated Time**: 18 days
**Complexity**: Enterprise-Level

---

## 📋 DOCUMENT OVERVIEW

**Version**: 1.0
**Last Updated**: 2025-10-01
**Phase Code**: PHASE-8
**Module Focus**: Complete E-commerce Storefront Experience
**Expected Lines of Code**: ~18,400 lines
**Test Coverage Target**: ≥80%
**Network Timeout Tests**: 10s+ requests validated

---

## 🎯 PHASE OBJECTIVES

### Primary Goals

1. **Homepage** - Hero section, featured products, category showcase, newsletter signup (deneme.html style)
2. **Product Catalog** - Grid/list views, advanced filtering, search, sorting, infinite scroll
3. **Product Detail** - Image gallery with zoom, variant selection, reviews & ratings, related products
4. **Shopping Cart** - Mini cart dropdown, full cart page, quantity updates, price calculations
5. **Checkout Flow** - Multi-step wizard (shipping, payment, review), address forms, order confirmation
6. **SEO Optimization** - Dynamic metadata, Open Graph, JSON-LD schema, canonical URLs
7. **Performance** - LCP <1.9s, bundle <180KB, lazy loading, code splitting
8. **Mobile-First** - Responsive design, touch gestures, PWA-ready

### Success Criteria

- ✅ Homepage with deneme.html aesthetic (hero, animations, glassmorphism)
- ✅ Product catalog with filters (category, price, attributes, rating)
- ✅ Product detail with image zoom, variant selection, add to cart
- ✅ Mini cart + full cart with real-time updates
- ✅ Multi-step checkout wizard with state persistence
- ✅ SEO: Product schema, breadcrumbs, dynamic metadata
- ✅ Lighthouse Performance ≥90 (mobile & desktop)
- ✅ LCP <1.9s, CLS <0.1
- ✅ Test coverage ≥80%
- ✅ Mobile responsive (375px - 1440px)

---

## 🎯 CRITICAL REQUIREMENTS

### Performance Standards (P1/P2)

**P1: Data Loading**
- TanStack Query caching for product lists
- Server-side pagination
- Skeleton placeholders during loading
- Initial payload <180KB
- No N+1 queries

**P2: Image Optimization**
- Next.js Image with Cloudinary loader
- LCP image prioritized (priority flag)
- Below-fold images lazy loaded
- WebP + AVIF variants
- Responsive image sizes

**P2: Code Splitting**
- Route-based splitting (automatic)
- Dynamic imports for heavy components
- Lazy load product gallery
- Lazy load checkout steps

### SEO Requirements

**Metadata API**
- Dynamic page titles
- Meta descriptions
- Open Graph tags (og:title, og:image, og:description)
- Twitter Card tags
- Canonical URLs

**JSON-LD Schema**
```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Product Name",
  "image": ["url1", "url2"],
  "description": "Product description",
  "sku": "SKU123",
  "brand": {
    "@type": "Brand",
    "name": "Lumi"
  },
  "offers": {
    "@type": "Offer",
    "price": "99.99",
    "priceCurrency": "TRY",
    "availability": "https://schema.org/InStock"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.5",
    "reviewCount": "89"
  }
}
```

### Security Standards (S2)

**S2: Input Sanitization**
- Search queries sanitized
- Newsletter email validated
- Contact form inputs sanitized
- reCAPTCHA fallback on forms
- CSRF tokens on checkout

### Design Standards (B1)

**B1: Brand Consistency**
- deneme.html color palette only
- Glassmorphism effects
- Neon highlights on CTAs
- Gradient overlays
- Smooth animations (Framer Motion + GSAP)

---

## 🏗️ ARCHITECTURE OVERVIEW

### Directory Structure

```
apps/frontend/
├── app/
│   ├── (public)/
│   │   ├── page.tsx                    # Homepage
│   │   ├── about/
│   │   ├── contact/
│   │   └── layout.tsx
│   ├── (shop)/
│   │   ├── products/
│   │   │   ├── page.tsx                # Product catalog
│   │   │   ├── [slug]/
│   │   │   │   └── page.tsx            # Product detail
│   │   │   ├── loading.tsx
│   │   │   └── error.tsx
│   │   ├── categories/
│   │   │   └── [slug]/
│   │   │       └── page.tsx            # Category page
│   │   ├── search/
│   │   │   └── page.tsx                # Search results
│   │   └── layout.tsx                  # Shop layout
│   ├── (checkout)/
│   │   ├── cart/
│   │   │   └── page.tsx                # Full cart
│   │   ├── checkout/
│   │   │   ├── page.tsx                # Checkout wizard
│   │   │   ├── shipping/
│   │   │   ├── payment/
│   │   │   ├── review/
│   │   │   └── success/
│   │   │       └── page.tsx            # Order confirmation
│   │   └── layout.tsx
│   └── wishlist/
│       └── page.tsx
├── src/
│   ├── features/
│   │   ├── catalog/
│   │   │   ├── components/
│   │   │   │   ├── ProductGrid.tsx
│   │   │   │   ├── ProductCard.tsx
│   │   │   │   ├── ProductFilters.tsx
│   │   │   │   ├── FilterSidebar.tsx
│   │   │   │   ├── SortDropdown.tsx
│   │   │   │   ├── PriceRangeSlider.tsx
│   │   │   │   └── CategoryNav.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useProducts.ts
│   │   │   │   ├── useProductFilters.ts
│   │   │   │   ├── useProductSearch.ts
│   │   │   │   └── useInfiniteProducts.ts
│   │   │   ├── queries/
│   │   │   ├── schemas/
│   │   │   └── __tests__/
│   │   ├── product/
│   │   │   ├── components/
│   │   │   │   ├── ProductGallery.tsx
│   │   │   │   ├── ImageZoom.tsx
│   │   │   │   ├── VariantSelector.tsx
│   │   │   │   ├── ProductInfo.tsx
│   │   │   │   ├── AddToCartButton.tsx
│   │   │   │   ├── AddToWishlistButton.tsx
│   │   │   │   ├── ProductTabs.tsx
│   │   │   │   ├── ReviewsList.tsx
│   │   │   │   ├── ReviewForm.tsx
│   │   │   │   ├── RatingStars.tsx
│   │   │   │   └── RelatedProducts.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useProduct.ts
│   │   │   │   ├── useVariantSelection.ts
│   │   │   │   └── useProductReviews.ts
│   │   │   └── __tests__/
│   │   ├── cart/
│   │   │   ├── components/
│   │   │   │   ├── MiniCart.tsx
│   │   │   │   ├── CartDrawer.tsx
│   │   │   │   ├── CartItem.tsx
│   │   │   │   ├── CartSummary.tsx
│   │   │   │   └── CartEmpty.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useCart.ts
│   │   │   │   ├── useAddToCart.ts
│   │   │   │   ├── useUpdateCartItem.ts
│   │   │   │   ├── useRemoveCartItem.ts
│   │   │   │   └── useClearCart.ts
│   │   │   ├── store/
│   │   │   │   └── cart.store.ts        # Zustand
│   │   │   └── __tests__/
│   │   ├── checkout/
│   │   │   ├── components/
│   │   │   │   ├── CheckoutWizard.tsx
│   │   │   │   ├── CheckoutProgress.tsx
│   │   │   │   ├── ShippingForm.tsx
│   │   │   │   ├── PaymentForm.tsx
│   │   │   │   ├── OrderReview.tsx
│   │   │   │   ├── OrderSummary.tsx
│   │   │   │   └── OrderConfirmation.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useCheckout.ts
│   │   │   │   ├── useCreateOrder.ts
│   │   │   │   └── useCheckoutState.ts
│   │   │   ├── store/
│   │   │   │   └── checkout.store.ts    # Zustand
│   │   │   └── __tests__/
│   │   ├── wishlist/
│   │   │   ├── components/
│   │   │   │   ├── WishlistGrid.tsx
│   │   │   │   └── WishlistItem.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useWishlist.ts
│   │   │   │   ├── useAddToWishlist.ts
│   │   │   │   └── useRemoveFromWishlist.ts
│   │   │   └── __tests__/
│   │   └── homepage/
│   │       ├── components/
│   │       │   ├── Hero.tsx
│   │       │   ├── FeaturedProducts.tsx
│   │       │   ├── CategoryShowcase.tsx
│   │       │   ├── NewsletterSignup.tsx
│   │       │   └── Testimonials.tsx
│   │       └── __tests__/
│   ├── components/
│   │   ├── ui/
│   │   │   ├── ProductCard.tsx
│   │   │   ├── PriceDisplay.tsx
│   │   │   ├── RatingDisplay.tsx
│   │   │   ├── Badge.tsx
│   │   │   └── Skeleton.tsx
│   │   └── layout/
│   │       ├── Header.tsx
│   │       ├── MegaMenu.tsx
│   │       ├── SearchBar.tsx
│   │       ├── CartIcon.tsx
│   │       └── Footer.tsx
│   ├── lib/
│   │   ├── formatters/
│   │   │   ├── price.ts
│   │   │   ├── date.ts
│   │   │   └── number.ts
│   │   ├── seo/
│   │   │   ├── metadata.ts
│   │   │   ├── schema.ts
│   │   │   └── __tests__/
│   │   │       └── schema.test.ts
│   │   └── analytics/
│   │       ├── events.ts
│   │       └── tracking.ts
│   └── store/
│       ├── cart.ts
│       └── filters.ts
└── public/
    └── images/
        ├── hero/
        ├── categories/
        └── placeholders/
```

---

## ✅ IMPLEMENTATION CHECKLIST

### 1. Homepage (34 items)

#### 1.1 Hero Section
- [ ] Create `Hero.tsx` component
  - [ ] Full-screen hero with deneme.html style
  - [ ] Background video/image with overlay
  - [ ] Glassmorphism card overlay
  - [ ] Headline with gradient text
  - [ ] Subheadline with neon glow
  - [ ] CTA buttons (Shop Now, Learn More)
  - [ ] Scroll indicator with animation
  - [ ] GSAP parallax effect on scroll
- [ ] Implement responsive breakpoints
  - [ ] Mobile: Stacked layout
  - [ ] Tablet: 60/40 split
  - [ ] Desktop: Full-screen immersive

#### 1.2 Featured Products
- [ ] Create `FeaturedProducts.tsx` component
  - [ ] Section title with animated underline
  - [ ] Product carousel (Swiper/Embla)
  - [ ] Product cards with hover effects
  - [ ] Quick view button
  - [ ] Add to cart quick action
  - [ ] Navigation arrows
  - [ ] Pagination dots
  - [ ] Auto-play with pause on hover
- [ ] Fetch featured products
  - [ ] useQuery hook
  - [ ] Cache for 5 minutes
  - [ ] Loading skeleton
  - [ ] Error state

#### 1.3 Category Showcase
- [ ] Create `CategoryShowcase.tsx` component
  - [ ] Grid layout (2x3 on desktop, 2x2 on mobile)
  - [ ] Category cards with image
  - [ ] Category name overlay
  - [ ] Product count badge
  - [ ] Hover zoom effect
  - [ ] Link to category page

#### 1.4 Newsletter Signup
- [ ] Create `NewsletterSignup.tsx` component
  - [ ] Section with background gradient
  - [ ] Email input with validation
  - [ ] Subscribe button with loading state
  - [ ] Privacy policy link
  - [ ] Success toast on subscribe
  - [ ] Error handling
- [ ] Create `useNewsletterSignup` hook
  - [ ] useMutation for subscription
  - [ ] Email validation (Zod)
  - [ ] Sanitize email input (S2)
  - [ ] Analytics event tracking

#### 1.5 Testimonials Section
- [ ] Create `Testimonials.tsx` component
  - [ ] Testimonial carousel
  - [ ] Customer avatar
  - [ ] Quote with stars
  - [ ] Customer name and role
  - [ ] Auto-rotate every 5s

#### 1.6 SEO & Metadata
- [ ] Homepage metadata
  - [ ] Title: "Lumi - Modern E-commerce Platform"
  - [ ] Description (155 chars)
  - [ ] Open Graph tags
  - [ ] Twitter Card tags
- [ ] JSON-LD schema
  - [ ] Organization schema
  - [ ] WebSite schema with search action

---

### 2. Product Catalog (46 items)

#### 2.1 Product List Page
- [ ] Create `app/(shop)/products/page.tsx`
- [ ] Create `ProductGrid.tsx` component
  - [ ] Grid layout (responsive: 1-4 columns)
  - [ ] Product cards with consistent styling
  - [ ] Empty state (no products found)
  - [ ] Loading skeleton (24 items)

#### 2.2 Product Card
- [ ] Create `ProductCard.tsx` component
  - [ ] Product image with aspect ratio 1:1
  - [ ] Product title (2 lines, ellipsis)
  - [ ] Price display (current + compare-at)
  - [ ] Rating stars + review count
  - [ ] Badge (New, Sale, Out of Stock)
  - [ ] Quick add to cart button
  - [ ] Add to wishlist icon
  - [ ] Hover effects (lift, shadow)
  - [ ] Link to product detail page

#### 2.3 Filters & Search
- [ ] Create `FilterSidebar.tsx` component
  - [ ] Category filter (tree structure)
  - [ ] Price range slider (min-max)
  - [ ] Attribute filters (size, color, brand)
  - [ ] Rating filter (stars)
  - [ ] Availability filter (in stock)
  - [ ] Apply filters button
  - [ ] Clear all filters button
  - [ ] Active filters display
  - [ ] Collapsible sections
- [ ] Create `SearchBar.tsx` component
  - [ ] Search input with icon
  - [ ] Search suggestions dropdown
  - [ ] Debounced search (300ms)
  - [ ] Recent searches
  - [ ] Popular searches
  - [ ] Clear search button
- [ ] Create `useProductFilters` hook
  - [ ] Filter state management
  - [ ] URL sync (query params)
  - [ ] Apply filters to query
  - [ ] Reset filters

#### 2.4 Sorting & Pagination
- [ ] Create `SortDropdown.tsx` component
  - [ ] Sort options:
    - [ ] Relevance (default)
    - [ ] Price: Low to High
    - [ ] Price: High to Low
    - [ ] Newest First
    - [ ] Rating: High to Low
  - [ ] Update URL param on change
- [ ] Implement pagination
  - [ ] Page-based pagination (default)
  - [ ] Infinite scroll (optional, toggle)
  - [ ] Load more button
  - [ ] Results count display
  - [ ] Items per page (24, 48, 96)

#### 2.5 Data Fetching
- [ ] Create `useProducts` hook
  - [ ] useQuery with filters
  - [ ] Cache for 60s
  - [ ] Pagination support
  - [ ] SSR hydration
- [ ] Create `useInfiniteProducts` hook
  - [ ] useInfiniteQuery
  - [ ] Load next page
  - [ ] Has more pages check
- [ ] Create `useProductSearch` hook
  - [ ] Debounced search
  - [ ] Search suggestions
  - [ ] Analytics tracking

---

### 3. Product Detail Page (52 items)

#### 3.1 Product Gallery
- [ ] Create `ProductGallery.tsx` component
  - [ ] Main image display
  - [ ] Thumbnail strip (horizontal scroll)
  - [ ] Image navigation (prev/next)
  - [ ] Image zoom on hover (desktop)
  - [ ] Image zoom modal (mobile)
  - [ ] Full-screen lightbox
  - [ ] Keyboard navigation (arrow keys)
  - [ ] Touch gestures (swipe)
  - [ ] Video support (if available)
- [ ] Create `ImageZoom.tsx` component
  - [ ] Magnifying glass effect
  - [ ] Pan on mouse move
  - [ ] Smooth zoom in/out

#### 3.2 Product Information
- [ ] Create `ProductInfo.tsx` component
  - [ ] Product title (H1)
  - [ ] SKU display
  - [ ] Brand name with link
  - [ ] Rating stars + review count (link to reviews)
  - [ ] Price display
    - [ ] Current price
    - [ ] Compare-at price (strikethrough)
    - [ ] Discount percentage badge
  - [ ] Stock status badge (In Stock, Low Stock, Out of Stock)
  - [ ] Short description
  - [ ] Share buttons (social media)

#### 3.3 Variant Selection
- [ ] Create `VariantSelector.tsx` component
  - [ ] Attribute options (size, color, etc.)
  - [ ] Visual swatches for colors
  - [ ] Text buttons for sizes
  - [ ] Disabled state for out-of-stock variants
  - [ ] Update price on variant change
  - [ ] Update images on variant change
  - [ ] URL sync (variant in query param)
- [ ] Create `useVariantSelection` hook
  - [ ] Selected variant state
  - [ ] Validate variant availability
  - [ ] Update URL on selection

#### 3.4 Add to Cart
- [ ] Create `AddToCartButton.tsx` component
  - [ ] Quantity selector (+ / -)
  - [ ] Min: 1, Max: 10 (or stock level)
  - [ ] Add to cart button
    - [ ] Loading state
    - [ ] Success animation
    - [ ] Error state
  - [ ] Size guide link (modal)
  - [ ] Stock countdown (if low stock)
- [ ] Create `useAddToCart` hook
  - [ ] useMutation for add to cart
  - [ ] Optimistic update
  - [ ] Cache invalidation
  - [ ] Success toast
  - [ ] Analytics event

#### 3.5 Product Tabs
- [ ] Create `ProductTabs.tsx` component
  - [ ] Description tab
    - [ ] Full product description (HTML)
    - [ ] Features list
    - [ ] Specifications table
  - [ ] Reviews tab
    - [ ] Review statistics
    - [ ] Review filters (rating)
    - [ ] Review list
    - [ ] Write review button
  - [ ] Shipping & Returns tab
    - [ ] Shipping policy
    - [ ] Return policy
    - [ ] Delivery estimates

#### 3.6 Reviews & Ratings
- [ ] Create `ReviewsList.tsx` component
  - [ ] Review cards
  - [ ] Reviewer name and avatar
  - [ ] Rating stars
  - [ ] Review text
  - [ ] Review date (relative)
  - [ ] Verified purchase badge
  - [ ] Helpful votes (thumbs up)
  - [ ] Pagination (load more)
- [ ] Create `ReviewForm.tsx` component
  - [ ] Rating input (star selector)
  - [ ] Review title input
  - [ ] Review text textarea
  - [ ] Image upload (optional)
  - [ ] Submit button with validation
  - [ ] Requires authentication
- [ ] Create `useProductReviews` hook
  - [ ] Fetch reviews
  - [ ] Submit review mutation
  - [ ] Vote helpful mutation

#### 3.7 Related Products
- [ ] Create `RelatedProducts.tsx` component
  - [ ] Section title
  - [ ] Product carousel
  - [ ] "You may also like" algorithm
  - [ ] Same category products

#### 3.8 SEO & Schema
- [ ] Product metadata
  - [ ] Dynamic title: "{Product Name} | Lumi"
  - [ ] Meta description (from product)
  - [ ] Open Graph image (main product image)
- [ ] Product JSON-LD schema
  - [ ] Product type
  - [ ] Name, description, image
  - [ ] SKU, brand
  - [ ] Offers (price, availability)
  - [ ] AggregateRating
- [ ] Breadcrumb schema

---

### 4. Shopping Cart (38 items)

#### 4.1 Cart State Management
- [ ] Create `cart.store.ts` (Zustand)
  - [ ] Cart items state
  - [ ] Add item action
  - [ ] Update item quantity action
  - [ ] Remove item action
  - [ ] Clear cart action
  - [ ] Calculate subtotal
  - [ ] Calculate tax (estimated)
  - [ ] Calculate total
  - [ ] Persist to sessionStorage

#### 4.2 Mini Cart
- [ ] Create `MiniCart.tsx` component
  - [ ] Cart icon in header with badge (item count)
  - [ ] Dropdown/drawer on click
  - [ ] Cart item list (max 5 items)
  - [ ] Item thumbnail
  - [ ] Item title (truncated)
  - [ ] Item price
  - [ ] Item quantity
  - [ ] Remove button
  - [ ] Subtotal display
  - [ ] View cart button
  - [ ] Checkout button
  - [ ] Empty cart state
- [ ] Create `CartDrawer.tsx` component
  - [ ] Slide-in from right
  - [ ] Overlay background
  - [ ] Close button
  - [ ] Same content as dropdown

#### 4.3 Full Cart Page
- [ ] Create `app/(checkout)/cart/page.tsx`
- [ ] Create cart item list
  - [ ] Product image (link to product)
  - [ ] Product title and variant
  - [ ] Unit price
  - [ ] Quantity selector (inline)
  - [ ] Line total
  - [ ] Remove button
  - [ ] Move to wishlist button
- [ ] Create `CartSummary.tsx` component
  - [ ] Subtotal
  - [ ] Shipping (calculated at checkout)
  - [ ] Tax estimate
  - [ ] Total
  - [ ] Promo code input
  - [ ] Apply button
  - [ ] Discount display (if applied)
  - [ ] Proceed to checkout button
  - [ ] Continue shopping link
- [ ] Create `CartEmpty.tsx` component
  - [ ] Empty state illustration
  - [ ] Message: "Your cart is empty"
  - [ ] Browse products button
  - [ ] Recently viewed products

#### 4.4 Cart Operations
- [ ] Create `useCart` hook (query)
  - [ ] Fetch cart from API
  - [ ] Merge with local cart
  - [ ] SSR support
- [ ] Create `useAddToCart` hook (mutation)
  - [ ] Add item to cart
  - [ ] Update quantity if exists
  - [ ] Optimistic update
  - [ ] Success toast with animation
- [ ] Create `useUpdateCartItem` hook
  - [ ] Update quantity
  - [ ] Validate stock
  - [ ] Optimistic update
- [ ] Create `useRemoveCartItem` hook
  - [ ] Remove item
  - [ ] Confirm modal (optional)
  - [ ] Optimistic update
- [ ] Create `useClearCart` hook
  - [ ] Clear all items
  - [ ] Confirm modal

---

### 5. Checkout Flow (44 items)

#### 5.1 Checkout Wizard
- [ ] Create `CheckoutWizard.tsx` component
  - [ ] Multi-step form (3 steps)
  - [ ] Step indicator with progress
  - [ ] Back/Next navigation
  - [ ] Step validation before proceeding
  - [ ] State persistence (Zustand + sessionStorage)
  - [ ] URL sync (step in query param)

#### 5.2 Step 1: Shipping Address
- [ ] Create `ShippingForm.tsx` component
  - [ ] Use existing address (if logged in)
    - [ ] Address selector (radio buttons)
    - [ ] New address option
  - [ ] Address form (if new)
    - [ ] Full name input
    - [ ] Email input (if guest)
    - [ ] Phone number input
    - [ ] Address line 1 input
    - [ ] Address line 2 input (optional)
    - [ ] City input
    - [ ] State/Province select
    - [ ] Postal code input
    - [ ] Country select
    - [ ] Save address checkbox (if logged in)
  - [ ] Shipping method selector
    - [ ] Standard (5-7 days) - Free
    - [ ] Express (2-3 days) - ₺20
    - [ ] Next Day - ₺40
  - [ ] Continue to payment button

#### 5.3 Step 2: Payment (Placeholder)
- [ ] Create `PaymentForm.tsx` component
  - [ ] Placeholder for Phase 10
  - [ ] Message: "Payment integration coming soon"
  - [ ] Continue to review button

#### 5.4 Step 3: Order Review
- [ ] Create `OrderReview.tsx` component
  - [ ] Order summary
    - [ ] Line items with image, title, quantity, price
    - [ ] Subtotal
    - [ ] Shipping cost
    - [ ] Tax
    - [ ] Total
  - [ ] Shipping address review
    - [ ] Edit button (goes back to step 1)
  - [ ] Billing address (same as shipping by default)
  - [ ] Payment method review (placeholder)
  - [ ] Terms & conditions checkbox
  - [ ] Privacy policy checkbox
  - [ ] Place order button with loading state

#### 5.5 Order Confirmation
- [ ] Create `app/(checkout)/checkout/success/page.tsx`
- [ ] Create `OrderConfirmation.tsx` component
  - [ ] Success animation (checkmark)
  - [ ] Order number display
  - [ ] Thank you message
  - [ ] Order summary
  - [ ] Estimated delivery date
  - [ ] Order tracking link
  - [ ] Continue shopping button
  - [ ] Print receipt button

#### 5.6 Checkout State
- [ ] Create `checkout.store.ts` (Zustand)
  - [ ] Current step
  - [ ] Shipping address
  - [ ] Shipping method
  - [ ] Billing address
  - [ ] Payment method (placeholder)
  - [ ] Order notes
  - [ ] Actions to navigate steps
  - [ ] Persist to sessionStorage
- [ ] Create `useCheckout` hook
  - [ ] Access checkout state
  - [ ] Validation per step
- [ ] Create `useCreateOrder` hook (mutation)
  - [ ] Submit order to API
  - [ ] Clear cart on success
  - [ ] Clear checkout state
  - [ ] Redirect to confirmation
  - [ ] Analytics event

---

### 6. Wishlist (16 items)

#### 6.1 Wishlist Page
- [ ] Create `app/wishlist/page.tsx`
- [ ] Create `WishlistGrid.tsx` component
  - [ ] Grid layout (same as product catalog)
  - [ ] Wishlist item cards
  - [ ] Empty state
  - [ ] Loading skeleton

#### 6.2 Wishlist Item
- [ ] Create `WishlistItem.tsx` component
  - [ ] Product image
  - [ ] Product title
  - [ ] Price
  - [ ] Stock status
  - [ ] Add to cart button
  - [ ] Remove from wishlist button

#### 6.3 Wishlist Operations
- [ ] Create `useWishlist` hook (query)
  - [ ] Fetch wishlist
  - [ ] Requires authentication
- [ ] Create `useAddToWishlist` hook (mutation)
  - [ ] Add product to wishlist
  - [ ] Optimistic update
  - [ ] Success toast
  - [ ] Analytics event
- [ ] Create `useRemoveFromWishlist` hook (mutation)
  - [ ] Remove product
  - [ ] Optimistic update

---

### 7. SEO & Metadata (22 items)

#### 7.1 Metadata Helpers
- [ ] Create `src/lib/seo/metadata.ts`
  - [ ] `generateMetadata()` helper
  - [ ] Dynamic title generation
  - [ ] Dynamic description
  - [ ] Open Graph tags
  - [ ] Twitter Card tags
  - [ ] Canonical URL

#### 7.2 JSON-LD Schema Builders
- [ ] Create `src/lib/seo/schema.ts`
  - [ ] `buildProductSchema(product)`
  - [ ] `buildBreadcrumbSchema(path)`
  - [ ] `buildOrganizationSchema()`
  - [ ] `buildWebSiteSchema()`
  - [ ] `buildSearchActionSchema()`
- [ ] Create `src/lib/seo/__tests__/schema.test.ts`
  - [ ] Test product schema output
  - [ ] Test breadcrumb schema
  - [ ] Validate against schema.org spec

#### 7.3 Sitemap Generation
- [ ] Install `next-sitemap`: `pnpm add next-sitemap`
- [ ] Create `next-sitemap.config.js`
  - [ ] Include product pages
  - [ ] Include category pages
  - [ ] Exclude admin pages
  - [ ] Set priority and change frequency
- [ ] Generate sitemap on build

#### 7.4 Robots.txt
- [ ] Create `public/robots.txt`
  - [ ] Allow all search engines
  - [ ] Disallow admin pages
  - [ ] Sitemap URL

---

### 8. Performance Optimization (26 items)

#### 8.1 Image Optimization
- [ ] Use Next.js Image for all images
- [ ] Configure Cloudinary loader
- [ ] Set priority for above-fold images
  - [ ] Hero image
  - [ ] First 3 product cards
- [ ] Lazy load below-fold images
- [ ] Generate blur placeholders
- [ ] Use responsive image sizes
  - [ ] Product cards: 300px, 600px, 900px
  - [ ] Product detail: 800px, 1200px, 1600px

#### 8.2 Code Splitting
- [ ] Dynamic import for product gallery
  - [ ] `dynamic(() => import('./ProductGallery'), { ssr: false })`
- [ ] Dynamic import for review form
- [ ] Dynamic import for checkout steps
- [ ] Route-based splitting (automatic)
- [ ] Analyze bundle with `ANALYZE=true pnpm build`

#### 8.3 Data Loading Strategies
- [ ] SSR for product detail pages
- [ ] ISR for product catalog (revalidate: 60s)
- [ ] Client-side for cart operations
- [ ] Streaming for homepage sections
- [ ] Prefetch product links on hover

#### 8.4 Caching Strategy
- [ ] TanStack Query cache config
  - [ ] Products: staleTime 60s
  - [ ] Product detail: staleTime 5min
  - [ ] Categories: staleTime 15min
  - [ ] Cart: staleTime 0 (always fresh)
- [ ] Redis cache for product lists (backend)
- [ ] CDN cache headers
  - [ ] Static assets: 1 year
  - [ ] Product images: 1 month
  - [ ] Product pages: 5 minutes

---

### 9. Mobile Optimization (18 items)

#### 9.1 Responsive Design
- [ ] Test on mobile viewports
  - [ ] 375px (iPhone SE)
  - [ ] 390px (iPhone 12/13/14)
  - [ ] 430px (iPhone 14 Pro Max)
- [ ] Test on tablet viewports
  - [ ] 768px (iPad Mini)
  - [ ] 820px (iPad Air)
  - [ ] 1024px (iPad Pro)
- [ ] Responsive product grid
  - [ ] Mobile: 2 columns
  - [ ] Tablet: 3 columns
  - [ ] Desktop: 4 columns
- [ ] Responsive filters
  - [ ] Mobile: Bottom drawer
  - [ ] Desktop: Sidebar
- [ ] Touch-friendly buttons (min 44px)
- [ ] Swipe gestures for carousels

#### 9.2 PWA Setup
- [ ] Install `next-pwa`: `pnpm add next-pwa`
- [ ] Create `manifest.json`
  - [ ] App name: "Lumi"
  - [ ] Icons (192px, 512px)
  - [ ] Theme color (from deneme.html)
  - [ ] Background color
  - [ ] Display: standalone
- [ ] Configure service worker
  - [ ] Cache homepage
  - [ ] Cache product images
  - [ ] Cache product data (limited)
  - [ ] Network-first for cart

---

### 10. Analytics & Tracking (20 items)

#### 10.1 Event Tracking
- [ ] Create `src/lib/analytics/events.ts`
  - [ ] `trackPageView(url, title)`
  - [ ] `trackProductView(product)`
  - [ ] `trackAddToCart(product, quantity)`
  - [ ] `trackRemoveFromCart(product)`
  - [ ] `trackSearch(query, resultsCount)`
  - [ ] `trackCheckoutStarted(cartValue)`
  - [ ] `trackCheckoutStep(step, data)`
  - [ ] `trackPurchase(order)`

#### 10.2 Google Analytics Integration
- [ ] Install `@next/third-parties`: `pnpm add @next/third-parties`
- [ ] Add GA4 script to root layout
- [ ] Configure custom events
- [ ] Track enhanced e-commerce events

#### 10.3 Web Vitals Monitoring
- [ ] Create `src/lib/analytics/web-vitals.ts`
  - [ ] Track LCP (Largest Contentful Paint)
  - [ ] Track FID (First Input Delay)
  - [ ] Track CLS (Cumulative Layout Shift)
  - [ ] Track TTFB (Time to First Byte)
  - [ ] Send to Sentry
  - [ ] Send to analytics

#### 10.4 Error Tracking
- [ ] Sentry integration
  - [ ] Capture React errors
  - [ ] Capture API errors
  - [ ] Capture 404s
  - [ ] User context (if logged in)
  - [ ] Custom tags (route, feature)

---

### 11. Testing & Quality Assurance (38 items)

#### 11.1 Unit Tests
- [ ] Test `ProductCard` component
  - [ ] Renders product info correctly
  - [ ] Displays correct price
  - [ ] Shows discount badge if sale
  - [ ] Handles click events
- [ ] Test `CartSummary` component
  - [ ] Calculates subtotal correctly
  - [ ] Applies discount
  - [ ] Calculates tax
  - [ ] Shows correct total
- [ ] Test `useAddToCart` hook
  - [ ] Adds item to cart
  - [ ] Updates quantity if exists
  - [ ] Invalidates cache
  - [ ] Shows success toast
- [ ] Test `useProductFilters` hook
  - [ ] Applies filters correctly
  - [ ] Updates URL params
  - [ ] Resets filters

#### 11.2 Integration Tests
- [ ] Test product catalog flow
  - [ ] Load products
  - [ ] Apply filters
  - [ ] Search products
  - [ ] Sort products
  - [ ] Navigate to product detail
- [ ] Test cart flow
  - [ ] Add to cart from catalog
  - [ ] Add to cart from product detail
  - [ ] Update quantity
  - [ ] Remove item
  - [ ] Navigate to checkout
- [ ] Test checkout flow (Phase 10 payment)
  - [ ] Enter shipping address
  - [ ] Select shipping method
  - [ ] Review order
  - [ ] Place order (mock)

#### 11.3 E2E Tests (Playwright)
- [ ] Create `tests/e2e/storefront.spec.ts`
- [ ] Test homepage
  - [ ] Hero loads
  - [ ] Featured products load
  - [ ] Newsletter signup works
- [ ] Test product search
  - [ ] Search bar accessible
  - [ ] Search results display
  - [ ] Click product card navigates
- [ ] Test product detail
  - [ ] Gallery loads
  - [ ] Variant selection works
  - [ ] Add to cart works
  - [ ] Review tab loads
- [ ] Test cart
  - [ ] Mini cart updates
  - [ ] Full cart page loads
  - [ ] Quantity update works
  - [ ] Remove item works
- [ ] Test checkout (without payment)
  - [ ] Shipping form validates
  - [ ] Order review displays
  - [ ] Terms checkbox required

#### 11.4 Average/Error/Recovery Tests
- [ ] Create `tests/average/storefront-average.test.ts`
- [ ] **Average Test**
  - [ ] Homepage → Search → Product detail → Add to cart → Checkout review
  - [ ] Verify response times <2s
  - [ ] Verify all images load
- [ ] **Error Tests**
  - [ ] Out of stock product (add to cart blocked)
  - [ ] Network timeout (loading state persists)
  - [ ] Price mismatch (backend 409 error)
  - [ ] Invalid promo code
- [ ] **Recovery Tests**
  - [ ] Offline mode (Service Worker fallback)
  - [ ] Reconnect and sync cart
  - [ ] Restore checkout state after refresh

#### 11.5 Performance Tests
- [ ] Lighthouse audit
  - [ ] Homepage: Performance ≥90
  - [ ] Product catalog: Performance ≥90
  - [ ] Product detail: Performance ≥90
  - [ ] LCP <1.9s
  - [ ] CLS <0.1
- [ ] Bundle size check
  - [ ] Initial bundle <180KB
  - [ ] Route chunks reasonable
  - [ ] No duplicate dependencies

#### 11.6 Visual Regression Tests
- [ ] Setup Chromatic or Playwright snapshots
- [ ] Capture critical components
  - [ ] ProductCard
  - [ ] Hero
  - [ ] MiniCart
  - [ ] CheckoutWizard
- [ ] Run on multiple viewports

---

## 🧪 VALIDATION CRITERIA

### Functional Validation

```bash
# Run all storefront tests
pnpm --filter @lumi/frontend test -- --runTestsByPath "src/features/catalog/**" "src/features/cart/**" "src/features/checkout/**"

# Run integration tests
pnpm --filter @lumi/frontend test:integration

# Run E2E tests
pnpm --filter @lumi/frontend exec playwright test tests/e2e/storefront.spec.ts

# Check coverage (must be ≥80%)
pnpm --filter @lumi/frontend test:coverage
```

### Performance Validation

```bash
# Build and analyze bundle
ANALYZE=true pnpm --filter @lumi/frontend build

# Lighthouse audit
pnpm --filter @lumi/frontend exec lighthouse http://localhost:3000 --output=json --output-path=./lighthouse-report.json

# Verify metrics
# - Performance ≥90
# - LCP <1.9s
# - CLS <0.1
```

### SEO Validation

```bash
# Test SEO helpers
pnpm --filter @lumi/frontend test -- --runTestsByPath "src/lib/seo/__tests__/**"

# Validate JSON-LD schema
# Use Google Rich Results Test or schema.org validator
```

### Test Examples

```typescript
// Test add to cart
test('adds product to cart', async () => {
  const { result } = renderHook(() => useAddToCart());

  await act(async () => {
    await result.current.mutateAsync({
      variantId: 'variant-123',
      quantity: 2
    });
  });

  expect(result.current.isSuccess).toBe(true);
  expect(cartStore.getState().items).toHaveLength(1);
  expect(cartStore.getState().items[0].quantity).toBe(2);
});

// Test product filters
test('applies category filter', async () => {
  const { result } = renderHook(() => useProducts());

  await act(async () => {
    result.current.setFilters({ category: 'electronics' });
  });

  await waitFor(() => {
    expect(result.current.data?.products).toBeDefined();
    expect(result.current.data?.products.every(p => p.category === 'electronics')).toBe(true);
  });
});
```

---

## 📊 SUCCESS METRICS

### Code Quality Metrics
- ✅ Test coverage: ≥80%
- ✅ TypeScript: 0 errors
- ✅ ESLint: 0 errors
- ✅ Lighthouse: ≥90 (Performance)

### Performance Metrics
- ✅ LCP: <1.9s (mobile & desktop)
- ✅ CLS: <0.1
- ✅ Bundle size: <180KB (initial)
- ✅ TTI: <2s

### SEO Metrics
- ✅ Dynamic metadata: 100% pages
- ✅ JSON-LD schema: Product, Breadcrumb, Organization
- ✅ Sitemap: Generated
- ✅ Open Graph: All pages

### UX Metrics
- ✅ Mobile responsive: 375px - 1440px
- ✅ Touch-friendly: 44px min touch targets
- ✅ Animations: Smooth 60fps
- ✅ Accessibility: WCAG 2.1 AA

---

## 🚨 COMMON PITFALLS TO AVOID

### 1. Unoptimized Images
❌ **Wrong:**
```tsx
<img src="/product.jpg" alt="Product" />
```

✅ **Correct:**
```tsx
<Image
  src={product.image}
  alt={product.title}
  width={800}
  height={800}
  priority={isAboveFold}
  placeholder="blur"
  blurDataURL={product.blurPlaceholder}
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
/>
```

### 2. No Loading States
❌ **Wrong:**
```tsx
const { data } = useProducts();
return <ProductGrid products={data.products} />; // Crashes on undefined
```

✅ **Correct:**
```tsx
const { data, isLoading, error } = useProducts();

if (isLoading) return <ProductGridSkeleton />;
if (error) return <ErrorState error={error} />;
if (!data?.products.length) return <EmptyState />;

return <ProductGrid products={data.products} />;
```

### 3. Missing SEO
❌ **Wrong:**
```tsx
// No metadata, poor SEO
export default function ProductPage() {
  return <div>Product</div>;
}
```

✅ **Correct:**
```tsx
export async function generateMetadata({ params }) {
  const product = await getProduct(params.slug);
  return {
    title: `${product.name} | Lumi`,
    description: product.description.substring(0, 155),
    openGraph: {
      title: product.name,
      description: product.description,
      images: [product.image],
    },
  };
}
```

### 4. No Optimistic Updates
❌ **Wrong:**
```tsx
// No feedback until server responds
const addToCart = useMutation(api.addToCart);
```

✅ **Correct:**
```tsx
const addToCart = useMutation(api.addToCart, {
  onMutate: async (newItem) => {
    // Optimistic update
    queryClient.setQueryData(['cart'], (old) => ({
      ...old,
      items: [...old.items, newItem]
    }));
  },
  onError: (err, newItem, context) => {
    // Rollback on error
    queryClient.setQueryData(['cart'], context.previousCart);
  },
  onSettled: () => {
    queryClient.invalidateQueries(['cart']);
  }
});
```

### 5. Poor Mobile UX
❌ **Wrong:**
```tsx
// Fixed width, not responsive
<div className="w-[1200px]">
```

✅ **Correct:**
```tsx
// Responsive container
<div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
```

---

## 📦 DELIVERABLES

### 1. Pages
- ✅ Homepage (hero, featured, categories, newsletter)
- ✅ Product catalog (grid, filters, search, sort)
- ✅ Product detail (gallery, variants, reviews)
- ✅ Cart (mini cart, full cart)
- ✅ Checkout (wizard, shipping, review, confirmation)
- ✅ Wishlist

### 2. Components
- ✅ 50+ UI components
- ✅ Product cards, filters, gallery
- ✅ Cart components
- ✅ Checkout wizard
- ✅ SEO components (metadata, schema)

### 3. State Management
- ✅ Cart store (Zustand)
- ✅ Checkout store (Zustand)
- ✅ TanStack Query hooks (products, cart, etc.)

### 4. SEO
- ✅ Dynamic metadata
- ✅ JSON-LD schemas
- ✅ Sitemap
- ✅ Robots.txt

### 5. Testing
- ✅ Unit tests (≥80% coverage)
- ✅ Integration tests
- ✅ E2E tests (Playwright)
- ✅ Performance tests (Lighthouse)

### 6. Documentation
- ✅ Storefront guide
- ✅ Component documentation
- ✅ SEO best practices
- ✅ Testing strategy

---

## 📈 PHASE COMPLETION REPORT TEMPLATE

```markdown
# PHASE 8: E-commerce Interface - Completion Report

## Implementation Summary
- **Start Date**: [Date]
- **End Date**: [Date]
- **Duration**: [Days]
- **Team Members**: [Names]

## Completed Items
- [x] Total Items: 354/354 (100%)
- [x] Homepage: 34/34
- [x] Product Catalog: 46/46
- [x] Product Detail: 52/52
- [x] Shopping Cart: 38/38
- [x] Checkout: 44/44
- [x] Wishlist: 16/16
- [x] SEO: 22/22
- [x] Performance: 26/26
- [x] Mobile: 18/18
- [x] Analytics: 20/20
- [x] Testing: 38/38

## Metrics Achieved
- **Test Coverage**: X% (Target: ≥80%)
- **Lighthouse Performance**: X (Target: ≥90)
- **LCP**: Xms (Target: <1900ms)
- **Bundle Size**: XKB (Target: <180KB)
- **SEO Score**: X/100

## Known Issues
- [List any known issues or technical debt]

## Next Phase Preparation
- Phase 9 (Admin Dashboard) ready: ✅
- Phase 10 (Payment Integration) ready: ✅
```

---

## 🎯 NEXT PHASE PREVIEW

**Phase 9: Admin Dashboard**
- Comprehensive admin panel
- Analytics dashboard (sales, visitors, conversion)
- Product management (CRUD, bulk ops)
- Order management (status updates, fulfillment)
- User management (roles, activity logs)

**Phase 10: Payment Integration**
- Iyzico integration (3D Secure, installments)
- Card tokenization
- Payment processing
- Refund handling
- PCI-DSS compliance

---

**END OF PHASE 8 DOCUMENTATION**

_Version 1.0 | Last Updated: 2025-10-01_

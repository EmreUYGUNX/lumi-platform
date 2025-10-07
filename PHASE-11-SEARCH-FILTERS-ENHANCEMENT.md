# PHASE 11: SEARCH & FILTERS ENHANCEMENT

**Status**: 🔄 In Progress
**Priority**: 🔴 High
**Dependencies**: Phase 2 (Database & Prisma), Phase 4 (Core APIs), Phase 6 (Next.js Foundation), Phase 8 (E-commerce Interface)
**Estimated Time**: 8-11 days

---

## 📋 DOCUMENT OVERVIEW

This phase implements advanced search and filtering capabilities using Elasticsearch for lightning-fast, typo-tolerant product discovery. The system provides faceted search, autocomplete, synonym support, relevance boosting, multi-field filtering, and intelligent query suggestions to enhance user experience and conversion rates.

**Key Components**:
- Elasticsearch cluster setup and index management
- Full-text search with typo tolerance (fuzzy matching, phonetic search)
- Faceted filtering with dynamic aggregations (category, price range, brand, attributes)
- Real-time autocomplete with query suggestions
- Advanced filters: multi-select, range sliders, color swatches, size selectors
- Search analytics and popular queries tracking
- Product data synchronization (Prisma → Elasticsearch)
- Search result ranking with relevance boosting

**Technical Stack**:
- Elasticsearch 8.x (search engine)
- @elastic/elasticsearch (official Node.js client)
- Redis (search result caching, autocomplete suggestions)
- Bull (queue for data sync jobs)
- Next.js (search UI with server-side rendering)
- TanStack Query (search state management)
- Debounced search input (300ms)

**Performance Standards**:
- **P1**: Search response time <200ms (P50), <500ms (P95)
- **P2**: Autocomplete response time <100ms
- Search result caching: 5min TTL for popular queries
- Elasticsearch index refresh: 1s (near real-time)
- Data sync latency: <5s from database update to search availability

**Quality Standards**:
- **Q2**: All search API responses follow standard format
- **Q3**: Timestamps consistent across search operations
- ≥85% test coverage for search logic
- Elasticsearch index health: green status

---

## 🎯 PHASE OBJECTIVES

### Primary Goals
1. **Elasticsearch Setup**: Install, configure Elasticsearch cluster, create product index with mappings
2. **Full-Text Search**: Implement multi-field search (name, description, tags, SKU, brand)
3. **Typo Tolerance**: Add fuzzy matching, phonetic analysis, synonym support
4. **Autocomplete**: Build real-time query suggestions with highlighting
5. **Faceted Filtering**: Dynamic filter aggregations (category, price, brand, attributes, ratings)
6. **Advanced Filters**: Multi-select filters, range sliders, color/size pickers
7. **Search Analytics**: Track popular queries, zero-result queries, click-through rates
8. **Data Synchronization**: Sync product data from Prisma to Elasticsearch (create, update, delete)
9. **Search Ranking**: Boost relevance based on popularity, ratings, sales, stock status

### Success Criteria
- [ ] Elasticsearch cluster running with green health status
- [ ] Product index created with proper mappings and analyzers
- [ ] Full-text search returns relevant results with typo tolerance
- [ ] Autocomplete suggests products within <100ms (P2)
- [ ] Faceted filters display dynamic counts for each filter option
- [ ] Multi-filter combinations work correctly (AND/OR logic)
- [ ] Search response time <200ms for P50 (P1)
- [ ] Data sync: product updates appear in search within <5s
- [ ] ≥85% test coverage for search services

---

## 🎯 CRITICAL REQUIREMENTS

### Performance Requirements (MANDATORY)

**P1: Search Response Time**
```typescript
// ❌ WRONG: No caching, slow queries
const results = await prisma.product.findMany({
  where: { name: { contains: query, mode: 'insensitive' } }
});

// ✅ CORRECT: Elasticsearch with caching
const cacheKey = `search:${query}:${JSON.stringify(filters)}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const results = await esClient.search({
  index: 'products',
  body: {
    query: {
      bool: {
        must: [
          { multi_match: { query, fields: ['name^3', 'description', 'tags^2'], fuzziness: 'AUTO' } }
        ],
        filter: filters
      }
    }
  }
});

await redis.set(cacheKey, JSON.stringify(results), 'EX', 300); // 5min cache
return results;
```

**P2: Autocomplete Performance**
```typescript
// ✅ CORRECT: Edge n-gram with minimal fields
const suggestions = await esClient.search({
  index: 'products',
  body: {
    suggest: {
      product_suggest: {
        prefix: query,
        completion: {
          field: 'name.suggest',
          size: 10,
          skip_duplicates: true
        }
      }
    },
    _source: ['name', 'images', 'price'], // Only essential fields
    size: 5
  }
});
```

### Quality Requirements (MANDATORY)

**Q2: Standard API Format**
```typescript
// ❌ WRONG: Inconsistent format
res.json({ products: results, total: count });

// ✅ CORRECT: Standard format with aggregations
res.json({
  success: true,
  data: {
    products: results,
    aggregations: {
      categories: [...],
      priceRanges: [...],
      brands: [...]
    }
  },
  meta: {
    timestamp: new Date().toISOString(),
    requestId: req.id,
    pagination: {
      page: 1,
      perPage: 24,
      total: 156,
      totalPages: 7
    },
    searchTime: '42ms'
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
│   │   │   │   └── elasticsearch.config.ts    # ES client setup
│   │   │   ├── routes/
│   │   │   │   └── search.routes.ts           # Search APIs
│   │   │   ├── services/
│   │   │   │   ├── search.service.ts          # Search logic
│   │   │   │   ├── elasticsearch.service.ts   # ES operations
│   │   │   │   ├── search-sync.service.ts     # Data sync
│   │   │   │   └── search-analytics.service.ts # Search tracking
│   │   │   ├── jobs/
│   │   │   │   ├── product-index.job.ts       # Bulk indexing job
│   │   │   │   └── search-sync.job.ts         # Real-time sync job
│   │   │   └── utils/
│   │   │       ├── search-query-builder.utils.ts # Query DSL builder
│   │   │       └── search-aggregations.utils.ts  # Aggregations helper
│   │
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── search/
│   │   │   │   │   └── page.tsx               # Search results page
│   │   │   │   └── products/
│   │   │   │       └── page.tsx               # Product listing with filters
│   │   │   ├── components/
│   │   │   │   ├── search/
│   │   │   │   │   ├── SearchBar.tsx          # Search input with autocomplete
│   │   │   │   │   ├── SearchResults.tsx      # Search results grid
│   │   │   │   │   ├── SearchFilters.tsx      # Filter sidebar
│   │   │   │   │   ├── FilterCategory.tsx     # Category filter
│   │   │   │   │   ├── FilterPrice.tsx        # Price range slider
│   │   │   │   │   ├── FilterBrand.tsx        # Brand multi-select
│   │   │   │   │   ├── FilterAttributes.tsx   # Dynamic attributes
│   │   │   │   │   ├── FilterRating.tsx       # Rating filter
│   │   │   │   │   ├── ActiveFilters.tsx      # Selected filters chips
│   │   │   │   │   └── SearchSuggestions.tsx  # Autocomplete dropdown
│   │   │   ├── hooks/
│   │   │   │   ├── useSearch.ts               # Search state management
│   │   │   │   ├── useAutocomplete.ts         # Autocomplete hook
│   │   │   │   └── useSearchFilters.ts        # Filter state hook
│   │   │   └── lib/
│   │   │       └── search-utils.ts            # Search helpers
```

### Search Flow Architecture

**Search Request Flow**:
```
User Input → Debounced (300ms) → Frontend Search Hook
                                       ↓
                            POST /api/search?q=laptop
                                       ↓
Backend → Check Redis Cache → Cache HIT? → Return cached results
                    ↓
                Cache MISS
                    ↓
            Elasticsearch Query
                    ↓
    Multi-field search + Fuzzy matching + Filters + Aggregations
                    ↓
            Results + Facets
                    ↓
            Cache in Redis (5min TTL)
                    ↓
            Q2 Format Response
                    ↓
Frontend → Display Results + Update Filters
```

**Data Synchronization Flow**:
```
Product CRUD Operation (Prisma)
        ↓
Prisma Middleware Hook
        ↓
Enqueue Sync Job (Bull Queue)
        ↓
Worker Process → Elasticsearch API
        ↓
Index/Update/Delete Document
        ↓
Invalidate Redis Cache
        ↓
Search Results Updated (<5s latency)
```

**Autocomplete Flow**:
```
User Types → Debounced (150ms) → POST /api/search/autocomplete
                                        ↓
                                Elasticsearch Suggest API
                                        ↓
                            Edge N-gram Tokenizer
                                        ↓
                        Top 10 Suggestions (with highlighting)
                                        ↓
                        Return in <100ms (P2)
```

---

## ✅ IMPLEMENTATION CHECKLIST

### 1. Backend: Elasticsearch Setup (18 items)

#### 1.1 Elasticsearch Installation (8 items)
- [ ] Install Elasticsearch 8.x via Docker Compose
- [ ] Configure Elasticsearch heap size: 2GB min, 4GB max
- [ ] Enable security: xpack.security.enabled=true
- [ ] Create Elasticsearch user with limited permissions
- [ ] Add Elasticsearch connection URL to .env: `ELASTICSEARCH_URL=http://localhost:9200`
- [ ] Install @elastic/elasticsearch: `npm install @elastic/elasticsearch --save`
- [ ] Create `src/config/elasticsearch.config.ts` with client initialization
- [ ] Add health check endpoint: verify cluster status on startup

#### 1.2 Product Index Creation (10 items)
- [ ] Create product index with mappings: `products-v1`
- [ ] Define field mappings: name (text + keyword), description (text), price (double), stock (integer), category (keyword)
- [ ] Configure analyzers: standard, edge_n_gram (autocomplete), phonetic (typo tolerance)
- [ ] Add synonym filter: laptop → notebook, phone → mobile, etc.
- [ ] Configure fuzziness: AUTO for typo tolerance (1-2 character edits)
- [ ] Set number_of_shards: 2, number_of_replicas: 1
- [ ] Create index alias: `products` → `products-v1` (for zero-downtime reindexing)
- [ ] Add dynamic templates for custom attributes
- [ ] Configure refresh_interval: 1s (near real-time)
- [ ] Test index creation with sample document

**Example**:
```typescript
// docker-compose.yml (add to existing file)
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    container_name: lumi-elasticsearch
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms2g -Xmx4g"
      - xpack.security.enabled=false  # Enable in production
    ports:
      - "9200:9200"
      - "9300:9300"
    volumes:
      - elasticsearch-data:/usr/share/elasticsearch/data
    networks:
      - lumi-network

volumes:
  elasticsearch-data:
    driver: local

// src/config/elasticsearch.config.ts
import { Client } from '@elastic/elasticsearch';

if (!process.env.ELASTICSEARCH_URL) {
  throw new Error('ELASTICSEARCH_URL not configured');
}

export const esClient = new Client({
  node: process.env.ELASTICSEARCH_URL,
  auth: {
    username: process.env.ELASTICSEARCH_USER || 'elastic',
    password: process.env.ELASTICSEARCH_PASSWORD || 'changeme'
  },
  maxRetries: 3,
  requestTimeout: 30000
});

// Health check
export const checkElasticsearchHealth = async () => {
  try {
    const health = await esClient.cluster.health();
    return {
      healthy: health.status !== 'red',
      status: health.status,
      nodes: health.number_of_nodes
    };
  } catch (error) {
    return { healthy: false, error: error.message };
  }
};

// Create product index
export const createProductIndex = async () => {
  const indexName = 'products-v1';

  const indexExists = await esClient.indices.exists({ index: indexName });
  if (indexExists) {
    console.log(`Index ${indexName} already exists`);
    return;
  }

  await esClient.indices.create({
    index: indexName,
    body: {
      settings: {
        number_of_shards: 2,
        number_of_replicas: 1,
        refresh_interval: '1s',
        analysis: {
          filter: {
            edge_ngram_filter: {
              type: 'edge_ngram',
              min_gram: 2,
              max_gram: 20
            },
            synonym_filter: {
              type: 'synonym',
              synonyms: [
                'laptop, notebook, computer',
                'phone, mobile, smartphone',
                'tv, television',
                'headphone, earphone, headset'
              ]
            },
            turkish_stop: {
              type: 'stop',
              stopwords: '_turkish_'
            }
          },
          analyzer: {
            autocomplete_analyzer: {
              type: 'custom',
              tokenizer: 'standard',
              filter: ['lowercase', 'edge_ngram_filter']
            },
            search_analyzer: {
              type: 'custom',
              tokenizer: 'standard',
              filter: ['lowercase', 'synonym_filter']
            },
            turkish_analyzer: {
              type: 'custom',
              tokenizer: 'standard',
              filter: ['lowercase', 'turkish_stop']
            }
          }
        }
      },
      mappings: {
        properties: {
          id: { type: 'keyword' },
          name: {
            type: 'text',
            analyzer: 'turkish_analyzer',
            fields: {
              keyword: { type: 'keyword' },
              autocomplete: {
                type: 'text',
                analyzer: 'autocomplete_analyzer',
                search_analyzer: 'search_analyzer'
              },
              suggest: {
                type: 'completion',
                analyzer: 'simple',
                max_input_length: 50
              }
            }
          },
          description: {
            type: 'text',
            analyzer: 'turkish_analyzer'
          },
          sku: { type: 'keyword' },
          price: { type: 'double' },
          compareAtPrice: { type: 'double' },
          stock: { type: 'integer' },
          categoryId: { type: 'keyword' },
          categoryName: { type: 'keyword' },
          categorySlug: { type: 'keyword' },
          brand: { type: 'keyword' },
          tags: { type: 'keyword' },
          images: {
            type: 'object',
            enabled: false  // Don't index images
          },
          averageRating: { type: 'float' },
          reviewCount: { type: 'integer' },
          salesCount: { type: 'integer' },
          viewCount: { type: 'integer' },
          isActive: { type: 'boolean' },
          isFeatured: { type: 'boolean' },
          createdAt: { type: 'date' },
          updatedAt: { type: 'date' },
          // Dynamic attributes (color, size, etc.)
          attributes: {
            type: 'nested',
            properties: {
              name: { type: 'keyword' },
              value: { type: 'keyword' }
            }
          }
        }
      }
    }
  });

  // Create alias
  await esClient.indices.putAlias({
    index: indexName,
    name: 'products'
  });

  console.log(`Index ${indexName} created successfully`);
};
```

---

### 2. Backend: Data Synchronization (26 items)

#### 2.1 Initial Bulk Indexing (10 items)
- [ ] Create `src/jobs/product-index.job.ts` for bulk indexing
- [ ] Fetch all active products from Prisma
- [ ] Transform product data to Elasticsearch document format
- [ ] Use bulk API for efficient indexing (batch size: 500 documents)
- [ ] Add progress tracking: log every 1000 documents indexed
- [ ] Handle indexing errors: log failures, continue processing
- [ ] Calculate total indexing time
- [ ] Verify indexed document count matches database count
- [ ] Create CLI command: `npm run index:products`
- [ ] Run initial index on deployment

#### 2.2 Real-time Synchronization (16 items)
- [ ] Create `src/services/search-sync.service.ts`
- [ ] Install Bull queue: `npm install bull --save`
- [ ] Set up Redis connection for Bull
- [ ] Create sync job queue: `productSyncQueue`
- [ ] Add Prisma middleware to intercept product CRUD operations
- [ ] On product create: enqueue `index-product` job
- [ ] On product update: enqueue `update-product` job
- [ ] On product delete: enqueue `delete-product` job
- [ ] Implement job processor: index/update/delete in Elasticsearch
- [ ] Add job retry logic: 3 retries with exponential backoff
- [ ] Invalidate Redis search cache on product update
- [ ] Add job monitoring dashboard (Bull Board)
- [ ] Handle bulk updates efficiently (batch multiple updates)
- [ ] Test sync latency: <5s from database update to search availability
- [ ] Add dead letter queue for failed jobs
- [ ] Log sync metrics: success rate, average latency

**Example**:
```typescript
// src/jobs/product-index.job.ts
import prisma from '../config/database';
import { esClient } from '../config/elasticsearch.config';

export const bulkIndexProducts = async () => {
  const startTime = Date.now();
  const batchSize = 500;
  let offset = 0;
  let totalIndexed = 0;

  console.log('Starting bulk product indexing...');

  while (true) {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        category: { select: { name: true, slug: true } },
        images: { select: { url: true } },
        _count: { select: { reviews: true, orderItems: true } }
      },
      skip: offset,
      take: batchSize
    });

    if (products.length === 0) break;

    // Transform to ES documents
    const operations = products.flatMap(product => [
      { index: { _index: 'products', _id: product.id } },
      {
        id: product.id,
        name: product.name,
        description: product.description,
        sku: product.sku,
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        stock: product.stock,
        categoryId: product.categoryId,
        categoryName: product.category.name,
        categorySlug: product.category.slug,
        brand: product.brand,
        tags: product.tags,
        images: product.images.map(img => ({ url: img.url })),
        averageRating: product.averageRating || 0,
        reviewCount: product._count.reviews,
        salesCount: product._count.orderItems,
        isActive: product.isActive,
        isFeatured: product.isFeatured,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
      }
    ]);

    // Bulk index
    const result = await esClient.bulk({ operations, refresh: false });

    if (result.errors) {
      const errors = result.items.filter(item => item.index?.error);
      console.error(`Bulk indexing errors:`, errors);
    }

    totalIndexed += products.length;
    offset += batchSize;

    console.log(`Indexed ${totalIndexed} products...`);
  }

  // Refresh index
  await esClient.indices.refresh({ index: 'products' });

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`Bulk indexing complete: ${totalIndexed} products in ${duration}s`);

  return { totalIndexed, duration };
};

// src/services/search-sync.service.ts
import Queue from 'bull';
import { esClient } from '../config/elasticsearch.config';
import redis from '../config/redis';

// Create queue
export const productSyncQueue = new Queue('product-sync', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
  }
});

// Job types
export const enqueueProductIndex = async (productId: string) => {
  await productSyncQueue.add('index-product', { productId }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 }
  });
};

export const enqueueProductUpdate = async (productId: string) => {
  await productSyncQueue.add('update-product', { productId }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 }
  });
};

export const enqueueProductDelete = async (productId: string) => {
  await productSyncQueue.add('delete-product', { productId }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 }
  });
};

// Job processor
productSyncQueue.process('index-product', async (job) => {
  const { productId } = job.data;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      category: { select: { name: true, slug: true } },
      images: { select: { url: true } },
      _count: { select: { reviews: true, orderItems: true } }
    }
  });

  if (!product) throw new Error('Product not found');

  await esClient.index({
    index: 'products',
    id: productId,
    document: {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      stock: product.stock,
      categoryName: product.category.name,
      // ... other fields
    }
  });

  // Invalidate cache
  await redis.del(`search:*${productId}*`);

  console.log(`Product ${productId} indexed successfully`);
});

productSyncQueue.process('update-product', async (job) => {
  // Same as index-product
  const { productId } = job.data;
  // ... update logic
});

productSyncQueue.process('delete-product', async (job) => {
  const { productId } = job.data;

  await esClient.delete({
    index: 'products',
    id: productId
  });

  await redis.del(`search:*${productId}*`);

  console.log(`Product ${productId} deleted from index`);
});

// Add Prisma middleware for auto-sync
// prisma/client-extensions.ts
import { Prisma } from '@prisma/client';
import { enqueueProductIndex, enqueueProductUpdate, enqueueProductDelete } from '../services/search-sync.service';

export const searchSyncMiddleware: Prisma.Middleware = async (params, next) => {
  const result = await next(params);

  if (params.model === 'Product') {
    if (params.action === 'create') {
      await enqueueProductIndex(result.id);
    } else if (params.action === 'update') {
      await enqueueProductUpdate(params.args.where.id);
    } else if (params.action === 'delete') {
      await enqueueProductDelete(params.args.where.id);
    } else if (params.action === 'updateMany' || params.action === 'deleteMany') {
      // Handle bulk operations (fetch affected IDs first)
      const affectedProducts = await prisma.product.findMany({
        where: params.args.where,
        select: { id: true }
      });

      for (const product of affectedProducts) {
        if (params.action === 'updateMany') {
          await enqueueProductUpdate(product.id);
        } else {
          await enqueueProductDelete(product.id);
        }
      }
    }
  }

  return result;
};

// Add to Prisma client initialization
// prisma.$use(searchSyncMiddleware);
```

---

### 3. Backend: Search Service (32 items)

#### 3.1 Full-Text Search (14 items)
- [ ] Create `src/services/search.service.ts`
- [ ] Implement `searchProducts(query, filters, pagination)` function
- [ ] Use multi_match query across name, description, tags, SKU (with field boosting)
- [ ] Apply fuzziness: AUTO for typo tolerance (1 edit for 3-5 chars, 2 edits for 6+ chars)
- [ ] Add synonym matching via synonym filter
- [ ] Boost name field: ^3, tags field: ^2, description: ^1
- [ ] Apply filters: category, price range, brand, rating, attributes
- [ ] Add sorting options: relevance (default), price (asc/desc), newest, popular
- [ ] Implement pagination: from, size parameters
- [ ] Add highlighting: highlight matched terms in name and description
- [ ] Return aggregations for facets (category counts, price ranges, brands)
- [ ] Cache search results in Redis (5min TTL for popular queries)
- [ ] Log search query and result count for analytics
- [ ] Return Q2 format with products, aggregations, pagination

#### 3.2 Query DSL Builder (10 items)
- [ ] Create `src/utils/search-query-builder.utils.ts`
- [ ] Implement `buildSearchQuery(query, filters)` function
- [ ] Build bool query with must, filter, should, must_not clauses
- [ ] Add category filter: term query on categoryId
- [ ] Add price range filter: range query on price field
- [ ] Add brand filter: terms query on brand field (multi-select)
- [ ] Add rating filter: range query on averageRating field
- [ ] Add attribute filters: nested query on attributes field
- [ ] Add stock filter: exclude out-of-stock products (stock > 0)
- [ ] Combine filters with AND logic (filter clause)

#### 3.3 Aggregations (8 items)
- [ ] Create `src/utils/search-aggregations.utils.ts`
- [ ] Build category aggregation: terms aggregation on categoryId with doc counts
- [ ] Build price range aggregation: range aggregation with buckets (0-100, 100-500, 500-1000, 1000+)
- [ ] Build brand aggregation: terms aggregation on brand field
- [ ] Build rating aggregation: range aggregation (4+, 3+, 2+, 1+)
- [ ] Build attribute aggregations: nested aggregation for dynamic attributes (color, size, etc.)
- [ ] Include only non-zero buckets (min_doc_count: 1)
- [ ] Return aggregations in Q2 format
- [ ] Test aggregations with various filter combinations

**Example**:
```typescript
// src/services/search.service.ts
import { esClient } from '../config/elasticsearch.config';
import redis from '../config/redis';
import { buildSearchQuery } from '../utils/search-query-builder.utils';
import { buildAggregations } from '../utils/search-aggregations.utils';

interface SearchParams {
  query: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  brands?: string[];
  minRating?: number;
  attributes?: Record<string, string[]>;
  sortBy?: 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'popular';
  page?: number;
  perPage?: number;
}

export const searchProducts = async (params: SearchParams) => {
  const {
    query,
    category,
    minPrice,
    maxPrice,
    brands,
    minRating,
    attributes,
    sortBy = 'relevance',
    page = 1,
    perPage = 24
  } = params;

  // Check cache
  const cacheKey = `search:${JSON.stringify(params)}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  // Build query
  const esQuery = buildSearchQuery({ query, category, minPrice, maxPrice, brands, minRating, attributes });

  // Build aggregations
  const aggregations = buildAggregations();

  // Build sort
  let sort: any = [];
  switch (sortBy) {
    case 'price_asc':
      sort = [{ price: 'asc' }];
      break;
    case 'price_desc':
      sort = [{ price: 'desc' }];
      break;
    case 'newest':
      sort = [{ createdAt: 'desc' }];
      break;
    case 'popular':
      sort = [{ salesCount: 'desc' }, { viewCount: 'desc' }];
      break;
    default: // relevance
      sort = ['_score', { salesCount: 'desc' }];
  }

  // Execute search
  const result = await esClient.search({
    index: 'products',
    body: {
      query: esQuery,
      aggs: aggregations,
      sort,
      from: (page - 1) * perPage,
      size: perPage,
      highlight: {
        fields: {
          name: {},
          description: {}
        },
        pre_tags: ['<mark>'],
        post_tags: ['</mark>']
      },
      _source: [
        'id', 'name', 'description', 'price', 'compareAtPrice', 'stock',
        'categoryName', 'brand', 'images', 'averageRating', 'reviewCount', 'isFeatured'
      ]
    }
  });

  // Transform results
  const products = result.hits.hits.map(hit => ({
    ...hit._source,
    _score: hit._score,
    highlights: hit.highlight
  }));

  const total = typeof result.hits.total === 'number' ? result.hits.total : result.hits.total.value;

  // Transform aggregations
  const facets = {
    categories: result.aggregations.categories.buckets.map(b => ({
      id: b.key,
      name: b.key, // Could be enriched with actual category names
      count: b.doc_count
    })),
    priceRanges: result.aggregations.price_ranges.buckets.map(b => ({
      from: b.from || 0,
      to: b.to || null,
      count: b.doc_count
    })),
    brands: result.aggregations.brands.buckets.map(b => ({
      name: b.key,
      count: b.doc_count
    })),
    ratings: result.aggregations.ratings.buckets.map(b => ({
      rating: b.key,
      count: b.doc_count
    }))
  };

  const response = {
    products,
    facets,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage)
  };

  // Cache for 5 minutes (popular queries)
  await redis.set(cacheKey, JSON.stringify(response), 'EX', 300);

  // Log search analytics
  await logSearchQuery(query, total);

  return response;
};

// src/utils/search-query-builder.utils.ts
interface QueryFilters {
  query: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  brands?: string[];
  minRating?: number;
  attributes?: Record<string, string[]>;
}

export const buildSearchQuery = (filters: QueryFilters) => {
  const { query, category, minPrice, maxPrice, brands, minRating, attributes } = filters;

  const must: any[] = [];
  const filter: any[] = [];

  // Full-text search
  if (query) {
    must.push({
      multi_match: {
        query,
        fields: ['name^3', 'description', 'tags^2', 'sku'],
        fuzziness: 'AUTO',
        prefix_length: 2, // Require at least 2 chars to match before fuzziness
        operator: 'or'
      }
    });
  } else {
    // No query = match all
    must.push({ match_all: {} });
  }

  // Category filter
  if (category) {
    filter.push({ term: { categoryId: category } });
  }

  // Price range filter
  if (minPrice !== undefined || maxPrice !== undefined) {
    const priceRange: any = {};
    if (minPrice !== undefined) priceRange.gte = minPrice;
    if (maxPrice !== undefined) priceRange.lte = maxPrice;
    filter.push({ range: { price: priceRange } });
  }

  // Brand filter (multi-select)
  if (brands && brands.length > 0) {
    filter.push({ terms: { brand: brands } });
  }

  // Rating filter
  if (minRating !== undefined) {
    filter.push({ range: { averageRating: { gte: minRating } } });
  }

  // Attribute filters (nested)
  if (attributes) {
    for (const [attrName, attrValues] of Object.entries(attributes)) {
      filter.push({
        nested: {
          path: 'attributes',
          query: {
            bool: {
              must: [
                { term: { 'attributes.name': attrName } },
                { terms: { 'attributes.value': attrValues } }
              ]
            }
          }
        }
      });
    }
  }

  // Exclude inactive and out-of-stock products
  filter.push({ term: { isActive: true } });
  filter.push({ range: { stock: { gt: 0 } } });

  return {
    bool: {
      must,
      filter
    }
  };
};

// src/utils/search-aggregations.utils.ts
export const buildAggregations = () => ({
  categories: {
    terms: {
      field: 'categoryId',
      size: 20,
      min_doc_count: 1
    }
  },
  price_ranges: {
    range: {
      field: 'price',
      ranges: [
        { to: 100 },
        { from: 100, to: 500 },
        { from: 500, to: 1000 },
        { from: 1000, to: 5000 },
        { from: 5000 }
      ],
      keyed: false
    }
  },
  brands: {
    terms: {
      field: 'brand',
      size: 30,
      min_doc_count: 1
    }
  },
  ratings: {
    range: {
      field: 'averageRating',
      ranges: [
        { key: '4+', from: 4 },
        { key: '3+', from: 3 },
        { key: '2+', from: 2 },
        { key: '1+', from: 1 }
      ]
    }
  }
});

// src/routes/search.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import * as searchService from '../services/search.service';

const router = Router();

const SearchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  category: z.string().cuid().optional(),
  minPrice: z.number().nonnegative().optional(),
  maxPrice: z.number().positive().optional(),
  brands: z.array(z.string()).optional(),
  minRating: z.number().min(1).max(5).optional(),
  sortBy: z.enum(['relevance', 'price_asc', 'price_desc', 'newest', 'popular']).optional(),
  page: z.number().int().positive().optional(),
  perPage: z.number().int().positive().max(100).optional()
});

router.get('/', async (req, res) => {
  try {
    const validated = SearchQuerySchema.parse({
      q: req.query.q,
      category: req.query.category,
      minPrice: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
      maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
      brands: req.query.brands ? (req.query.brands as string).split(',') : undefined,
      minRating: req.query.minRating ? parseFloat(req.query.minRating as string) : undefined,
      sortBy: req.query.sortBy as any,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      perPage: req.query.perPage ? parseInt(req.query.perPage as string) : undefined
    });

    const startTime = Date.now();
    const result = await searchService.searchProducts(validated);
    const searchTime = Date.now() - startTime;

    res.json({
      success: true,
      data: result,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.id,
        searchTime: `${searchTime}ms`
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      meta: { timestamp: new Date().toISOString(), requestId: req.id }
    });
  }
});

export default router;
```

---

### 4. Backend: Autocomplete (16 items)

#### 4.1 Autocomplete Service (10 items)
- [ ] Add `GET /api/search/autocomplete?q=lap`: autocomplete endpoint
- [ ] Use Elasticsearch completion suggester on name.suggest field
- [ ] Return top 10 suggestions with highlighting
- [ ] Include product images and prices in suggestions
- [ ] Deduplicate suggestions (skip_duplicates: true)
- [ ] Cache autocomplete results in Redis (10min TTL)
- [ ] Debounce autocomplete requests: 150ms on frontend
- [ ] Return suggestions within <100ms (P2)
- [ ] Add popular searches to autocomplete (if query is empty)
- [ ] Return Q2 format

#### 4.2 Query Suggestions (6 items)
- [ ] Track popular search queries in Redis sorted set
- [ ] Increment query score on each search
- [ ] Return top 10 popular queries for empty autocomplete
- [ ] Add "Did you mean?" suggestions for zero-result queries
- [ ] Use phonetic matching for typo correction
- [ ] Test with various typo scenarios

**Example**:
```typescript
// src/services/search.service.ts (add autocomplete)
export const autocompleteProducts = async (query: string) => {
  if (!query || query.length < 2) {
    // Return popular searches
    return getPopularSearches();
  }

  // Check cache
  const cacheKey = `autocomplete:${query}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const result = await esClient.search({
    index: 'products',
    body: {
      suggest: {
        product_suggest: {
          prefix: query,
          completion: {
            field: 'name.suggest',
            size: 10,
            skip_duplicates: true,
            fuzzy: {
              fuzziness: 'AUTO'
            }
          }
        }
      },
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query,
                fields: ['name.autocomplete'],
                type: 'bool_prefix'
              }
            }
          ],
          filter: [
            { term: { isActive: true } },
            { range: { stock: { gt: 0 } } }
          ]
        }
      },
      _source: ['id', 'name', 'price', 'images', 'categoryName'],
      size: 5,
      highlight: {
        fields: {
          name: {}
        },
        pre_tags: ['<strong>'],
        post_tags: ['</strong>']
      }
    }
  });

  const suggestions = result.hits.hits.map(hit => ({
    id: hit._source.id,
    name: hit._source.name,
    price: hit._source.price,
    image: hit._source.images[0]?.url,
    categoryName: hit._source.categoryName,
    highlight: hit.highlight?.name?.[0]
  }));

  const response = { suggestions };

  // Cache for 10 minutes
  await redis.set(cacheKey, JSON.stringify(response), 'EX', 600);

  return response;
};

const getPopularSearches = async () => {
  const popular = await redis.zrevrange('popular-searches', 0, 9, 'WITHSCORES');
  const searches = [];

  for (let i = 0; i < popular.length; i += 2) {
    searches.push({
      query: popular[i],
      count: parseInt(popular[i + 1])
    });
  }

  return { popularSearches: searches };
};

// Track popular searches
const logSearchQuery = async (query: string, resultCount: number) => {
  // Increment query score
  await redis.zincrby('popular-searches', 1, query);

  // Log to analytics
  await prisma.searchAnalytics.create({
    data: {
      query,
      resultCount,
      timestamp: new Date()
    }
  });
};

// src/routes/search.routes.ts (add endpoint)
router.get('/autocomplete', async (req, res) => {
  const query = (req.query.q as string) || '';

  const startTime = Date.now();
  const result = await searchService.autocompleteProducts(query);
  const responseTime = Date.now() - startTime;

  res.json({
    success: true,
    data: result,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: req.id,
      responseTime: `${responseTime}ms`
    }
  });
});
```

---

### 5. Backend: Search Analytics (14 items)

#### 5.1 Analytics Tracking (8 items)
- [ ] Create `SearchAnalytics` model in Prisma schema
- [ ] Track search query, result count, timestamp, user ID (if authenticated)
- [ ] Track zero-result queries separately (for improvement opportunities)
- [ ] Track click-through rate: log which product was clicked from search results
- [ ] Add `GET /api/admin/search/analytics`: search analytics dashboard
- [ ] Display popular searches (top 20 queries)
- [ ] Display zero-result queries (queries with no results)
- [ ] Calculate average result count per query

#### 5.2 Analytics Aggregations (6 items)
- [ ] Aggregate searches by date: daily, weekly, monthly trends
- [ ] Calculate search conversion rate: searches that led to purchases
- [ ] Track average search response time
- [ ] Identify slow queries (>500ms) for optimization
- [ ] Export analytics to CSV
- [ ] Add analytics dashboard UI in admin panel (Phase 9 integration)

**Example**:
```typescript
// prisma/schema.prisma
model SearchAnalytics {
  id           String    @id @default(cuid())
  query        String
  resultCount  Int
  userId       String?
  user         User?     @relation(fields: [userId], references: [id])
  timestamp    DateTime  @default(now())
  responseTime Int?      // milliseconds

  @@index([query])
  @@index([timestamp])
  @@index([userId])
}

model SearchClick {
  id         String    @id @default(cuid())
  query      String
  productId  String
  product    Product   @relation(fields: [productId], references: [id])
  userId     String?
  user       User?     @relation(fields: [userId], references: [id])
  timestamp  DateTime  @default(now())

  @@index([query])
  @@index([productId])
  @@index([userId])
}

// src/routes/admin/search-analytics.routes.ts
import { Router } from 'express';
import { adminMiddleware } from '../../middleware/admin.middleware';
import prisma from '../../config/database';

const router = Router();

router.get('/popular-searches', adminMiddleware, async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 20;

  const popular = await prisma.searchAnalytics.groupBy({
    by: ['query'],
    _count: { query: true },
    _avg: { resultCount: true },
    orderBy: { _count: { query: 'desc' } },
    take: limit
  });

  res.json({
    success: true,
    data: {
      searches: popular.map(p => ({
        query: p.query,
        searchCount: p._count.query,
        avgResults: Math.round(p._avg.resultCount || 0)
      }))
    },
    meta: { timestamp: new Date().toISOString(), requestId: req.id }
  });
});

router.get('/zero-result-queries', adminMiddleware, async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 20;

  const zeroResults = await prisma.searchAnalytics.groupBy({
    by: ['query'],
    where: { resultCount: 0 },
    _count: { query: true },
    orderBy: { _count: { query: 'desc' } },
    take: limit
  });

  res.json({
    success: true,
    data: {
      queries: zeroResults.map(q => ({
        query: q.query,
        count: q._count.query
      }))
    },
    meta: { timestamp: new Date().toISOString(), requestId: req.id }
  });
});

export default router;
```

---

### 6. Frontend: Search UI (40 items)

#### 6.1 Search Bar Component (14 items)
- [ ] Create `src/components/search/SearchBar.tsx`
- [ ] Add search input with icon (magnifying glass)
- [ ] Implement debounced input: 300ms delay before triggering search
- [ ] Add "Search" button (optional, can submit on enter)
- [ ] Add keyboard navigation: Enter to search, Escape to close autocomplete
- [ ] Integrate with useSearch hook
- [ ] Display loading indicator during search
- [ ] Show search suggestions dropdown on focus (autocomplete)
- [ ] Highlight matched text in suggestions
- [ ] Navigate suggestions with arrow keys
- [ ] Click suggestion to navigate to product detail
- [ ] Add "View all results" link at bottom of suggestions
- [ ] Close dropdown on click outside or escape key
- [ ] Use B1 brand colors from deneme.html

#### 6.2 Search Results Page (14 items)
- [ ] Create `src/app/search/page.tsx`
- [ ] Display search query in page title: "Search results for 'laptop'"
- [ ] Show result count: "Found 24 products"
- [ ] Display products in grid (same as product listing from Phase 8)
- [ ] Add sorting dropdown: Relevance, Price (Low-High), Price (High-Low), Newest, Popular
- [ ] Add pagination controls
- [ ] Add loading skeleton during search
- [ ] Add empty state: "No products found for 'xyz'. Try different keywords."
- [ ] Add "Did you mean?" suggestions for zero results
- [ ] Highlight search terms in product names
- [ ] Display active filters as chips (removable)
- [ ] Integrate with search filters sidebar
- [ ] Prefetch search results on server (SSR)
- [ ] Add breadcrumbs: Home > Search > "laptop"

#### 6.3 Search Filters Sidebar (12 items)
- [ ] Create `src/components/search/SearchFilters.tsx`
- [ ] Create `src/components/search/FilterCategory.tsx`: category tree
- [ ] Create `src/components/search/FilterPrice.tsx`: price range slider
- [ ] Create `src/components/search/FilterBrand.tsx`: brand checkboxes
- [ ] Create `src/components/search/FilterRating.tsx`: rating stars
- [ ] Create `src/components/search/FilterAttributes.tsx`: dynamic attributes (color swatches, size buttons)
- [ ] Display filter counts from aggregations (e.g., "Laptops (15)")
- [ ] Update URL query params on filter change
- [ ] Add "Clear all filters" button
- [ ] Add collapsible sections for each filter group
- [ ] Make sidebar sticky on scroll
- [ ] Responsive: drawer on mobile (<768px)

**Example**:
```typescript
// src/hooks/useSearch.ts
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useDebounce } from './useDebounce';

interface SearchFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  brands?: string[];
  minRating?: number;
  sortBy?: string;
  page?: number;
}

export const useSearch = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const query = searchParams.get('q') || '';
  const [filters, setFilters] = useState<SearchFilters>({
    category: searchParams.get('category') || undefined,
    minPrice: searchParams.get('minPrice') ? parseFloat(searchParams.get('minPrice')!) : undefined,
    maxPrice: searchParams.get('maxPrice') ? parseFloat(searchParams.get('maxPrice')!) : undefined,
    brands: searchParams.get('brands')?.split(',') || [],
    minRating: searchParams.get('minRating') ? parseFloat(searchParams.get('minRating')!) : undefined,
    sortBy: searchParams.get('sortBy') || 'relevance',
    page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1
  });

  const debouncedQuery = useDebounce(query, 300);

  const { data, isLoading, error } = useQuery({
    queryKey: ['search', debouncedQuery, filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        q: debouncedQuery,
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== undefined && v !== ''))
      });

      const res = await fetch(`/api/search?${params}`);
      if (!res.ok) throw new Error('Search failed');
      return res.json();
    },
    enabled: !!debouncedQuery
  });

  const updateFilters = (newFilters: Partial<SearchFilters>) => {
    const updated = { ...filters, ...newFilters, page: 1 }; // Reset to page 1 on filter change
    setFilters(updated);

    // Update URL
    const params = new URLSearchParams({
      q: query,
      ...Object.fromEntries(Object.entries(updated).filter(([_, v]) => v !== undefined && v !== ''))
    });
    router.push(`/search?${params}`);
  };

  return {
    query,
    filters,
    updateFilters,
    results: data?.data?.products || [],
    facets: data?.data?.facets || {},
    total: data?.data?.total || 0,
    isLoading,
    error
  };
};

// src/components/search/SearchBar.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import SearchSuggestions from './SearchSuggestions';
import { useDebounce } from '@/hooks/useDebounce';

export default function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounce(query, 150);

  const handleSearch = (searchQuery: string) => {
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
      setShowSuggestions(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch(query);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="relative w-full max-w-2xl">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search for products..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          className="pl-10 pr-10"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        )}
      </div>

      {showSuggestions && (
        <SearchSuggestions
          query={debouncedQuery}
          onSelect={(suggestion) => {
            router.push(`/products/${suggestion.id}`);
            setShowSuggestions(false);
          }}
          onViewAll={() => {
            handleSearch(query);
          }}
          onClose={() => setShowSuggestions(false)}
        />
      )}
    </div>
  );
}

// src/app/search/page.tsx
'use client';

import { useSearch } from '@/hooks/useSearch';
import SearchFilters from '@/components/search/SearchFilters';
import SearchResults from '@/components/search/SearchResults';
import ActiveFilters from '@/components/search/ActiveFilters';
import { Select } from '@/components/ui/select';

export default function SearchPage() {
  const { query, filters, updateFilters, results, facets, total, isLoading } = useSearch();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Search results for "{query}"</h1>
          <p className="text-gray-600 mt-1">Found {total} products</p>
        </div>

        <Select
          value={filters.sortBy}
          onChange={(e) => updateFilters({ sortBy: e.target.value })}
        >
          <option value="relevance">Relevance</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
          <option value="newest">Newest</option>
          <option value="popular">Most Popular</option>
        </Select>
      </div>

      <ActiveFilters filters={filters} onRemove={updateFilters} />

      <div className="flex gap-8">
        <aside className="w-64 flex-shrink-0">
          <SearchFilters
            facets={facets}
            filters={filters}
            onFilterChange={updateFilters}
          />
        </aside>

        <main className="flex-1">
          <SearchResults products={results} isLoading={isLoading} />
        </main>
      </div>
    </div>
  );
}
```

---

### 7. Testing & Quality Assurance (28 items)

#### 7.1 Backend Search Tests (14 items)
- [ ] Create `tests/search/elasticsearch.test.ts`
- [ ] Test Elasticsearch connection and health check
- [ ] Test product index creation with mappings
- [ ] Test bulk indexing: index 100 products, verify count
- [ ] Test full-text search with typos: "laptpo" → finds "laptop"
- [ ] Test synonym matching: "notebook" → finds "laptop"
- [ ] Test category filter: returns only products in specified category
- [ ] Test price range filter: returns products within price range
- [ ] Test multi-filter combination: category + price + brand
- [ ] Test aggregations: verify category counts, price ranges, brands
- [ ] Test autocomplete: returns relevant suggestions
- [ ] Test data sync: update product, verify update in Elasticsearch within 5s
- [ ] Test search response time: <200ms for P50 (P1)
- [ ] Achieve ≥85% test coverage for search services

#### 7.2 Frontend Search Tests (8 items)
- [ ] Create `src/components/search/__tests__/SearchBar.test.tsx`
- [ ] Test search input debouncing (300ms delay)
- [ ] Test autocomplete dropdown display
- [ ] Test keyboard navigation in suggestions
- [ ] Test filter changes update URL query params
- [ ] Test active filters display and removal
- [ ] Test empty state for zero results
- [ ] Test loading skeleton display

#### 7.3 E2E Search Tests (6 items)
- [ ] Create `e2e/search/product-search.spec.ts`
- [ ] Test complete search flow: type query → view results → apply filters → sort
- [ ] Test autocomplete: type → see suggestions → click suggestion → navigate to product
- [ ] Test typo tolerance: search "laptpo" → see results for "laptop"
- [ ] Test zero results: search nonsense query → see "No results" message
- [ ] Test mobile filter drawer: open filters → apply → close

---

## 🧪 VALIDATION CRITERIA

### Performance Validation (P1, P2)
```bash
# P1: Search Response Time
time curl "http://localhost:3000/api/search?q=laptop"
# Expected: <200ms for cached queries, <500ms for uncached

# P2: Autocomplete Response Time
time curl "http://localhost:3000/api/search/autocomplete?q=lap"
# Expected: <100ms

# Elasticsearch Health
curl http://localhost:9200/_cluster/health
# Expected: status: "green" or "yellow" (green preferred)
```

### Functional Validation
```typescript
// Full-text search
GET /api/search?q=laptop → 200 OK, returns products with "laptop" in name/description

// Typo tolerance
GET /api/search?q=laptpo → 200 OK, returns products with "laptop"

// Synonym matching
GET /api/search?q=notebook → 200 OK, returns products with "laptop"

// Category filter
GET /api/search?q=laptop&category=electronics → 200 OK, filtered by category

// Price range filter
GET /api/search?q=laptop&minPrice=500&maxPrice=1500 → 200 OK, products in price range

// Multi-filter
GET /api/search?q=laptop&category=electronics&brands=apple,dell&minRating=4
→ 200 OK, all filters applied with AND logic

// Autocomplete
GET /api/search/autocomplete?q=lap → 200 OK, returns suggestions

// Aggregations
Search response includes facets: categories, priceRanges, brands, ratings

// Data sync
Update product in database → Appears in search within 5s
```

### Quality Validation (Q2)
```bash
# Q2: Standard API Format
curl http://localhost:3000/api/search?q=laptop | jq '.success, .data, .meta'
# Expected: All three fields present, data includes products and facets
```

---

## 📊 SUCCESS METRICS

### Performance Metrics
- Search response time (P50) <200ms (P1)
- Search response time (P95) <500ms (P1)
- Autocomplete response time <100ms (P2)
- Data sync latency <5s (database update → search availability)
- Cache hit rate >60% for popular queries
- Elasticsearch index refresh: 1s (near real-time)

### Quality Metrics
- ≥85% test coverage for search services
- TypeScript errors: 0 (Q1)
- Elasticsearch cluster health: green status
- Zero-downtime reindexing capability
- Typo tolerance accuracy >90%

### Business Metrics
- Search usage rate: % of users who use search
- Search conversion rate: % of searches leading to purchases
- Average products clicked per search
- Zero-result query rate <10%
- Popular query coverage: top 20 queries return >10 results each

---

## 🚨 COMMON PITFALLS TO AVOID

### Elasticsearch Anti-Patterns
❌ **WRONG**: Using SQL LIKE queries instead of Elasticsearch
```typescript
// Slow and limited functionality
const products = await prisma.product.findMany({
  where: { name: { contains: query, mode: 'insensitive' } }
});
```

✅ **CORRECT**: Use Elasticsearch with proper analyzers
```typescript
const result = await esClient.search({
  index: 'products',
  body: {
    query: {
      multi_match: {
        query,
        fields: ['name^3', 'description'],
        fuzziness: 'AUTO'
      }
    }
  }
});
```

❌ **WRONG**: Not caching search results
```typescript
// Every search hits Elasticsearch
const result = await esClient.search({...});
```

✅ **CORRECT**: Cache popular queries
```typescript
const cacheKey = `search:${query}:${JSON.stringify(filters)}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const result = await esClient.search({...});
await redis.set(cacheKey, JSON.stringify(result), 'EX', 300);
```

### Data Sync Anti-Patterns
❌ **WRONG**: Synchronous Elasticsearch updates blocking request
```typescript
// Blocks response until ES index completes
await prisma.product.create({...});
await esClient.index({...}); // SLOW!
res.json({...});
```

✅ **CORRECT**: Asynchronous queue-based sync
```typescript
await prisma.product.create({...});
await enqueueProductIndex(productId); // Non-blocking
res.json({...}); // Respond immediately
```

### Search UI Anti-Patterns
❌ **WRONG**: No debouncing on search input
```typescript
// Triggers API call on every keystroke
onChange={(e) => search(e.target.value)}
```

✅ **CORRECT**: Debounced search
```typescript
const debouncedQuery = useDebounce(query, 300);
useEffect(() => {
  if (debouncedQuery) search(debouncedQuery);
}, [debouncedQuery]);
```

---

## 📦 DELIVERABLES

### Backend Deliverables
- [ ] `docker-compose.yml` - Elasticsearch service configuration
- [ ] `src/config/elasticsearch.config.ts` - ES client setup
- [ ] `src/routes/search.routes.ts` - Search APIs
- [ ] `src/services/search.service.ts` - Search logic
- [ ] `src/services/elasticsearch.service.ts` - ES operations
- [ ] `src/services/search-sync.service.ts` - Data sync service
- [ ] `src/services/search-analytics.service.ts` - Analytics tracking
- [ ] `src/jobs/product-index.job.ts` - Bulk indexing job
- [ ] `src/jobs/search-sync.job.ts` - Real-time sync job
- [ ] `src/utils/search-query-builder.utils.ts` - Query DSL builder
- [ ] `src/utils/search-aggregations.utils.ts` - Aggregations helper
- [ ] `src/routes/admin/search-analytics.routes.ts` - Analytics APIs
- [ ] `prisma/schema.prisma` - SearchAnalytics, SearchClick models
- [ ] `tests/search/*.test.ts` - Search tests (≥85% coverage)

### Frontend Deliverables
- [ ] `src/app/search/page.tsx` - Search results page
- [ ] `src/components/search/SearchBar.tsx` - Search input with autocomplete
- [ ] `src/components/search/SearchResults.tsx` - Results grid
- [ ] `src/components/search/SearchFilters.tsx` - Filter sidebar
- [ ] `src/components/search/FilterCategory.tsx` - Category filter
- [ ] `src/components/search/FilterPrice.tsx` - Price range slider
- [ ] `src/components/search/FilterBrand.tsx` - Brand multi-select
- [ ] `src/components/search/FilterAttributes.tsx` - Dynamic attributes
- [ ] `src/components/search/FilterRating.tsx` - Rating filter
- [ ] `src/components/search/ActiveFilters.tsx` - Selected filters chips
- [ ] `src/components/search/SearchSuggestions.tsx` - Autocomplete dropdown
- [ ] `src/hooks/useSearch.ts` - Search state hook
- [ ] `src/hooks/useAutocomplete.ts` - Autocomplete hook
- [ ] `src/hooks/useSearchFilters.ts` - Filter state hook
- [ ] `e2e/search/*.spec.ts` - E2E search tests

### Documentation Deliverables
- [ ] Elasticsearch setup guide (Docker, index creation, mappings)
- [ ] Search API documentation (endpoints, query params, response format)
- [ ] Data sync architecture diagram
- [ ] Search analytics dashboard guide
- [ ] Environment variables documentation (.env.example)

---

## 📝 PHASE COMPLETION REPORT TEMPLATE

```markdown
# Phase 11: Search & Filters Enhancement - Completion Report

## ✅ Completed Items
- Backend Elasticsearch Setup: X/18 items
- Backend Data Synchronization: X/26 items
- Backend Search Service: X/32 items
- Backend Autocomplete: X/16 items
- Backend Search Analytics: X/14 items
- Frontend Search UI: X/40 items
- Testing & QA: X/28 items

**Total Progress**: X/174 items (X%)

## 📊 Metrics Achieved
- Search response time P50: Xms
- Search response time P95: Xms
- Autocomplete response time: Xms
- Data sync latency: Xs
- Cache hit rate: X%
- Test coverage: X%
- Elasticsearch health: green/yellow/red
- TypeScript errors: 0 ✅

## 🎯 Functional Validation
- Full-text Search: ✅ Working with typo tolerance
- Synonym Matching: ✅ "notebook" finds "laptop"
- Faceted Filters: ✅ Dynamic aggregations working
- Autocomplete: ✅ Suggestions in <100ms
- Data Sync: ✅ Updates appear in <5s
- Search Analytics: ✅ Tracking popular queries

## 🚧 Known Issues / Technical Debt
- [ ] Issue 1 description
- [ ] Issue 2 description

## 📚 Documentation
- [ ] Elasticsearch setup guide created
- [ ] Search API documentation added
- [ ] Data sync diagram created
- [ ] Environment variables documented

## 👥 Phase Review
**Reviewed by**: [Name]
**Date**: [Date]
**Approved**: ✅ / ⏸️ / ❌

**Next Phase**: Phase 12 - Notifications System (Email, SMS, Push Notifications)
```

---

**END OF PHASE 11 DOCUMENTATION**
**Total Checklist Items**: 174 items
**Estimated Completion Time**: 8-11 days
**Dependencies**: Phases 2, 4, 6, 8 must be completed first
**Next Phase**: Phase 12 - Notifications System (Multi-channel Communication)

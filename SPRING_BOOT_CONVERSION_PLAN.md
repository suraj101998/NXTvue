# NXTvue Backend — Spring Boot Conversion Plan

## Executive Summary

Convert the Python-based NXTvue backend (FastAPI + synchronous data processing + Bob Shell LLM integration) into a **production-grade Spring Boot 3.x** application with reactive/async architecture, proper domain modeling, observability, and operational readiness.

---

## 1. Target Spring Boot Stack

### Core Framework
| Component | Technology | Version | Rationale |
|-----------|------------|---------|-----------|
| **Framework** | Spring Boot | 3.2+ (Java 21 LTS) | Modern, native-image ready, virtual threads |
| **Web Layer** | Spring WebFlux (Reactive) | 3.2+ | Non-blocking I/O for external API calls, backpressure |
| **API Spec** | Springdoc OpenAPI | 2.3+ | Auto-generated OpenAPI 3.1 docs |
| **Validation** | Jakarta Bean Validation | 3.0+ | Declarative request validation |
| **Config** | Spring Cloud Config / `@ConfigurationProperties` | 3.2+ | Type-safe, environment-specific config |

### Data Access & Persistence
| Component | Technology | Version | Rationale |
|-----------|------------|---------|-----------|
| **Primary DB** | PostgreSQL 16+ | 16 | ACID, JSONB, partitioning, advisory locks |
| **ORM** | Spring Data JPA + Hibernate 6.4 | 6.4 | Entity mapping, projections, specs |
| **Reactive DB** | Spring Data R2DBC | 1.2+ | Non-blocking DB access for hot paths |
| **Cache** | Redis 7+ (Lettuce reactive) | 7.2 | Distributed caching, rate limiting, sessions |
| **Time-series** | TimescaleDB (PostgreSQL extension) | 2.13+ | Native time-series for price/NAV history |
| **Search** | Elasticsearch 8+ | 8.11 | Full-text search for news, holdings, reports |

### Messaging & Async Processing
| Component | Technology | Version | Rationale |
|-----------|------------|---------|-----------|
| **Message Broker** | Apache Kafka 3.6+ / Spring Cloud Stream | 3.6 | Event-driven architecture, replay, ordering |
| **Job Scheduler** | Spring Batch 5.1+ | 5.1 | Portfolio rebalancing, daily metric computation |
| **Task Executor** | Virtual Threads (Java 21) + CompletableFuture | JDK 21 | Lightweight concurrency for CPU-bound quant work |

### Observability & Operations
| Component | Technology | Version | Rationale |
|-----------|------------|---------|-----------|
| **Metrics** | Micrometer + Prometheus | 1.12+ | Dimensional metrics, SLO dashboards |
| **Tracing** | Micrometer Tracing + OpenTelemetry | 1.12+ | Distributed traces, W3C context propagation |
| **Logging** | Logback + Structured JSON (Logstash encoder) | 1.4+ | Correlated logs, Loki/Grafana ready |
| **Health** | Spring Boot Actuator | 3.2+ | Liveness/readiness, custom health indicators |
| **Chaos/Resilience** | Resilience4j 2.2+ | 2.2 | Circuit breakers, bulkheads, retries, rate limiters |

### Security
| Component | Technology | Version | Rationale |
|-----------|------------|---------|-----------|
| **Auth** | Spring Security 6.2+ + OAuth2 Resource Server | 6.2 | JWT validation, scopes, method security |
| **API Gateway** | Spring Cloud Gateway 4.1+ | 4.1 | Rate limiting, routing, auth offload |
| **Secrets** | HashiCorp Vault / AWS Secrets Manager | - | Dynamic secrets, rotation |

### Testing & Quality
| Component | Technology | Version | Rationale |
|-----------|------------|---------|-----------|
| **Unit** | JUnit 5 + Mockito 5 + AssertJ | 5.10/5.8 | Modern testing |
| **Integration** | Testcontainers (PostgreSQL, Redis, Kafka, ES) | 1.19+ | Real infra in tests |
| **Contract** | Spring Cloud Contract | 4.1+ | Consumer-driven contracts |
| **Performance** | Gatling / k6 | - | Load testing |
| **Static Analysis** | SpotBugs, Checkstyle, PMD, Error Prone | - | Code quality gates |

---

## 2. Domain Model & Module Structure

```
nxtvue-backend/
├── nxtvue-api                 # OpenAPI spec + DTOs (shared)
├── nxtvue-common              # Shared kernels: enums, exceptions, utils
├── nxtvue-domain              # Core domain: entities, value objects, domain services
├── nxtvue-data                # Repositories, JPA/R2DBC entities, migrations
├── nxtvue-analyzer            # Quant/Risk engines (pure Java, no Spring deps)
├── nxtvue-provider            # Data provider adapters (Screener, yFinance, AMFI, FBIL, FRED)
├── nxtvue-report              # Report generation, LLM orchestration, PDF rendering
├── nxtvue-portfolio           # Portfolio domain, holdings, rebalancing
├── nxtvue-api-web             # WebFlux controllers, routing, filters
├── nxtvue-batch               # Spring Batch jobs (daily metrics, cache warmup)
├── nxtvue-integration         # Kafka consumers/producers, event handlers
└── nxtvue-infra               # Docker Compose, Helm charts, Terraform, CI/CD
```

### Core Domain Entities (JPA)
```java
// nxtvue-domain
@Entity @Table(name = "instruments")
public class Instrument { ... }           // Stock, ETF, MF, Bond, Index

@Entity @Table(name = "price_history", indexes = @Index(columnList = "instrument_id, date"))
public class PriceHistory { ... }         // Daily OHLCV (partitioned by month)

@Entity @Table(name = "fundamentals")
public class Fundamentals { ... }         // Annual/quarterly financials (JSONB)

@Entity @Table(name = "holdings")
public class Holding { ... }              // User portfolio positions

@Entity @Table(name = "analysis_reports")
public class AnalysisReport { ... }       // Generated reports with PDF blob ref

@Entity @Table(name = "benchmarks")
public class Benchmark { ... }            // Index/ETF benchmark definitions
```

---

## 3. Feature-by-Feature Migration Mapping

### 3.1 Data Provider Layer (`nxtvue-provider`)

| Python Module | Spring Equivalent | Key Classes |
|---------------|-------------------|-------------|
| `screener_layer.py` | `ScreenerDataProvider` | `WebClient` + Jsoup/HTML parsing, circuit breaker |
| `yfinance_layer.py` | `YFinanceDataProvider` | `WebClient` + custom DTO mapping, retry/timeout |
| `etf_layer.py` | `EtfDataProvider` | Extends `YFinanceDataProvider`, adds ETF-specific extractors |
| `mutual_fund_layer.py` | `MutualFundDataProvider` | `Mftool` wrapper (JNI/Process), AMFI CSV parser, SEBI PDF parser |
| `bond_layer.py` | `BondDataProvider` | US Treasury XML (StAX), FRED client, FBIL HTML parser |
| `historical_data_provider.py` | `HistoricalDataProvider` | Unified facade with caching, fallback chain |
| `benchmark_resolver.py` | `BenchmarkResolver` | Rule-based mapping: category/market → benchmark definition |
| `timeseries_normalizer.py` | `TimeSeriesNormalizer` | Pure Java: alignment, forward-fill, log/simple returns |

**Resilience Pattern**: Each provider wrapped with `Resilience4j`:
```java
@CircuitBreaker(name = "screener", fallbackMethod = "screenerFallback")
@Retry(name = "screener")
@TimeLimiter(name = "screener")
public Mono<InstrumentData> fetchFromScreener(String symbol) { ... }
```

### 3.2 Analyzer Engine (`nxtvue-analyzer`)

| Python Class | Spring Equivalent | Notes |
|--------------|-------------------|-------|
| `QuantAnalyzer` | `QuantEngine` (stateless service) | Pure math, no Spring deps, fully testable |
| `RiskAnalyzer` | `RiskEngine` (orchestrates QuantEngine) | Adds labels, data gaps, benchmark alignment |
| `PortfolioAnalyzer` | `PortfolioEngine` | Holdings aggregation, concentration, rebalancing signals |

**Key Design**: All analyzers are **stateless, pure functions** → easy to parallelize, test, native-image compile.

```java
// QuantEngine.java — all static methods, no side effects
public final class QuantEngine {
    public static ReturnsMetrics computeReturns(PriceSeries prices) { ... }
    public static RiskMetrics computeRiskMetrics(ReturnSeries returns, double rf) { ... }
    public static AlphaBeta computeAlphaBeta(ReturnSeries fund, ReturnSeries bench) { ... }
    public static DurationMetrics computeDuration(double coupon, double ytm, double maturity) { ... }
    // ... 40+ metrics
}
```

### 3.3 Report Generation (`nxtvue-report`)

| Python Component | Spring Equivalent |
|------------------|-------------------|
| `report_generator.py` | `ReportOrchestrator` (service) |
| `_run_bob()` subprocess | `LlmClient` (HTTP client to Bob API / local LLM) |
| `pdf_writer.py` | `PdfRenderer` (iText 8 / Flying Saucer + Thymeleaf) |
| System prompts | Externalized templates (Thymeleaf/Mustache) |

**Architecture**:
```
ReportRequest → ReportOrchestrator
  ├─► DataProviderFacade.fetchAll(ticker, market) → InstrumentData
  ├─► RiskEngine.run(priceSeries, benchSeries) → QuantMetrics + RiskMetrics
  ├─► PromptBuilder.build(systemPrompt, data) → String
  ├─► LlmClient.generate(prompt) → String (async, streaming optional)
  └─► PdfRenderer.render(memo, metadata) → byte[] / S3 key
```

### 3.4 Portfolio Analysis (`nxtvue-portfolio`)

| Python Component | Spring Equivalent |
|------------------|-------------------|
| `portfolio_analyser.py` | `PortfolioService` + `PortfolioEngine` |
| `load_holdings()` | `HoldingsParser` (Apache POI for Excel, OpenCSV for CSV) |
| `fetch_current_prices()` | `PriceService` (batch yFinance call via `WebClient`) |
| `compute_portfolio_metrics()` | `PortfolioEngine.compute(holdings)` |

### 3.5 API Layer (`nxtvue-api-web`)

| Python Endpoint | Spring WebFlux Controller |
|-----------------|---------------------------|
| `GET /health` | `HealthController` + custom `HealthIndicator`s |
| `GET /api/indices` | `MarketDataController.getIndices()` (cached) |
| `POST /api/v1/analysis/stock` | `AnalysisController.analyzeStock()` |
| `POST /api/v1/analysis/compare` | `AnalysisController.compare()` |
| `POST /api/v1/analysis/portfolio` | `PortfolioController.analyze()` |
| `GET /api/v1/reports/{filename}` | `ReportController.download()` |

**Reactive signatures**:
```java
@RestController @RequestMapping("/api/v1")
public class AnalysisController {
    @PostMapping("/analysis/stock")
    public Mono<AnalysisResponse> analyzeStock(@Valid @RequestBody AnalysisRequest req) { ... }

    @PostMapping("/analysis/compare")
    public Mono<CompareResponse> compare(@Valid @RequestBody CompareRequest req) { ... }

    @PostMapping("/analysis/portfolio")
    public Mono<PortfolioResponse> analyzePortfolio(@Valid @RequestBody PortfolioRequest req) { ... }
}
```

---

## 4. Configuration Strategy

### Application.yml (Profile-based)
```yaml
# application.yml (base)
spring:
  application:
    name: nxtvue-backend
  profiles:
    active: ${SPRING_PROFILES_ACTIVE:local}
  config:
    import: optional:vault://secret/nxtvue
  datasource:
    url: jdbc:postgresql://${DB_HOST:localhost}:5432/nxtvue
    username: ${DB_USER:nxtvue}
    password: ${DB_PASSWORD}
    hikari:
      maximum-pool-size: 20
  r2dbc:
    url: r2dbc:postgresql://${DB_HOST:localhost}:5432/nxtvue
  redis:
    host: ${REDIS_HOST:localhost}
    port: 6379
  kafka:
    bootstrap-servers: ${KAFKA_BOOTSTRAP:localhost:9092}
  flyway:
    enabled: true
    locations: classpath:db/migration

# Resilience4j
resilience4j:
  circuitbreaker:
    instances:
      screener:
        registerHealthIndicator: true
        slidingWindowSize: 10
        failureRateThreshold: 50
        waitDurationInOpenState: 30s
  retry:
    instances:
      screener:
        maxAttempts: 3
        waitDuration: 2s
        enableExponentialBackoff: true
  timelimiter:
    instances:
      screener:
        timeoutDuration: 15s

# Cache
cache:
  indices-ttl: 30s
  instrument-ttl: 1h
  report-ttl: 24h

# LLM
llm:
  provider: bob-shell # or openai, anthropic, local
  bob:
    executable: bob
    timeout: 300s
    workspace: ${user.home}/.bob

# External APIs
external:
  yfinance:
    base-url: https://query1.finance.yahoo.com
    timeout: 30s
  screener:
    base-url: https://www.screener.in
    timeout: 30s
  amfi:
    nav-url: https://www.amfiindia.com/spages/NAVAll.txt
    ter-url: https://www.amfiindia.com/research-information/other-data/scheme-wise-ratio
  fred:
    api-key: ${FRED_API_KEY}
    base-url: https://api.stlouisfed.org/fred
  fbil:
    base-url: https://www.fbil.org.in
```

### Type-Safe Config Properties
```java
@ConfigurationProperties(prefix = "cache")
@Data
public class CacheProperties {
    private Duration indicesTtl = Duration.ofSeconds(30);
    private Duration instrumentTtl = Duration.ofHours(1);
    private Duration reportTtl = Duration.ofDays(1);
}

@ConfigurationProperties(prefix = "llm")
@Data
public class LlmProperties {
    private Provider provider = Provider.BOB_SHELL;
    private BobShellProperties bob = new BobShellProperties();

    @Data
    public static class BobShellProperties {
        private String executable = "bob";
        private Duration timeout = Duration.ofMinutes(5);
        private String workspace;
    }
}
```

---

## 5. Data Flow Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Client     │────▶│  Spring Cloud    │────▶│  WebFlux        │
│  (Web/UI)   │     │  Gateway         │     │  Controllers    │
└─────────────┘     └──────────────────┘     └────────┬────────┘
                                                      │
                        ┌─────────────────────────────┼─────────────────────────────┐
                        ▼                             ▼                             ▼
              ┌───────────────────┐         ┌───────────────────┐         ┌───────────────────┐
              │  Analysis         │         │  Portfolio        │         │  Market Data      │
              │  Orchestrator     │         │  Service          │         │  Controller       │
              └─────────┬─────────┘         └─────────┬─────────┘         └─────────┬─────────┘
                        │                             │                             │
                        ▼                             ▼                             ▼
              ┌───────────────────┐         ┌───────────────────┐         ┌───────────────────┐
              │ DataProvider      │         │ HoldingsParser    │         │ IndexCache        │
              │ Facade            │         │ PriceService      │         │ (Redis + Caffeine)│
              └─────────┬─────────┘         └───────────────────┘         └───────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
┌───────────────┐ ┌───────────┐ ┌───────────────┐
│ ScreenerProvider│ │YFinanceProvider│ │MF/BondProvider │
└───────┬───────┘ └─────┬─────┘ └───────┬───────┘
        │               │               │
        ▼               ▼               ▼
   (External APIs)  (yFinance)      (AMFI/FBIL/FRED)
                        │
                        ▼
              ┌───────────────────┐
              │ RiskEngine        │
              │ (QuantEngine +    │
              │  Labels + Gaps)   │
              └─────────┬─────────┘
                        │
                        ▼
              ┌───────────────────┐
              │ PromptBuilder     │────▶ LlmClient ──▶ LLM (Bob / OpenAI / Local)
              └─────────┬─────────┘
                        │
                        ▼
              ┌───────────────────┐
              │ PdfRenderer       │────▶ Object Storage (S3/MinIO) / DB
              └───────────────────┘
```

---

## 6. Key Implementation Details

### 6.1 Virtual Threads for CPU-Bound Quant Work
```java
@Configuration
@EnableAsync
public class AsyncConfig {
    @Bean("quantExecutor")
    public Executor quantExecutor() {
        // Java 21 virtual threads — lightweight, millions possible
        return Executors.newVirtualThreadPerTaskExecutor();
    }
}

@Service
@RequiredArgsConstructor
public class RiskEngine {
    private final QuantEngine quantEngine;
    private final TimeSeriesNormalizer normalizer;

    @Async("quantExecutor")
    public CompletableFuture<RiskResult> runAsync(PriceSeries price, PriceSeries bench, ...) {
        return CompletableFuture.supplyAsync(() -> run(price, bench, ...));
    }
}
```

### 6.2 Caching Strategy
```java
@Service
@RequiredArgsConstructor
public class IndexCacheService {
    private final ReactiveRedisTemplate<String, IndicesData> redis;
    private final CacheProperties cacheProps;
    private final CaffeineCache localCache; // L1 cache

    public Mono<IndicesData> getIndices() {
        // L1 → L2 → Fetch
        return Mono.fromCallable(() -> localCache.getIfPresent("indices"))
            .filter(Objects::nonNull)
            .switchIfEmpty(
                redis.opsForValue().get("indices:live")
                    .doOnNext(d -> localCache.put("indices", d))
            )
            .switchIfEmpty(fetchAndCache());
    }
}
```

### 6.3 PDF Generation (iText 8)
```java
@Service
@RequiredArgsConstructor
public class PdfRenderer {
    private final ThymeleafTemplateEngine templateEngine;

    public byte[] render(String markdown, ReportMetadata meta) {
        String html = markdownToHtml(markdown); // flexmark-java
        String styledHtml = templateEngine.process("report-template", context(meta, html));
        return PdfDocument.fromHtml(styledHtml).toBytes(); // iText 8
    }
}
```

### 6.4 LLM Client Abstraction
```java
public interface LlmClient {
    Mono<String> generate(String prompt, LlmOptions options);
    Flux<String> stream(String prompt, LlmOptions options);
}

@Service @ConditionalOnProperty(name = "llm.provider", havingValue = "bob-shell")
public class BobShellClient implements LlmClient { ... }

@Service @ConditionalOnProperty(name = "llm.provider", havingValue = "openai")
public class OpenAiClient implements LlmClient { ... }
```

---

## 7. Database Migrations (Flyway)

```sql
-- V1__init_schema.sql
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE instruments (
    id              BIGSERIAL PRIMARY KEY,
    symbol          VARCHAR(32) NOT NULL,
    market          VARCHAR(16) NOT NULL,  -- 'india', 'us'
    asset_type      VARCHAR(16) NOT NULL,  -- 'stock', 'etf', 'mf', 'bond', 'index'
    name            VARCHAR(256),
    sector          VARCHAR(128),
    industry        VARCHAR(128),
    exchange        VARCHAR(32),
    currency        VARCHAR(8) DEFAULT 'INR',
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE (symbol, market)
);

CREATE TABLE price_history (
    instrument_id   BIGINT NOT NULL REFERENCES instruments(id),
    date            DATE NOT NULL,
    open            NUMERIC(18,4),
    high            NUMERIC(18,4),
    low             NUMERIC(18,4),
    close           NUMERIC(18,4) NOT NULL,
    volume          BIGINT,
    adjusted_close  NUMERIC(18,4),
    PRIMARY KEY (instrument_id, date)
);
SELECT create_hypertable('price_history', 'date', chunk_time_interval => INTERVAL '1 month');

CREATE INDEX idx_price_history_instrument_date_desc ON price_history (instrument_id, date DESC);

CREATE TABLE fundamentals (
    instrument_id   BIGINT PRIMARY KEY REFERENCES instruments(id),
    annual_is       JSONB,   -- income statement
    quarterly_is    JSONB,
    annual_bs       JSONB,   -- balance sheet
    quarterly_bs    JSONB,
    annual_cf       JSONB,   -- cash flow
    quarterly_cf    JSONB,
    key_ratios      JSONB,   -- computed ratios
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE analysis_reports (
    id              BIGSERIAL PRIMARY KEY,
    instrument_id   BIGINT NOT NULL REFERENCES instruments(id),
    report_type     VARCHAR(32) NOT NULL, -- 'single', 'compare', 'portfolio'
    projection_year INT NOT NULL,
    memo            TEXT NOT NULL,
    key_metrics     JSONB,
    pdf_storage_key VARCHAR(512),         -- S3/MinIO key
    status          VARCHAR(16) DEFAULT 'COMPLETED',
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE holdings (
    id              BIGSERIAL PRIMARY KEY,
    user_id         VARCHAR(64) NOT NULL,
    instrument_id   BIGINT NOT NULL REFERENCES instruments(id),
    quantity        NUMERIC(18,6) NOT NULL,
    avg_cost        NUMERIC(18,4) NOT NULL,
    market          VARCHAR(16) NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE benchmarks (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(128) NOT NULL,
    symbol          VARCHAR(32) NOT NULL,
    market          VARCHAR(16) NOT NULL,
    asset_type      VARCHAR(16) NOT NULL, -- 'index', 'etf'
    return_type     VARCHAR(16) DEFAULT 'total_return',
    category        VARCHAR(64),          -- for MF category mapping
    is_active       BOOLEAN DEFAULT true
);
```

---

## 8. Observability & SLOs

### Metrics to Export (Prometheus)
```yaml
# Custom metrics
nxtvue_analysis_duration_seconds{type="stock|compare|portfolio", quantile="0.5|0.95|0.99"}
nxtvue_data_provider_latency_seconds{provider="screener|yfinance|amfi|fred", outcome="success|error"}
nxtvue_llm_generation_duration_seconds{provider="bob|openai"}
nxtvue_pdf_render_duration_seconds
nxtvue_cache_hit_ratio{cache="indices|instrument|report"}
nxtvue_active_analyses{gauge}
nxtvue_data_gaps_total{provider, gap_type}
```

### Health Indicators
```java
@Component
public class DataProviderHealthIndicator implements HealthIndicator {
    private final ScreenerDataProvider screener;
    private final YFinanceDataProvider yfinance;
    private final AmfiDataProvider amfi;

    @Override
    public Health health() {
        var checks = Map.of(
            "screener", screener.healthCheck(),
            "yfinance", yfinance.healthCheck(),
            "amfi", amfi.healthCheck()
        );
        var down = checks.entrySet().stream()
            .filter(e -> !e.getValue().isUp())
            .map(Map.Entry::getKey)
            .toList();
        return down.isEmpty()
            ? Health.up().withDetails(checks).build()
            : Health.down().withDetails(checks).withDetail("down", down).build();
    }
}
```

### SLO Targets
| SLI | Target | Measurement Window |
|-----|--------|-------------------|
| Analysis API p99 latency | < 120s (LLM bound) | 5m |
| Market data API p99 latency | < 500ms | 5m |
| Cache hit ratio (indices) | > 95% | 1h |
| Report generation success rate | > 99% | 24h |
| Data provider availability | > 99.5% | 24h |

---

## 9. CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: timescale/timescaledb:latest-pg16
        env: { POSTGRES_DB: nxtvue, POSTGRES_PASSWORD: test }
        ports: [5432:5432]
      redis:
        image: redis:7-alpine
        ports: [6379:6379]
      kafka:
        image: confluentinc/cp-kafka:7.5.0
        env: { KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181, KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092 }
        ports: [9092:9092]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { distribution: 'temurin', java-version: '21', cache: 'maven' }
      - name: Run tests
        run: ./mvnw verify -DskipITs=false
      - name: Static analysis
        run: ./mvnw spotbugs:check checkstyle:check pmd:check
      - name: Build native image (GraalVM)
        if: github.ref == 'refs/heads/main'
        run: ./mvnw -Pnative native:compile

  docker:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ghcr.io/${{ github.repository }}/nxtvue-backend:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

---

## 10. Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Kubernetes Cluster (EKS/GKE)                 │
├─────────────────────────────────────────────────────────────────────┤
│  Ingress (NGINX/Traefik)  ──▶  Spring Cloud Gateway (3 replicas)   │
│                                                            │        │
│                    ┌──────────────────────────────────────┘        │
│                    ▼                                               │
│         ┌─────────────────┐    ┌─────────────────┐                │
│         │ nxtvue-api-web  │    │ nxtvue-batch    │                │
│         │ (Deployment,    │    │ (CronJob,       │                │
│         │  HPA 3-20)      │    │  daily 02:00)   │                │
│         └────────┬────────┘    └────────┬────────┘                │
│                  │                      │                         │
│         ┌────────┴────────┐    ┌────────┴────────┐                │
│         │  PostgreSQL     │    │  Redis Cluster  │                │
│         │  (TimescaleDB,  │    │  (6 nodes,      │                │
│         │   read replica) │    │   sentinel)     │                │
│         └─────────────────┘    └─────────────────┘                │
│                  │                      │                         │
│         ┌────────┴────────┐    ┌────────┴────────┐                │
│         │  Kafka (Strimzi)│    │  MinIO (S3 API) │                │
│         │  3 brokers      │    │  4 nodes        │                │
│         └─────────────────┘    └─────────────────┘                │
│                  │                                               │
│         ┌────────┴────────┐                                      │
│         │  Elasticsearch  │                                      │
│         │  3 master + 3 data                                     │
│         └─────────────────┘                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Helm Values Highlights
```yaml
# values.yaml
replicaCount: 3
autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 20
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

resources:
  limits:
    cpu: "2000m"
    memory: "2Gi"
  requests:
    cpu: "500m"
    memory: "1Gi"

jvmOpts: "-XX:+UseZGC -XX:+ZGenerational -Xms1g -Xmx1g -XX:MaxRAMPercentage=75.0"

service:
  type: ClusterIP
  port: 8080

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/proxy-read-timeout: "180"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "180"
  hosts:
    - host: api.nxtvue.example.com
      paths: ["/"]
  tls:
    - secretName: nxtvue-tls
      hosts: [api.nxtvue.example.com]

configMaps:
  application.yml: |
    spring:
      datasource:
        url: jdbc:postgresql://{{ .Values.postgres.host }}:5432/nxtvue
      kafka:
        bootstrap-servers: {{ .Values.kafka.brokers }}
    # ... rest from application.yml

secrets:
  - name: nxtvue-secrets
    stringData:
      DB_PASSWORD: {{ .Values.dbPassword }}
      FRED_API_KEY: {{ .Values.fredApiKey }}
      BOB_API_KEY: {{ .Values.bobApiKey }}
```

---

## 11. Migration Phases

### Phase 1: Foundation (Weeks 1-3)
- [ ] Spring Boot 3.2 + Java 21 project setup (multi-module Maven/Gradle)
- [ ] PostgreSQL + TimescaleDB schema + Flyway migrations
- [ ] Spring WebFlux controllers (health, indices placeholder)
- [ ] Configuration management (`@ConfigurationProperties`, Vault integration)
- [ ] Observability: Micrometer + Prometheus + Grafana dashboards
- [ ] CI/CD pipeline with Testcontainers integration tests

### Phase 2: Data Providers (Weeks 4-6)
- [ ] `YFinanceDataProvider` with WebClient, resilience4j, DTO mapping
- [ ] `ScreenerDataProvider` (HTML parsing with Jsoup)
- [ ] `HistoricalDataProvider` facade with caching (Redis + Caffeine L1)
- [ ] `BenchmarkResolver` rule engine
- [ ] `TimeSeriesNormalizer` pure Java port
- [ ] Unit tests for each provider with WireMock

### Phase 3: Analyzer Engine (Weeks 7-9)
- [ ] Port `QuantEngine` — all 40+ metrics (JUnit parameterized tests vs Python outputs)
- [ ] Port `RiskEngine` — orchestration, labels, data gaps
- [ ] Port `PortfolioEngine` — holdings math, concentration, rebalancing
- [ ] Benchmark: validate Java outputs match Python within 1e-6 tolerance

### Phase 4: Report Generation (Weeks 10-12)
- [ ] `ReportOrchestrator` service
- [ ] `PromptBuilder` with externalized Thymeleaf templates
- [ ] `LlmClient` abstraction (Bob Shell, OpenAI, Local)
- [ ] `PdfRenderer` with iText 8 + Thymeleaf templates
- [ ] Object storage integration (S3/MinIO) for PDF persistence

### Phase 5: Portfolio & Advanced Features (Weeks 13-15)
- [ ] `MutualFundDataProvider` (mftool via ProcessBuilder, AMFI CSV, SEBI)
- [ ] `BondDataProvider` (US Treasury XML, FRED, FBIL)
- [ ] `EtfDataProvider` (extends YFinance)
- [ ] Holdings parser (Apache POI + OpenCSV)
- [ ] Batch jobs: daily metric computation, cache warmup, NAV refresh

### Phase 6: Hardening & Launch (Weeks 16-18)
- [ ] Load testing (Gatling): 100 concurrent analyses
- [ ] Chaos engineering: provider failures, LLM timeouts, DB failover
- [ ] Security audit: OWASP, dependency scan, pen test
- [ ] Documentation: OpenAPI spec, architecture decision records (ADRs)
- [ ] Runbook: deployment, rollback, incident response
- [ ] Canary deployment to production

---

## 12. Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Bob Shell CLI dependency** | High — external process, licensing | Abstract `LlmClient`; support OpenAI/Anthropic/local LLMs as alternatives |
| **Screener.in HTML scraping** | Medium — brittle, no API | Circuit breaker + fallback to yFinance; monitor for structure changes |
| **yFinance rate limits** | Medium | Redis-backed rate limiter (token bucket), exponential backoff |
| **Quant math porting errors** | High | Property-based testing (jqwik) comparing Java vs Python outputs on 1000+ fixtures |
| **PDF rendering fidelity** | Medium | Visual regression tests (pixel diff) against Python weasyprint output |
| **Java 21 virtual threads + blocking libs** | Low | Audit all libraries; use reactive variants (R2DBC, Lettuce, WebClient) |
| **TimescaleDB operational complexity** | Medium | Managed service (Timescale Cloud / AWS RDS for PostgreSQL + Timescale) |

---

## 13. Estimated Effort

| Phase | Duration | Team Size |
|-------|----------|-----------|
| Foundation | 3 weeks | 2-3 engineers |
| Data Providers | 3 weeks | 2 engineers |
| Analyzer Engine | 3 weeks | 2 engineers |
| Report Generation | 3 weeks | 2 engineers |
| Portfolio & Advanced | 3 weeks | 2 engineers |
| Hardening & Launch | 3 weeks | 2-3 engineers |
| **Total** | **~18 weeks** | **2-3 engineers** |

---

## 14. Deliverables Checklist

- [ ] Multi-module Spring Boot 3.2+ project (Java 21)
- [ ] OpenAPI 3.1 spec (`/api-docs`, `/swagger-ui.html`)
- [ ] PostgreSQL + TimescaleDB schema with Flyway migrations
- [ ] All 5 data providers with resilience patterns
- [ ] Quant/Risk/Portfolio engines (100% unit test coverage)
- [ ] Report orchestration with LLM abstraction + PDF rendering
- [ ] Reactive WebFlux API with validation, error handling
- [ ] Redis caching (L1 Caffeine + L2 Redis)
- [ ] Prometheus metrics + Grafana dashboards + alerts
- [ ] Distributed tracing (OpenTelemetry → Jaeger/Tempo)
- [ ] Structured JSON logging (Loki-ready)
- [ ] Spring Batch jobs for daily computation
- [ ] Kafka event streaming for async workflows
- [ ] Testcontainers integration tests (all providers, analyzers, API)
- [ ] Native image build (GraalVM) for fast cold starts
- [ ] Helm charts + Kustomize overlays for K8s deployment
- [ ] Runbooks, ADRs, API documentation
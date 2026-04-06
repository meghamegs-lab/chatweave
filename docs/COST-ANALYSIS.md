# ChatWeave Cost Analysis

Infrastructure cost projections across four user tiers. All prices are monthly estimates based on current provider pricing (April 2026).

---

## Assumptions

| Parameter | Value |
|-----------|-------|
| Avg messages per user per day | 20 |
| Avg tokens per message (prompt + completion) | ~1,500 (prompt) + ~500 (completion) |
| Plugin launches per user per day | 3 |
| Avg session duration | 15 minutes |
| Peak concurrent users | 10-15% of DAU (e.g., 200K DAU → ~30K concurrent at school-hours peak) |
| Database rows per user per month | ~600 (messages) + ~90 (plugin events) |
| Static assets per plugin | ~2 MB (5 plugins = ~10 MB total) |

---

## Tier 1: 100 Users (Pilot / Classroom)

| Resource | Provider | Spec | Monthly Cost |
|----------|----------|------|-------------|
| **Compute** | Railway | Starter plan, 1 vCPU / 512 MB | $5 |
| **Database** | Neon PostgreSQL | Free tier (0.5 GB storage, 190 compute hours) | $0 |
| **AI API** | Anthropic (Claude Sonnet) | ~3M input + ~1M output tokens/month | $12 |
| **Bandwidth** | Railway included | ~5 GB/month | $0 |
| **Domain/SSL** | Railway included | Custom domain + auto SSL | $0 |
| **Total** | | | **~$17/month** |

**Notes:**
- Neon free tier is sufficient for this scale
- Single Railway instance handles all traffic
- AI costs are the dominant expense even at small scale

---

## Tier 2: 1,000 Users (School District)

| Resource | Provider | Spec | Monthly Cost |
|----------|----------|------|-------------|
| **Compute** | Railway | Pro plan, 2 vCPU / 2 GB, auto-scaling | $20 |
| **Database** | Neon PostgreSQL | Launch plan (10 GB storage, autoscaling compute) | $19 |
| **AI API** | Anthropic (Claude Sonnet) | ~30M input + ~10M output tokens/month | $120 |
| **Bandwidth** | Railway + CDN | ~50 GB/month | $5 |
| **Socket.io connections** | Peak ~100 concurrent | Handled by single instance | $0 |
| **Total** | | | **~$164/month** |

**Notes:**
- Connection pooling (max 20) keeps DB connections manageable
- Consider adding Redis for session caching at higher end of this tier
- Plugin static assets can be served from CDN to reduce compute load

---

## Tier 3: 100,000 Users (State / National Ed-Tech)

| Resource | Provider | Spec | Monthly Cost |
|----------|----------|------|-------------|
| **Compute** | Railway / AWS ECS | 4 instances, 4 vCPU / 8 GB each, load balanced | $400 |
| **Database** | Neon PostgreSQL | Scale plan (50 GB storage, read replicas) | $69 |
| **Database cache** | Redis (Upstash) | 10 GB, 10K commands/sec | $120 |
| **AI API** | Anthropic (Claude Sonnet) | ~3B input + ~1B output tokens/month | $12,000 |
| **Bandwidth / CDN** | Cloudflare | ~5 TB/month (plugins + static) | $200 |
| **Socket.io** | Requires Redis adapter | Multi-instance sticky sessions | Included in Redis |
| **Monitoring** | Datadog / Grafana Cloud | APM + logs + metrics | $100 |
| **Total** | | | **~$12,889/month** |

**Notes:**
- AI API costs dominate at **93%** of total spend
- Horizontal scaling needed: Socket.io Redis adapter for multi-instance
- Read replicas for database query distribution
- CDN essential for plugin static assets (5 React apps)
- Consider prompt caching / shorter system prompts to reduce token costs
- Batch AI requests where possible (e.g., plugin tool definitions cached per session)

### Cost Optimization Strategies
- **Prompt caching**: Anthropic prompt caching can reduce repeated system prompt costs by ~90%
- **Model routing**: Use Haiku for simple responses, Sonnet only for tool-calling decisions
- **Response streaming**: Already implemented, reduces perceived latency
- **Session-level tool caching**: Build tools once per session, not per message

---

## Tier 4: 1,000,000 Users (National Platform)

| Resource | Provider | Spec | Monthly Cost |
|----------|----------|------|-------------|
| **Compute** | AWS ECS / K8s | 20+ instances, auto-scaling, multi-region | $4,000 |
| **Database** | Neon / Aurora PostgreSQL | 500 GB+, multi-region, read replicas | $500 |
| **Database cache** | Redis cluster (ElastiCache) | 50 GB, high availability | $800 |
| **AI API** | Anthropic (Claude Sonnet) | ~30B input + ~10B output tokens/month | $120,000 |
| **Bandwidth / CDN** | Cloudflare Pro | ~50 TB/month | $1,500 |
| **Socket.io** | Dedicated WebSocket service | Redis adapter + sticky LB | $500 |
| **Monitoring** | Datadog | Full APM + distributed tracing | $500 |
| **Message queue** | SQS / RabbitMQ | Async plugin event processing | $200 |
| **Object storage** | S3 | Plugin assets, user data backups | $100 |
| **Security** | WAF + DDoS protection | Cloudflare / AWS Shield | $200 |
| **Total** | | | **~$128,300/month** |

**Notes:**
- AI API costs are **93%+** of total spend
- Multi-region deployment required for latency
- Message queue needed for async plugin lifecycle events
- Database sharding by tenant (school/district) recommended
- WebSocket connection management becomes critical (100K concurrent)

### Cost Optimization Strategies (Critical at this scale)
- **Prompt caching**: Save ~$50K/month on repeated system prompts
- **Model tiering**: Haiku ($0.25/$1.25 per 1M tokens) for 70% of messages, Sonnet for tool decisions only → potential 60% AI cost reduction to ~$48K/month
- **Rate limiting**: Per-user message caps (e.g., 50/day) prevent abuse
- **Conversation summarization**: Compress long conversations to reduce context window
- **Edge caching**: Plugin iframes served from edge, zero origin hits
- **Connection pooling**: PgBouncer for database connection management at scale

---

## Cost Summary

| Tier | Users | Monthly Cost | Per-User Cost | AI % of Total |
|------|-------|-------------|---------------|---------------|
| Pilot | 100 | $17 | $0.17 | 71% |
| District | 1,000 | $164 | $0.16 | 73% |
| State | 100,000 | $12,889 | $0.13 | 93% |
| National | 1,000,000 | $128,300 | $0.13 | 93% |

### Case Study Alignment: TutorMeAI (200K+ DAU, 10K Districts)

The case study specifies 200,000+ students and teachers using the platform daily across 10,000 districts. This falls between Tier 3 (100K) and Tier 4 (1M). Interpolated estimate:

| Metric | Value |
|--------|-------|
| **DAU** | 200,000 |
| **Peak concurrent** | ~30,000 (15% of DAU, school-hours spike) |
| **Messages/day** | ~4M (20 msg/user/day) |
| **Plugin launches/day** | ~600K (3 per user per day) |
| **AI tokens/month** | ~6B input + ~2B output |
| **Estimated monthly cost** | **~$26,000** (with model tiering optimization) |
| **Per-student cost** | **~$0.13/student/month** |
| **Break-even pricing** | $2/student/month → 15x margin with district licensing |

At 200K DAU, the architecture requires: 8-12 Express instances behind a load balancer, PostgreSQL with PgBouncer (replacing SQLite), Redis for Socket.io adapter + session caching, CDN for plugin static assets, and a BullMQ job queue for async LLM requests. The scaled architecture diagram shows this topology in detail.

### Key Takeaways

1. **AI API is the cost driver** — at every tier, LLM inference dominates. Optimizing prompts and model routing yields the biggest savings.
2. **Infrastructure is cheap** — compute, database, and CDN combined are <10% of costs at scale.
3. **Per-user cost decreases** — economies of scale from shared infrastructure, but AI costs scale linearly.
4. **Plugin architecture is cost-neutral** — iframes add zero server cost (static JS bundles). Only the tool-calling pipeline (AI deciding to launch plugins) has cost impact.
5. **Neon PostgreSQL scales well** — connection pooling and read replicas handle growth without major cost jumps.

### Break-Even Pricing

| Model | Price Point | Break-Even Tier |
|-------|------------|----------------|
| Free (ad-supported) | $0 | Not viable (AI costs too high) |
| Freemium (10 msg/day free) | $5/month premium | ~35 paying users covers 1K tier |
| School license | $2/student/month | Profitable at all tiers |
| District license | $1.50/student/month | Profitable at 1K+ |
| Per-seat SaaS | $3/student/month | 2.3x margin at scale |

---

*Generated for ChatWeave — April 2026. Prices based on current Anthropic, Railway, and Neon published rates.*

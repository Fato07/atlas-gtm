/**
 * Market Research service
 * Manages research document CRUD operations via MCP REST API
 */
import {
  MarketResearch,
  CreateResearchRequest,
  UpdateResearchRequest,
  ListResearchParams,
  ContentType,
  DocumentStatus,
} from '../contracts';
import { mcpClient } from './mcp-client';

/**
 * Mock research data for development (when MCP is unavailable)
 */
function getMockResearch(): MarketResearch[] {
  const now = new Date().toISOString();
  return [
    {
      id: '880e8400-e29b-41d4-a716-446655440001',
      brain_id: 'brain_fintech_demo',
      title: 'Q4 2024 Fintech Market Trends Report',
      content_type: 'report',
      content: `# Q4 2024 Fintech Market Trends

## Executive Summary
The fintech sector continues to show strong growth, with embedded finance and AI-powered solutions leading adoption.

## Key Findings

### 1. Embedded Finance Growth
- 65% of traditional banks now partner with fintech companies
- B2B embedded payments grew 45% YoY
- SMB lending platforms see highest demand

### 2. AI Adoption
- 78% of fintech companies use AI for fraud detection
- Automated underwriting reduces processing time by 60%
- Chatbots handle 40% of customer inquiries

### 3. Regulatory Landscape
- Open banking regulations expanding globally
- Increased focus on data privacy compliance
- Cross-border payment regulations evolving

## Recommendations
1. Invest in AI-powered risk assessment tools
2. Prioritize API-first architecture for embedded finance
3. Build compliance automation early`,
      key_facts: [
        '65% of traditional banks now partner with fintech companies',
        'B2B embedded payments grew 45% YoY',
        '78% of fintech companies use AI for fraud detection',
        'Automated underwriting reduces processing time by 60%',
      ],
      source: 'McKinsey Fintech Report',
      source_url: 'https://example.com/mckinsey-fintech-2024',
      tags: ['fintech', 'trends', 'ai', 'embedded-finance'],
      status: 'active',
      created_at: '2024-01-10T09:00:00Z',
    },
    {
      id: '880e8400-e29b-41d4-a716-446655440002',
      brain_id: 'brain_fintech_demo',
      title: 'Competitor Analysis: PaymentCo vs InvoiceFlow',
      content_type: 'article',
      content: `# Competitor Analysis

## PaymentCo
- Founded: 2019
- Funding: $45M Series B
- Key Features: Real-time payments, multi-currency support
- Target: Mid-market companies
- Pricing: 1.5% + $0.30 per transaction

### Strengths
- Fast onboarding (same-day)
- Strong API documentation
- 24/7 support

### Weaknesses
- Limited reporting capabilities
- No embedded lending
- Higher fees for international transfers

## InvoiceFlow
- Founded: 2020
- Funding: $28M Series A
- Key Features: Invoice automation, payment tracking
- Target: SMBs
- Pricing: $49/month + 0.5% on payments

### Strengths
- Lower pricing
- Good QuickBooks integration
- Invoice templates

### Weaknesses
- Slower payment processing (2-3 days)
- Limited API
- No multi-currency`,
      key_facts: [
        'PaymentCo charges 1.5% + $0.30 per transaction',
        'InvoiceFlow offers lower pricing at $49/month',
        'PaymentCo has same-day onboarding',
        'InvoiceFlow has 2-3 day payment processing',
      ],
      source: 'Internal Research',
      source_url: null,
      tags: ['competitor', 'analysis', 'payments'],
      status: 'active',
      created_at: '2024-01-15T14:00:00Z',
    },
    {
      id: '880e8400-e29b-41d4-a716-446655440003',
      brain_id: 'brain_fintech_demo',
      title: 'Customer Interview: Acme Corp CFO',
      content_type: 'transcript',
      content: `# Customer Interview Transcript
Date: January 18, 2024
Interviewee: Sarah Johnson, CFO at Acme Corp

## Pain Points Discussed

Q: What are your biggest challenges with current payment solutions?

A: "Honestly, the reconciliation process is a nightmare. We have three different systems that don't talk to each other. Our finance team spends 2-3 days every month just matching payments to invoices."

Q: How do you currently handle international payments?

A: "We use wire transfers, which are expensive and slow. We're paying $35-50 per international wire, and it takes 3-5 business days. For a company our size doing 50+ international transactions monthly, that adds up."

Q: What would an ideal solution look like?

A: "Something that integrates with our ERP, handles multi-currency automatically, and gives us real-time visibility. We'd also love predictive analytics for cash flow forecasting."

## Key Quotes
- "Reconciliation takes 2-3 days every month"
- "Paying $35-50 per international wire"
- "50+ international transactions monthly"
- "Need real-time visibility and cash flow forecasting"`,
      key_facts: [
        'Manual reconciliation takes 2-3 days per month',
        'International wires cost $35-50 each',
        'Acme Corp does 50+ international transactions monthly',
        'Wants ERP integration and real-time visibility',
      ],
      source: 'Customer Interview',
      source_url: null,
      tags: ['interview', 'customer', 'pain-points', 'payments'],
      status: 'active',
      created_at: '2024-01-18T10:30:00Z',
    },
    {
      id: '880e8400-e29b-41d4-a716-446655440004',
      brain_id: 'brain_fintech_demo',
      title: 'Internal Notes: Product Roadmap Discussion',
      content_type: 'notes',
      content: `# Product Roadmap Meeting Notes
Date: January 20, 2024

## Q1 Priorities
1. Multi-currency support (Feb launch)
2. QuickBooks integration (March)
3. Mobile app MVP (end of Q1)

## Q2 Tentative
- Embedded lending pilot
- Advanced analytics dashboard
- Slack integration

## Discussion Points

### Multi-currency
- Need to support EUR, GBP, CAD initially
- Real-time FX rates from provider TBD
- Compliance considerations for each currency

### Mobile App
- iOS first, Android to follow
- Core features: balance view, payment approval, notifications
- Biometric auth required

## Action Items
- [ ] Research FX rate providers (John)
- [ ] Draft mobile app PRD (Sarah)
- [ ] Compliance review for EUR/GBP (Legal)`,
      key_facts: [
        'Multi-currency support launching in February',
        'QuickBooks integration planned for March',
        'Mobile app MVP by end of Q1',
        'Embedded lending pilot planned for Q2',
      ],
      source: 'Product Meeting',
      source_url: null,
      tags: ['roadmap', 'internal', 'product'],
      status: 'active',
      created_at: '2024-01-20T16:00:00Z',
    },
    {
      id: '880e8400-e29b-41d4-a716-446655440005',
      brain_id: 'brain_fintech_demo',
      title: 'Archived: 2023 Market Overview',
      content_type: 'report',
      content: `# 2023 Fintech Market Overview

This report has been superseded by the Q4 2024 report.

## Summary
- Market grew 23% in 2023
- Key trends: BNPL, embedded finance, open banking
- Regulatory changes in EU and US`,
      key_facts: [
        'Fintech market grew 23% in 2023',
        'Key trends were BNPL, embedded finance, open banking',
      ],
      source: 'Internal Analysis',
      source_url: null,
      tags: ['archive', 'market', '2023'],
      status: 'archived',
      created_at: '2023-12-15T09:00:00Z',
    },
    // SaaS brain research
    {
      id: '880e8400-e29b-41d4-a716-446655440006',
      brain_id: 'brain_saas_demo',
      title: 'SaaS Pricing Strategies 2024',
      content_type: 'article',
      content: `# SaaS Pricing Strategies for 2024

## Usage-Based Pricing Trends
- 45% of SaaS companies now offer usage-based pricing
- Hybrid models (base + usage) growing fastest
- PLG companies see 30% higher expansion revenue

## Key Metrics
- Average contract value increased 18% YoY
- Net revenue retention averages 115% for top performers
- Price increases averaging 7-12% annually

## Recommendations
1. Implement value metrics aligned with customer success
2. Offer multiple pricing tiers
3. Consider usage-based add-ons`,
      key_facts: [
        '45% of SaaS companies offer usage-based pricing',
        'PLG companies see 30% higher expansion revenue',
        'NRR averages 115% for top performers',
        'Price increases averaging 7-12% annually',
      ],
      source: 'SaaS Pricing Report',
      source_url: 'https://example.com/saas-pricing-2024',
      tags: ['pricing', 'saas', 'trends'],
      status: 'active',
      created_at: '2024-02-01T11:00:00Z',
    },
  ];
}

// In-memory store for development
let mockResearchStore: MarketResearch[] = getMockResearch();

/**
 * Extract key facts from content (simple implementation)
 * In production, this would use AI
 */
function extractKeyFacts(content: string): string[] {
  const facts: string[] = [];

  // Look for bullet points and numbered items
  const bulletRegex = /^[\s]*[-•*]\s*(.+)$/gm;
  const numberedRegex = /^[\s]*\d+[.)]\s*(.+)$/gm;
  const quoteRegex = /"([^"]+)"/g;

  let match;

  // Extract bullet points (first 5)
  while ((match = bulletRegex.exec(content)) !== null && facts.length < 5) {
    const fact = match[1].trim();
    if (fact.length > 20 && fact.length < 200) {
      facts.push(fact);
    }
  }

  // Extract numbered items (first 5)
  while ((match = numberedRegex.exec(content)) !== null && facts.length < 8) {
    const fact = match[1].trim();
    if (fact.length > 20 && fact.length < 200 && !facts.includes(fact)) {
      facts.push(fact);
    }
  }

  // Extract quotes (first 3)
  while ((match = quoteRegex.exec(content)) !== null && facts.length < 10) {
    const quote = match[1].trim();
    if (quote.length > 20 && quote.length < 200 && !facts.includes(quote)) {
      facts.push(quote);
    }
  }

  return facts.slice(0, 5);
}

/**
 * List research documents for a brain with optional filtering
 */
export async function listResearch(
  brainId: string,
  params?: ListResearchParams
): Promise<{ documents: MarketResearch[]; total: number }> {
  try {
    // Try MCP first
    const response = await mcpClient.listResearch(brainId, params?.content_type);
    if (response.success && response.result && Array.isArray(response.result)) {
      let documents = response.result as MarketResearch[];

      // Apply additional filters
      if (params?.content_type) {
        documents = documents.filter(d => d.content_type === params.content_type);
      }
      if (params?.status) {
        documents = documents.filter(d => d.status === params.status);
      }
      if (params?.search) {
        const searchLower = params.search.toLowerCase();
        documents = documents.filter(
          d =>
            d.title.toLowerCase().includes(searchLower) ||
            d.content.toLowerCase().includes(searchLower) ||
            d.key_facts.some(f => f.toLowerCase().includes(searchLower))
        );
      }

      return { documents, total: documents.length };
    }
  } catch {
    console.warn('MCP unavailable, using mock research data');
  }

  // Use mock data
  let documents = mockResearchStore.filter(d => d.brain_id === brainId);

  // Apply filters
  if (params?.content_type) {
    documents = documents.filter(d => d.content_type === params.content_type);
  }
  if (params?.status) {
    documents = documents.filter(d => d.status === params.status);
  }
  if (params?.tags) {
    const tagList = params.tags.split(',').map(t => t.trim().toLowerCase());
    documents = documents.filter(d =>
      d.tags.some(tag => tagList.includes(tag.toLowerCase()))
    );
  }
  if (params?.search) {
    const searchLower = params.search.toLowerCase();
    documents = documents.filter(
      d =>
        d.title.toLowerCase().includes(searchLower) ||
        d.content.toLowerCase().includes(searchLower) ||
        d.key_facts.some(f => f.toLowerCase().includes(searchLower))
    );
  }

  return { documents, total: documents.length };
}

/**
 * Get a single research document by ID
 */
export async function getResearch(
  brainId: string,
  docId: string
): Promise<MarketResearch | null> {
  try {
    const response = await mcpClient.getResearch(brainId, docId);
    if (response.success && response.result) {
      return response.result as MarketResearch;
    }
  } catch {
    console.warn('MCP unavailable, using mock research data');
  }

  // Use mock data
  return (
    mockResearchStore.find(d => d.id === docId && d.brain_id === brainId) ||
    null
  );
}

/**
 * Create a new research document
 */
export async function createResearch(
  brainId: string,
  data: CreateResearchRequest
): Promise<MarketResearch> {
  const now = new Date().toISOString();
  const docId = crypto.randomUUID();

  // Extract key facts from content
  const keyFacts = extractKeyFacts(data.content);

  const newDoc: MarketResearch = {
    id: docId,
    brain_id: brainId,
    title: data.title,
    content_type: data.content_type,
    content: data.content,
    key_facts: keyFacts,
    source: data.source ?? null,
    source_url: data.source_url ?? null,
    tags: data.tags ?? [],
    status: 'active',
    created_at: now,
  };

  try {
    const response = await mcpClient.createResearch(brainId, data);
    if (response.success && response.result) {
      return response.result as MarketResearch;
    }
  } catch {
    console.warn('MCP unavailable, using mock research store');
  }

  // Add to mock store
  mockResearchStore.push(newDoc);
  return newDoc;
}

/**
 * Update a research document
 */
export async function updateResearch(
  brainId: string,
  docId: string,
  data: UpdateResearchRequest
): Promise<MarketResearch | null> {
  try {
    const response = await mcpClient.updateResearch(brainId, docId, data);
    if (response.success && response.result) {
      return response.result as MarketResearch;
    }
  } catch {
    console.warn('MCP unavailable, using mock research store');
  }

  // Update in mock store
  const index = mockResearchStore.findIndex(
    d => d.id === docId && d.brain_id === brainId
  );
  if (index === -1) return null;

  const existing = mockResearchStore[index];

  // Re-extract key facts if content changed
  const keyFacts =
    data.content !== undefined
      ? data.key_facts || extractKeyFacts(data.content)
      : data.key_facts || existing.key_facts;

  const updated: MarketResearch = {
    ...existing,
    title: data.title ?? existing.title,
    content: data.content ?? existing.content,
    key_facts: keyFacts,
    tags: data.tags ?? existing.tags,
    status: data.status ?? existing.status,
  };

  mockResearchStore[index] = updated;
  return updated;
}

/**
 * Delete a research document
 */
export async function deleteResearch(
  brainId: string,
  docId: string
): Promise<boolean> {
  try {
    const response = await mcpClient.deleteResearch(brainId, docId);
    if (response.success) {
      return true;
    }
  } catch {
    console.warn('MCP unavailable, using mock research store');
  }

  // Delete from mock store
  const index = mockResearchStore.findIndex(
    d => d.id === docId && d.brain_id === brainId
  );
  if (index === -1) return false;

  mockResearchStore.splice(index, 1);
  return true;
}

/**
 * Archive a research document
 */
export async function archiveResearch(
  brainId: string,
  docId: string
): Promise<MarketResearch | null> {
  return updateResearch(brainId, docId, { status: 'archived' });
}

/**
 * Get research count for a brain
 */
export async function getResearchCount(brainId: string): Promise<number> {
  const { total } = await listResearch(brainId, { status: 'active' });
  return total;
}

/**
 * Get all unique tags for a brain
 */
export async function getResearchTags(brainId: string): Promise<string[]> {
  const { documents } = await listResearch(brainId);
  const tagSet = new Set<string>();

  for (const doc of documents) {
    for (const tag of doc.tags) {
      tagSet.add(tag);
    }
  }

  return Array.from(tagSet).sort();
}

/**
 * Get research grouped by content type
 */
export async function getResearchByType(
  brainId: string
): Promise<Record<ContentType, MarketResearch[]>> {
  const { documents } = await listResearch(brainId);

  const grouped: Record<ContentType, MarketResearch[]> = {
    article: [],
    report: [],
    transcript: [],
    notes: [],
    other: [],
  };

  for (const doc of documents) {
    grouped[doc.content_type].push(doc);
  }

  return grouped;
}

/**
 * Content type display names
 */
export const CONTENT_TYPE_DISPLAY_NAMES: Record<ContentType, string> = {
  article: 'Article',
  report: 'Report',
  transcript: 'Transcript',
  notes: 'Notes',
  other: 'Other',
};

/**
 * Document status display names
 */
export const DOCUMENT_STATUS_DISPLAY_NAMES: Record<DocumentStatus, string> = {
  active: 'Active',
  archived: 'Archived',
};

#!/usr/bin/env node
/*
 * This previous one-way importer predated per-seller OAuth and can overwrite
 * reconciled site inventory. It is intentionally disabled.
 *
 * Use Shopkeeper Dashboard -> "eBay sync (optional)" to connect a seller's own
 * account and import safely via server-side seller-scoped OAuth and SQL RPCs.
 *
 * Scheduled reconciliation is in .github/workflows/ebay-sync.yml and
 * app/api/ebay-sync/route.ts. Manual/CSV site-only shops need no eBay.
 */
console.error('The old eBay sync script has been retired. Use the Shopkeeper eBay sync tab or the authenticated seller sync route.');
process.exitCode=1;

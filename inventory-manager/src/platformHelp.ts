// Per-platform syntax/format guidance shown by the "(e)" explain button
// (FieldHelpButton). This is the large hand-written doc that pairs with the
// "(i)" column-name popover in PlatformBadges: where (i) says *which* column a
// field maps to, (e) says *how to fill it* for each platform — allowed values,
// format rules, examples, and (most importantly) how categories / eBay category
// IDs work.
//
// Data-only module. `fieldHelpSections()` merges this prose with the live
// platform registry (platforms.ts) and the eBay enums (ebay.ts) so column
// names, required flags, and the eBay dropdown values never drift from code.

import { CANONICAL_FIELDS, PLATFORM_BY_ID, platformsForField, type PlatformId } from './platforms';
import { EBAY_CONDITION_IDS, EBAY_DURATIONS, EBAY_FORMATS } from './ebay';

export interface FieldPlatformHelp {
  /** Prose: the required syntax / format for this field on this platform. */
  format: string;
  /** Allowed/enum values or accepted patterns, rendered as chips. */
  args?: string[];
  /** A concrete example value. */
  example?: string;
  /** Gotchas: delimiters, transforms, "first photo only", etc. */
  notes?: string;
  /** External lookup/reference link. */
  link?: { label: string; url: string };
}

export interface HelpSection {
  platformName: string;
  badge?: string;
  column?: string;
  required?: boolean;
  help: FieldPlatformHelp;
}

export interface FieldHelp {
  title: string;
  intro?: string;
  sections: HelpSection[];
}

// One-line orientation shown above the per-platform sections (canonical fields).
export const FIELD_HELP_INTRO: Record<string, string> = {
  title: 'A short product name. Most platforms cap the length and reject HTML.',
  description: 'The item description. Plain text is safest; most feeds strip or escape HTML.',
  price:
    'Selling price. Currency is assumed EUR. The accepted number format differs per platform — watch decimals and the trailing-currency platforms below.',
  quantity: 'Available stock as a whole number.',
  condition:
    'How worn the item is. Each platform uses its own token set — the canonical option you pick is translated on export, so just choose the closest canonical value.',
  sku: 'Your own stable identifier for the item. Several platforms use it as the primary key that links revisions to the original listing.',
  brand: 'Brand / make. Required on the comparison-shopping feeds (Amazon, idealo, billiger).',
  manufacturer: 'The legal manufacturer. Geizhals requires it (and falls back to brand if empty).',
  ean: 'EAN / GTIN barcode. Digits only — no spaces or hyphens.',
  mpn: 'Manufacturer Part Number. Note idealo renames this to "hans".',
  category:
    'The trickiest field: every marketplace has its own taxonomy. The same value is exported very differently per platform — read each section carefully, especially eBay (numeric ID) and Facebook (Google taxonomy).',
  product_url: 'Absolute https:// link to the live product page. Required on the feed platforms.',
  shipping_cost: 'Shipping cost as a number (EUR). 0 means free shipping.',
  delivery_time: 'Human-readable delivery estimate. idealo requires it.',
  postal_code: 'German postal code (PLZ) of the item location.',
  availability: 'Stock state. Pick from the canonical options; feeds map them to their own tokens.',
  photos:
    'Item photos must be public https:// URLs (uploaded photos already are). Platforms differ on how many and how they are joined.',
};

// fieldKey -> platformId -> guidance. Only platforms that actually carry the
// field need an entry; `fieldHelpSections` drives the platform list from the
// registry, so a missing entry simply shows the column name with a generic note.
export const PLATFORM_FIELD_HELP: Record<string, Partial<Record<PlatformId, FieldPlatformHelp>>> = {
  title: {
    ebay: {
      format: 'Plain text, max 80 characters. No HTML. Keyword-rich titles rank better in search.',
      example: 'Apple iPhone 12 64GB Black Unlocked Very Good',
      notes: 'Over 80 chars is rejected by eBay File Exchange.',
    },
    amazon: {
      format: 'Plain text, up to ~200 characters depending on category. No promotional text or all-caps.',
      example: 'Anker PowerCore 10000 Portable Charger',
    },
    kleinanzeigen: { format: 'Short plain-text headline. Keep it under ~70 characters.' },
    whatnot: { format: 'Plain text product name shown in the show listing.' },
    facebook: {
      format: 'Plain text, max 150 characters. No HTML, no promotional phrasing ("free shipping").',
    },
    idealo: { format: 'Plain text product name; include brand + model for matching.' },
    billiger: { format: 'Plain text product name (column "name").' },
    geizhals: { format: 'Plain text product name (column "name").' },
  },

  description: {
    ebay: {
      format: 'Text or HTML body. Active-content scripts are stripped. Required by File Exchange.',
      notes: 'Newlines are preserved; the CSV cell is quoted automatically.',
    },
    amazon: { format: 'Plain text, up to ~2000 characters. No HTML, no seller contact info.' },
    kleinanzeigen: { format: 'Plain text body (column "desc"). Required.' },
    whatnot: { format: 'Plain text description.' },
    facebook: { format: 'Plain text, max ~9999 chars. HTML is escaped. Required.' },
    idealo: { format: 'Optional plain-text description.' },
    billiger: { format: 'Plain text body (column "desc"). Required.' },
    geizhals: { format: 'Optional plain-text description.' },
  },

  price: {
    ebay: {
      format: 'Decimal with a dot, no currency symbol, no thousands separator.',
      example: '129.99',
      notes: 'Maps to *StartPrice. Country=DE / Currency=EUR are added automatically on export.',
    },
    amazon: { format: 'Decimal with a dot, no symbol.', example: '24.99' },
    kleinanzeigen: {
      format: 'Whole euros only.',
      example: '130',
      notes: 'Exported as an integer — any decimals are rounded.',
    },
    whatnot: { format: 'Decimal with a dot, no symbol.', example: '49.99' },
    facebook: {
      format: 'Number plus ISO currency, space-separated.',
      example: '129.99 EUR',
      notes: 'The " EUR" suffix is appended automatically on export — store just the number.',
    },
    idealo: { format: 'Decimal with a dot.', example: '129.99' },
    billiger: { format: 'Decimal with a dot.', example: '129.99' },
    geizhals: {
      format: 'Decimal with a dot. CSV uses a semicolon (;) delimiter, so the price dot is safe.',
      example: '129.99',
    },
  },

  quantity: {
    ebay: { format: 'Whole number ≥ 1.', example: '5', notes: 'Maps to *Quantity (required).' },
    amazon: { format: 'Whole number.', example: '5' },
    whatnot: { format: 'Whole number.', example: '5' },
  },

  condition: {
    ebay: {
      format: 'Exported as a numeric eBay ConditionID. Pick the closest canonical option and it is translated: New→1000, Used variants→3000, For parts→7000.',
      args: EBAY_CONDITION_IDS.map((c) => `${c.id} — ${c.label}`),
      notes: 'For finer control use the eBay Condition ID dropdown in the Export sidebar (its own (e) lists every ID). Some categories only accept a subset of IDs.',
    },
    amazon: {
      format: 'Mapped to an Amazon condition_type token.',
      args: ['New', 'UsedLikeNew', 'UsedGood', 'UsedAcceptable', 'Used'],
    },
    whatnot: { format: 'Free-form condition label (e.g. "New", "Used").' },
    facebook: {
      format: 'Mapped to a Facebook/Google token.',
      args: ['new', 'used', 'refurbished'],
    },
    idealo: {
      format: 'Mapped to an idealo conditionType token.',
      args: ['NEW', 'AS_NEW', 'USED'],
    },
    billiger: { format: 'Mapped to a billiger token.', args: ['new', 'used', 'refurbished'] },
  },

  sku: {
    ebay: {
      format: 'Your label. Exported as CustomLabel.',
      notes: 'eBay treats a repeated CustomLabel as the same listing — reuse it to Revise instead of Add.',
    },
    amazon: { format: 'item_sku — the primary key for your Amazon feed. Required, must be unique.' },
    whatnot: { format: 'Optional SKU shown to you.' },
    facebook: {
      format: 'Exported as id (g:id) — the unique key of the feed. Required.',
      notes: 'Keep it stable; changing it creates a new catalog item.',
    },
    idealo: { format: 'sku — required unique key.' },
    billiger: { format: 'aid — required unique article id.' },
    geizhals: { format: 'article_id — required unique key.' },
  },

  brand: {
    ebay: { format: 'Item specific, exported as C:Brand.', example: 'Apple' },
    amazon: { format: 'brand_name — required.', example: 'Anker' },
    facebook: { format: 'g:brand. Recommended for catalog matching.' },
    idealo: { format: 'brand — required.' },
    billiger: { format: 'brand — required.' },
  },

  manufacturer: {
    ebay: { format: 'Item specific, exported as C:Manufacturer.' },
    amazon: { format: 'manufacturer — optional but recommended.' },
    geizhals: {
      format: 'manufacturer — required.',
      notes: 'If empty, the export falls back to the brand value.',
    },
  },

  ean: {
    ebay: { format: 'Item specific C:EAN. 8/12/13/14 digits, no spaces.', example: '0190198001755' },
    amazon: {
      format: 'external_product_id — required. external_product_id_type=EAN is added automatically.',
      example: '0190198001755',
    },
    facebook: { format: 'g:gtin. 8/12/13/14 digits.' },
    idealo: { format: 'eans. Digits only.' },
    billiger: { format: 'GTIN — required. Digits only.' },
    geizhals: { format: 'ean. Digits only.' },
  },

  mpn: {
    ebay: { format: 'Item specific C:MPN.' },
    amazon: { format: 'part_number.' },
    facebook: { format: 'g:mpn.' },
    idealo: {
      format: 'Exported under the tag "hans" (idealo\'s name for the manufacturer part number) — not "mpn".',
    },
    billiger: { format: 'mpn.' },
    geizhals: { format: 'mpn.' },
  },

  category: {
    ebay: {
      format:
        'A NUMERIC eBay category ID (leaf category), exported as *Category. Not a name — "Cell Phones & Smartphones" must be its ID, e.g. 9355.',
      example: '9355',
      notes:
        'The per-item eBay Category ID in the Export sidebar OVERRIDES this field when set. Use a leaf (most-specific) category or eBay rejects the row. Find IDs via the eBay category lookup or the Taxonomy API.',
      link: {
        label: 'eBay category ID lookup',
        url: 'https://www.isoldit.co.uk/categories/',
      },
    },
    amazon: {
      format: 'recommended_browse_nodes — a numeric Amazon browse-node ID for the target marketplace (amazon.de).',
      example: '355007011',
      notes: 'Browse-node IDs are marketplace-specific; a node from amazon.com will not work on amazon.de.',
    },
    whatnot: {
      format: 'A Whatnot category NAME from their fixed list (not an ID).',
      example: 'Electronics',
    },
    facebook: {
      format:
        'g:google_product_category — either the numeric Google product taxonomy ID or the full ">"-joined path string.',
      example: '267  (or "Electronics > Communications > Telephony > Mobile Phones")',
      link: {
        label: 'Google product taxonomy',
        url: 'https://support.google.com/merchants/answer/6324436',
      },
    },
    idealo: {
      format: 'categoryPath — a free-form category path string, segments joined with ">".',
      example: 'Elektronik > Handy & Smartphone > Smartphones',
    },
    billiger: {
      format: 'shop_cat — your own shop category path (free text).',
      example: 'Elektronik/Smartphones',
    },
  },

  product_url: {
    facebook: { format: 'g:link — absolute https:// URL to the product page. Required.' },
    idealo: { format: 'url — absolute https:// URL. Required.' },
    billiger: {
      format: 'link — absolute https:// URL. Required. (Also copied to target_url.)',
    },
    geizhals: { format: 'deeplink — absolute https:// URL. Required.' },
  },

  shipping_cost: {
    idealo: { format: 'deliveryCosts_standard — number in EUR. 0 = free.', example: '4.99' },
    billiger: {
      format: 'dlv_cost — number in EUR.',
      example: '4.99',
      notes: 'Defaults to "0.00" on export when left empty.',
    },
    geizhals: { format: 'shipping_cost — number in EUR.', example: '4.99' },
  },

  delivery_time: {
    idealo: {
      format: 'delivery — required. Human-readable estimate.',
      example: '2-4 Werktage',
    },
    billiger: { format: 'dlv_time — human-readable estimate.', example: '2-4 Werktage' },
  },

  postal_code: {
    ebay: { format: 'German PLZ, exported as *Location.', example: '10115' },
    kleinanzeigen: { format: 'postalcode — German PLZ.', example: '10115' },
  },

  availability: {
    facebook: {
      format: 'g:availability.',
      args: ['in stock', 'out of stock', 'preorder'],
      notes: 'Defaults to "in stock" when empty.',
    },
    billiger: { format: 'availability.', args: ['in stock', 'out of stock', 'preorder'] },
  },

  photos: {
    ebay: {
      format: 'Exported as PicURL — all photo URLs joined with a pipe "|".',
      notes: 'URLs must be publicly reachable; uploaded photos already are.',
    },
    amazon: { format: 'main_image_url — the FIRST photo only.' },
    kleinanzeigen: { format: 'image — the FIRST photo only.' },
    whatnot: { format: 'Spread across Image URL 1 … Image URL 8 (up to 8 photos, one per column).' },
    facebook: {
      format: 'First photo → g:image_link (required). Remaining photos → g:additional_image_link, comma-joined.',
    },
    idealo: { format: 'imageUrls — all photos joined with a semicolon ";".' },
    billiger: { format: 'images — all photos joined with a semicolon ";".' },
    geizhals: { format: 'image_url — the FIRST photo only.' },
  },
};

// eBay-only listing settings (the Export-sidebar inputs that have no canonical
// field). Keyed by the synthetic fieldKey passed to FieldHelpButton.
const EBAY_LISTING_HELP: Record<string, FieldHelp> = {
  'ebay-category': {
    title: 'eBay Category ID',
    intro:
      'A per-item override for the eBay leaf-category ID. When set, it wins over the Category field on export (column *Category).',
    sections: [
      {
        platformName: 'eBay',
        badge: PLATFORM_BY_ID.get('ebay')?.badge,
        column: '*Category',
        required: false,
        help: {
          format:
            'A single NUMERIC eBay category ID — the most specific (leaf) category. Names are not accepted. Leave blank to fall back to the Category field.',
          example: '9355',
          notes:
            'Listings fail if the ID is a parent (non-leaf) category. IDs are site-specific — use eBay.de (site 77) IDs for German listings.',
          link: { label: 'eBay category ID lookup', url: 'https://www.isoldit.co.uk/categories/' },
        },
      },
    ],
  },
  'ebay-condition': {
    title: 'eBay Condition ID',
    intro: 'The numeric condition exported as *ConditionID. Overrides the mapped Condition field.',
    sections: [
      {
        platformName: 'eBay',
        badge: PLATFORM_BY_ID.get('ebay')?.badge,
        column: '*ConditionID',
        required: true,
        help: {
          format: 'One numeric ID from the list below.',
          args: EBAY_CONDITION_IDS.map((c) => `${c.id} — ${c.label}`),
          notes:
            'Each eBay category only allows a subset of these IDs; an ID the category rejects will fail the listing.',
        },
      },
    ],
  },
  'ebay-format': {
    title: 'eBay Format',
    intro: 'Listing type, exported as *Format.',
    sections: [
      {
        platformName: 'eBay',
        badge: PLATFORM_BY_ID.get('ebay')?.badge,
        column: '*Format',
        required: false,
        help: {
          format: 'Pick one listing format.',
          args: EBAY_FORMATS.map((f) => `${f.value} — ${f.label}`),
          notes: 'Fixed price pairs with a GTC duration; Auction uses a timed Days_* duration.',
        },
      },
    ],
  },
  'ebay-duration': {
    title: 'eBay Duration',
    intro: 'How long the listing runs, exported as *Duration.',
    sections: [
      {
        platformName: 'eBay',
        badge: PLATFORM_BY_ID.get('ebay')?.badge,
        column: '*Duration',
        required: false,
        help: {
          format: 'One duration token.',
          args: EBAY_DURATIONS.map((d) => `${d.value} — ${d.label}`),
          notes: 'Use GTC ("Good Til Cancelled") for fixed-price listings; the Days_* values are for auctions.',
        },
      },
    ],
  },
};

const GENERIC: FieldPlatformHelp = {
  format: 'No special formatting — the value is exported as-is into this column.',
};

/**
 * Build display-ready help sections for one field. Canonical field keys are
 * expanded across every platform that carries them (column name + required from
 * the registry, prose from PLATFORM_FIELD_HELP). The synthetic 'ebay-*' keys
 * return their hand-written single-platform section.
 */
export function fieldHelpSections(fieldKey: string): FieldHelp {
  if (fieldKey in EBAY_LISTING_HELP) return EBAY_LISTING_HELP[fieldKey];

  const label = CANONICAL_FIELDS[fieldKey]?.label ?? fieldKey;
  const perPlatform = PLATFORM_FIELD_HELP[fieldKey] ?? {};
  const sections: HelpSection[] = platformsForField(fieldKey).map((o) => ({
    platformName: o.name,
    badge: PLATFORM_BY_ID.get(o.platform)?.badge,
    column: o.column,
    required: o.required,
    help: perPlatform[o.platform] ?? GENERIC,
  }));

  return { title: label, intro: FIELD_HELP_INTRO[fieldKey], sections };
}

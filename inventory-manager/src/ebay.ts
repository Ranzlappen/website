// eBay-specific reference data used by the ItemEditor / EbayPanel.

export const EBAY_CONDITION_IDS: { id: number; label: string }[] = [
  { id: 1000, label: 'New' },
  { id: 1500, label: 'New other (see details)' },
  { id: 1750, label: 'New with defects' },
  { id: 2000, label: 'Manufacturer refurbished' },
  { id: 2500, label: 'Seller refurbished' },
  { id: 3000, label: 'Used' },
  { id: 4000, label: 'Very good' },
  { id: 5000, label: 'Good' },
  { id: 6000, label: 'Acceptable' },
  { id: 7000, label: 'For parts or not working' },
];

export const EBAY_DURATIONS = [
  { value: 'GTC', label: 'Good Til Cancelled (fixed price)' },
  { value: 'Days_1', label: '1 day' },
  { value: 'Days_3', label: '3 days' },
  { value: 'Days_5', label: '5 days' },
  { value: 'Days_7', label: '7 days' },
  { value: 'Days_10', label: '10 days' },
  { value: 'Days_30', label: '30 days' },
];

export const EBAY_FORMATS = [
  { value: 'FixedPriceItem', label: 'Fixed price' },
  { value: 'Auction', label: 'Auction' },
];

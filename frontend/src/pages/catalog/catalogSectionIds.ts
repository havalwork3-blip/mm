/** IDs map to `catalog.section.<id>.title` / `.body` in i18n strings. */
export const CATALOG_SECTION_IDS = [
  'intro',
  'bigPicture',
  'parts',
  'navMap',
  'dashboard',
  'sales',
  'inventory',
  'purchasing',
  'customers',
  'finance',
  'cash',
  'debts',
  'settings',
  'admin',
  'access',
  'faq',
] as const

export type CatalogSectionId = (typeof CATALOG_SECTION_IDS)[number]

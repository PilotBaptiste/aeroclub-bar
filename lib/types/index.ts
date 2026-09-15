export type { Database, Json } from './database'

// Convenience row types
export type Organization =
  Database['public']['Tables']['organizations']['Row']
export type User = Database['public']['Tables']['users']['Row']
export type UserOrganization =
  Database['public']['Tables']['user_organizations']['Row']
export type Category = Database['public']['Tables']['categories']['Row']
export type Product = Database['public']['Tables']['products']['Row']
export type Transaction =
  Database['public']['Tables']['transactions']['Row']
export type Member = Database['public']['Tables']['members']['Row']
export type Procurement =
  Database['public']['Tables']['procurements']['Row']
export type Batch = Database['public']['Tables']['batches']['Row']
export type Suggestion =
  Database['public']['Tables']['suggestions']['Row']
export type Credit = Database['public']['Tables']['credits']['Row']

// Convenience insert types
export type OrganizationInsert =
  Database['public']['Tables']['organizations']['Insert']
export type UserInsert = Database['public']['Tables']['users']['Insert']
export type UserOrganizationInsert =
  Database['public']['Tables']['user_organizations']['Insert']
export type CategoryInsert =
  Database['public']['Tables']['categories']['Insert']
export type ProductInsert =
  Database['public']['Tables']['products']['Insert']
export type TransactionInsert =
  Database['public']['Tables']['transactions']['Insert']
export type MemberInsert =
  Database['public']['Tables']['members']['Insert']
export type ProcurementInsert =
  Database['public']['Tables']['procurements']['Insert']
export type BatchInsert =
  Database['public']['Tables']['batches']['Insert']
export type SuggestionInsert =
  Database['public']['Tables']['suggestions']['Insert']
export type CreditInsert =
  Database['public']['Tables']['credits']['Insert']

// Convenience update types
export type OrganizationUpdate =
  Database['public']['Tables']['organizations']['Update']
export type UserUpdate = Database['public']['Tables']['users']['Update']
export type UserOrganizationUpdate =
  Database['public']['Tables']['user_organizations']['Update']
export type CategoryUpdate =
  Database['public']['Tables']['categories']['Update']
export type ProductUpdate =
  Database['public']['Tables']['products']['Update']
export type TransactionUpdate =
  Database['public']['Tables']['transactions']['Update']
export type MemberUpdate =
  Database['public']['Tables']['members']['Update']
export type ProcurementUpdate =
  Database['public']['Tables']['procurements']['Update']
export type BatchUpdate =
  Database['public']['Tables']['batches']['Update']
export type SuggestionUpdate =
  Database['public']['Tables']['suggestions']['Update']
export type CreditUpdate =
  Database['public']['Tables']['credits']['Update']

// Enum types
export type UserRole = Database['public']['Enums']['user_role']
export type OrgRole = Database['public']['Enums']['org_role']
export type ProductLocation = Database['public']['Enums']['product_location']
export type SuggestionStatus = Database['public']['Enums']['suggestion_status']
export type CreditType = Database['public']['Enums']['credit_type']

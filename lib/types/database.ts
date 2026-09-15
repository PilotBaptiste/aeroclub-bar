export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          slug: string
          name: string
          logo_url: string | null
          settings: Json
          theme: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          logo_url?: string | null
          settings?: Json
          theme?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          logo_url?: string | null
          settings?: Json
          theme?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          id: string
          email: string
          full_name: string
          role: 'super_admin' | 'org_admin' | 'staff'
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          full_name: string
          role?: 'super_admin' | 'org_admin' | 'staff'
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          role?: 'super_admin' | 'org_admin' | 'staff'
          created_at?: string
        }
        Relationships: []
      }
      user_organizations: {
        Row: {
          id: string
          user_id: string
          org_id: string
          role_in_org: 'admin' | 'treasurer' | 'staff'
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          org_id: string
          role_in_org?: 'admin' | 'treasurer' | 'staff'
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          org_id?: string
          role_in_org?: 'admin' | 'treasurer' | 'staff'
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_organizations_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'user_organizations_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      categories: {
        Row: {
          id: string
          org_id: string
          name: string
          emoji: string
          position: number
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          emoji: string
          position?: number
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          emoji?: string
          position?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'categories_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      products: {
        Row: {
          id: string
          org_id: string
          name: string
          emoji: string
          price: number
          cost: number
          stock: number
          stock_reserve: number
          category_id: string | null
          location: 'frigo' | 'cafe' | 'congelateur'
          archived: boolean
          position: number
          led_start: number | null
          led_end: number | null
          led_color: string | null
          extra: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          emoji: string
          price: number
          cost?: number
          stock?: number
          stock_reserve?: number
          category_id?: string | null
          location?: 'frigo' | 'cafe' | 'congelateur'
          archived?: boolean
          position?: number
          led_start?: number | null
          led_end?: number | null
          led_color?: string | null
          extra?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          emoji?: string
          price?: number
          cost?: number
          stock?: number
          stock_reserve?: number
          category_id?: string | null
          location?: 'frigo' | 'cafe' | 'congelateur'
          archived?: boolean
          position?: number
          led_start?: number | null
          led_end?: number | null
          led_color?: string | null
          extra?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'products_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      transactions: {
        Row: {
          id: string
          org_id: string
          items: Json
          total: number
          payment_method: string
          member_id: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          items: Json
          total: number
          payment_method: string
          member_id?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          items?: Json
          total?: number
          payment_method?: string
          member_id?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'transactions_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'transactions_member_id_fkey'
            columns: ['member_id']
            isOneToOne: false
            referencedRelation: 'members'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'transactions_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      members: {
        Row: {
          id: string
          org_id: string
          name: string
          email: string | null
          balance: number
          archived: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          email?: string | null
          balance?: number
          archived?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          email?: string | null
          balance?: number
          archived?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'members_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      procurements: {
        Row: {
          id: string
          org_id: string
          product_id: string
          quantity: number
          unit_cost: number
          total_cost: number
          payment_method: string
          supplier: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          product_id: string
          quantity: number
          unit_cost: number
          total_cost: number
          payment_method: string
          supplier?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          product_id?: string
          quantity?: number
          unit_cost?: number
          total_cost?: number
          payment_method?: string
          supplier?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'procurements_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'procurements_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'procurements_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      batches: {
        Row: {
          id: string
          org_id: string
          product_id: string
          quantity: number
          expiry_date: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          product_id: string
          quantity: number
          expiry_date?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          product_id?: string
          quantity?: number
          expiry_date?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'batches_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'batches_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      suggestions: {
        Row: {
          id: string
          org_id: string
          text: string
          status: 'pending' | 'accepted' | 'rejected'
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          text: string
          status?: 'pending' | 'accepted' | 'rejected'
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          text?: string
          status?: 'pending' | 'accepted' | 'rejected'
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'suggestions_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      credits: {
        Row: {
          id: string
          org_id: string
          member_id: string
          product_id: string | null
          type: 'coffee' | 'madeleine' | 'product'
          total_bought: number
          free_earned: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          member_id: string
          product_id?: string | null
          type: 'coffee' | 'madeleine' | 'product'
          total_bought?: number
          free_earned?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          member_id?: string
          product_id?: string | null
          type?: 'coffee' | 'madeleine' | 'product'
          total_bought?: number
          free_earned?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'credits_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'credits_member_id_fkey'
            columns: ['member_id']
            isOneToOne: false
            referencedRelation: 'members'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'credits_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: 'super_admin' | 'org_admin' | 'staff'
      org_role: 'admin' | 'treasurer' | 'staff'
      product_location: 'frigo' | 'cafe' | 'congelateur'
      suggestion_status: 'pending' | 'accepted' | 'rejected'
      credit_type: 'coffee' | 'madeleine' | 'product'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

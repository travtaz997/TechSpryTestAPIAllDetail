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
      brands: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string
          blurb: string
          links: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          logo_url?: string
          blurb?: string
          links?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          logo_url?: string
          blurb?: string
          links?: Json
          created_at?: string
          updated_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          name: string
          slug: string
          parent_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          parent_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          parent_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      products: {
        Row: {
          id: string
          sku: string
          title: string
          brand_id: string | null
          model: string
          upc: string
          short_desc: string
          long_desc: string
          images: Json
          datasheet_url: string
          categories: string[]
          tags: string[]
          specs: Json
          msrp: number
          map_price: number
          stock_status: string
          stock_available: number | null
          lead_time_days: number
          weight: number
          dimensions: Json
          warranty: string
          country_of_origin: string
          published: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sku: string
          title: string
          brand_id?: string | null
          model?: string
          upc?: string
          short_desc?: string
          long_desc?: string
          images?: Json
          datasheet_url?: string
          categories?: string[]
          tags?: string[]
          specs?: Json
          msrp?: number
          map_price?: number
          stock_status?: string
          stock_available?: number | null
          lead_time_days?: number
          weight?: number
          dimensions?: Json
          warranty?: string
          country_of_origin?: string
          published?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sku?: string
          title?: string
          brand_id?: string | null
          model?: string
          upc?: string
          short_desc?: string
          long_desc?: string
          images?: Json
          datasheet_url?: string
          categories?: string[]
          tags?: string[]
          specs?: Json
          msrp?: number
          map_price?: number
          stock_status?: string
          stock_available?: number | null
          lead_time_days?: number
          weight?: number
          dimensions?: Json
          warranty?: string
          country_of_origin?: string
          published?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      customers: {
        Row: {
          id: string
          company: string
          email: string
          phone: string
          billing_address: Json
          shipping_address: Json
          terms_allowed: boolean
          groups: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company: string
          email: string
          phone?: string
          billing_address?: Json
          shipping_address?: Json
          terms_allowed?: boolean
          groups?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company?: string
          email?: string
          phone?: string
          billing_address?: Json
          shipping_address?: Json
          terms_allowed?: boolean
          groups?: string[]
          created_at?: string
          updated_at?: string
        }
      }
      users: {
        Row: {
          id: string
          auth_user_id: string
          customer_id: string | null
          role: 'admin' | 'buyer' | 'viewer'
          email: string
          created_at: string
        }
        Insert: {
          id?: string
          auth_user_id: string
          customer_id?: string | null
          role?: 'admin' | 'buyer' | 'viewer'
          email: string
          created_at?: string
        }
        Update: {
          id?: string
          auth_user_id?: string
          customer_id?: string | null
          role?: 'admin' | 'buyer' | 'viewer'
          email?: string
          created_at?: string
        }
      }
      orders: {
        Row: {
          id: string
          customer_id: string | null
          status: 'Pending' | 'Confirmed' | 'Backordered' | 'Shipped' | 'Cancelled'
          currency: string
          total: number
          po_number: string
          quote_ref: string
          placed_at: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id?: string | null
          status?: 'Pending' | 'Confirmed' | 'Backordered' | 'Shipped' | 'Cancelled'
          currency?: string
          total?: number
          po_number?: string
          quote_ref?: string
          placed_at?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_id?: string | null
          status?: 'Pending' | 'Confirmed' | 'Backordered' | 'Shipped' | 'Cancelled'
          currency?: string
          total?: number
          po_number?: string
          quote_ref?: string
          placed_at?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      quotes: {
        Row: {
          id: string
          customer_id: string | null
          status: 'Draft' | 'Sent' | 'Approved' | 'Rejected' | 'Expired'
          pdf_url: string
          valid_until: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id?: string | null
          status?: 'Draft' | 'Sent' | 'Approved' | 'Rejected' | 'Expired'
          pdf_url?: string
          valid_until?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_id?: string | null
          status?: 'Draft' | 'Sent' | 'Approved' | 'Rejected' | 'Expired'
          pdf_url?: string
          valid_until?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

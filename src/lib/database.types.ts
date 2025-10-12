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
      manufacturer: string | null
      manufacturer_item_number: string | null
      upc: string
      short_desc: string
      long_desc: string
      item_description: string | null
      images: Json
      datasheet_url: string
      categories: string[]
      category_path: string | null
      tags: string[]
      specs: Json
      msrp: number
      map_price: number
      item_status: string | null
      stock_status: string
      stock_available: number | null
      lead_time_days: number
      weight: number
      gross_weight: number | null
      packaged_length: number | null
      packaged_width: number | null
      packaged_height: number | null
      dimensions: Json
      base_unit_of_measure: string | null
      general_item_category_group: string | null
      material_group: string | null
      material_type: string | null
      material_freight_group: string | null
      warranty: string
      battery_indicator: string | null
      rohs_compliance_indicator: string | null
      country_of_origin: string
      commodity_import_code_number: string | null
      unspsc: string | null
      delivering_plant: string | null
      manufacturer_division: string | null
      business_unit: string | null
      catalog_name: string | null
      product_family: string | null
      product_family_description: string | null
      product_family_headline: string | null
      product_family_image_url: string | null
      item_image_url: string | null
      rebox_item: boolean | null
      b_stock_item: boolean | null
      minimum_order_quantity: number | null
      salesperson_intervention_required: boolean | null
      sell_via_edi: boolean | null
      sell_via_web: string | null
      serial_number_profile: string | null
      plant_material_status_valid_from: string | null
      date_added: string | null
      product_media: Json
      detail_json: Json
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
      manufacturer?: string | null
      manufacturer_item_number?: string | null
      upc?: string
      short_desc?: string
      long_desc?: string
      item_description?: string | null
      images?: Json
      datasheet_url?: string
      categories?: string[]
      category_path?: string | null
      tags?: string[]
      specs?: Json
      msrp?: number
      map_price?: number
      item_status?: string | null
      stock_status?: string
      stock_available?: number | null
      lead_time_days?: number
      weight?: number
      gross_weight?: number | null
      packaged_length?: number | null
      packaged_width?: number | null
      packaged_height?: number | null
      dimensions?: Json
      base_unit_of_measure?: string | null
      general_item_category_group?: string | null
      material_group?: string | null
      material_type?: string | null
      material_freight_group?: string | null
      warranty?: string
      battery_indicator?: string | null
      rohs_compliance_indicator?: string | null
      country_of_origin?: string
      commodity_import_code_number?: string | null
      unspsc?: string | null
      delivering_plant?: string | null
      manufacturer_division?: string | null
      business_unit?: string | null
      catalog_name?: string | null
      product_family?: string | null
      product_family_description?: string | null
      product_family_headline?: string | null
      product_family_image_url?: string | null
      item_image_url?: string | null
      rebox_item?: boolean | null
      b_stock_item?: boolean | null
      minimum_order_quantity?: number | null
      salesperson_intervention_required?: boolean | null
      sell_via_edi?: boolean | null
      sell_via_web?: string | null
      serial_number_profile?: string | null
      plant_material_status_valid_from?: string | null
      date_added?: string | null
      product_media?: Json
      detail_json?: Json
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
      manufacturer?: string | null
      manufacturer_item_number?: string | null
      upc?: string
      short_desc?: string
      long_desc?: string
      item_description?: string | null
      images?: Json
      datasheet_url?: string
      categories?: string[]
      category_path?: string | null
      tags?: string[]
      specs?: Json
      msrp?: number
      map_price?: number
      item_status?: string | null
      stock_status?: string
      stock_available?: number | null
      lead_time_days?: number
      weight?: number
      gross_weight?: number | null
      packaged_length?: number | null
      packaged_width?: number | null
      packaged_height?: number | null
      dimensions?: Json
      base_unit_of_measure?: string | null
      general_item_category_group?: string | null
      material_group?: string | null
      material_type?: string | null
      material_freight_group?: string | null
      warranty?: string
      battery_indicator?: string | null
      rohs_compliance_indicator?: string | null
      country_of_origin?: string
      commodity_import_code_number?: string | null
      unspsc?: string | null
      delivering_plant?: string | null
      manufacturer_division?: string | null
      business_unit?: string | null
      catalog_name?: string | null
      product_family?: string | null
      product_family_description?: string | null
      product_family_headline?: string | null
      product_family_image_url?: string | null
      item_image_url?: string | null
      rebox_item?: boolean | null
      b_stock_item?: boolean | null
      minimum_order_quantity?: number | null
      salesperson_intervention_required?: boolean | null
      sell_via_edi?: boolean | null
      sell_via_web?: string | null
      serial_number_profile?: string | null
      plant_material_status_valid_from?: string | null
      date_added?: string | null
      product_media?: Json
      detail_json?: Json
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


export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "announcement_reads": {
                  Row: {
                    "announcement_id": string,"read_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "announcement_id": string,"read_at"?: string,"user_id": string
                  }
                  Update: {
                    "announcement_id"?: string,"read_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcement_reads_announcement_id_fkey"
      columns: ["announcement_id"]
isOneToOne: false
      referencedRelation: "announcements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "announcement_reads_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "member_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "announcement_reads_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"announcement_targets": {
                  Row: {
                    "announcement_id": string,"area_id": string | null,"id": string,"org_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "announcement_id": string,"area_id"?: string | null,"id"?: string,"org_id"?: string | null
                  }
                  Update: {
                    "announcement_id"?: string,"area_id"?: string | null,"id"?: string,"org_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcement_targets_announcement_id_fkey"
      columns: ["announcement_id"]
isOneToOne: false
      referencedRelation: "announcements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "announcement_targets_area_id_fkey"
      columns: ["area_id"]
isOneToOne: false
      referencedRelation: "areas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "announcement_targets_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"announcements": {
                  Row: {
                    "attachments": NonNullable<Json>,"content": string,"created_at": string,"id": string,"priority": Database["public"]['Enums']["priority_level"],"pushed_at": string | null,"scheduled_at": string,"sender_id": string | null,"target_all": boolean,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attachments"?: NonNullable<Json>,"content": string,"created_at"?: string,"id"?: string,"priority"?: Database["public"]['Enums']["priority_level"],"pushed_at"?: string | null,"scheduled_at"?: string,"sender_id"?: string | null,"target_all"?: boolean,"title": string
                  }
                  Update: {
                    "attachments"?: NonNullable<Json>,"content"?: string,"created_at"?: string,"id"?: string,"priority"?: Database["public"]['Enums']["priority_level"],"pushed_at"?: string | null,"scheduled_at"?: string,"sender_id"?: string | null,"target_all"?: boolean,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcements_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "member_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "announcements_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"app_settings": {
                  Row: {
                    "key": string,"updated_at": string,"updated_by": string | null,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"updated_at"?: string,"updated_by"?: string | null,"value": NonNullable<Json>
                  }
                  Update: {
                    "key"?: string,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"areas": {
                  Row: {
                    "created_at": string,"created_by": string | null,"description": string | null,"id": string,"name": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"name": string,"sort_order"?: number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"name"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"data": Json | null,"entity": string,"entity_id": string | null,"id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"data"?: Json | null,"entity": string,"entity_id"?: string | null,"id"?: never
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"data"?: Json | null,"entity"?: string,"entity_id"?: string | null,"id"?: never
                  }
                  Relationships: [
                    
                  ]
                },"chat_group_members": {
                  Row: {
                    "group_id": string,"is_muted": boolean,"joined_at": string,"last_read_at": string | null,"role": Database["public"]['Enums']["chat_member_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "group_id": string,"is_muted"?: boolean,"joined_at"?: string,"last_read_at"?: string | null,"role"?: Database["public"]['Enums']["chat_member_role"],"user_id": string
                  }
                  Update: {
                    "group_id"?: string,"is_muted"?: boolean,"joined_at"?: string,"last_read_at"?: string | null,"role"?: Database["public"]['Enums']["chat_member_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "chat_group_members_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "chat_groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chat_group_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "member_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chat_group_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"chat_groups": {
                  Row: {
                    "area_id": string | null,"avatar_url": string | null,"created_at": string,"created_by": string | null,"id": string,"last_message_at": string | null,"name": string,"org_id": string | null,"type": Database["public"]['Enums']["chat_group_type"]
                  }
                  ComputedFields: never
                  Insert: {
                    "area_id"?: string | null,"avatar_url"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"last_message_at"?: string | null,"name": string,"org_id"?: string | null,"type"?: Database["public"]['Enums']["chat_group_type"]
                  }
                  Update: {
                    "area_id"?: string | null,"avatar_url"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"last_message_at"?: string | null,"name"?: string,"org_id"?: string | null,"type"?: Database["public"]['Enums']["chat_group_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "chat_groups_area_id_fkey"
      columns: ["area_id"]
isOneToOne: true
      referencedRelation: "areas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chat_groups_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "member_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chat_groups_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chat_groups_org_id_fkey"
      columns: ["org_id"]
isOneToOne: true
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"contacts": {
                  Row: {
                    "category": string,"created_at": string,"id": string,"name": string,"phone": string,"sort_order": number,"title": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: string,"created_at"?: string,"id"?: string,"name": string,"phone": string,"sort_order"?: number,"title"?: string | null
                  }
                  Update: {
                    "category"?: string,"created_at"?: string,"id"?: string,"name"?: string,"phone"?: string,"sort_order"?: number,"title"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"events": {
                  Row: {
                    "area_id": string | null,"category": Database["public"]['Enums']["event_category"],"created_at": string,"created_by": string | null,"description": string | null,"ends_at": string | null,"id": string,"location": string | null,"starts_at": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "area_id"?: string | null,"category"?: Database["public"]['Enums']["event_category"],"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"ends_at"?: string | null,"id"?: string,"location"?: string | null,"starts_at": string,"title": string
                  }
                  Update: {
                    "area_id"?: string | null,"category"?: Database["public"]['Enums']["event_category"],"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"ends_at"?: string | null,"id"?: string,"location"?: string | null,"starts_at"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_area_id_fkey"
      columns: ["area_id"]
isOneToOne: false
      referencedRelation: "areas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "member_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"fund_transactions": {
                  Row: {
                    "amount": number,"created_at": string,"created_by": string | null,"description": string,"fund_id": string,"household_id": string | null,"id": string,"kind": Database["public"]['Enums']["fund_tx_kind"],"occurred_on": string,"payer_name": string | null,"receipt_path": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"created_by"?: string | null,"description": string,"fund_id": string,"household_id"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["fund_tx_kind"],"occurred_on"?: string,"payer_name"?: string | null,"receipt_path"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"created_by"?: string | null,"description"?: string,"fund_id"?: string,"household_id"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["fund_tx_kind"],"occurred_on"?: string,"payer_name"?: string | null,"receipt_path"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fund_transactions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "member_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fund_transactions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fund_transactions_fund_id_fkey"
      columns: ["fund_id"]
isOneToOne: false
      referencedRelation: "funds"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fund_transactions_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"funds": {
                  Row: {
                    "created_at": string,"created_by": string | null,"description": string | null,"id": string,"is_active": boolean,"name": string,"target_amount": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"target_amount"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"target_amount"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "funds_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "member_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "funds_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"households": {
                  Row: {
                    "address": string | null,"area_id": string | null,"code": string | null,"created_at": string,"head_name": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"area_id"?: string | null,"code"?: string | null,"created_at"?: string,"head_name": string,"id"?: string
                  }
                  Update: {
                    "address"?: string | null,"area_id"?: string | null,"code"?: string | null,"created_at"?: string,"head_name"?: string,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "households_area_id_fkey"
      columns: ["area_id"]
isOneToOne: false
      referencedRelation: "areas"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "content": string | null,"created_at": string,"deleted_at": string | null,"group_id": string,"id": string,"image_path": string | null,"is_pinned": boolean,"sender_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "content"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"group_id": string,"id"?: string,"image_path"?: string | null,"is_pinned"?: boolean,"sender_id"?: string | null
                  }
                  Update: {
                    "content"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"group_id"?: string,"id"?: string,"image_path"?: string | null,"is_pinned"?: boolean,"sender_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "chat_groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "member_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"news": {
                  Row: {
                    "author_id": string | null,"content": string,"cover_url": string | null,"created_at": string,"id": string,"is_pinned": boolean,"is_published": boolean,"published_at": string | null,"summary": string | null,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"content": string,"cover_url"?: string | null,"created_at"?: string,"id"?: string,"is_pinned"?: boolean,"is_published"?: boolean,"published_at"?: string | null,"summary"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "author_id"?: string | null,"content"?: string,"cover_url"?: string | null,"created_at"?: string,"id"?: string,"is_pinned"?: boolean,"is_published"?: boolean,"published_at"?: string | null,"summary"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "news_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "member_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "news_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"org_members": {
                  Row: {
                    "added_by": string | null,"created_at": string,"org_id": string,"role": Database["public"]['Enums']["org_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_by"?: string | null,"created_at"?: string,"org_id": string,"role"?: Database["public"]['Enums']["org_role"],"user_id": string
                  }
                  Update: {
                    "added_by"?: string | null,"created_at"?: string,"org_id"?: string,"role"?: Database["public"]['Enums']["org_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "org_members_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "org_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "member_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "org_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "area_id": string | null,"created_at": string,"created_by": string | null,"description": string | null,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "area_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"name": string
                  }
                  Update: {
                    "area_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "organizations_area_id_fkey"
      columns: ["area_id"]
isOneToOne: false
      referencedRelation: "areas"
      referencedColumns: ["id"]
    }
                  ]
                },"poll_options": {
                  Row: {
                    "id": string,"label": string,"poll_id": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"label": string,"poll_id": string,"sort_order"?: number
                  }
                  Update: {
                    "id"?: string,"label"?: string,"poll_id"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "poll_options_poll_id_fkey"
      columns: ["poll_id"]
isOneToOne: false
      referencedRelation: "polls"
      referencedColumns: ["id"]
    }
                  ]
                },"poll_targets": {
                  Row: {
                    "area_id": string | null,"id": string,"org_id": string | null,"poll_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "area_id"?: string | null,"id"?: string,"org_id"?: string | null,"poll_id": string
                  }
                  Update: {
                    "area_id"?: string | null,"id"?: string,"org_id"?: string | null,"poll_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "poll_targets_area_id_fkey"
      columns: ["area_id"]
isOneToOne: false
      referencedRelation: "areas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "poll_targets_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "poll_targets_poll_id_fkey"
      columns: ["poll_id"]
isOneToOne: false
      referencedRelation: "polls"
      referencedColumns: ["id"]
    }
                  ]
                },"poll_votes": {
                  Row: {
                    "created_at": string,"household_id": string | null,"option_id": string,"poll_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"household_id"?: string | null,"option_id": string,"poll_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"household_id"?: string | null,"option_id"?: string,"poll_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "poll_votes_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "poll_votes_option_id_fkey"
      columns: ["option_id"]
isOneToOne: false
      referencedRelation: "poll_options"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "poll_votes_poll_id_fkey"
      columns: ["poll_id"]
isOneToOne: false
      referencedRelation: "polls"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "poll_votes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "member_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "poll_votes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"polls": {
                  Row: {
                    "allow_multiple": boolean,"closed_at": string | null,"closes_at": string | null,"created_at": string,"created_by": string | null,"description": string | null,"id": string,"is_anonymous": boolean,"target_all": boolean,"title": string,"vote_scope": Database["public"]['Enums']["vote_scope"],"poll_is_open": boolean | null
                  }
                  ComputedFields: "poll_is_open"
                  Insert: {
                    "allow_multiple"?: boolean,"closed_at"?: string | null,"closes_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"is_anonymous"?: boolean,"target_all"?: boolean,"title": string,"vote_scope"?: Database["public"]['Enums']["vote_scope"]
                  }
                  Update: {
                    "allow_multiple"?: boolean,"closed_at"?: string | null,"closes_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"is_anonymous"?: boolean,"target_all"?: boolean,"title"?: string,"vote_scope"?: Database["public"]['Enums']["vote_scope"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "polls_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "member_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "polls_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "activation_attempts": number,"approved_at": string | null,"approved_by": string | null,"avatar_url": string | null,"created_at": string,"id": string,"leadership_role": Database["public"]['Enums']["leadership_role"] | null,"reject_reason": string | null,"resident_id": string | null,"status": Database["public"]['Enums']["account_status"],"updated_at": string,"username": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activation_attempts"?: number,"approved_at"?: string | null,"approved_by"?: string | null,"avatar_url"?: string | null,"created_at"?: string,"id": string,"leadership_role"?: Database["public"]['Enums']["leadership_role"] | null,"reject_reason"?: string | null,"resident_id"?: string | null,"status"?: Database["public"]['Enums']["account_status"],"updated_at"?: string,"username"?: string | null
                  }
                  Update: {
                    "activation_attempts"?: number,"approved_at"?: string | null,"approved_by"?: string | null,"avatar_url"?: string | null,"created_at"?: string,"id"?: string,"leadership_role"?: Database["public"]['Enums']["leadership_role"] | null,"reject_reason"?: string | null,"resident_id"?: string | null,"status"?: Database["public"]['Enums']["account_status"],"updated_at"?: string,"username"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_resident_id_fkey"
      columns: ["resident_id"]
isOneToOne: true
      referencedRelation: "residents"
      referencedColumns: ["id"]
    }
                  ]
                },"push_log": {
                  Row: {
                    "kind": string,"recipients": number,"ref_id": string,"sent_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "kind": string,"recipients"?: number,"ref_id": string,"sent_at"?: string
                  }
                  Update: {
                    "kind"?: string,"recipients"?: number,"ref_id"?: string,"sent_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"push_tokens": {
                  Row: {
                    "platform": string | null,"token": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "platform"?: string | null,"token": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "platform"?: string | null,"token"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_tokens_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "member_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "push_tokens_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"report_updates": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"id": string,"note": string | null,"report_id": string,"status": Database["public"]['Enums']["report_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"id"?: string,"note"?: string | null,"report_id": string,"status": Database["public"]['Enums']["report_status"]
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"id"?: string,"note"?: string | null,"report_id"?: string,"status"?: Database["public"]['Enums']["report_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "report_updates_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "member_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "report_updates_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "report_updates_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "reports"
      referencedColumns: ["id"]
    }
                  ]
                },"reports": {
                  Row: {
                    "address_text": string | null,"category": Database["public"]['Enums']["report_category"],"created_at": string,"description": string | null,"id": string,"images": (string)[],"latitude": number | null,"longitude": number | null,"rating": number | null,"rating_comment": string | null,"reporter_id": string,"status": Database["public"]['Enums']["report_status"],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address_text"?: string | null,"category": Database["public"]['Enums']["report_category"],"created_at"?: string,"description"?: string | null,"id"?: string,"images"?: (string)[],"latitude"?: number | null,"longitude"?: number | null,"rating"?: number | null,"rating_comment"?: string | null,"reporter_id": string,"status"?: Database["public"]['Enums']["report_status"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "address_text"?: string | null,"category"?: Database["public"]['Enums']["report_category"],"created_at"?: string,"description"?: string | null,"id"?: string,"images"?: (string)[],"latitude"?: number | null,"longitude"?: number | null,"rating"?: number | null,"rating_comment"?: string | null,"reporter_id"?: string,"status"?: Database["public"]['Enums']["report_status"],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "member_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"residents": {
                  Row: {
                    "activation_code": string | null,"activation_expires_at": string | null,"area_id": string | null,"birth_date": string | null,"created_at": string,"created_by": string | null,"full_name": string,"gender": Database["public"]['Enums']["gender"] | null,"household_id": string | null,"id": string,"note": string | null,"phone": string | null,"source": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activation_code"?: string | null,"activation_expires_at"?: string | null,"area_id"?: string | null,"birth_date"?: string | null,"created_at"?: string,"created_by"?: string | null,"full_name": string,"gender"?: Database["public"]['Enums']["gender"] | null,"household_id"?: string | null,"id"?: string,"note"?: string | null,"phone"?: string | null,"source"?: string,"updated_at"?: string
                  }
                  Update: {
                    "activation_code"?: string | null,"activation_expires_at"?: string | null,"area_id"?: string | null,"birth_date"?: string | null,"created_at"?: string,"created_by"?: string | null,"full_name"?: string,"gender"?: Database["public"]['Enums']["gender"] | null,"household_id"?: string | null,"id"?: string,"note"?: string | null,"phone"?: string | null,"source"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "residents_area_id_fkey"
      columns: ["area_id"]
isOneToOne: false
      referencedRelation: "areas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "residents_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"sos_events": {
                  Row: {
                    "created_at": string,"handled_at": string | null,"handled_by": string | null,"id": string,"latitude": number | null,"longitude": number | null,"message": string | null,"status": Database["public"]['Enums']["sos_status"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"handled_at"?: string | null,"handled_by"?: string | null,"id"?: string,"latitude"?: number | null,"longitude"?: number | null,"message"?: string | null,"status"?: Database["public"]['Enums']["sos_status"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"handled_at"?: string | null,"handled_by"?: string | null,"id"?: string,"latitude"?: number | null,"longitude"?: number | null,"message"?: string | null,"status"?: Database["public"]['Enums']["sos_status"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sos_events_handled_by_fkey"
      columns: ["handled_by"]
isOneToOne: false
      referencedRelation: "member_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sos_events_handled_by_fkey"
      columns: ["handled_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sos_events_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "member_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sos_events_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"venue_bookings": {
                  Row: {
                    "created_at": string,"ends_at": string,"id": string,"purpose": string,"requester_id": string,"review_note": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"starts_at": string,"status": Database["public"]['Enums']["booking_status"],"venue_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"ends_at": string,"id"?: string,"purpose": string,"requester_id": string,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"starts_at": string,"status"?: Database["public"]['Enums']["booking_status"],"venue_id": string
                  }
                  Update: {
                    "created_at"?: string,"ends_at"?: string,"id"?: string,"purpose"?: string,"requester_id"?: string,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"starts_at"?: string,"status"?: Database["public"]['Enums']["booking_status"],"venue_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "venue_bookings_requester_id_fkey"
      columns: ["requester_id"]
isOneToOne: false
      referencedRelation: "member_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "venue_bookings_requester_id_fkey"
      columns: ["requester_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "venue_bookings_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "member_directory"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "venue_bookings_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "venue_bookings_venue_id_fkey"
      columns: ["venue_id"]
isOneToOne: false
      referencedRelation: "venues"
      referencedColumns: ["id"]
    }
                  ]
                },"venues": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"is_active": boolean,"name": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"sort_order"?: number
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "member_directory": {
                  Row: {
                    "area_id": string | null,"area_name": string | null,"avatar_url": string | null,"full_name": string,"id": string,"leadership_role": Database["public"]['Enums']["leadership_role"] | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "residents_area_id_fkey"
      columns: ["area_id"]
isOneToOne: false
      referencedRelation: "areas"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "activate_account":
{ Args: { "p_code": string }; Returns: Json
                           },
"add_group_members":
{ Args: { "p_group_id": string,"p_user_ids": (string)[] }; Returns: undefined
                           },
"add_poll_option":
{ Args: { "p_label": string,"p_poll_id": string }; Returns: string
                           },
"announcement_read_stats":
{ Args: { "p_announcement": string }; Returns: {
              "read_count": number,"total": number
            }[]
                           },
"announcement_recipients":
{ Args: { "p_announcement": string }; Returns: string[]
                           },
"announcement_unread_list":
{ Args: { "p_announcement": string }; Returns: {
              "area_name": string,"full_name": string,"phone": string,"user_id": string
            }[]
                           },
"can_view_announcement":
{ Args: { "p_announcement": string }; Returns: boolean
                           },
"can_view_poll":
{ Args: { "p_poll": string }; Returns: boolean
                           },
"cancel_booking":
{ Args: { "p_booking_id": string }; Returns: undefined
                           },
"cast_vote":
{ Args: { "p_option_ids": (string)[],"p_poll_id": string }; Returns: undefined
                           },
"close_poll":
{ Args: { "p_poll_id": string }; Returns: undefined
                           },
"create_chat_group":
{ Args: { "p_area_id"?: string,"p_member_ids"?: (string)[],"p_name": string,"p_org_id"?: string,"p_type": Database["public"]['Enums']["chat_group_type"] }; Returns: string
                           },
"create_poll":
{ Args: { "p_allow_multiple"?: boolean,"p_area_ids"?: (string)[],"p_closes_at"?: string,"p_description"?: string,"p_is_anonymous"?: boolean,"p_options": (string)[],"p_org_ids"?: (string)[],"p_target_all"?: boolean,"p_title": string,"p_vote_scope"?: Database["public"]['Enums']["vote_scope"] }; Returns: string
                           },
"delete_message":
{ Args: { "p_message_id": string }; Returns: undefined
                           },
"delete_poll_option":
{ Args: { "p_option_id": string }; Returns: undefined
                           },
"fund_household_contributions":
{ Args: { "p_fund_id": string }; Returns: {
              "area_name": string,"code": string,"head_name": string,"household_id": string,"is_mine": boolean,"times": number,"total": number
            }[]
                           },
"fund_missing_households":
{ Args: { "p_area_id"?: string,"p_fund_id": string }; Returns: {
              "area_name": string,"code": string,"head_name": string,"household_id": string,"phone": string
            }[]
                           },
"fund_summaries":
{ Args: Record<PropertyKey, never>; Returns: {
              "balance": number,"created_at": string,"description": string,"households": number,"id": string,"is_active": boolean,"last_tx_on": string,"name": string,"target_amount": number,"total_chi": number,"total_thu": number
            }[]
                           },
"fund_transactions_view":
{ Args: { "p_fund_id": string }; Returns: {
              "amount": number,"created_at": string,"description": string,"household_id": string,"household_label": string,"id": string,"kind": Database["public"]['Enums']["fund_tx_kind"],"occurred_on": string,"payer_name": string,"receipt_path": string
            }[]
                           },
"gen_activation_code":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"get_me":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"handle_sos":
{ Args: { "p_sos_id": string,"p_status": Database["public"]['Enums']["sos_status"] }; Returns: undefined
                           },
"household_options":
{ Args: Record<PropertyKey, never>; Returns: {
              "area_name": string,"code": string,"head_name": string,"id": string
            }[]
                           },
"is_active":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_group_admin":
{ Args: { "p_group": string }; Returns: boolean
                           },
"is_group_member":
{ Args: { "p_group": string }; Returns: boolean
                           },
"is_leader":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_org_leader":
{ Args: { "p_org": string }; Returns: boolean
                           },
"is_poll_recipient":
{ Args: { "p_poll": string,"p_user": string }; Returns: boolean
                           },
"mark_group_read":
{ Args: { "p_group_id": string }; Returns: undefined
                           },
"my_area_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"my_chat_groups":
{ Args: Record<PropertyKey, never>; Returns: {
              "avatar_url": string,"id": string,"is_muted": boolean,"last_content": string,"last_deleted": boolean,"last_has_image": boolean,"last_message_at": string,"last_sender_id": string,"last_sender_name": string,"member_count": number,"my_role": Database["public"]['Enums']["chat_member_role"],"name": string,"type": Database["public"]['Enums']["chat_group_type"],"unread": number
            }[]
                           },
"my_rank":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"my_resident_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"pin_message":
{ Args: { "p_message_id": string,"p_pinned": boolean }; Returns: undefined
                           },
"poll_eligible_count":
{ Args: { "p_poll_id": string }; Returns: number
                           },
"poll_is_open":
{ Args: { "p": Omit<Database["public"]['Tables']["polls"]['Row'], Database["public"]['Tables']["polls"]['ComputedFields']> }; Returns: boolean
                           },
"poll_recipients":
{ Args: { "p_poll": string }; Returns: string[]
                           },
"poll_results":
{ Args: { "p_poll_id": string }; Returns: {
              "label": string,"my_vote": boolean,"option_id": string,"sort_order": number,"voters": number,"votes": number
            }[]
                           },
"poll_voters":
{ Args: { "p_poll_id": string }; Returns: {
              "area_name": string,"full_name": string,"option_label": string,"user_id": string,"voted_at": string
            }[]
                           },
"rate_report":
{ Args: { "p_comment"?: string,"p_rating": number,"p_report_id": string }; Returns: undefined
                           },
"regenerate_activation_code":
{ Args: { "p_resident_id": string }; Returns: string
                           },
"register_push_token":
{ Args: { "p_platform": string,"p_token": string }; Returns: undefined
                           },
"register_resident":
{ Args: { "p_area_id": string,"p_birth_date"?: string,"p_full_name": string,"p_gender"?: Database["public"]['Enums']["gender"],"p_household_code"?: string,"p_note"?: string,"p_phone"?: string }; Returns: Json
                           },
"remove_group_member":
{ Args: { "p_group_id": string,"p_user_id": string }; Returns: undefined
                           },
"remove_org_member":
{ Args: { "p_org_id": string,"p_user_id": string }; Returns: undefined
                           },
"rename_poll_option":
{ Args: { "p_label": string,"p_option_id": string }; Returns: undefined
                           },
"request_booking":
{ Args: { "p_ends_at": string,"p_purpose": string,"p_starts_at": string,"p_venue_id": string }; Returns: string
                           },
"review_account":
{ Args: { "p_approve": boolean,"p_reason"?: string,"p_user_id": string }; Returns: undefined
                           },
"review_booking":
{ Args: { "p_approve": boolean,"p_booking_id": string,"p_note"?: string }; Returns: undefined
                           },
"role_rank":
{ Args: { "r": Database["public"]['Enums']["leadership_role"] }; Returns: number
                           },
"send_announcement":
{ Args: { "p_area_ids"?: (string)[],"p_attachments"?: Json,"p_content": string,"p_org_ids"?: (string)[],"p_priority"?: Database["public"]['Enums']["priority_level"],"p_scheduled_at"?: string,"p_target_all"?: boolean,"p_title": string }; Returns: string
                           },
"set_account_locked":
{ Args: { "p_locked": boolean,"p_user_id": string }; Returns: undefined
                           },
"set_leadership_role":
{ Args: { "p_role": Database["public"]['Enums']["leadership_role"],"p_user_id": string }; Returns: undefined
                           },
"set_org_member":
{ Args: { "p_org_id": string,"p_role"?: Database["public"]['Enums']["org_role"],"p_user_id": string }; Returns: undefined
                           },
"sync_user_area_groups":
{ Args: { "p_user_id": string }; Returns: undefined
                           },
"unregister_push_token":
{ Args: { "p_token": string }; Returns: undefined
                           },
"update_group_member":
{ Args: { "p_group_id": string,"p_is_muted"?: boolean,"p_role"?: Database["public"]['Enums']["chat_member_role"],"p_user_id": string }; Returns: undefined
                           },
"update_my_profile":
{ Args: { "p_avatar_url"?: string,"p_phone"?: string }; Returns: undefined
                           },
"update_poll":
{ Args: { "p_closes_at"?: string,"p_description"?: string,"p_no_deadline"?: boolean,"p_poll_id": string,"p_reopen"?: boolean,"p_title": string }; Returns: undefined
                           },
"update_report_status":
{ Args: { "p_note"?: string,"p_report_id": string,"p_status": Database["public"]['Enums']["report_status"] }; Returns: undefined
                           }
          }
          Enums: {
            "account_status": "unverified"|"pending"|"active"|"rejected"|"locked","booking_status": "cho_duyet"|"da_duyet"|"tu_choi"|"da_huy","chat_group_type": "area"|"org"|"custom","chat_member_role": "admin"|"member","event_category": "hop"|"van_hoa"|"ve_sinh"|"y_te"|"the_thao"|"khac","fund_tx_kind": "thu"|"chi","gender": "nam"|"nu"|"khac","leadership_role": "bi_thu"|"truong_thon"|"pho_thon","org_role": "truong_ban"|"thanh_vien","priority_level": "khan"|"quan_trong"|"thuong","report_category": "dien"|"duong"|"nuoc"|"ve_sinh"|"an_ninh"|"khac","report_status": "moi"|"dang_xu_ly"|"hoan_thanh"|"tu_choi","sos_status": "dang_cho"|"da_tiep_nhan"|"da_xu_ly","vote_scope": "person"|"household"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "account_status": ["unverified", "pending", "active", "rejected", "locked"],"booking_status": ["cho_duyet", "da_duyet", "tu_choi", "da_huy"],"chat_group_type": ["area", "org", "custom"],"chat_member_role": ["admin", "member"],"event_category": ["hop", "van_hoa", "ve_sinh", "y_te", "the_thao", "khac"],"fund_tx_kind": ["thu", "chi"],"gender": ["nam", "nu", "khac"],"leadership_role": ["bi_thu", "truong_thon", "pho_thon"],"org_role": ["truong_ban", "thanh_vien"],"priority_level": ["khan", "quan_trong", "thuong"],"report_category": ["dien", "duong", "nuoc", "ve_sinh", "an_ninh", "khac"],"report_status": ["moi", "dang_xu_ly", "hoan_thanh", "tu_choi"],"sos_status": ["dang_cho", "da_tiep_nhan", "da_xu_ly"],"vote_scope": ["person", "household"]
          }
        }
} as const

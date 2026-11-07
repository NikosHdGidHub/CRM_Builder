export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    // Allows to automatically instantiate createClient with right options
    // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
    __InternalSupabase: {
        PostgrestVersion: "14.18"
    }
    graphql_public: {
        Tables: {
            [_ in never]: never
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            graphql: {
                Args: {
                    extensions?: Json
                    operationName?: string
                    query?: string
                    variables?: Json
                }
                Returns: Json
            }
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
    public: {
        Tables: {
            objects: {
                Row: {
                    address: string
                    created_at: string
                    created_by: string
                    deleted_at: string | null
                    deleted_by: string | null
                    id: string
                    name: string
                    updated_at: string
                }
                Insert: {
                    address: string
                    created_at?: string
                    created_by: string
                    deleted_at?: string | null
                    deleted_by?: string | null
                    id?: string
                    name: string
                    updated_at?: string
                }
                Update: {
                    address?: string
                    created_at?: string
                    created_by?: string
                    deleted_at?: string | null
                    deleted_by?: string | null
                    id?: string
                    name?: string
                    updated_at?: string
                }
                Relationships: []
            }
            profiles: {
                Row: {
                    created_at: string
                    display_name: string
                    email: string
                    id: string
                    role: Database["public"]["Enums"]["app_role"]
                }
                Insert: {
                    created_at?: string
                    display_name?: string
                    email: string
                    id: string
                    role?: Database["public"]["Enums"]["app_role"]
                }
                Update: {
                    created_at?: string
                    display_name?: string
                    email?: string
                    id?: string
                    role?: Database["public"]["Enums"]["app_role"]
                }
                Relationships: []
            }
            task_status_history: {
                Row: {
                    changed_by: string
                    comment: string | null
                    created_at: string
                    from_status: Database["public"]["Enums"]["task_status"] | null
                    id: number
                    task_id: string
                    to_status: Database["public"]["Enums"]["task_status"]
                }
                Insert: {
                    changed_by: string
                    comment?: string | null
                    created_at?: string
                    from_status?: Database["public"]["Enums"]["task_status"] | null
                    id?: never
                    task_id: string
                    to_status: Database["public"]["Enums"]["task_status"]
                }
                Update: {
                    changed_by?: string
                    comment?: string | null
                    created_at?: string
                    from_status?: Database["public"]["Enums"]["task_status"] | null
                    id?: never
                    task_id?: string
                    to_status?: Database["public"]["Enums"]["task_status"]
                }
                Relationships: [
                    {
                        foreignKeyName: "task_status_history_task_id_fkey"
                        columns: ["task_id"]
                        isOneToOne: false
                        referencedRelation: "tasks"
                        referencedColumns: ["id"]
                    },
                ]
            }
            tasks: {
                Row: {
                    created_at: string
                    created_by: string
                    deleted_at: string | null
                    deleted_by: string | null
                    description: string | null
                    executor_id: string | null
                    id: string
                    object_id: string
                    status: Database["public"]["Enums"]["task_status"]
                    title: string
                    updated_at: string
                }
                Insert: {
                    created_at?: string
                    created_by: string
                    deleted_at?: string | null
                    deleted_by?: string | null
                    description?: string | null
                    executor_id?: string | null
                    id?: string
                    object_id: string
                    status?: Database["public"]["Enums"]["task_status"]
                    title: string
                    updated_at?: string
                }
                Update: {
                    created_at?: string
                    created_by?: string
                    deleted_at?: string | null
                    deleted_by?: string | null
                    description?: string | null
                    executor_id?: string | null
                    id?: string
                    object_id?: string
                    status?: Database["public"]["Enums"]["task_status"]
                    title?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "tasks_object_id_fkey"
                        columns: ["object_id"]
                        isOneToOne: false
                        referencedRelation: "objects"
                        referencedColumns: ["id"]
                    },
                ]
            }
        }
        Views: {
            user_directory: {
                Row: {
                    display_name: string | null
                    id: string | null
                    role: Database["public"]["Enums"]["app_role"] | null
                }
                Insert: {
                    display_name?: string | null
                    id?: string | null
                    role?: Database["public"]["Enums"]["app_role"] | null
                }
                Update: {
                    display_name?: string | null
                    id?: string | null
                    role?: Database["public"]["Enums"]["app_role"] | null
                }
                Relationships: []
            }
        }
        Functions: {
            _lock_task_and_object: {
                Args: { p_task_id: string }
                Returns: {
                    created_at: string
                    created_by: string
                    deleted_at: string | null
                    deleted_by: string | null
                    description: string | null
                    executor_id: string | null
                    id: string
                    object_id: string
                    status: Database["public"]["Enums"]["task_status"]
                    title: string
                    updated_at: string
                }
                SetofOptions: {
                    from: "*"
                    to: "tasks"
                    isOneToOne: true
                    isSetofReturn: false
                }
            }
            can_view_task: { Args: { p_task_id: string }; Returns: boolean }
            create_object: {
                Args: { p_address: string; p_name: string }
                Returns: string
            }
            create_task: {
                Args: { p_description: string; p_object_id: string; p_title: string }
                Returns: string
            }
            executor_has_task_on_object: {
                Args: { p_object_id: string }
                Returns: boolean
            }
            is_manager: { Args: never; Returns: boolean }
            restore_object: { Args: { p_object_id: string }; Returns: undefined }
            restore_task: { Args: { p_task_id: string }; Returns: undefined }
            send_task: { Args: { p_task_id: string }; Returns: undefined }
            soft_delete_object: { Args: { p_object_id: string }; Returns: undefined }
            soft_delete_task: { Args: { p_task_id: string }; Returns: undefined }
            transition_task: {
                Args: {
                    p_comment?: string
                    p_task_id: string
                    p_to_status: Database["public"]["Enums"]["task_status"]
                }
                Returns: undefined
            }
            update_object: {
                Args: { p_address: string; p_name: string; p_object_id: string }
                Returns: undefined
            }
            update_task_draft: {
                Args: {
                    p_description: string
                    p_executor_id: string
                    p_object_id: string
                    p_task_id: string
                    p_title: string
                }
                Returns: undefined
            }
        }
        Enums: {
            app_role: "manager" | "executor"
            task_status:
            | "draft"
            | "new"
            | "in_progress"
            | "in_review"
            | "accepted"
            | "revision"
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
    DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
    TableName extends (DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
        ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
            DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
        : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
            Row: infer R
        }
    ? R
    : never
    : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
            Row: infer R
        }
    ? R
    : never
    : never

export type TablesInsert<
    DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
    TableName extends (DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
        : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
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
    TableName extends (DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
        : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
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
    EnumName extends (DefaultSchemaEnumNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
        : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
    : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
    PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
    CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
        ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
        : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
    : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
    graphql_public: {
        Enums: {},
    },
    public: {
        Enums: {
            app_role: ["manager", "executor"],
            task_status: [
                "draft",
                "new",
                "in_progress",
                "in_review",
                "accepted",
                "revision",
            ],
        },
    },
} as const

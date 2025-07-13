export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '12.2.3 (519615d)';
  };
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string;
          created_at: string | null;
          id: string;
          new_data: Json | null;
          old_data: Json | null;
          record_id: string | null;
          table_name: string;
          user_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string | null;
          id?: string;
          new_data?: Json | null;
          old_data?: Json | null;
          record_id?: string | null;
          table_name: string;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string | null;
          id?: string;
          new_data?: Json | null;
          old_data?: Json | null;
          record_id?: string | null;
          table_name?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      generated_content: {
        Row: {
          bucket_image_references: Json | null;
          content_text: string | null;
          content_type: Database['public']['Enums']['content_type'];
          content_url: string | null;
          created_at: string | null;
          description: string | null;
          external_job_id: string | null;
          generation_status:
            | Database['public']['Enums']['generation_status']
            | null;
          id: string;
          metadata: Json | null;
          schedule_id: string | null;
          task_id: string | null;
          task_type: string;
          title: string | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          bucket_image_references?: Json | null;
          content_text?: string | null;
          content_type: Database['public']['Enums']['content_type'];
          content_url?: string | null;
          created_at?: string | null;
          description?: string | null;
          external_job_id?: string | null;
          generation_status?:
            | Database['public']['Enums']['generation_status']
            | null;
          id?: string;
          metadata?: Json | null;
          schedule_id?: string | null;
          task_id?: string | null;
          task_type: string;
          title?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          bucket_image_references?: Json | null;
          content_text?: string | null;
          content_type?: Database['public']['Enums']['content_type'];
          content_url?: string | null;
          created_at?: string | null;
          description?: string | null;
          external_job_id?: string | null;
          generation_status?:
            | Database['public']['Enums']['generation_status']
            | null;
          id?: string;
          metadata?: Json | null;
          schedule_id?: string | null;
          task_id?: string | null;
          task_type?: string;
          title?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'generated_content_schedule_id_fkey';
            columns: ['schedule_id'];
            isOneToOne: false;
            referencedRelation: 'schedules';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'generated_content_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          }
        ];
      };
      generation_jobs: {
        Row: {
          completed_at: string | null;
          created_at: string | null;
          error_message: string | null;
          external_job_id: string | null;
          id: string;
          input_data: Json | null;
          job_type: Database['public']['Enums']['job_type'];
          output_data: Json | null;
          schedule_id: string | null;
          started_at: string | null;
          status: Database['public']['Enums']['job_status'] | null;
          task_type: string;
          user_id: string | null;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string | null;
          error_message?: string | null;
          external_job_id?: string | null;
          id?: string;
          input_data?: Json | null;
          job_type: Database['public']['Enums']['job_type'];
          output_data?: Json | null;
          schedule_id?: string | null;
          started_at?: string | null;
          status?: Database['public']['Enums']['job_status'] | null;
          task_type: string;
          user_id?: string | null;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string | null;
          error_message?: string | null;
          external_job_id?: string | null;
          id?: string;
          input_data?: Json | null;
          job_type?: Database['public']['Enums']['job_type'];
          output_data?: Json | null;
          schedule_id?: string | null;
          started_at?: string | null;
          status?: Database['public']['Enums']['job_status'] | null;
          task_type?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'generation_jobs_schedule_id_fkey';
            columns: ['schedule_id'];
            isOneToOne: false;
            referencedRelation: 'schedules';
            referencedColumns: ['id'];
          }
        ];
      };
      project_bucket_images: {
        Row: {
          created_at: string | null;
          file_size: number | null;
          filename: string;
          id: string;
          image_url: string;
          metadata: Json | null;
          mime_type: string | null;
          storage_path: string;
          task_id: string | null;
          task_type: string;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          file_size?: number | null;
          filename: string;
          id?: string;
          image_url: string;
          metadata?: Json | null;
          mime_type?: string | null;
          storage_path: string;
          task_id?: string | null;
          task_type: string;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          file_size?: number | null;
          filename?: string;
          id?: string;
          image_url?: string;
          metadata?: Json | null;
          mime_type?: string | null;
          storage_path?: string;
          task_id?: string | null;
          task_type?: string;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'project_bucket_images_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          }
        ];
      };
      projects: {
        Row: {
          created_at: string | null;
          description: string | null;
          id: string;
          name: string;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          name: string;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      schedules: {
        Row: {
          bucket_settings: Json | null;
          created_at: string | null;
          description: string | null;
          generation_settings: Json | null;
          id: string;
          last_run: string | null;
          name: string;
          next_run: string | null;
          prompt: string | null;
          schedule_config: Json | null;
          status: Database['public']['Enums']['schedule_status'] | null;
          task_id: string | null;
          task_type: string;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          bucket_settings?: Json | null;
          created_at?: string | null;
          description?: string | null;
          generation_settings?: Json | null;
          id?: string;
          last_run?: string | null;
          name: string;
          next_run?: string | null;
          prompt?: string | null;
          schedule_config?: Json | null;
          status?: Database['public']['Enums']['schedule_status'] | null;
          task_id?: string | null;
          task_type: string;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          bucket_settings?: Json | null;
          created_at?: string | null;
          description?: string | null;
          generation_settings?: Json | null;
          id?: string;
          last_run?: string | null;
          name?: string;
          next_run?: string | null;
          prompt?: string | null;
          schedule_config?: Json | null;
          status?: Database['public']['Enums']['schedule_status'] | null;
          task_id?: string | null;
          task_type?: string;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'schedules_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          }
        ];
      };
      tasks: {
        Row: {
          created_at: string | null;
          description: string | null;
          id: string;
          name: string;
          project_id: string | null;
          settings: Json | null;
          status: Database['public']['Enums']['project_status'] | null;
          task_type: Database['public']['Enums']['task_type'];
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          name: string;
          project_id?: string | null;
          settings?: Json | null;
          status?: Database['public']['Enums']['project_status'] | null;
          task_type: Database['public']['Enums']['task_type'];
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
          project_id?: string | null;
          settings?: Json | null;
          status?: Database['public']['Enums']['project_status'] | null;
          task_type?: Database['public']['Enums']['task_type'];
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'tasks_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      calculate_next_run: {
        Args: { schedule_config: Json };
        Returns: string;
      };
      create_audit_log: {
        Args: {
          p_user_id: string;
          p_action: string;
          p_table_name: string;
          p_record_id: string;
          p_old_data?: Json;
          p_new_data?: Json;
        };
        Returns: string;
      };
      get_active_schedules_for_processing: {
        Args: Record<PropertyKey, never>;
        Returns: {
          schedule_id: string;
          project_id: string;
          user_id: string;
          project_type: string;
          prompt: string;
          generation_settings: Json;
          bucket_settings: Json;
        }[];
      };
      get_user_project_count: {
        Args: {
          user_uuid: string;
          p_type: Database['public']['Enums']['task_type'];
        };
        Returns: number;
      };
      mark_generation_job_completed: {
        Args: {
          job_id: string;
          output: Json;
          success?: boolean;
          error_msg?: string;
        };
        Returns: undefined;
      };
      update_schedule_status: {
        Args: { schedule_id: string; new_status: string };
        Returns: undefined;
      };
    };
    Enums: {
      content_type: 'image' | 'design' | 'text' | 'combined';
      generation_status: 'pending' | 'processing' | 'completed' | 'failed';
      job_status: 'queued' | 'processing' | 'completed' | 'failed';
      job_type: 'single' | 'batch';
      project_status: 'active' | 'paused' | 'archived';
      schedule_status: 'active' | 'paused' | 'stopped';
      task_type: 'image-generation' | 'print-on-shirt' | 'journal';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
      DefaultSchema['Views'])
  ? (DefaultSchema['Tables'] &
      DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R;
    }
    ? R
    : never
  : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
  ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I;
    }
    ? I
    : never
  : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
  ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U;
    }
    ? U
    : never
  : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
  ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
  : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
  ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
  : never;

export const Constants = {
  public: {
    Enums: {
      content_type: ['image', 'design', 'text', 'combined'],
      generation_status: ['pending', 'processing', 'completed', 'failed'],
      job_status: ['queued', 'processing', 'completed', 'failed'],
      job_type: ['single', 'batch'],
      project_status: ['active', 'paused', 'archived'],
      schedule_status: ['active', 'paused', 'stopped'],
      task_type: ['image-generation', 'print-on-shirt', 'journal'],
    },
  },
} as const;

// Type aliases for convenience
export type GeneratedContent = Tables<'generated_content'>;
export type Project = Tables<'projects'>;
export type Task = Tables<'tasks'>;
export type Schedule = Tables<'schedules'>;
export type GenerationJob = Tables<'generation_jobs'>;
export type BucketImage = Tables<'project_bucket_images'>;

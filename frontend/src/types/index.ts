export interface User {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
}

export interface Paint {
  id: string;
  brand: string;
  name: string;
  paint_type: string;
  hex_color: string;
  category?: string;
  is_custom: boolean;
}

export interface UserPaint {
  id: string;
  user_id: string;
  paint_id: string;
  paint?: Paint;
  status: 'owned' | 'wishlist';
  quantity: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectPaint {
  paint_id: string;
  is_required: boolean;
  is_owned: boolean;
  notes?: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  image_base64?: string;
  status: 'active' | 'completed' | 'archived';
  paints: ProjectPaint[];
  created_at: string;
  updated_at: string;
}

export interface Stats {
  owned_paints: number;
  wishlist_paints: number;
  active_projects: number;
}

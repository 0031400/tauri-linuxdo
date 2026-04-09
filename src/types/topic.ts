export type TopicPoster = {
  user_id?: number;
};

export type TopicTag =
  | string
  | {
      id?: number;
      name?: string;
      slug?: string;
    };

export type TopicItem = {
  id: number;
  title?: string;
  fancy_title?: string;
  slug?: string;
  posts_count?: number;
  views?: number;
  like_count?: number;
  created_at?: string;
  last_posted_at?: string;
  tags?: TopicTag[];
  posters?: TopicPoster[];
  excerpt?: string;
};

export type TopicUser = {
  id: number;
  username: string;
  name?: string;
  avatar_template?: string;
};

export type LatestTopicsResponse = {
  users?: TopicUser[];
  topic_list?: {
    topics?: TopicItem[];
    more_topics_url?: string;
  };
};

export type TopicPost = {
  id: number;
  post_number?: number;
  username?: string;
  name?: string;
  avatar_template?: string;
  cooked?: string;
  created_at?: string;
  updated_at?: string;
  reply_count?: number;
  reads?: number;
  actions_summary?: Array<{
    id?: number;
    count?: number;
  }>;
};

export type TopicDetailResponse = {
  id: number;
  slug?: string;
  title?: string;
  fancy_title?: string;
  posts_count?: number;
  views?: number;
  like_count?: number;
  created_at?: string;
  tags?: TopicTag[];
  details?: {
    created_by?: TopicUser;
  };
  post_stream?: {
    posts?: TopicPost[];
  };
};

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
  };
};

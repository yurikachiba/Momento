export interface Photo {
  id: string;
  url: string;
  thumbnailUrl: string;
  name: string;
  memo: string;
  albumIds: string[];
  createdAt: number;
  width: number;
  height: number;
  size: number;
  quality: string;
}

export interface Album {
  id: string;
  name: string;
  icon: string;
  createdAt: number;
}

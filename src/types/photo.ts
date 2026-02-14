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

export interface SharedAlbum {
  id: string;
  name: string;
  icon: string;
  createdAt: number;
  ownerUsername: string;
  ownerDisplayName: string;
}

export interface AlbumShareEntry {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  createdAt: number;
}

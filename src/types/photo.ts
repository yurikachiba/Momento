export interface Photo {
  id: string;
  blob: Blob;
  thumbnail: Blob;
  name: string;
  albumIds: string[];
  createdAt: number;
  width: number;
  height: number;
}

export interface Album {
  id: string;
  name: string;
  icon: string;
  createdAt: number;
}

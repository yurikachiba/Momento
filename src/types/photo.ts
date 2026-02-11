export interface Photo {
  id: string;
  blob: Blob;
  thumbnail: Blob;
  name: string;
  albumIds: string[];
  createdAt: number;
  width: number;
  height: number;
  /** Firebase Storage path – set when uploaded to cloud */
  cloudPath?: string;
}

export interface Album {
  id: string;
  name: string;
  icon: string;
  createdAt: number;
}

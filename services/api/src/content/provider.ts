export interface PinnedFile {
  id: string;
  cid: string;
  size: number;
}
export interface ContentProvider {
  upload(uploadId: string, bytes: Uint8Array): Promise<PinnedFile>;
  find(uploadId: string): Promise<PinnedFile[]>;
  findCid?(cid: string): Promise<PinnedFile[]>;
  file?(providerId: string): Promise<PinnedFile | null>;
  retrieve(cid: string, expectedBytes: number): Promise<Uint8Array>;
  remove(providerId: string): Promise<void>;
}
